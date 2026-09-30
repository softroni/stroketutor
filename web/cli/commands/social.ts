import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import {
  FINAL_STATUSES,
  PLATFORMS,
  PRIVATE_PLATFORMS,
  SETTINGS_KEYS,
  normaliseResults,
  parseConfig,
  parseUpNext,
  postStates,
  postedLessons,
  postingOrder,
  settledStatus,
  socialSettings,
  socialTexts,
  uploadFields,
  withUpNext,
  type Platform,
  type PlatformResult,
  type PostState,
  type QueueEntry,
  type QueuePath,
  type SocialRecord,
  type SocialSettings,
} from '../../server/social/posts'
import { UploadPostError, uploadPostClient, type UploadPostClient } from '../../server/social/uploadPost'
import { videoDefaults } from '../../server/video/render'
import type { Tutorial } from '../../src/schema/types'

import { parseNumber, stringValue, type Parsed } from '../args'
import { command, type Command } from '../command'
import type { Context } from '../context'
import { CliError, plural, table } from '../output'

import { renderVideo, shown, videoDeps } from './video'

/**
 * `social …`: lesson videos posted to Softroni's accounts (YouTube Shorts,
 * TikTok, Instagram Reels, Facebook Reels, Pinterest, X) through Upload-Post.
 * docs/ops/README.md, "Lesson videos on social", is how they are run.
 */

const repoDirOf = (ctx: Context) => path.resolve(ctx.sharedDir, '..')
const recordsFile = (ctx: Context) => path.join(repoDirOf(ctx), '.studio', 'social', 'posts.jsonl')

async function readRecords(ctx: Context): Promise<SocialRecord[]> {
  const text = await readFile(recordsFile(ctx), 'utf8').catch(() => '')
  return text
    .split('\n')
    .filter((line) => line.trim())
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as SocialRecord]
      } catch {
        return []
      }
    })
}

/** The record only grows: one line per post and per status seen. */
async function addRecord(ctx: Context, record: SocialRecord): Promise<void> {
  await mkdir(path.dirname(recordsFile(ctx)), { recursive: true })
  await appendFile(recordsFile(ctx), `${JSON.stringify(record)}\n`)
}

async function loadSettings(ctx: Context): Promise<SocialSettings> {
  const text = await readFile(ctx.social.configFile, 'utf8').catch(() => null)
  const fromEnv = Object.fromEntries(Object.values(SETTINGS_KEYS).flatMap((key) => (ctx.env[key] ? [[key, ctx.env[key]]] : [])))
  try {
    return socialSettings({ ...(text ? parseConfig(text) : {}), ...fromEnv })
  } catch (error) {
    throw new CliError(`${ctx.social.configFile}: ${(error as Error).message}`)
  }
}

function clientOf(ctx: Context, settings: SocialSettings): UploadPostClient {
  if (!settings.apiKey) {
    throw new CliError(
      `No Upload-Post key. Put ${SETTINGS_KEYS.apiKey}=… and ${SETTINGS_KEYS.profile}=… in ${ctx.social.configFile} (chmod 600), ` +
        'with the key from app.upload-post.com → API Keys.',
    )
  }
  return uploadPostClient(settings.apiKey, ctx.social.fetch)
}

/** Free-plan names: TikTok can't be posted to on them. */
const isFreePlan = (plan: string | null) => !plan || /free|default|trial/i.test(plan)

/** Whether Paper Coach is on sale, from the last `today.py collect`; null when that has never run here. */
async function onSale(ctx: Context): Promise<{ live: boolean; pending: string | null } | null> {
  const text = await readFile(path.join(repoDirOf(ctx), '.studio', 'ops', 'facts.json'), 'utf8').catch(() => null)
  if (!text) return null
  const versions = (JSON.parse(text) as { versions?: { live?: unknown; pending?: { version?: string; code?: string } | null } }).versions
  return { live: Boolean(versions?.live), pending: versions?.pending ? `${versions.pending.version} is ${versions.pending.code}` : null }
}

