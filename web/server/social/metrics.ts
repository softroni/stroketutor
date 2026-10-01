import { dayOf, FINAL_STATUSES, POSTING_TIME_ZONE, postStates, type SocialRecord } from './posts'

/**
 * What the posts and the accounts are doing, kept for good (docs/ops/social-plan.md, *Growth*):
 * `social snapshot` appends every number Upload-Post gives to `.studio/social/metrics.jsonl`, a
 * line per post and platform and a line per account, and `social scorecard` adds them up for the
 * Monday numbers. This file is the pure part: the lines, the age a post is judged at, medians,
 * taps toward the App Store, followers and breakouts.
 */

const HOUR = 3_600_000

export type Media = 'video' | 'speed' | 'pin'

/** One line of `.studio/social/metrics.jsonl`, which only grows. */
export type MetricsRecord = PostMetricsRecord | AccountMetricsRecord

export interface PostMetricsRecord {
  kind: 'post'
  /** When it was read. */
  at: string
  requestId: string
  lessonId: string
  media: Media
  purpose: 'lesson' | 'announce'
  platform: string
  /** Hours from the post going out to the reading. */
  ageHours: number
  /** The platform's `post_metrics` as Upload-Post gives them: views, TikTok's retention, Pinterest's outbound clicks… */
  metrics: Record<string, unknown>
  /** `post_metrics_error`: why the numbers are missing (a token to refresh…), when they are. */
  error?: string
}

export interface AccountMetricsRecord {
  kind: 'account'
  at: string
  platform: string
  /** `analytics`: GET /api/analytics/<profile> (Facebook's for the last 7 days); `audience`: TikTok's audience endpoint. */
  source: 'analytics' | 'audience'
  metrics: Record<string, unknown>
}

const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const lastOf = <T>(items: T[]): T | undefined => items[items.length - 1]

/**
 * The reading taken nearest a moment, the earlier on a tie: what a counter stood at when a window
 * opened. A snapshot's time of day moves a little from one day to the next, so last Monday's
 * reading opens this Monday's week even when it ran a few minutes after the week began.
 */
function nearestTo<T extends { at: string }>(readings: T[], time: number): T | undefined {
  const distance = (reading: T) => Math.abs(Date.parse(reading.at) - time)
  return readings.reduce<T | undefined>((best, reading) => (best === undefined || distance(reading) < distance(best) ? reading : best), undefined)
}

/**
 * Views, likes and comments in one shape, whatever each platform calls them: Threads and X say
 * `replies` for comments, Pinterest `reactions` for likes, and X and Pinterest count impressions.
 */
export function metricsSummary(raw: Record<string, unknown>): { views: number | null; likes: number | null; comments: number | null } {
  return {
    views: number(raw.views) ?? number(raw.impressions) ?? number(raw.plays),
    likes: number(raw.likes) ?? number(raw.reactions),
    comments: number(raw.comments) ?? number(raw.replies),
  }
}

/** The key a line is known by in the repo's copy, which takes each line once. */
export function metricsKey(record: MetricsRecord): string {
  return record.kind === 'post' ? ['post', record.at, record.requestId, record.platform].join('|') : ['account', record.at, record.platform, record.source].join('|')
}

// ---------- What `social snapshot` reads ----------

/** A public post that finished and went out somewhere: what the snapshot reads and the scorecard counts. */
export interface PublishedPost {
  requestId: string
  lessonId: string
  media: Media
  purpose: 'lesson' | 'announce'
  /** When it went out: a scheduled pin's time, not when it was sent. */
  at: string
  /** Where it went out (not where it failed, or sat in TikTok's inbox). */
  platforms: string[]
}

export function publishedPosts(records: SocialRecord[]): PublishedPost[] {
  return postStates(records).flatMap(({ post, status }) => {
    if (post.private || !status || !FINAL_STATUSES.has(status.status)) return []
    const platforms = post.platforms.filter((platform) => status.results[platform]?.success && !status.results[platform]?.inbox)
    if (platforms.length === 0) return []
    return [{ requestId: post.requestId, lessonId: post.lessonId, media: post.media ?? 'video', purpose: post.purpose ?? 'lesson', at: post.scheduledAt ?? post.at, platforms }]
  })
}

