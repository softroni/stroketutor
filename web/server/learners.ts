import { promises as fs } from 'node:fs'

import { readAppVersions, type AppVersionsOptions } from './appVersions'

import {
  DAY,
  leaveOutTestVersions,
  LEARNER_EVENTS,
  LEARNERS_TIME_ZONE,
  dayOf,
  type LearnerEvent,
  type LearnersResponse,
} from '../src/studio/learners'

/**
 * The Learners page's events, from PostHog (project "Paper Coach", 629055, US
 * cloud) through its query API. Read-only: it asks, and keeps each answer for a
 * few minutes, so flipping between a day and a week does not ask again.
 *
 * The key is a PostHog personal API key with read access to queries
 * (POSTHOG_PERSONAL_API_KEY in web/.env.local). It stays in this process: the
 * browser only ever sees the events. With STUDIO_LEARNERS_SAMPLE pointing at a
 * file of events (server/fixtures/learners-sample.json), the page shows those
 * instead and PostHog is never asked: for trying the page without a key.
 *
 * Test devices are left out, as the daily check leaves them out: every event of a
 * debug build (`build` = `debug`, the simulator and Xcode runs), and every id that
 * carried Apple Ads' test payload (`asa_test_payload`, TestFlight and development
 * installs), whatever build it came from.
 */
export interface LearnersOptions {
  apiKey?: string
  /** PostHog's project; 629055 unless POSTHOG_PROJECT_ID says otherwise. */
  projectId?: string
  /** PostHog's private API, not the capture host the app sends to. */
  host?: string
  sampleFile?: string
  /**
   * App Store Connect's versions, to leave out what TestFlight and App Review devices sent
   * (`leaveOutTestVersions`); without it, every version counts.
   */
  versions?: AppVersionsOptions
  /** For the tests. */
  fetch?: typeof fetch
}

export const DEFAULT_POSTHOG_PROJECT = '629055'
export const DEFAULT_POSTHOG_HOST = 'https://us.posthog.com'

/** A period and the one before it: two months at most, with room. */
const MAX_DAYS = 70
/** PostHog's own ceiling on the rows one query returns. */
const MAX_ROWS = 50_000
/**
 * How long an answer is kept. A day (with the day before it, for the comparison) that
 * reaches today: a minute, which is about as fresh as PostHog gets, since the app sends
 * its events every 15 seconds and PostHog makes them queryable within a few minutes
 * (https://posthog.com/docs/product-analytics/capture-events#event-ingestion, read
 * 2026-10-02). A week or a month that reaches today pulls many more rows, and PostHog's
 * query endpoint is not meant for pulling raw events over and over
 * (https://posthog.com/docs/api/queries), so five minutes. Days that are over don't
 * change: an hour. Even a minute stays far under the project's 240 queries a minute
 * and 2,400 an hour (https://posthog.com/docs/api/queries#rate-limits).
 */
export const TODAY_MS = 60_000
export const LONG_TODAY_MS = 5 * 60_000
export const SETTLED_MS = 60 * 60_000
/** "Refresh" asks PostHog again at once, but not more than once every 15 seconds per range. */
export const FORCE_FLOOR_MS = 15_000
/** A range this many days long or shorter is a day and the day before it. */
const DAY_SPAN = 2

/** How far back a learner's history goes. */
const HISTORY_DAYS = 365
/** The ids one learner can have: their profile's, and the launch's before the age answer. */
const MAX_IDS = 4
const ID = /^[A-Za-z0-9-]{2,64}$/

const cache = new Map<string, { at: number; response: LearnersResponse }>()

/** Forgets every kept answer (tests, and a key that changed). */
export function forgetLearners() {
  cache.clear()
}

export async function readLearners(
  options: LearnersOptions,
  from: string | null,
  to: string | null,
  now = Date.now(),
  force = false,
): Promise<LearnersResponse> {
  return withoutTestVersions(await readAllLearners(options, from, to, now, force), options, now)
}

/** One learner's events, as `readLearners` leaves them. */
export async function readLearnerHistory(options: LearnersOptions, idsParam: string | null, now = Date.now()): Promise<LearnersResponse> {
  return withoutTestVersions(await readWholeHistory(options, idsParam, now), options, now)
}

/** The answer without what test builds sent, and a word on what was left out. Kept answers stay whole. */
async function withoutTestVersions(response: LearnersResponse, options: LearnersOptions, now: number): Promise<LearnersResponse> {
  if (!options.versions || !response.configured || !response.events.length) return response
  const known = await readAppVersions(options.versions, now)
  const { events, leftOut } = leaveOutTestVersions(response.events, known.versions)
  return { ...response, events, leftOut, versionsProblem: known.problem }
}

