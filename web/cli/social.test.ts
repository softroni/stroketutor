import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { fakeConverter, startFakeTts, type FakeTts } from '../server/testing'

import { openTestStudio, type TestStudio } from './testing'

let t: TestStudio
let tts: FakeTts
let plan: string
/** Every request the fake Upload-Post was sent: method, path and, for an upload, its fields. */
let calls: { method: string; route: string; fields?: Record<string, string[]>; video?: string }[]
let statusAnswers: Record<string, unknown>[]

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const fakeUploadPost = (async (url: string, init: RequestInit) => {
  const { pathname, search } = new URL(url)
  const route = `${pathname}${search}`
  if (init.method === 'POST' && pathname === '/api/upload') {
    const fields: Record<string, string[]> = {}
    let video: string | undefined
    for (const [name, value] of init.body as FormData) {
      if (typeof value === 'string') (fields[name] ??= []).push(value)
      else video = (value as File).name
    }
    calls.push({ method: 'POST', route, fields, video })
    return json({ success: true, message: 'Upload initiated successfully in background.', request_id: fields.request_id[0], total_platforms: fields['platform[]'].length })
  }
  calls.push({ method: init.method ?? 'GET', route })
  if (pathname === '/api/uploadposts/me') return json({ success: true, email: 'hello@softroni.com', plan })
  if (pathname === '/api/uploadposts/users/softroni') {
    return json({
      success: true,
      profile: {
        username: 'softroni',
        social_accounts: { youtube: { display_name: 'Softroni' }, tiktok: { username: 'softroni' }, instagram: { display_name: 'softroni' }, facebook: { display_name: 'Softroni' }, pinterest: { display_name: 'softroni' }, x: '' },
      },
    })
  }
  if (pathname === '/api/uploadposts/pinterest/boards') return json({ success: true, boards: [{ id: '77', name: 'Drawing lessons' }] })
  if (pathname === '/api/uploadposts/facebook/pages') return json({ success: true, pages: [{ id: '42', name: 'Softroni' }] })
  if (pathname === '/api/uploadposts/status') return json(statusAnswers.shift() ?? { status: 'completed', results: [] })
  return json({ success: false, message: 'Not found' }, 404)
}) as unknown as typeof globalThis.fetch

beforeEach(async () => {
  plan = 'Basic'
  calls = []
  statusAnswers = []
  tts = await startFakeTts()
  t = await openTestStudio({ social: { fetch: fakeUploadPost }, tts: { url: tts.url, mcpUrl: tts.mcpUrl, convert: fakeConverter().convert } })
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
    expect(outcome.stdout).toContain('A private post leaves out instagram, pinterest, x')
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

  it('leaves TikTok out on the free plan, and finds the only Pinterest board', async () => {
    plan = 'Free'
    await onSale(true)
    const outcome = await t.studio(['social', 'post', 'simple-house', '--video', path.join(t.root, 'clip.mp4'), '--no-wait'])
    expect(outcome.code).toBe(0)
    expect(outcome.stderr).toContain('can’t post to TikTok')
    // The fake profile has X added but not connected: Upload-Post would never answer for it.
    expect(outcome.stderr).toContain('Left out x')
    const upload = calls.find((call) => call.route === '/api/upload')!
    expect(upload.fields!['platform[]']).toEqual(['youtube', 'instagram', 'facebook', 'pinterest'])
    expect(upload.fields!.pinterest_board_id).toEqual(['77'])
    expect(upload.fields!.privacyStatus).toEqual(['public'])
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
    expect(outcome.stdout).toContain('Would post “Simple House”')
  })

  it('waits a day between posts unless told to post again', async () => {
    await mkdir(path.join(t.root, '.studio', 'social'), { recursive: true })
    const recent = { kind: 'post', at: new Date(Date.now() - 3600_000).toISOString(), lessonId: 'palm-tree-4', profile: 'softroni', platforms: ['youtube'], private: false, requestId: 'r1', outcome: 'sent' }
    await writeFile(path.join(t.root, '.studio', 'social', 'posts.jsonl'), `${JSON.stringify(recent)}\n`)
    const outcome = await t.studio('social next')
    expect(outcome.code).toBe(1)
    expect(outcome.stderr).toContain('the next one waits a day')
    expect(calls).toEqual([])
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
