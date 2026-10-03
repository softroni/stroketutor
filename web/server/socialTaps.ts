import { promises as fs } from 'node:fs'

import { DAY, dayOf, LEARNERS_TIME_ZONE, type SocialTapRow, type SocialTapsResponse } from '../src/studio/learners'
import { DEFAULT_POSTHOG_HOST, DEFAULT_POSTHOG_PROJECT, type LearnersOptions } from './learners'

/**
 * Taps on Softroni's social profile links (softroni.com/t/papercoach, /i/, /th/…) for the
 * Learners page's days. Each link's page sends PostHog one `social_link_opened` event, then
 * opens the App Store (~/dev/softroni.com; docs/ops/social-plan.md, *Growth*). A tap keeps no
 * id, so it is never a learner: the page shows the taps beside where learners came from.
 * Links inside posts go straight to the App Store and are not counted here.
 *
 * Asked as counts by platform, campaign, kind of traffic and the app the link opened in, from
 * the same PostHog project and key as the events. Read-only. A range that reaches today is
 * kept a minute, as the events are; days that are over, an hour. With STUDIO_LEARNERS_SAMPLE,
 * from a file of days beside the sample (server/fixtures/social-taps.json).
 */
export type SocialTapsOptions = Pick<LearnersOptions, 'apiKey' | 'projectId' | 'host' | 'fetch'> & {
  /** A file of `{ days: { "YYYY-MM-DD": SocialTapRow[] } }` to read instead. */
  sampleFile?: string
}

const TODAY_KEEP_MS = 60_000
const SETTLED_KEEP_MS = 60 * 60_000
const MAX_DAYS = 70
const DAY_MS = 86_400_000
/** Far more groups than the seven links, their traffic and their apps can make. */
const MAX_ROWS = 500

const kept = new Map<string, { at: number; keep: number; response: SocialTapsResponse }>()

/** Forgets what was kept; for the tests. */
export function forgetSocialTaps() {
  kept.clear()
}

export async function readSocialTaps(
  options: SocialTapsOptions,
  from: string | null,
  to: string | null,
  now: number = Date.now(),
): Promise<SocialTapsResponse> {
  if (!from || !to || !DAY.test(from) || !DAY.test(to) || from >= to) {
    return { rows: [], source: null, problem: 'Ask for a range of days: from=YYYY-MM-DD&to=YYYY-MM-DD.' }
  }
  if ((Date.parse(to) - Date.parse(from)) / DAY_MS > MAX_DAYS) {
    return { rows: [], source: null, problem: `Ask for ${MAX_DAYS} days at most.` }
  }
  if (options.sampleFile) return readSample(options.sampleFile, from, to)
  if (!options.apiKey) return { rows: [], source: null, problem: 'The profile-link taps need POSTHOG_PERSONAL_API_KEY.' }

  const key = `${from}|${to}`
  const known = kept.get(key)
  if (known && now - known.at < known.keep) return known.response
  const reachesToday = to > dayOf(now)
  try {
    const rows = await askPostHog(options, socialTapsQuery(from, to), reachesToday)
    const response: SocialTapsResponse = { rows, source: 'posthog', problem: null }
    kept.set(key, { at: now, keep: reachesToday ? TODAY_KEEP_MS : SETTLED_KEEP_MS, response })
    return response
  } catch (error) {
    return {
      rows: known?.response.rows ?? [],
      source: 'posthog',
      problem: `PostHog did not answer: ${(error instanceof Error ? error.message : String(error)).slice(0, 300)}`,
    }
  }
}

/** The HogQL: the period's taps, counted. `from` and `to` are checked days, so they cannot break out of the string. */
export function socialTapsQuery(from: string, to: string): string {
  return [
    'SELECT properties.platform AS platform, properties.campaign AS campaign, properties.traffic AS traffic,',
    '  properties.in_app AS in_app, count() AS taps',
    'FROM events',
    "WHERE event = 'social_link_opened'",
    `  AND timestamp >= toDateTime('${from} 00:00:00', '${LEARNERS_TIME_ZONE}')`,
    `  AND timestamp < toDateTime('${to} 00:00:00', '${LEARNERS_TIME_ZONE}')`,
    'GROUP BY platform, campaign, traffic, in_app',
    'ORDER BY taps DESC',
    `LIMIT ${MAX_ROWS}`,
  ].join('\n')
}

async function askPostHog(options: SocialTapsOptions, query: string, fresh: boolean): Promise<SocialTapRow[]> {
  const host = options.host ?? DEFAULT_POSTHOG_HOST
  const project = options.projectId ?? DEFAULT_POSTHOG_PROJECT
  const response = await (options.fetch ?? fetch)(`${host}/api/projects/${project}/query/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
    // `force_blocking` while the day runs: PostHog would otherwise hand back its own older answer.
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query }, refresh: fresh ? 'force_blocking' : 'blocking', name: 'studio-social-taps' }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`${response.status} ${response.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`)
  }
  const body = (await response.json()) as { results?: unknown[][] }
  return (body.results ?? []).flatMap((row) => {
    const tap = toTapRow(row)
    return tap ? [tap] : []
  })
}

/** One row of the query, in its column order; null without a count. */
export function toTapRow(row: unknown[]): SocialTapRow | null {
  const [platform, campaign, traffic, inApp, taps] = row
  const count = typeof taps === 'number' ? taps : typeof taps === 'string' ? Number(taps) : Number.NaN
  if (!Number.isFinite(count) || count <= 0) return null
  const text = (value: unknown, otherwise: string) => (typeof value === 'string' && value !== '' ? value : otherwise)
  return {
    platform: text(platform, 'unknown'),
    campaign: text(campaign, 'none'),
    traffic: text(traffic, 'unknown'),
    inApp: text(inApp, 'unknown'),
    taps: count,
  }
}

async function readSample(file: string, from: string, to: string): Promise<SocialTapsResponse> {
  try {
    const sample = JSON.parse(await fs.readFile(file, 'utf8')) as { days: Record<string, SocialTapRow[]> }
    const rows = new Map<string, SocialTapRow>()
    for (const [day, dayRows] of Object.entries(sample.days)) {
      if (day < from || day >= to) continue
      for (const row of dayRows) {
        const key = `${row.platform}|${row.campaign}|${row.traffic}|${row.inApp}`
        const into = rows.get(key)
        if (into) into.taps += row.taps
        else rows.set(key, { ...row })
      }
    }
    return { rows: [...rows.values()].sort((a, b) => b.taps - a.taps), source: 'sample', problem: null }
  } catch (error) {
    return { rows: [], source: 'sample', problem: `The sample's profile-link taps did not read: ${error instanceof Error ? error.message : String(error)}` }
  }
}