async function readAllLearners(
  options: LearnersOptions,
  from: string | null,
  to: string | null,
  now = Date.now(),
  /** The page's Refresh: past the server's copy, at most every 15 seconds. */
  force = false,
): Promise<LearnersResponse> {
  const empty = (problem: string, configured = true): LearnersResponse => ({
    configured,
    source: null,
    problem,
    events: [],
    fetchedAt: null,
  })
  if (!from || !to || !DAY.test(from) || !DAY.test(to) || from >= to) {
    return empty('Ask for a range of days: ?from=YYYY-MM-DD&to=YYYY-MM-DD.')
  }
  if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > MAX_DAYS) {
    return empty(`Ask for ${MAX_DAYS} days at most.`)
  }

  if (options.sampleFile) {
    const text = await fs.readFile(options.sampleFile, 'utf8').catch(() => null)
    if (text === null) return empty(`STUDIO_LEARNERS_SAMPLE names ${options.sampleFile}, which cannot be read.`)
    const parsed = JSON.parse(text) as { events?: LearnerEvent[] }
    const events = (parsed.events ?? []).filter((event) => {
      const day = dayOf(event.at)
      return day >= from && day < to
    })
    return { configured: true, source: 'sample', problem: null, events, fetchedAt: new Date(now).toISOString() }
  }

  if (!options.apiKey) {
    return empty(
      'The Learners page reads PostHog with a personal API key. Create one in PostHog (Settings › Personal API keys, with read access to Query), add it to web/.env.local as POSTHOG_PERSONAL_API_KEY, and restart the Studio.',
      false,
    )
  }

  const reachesToday = to > dayOf(now)
  const span = (Date.parse(to) - Date.parse(from)) / 86_400_000
  const keep = !reachesToday ? SETTLED_MS : span <= DAY_SPAN ? TODAY_MS : LONG_TODAY_MS
  return ask(options, `${from}|${to}`, learnersQuery(from, to), { keep, fresh: reachesToday, force, now })
}

/**
 * Everything a learner 13 or over did, up to a year back, from their ids (comma
 * separated: the profile's, and the launch's before the age answer). Read-only,
 * kept five minutes like the rest.
 */
async function readWholeHistory(
  options: LearnersOptions,
  idsParam: string | null,
  now = Date.now(),
): Promise<LearnersResponse> {
  const ids = (idsParam ?? '').split(',').filter(Boolean)
  if (!ids.length || ids.length > MAX_IDS || !ids.every((id) => ID.test(id))) {
    return { configured: true, source: null, problem: `Ask for 1 to ${MAX_IDS} learner ids: ?ids=a,b.`, events: [], fetchedAt: null }
  }
  if (options.sampleFile) {
    const text = await fs.readFile(options.sampleFile, 'utf8').catch(() => null)
    if (text === null) {
      return { configured: true, source: null, problem: `STUDIO_LEARNERS_SAMPLE names ${options.sampleFile}, which cannot be read.`, events: [], fetchedAt: null }
    }
    const wanted = new Set(ids)
    const events = ((JSON.parse(text) as { events?: LearnerEvent[] }).events ?? []).filter((event) => wanted.has(event.id))
    return { configured: true, source: 'sample', problem: null, events, fetchedAt: new Date(now).toISOString() }
  }
  if (!options.apiKey) {
    return { configured: false, source: null, problem: 'The Learners page needs POSTHOG_PERSONAL_API_KEY.', events: [], fetchedAt: null }
  }
  return ask(options, `history|${[...ids].sort().join(',')}`, historyQuery(ids), {
    keep: LONG_TODAY_MS,
    fresh: true,
    force: false,
    now,
  })
}

/**
 * Asks PostHog, or answers from what it said less than `keep` ago (`force`: from what it
 * said less than 15 seconds ago). `fresh` tells PostHog to run the query rather than hand
 * back its own cached result, which it otherwise does by default
 * (https://posthog.com/docs/api/queries#caching-and-execution-modes).
 */
async function ask(
  options: LearnersOptions,
  key: string,
  query: string,
  { keep, fresh, force, now }: { keep: number; fresh: boolean; force: boolean; now: number },
): Promise<LearnersResponse> {
  const kept = cache.get(key)
  if (kept && now - kept.at < (force ? FORCE_FLOOR_MS : keep)) return kept.response

  try {
    const events = await queryEvents(options, query, fresh ? 'force_blocking' : 'blocking')
    const response: LearnersResponse = {
      configured: true,
      source: 'posthog',
      problem: events.length >= MAX_ROWS ? `PostHog sent its first ${MAX_ROWS.toLocaleString('en-US')} events only.` : null,
      events,
      fetchedAt: new Date(now).toISOString(),
    }
    cache.set(key, { at: now, response })
    return response
  } catch (error) {
    return {
      configured: true,
      source: 'posthog',
      problem: `PostHog did not answer: ${error instanceof Error ? error.message : String(error)}`,
      events: [],
      fetchedAt: null,
    }
  }
}

const COLUMNS = [
  'SELECT toUnixTimestamp64Milli(timestamp), event, distinct_id, properties.age_group, properties.lesson_id,',
  '  properties.first_open, properties.screen, properties.entry, properties.outcome, properties.asa_attribution,',
  '  properties.added, properties.plan, properties.asa_campaign_id, properties.asa_ad_group_id,',
  '  properties.asa_keyword_id, properties.device_region, properties.asa_country_or_region, properties.$app_version,',
  '  properties.placement, properties.paywall_id, properties.variant_id, properties.drawing_seconds',
  'FROM events',
]

