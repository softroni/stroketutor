import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
/** Statuses the fake answers GET calls with, by the start of their path, one per call, before it answers normally. */
let failures: Record<string, number[]>

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
  const failure = Object.entries(failures).find(([prefix, statuses]) => pathname.startsWith(prefix) && statuses.length > 0)
  if (failure) return json({ success: false, message: 'Upload-Post is busy' }, failure[1].shift())
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
        twitter: { success: true, post_metrics: { impressions: 40, likes: 2, replies: 3 } },
        tiktok: { success: true, post_metrics_error: 'The token may need to be refreshed.' },
        // A pin's post_url is where it leads (the App Store), not the pin.
        pinterest: {
          success: true,
          platform_post_id: '989806824387717196',
          post_url: 'https://apps.apple.com/app/apple-store/id6816231257?pt=1&ct=pinterest&mt=8',
          post_metrics: { impressions: 30, saves: 1, reactions: 4, comments: 0, outbound_clicks: 2, metrics_window_days: 90 },
        },
      },
    })
  }
  if (pathname.startsWith('/api/analytics/')) {
    const query = new URLSearchParams(search)
    const accounts: Record<string, Record<string, unknown>> = {
      instagram: { followers: 1, profile_links_taps: 2 },
      tiktok: { followers: 5, impressions: 41 },
      youtube: { followers: 0, stale: true },
      threads: { followers: 0, link_clicks: [{ url: 'https://softroni.com/th/papercoach', clicks: 1 }] },
      pinterest: { followers: 0, outbound_clicks: 2, account_type: 'PINNER' },
      twitter: { followers: 3 },
      facebook: { followers: 7, period_days: Number(query.get('days')), page: query.get('page_id') },
    }
    const asked = (query.get('platforms') ?? '').split(',').map((platform) => (platform === 'x' ? 'twitter' : platform))
    // Beside the platforms, something that isn't one.
    return json({ ...Object.fromEntries(asked.map((platform) => [platform, accounts[platform]])), meta: { profile: 'softroni' } })
  }
  if (pathname === '/api/uploadposts/audience') {
    const query = new URLSearchParams(search)
    return json({
      success: true,
      platform: 'tiktok',
      range: { start_date: query.get('start_date'), end_date: query.get('end_date') },
      followers_daily: [{ date: query.get('end_date'), total: 5, new: 1, lost: 0 }],
      profile_actions: { bio_link_clicks: 2, app_download_clicks: null },
      benchmark_categories: ['ART_AND_CRAFTS', 'SOFTWARE_AND_APPS'],
    })
  }
  return json({ success: false, message: 'Not found' }, 404)
}) as unknown as typeof globalThis.fetch

beforeEach(async () => {
  plan = 'Basic'
  calls = []
  boards = [{ id: '77', name: 'Drawing lessons' }]
  statusAnswers = []
  failures = {}
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
    const stats = await t.json<{ posts: number; totals: { platform: string; views: number }[]; rows: { platform: string; error: string | null; url: string | null }[] }>('social stats')
    expect(stats.posts).toBe(1)
    // X's replies count as comments, Pinterest's reactions as likes.
    expect(stats.totals).toEqual([
      { platform: 'youtube', posts: 1, views: 120, likes: 9, comments: 1 },
      { platform: 'x', posts: 1, views: 40, likes: 2, comments: 3 },
      { platform: 'tiktok', posts: 1, views: 0, likes: 0, comments: 0 },
      { platform: 'pinterest', posts: 1, views: 30, likes: 4, comments: 0 },
    ])
    expect(stats.rows.find((row) => row.platform === 'tiktok')?.error).toContain('refreshed')
    expect(stats.rows.find((row) => row.platform === 'pinterest')).toEqual(expect.objectContaining({ url: 'https://www.pinterest.com/pin/989806824387717196/' }))
    expect(stats.rows.find((row) => row.platform === 'pinterest')).not.toHaveProperty('raw')
    expect(calls.filter((call) => call.route.startsWith('/api/uploadposts/post-analytics/')).map((call) => call.route)).toEqual(['/api/uploadposts/post-analytics/recent'])
  })
})