function parsePlatforms(value: string | undefined, fallback: Platform[]): Platform[] {
  if (!value) return fallback
  const names = value.split(',').map((name) => name.trim().toLowerCase()).filter(Boolean).map((name) => (name === 'twitter' ? 'x' : name))
  const unknown = names.filter((name) => !(PLATFORMS as readonly string[]).includes(name))
  if (unknown.length > 0) throw new CliError(`Unknown platform ${unknown.join(', ')}; they are ${PLATFORMS.join(', ')}.`)
  return [...new Set(names)] as Platform[]
}

/** Which path the lesson is in and where: the opening line of the captions. */
function placeIn(paths: QueueEntry[] | null, lessonId: string, pathTitles: Map<string, { title: string; count: number }>) {
  const entry = paths?.find((candidate) => candidate.lessonId === lessonId)
  const found = entry ? pathTitles.get(entry.pathId) : undefined
  return entry && found ? { pathTitle: found.title, number: entry.number, count: found.count } : null
}

interface Curriculum {
  order: QueueEntry[]
  titles: Map<string, { title: string; count: number }>
  tutorials: Map<string, { tutorial: Tutorial; published: boolean }>
}

/**
 * The paths of the version on sale, from the tag of its build (`1.0(2)`), so a
 * video never sends people to a lesson that is only on main. Null when that is
 * unknown here: no `facts.json`, nothing live, or no such tag.
 */
async function pathsOnSale(ctx: Context): Promise<QueuePath[] | null> {
  const text = await readFile(path.join(repoDirOf(ctx), '.studio', 'ops', 'facts.json'), 'utf8').catch(() => null)
  const live = text ? (JSON.parse(text) as { versions?: { live?: { version?: string; build?: string } | null } }).versions?.live : null
  if (!live?.version || !live.build) return null
  try {
    const { stdout } = await promisify(execFile)('git', ['-C', repoDirOf(ctx), 'show', `${live.version}(${live.build}):shared/Catalog/paths.json`], { maxBuffer: 16 << 20 })
    return (JSON.parse(stdout) as { paths: QueuePath[] }).paths
  } catch {
    return null
  }
}

async function curriculum(ctx: Context): Promise<Curriculum> {
  const library = await ctx.library()
  const onSale = await pathsOnSale(ctx)
  const paths = onSale ?? library.catalog?.paths ?? []
  const inApp = onSale ? new Set(onSale.flatMap((entry) => entry.lessonIds)) : null
  const upNext = parseUpNext(await readFile(path.join(repoDirOf(ctx), 'docs', 'ops', 'social-up-next.txt'), 'utf8').catch(() => ''))
  return {
    order: withUpNext(postingOrder(paths), upNext),
    titles: new Map(paths.map((entry) => [entry.id, { title: entry.title, count: entry.lessonIds.length }])),
    tutorials: new Map(
      [...library.tutorials.values()].map((entry) => [
        entry.id,
        { tutorial: entry.tutorial, published: (entry.state === 'published' || entry.state === 'published-edited') && (inApp?.has(entry.id) ?? true) },
      ]),
    ),
  }
}

/** Steps Lina hasn't recorded; a video can't be made until there are none. */
async function unrecorded(ctx: Context, lessonId: string): Promise<string[]> {
  return (await videoDefaults(lessonId, await videoDeps(ctx))).missing
}

const SHARED_OPTIONS = {
  platforms: { type: 'string', description: `Only these, comma-separated (default ${SETTINGS_KEYS.platforms}, else all: ${PLATFORMS.join(', ')}).`, placeholder: 'list' },
  private: { type: 'boolean', description: 'A test only the account sees: YouTube private, TikTok "only me", a Facebook draft. Instagram, Pinterest and X have no private post and are left out.' },
  at: { type: 'string', description: 'Publish at this time instead of now (ISO 8601 with an offset, e.g. 2026-10-02T17:00:00-05:00).', placeholder: 'time' },
  'before-launch': { type: 'boolean', description: 'Post for everyone even though Paper Coach isn’t on sale yet (the video’s ending sends people to the App Store).' },
  'dry-run': { type: 'boolean', description: 'Show what each platform would be sent, and stop. Needs no key and renders nothing.' },
  'no-wait': { type: 'boolean', description: 'Return once Upload-Post has the video, without waiting for each platform to publish.' },
  log: { type: 'boolean', description: 'Add a line to the Today page’s log (docs/ops/today.py log) when the post is done.' },
} as const