/** The events the page reads, from release builds only. */
function eventFilter(): string[] {
  const names = LEARNER_EVENTS.map((name) => `'${name}'`).join(', ')
  return [
    `  AND event IN (${names})`,
    "  AND (event != 'ob_beat_viewed' OR properties.beat = 'ob-age')",
    "  AND coalesce(properties.build, '') != 'debug'",
  ]
}

/** The HogQL the page asks for. `from` and `to` are checked days, so they cannot break out of the string. */
export function learnersQuery(from: string, to: string): string {
  const start = `toDateTime('${from} 00:00:00', '${LEARNERS_TIME_ZONE}')`
  const end = `toDateTime('${to} 00:00:00', '${LEARNERS_TIME_ZONE}')`
  return [
    ...COLUMNS,
    `WHERE timestamp >= ${start}`,
    `  AND timestamp < ${end}`,
    ...eventFilter(),
    '  AND distinct_id NOT IN (',
    '    SELECT distinct_id FROM events',
    `    WHERE timestamp >= ${start} AND timestamp < ${end} AND properties.asa_test_payload = true`,
    '  )',
    'ORDER BY timestamp',
    `LIMIT ${MAX_ROWS}`,
  ].join('\n')
}

/** One learner's events, a year back. The ids are checked (letters, digits and dashes), so they cannot break out. */
export function historyQuery(ids: string[]): string {
  const list = ids.map((id) => `'${id}'`).join(', ')
  return [
    ...COLUMNS,
    `WHERE distinct_id IN (${list})`,
    `  AND timestamp >= now() - INTERVAL ${HISTORY_DAYS} DAY`,
    ...eventFilter(),
    'ORDER BY timestamp',
    `LIMIT ${MAX_ROWS}`,
  ].join('\n')
}

async function queryEvents(
  options: LearnersOptions,
  query: string,
  refresh: 'blocking' | 'force_blocking',
): Promise<LearnerEvent[]> {
  const host = options.host ?? DEFAULT_POSTHOG_HOST
  const project = options.projectId ?? DEFAULT_POSTHOG_PROJECT
  const response = await (options.fetch ?? fetch)(`${host}/api/projects/${project}/query/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query }, refresh, name: 'studio-learners' }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`${response.status} ${response.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`)
  }
  const body = (await response.json()) as { results?: unknown[][] }
  return (body.results ?? []).flatMap((row) => {
    const event = toEvent(row)
    return event ? [event] : []
  })
}

/** One row of the query, in the column order above, as an event; null when it has no time, name or id. */
export function toEvent(row: unknown[]): LearnerEvent | null {
  const [at, event, id, age, lesson, firstOpen, screen, entry, outcome, ads, added, plan, ...more] = row
  const [campaign, adGroup, keyword, region, adsRegion, version, placement, paywall, variant, drawingSeconds] = more
  if (typeof event !== 'string' || typeof id !== 'string') return null
  const time = typeof at === 'number' ? at : typeof at === 'string' && at !== '' ? Number(at) : Number.NaN
  if (!Number.isFinite(time)) return null
  const result: LearnerEvent = { at: time, event, id }
  const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : undefined)
  const flag = (value: unknown) =>
    value === true || value === false ? value : typeof value === 'string' ? value.toLowerCase() === 'true' : undefined
  if (text(age)) result.age = text(age)
  if (text(lesson)) result.lesson = text(lesson)
  if (flag(firstOpen) !== undefined) result.firstOpen = flag(firstOpen)
  if (text(screen)) result.screen = text(screen)
  if (text(entry)) result.entry = text(entry)
  if (text(outcome)) result.outcome = text(outcome)
  if (text(plan)) result.plan = text(plan)
  // Apple Ads' ids come as numbers or as words; they are kept as words.
  const idOf = (value: unknown) => (typeof value === 'number' ? String(value) : text(value))
  if (idOf(campaign)) result.campaign = idOf(campaign)
  if (idOf(adGroup)) result.adGroup = idOf(adGroup)
  if (idOf(keyword)) result.keyword = idOf(keyword)
  if (text(region)) result.region = text(region)
  if (text(adsRegion)) result.adsRegion = text(adsRegion)
  if (text(version)) result.version = text(version)
  if (text(placement)) result.placement = text(placement)
  if (text(paywall)) result.paywall = text(paywall)
  if (idOf(variant)) result.variant = idOf(variant)
  const seconds = typeof drawingSeconds === 'number' ? drawingSeconds : typeof drawingSeconds === 'string' ? Number(drawingSeconds) : Number.NaN
  if (drawingSeconds !== null && drawingSeconds !== undefined && drawingSeconds !== '' && Number.isFinite(seconds)) result.drawingSeconds = seconds
  if (flag(ads) !== undefined) result.ads = flag(ads)
  if (flag(added) !== undefined) result.added = flag(added)
  return result
}