/** Posts are read every day for this long: the 14 days a post is judged over, and a day more, so the 14-day reading is taken. Older ones on Mondays. */
export const DAILY_SNAPSHOT_DAYS = 15

/** The posts a snapshot reads, newest first, with their age: every one gone out in the last DAILY_SNAPSHOT_DAYS, or every one when `everything`. */
export function postsToSnapshot(posts: PublishedPost[], now: number, everything: boolean): (PublishedPost & { ageHours: number })[] {
  return posts
    .map((post) => ({ ...post, ageHours: Math.round(((now - Date.parse(post.at)) / HOUR) * 10) / 10 }))
    .filter((post) => post.ageHours >= 0 && (everything || post.ageHours <= DAILY_SNAPSHOT_DAYS * 24))
    .sort((a, b) => a.ageHours - b.ageHours)
}

/** Monday in Central time, when the snapshot reads every post, however old. */
export function isMonday(now: number, timeZone = POSTING_TIME_ZONE): boolean {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(new Date(now)) === 'Mon'
}

/** One post's lines: a line per platform that gave numbers, or said why it has none. */
export function postLines(
  post: PublishedPost & { ageHours: number },
  platforms: Record<string, { raw: Record<string, unknown>; error: string | null }>,
  at: string,
): PostMetricsRecord[] {
  return Object.entries(platforms)
    .filter(([, found]) => Object.keys(found.raw).length > 0 || found.error)
    .map(([platform, found]) => ({
      kind: 'post' as const,
      at,
      requestId: post.requestId,
      lessonId: post.lessonId,
      media: post.media,
      purpose: post.purpose,
      platform,
      ageHours: post.ageHours,
      metrics: found.raw,
      ...(found.error ? { error: found.error } : {}),
    }))
}

/** `YYYY-MM-DD` moved by whole days. */
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 24 * HOUR).toISOString().slice(0, 10)
}

export interface DayRange {
  start: string
  end: string
}

/** The days a TikTok audience line covers, as TikTok answered (`range`), not as asked. */
export function audienceRangeOf(record: AccountMetricsRecord): DayRange | null {
  const range = record.metrics.range as { start_date?: unknown; end_date?: unknown } | undefined
  return typeof range?.start_date === 'string' && typeof range.end_date === 'string' ? { start: range.start_date, end: range.end_date } : null
}

/**
 * The days to ask TikTok's audience endpoint for. Its counters (`bio_link_clicks`…) are totals
 * over the days asked, so each snapshot asks for the days after the last it read, up to
 * yesterday (TikTok's latest): the lines then add up to any window without counting a day twice.
 * A week the first time; at most 60 days back, TikTok's limit; read again the same day, the same
 * days, and the later line stands for them.
 */
export function audienceRange(last: DayRange | null, yesterday: string): DayRange {
  if (!last) return { start: addDays(yesterday, -6), end: yesterday }
  if (last.end >= yesterday) return last
  const start = addDays(last.end, 1)
  const oldest = addDays(yesterday, -59)
  return { start: start < oldest ? oldest : start, end: yesterday }
}

/** The days the last TikTok audience line covered. */
export function lastAudienceRange(records: MetricsRecord[]): DayRange | null {
  const lines = records.filter((record): record is AccountMetricsRecord => record.kind === 'account' && record.source === 'audience' && record.platform === 'tiktok')
  for (const line of lines.reverse()) {
    const range = audienceRangeOf(line)
    if (range) return range
  }
  return null
}

// ---------- The scorecard ----------

/**
 * The age a post is judged at on each platform (*What we steer by*), in hours: 72; Pinterest,
 * where a pin keeps being found through search, 14 days; YouTube 7.
 */
export function judgedAge(platform: string): number {
  return platform === 'pinterest' ? 14 * 24 : platform === 'youtube' ? 7 * 24 : 72
}

/**
 * A post's reading at an age: the first at or after it, and before half as long again, so a
 * missed day never passes a five-day reading off as a three-day one.
 */