const POST_OPTIONS = {
  ...SHARED_OPTIONS,
  video: { type: 'string', description: 'Post this file instead of rendering the lesson now.', placeholder: 'file.mp4' },
} as const

interface PostOutcome {
  lessonId: string
  title: string
  platforms: Platform[]
  private: boolean
  dryRun: boolean
  requestId: string | null
  jobId: string | null
  scheduledAt: string | null
  status: string | null
  results: Record<string, PlatformResult>
  fields: Record<string, string[]> | null
  video: string | null
  usage: { count: number; limit: number } | null
  warnings: string[]
}

async function postLesson(ctx: Context, lessonId: string, values: Parsed['values'], known?: Curriculum): Promise<PostOutcome> {
  const settings = await loadSettings(ctx)
  const isPrivate = values.private === true
  const dryRun = values['dry-run'] === true
  const warnings: string[] = []
  const warn = (text: string) => {
    warnings.push(text)
    ctx.out.warn(text)
  }

  let platforms = parsePlatforms(stringValue(values, 'platforms'), settings.platforms)
  if (isPrivate) {
    const dropped = platforms.filter((platform) => !PRIVATE_PLATFORMS.includes(platform))
    platforms = platforms.filter((platform) => PRIVATE_PLATFORMS.includes(platform))
    if (dropped.length > 0) ctx.out.note(`A private post leaves out ${dropped.join(', ')}: they have no private post.`)
  }
  if (platforms.length === 0) throw new CliError('No platform to post to.')

  const lessons = known ?? (await curriculum(ctx))
  const lesson = lessons.tutorials.get(lessonId)
  if (!lesson) throw new CliError(`There is no lesson "${lessonId}".`)
  if (!lesson.published && !isPrivate) throw new CliError(`“${lesson.tutorial.title}” isn’t in the version on sale. Post it once a version with it is, or with --private to test.`)

  if (!isPrivate && !dryRun && values['before-launch'] !== true) {
    const sale = await onSale(ctx)
    if (sale && !sale.live) {
      throw new CliError(
        `Paper Coach isn’t on sale yet${sale.pending ? ` (${sale.pending})` : ''}, and every video ends by sending people to the App Store. ` +
          'Post with --private to test, or pass --before-launch.',
      )
    }
  }

  const at = stringValue(values, 'at') ?? null
  if (at && (Number.isNaN(Date.parse(at)) || Date.parse(at) <= Date.now())) throw new CliError(`--at ${at} isn’t a time in the future.`)

  const texts = socialTexts(lesson.tutorial, placeIn(lessons.order, lessonId, lessons.titles), settings.providerToken)
  const requestId = randomUUID()
  const request = {
    profile: settings.profile,
    platforms,
    texts,
    settings,
    private: isPrivate,
    externalId: `paper-coach/${lessonId}`,
    requestId,
    scheduledAt: at,
    altText: `A step-by-step drawing lesson: ${lesson.tutorial.title}, drawn one line at a time.`,
  }
  const outcome: PostOutcome = {
    lessonId,
    title: lesson.tutorial.title,
    platforms,
    private: isPrivate,
    dryRun,
    requestId: null,
    jobId: null,
    scheduledAt: at,
    status: null,
    results: {},
    fields: null,
    video: null,
    usage: null,
    warnings,
  }

  if (dryRun) {
    const fields: Record<string, string[]> = {}
    for (const [name, value] of uploadFields(request)) (fields[name] ??= []).push(value)
    return { ...outcome, fields }
  }

  const client = clientOf(ctx, settings)
  const { plan } = await client.me()
  // Upload-Post never answers for a platform the profile has no account on, so those are left out here.
  const accounts = await client.accounts(settings.profile)
  const unusable = platforms.filter((platform) => {
    const account = accounts.find((candidate) => candidate.platform === platform)
    return !account?.connected || account.reauthRequired
  })
  if (unusable.length > 0) {
    platforms = platforms.filter((platform) => !unusable.includes(platform))
    warn(`Left out ${unusable.join(', ')}: not connected to the Upload-Post profile “${settings.profile}”, or needing reconnecting.`)
  }
  if (isFreePlan(plan) && platforms.includes('tiktok')) {
    platforms = platforms.filter((platform) => platform !== 'tiktok')
    warn(`Upload-Post’s ${plan ?? 'free'} plan can’t post to TikTok, so this post leaves it out.`)
  }
  if (platforms.includes('pinterest') && !settings.pinterestBoard) {
    const boards = await client.pinterestBoards(settings.profile).catch(() => [])
    if (boards.length === 1) {
      request.settings = { ...settings, pinterestBoard: boards[0].id }
      ctx.out.note(`Pinning to the only board, “${boards[0].name}”.`)
    } else {
      platforms = platforms.filter((platform) => platform !== 'pinterest')
      warn(`Pinterest needs a board: set ${SETTINGS_KEYS.pinterestBoard} to one of ${boards.map((board) => `${board.id} (${board.name})`).join(', ') || 'your boards (make one first)'}. Left out this time.`)
    }
  }
  if (platforms.length === 0) throw new CliError('Nothing left to post to.')
  request.platforms = platforms
  outcome.platforms = platforms

  let video = stringValue(values, 'video') ?? null
  if (video) {
    if (!existsSync(video)) throw new CliError(`There is no file ${video}.`)
  } else {
    const missing = await unrecorded(ctx, lessonId)
    if (missing.length > 0) throw new CliError(`Lina hasn’t recorded ${plural(missing.length, 'step')} of “${lesson.tutorial.title}” (${missing.join(', ')}): \`voice narrate ${lessonId}\` first.`)
    ctx.out.note(`Rendering “${lesson.tutorial.title}”…`)
    const rendered = await renderVideo(ctx, { lessonId })
    video = rendered.file!
  }
  outcome.video = video

  ctx.out.note(`Sending ${shown(video)} to Upload-Post for ${platforms.join(', ')}…`)
  const base = { kind: 'post' as const, lessonId, profile: settings.profile, platforms, private: isPrivate, requestId, scheduledAt: at }
  let accepted
  try {
    accepted = await client.upload(uploadFields(request), video, requestId)
  } catch (error) {
    if (error instanceof UploadPostError) {
      await addRecord(ctx, { ...base, at: new Date().toISOString(), outcome: 'refused', message: error.message })
      throw new CliError(error.message)
    }
    // No answer: the video may have gone through, so it counts as sent until `social status` says otherwise.
    const message = `No answer from Upload-Post (${String(error)}); \`social status\` will say whether it went out.`
    await addRecord(ctx, { ...base, at: new Date().toISOString(), outcome: 'sent', message })
    throw new CliError(message)
  }
  await addRecord(ctx, { ...base, at: new Date().toISOString(), jobId: accepted.jobId, outcome: 'sent' })
  for (const warning of accepted.warnings) warn(warning)
  Object.assign(outcome, { requestId, jobId: accepted.jobId, usage: accepted.usage })

  if (accepted.results) {
    const results = normaliseResults(accepted.results)
    const status = settledStatus('completed', results, platforms)
    await addRecord(ctx, { kind: 'status', at: new Date().toISOString(), requestId, status, results })
    return { ...outcome, status, results }
  }
  if (at || values['no-wait'] === true) return { ...outcome, status: at ? 'scheduled' : 'processing' }

  const seen = await waitFor(ctx, client, requestId, platforms)
  return { ...outcome, status: seen.status, results: seen.results }
}

