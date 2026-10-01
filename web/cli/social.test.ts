import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { dayOf } from '../server/social/posts'
import { fakeConverter, startFakeTts, type FakeTts } from '../server/testing'

import { openTestStudio, type TestStudio } from './testing'

let t: TestStudio
let tts: FakeTts
let plan: string
/** Every request the fake Upload-Post was sent: method, path and, for an upload, its fields. */
let calls: { method: string; route: string; fields?: Record<string, string[]>; video?: string; photos?: string[]; json?: Record<string, unknown> }[]
/** The Pinterest boards the fake account has; a board made through the API joins them. */
let boards: { id: string; name: string }[]
let statusAnswers: Record<string, unknown>[]

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const fakeUploadPost = (async (url: string, init: RequestInit) => {
  const { pathname, search } = new URL(url)
  const route = `${pathname}${search}`
  if (init.method === 'POST' && (pathname === '/api/upload' || pathname === '/api/upload_photos')) {
    const fields: Record<string, string[]> = {}
    const files: string[] = []
    for (const [name, value] of init.body as FormData) {
      if (typeof value === 'string') (fields[name] ??= []).push(value)
      else files.push((value as File).name)
    }
    calls.push({ method: 'POST', route, fields, ...(pathname === '/api/upload' ? { video: files[0] } : { photos: files }) })
    if (fields.scheduled_date) return json({ success: true, job_id: `job-${calls.length}`, scheduled_date: fields.scheduled_date[0] }, 202)
    return json({ success: true, message: 'Upload initiated successfully in background.', request_id: fields.request_id[0], total_platforms: fields['platform[]'].length })
  }
  if (init.method === 'POST' && pathname === '/api/uploadposts/pinterest/boards') {
    const body = JSON.parse(String(init.body)) as { name: string }
    calls.push({ method: 'POST', route, json: body })
    const board = { id: 'made-board', name: body.name }
    boards.push(board)
    return json({ success: true, board }, 201)
  }
  calls.push({ method: init.method ?? 'GET', route })
  if (pathname === '/api/uploadposts/me') return json({ success: true, email: 'hello@softroni.com', plan })
  if (pathname === '/api/uploadposts/users/softroni') {
    return json({
      success: true,
      profile: {
        username: 'softroni',
        social_accounts: {
          youtube: { display_name: 'Softroni' },
          tiktok: { username: 'softroni' },
          instagram: { display_name: 'softroni' },
          facebook: { display_name: 'Softroni' },
          threads: { username: 'softroniapps' },
          pinterest: { display_name: 'softroni' },
          x: '',
        },
      },
    })
  }
  if (pathname === '/api/uploadposts/pinterest/boards') return json({ success: true, boards })
  if (pathname === '/api/uploadposts/facebook/pages') return json({ success: true, pages: [{ id: '42', name: 'Softroni' }] })
  if (pathname === '/api/uploadposts/status') return json(statusAnswers.shift() ?? { status: 'completed', results: [] })
  if (pathname.startsWith('/api/uploadposts/post-analytics/')) {
    return json({
      success: true,
      platforms: {
        youtube: { success: true, post_url: 'https://youtube.com/shorts/abc', post_metrics: { views: 120, likes: 9, comments: 1 } },
        twitter: { success: true, post_metrics: { impressions: 40, likes: 2 } },
        tiktok: { success: true, post_metrics_error: 'The token may need to be refreshed.' },
      },
    })
  }
  return json({ success: false, message: 'Not found' }, 404)
}) as unknown as typeof globalThis.fetch

beforeEach(async () => {
  plan = 'Basic'
  calls = []
  boards = [{ id: '77', name: 'Drawing lessons' }]
  statusAnswers = []
  tts = await startFakeTts()
  t = await openTestStudio({
    // Rendering a pin needs Chrome; this writes a stand-in where the pin would go.
    social: { fetch: fakeUploadPost, renderPin: async (_html, out) => (await mkdir(path.dirname(out), { recursive: true }), await writeFile(out, 'png'), out) },
    tts: { url: tts.url, mcpUrl: tts.mcpUrl, convert: fakeConverter().convert },
  })
  await writeFile(path.join(t.root, 'upload-post.config'), 'UPLOAD_POST_API_KEY=test-key\nUPLOAD_POST_PROFILE=softroni\n')
  await writeFile(path.join(t.root, 'clip.mp4'), 'not really a video')
})

