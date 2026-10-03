import { promises as fs } from 'node:fs'

import { DAY, dayOf, type AdSpendResponse, type AdSpendRow } from '../src/studio/learners'
import { readAdNames, superwall } from './appleAds'

/**
 * What Paper Coach's Apple Ads spent, keyword by keyword, for the Learners page's days:
 * Apple's keyword reports, and its campaign report for what a campaign spent outside its
 * keywords (Search Match), through `superwall asa reports … --time-zone ORTZ` (the ads
 * account counts days in US Central, as the page does). Apple's numbers come in during
 * the day, so a range that reaches today is kept a quarter of an hour; days that are over,
 * six hours. With STUDIO_LEARNERS_SAMPLE, from a file of days beside the sample.
 */
export interface AdSpendOptions {
  /** A file of `{ days: { "YYYY-MM-DD": AdSpendRow[] } }` to read instead. */
  sampleFile?: string
  /** For the names' file in sample mode, and for the tests. */
  namesFile?: string
  run?: (args: string[]) => Promise<unknown>
}

const ASA_VIA_APP = '54792'
const TODAY_KEEP_MS = 15 * 60_000
const SETTLED_KEEP_MS = 6 * 60 * 60_000
const FAILURE_KEEP_MS = 5 * 60_000
const MAX_DAYS = 70
const DAY_MS = 86_400_000

const kept = new Map<string, { at: number; keep: number; response: AdSpendResponse }>()

/** Forgets what was kept; for the tests. */
export function forgetAdSpend() {
  kept.clear()
}

export async function readAdSpend(
  options: AdSpendOptions,
  from: string | null,
  to: string | null,
  now: number = Date.now(),
): Promise<AdSpendResponse> {
  if (!from || !to || !DAY.test(from) || !DAY.test(to) || from >= to) {
    return { rows: [], source: null, problem: 'Ask for a range of days: from=YYYY-MM-DD&to=YYYY-MM-DD.' }
  }
  if ((Date.parse(to) - Date.parse(from)) / DAY_MS > MAX_DAYS) {
    return { rows: [], source: null, problem: `Ask for ${MAX_DAYS} days at most.` }
  }
  // Apple's end day counts; the page's `to` does not. Nothing after today.
  const today = dayOf(now)
  const dayBefore = dayOf(Date.parse(`${to}T12:00:00Z`) - DAY_MS)
  const last = dayBefore < today ? dayBefore : today
  if (options.sampleFile) return readSample(options.sampleFile, from, last)
  if (last < from) return { rows: [], source: 'apple-ads', problem: null }

  const key = `${from}|${last}`
  const known = kept.get(key)
  if (known && now - known.at < known.keep) return known.response
  let response: AdSpendResponse
  try {
    response = { rows: await askApple(options.run ?? superwall, from, last), source: 'apple-ads', problem: null }
  } catch (error) {
    response = {
      rows: known?.response.rows ?? [],
      source: 'apple-ads',
      problem: `Apple Ads' report did not come (superwall asa reports): ${(error instanceof Error ? error.message : String(error)).slice(0, 300)}`,
    }
  }
  kept.set(key, { at: now, keep: response.problem ? FAILURE_KEEP_MS : last >= today ? TODAY_KEEP_MS : SETTLED_KEEP_MS, response })
  return response
}

type Report = { data?: { reportingDataResponse?: { row?: ReportRow[] } } }
type Money = { amount?: string }
type Metrics = { localSpend?: Money; impressions?: number; taps?: number; totalInstalls?: number }
type ReportRow = { metadata?: Record<string, unknown>; total?: Metrics; granularity?: Metrics[] }

/** Paper Coach's keywords, and each campaign's spend outside them, from Apple's reports. */
export async function askApple(run: (args: string[]) => Promise<unknown>, from: string, last: string): Promise<AdSpendRow[]> {
  const names = await readAdNames({ run })
  if (names.problem) throw new Error(names.problem)
  const campaigns = Object.keys(names.names.campaigns)
  const report = async (...args: string[]) => {
    const answer = (await run([
      'asa',
      'reports',
      ...args,
      '--app',
      ASA_VIA_APP,
      '--start',
      from,
      '--end',
      last,
      '--granularity',
      'DAILY',
      '--time-zone',
      'ORTZ',
    ])) as Report
    return answer?.data?.reportingDataResponse?.row ?? []
  }
  const [campaignRows, ...keywordReports] = await Promise.all([
    report('campaigns'),
    ...campaigns.map((campaign) => report('keywords', '--campaign', campaign)),
  ])
  const rows: AdSpendRow[] = []
  keywordReports.forEach((keywordRows, index) => {
    const campaign = campaigns[index]
    let keywordSpend = 0
    for (const row of keywordRows) {
      const keyword = String(row.metadata?.keywordId ?? '')
      if (!keyword) continue
      const metrics = totalOf(row)
      keywordSpend += metrics.spend
      if (!metrics.spend && !metrics.impressions && !metrics.taps && !metrics.installs) continue
      rows.push({ key: `keyword-${keyword}`, campaign, adGroup: String(row.metadata?.adGroupId ?? '') || null, keyword, ...metrics })
    }
    const total = campaignRows.find((row) => String(row.metadata?.campaignId) === campaign)
    if (total) {
      const metrics = totalOf(total)
      // What the campaign spent outside its keywords: Search Match.
      const outside = round(metrics.spend - keywordSpend)
      if (outside > 0.004) {
        rows.push({ key: `campaign-${campaign}`, campaign, adGroup: null, keyword: null, spend: outside, impressions: 0, taps: 0, installs: 0 })
      }
    }
  })
  return rows.sort((a, b) => b.spend - a.spend)
}

function totalOf(row: ReportRow): Omit<AdSpendRow, 'key' | 'campaign' | 'adGroup' | 'keyword'> {
  const days = row.total ? [row.total] : row.granularity ?? []
  const sum = (pick: (metrics: Metrics) => number) => days.reduce((total, metrics) => total + pick(metrics), 0)
  return {
    spend: round(sum((metrics) => Number(metrics.localSpend?.amount ?? 0))),
    impressions: sum((metrics) => metrics.impressions ?? 0),
    taps: sum((metrics) => metrics.taps ?? 0),
    installs: sum((metrics) => metrics.totalInstalls ?? 0),
  }
}

async function readSample(file: string, from: string, last: string): Promise<AdSpendResponse> {
  try {
    const sample = JSON.parse(await fs.readFile(file, 'utf8')) as { days: Record<string, AdSpendRow[]> }
    const rows = new Map<string, AdSpendRow>()
    for (const [day, dayRows] of Object.entries(sample.days)) {
      if (day < from || day > last) continue
      for (const row of dayRows) {
        const into = rows.get(row.key)
        if (!into) rows.set(row.key, { ...row })
        else {
          into.spend = round(into.spend + row.spend)
          into.impressions += row.impressions
          into.taps += row.taps
          into.installs += row.installs
        }
      }
    }
    return { rows: [...rows.values()].sort((a, b) => b.spend - a.spend), source: 'sample', problem: null }
  } catch (error) {
    return { rows: [], source: 'sample', problem: `The sample's Apple Ads spend did not read: ${error instanceof Error ? error.message : String(error)}` }
  }
}

function round(dollars: number): number {
  return Math.round(dollars * 100) / 100
}