/** Polls until every platform has finished, for up to 20 minutes (TikTok takes a few to show the post). */
async function waitFor(ctx: Context, client: UploadPostClient, requestId: string, platforms: Platform[]) {
  const deadline = Date.now() + 20 * 60_000
  let last = { status: 'pending', results: {} as Record<string, PlatformResult> }
  for (let attempt = 0; ; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, ctx.social.pollMs))
    const status = await client.status({ requestId })
    const results = normaliseResults(status.results)
    last = { status: settledStatus(status.status, results, platforms), results }
    if (FINAL_STATUSES.has(last.status) || Date.now() > deadline) break
    if (attempt % 4 === 0) ctx.out.note(`Upload-Post: ${status.status}…`)
  }
  await addRecord(ctx, { kind: 'status', at: new Date().toISOString(), requestId, ...last })
  return last
}

function resultLines(results: Record<string, PlatformResult>, platforms: string[]): string[] {
  return table(
    platforms.map((platform) => {
      const result = results[platform]
      if (!result) return [platform, '…', 'still processing']
      return [platform, result.success ? '✓' : '✗', result.success ? (result.url ?? 'published') : (result.error ?? 'failed')]
    }),
  )
}

function describePost(outcome: PostOutcome): string[] {
  if (outcome.dryRun) {
    const lines = [`Would post “${outcome.title}” to ${outcome.platforms.join(', ')}${outcome.private ? ' (private)' : ''}. The fields, as sent:`]
    for (const [name, values] of Object.entries(outcome.fields ?? {})) {
      for (const value of values) lines.push(`  ${name}: ${value.includes('\n') ? `\n    ${value.split('\n').join('\n    ')}` : value}`)
    }
    return lines
  }
  const head = outcome.scheduledAt
    ? `Scheduled “${outcome.title}” for ${outcome.scheduledAt} on ${outcome.platforms.join(', ')} (job ${outcome.jobId}).`
    : `Posted “${outcome.title}”${outcome.private ? ' privately' : ''}: ${outcome.status}.`
  const usage = outcome.usage ? [`Upload-Post uploads this month: ${outcome.usage.count} of ${outcome.usage.limit}.`] : []
  return [head, ...(outcome.scheduledAt ? [] : resultLines(outcome.results, outcome.platforms)), ...usage]
}