afterEach(async () => {
  await t.close()
  await tts.close()
})

const records = async () =>
  (await readFile(path.join(t.root, '.studio', 'social', 'posts.jsonl'), 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, unknown>)

const onSale = async (live: boolean) => {
  await mkdir(path.join(t.root, '.studio', 'ops'), { recursive: true })
  await writeFile(
    path.join(t.root, '.studio', 'ops', 'facts.json'),
    JSON.stringify({ versions: live ? { live: { version: '1.0' }, pending: null } : { live: null, pending: { version: '1.0', code: 'WAITING_FOR_REVIEW' } } }),
  )
}

describe('social post', () => {
  it('posts a private test where a platform allows one, waits for it, and keeps a record', async () => {
    statusAnswers = [
      { status: 'processing', results: [] },
      {
        status: 'completed',
        results: [
          { platform: 'youtube', success: true, post_url: 'https://youtube.com/shorts/abc' },
          { platform: 'tiktok', success: true, post_url: 'https://tiktok.com/@softroni/video/1' },
          { platform: 'facebook', success: false, message: 'No Page' },
        ],
      },
    ]
    const outcome = await t.studio(['social', 'post', 'simple-house', '--private', '--video', path.join(t.root, 'clip.mp4')])
    expect(outcome.code).toBe(0)
    expect(outcome.stdout).toContain('A private post leaves out instagram, threads, pinterest, x')
    expect(outcome.stdout).toContain('https://youtube.com/shorts/abc')
    expect(outcome.stdout).toContain('No Page')

    const upload = calls.find((call) => call.route === '/api/upload')!
    expect(upload.video).toBe('clip.mp4')
    expect(upload.fields!['platform[]']).toEqual(['youtube', 'tiktok', 'facebook'])
    expect(upload.fields!.privacyStatus).toEqual(['private'])
    expect(upload.fields!.privacy_level).toEqual(['SELF_ONLY'])
    expect(upload.fields!.user).toEqual(['softroni'])

    const lines = await records()
    expect(lines[0]).toMatchObject({ kind: 'post', lessonId: 'simple-house', private: true, outcome: 'sent', platforms: ['youtube', 'tiktok', 'facebook'] })
    expect(lines[1]).toMatchObject({ kind: 'status', status: 'completed', results: { youtube: { success: true, url: 'https://youtube.com/shorts/abc' } } })
  })

  it('leaves TikTok and the step pin out on the free plan, and makes the path’s Pinterest board', async () => {
    plan = 'Free'
    await onSale(true)
    const outcome = await t.studio(['social', 'post', 'simple-house', '--video', path.join(t.root, 'clip.mp4'), '--no-wait'])
    expect(outcome.code).toBe(0)
    expect(outcome.stderr).toContain('can’t post to TikTok')
    // The fake profile has X added but not connected: Upload-Post would never answer for it.
    expect(outcome.stderr).toContain('Left out x')
    expect(outcome.stdout).toContain('Made the Pinterest board “Easy Drawings: Houses”')
    expect(outcome.stdout).toContain('The step pin waits for the paid plan')
    const upload = calls.find((call) => call.route === '/api/upload')!
    expect(upload.fields!['platform[]']).toEqual(['youtube', 'instagram', 'facebook', 'threads', 'pinterest'])
    expect(upload.fields!.pinterest_board_id).toEqual(['made-board'])
    expect(upload.fields!.privacyStatus).toEqual(['public'])
    expect(calls.some((call) => call.route === '/api/upload_photos')).toBe(false)
  })

  it('schedules the lesson’s step pin on its path’s board, four hours after the video', async () => {
    await onSale(true)
    boards.push({ id: '99', name: 'Easy Drawings: Houses' })
    // The pin's page carries Fredoka and the app icon from the repository; stand-ins do here.
    for (const asset of ['docs/app-store/marketing/assets/fonts/Fredoka.ttf', 'PaperCoach/Assets.xcassets/AppIcon.appiconset/AppIcon.png']) {
      await mkdir(path.dirname(path.join(t.root, asset)), { recursive: true })
      await writeFile(path.join(t.root, asset), 'stand-in')
    }
    const outcome = await t.studio(['social', 'post', 'simple-house', '--video', path.join(t.root, 'clip.mp4'), '--no-wait', '--platforms', 'youtube,pinterest'])
    expect(outcome.code).toBe(0)
    // The board already there is used, not made again.
    expect(calls.some((call) => call.route === '/api/uploadposts/pinterest/boards' && call.method === 'POST')).toBe(false)
    const video = calls.find((call) => call.route === '/api/upload')!
    expect(video.fields!.pinterest_board_id).toEqual(['99'])
    const pin = calls.find((call) => call.route === '/api/upload_photos')!
    expect(pin.photos).toEqual(['simple-house-pin.png'])
    expect(pin.fields!['platform[]']).toEqual(['pinterest'])
    expect(pin.fields!.pinterest_board_id).toEqual(['99'])
    expect(pin.fields!.pinterest_title[0]).toMatch(/drawing: \d+ easy steps for beginners$/)
    const inHours = (Date.parse(pin.fields!.scheduled_date[0]) - Date.now()) / 3600_000
    expect(inHours).toBeGreaterThan(3.9)
    expect(inHours).toBeLessThan(4.1)
    expect(outcome.stdout).toContain('The step pin goes to Pinterest at')
    const lines = await records()
    expect(lines.filter((line) => line.kind === 'post').map((line) => line.media)).toEqual(['video', 'pin'])
  })

  it('stops waiting once every platform has answered, even while Upload-Post still says in_progress', async () => {
    statusAnswers = [
      {
        status: 'in_progress',
        results: [
          { platform: 'youtube', success: true, platform_post_id: 'abc', post_url: 'Post uploaded as Private. No public URL available.' },
          { platform: 'tiktok', success: true, post_url: 'https://tiktok.com/@softroni/video/1' },
          { platform: 'facebook', success: false, error_message: 'Page not found' },
        ],
      },
    ]
    const outcome = await t.studio(['social', 'post', 'simple-house', '--private', '--video', path.join(t.root, 'clip.mp4')])
    expect(outcome.code).toBe(0)
    expect(outcome.stdout).toContain('partial')
    expect(outcome.stdout).toContain('https://youtube.com/shorts/abc')
    expect(calls.filter((call) => call.route.startsWith('/api/uploadposts/status'))).toHaveLength(1)
    expect((await records())[1]).toMatchObject({ kind: 'status', status: 'partial' })
  })

  it('refuses a public post while Paper Coach isn’t on sale, unless told to go ahead', async () => {
    await onSale(false)
    const refused = await t.studio(['social', 'post', 'simple-house', '--video', path.join(t.root, 'clip.mp4')])
    expect(refused.code).toBe(1)
    expect(refused.stderr).toContain('isn’t on sale yet (1.0 is WAITING_FOR_REVIEW)')
    expect(calls).toEqual([])

    const posted = await t.studio(['social', 'post', 'simple-house', '--video', path.join(t.root, 'clip.mp4'), '--before-launch', '--no-wait'])
    expect(posted.code).toBe(0)
  })

  it('records a refusal without counting the lesson as posted', async () => {
    await onSale(true)
    const refusing = (async (url: string, init: RequestInit) =>
      init.method === 'POST' ? json({ success: false, message: 'This upload would exceed your monthly limit.' }, 429) : fakeUploadPost(url, init)) as unknown as typeof fetch
    await t.close()
    t = await openTestStudio({ social: { fetch: refusing } })
    await writeFile(path.join(t.root, 'upload-post.config'), 'UPLOAD_POST_API_KEY=test-key\n')
    await writeFile(path.join(t.root, 'clip.mp4'), 'x')
    const outcome = await t.studio(['social', 'post', 'simple-house', '--video', path.join(t.root, 'clip.mp4'), '--platforms', 'youtube', '--before-launch'])
    expect(outcome.code).toBe(1)
    expect(outcome.stderr).toContain('exceed your monthly limit')
    expect((await records())[0]).toMatchObject({ kind: 'post', outcome: 'refused' })
    const queue = await t.json<{ posted: string[] }>('social queue')
    expect(queue.posted).toEqual([])
  })

  it('shows what each platform would be sent without a key', async () => {
    await writeFile(path.join(t.root, 'upload-post.config'), '')
    const outcome = await t.json<{ fields: Record<string, string[]>; dryRun: boolean }>('social post simple-house --dry-run')
    expect(outcome.dryRun).toBe(true)
    expect(outcome.fields.youtube_title[0]).toMatch(/^How to draw a /)
    expect(calls).toEqual([])
  })

  it('says where to put the key when there is none', async () => {
    await writeFile(path.join(t.root, 'upload-post.config'), '')
    const outcome = await t.studio('social check')
    expect(outcome.code).toBe(1)
    expect(outcome.stderr).toContain('UPLOAD_POST_API_KEY')
  })
})

describe('the opening (E1)', () => {
  const today = dayOf(new Date().toISOString())
  /** docs/ops/social-experiments.json in the scratch repository, giving today to one arm of E1. */
  const register = async (arm: 'classic' | 'hook') => {
    await mkdir(path.join(t.root, 'docs', 'ops'), { recursive: true })
    await writeFile(path.join(t.root, 'docs', 'ops', 'social-experiments.json'), JSON.stringify({ E1: { [arm]: [today] } }))
  }

  it('posts the day’s opening from the register, and notes it with the test’s arm on the record', async () => {
    await register('classic')
    const classic = await t.studio(['social', 'post', 'simple-house', '--private', '--video', path.join(t.root, 'clip.mp4'), '--no-wait'])
    expect(classic.code).toBe(0)
    expect(classic.stdout).toContain('Posted the “Simple House” video (classic opening, E1) privately')
    await register('hook')
    expect((await t.studio(['social', 'post', 'simple-house', '--private', '--video', path.join(t.root, 'clip.mp4'), '--no-wait'])).code).toBe(0)
    const posts = (await records()).filter((line) => line.kind === 'post')
    expect(posts.map((post) => [post.opening, post.experiments])).toEqual([
      ['classic', { E1: 'classic' }],
      ['hook', { E1: 'hook' }],
    ])
  })

  it('leaves the test off the record outside its days', async () => {
    await mkdir(path.join(t.root, 'docs', 'ops'), { recursive: true })
    await writeFile(path.join(t.root, 'docs', 'ops', 'social-experiments.json'), JSON.stringify({ E1: { classic: ['2020-01-01'] } }))
    expect((await t.studio(['social', 'post', 'simple-house', '--private', '--video', path.join(t.root, 'clip.mp4'), '--no-wait'])).code).toBe(0)
    const [post] = await records()
    expect(post.opening).toBe(today >= '2026-10-05' ? 'hook' : 'classic')
    expect(post).not.toHaveProperty('experiments')
  })

  it('never posts a video whose name says the other opening, unless told it is the one to post', async () => {
    await register('hook')
    const classicFile = path.join(t.root, 'simple-house.mp4')
    await writeFile(classicFile, 'a classic video')
    const refused = await t.studio(['social', 'post', 'simple-house', '--private', '--video', classicFile])
    expect(refused.code).toBe(1)
    expect(refused.stderr).toContain('simple-house.mp4 has the classic opening, by its name, and this post takes the hook')
    expect(refused.stderr).toContain('--opening classic')
    expect(calls).toEqual([])

    const asked = await t.studio(['social', 'post', 'simple-house', '--private', '--video', classicFile, '--opening', 'classic', '--no-wait'])
    expect(asked.code).toBe(0)
    expect((await records())[0]).toMatchObject({ opening: 'classic', experiments: { E1: 'classic' } })

    const hookFile = path.join(t.root, 'simple-house-hook.mp4')
    await writeFile(hookFile, 'a hook video')
    const mismatched = await t.studio(['social', 'post', 'simple-house', '--private', '--video', hookFile, '--opening', 'classic'])
    expect(mismatched.code).toBe(1)
    expect(mismatched.stderr).toContain('simple-house-hook.mp4 has the hook opening, by its name, and this post takes the classic')
  })

  it('keeps the opening a lesson first went out with when it is posted again', async () => {
    await register('classic')
    await mkdir(path.join(t.root, '.studio', 'social'), { recursive: true })
    const earlier = { kind: 'post', at: '2026-10-06T22:00:00Z', lessonId: 'simple-house', profile: 'softroni', platforms: ['youtube'], private: false, requestId: 'r1', outcome: 'sent', media: 'video', purpose: 'lesson', opening: 'hook' }
    await writeFile(path.join(t.root, '.studio', 'social', 'posts.jsonl'), `${JSON.stringify(earlier)}\n`)
    const again = await t.json<{ opening: string; experiments: Record<string, string> }>('social post simple-house --platforms tiktok --dry-run')
    expect(again.opening).toBe('hook')
    expect(again.experiments).toEqual({ E1: 'hook' })
    // Its speed draw, never posted, takes the day's.
    expect((await t.json<{ opening: string }>('social post simple-house --speed --dry-run')).opening).toBe('classic')
  })

  it('takes the day’s opening for a lesson whose earlier post reached no platform', async () => {
    await register('classic')
    await mkdir(path.join(t.root, '.studio', 'social'), { recursive: true })
    const failed = [
      { kind: 'post', at: '2026-10-06T22:00:00Z', lessonId: 'simple-house', profile: 'softroni', platforms: ['youtube'], private: false, requestId: 'r1', outcome: 'sent', media: 'video', purpose: 'lesson', opening: 'hook' },
      { kind: 'status', at: '2026-10-06T22:05:00Z', requestId: 'r1', status: 'failed', results: { youtube: { success: false, error: 'Token expired' } } },
    ]
    await writeFile(path.join(t.root, '.studio', 'social', 'posts.jsonl'), failed.map((line) => `${JSON.stringify(line)}\n`).join(''))
    expect((await t.json<{ opening: string }>('social post simple-house --dry-run')).opening).toBe('classic')
  })

  it('opens the next lesson as the register says for the day', async () => {
    await register('classic')
    expect((await t.studio('voice cast house-chatterbox')).code).toBe(0)
    expect((await t.studio('voice narrate simple-house')).code).toBe(0)
    const outcome = await t.studio('social next --dry-run')
    expect(outcome.stdout).toContain('Would post the “Simple House” video (classic opening, E1) to')
    await register('hook')
    const next = await t.json<{ lessonId: string; opening: string; experiments: Record<string, string> }>('social next --dry-run')
    expect([next.lessonId, next.opening, next.experiments]).toEqual(['simple-house', 'hook', { E1: 'hook' }])
  })

  it('warns and still posts when the register can’t be read', async () => {
    await mkdir(path.join(t.root, 'docs', 'ops'), { recursive: true })
    await writeFile(path.join(t.root, 'docs', 'ops', 'social-experiments.json'), '{ "E1": ')
    const outcome = await t.studio('social post simple-house --dry-run')
    expect(outcome.code).toBe(0)
    expect(outcome.stderr).toContain('docs/ops/social-experiments.json: it isn’t JSON')
  })

  it('takes only the openings there are', async () => {
    const outcome = await t.studio('social post simple-house --dry-run --opening teaser')
    expect(outcome.code).toBe(2)
    expect(outcome.stderr).toContain('--opening is classic or hook, not “teaser”')
  })
})

describe('the version on sale', () => {
  it('posts only lessons in the catalog of the tagged build on sale, in its order', async () => {
    // Tag a build whose catalog has no Cars path, then put the working catalog back as it was.
    const pathsFile = path.join(t.shared, 'Catalog', 'paths.json')
    const working = await readFile(pathsFile, 'utf8')
    const catalog = JSON.parse(working) as { paths: { id: string }[] }
    await writeFile(pathsFile, JSON.stringify({ ...catalog, paths: catalog.paths.filter((entry) => entry.id !== 'cars') }))
    const git = (...args: string[]) => execFileSync('git', ['-C', t.root, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { stdio: 'pipe' })
    git('init', '-q')
    git('add', 'shared/Catalog')
    git('commit', '-qm', 'build')
    git('tag', '1.0(2)')
    await writeFile(pathsFile, working)
    await mkdir(path.join(t.root, '.studio', 'ops'), { recursive: true })
    await writeFile(path.join(t.root, '.studio', 'ops', 'facts.json'), JSON.stringify({ versions: { live: { version: '1.0', build: '2' }, pending: null } }))

    const queue = await t.json<{ total: number; coming: { lessonId: string }[] }>('social queue')
    expect(queue.total).toBe(2)
    expect(queue.coming.map((entry) => entry.lessonId)).toEqual(['palm-tree-4', 'simple-house'])
    const refused = await t.studio(['social', 'post', 'classic-red-car', '--video', path.join(t.root, 'clip.mp4')])
    expect(refused.code).toBe(1)
    expect(refused.stderr).toContain('isn’t in the version on sale')
  })
})

describe('social next', () => {
  it('picks the first narrated lesson in the posting order, skipping the ones Lina hasn’t recorded', async () => {
    expect((await t.studio('voice cast house-chatterbox')).code).toBe(0)
    expect((await t.studio('voice narrate simple-house')).code).toBe(0)
    const outcome = await t.studio('social next --dry-run')
    expect(outcome.code).toBe(0)
    // The order is lesson 1 of every path: trees (palm-tree-4), houses (simple-house), cars.
    expect(outcome.stderr).toContain('Skipped “palm-tree-4”')
    expect(outcome.stdout).toContain('Would post the “Simple House” video')
    expect(outcome.stdout).toContain('Then the step pin on Pinterest, 4 hours later')
  })

  it('waits 12 hours between posts unless told to post again', async () => {
    await mkdir(path.join(t.root, '.studio', 'social'), { recursive: true })
    const recent = { kind: 'post', at: new Date(Date.now() - 3600_000).toISOString(), lessonId: 'palm-tree-4', profile: 'softroni', platforms: ['youtube'], private: false, requestId: 'r1', outcome: 'sent' }
    await writeFile(path.join(t.root, '.studio', 'social', 'posts.jsonl'), `${JSON.stringify(recent)}\n`)
    const outcome = await t.studio('social next')
    expect(outcome.code).toBe(1)
    expect(outcome.stderr).toContain('the next one waits until 12 hours have passed')
    expect(calls).toEqual([])
  })
})

describe('social announce', () => {
  it('posts the news with a lesson’s speed draw, without counting the lesson as posted', async () => {
    await onSale(true)
    const outcome = await t.studio([
      'social', 'announce', '--lesson', 'simple-house', '--news', 'New in Paper Coach: 10 houses to draw.', '--headline', 'New: draw a street of houses',
      '--video', path.join(t.root, 'clip.mp4'), '--no-wait', '--platforms', 'youtube,tiktok,pinterest',
    ])
    expect(outcome.code).toBe(0)
    expect(outcome.stdout).toContain('Posted the news with the “Simple House” speed draw')
    const upload = calls.find((call) => call.route === '/api/upload')!
    expect(upload.fields!.youtube_title).toEqual(['New: draw a street of houses #shorts'])
    expect(upload.fields!.tiktok_title[0]).toMatch(/^New in Paper Coach: 10 houses to draw\./)
    expect(upload.fields!.pinterest_title).toEqual(['New: draw a street of houses'])
    expect(upload.fields!.external_id).toEqual(['paper-coach/simple-house/news'])
    // News brings no step pin, and the lesson's own video is still owed.
    expect(calls.some((call) => call.route === '/api/upload_photos')).toBe(false)
    expect((await records())[0]).toMatchObject({ kind: 'post', purpose: 'announce', media: 'speed' })
    expect((await t.json<{ posted: string[] }>('social queue')).posted).toEqual([])
  })

  it('needs the lesson, the news and a headline', async () => {
    const outcome = await t.studio(['social', 'announce', '--lesson', 'simple-house', '--news', 'Something new.'])
    expect(outcome.code).toBe(1)
    expect(outcome.stderr).toContain('--lesson, --news and --headline')
  })
})

describe('the daily rhythm', () => {
  it('lets news or a step pin go out without holding back the next lesson', async () => {
    await mkdir(path.join(t.root, '.studio', 'social'), { recursive: true })
    const recent = (media: string, purpose: string) =>
      JSON.stringify({ kind: 'post', at: new Date(Date.now() - 3600_000).toISOString(), lessonId: 'palm-tree-4', profile: 'softroni', platforms: ['pinterest'], private: false, requestId: `r-${media}`, outcome: 'sent', media, purpose })
    await writeFile(path.join(t.root, '.studio', 'social', 'posts.jsonl'), `${recent('pin', 'lesson')}\n${recent('speed', 'announce')}\n`)
    const outcome = await t.studio('social next')
    // Nothing is narrated in the fixture, so it stops there, not at the once-a-day rule.
    expect(outcome.stderr).not.toContain('waits until')
    expect(outcome.stderr).toContain('Every narrated lesson in the version on sale has been posted')
  })
})

describe('the repo’s copy of the posts', () => {
  it('keeps each finished post with its links on the ops-history branch, once', async () => {
    await onSale(true)
    // Where the ops-history worktree is; a test's scratch root has none, so make one.
    const history = path.join(t.root, '.studio', 'ops', 'history')
    await mkdir(history, { recursive: true })
    await writeFile(path.join(history, '.git'), 'gitdir: elsewhere')
    statusAnswers = [{ status: 'completed', results: [{ platform: 'youtube', success: true, post_url: 'https://www.youtube.com/watch?v=abc' }] }]
    const outcome = await t.studio(['social', 'post', 'simple-house', '--video', path.join(t.root, 'clip.mp4'), '--platforms', 'youtube'])
    expect(outcome.code).toBe(0)
    const kept = async () => (await readFile(path.join(history, 'social', 'posts.jsonl'), 'utf8')).trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>)
    expect(await kept()).toEqual([
      expect.objectContaining({ lessonId: 'simple-house', title: 'Simple House', media: 'video', status: 'completed', platforms: [{ platform: 'youtube', ok: true, url: 'https://www.youtube.com/watch?v=abc', error: null }] }),
    ])
    // Asking again adds nothing: one line a post.
    expect((await t.studio('social status --refresh')).code).toBe(0)
    expect(await kept()).toHaveLength(1)
  })

  it('keeps nothing where there is no ops-history worktree, and never a test post', async () => {
    statusAnswers = [{ status: 'completed', results: [{ platform: 'youtube', success: true, post_url: 'https://youtube.com/shorts/abc' }] }]
    expect((await t.studio(['social', 'post', 'simple-house', '--private', '--video', path.join(t.root, 'clip.mp4'), '--platforms', 'youtube'])).code).toBe(0)
    await expect(readFile(path.join(t.root, '.studio', 'ops', 'history', 'social', 'posts.jsonl'), 'utf8')).rejects.toThrow()
  })
})

describe('social stats', () => {
  it('adds up each platform’s views over the last days, leaving out tests and older posts', async () => {
    await mkdir(path.join(t.root, '.studio', 'social'), { recursive: true })
    const post = (requestId: string, daysAgo: number, isPrivate = false) =>
      JSON.stringify({ kind: 'post', at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(), lessonId: 'palm-tree-4', profile: 'softroni', platforms: ['youtube'], private: isPrivate, requestId, jobId: 'job', outcome: 'sent', media: 'video' })
    await writeFile(path.join(t.root, '.studio', 'social', 'posts.jsonl'), [post('recent', 2), post('test', 1, true), post('old', 20)].join('\n') + '\n')
    const stats = await t.json<{ posts: number; totals: { platform: string; views: number }[]; rows: { platform: string; error: string | null }[] }>('social stats')
    expect(stats.posts).toBe(1)
    expect(stats.totals).toEqual([
      { platform: 'youtube', posts: 1, views: 120, likes: 9, comments: 1 },
      { platform: 'x', posts: 1, views: 40, likes: 2, comments: 0 },
      { platform: 'tiktok', posts: 1, views: 0, likes: 0, comments: 0 },
    ])
    expect(stats.rows.find((row) => row.platform === 'tiktok')?.error).toContain('refreshed')
    expect(calls.filter((call) => call.route.startsWith('/api/uploadposts/post-analytics/')).map((call) => call.route)).toEqual(['/api/uploadposts/post-analytics/recent'])
  })
})

describe('social check', () => {
  it('shows the plan, the accounts, the boards and Pages, and what to fix', async () => {
    const outcome = await t.studio('social check')
    expect(outcome.code).toBe(0)
    expect(outcome.stdout).toContain('hello@softroni.com, Basic plan')
    expect(outcome.stdout).toContain('77  Drawing lessons')
    expect(outcome.stdout).toContain('42  Softroni')
    expect(outcome.stdout).toContain('x isn’t connected')
  })
})
