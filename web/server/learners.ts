import { promises as fs } from 'node:fs'

import {
  DAY,
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
 */
export interface LearnersOptions {
  apiKey?: string
  /** PostHog's project; 629055 unless POSTHOG_PROJECT_ID says otherwise. */
  projectId?: string
  /** PostHog's private API, not the capture host the app sends to. */
  host?: string
  sampleFile?: string
  /** For the tests. */
  fetch?: typeof fetch
}

export const DEFAULT_POSTHOG_PROJECT = '629055'
export const DEFAULT_POSTHOG_HOST = 'https://us.posthog.com'

/** A period and the one before it: two months at most, with room. */
const MAX_DAYS = 70
/** PostHog's own ceiling on the rows one query returns. */
const MAX_ROWS = 50_000
/** How long an answer is kept: a range that reaches today changes, an older one does not. */
const FRESH_MS = 5 * 60_000
const SETTLED_MS = 60 * 60_000

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

  const key = `${from}|${to}`
  const kept = cache.get(key)
  const reachesToday = to > dayOf(now)
  if (kept && now - kept.at < (reachesToday ? FRESH_MS : SETTLED_MS)) return kept.response

  try {
    const events = await queryEvents(options, from, to)
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
    return { ...empty(`PostHog did not answer: ${error instanceof Error ? error.message : String(error)}`), source: 'posthog' }
  }
}

/** The HogQL the page asks for. `from` and `to` are checked days, so they cannot break out of the string. */
export function learnersQuery(from: string, to: string): string {
  const names = LEARNER_EVENTS.map((name) => `'${name}'`).join(', ')
  return [
    'SELECT toUnixTimestamp64Milli(timestamp), event, distinct_id, properties.age_group, properties.lesson_id,',
    '  properties.first_open, properties.screen, properties.entry, properties.outcome, properties.asa_attribution,',
    '  properties.added',
    'FROM events',
    `WHERE timestamp >= toDateTime('${from} 00:00:00', '${LEARNERS_TIME_ZONE}')`,
    `  AND timestamp < toDateTime('${to} 00:00:00', '${LEARNERS_TIME_ZONE}')`,
    `  AND event IN (${names})`,
    "  AND (event != 'ob_beat_viewed' OR properties.beat = 'ob-age')",
    'ORDER BY timestamp',
    `LIMIT ${MAX_ROWS}`,
  ].join('\n')
}

async function queryEvents(options: LearnersOptions, from: string, to: string): Promise<LearnerEvent[]> {
  const host = options.host ?? DEFAULT_POSTHOG_HOST
  const project = options.projectId ?? DEFAULT_POSTHOG_PROJECT
  const response = await (options.fetch ?? fetch)(`${host}/api/projects/${project}/query/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query: learnersQuery(from, to) } }),
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
  const [at, event, id, age, lesson, firstOpen, screen, entry, outcome, ads, added] = row
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
  if (flag(ads) !== undefined) result.ads = flag(ads)
  if (flag(added) !== undefined) result.added = flag(added)
  return result
}