/** One sentence for the Today page's log. */
function logLine(outcome: PostOutcome): string {
  const done = Object.entries(outcome.results).filter(([, result]) => result.success).map(([platform]) => platform)
  const failed = Object.entries(outcome.results).filter(([, result]) => !result.success).map(([platform, result]) => `${platform} (${result.error ?? 'failed'})`)
  if (outcome.scheduledAt) return `Social: scheduled the “${outcome.title}” video for ${outcome.scheduledAt} on ${outcome.platforms.join(', ')}.`
  return (
    `Social: posted the “${outcome.title}” video${done.length ? ` to ${done.join(', ')}` : ''}` +
    (failed.length ? `; failed on ${failed.join(', ')}` : '') +
    (outcome.status !== 'completed' && !failed.length ? ` (${outcome.status})` : '') +
    '.'
  )
}

async function logToToday(ctx: Context, text: string): Promise<void> {
  const script = path.join(repoDirOf(ctx), 'docs', 'ops', 'today.py')
  if (!existsSync(script)) return
  await promisify(execFile)('python3', [script, 'log', text]).catch((error: unknown) => ctx.out.warn(`today.py log failed: ${String(error)}`))
}

/** The next lesson to post: first in the posting order, in the version on sale, never posted, and fully recorded. */
async function nextLesson(ctx: Context, lessons: Curriculum, posted: Set<string>): Promise<{ entry: QueueEntry | null; skipped: { lessonId: string; missing: string[] }[] }> {
  const skipped: { lessonId: string; missing: string[] }[] = []
  for (const entry of lessons.order) {
    if (posted.has(entry.lessonId) || !lessons.tutorials.get(entry.lessonId)?.published) continue
    const missing = await unrecorded(ctx, entry.lessonId)
    if (missing.length === 0) return { entry, skipped }
    skipped.push({ lessonId: entry.lessonId, missing })
  }
  return { entry: null, skipped }
}