describe('social snapshot and scorecard', () => {
  // A Wednesday, 17:45 Central: not a Monday, so older posts wait for one.
  const NOW = Date.parse('2026-10-14T22:45:00Z')
  const hoursAgo = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString()
  const metricsFile = () => path.join(t.root, '.studio', 'social', 'metrics.jsonl')
  const metricsLines = async (file = metricsFile()) =>
    (await readFile(file, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>)

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    await writeFile(path.join(t.root, 'upload-post.config'), 'UPLOAD_POST_API_KEY=test-key\nUPLOAD_POST_PROFILE=softroni\nUPLOAD_POST_FACEBOOK_PAGE=42\n')
    await mkdir(path.join(t.root, '.studio', 'social'), { recursive: true })
    const post = (requestId: string, at: string, platforms: string[], extra: Record<string, unknown> = {}) =>
      JSON.stringify({ kind: 'post', at, lessonId: 'pine-tree', profile: 'softroni', platforms, private: false, requestId, jobId: 'job', outcome: 'sent', media: 'video', purpose: 'lesson', ...extra })
    const status = (requestId: string, platforms: string[]) =>
      JSON.stringify({ kind: 'status', at: NOW, requestId, status: 'completed', results: Object.fromEntries(platforms.map((platform) => [platform, { success: true, url: null, postId: null, error: null }])) })
    await writeFile(
      path.join(t.root, '.studio', 'social', 'posts.jsonl'),
      [
        post('recent', hoursAgo(30), ['youtube', 'x', 'tiktok', 'pinterest']),
        status('recent', ['youtube', 'x', 'tiktok', 'pinterest']),
        post('test', hoursAgo(20), ['youtube'], { private: true }),
        status('test', ['youtube']),
        post('old', hoursAgo(20 * 24), ['youtube']),
        status('old', ['youtube']),
      ].join('\n') + '\n',
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps every number of each recent post and of the accounts, a line each, and only adds', async () => {
    const outcome = await t.json<{ posts: { requestId: string }[]; lines: number; mirrored: number | null; problems: string[] }>('social snapshot')
    expect(outcome.posts.map((post) => post.requestId)).toEqual(['recent'])
    expect(outcome.problems).toEqual([])
    expect(outcome.mirrored).toBeNull()

    const lines = await metricsLines()
    expect(lines.filter((line) => line.kind === 'post').map((line) => [line.platform, line.ageHours, line.requestId])).toEqual([
      ['youtube', 30, 'recent'],
      ['x', 30, 'recent'],
      ['tiktok', 30, 'recent'],
      ['pinterest', 30, 'recent'],
    ])
    // Every number as the platform gave it, and why TikTok has none.
    expect(lines.find((line) => line.platform === 'pinterest' && line.kind === 'post')).toEqual(
      expect.objectContaining({ lessonId: 'pine-tree', media: 'video', purpose: 'lesson', metrics: { impressions: 30, saves: 1, reactions: 4, comments: 0, outbound_clicks: 2, metrics_window_days: 90 } }),
    )
    expect(lines.find((line) => line.platform === 'tiktok' && line.kind === 'post')).toEqual(expect.objectContaining({ metrics: {}, error: 'The token may need to be refreshed.' }))
    expect(lines.filter((line) => line.kind === 'account').map((line) => [line.platform, line.source])).toEqual([
      ['instagram', 'analytics'],
      ['tiktok', 'analytics'],
      ['youtube', 'analytics'],
      ['threads', 'analytics'],
      ['pinterest', 'analytics'],
      ['x', 'analytics'],
      ['facebook', 'analytics'],
      ['tiktok', 'audience'],
    ])
    expect(lines.find((line) => line.source === 'audience')?.metrics).toEqual({
      range: { start_date: '2026-10-07', end_date: '2026-10-13' },
      followers_daily: [{ date: '2026-10-13', total: 5, new: 1, lost: 0 }],
      profile_actions: { bio_link_clicks: 2, app_download_clicks: null },
    })
    // The accounts first, so a run cut short among the posts still has them.
    expect(calls.map((call) => call.route)).toEqual([
      '/api/analytics/softroni?platforms=instagram,tiktok,youtube,threads,pinterest,x',
      '/api/analytics/softroni?platforms=facebook&page_id=42&days=7',
      '/api/uploadposts/audience?platform=tiktok&user=softroni&start_date=2026-10-07&end_date=2026-10-13',
      '/api/uploadposts/post-analytics/recent',
    ])
    expect(calls.every((call) => call.method === 'GET')).toBe(true)

    // Two days on: the same post again, at its new age, below the lines already there; TikTok's audience from the day after.
    vi.setSystemTime(NOW + 48 * 3_600_000)
    calls = []
    expect((await t.studio('social snapshot')).code).toBe(0)
    const again = await metricsLines()
    expect(again.slice(0, lines.length)).toEqual(lines)
    expect(again.filter((line) => line.kind === 'post').map((line) => line.ageHours)).toEqual([30, 30, 30, 30, 78, 78, 78, 78])
    expect(calls.map((call) => call.route)).toContain('/api/uploadposts/audience?platform=tiktok&user=softroni&start_date=2026-10-14&end_date=2026-10-15')

    // And the week adds up for a person.
    const card = await t.studio('social scorecard')
    expect(card.code).toBe(0)
    expect(card.stdout).toContain('The last 7 days (Oct 9 to Oct 16), from 2 snapshots.')
    expect(card.stdout).toContain('X: 1 post\n  At 72 h: median 40 views (1 post)\n  Followers: 3 (+0)')
    expect(card.stdout).toContain('Pinterest: 1 post\n  At 14 days: too young\n  Outbound clicks: 2 (1 pin read)')
    // TikTok only ever said why it had no numbers: the post is 78 hours old, with no reading at 72.
    expect(card.stdout).toContain('TikTok: 1 post\n  At 72 h: no reading at that age\n  Bio-link taps: 4 (Oct 7 to Oct 15)\n  Followers: 5 (+0)')
    expect(card.stdout).toContain('Breakouts (5× the last 14 posts, and 1,000 views): none.')
    expect(card.stdout).toContain('App Store Connect: no .studio/ops/acquisition.json yet')
  })

  it('keeps what it read when a call fails, says which, and tries once more when told to slow down', async () => {
    failures = { '/api/uploadposts/audience': [500], '/api/uploadposts/post-analytics/': [429] }
    const outcome = await t.studio('social snapshot')
    expect(outcome.code).toBe(0)
    expect(outcome.stdout).toContain('Accounts: instagram, tiktok, youtube, threads, pinterest, x; facebook (7 days)\n')
    expect(outcome.stdout).not.toContain('TikTok’s audience,')
    expect(outcome.stdout).toContain('  - TikTok’s audience: Upload-Post said 500: Upload-Post is busy')
    // The 429 was asked again, and read.
    expect(calls.filter((call) => call.route === '/api/uploadposts/post-analytics/recent')).toHaveLength(2)
    expect((await metricsLines()).map((line) => `${line.kind} ${line.platform}`)).toEqual([
      'account instagram',
      'account tiktok',
      'account youtube',
      'account threads',
      'account pinterest',
      'account x',
      'account facebook',
      'post youtube',
      'post x',
      'post tiktok',
      'post pinterest',
    ])
  })

  it('reads every post, however old, on Mondays or with --all', async () => {
    const outcome = await t.json<{ posts: { requestId: string }[]; everything: boolean }>('social snapshot --all')
    expect(outcome.everything).toBe(true)
    expect(outcome.posts.map((post) => post.requestId)).toEqual(['recent', 'old'])
    vi.setSystemTime(Date.parse('2026-10-12T22:45:00Z'))
    expect((await t.json<{ everything: boolean }>('social snapshot --dry-run')).everything).toBe(true)
  })

  it('shows what it would read without a key, and reads and writes nothing', async () => {
    await writeFile(path.join(t.root, 'upload-post.config'), 'UPLOAD_POST_PROFILE=softroni\n')
    const outcome = await t.studio('social snapshot --dry-run')
    expect(outcome.code).toBe(0)
    expect(outcome.stdout).toContain('Would read the accounts and 1 post')
    expect(outcome.stdout).toContain('GET /api/uploadposts/post-analytics/recent')
    expect(outcome.stdout).toContain('GET /api/analytics/softroni?platforms=instagram,tiktok,youtube,threads,pinterest,x')
    expect(outcome.stdout).toContain('Facebook’s account numbers need UPLOAD_POST_FACEBOOK_PAGE')
    expect(calls).toEqual([])
    await expect(readFile(metricsFile(), 'utf8')).rejects.toThrow()
  })

  it('keeps a copy on the ops-history branch, adding each line once and rewriting none', async () => {
    const history = path.join(t.root, '.studio', 'ops', 'history')
    await mkdir(path.join(history, 'social'), { recursive: true })
    await writeFile(path.join(history, '.git'), 'gitdir: elsewhere')
    const kept = path.join(history, 'social', 'metrics.jsonl')
    await writeFile(kept, '{"kind":"account","at":"2026-10-01T00:00:00.000Z","platform":"x","source":"analytics","metrics":{"followers":0}}\n')
    const first = await t.json<{ mirrored: number }>('social snapshot')
    expect(first.mirrored).toBe(12)
    vi.setSystemTime(NOW + 24 * 3_600_000)
    expect((await t.json<{ mirrored: number }>('social snapshot')).mirrored).toBe(12)
    const copy = await metricsLines(kept)
    expect(copy[0]).toEqual({ kind: 'account', at: '2026-10-01T00:00:00.000Z', platform: 'x', source: 'analytics', metrics: { followers: 0 } })
    expect(copy.slice(1)).toEqual(await metricsLines())
  })

  it('adds App Store Connect’s numbers per platform where the acquisition file has them', async () => {
    await t.studio('social snapshot')
    await mkdir(path.join(t.root, '.studio', 'ops'), { recursive: true })
    await writeFile(
      path.join(t.root, '.studio', 'ops', 'acquisition.json'),
      JSON.stringify({
        periods: {
          DAILY: [
            {
              date: '2026-10-12',
              end: '2026-10-12',
              total: { pageViews: 30, firstDownloads: 4 },
              sourceTypes: [{ sourceType: 'App referrer', pageViews: 30, firstDownloads: 4 }],
              hidden: { firstDownloads: { standard: 4, detailed: 0, hidden: 4, share: 1 } },
              campaigns: [{ campaign: 'pinterest-steps', pageViews: 9, firstDownloads: null }],
              platforms: [],
            },
          ],
        },
      }),
    )
    const card = await t.studio('social scorecard')
    expect(card.stdout).toContain('App Store: page views 9, first downloads <5')
    expect(card.stdout).toContain('App Store: page views <5, first downloads <5')
    expect(card.stdout).toContain('App Store Connect, Oct 12 (daily):\n  All sources: 30 page views, 4 first downloads\n  First downloads by source: App referrer 4')
    expect(card.stdout).toContain('Apple hides 4 of 4 first downloads from the campaign rows')
    const data = await t.json<{ platforms: { platform: string; appStore: unknown }[] }>('social scorecard --days 14')
    expect(data.platforms.find((score) => score.platform === 'pinterest')?.appStore).toEqual({ pageViews: 9, firstDownloads: '<5' })
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