export function readingAt<T extends { ageHours: number }>(readings: T[], ageHours: number): T | null {
  return readings.filter((reading) => reading.ageHours >= ageHours && reading.ageHours < ageHours * 1.5).sort((a, b) => a.ageHours - b.ageHours)[0] ?? null
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/** TikTok's share still watching at a second, from `retention` ({second, percentage}, a fraction of 1). */
export function stillWatchingAt(raw: Record<string, unknown>, second = 3): number | null {
  if (!Array.isArray(raw.retention)) return null
  const point = (raw.retention as { second?: unknown; percentage?: unknown }[]).find((entry) => entry && Number(entry.second) === second)
  return point ? number(point.percentage) : null
}

/** TikTok's profile views per 1,000 views of a post; none for a post nobody saw. */
export function profileViewsPerThousand(raw: Record<string, unknown>): number | null {
  const views = number(raw.views)
  const profileViews = number(raw.profile_views)
  return views && profileViews !== null ? (profileViews / views) * 1000 : null
}

/** A breakout (*Rules for deciding*): at least 5× the platform's median over the 14 posts before it, at the same age, and at least 1,000 views. */
export const BREAKOUT = { times: 5, views: 1000, trailing: 14, atLeast: 3 } as const

export interface Breakout {
  requestId: string
  lessonId: string
  media: Media
  views: number
  ageHours: number
  /** The median of the posts before it at the same age, and how many had a reading then. */
  baseline: number
  baselinePosts: number
}

/**
 * A count Apple may hide (it leaves out a row under 5): the number; `<5` when every row was
 * hidden (`<5 a day` over several days, each under 5); `12+` when some were, on top of the 12
 * shown. Unknown, never 0.
 */
export type AppleCount = number | '<5' | `<5 a ${'day' | 'week' | 'month'}` | `${number}+`

export interface PlatformScore {
  platform: string
  /** Posts that went out in the window. */
  posts: number
  /** Views at the platform's age, over the posts that reached it in the window; `tooYoung`, the window's posts not that old yet. */
  views: { ageHours: number; median: number | null; posts: number; tooYoung: number }
  /** TikTok only, over the same posts: the share still watching at 3 s, and profile views per 1,000 views. */
  stillWatching3s: { median: number | null; posts: number } | null
  profileViewsPer1000: { median: number | null; posts: number } | null
  /** Taps toward the App Store, as the platform counts them; null where it counts none. */
  taps: { what: 'outbound clicks' | 'bio-link taps' | 'link clicks'; count: number | null; note: string } | null
  followers: { now: number | null; change: number | null }
  breakouts: Breakout[]
  /** App Store Connect's numbers for the platform's campaigns, when there is an acquisition file covering the window. */
  appStore: { pageViews: AppleCount; firstDownloads: AppleCount } | null
}

export interface Scorecard {
  days: number
  from: string
  to: string
  /** How many snapshots fell in the window. */
  snapshots: number
  platforms: PlatformScore[]
  acquisition: AcquisitionSummary | null
}

/** The order the plan ranks the platforms in (*Per platform*). */
export const SCORECARD_ORDER = ['pinterest', 'tiktok', 'youtube', 'instagram', 'facebook', 'threads', 'x']

export function scorecard(input: { records: MetricsRecord[]; posts: PublishedPost[]; now: number; days: number; acquisition?: unknown }): Scorecard {
  const { records, posts, now, days } = input
  const start = now - days * 24 * HOUR
  const inWindow = (time: number) => time >= start && time <= now
  const postRecords = records.filter((record): record is PostMetricsRecord => record.kind === 'post' && Date.parse(record.at) <= now)
  const accountRecords = records.filter((record): record is AccountMetricsRecord => record.kind === 'account' && Date.parse(record.at) <= now)

  // When each post went out: the record of posts, else worked out from a reading's age.
  const published = new Map<string, { at: number; lessonId: string; media: Media }>()
  for (const post of posts) published.set(post.requestId, { at: Date.parse(post.at), lessonId: post.lessonId, media: post.media })
  for (const line of postRecords) {
    if (!published.has(line.requestId)) published.set(line.requestId, { at: Date.parse(line.at) - line.ageHours * HOUR, lessonId: line.lessonId, media: line.media })
  }
  const readings = new Map<string, Map<string, PostMetricsRecord[]>>()
  for (const line of postRecords) {
    // A line that only says why a platform gave no numbers (a token to refresh…) is no reading.
    if (Object.keys(line.metrics ?? {}).length === 0) continue
    const byPost = readings.get(line.platform) ?? new Map<string, PostMetricsRecord[]>()
    byPost.set(line.requestId, [...(byPost.get(line.requestId) ?? []), line])
    readings.set(line.platform, byPost)
  }

  const seen = new Set([...posts.flatMap((post) => post.platforms), ...readings.keys(), ...accountRecords.map((record) => record.platform)])
  const platforms = [...SCORECARD_ORDER.filter((platform) => seen.has(platform)), ...[...seen].filter((platform) => !SCORECARD_ORDER.includes(platform)).sort()]
  const acquisition = input.acquisition === undefined ? null : summariseAcquisition(input.acquisition, dayOf(new Date(start).toISOString()), dayOf(new Date(now).toISOString()))

  const scores = platforms.map((platform): PlatformScore => {
    const byPost = readings.get(platform) ?? new Map<string, PostMetricsRecord[]>()
    const age = judgedAge(platform)
    const windowPosts = posts.filter((post) => post.platforms.includes(platform) && inWindow(Date.parse(post.at)))
    const ids = new Set([...byPost.keys(), ...posts.filter((post) => post.platforms.includes(platform)).map((post) => post.requestId)])
    // The posts that turned the platform's age in the window: each is judged in one week's scorecard.
    const atAge = [...ids]
      .filter((id) => inWindow((published.get(id)?.at ?? Number.NaN) + age * HOUR))
      .map((id) => readingAt(byPost.get(id) ?? [], age))
      .filter((reading): reading is PostMetricsRecord => reading !== null)
    const viewsAtAge = atAge.map((reading) => metricsSummary(reading.metrics).views).filter((views): views is number => views !== null)
    const ratio = (of: (raw: Record<string, unknown>) => number | null) => {
      const values = atAge.map((reading) => of(reading.metrics)).filter((value): value is number => value !== null)
      return { median: median(values), posts: values.length }
    }
    const accounts = accountRecords.filter((record) => record.platform === platform && record.source === 'analytics')
    return {
      platform,
      posts: windowPosts.length,
      views: { ageHours: age, median: median(viewsAtAge), posts: viewsAtAge.length, tooYoung: windowPosts.filter((post) => now - Date.parse(post.at) < age * HOUR).length },
      stillWatching3s: platform === 'tiktok' ? ratio((raw) => stillWatchingAt(raw, 3)) : null,
      profileViewsPer1000: platform === 'tiktok' ? ratio(profileViewsPerThousand) : null,
      taps: tapsOn(platform, byPost, accountRecords, published, start, now),
      followers: followersOf(accounts, start),
      breakouts: breakoutsOn(byPost, published, start, now),
      appStore: acquisition?.covered ? (acquisition.platforms[platform] ?? { pageViews: '<5', firstDownloads: '<5' }) : null,
    }
  })

  const snapshots = new Set(records.filter((record) => inWindow(Date.parse(record.at))).map((record) => record.at.slice(0, 16)))
  return { days, from: new Date(start).toISOString(), to: new Date(now).toISOString(), snapshots: snapshots.size, platforms: scores, acquisition }
}

function tapsOn(
  platform: string,
  byPost: Map<string, PostMetricsRecord[]>,
  accounts: AccountMetricsRecord[],
  published: Map<string, { at: number }>,
  start: number,
  now: number,
): PlatformScore['taps'] {
  const latest = (source: AccountMetricsRecord['source']) => lastOf(accounts.filter((record) => record.platform === platform && record.source === source)) ?? null
  if (platform === 'pinterest') {
    const clicks = pinterestClicks(byPost, published, start, now)
    return { what: 'outbound clicks', count: clicks.count, note: `${clicks.pins} ${clicks.pins === 1 ? 'pin' : 'pins'} read` }
  }
  if (platform === 'tiktok') {
    const taps = bioLinkTaps(accounts, dayOf(new Date(start).toISOString()), dayOf(new Date(now).toISOString()))
    return { what: 'bio-link taps', count: taps.count, note: taps.range ? `${taps.range.start} to ${taps.range.end}` : 'not read yet' }
  }
  if (platform === 'instagram') {
    const reading = latest('analytics')
    return { what: 'bio-link taps', count: reading ? number(reading.metrics.profile_links_taps) : null, note: reading ? 'latest account reading' : 'not read yet' }
  }
  if (platform === 'threads') {
    const reading = latest('analytics')
    const links = reading?.metrics.link_clicks
    const count = Array.isArray(links) ? links.reduce((sum: number, link) => sum + (number((link as { clicks?: unknown })?.clicks) ?? 0), 0) : reading ? number(reading.metrics.clicks) : null
    return { what: 'link clicks', count, note: reading ? 'latest account reading' : 'not read yet' }
  }
  return null
}

/**
 * Pinterest's outbound clicks in the window, over every pin read in it: each pin's count at its
 * last reading less its count at the reading nearest the window's start (0 for a pin that went
 * out in the window), so a pin found months later through search still counts, and an old pin
 * read only on Mondays counts its week once.
 */
export function pinterestClicks(byPost: Map<string, PostMetricsRecord[]>, published: Map<string, { at: number }>, start: number, now: number): { count: number | null; pins: number } {
  let count: number | null = null
  let pins = 0
  for (const [id, lines] of byPost) {
    const clicksOf = (line: PostMetricsRecord) => number(line.metrics.outbound_clicks)
    const read = lines.filter((line) => clicksOf(line) !== null && Date.parse(line.at) <= now).sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    const last = lastOf(read)
    if (!last || Date.parse(last.at) < start) continue
    const wentOut = published.get(id)?.at ?? Number.NaN
    const opening = wentOut >= start ? null : nearestTo(read, start)!
    count = (count ?? 0) + Math.max(0, clicksOf(last)! - (opening ? clicksOf(opening)! : 0))
    pins += 1
  }
  return { count, pins }
}

/**
 * TikTok's bio-link taps over the days of the window: the audience lines' totals, each run of days
 * once (the latest line for the same days stands), with the days they cover. A null total is
 * TikTok saying nothing, not 0.
 */
export function bioLinkTaps(accounts: AccountMetricsRecord[], fromDay: string, toDay: string): { count: number | null; range: DayRange | null } {
  const byRange = new Map<string, { range: DayRange; clicks: number | null }>()
  for (const record of accounts) {
    if (record.platform !== 'tiktok' || record.source !== 'audience') continue
    const range = audienceRangeOf(record)
    if (!range) continue
    const actions = record.metrics.profile_actions as { bio_link_clicks?: unknown } | undefined
    byRange.set(`${range.start}..${range.end}`, { range, clicks: number(actions?.bio_link_clicks) })
  }
  let count: number | null = null
  let first: string | null = null
  let lastEnd = ''
  for (const { range, clicks } of [...byRange.values()].sort((a, b) => (a.range.start < b.range.start ? -1 : 1))) {
    if (range.start <= lastEnd || range.end < fromDay || range.start > toDay) continue
    first ??= range.start
    lastEnd = range.end
    if (clicks !== null) count = (count ?? 0) + clicks
  }
  return { count, range: first ? { start: first, end: lastEnd } : null }
}

/** Followers at the last reading, and the change since the reading nearest the window's start. */
export function followersOf(readings: AccountMetricsRecord[], start: number): PlatformScore['followers'] {
  const read = readings.filter((record) => number(record.metrics.followers) !== null)
  const last = lastOf(read)
  if (!last) return { now: null, change: null }
  const opening = nearestTo(read, start)
  const now = number(last.metrics.followers)!
  return { now, change: opening && opening !== last ? now - number(opening.metrics.followers)! : null }
}

/** The window's breakouts on one platform: each post's latest views against the 14 posts before it at the same age. */
export function breakoutsOn(byPost: Map<string, PostMetricsRecord[]>, published: Map<string, { at: number; lessonId: string; media: Media }>, start: number, now: number): Breakout[] {
  const viewsOf = (reading: PostMetricsRecord) => metricsSummary(reading.metrics).views
  // Readings with views only: one that says why there are none stands for nothing.
  const withViews = (id: string) => byPost.get(id)!.filter((reading) => viewsOf(reading) !== null)
  const ids = [...byPost.keys()].filter((id) => published.has(id)).sort((a, b) => published.get(a)!.at - published.get(b)!.at)
  const found: Breakout[] = []
  ids.forEach((id, index) => {
    const post = published.get(id)!
    if (post.at < start || post.at > now) return
    const latest = lastOf(withViews(id).sort((a, b) => a.ageHours - b.ageHours))
    if (!latest) return
    const views = viewsOf(latest)!
    if (views < BREAKOUT.views) return
    const before = ids
      .slice(Math.max(0, index - BREAKOUT.trailing), index)
      .map((other) => readingAt(withViews(other), latest.ageHours))
      .map((reading) => (reading ? viewsOf(reading) : null))
      .filter((value): value is number => value !== null)
    const baseline = median(before)
    if (baseline === null || before.length < BREAKOUT.atLeast || views < BREAKOUT.times * baseline) return
    found.push({ requestId: id, lessonId: post.lessonId, media: post.media, views, ageHours: latest.ageHours, baseline, baselinePosts: before.length })
  })
  return found
}

// ---------- App Store Connect ----------

/**
 * `.studio/ops/acquisition.json`, App Store Connect's numbers from the acquisition pull, read for
 * the window. Its `periods` (DAILY, WEEKLY, MONTHLY) each run from `date` to `end`, with a `total`
 * and `sourceTypes` (the Standard reports, never hidden), and `platforms` and `campaigns` (the
 * Detailed ones, by campaign: a platform's campaigns all start with its name, `pinterest`,
 * `pinterest-steps`…). Apple leaves out a row under 5, and the pull writes 0 for a number with no
 * row, so a platform with no row, or a 0, is "<5": unknown, not 0. The periods used are those
 * that cover most of the window, the finest on a tie.
 */
export interface AcquisitionSummary {
  granularity: string
  /** The first and last day of the periods used; null when none falls in the window. */
  covered: DayRange | null
  /** Every source together, which Apple never hides. */
  total: { pageViews: number | null; firstDownloads: number | null }
  platforms: Record<string, { pageViews: AppleCount; firstDownloads: AppleCount }>
  /** First-time downloads by where they came from: App Store search, browse, App referrer, Web referrer… */
  sources: { source: string; firstDownloads: number }[]
  /** First downloads the campaign rows leave out, of all of them. */
  hidden: { firstDownloads: number; of: number } | null
}

type Row = Record<string, unknown>

const field = (row: Row | undefined, ...names: string[]) => (row ? names.map((name) => row[name]).find((value) => value !== undefined) : undefined)
const rowsOf = (value: unknown): Row[] => (Array.isArray(value) ? value.filter((row): row is Row => Boolean(row) && typeof row === 'object') : [])

/** Rows added up: what they show, and whether any was hidden (no row, no value, or 0: a Detailed row is never under 5). */
interface Tally {
  shown: number
  hidden: boolean
}

function tally(total: Tally | undefined, value: unknown): Tally {
  const counted = number(value)
  const shown = counted !== null && counted > 0 ? counted : 0
  return { shown: (total?.shown ?? 0) + shown, hidden: (total?.hidden ?? false) || shown === 0 }
}

const PERIOD_WORDS: Record<string, 'day' | 'week' | 'month'> = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month' }

function appleCount({ shown, hidden }: Tally, periods: number, granularity: string): AppleCount {
  if (!hidden) return shown
  if (shown > 0) return `${shown}+`
  return periods > 1 ? `<5 a ${PERIOD_WORDS[granularity] ?? 'day'}` : '<5'
}

export function summariseAcquisition(data: unknown, fromDay: string, toDay: string): AcquisitionSummary {
  const periods = ((data && typeof data === 'object' ? (data as Row).periods : null) ?? {}) as Record<string, unknown>
  const dayCount = (row: Row) => (Date.parse(String(field(row, 'end') ?? field(row, 'date'))) - Date.parse(String(field(row, 'date')))) / (24 * HOUR) + 1
  const choices = ['DAILY', 'WEEKLY', 'MONTHLY'].map((granularity) => {
    const rows = rowsOf(periods[granularity]).filter((row) => {
      const start = String(field(row, 'date') ?? '')
      const end = String(field(row, 'end') ?? start)
      return start >= fromDay && end <= toDay
    })
    return { granularity, rows, days: rows.reduce((sum, row) => sum + dayCount(row), 0) }
  })
  const { granularity, rows } = choices.reduce((best, choice) => (choice.days > best.days ? choice : best))

  const add = (a: number | null, value: unknown) => (number(value) === null ? a : (a ?? 0) + number(value)!)
  const total = { pageViews: null as number | null, firstDownloads: null as number | null }
  const platforms = new Map<string, { pageViews?: Tally; firstDownloads?: Tally }>()
  const sources = new Map<string, number>()
  const hidden = { firstDownloads: 0, of: 0, reported: false }
  for (const period of rows) {
    const sum = field(period, 'total') as Row | undefined
    total.pageViews = add(total.pageViews, field(sum, 'pageViews', 'page_views'))
    total.firstDownloads = add(total.firstDownloads, field(sum, 'firstDownloads', 'first_downloads'))
    for (const row of rowsOf(field(period, 'sourceTypes', 'source_types'))) {
      const source = String(field(row, 'sourceType', 'source_type') ?? 'unknown')
      sources.set(source, (sources.get(source) ?? 0) + (number(field(row, 'firstDownloads', 'first_downloads')) ?? 0))
    }
    const share = field(field(period, 'hidden') as Row | undefined, 'firstDownloads', 'first_downloads') as Row | undefined
    if (number(field(share, 'standard')) !== null) {
      hidden.firstDownloads += number(field(share, 'hidden')) ?? 0
      hidden.of += number(field(share, 'standard'))!
      hidden.reported = true
    }
    // A platform's campaigns in the period, added up; the pull's own `platforms` rows where there are no
    // campaign rows. Only the campaigns say which of them Apple hid. None at all is a hidden count.
    const byPlatform = new Map<string, Row[]>()
    const campaigns = rowsOf(field(period, 'campaigns'))
    for (const row of campaigns.length ? campaigns : rowsOf(field(period, 'platforms'))) {
      const name = String(field(row, 'campaign') ?? field(row, 'platform') ?? '').toLowerCase()
      const platform = SCORECARD_ORDER.find((candidate) => name === candidate || name.startsWith(`${candidate}-`))
      if (platform) byPlatform.set(platform, [...(byPlatform.get(platform) ?? []), row])
    }
    for (const platform of SCORECARD_ORDER) {
      const found = byPlatform.get(platform) ?? [{}]
      const sofar = platforms.get(platform) ?? {}
      platforms.set(platform, {
        pageViews: found.reduce<Tally | undefined>((sum, row) => tally(sum, field(row, 'pageViews', 'page_views')), sofar.pageViews),
        firstDownloads: found.reduce<Tally | undefined>((sum, row) => tally(sum, field(row, 'firstDownloads', 'first_downloads')), sofar.firstDownloads),
      })
    }
  }
  const days = rows.flatMap((row) => [String(field(row, 'date')), String(field(row, 'end') ?? field(row, 'date'))]).sort()
  return {
    granularity,
    covered: days.length ? { start: days[0], end: lastOf(days)! } : null,
    total,
    platforms: Object.fromEntries(
      [...platforms].map(([platform, sum]) => [
        platform,
        { pageViews: appleCount(sum.pageViews!, rows.length, granularity), firstDownloads: appleCount(sum.firstDownloads!, rows.length, granularity) },
      ]),
    ),
    sources: [...sources].map(([source, firstDownloads]) => ({ source, firstDownloads })).sort((a, b) => b.firstDownloads - a.firstDownloads),
    hidden: hidden.reported ? { firstDownloads: hidden.firstDownloads, of: hidden.of } : null,
  }
}