export const socialCommands: Command[] = [
  command(
    'social check',
    'The Upload-Post key and plan, the accounts on the profile, and the Pinterest boards and Facebook Pages to post to.',
    [],
    {},
    async (ctx) => {
      const settings = await loadSettings(ctx)
      const client = clientOf(ctx, settings)
      const me = await client.me()
      const accounts = await client.accounts(settings.profile).catch((error: unknown) => {
        throw new CliError(error instanceof UploadPostError && error.status === 404 ? `There is no Upload-Post profile “${settings.profile}”; set ${SETTINGS_KEYS.profile} to the one holding Softroni’s accounts.` : String(error))
      })
      const has = (platform: string) => accounts.some((account) => account.platform === platform && account.connected)
      const boards = has('pinterest') ? await client.pinterestBoards(settings.profile).catch(() => []) : []
      const pages = has('facebook') ? await client.facebookPages(settings.profile).catch(() => []) : []
      const problems: string[] = []
      for (const platform of settings.platforms) {
        const account = accounts.find((candidate) => candidate.platform === platform)
        if (!account?.connected) problems.push(`${platform} isn’t connected to the profile “${settings.profile}”.`)
        else if (account.reauthRequired) problems.push(`${platform} needs reconnecting in Upload-Post (Manage Users).`)
      }
      if (settings.platforms.includes('tiktok') && isFreePlan(me.plan)) problems.push('TikTok needs a paid Upload-Post plan; posts leave it out until then.')
      if (settings.platforms.includes('pinterest') && !settings.pinterestBoard && boards.length !== 1) problems.push(`Set ${SETTINGS_KEYS.pinterestBoard} to the board to pin to.`)
      if (settings.pinterestBoard && boards.length > 0 && !boards.some((board) => board.id === settings.pinterestBoard)) problems.push(`${SETTINGS_KEYS.pinterestBoard} isn’t one of the account’s boards.`)
      if (settings.platforms.includes('facebook') && !settings.facebookPage && pages.length > 1) problems.push(`Set ${SETTINGS_KEYS.facebookPage}: the account has ${pages.length} Pages.`)
      const sale = await onSale(ctx)
      const data = { email: me.email, plan: me.plan, profile: settings.profile, accounts, boards, pages, settings: { ...settings, apiKey: settings.apiKey ? 'set' : null }, onSale: sale?.live ?? null, problems }
      ctx.out.result(data, () => [
        `Upload-Post: ${me.email ?? 'key accepted'}, ${me.plan ?? 'unknown'} plan. Profile “${settings.profile}”:`,
        ...table(accounts.map((account) => [`  ${account.platform}`, account.connected ? (account.reauthRequired ? '! reconnect' : '✓') : '✗', account.name ?? ''])),
        ...(boards.length ? ['Pinterest boards:', ...boards.map((board) => `  ${board.id}  ${board.name}${board.id === settings.pinterestBoard ? '  ← pinned to' : ''}`)] : []),
        ...(pages.length ? ['Facebook Pages:', ...pages.map((page) => `  ${page.id}  ${page.name}${page.id === settings.facebookPage ? '  ← posted to' : ''}`)] : []),
        `Posting to ${settings.platforms.join(', ')}; AI label: ${settings.aiLabel}; YouTube made for kids: ${settings.youtubeMadeForKids ? 'yes' : 'no'}.`,
        sale === null ? 'Whether Paper Coach is on sale is unknown here (no .studio/ops/facts.json).' : sale.live ? 'Paper Coach is on sale.' : `Paper Coach isn’t on sale yet${sale.pending ? ` (${sale.pending})` : ''}: only --private posts until it is.`,
        ...(problems.length ? ['', 'To fix:', ...problems.map((problem) => `  - ${problem}`)] : ['', 'Ready to post.']),
      ])
    },
  ),

  command(
    'social queue',
    'The order lessons are posted in (lesson 1 of every path, then lesson 2…, so the free ones go first), what has been posted, and what comes next.',
    [],
    { limit: { type: 'string', description: 'How many coming lessons to show (default 10).', placeholder: 'n' } },
    async (ctx, args) => {
      const limit = stringValue(args.values, 'limit') ? parseNumber(stringValue(args.values, 'limit'), '--limit') : 10
      const lessons = await curriculum(ctx)
      const records = await readRecords(ctx)
      const posted = postedLessons(records)
      const coming: { lessonId: string; title: string; path: string; number: number; free: boolean; missing: string[] }[] = []
      for (const entry of lessons.order) {
        if (coming.length >= limit) break
        const lesson = lessons.tutorials.get(entry.lessonId)
        if (posted.has(entry.lessonId) || !lesson?.published) continue
        coming.push({ lessonId: entry.lessonId, title: lesson.tutorial.title, path: entry.pathId, number: entry.number, free: entry.free, missing: await unrecorded(ctx, entry.lessonId) })
      }
      const recent = postStates(records).slice(0, 5)
      const data = { posted: [...posted], total: lessons.order.length, coming, recent }
      ctx.out.result(data, () => [
        `Posted ${posted.size} of ${lessons.order.length} lessons. Coming next:`,
        ...table(
          coming.map((entry) => [entry.lessonId, entry.path, String(entry.number), entry.free ? 'free' : 'premium', entry.missing.length ? `needs narration (${entry.missing.length})` : 'ready']),
          ['lesson', 'path', '#', 'in the app', 'video'],
        ),
        ...(recent.length ? ['', 'Last posts:', ...recent.flatMap(describeState)] : []),
      ])
    },
  ),

  command(
    'social post',
    'Render a lesson’s video and post it to Softroni’s accounts through Upload-Post, with a caption, title and link made for each platform.',
    ['<id>'],
    POST_OPTIONS,
    async (ctx, args) => {
      const outcome = await postLesson(ctx, args.positionals[0], args.values)
      if (args.values.log === true && !outcome.dryRun) await logToToday(ctx, logLine(outcome))
      ctx.out.result(outcome, describePost)
    },
  ),

  command(
    'social next',
    'Post the next lesson in the queue (see `social queue`): what the daily job runs. Refuses a second post within 20 hours unless --again.',
    [],
    { ...SHARED_OPTIONS, again: { type: 'boolean', description: 'Post even though a lesson went out in the last 20 hours.' } },
    async (ctx, args) => {
      const records = await readRecords(ctx)
      const isPrivate = args.values.private === true
      if (!isPrivate && args.values.again !== true && args.values['dry-run'] !== true) {
        const last = postStates(records).find((state) => !state.post.private)
        if (last && Date.now() - Date.parse(last.post.at) < 20 * 3600_000) {
          throw new CliError(`“${last.post.lessonId}” was posted at ${last.post.at}; the next one waits a day. Pass --again to post anyway.`)
        }
      }
      const lessons = await curriculum(ctx)
      const { entry, skipped } = await nextLesson(ctx, lessons, postedLessons(records))
      for (const skip of skipped) ctx.out.warn(`Skipped “${skip.lessonId}”: Lina hasn’t recorded ${plural(skip.missing.length, 'step')} (voice narrate ${skip.lessonId}).`)
      if (!entry) throw new CliError('Every narrated lesson in the version on sale has been posted.')
      const outcome = await postLesson(ctx, entry.lessonId, args.values, lessons)
      if (args.values.log === true && !outcome.dryRun) await logToToday(ctx, logLine(outcome))
      ctx.out.result(outcome, describePost)
    },
  ),

  command(
    'social status',
    'Where the last posts are: asks Upload-Post about any not yet finished, and lists each platform’s link or error.',
    [],
    {
      limit: { type: 'string', description: 'How many posts to show (default 5).', placeholder: 'n' },
      refresh: { type: 'boolean', description: 'Ask again about every post shown, finished or not.' },
    },
    async (ctx, args) => {
      const limit = stringValue(args.values, 'limit') ? parseNumber(stringValue(args.values, 'limit'), '--limit') : 5
      const records = await readRecords(ctx)
      const open = postStates(records)
        .slice(0, limit)
        .filter((state) => args.values.refresh === true || !state.status || !FINAL_STATUSES.has(state.status.status))
      if (open.length > 0) {
        const settings = await loadSettings(ctx)
        const client = clientOf(ctx, settings)
        for (const state of open) {
          if (state.post.scheduledAt && Date.parse(state.post.scheduledAt) > Date.now()) continue
          const status = await client.status(state.post.jobId ? { jobId: state.post.jobId } : { requestId: state.post.requestId })
          const results = normaliseResults(status.results)
          await addRecord(ctx, { kind: 'status', at: new Date().toISOString(), requestId: state.post.requestId, status: settledStatus(status.status, results, state.post.platforms), results })
        }
      }
      const states = postStates(await readRecords(ctx)).slice(0, limit)
      ctx.out.result(states, () => (states.length ? states.flatMap(describeState) : ['Nothing has been posted yet.']))
    },
  ),
]

function describeState({ post, status }: PostState): string[] {
  const when = post.scheduledAt ? `scheduled for ${post.scheduledAt}` : post.at.replace('T', ' ').slice(0, 16)
  return [
    `${post.lessonId}${post.private ? ' (private)' : ''}, ${when}: ${status?.status ?? 'sent'}`,
    ...resultLines(status?.results ?? {}, post.platforms).map((line) => `  ${line}`),
  ]
}
