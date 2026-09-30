/**
 * The Today page: how Paper Coach stands and what Claude is doing about it, at a
 * glance. Claude writes it (`docs/ops/today.py publish`) every morning and after
 * anything worth telling, to `.studio/ops/status.json`; the Studio only reads it.
 * docs/ops/README.md says what goes in each part.
 */

/** Good, in progress, needs attention, bad: always shown with a word, never color alone. */
export type Tone = 'good' | 'waiting' | 'attention' | 'bad' | 'neutral'

export interface TodayStatus {
  /** When Claude wrote it, ISO 8601 with an offset. */
  updated: string
  /** One or two sentences: the state of things, as Claude would say it. */
  headline: string
  app: {
    /** The version on the App Store, if any. */
    live: AppBuild | null
    /** The version Apple has, or is about to have, if any. */
    inReview: AppBuild | null
  }
  /** The headline numbers, each with up to 14 days of history (oldest first). */
  numbers: TodayNumber[]
  /** Learners from a first open to a purchase, step by step (PostHog), when Claude wrote it. */
  funnel: TodayFunnel | null
  /** What only the creator can do. Empty is the goal. */
  needsYou: TodayItem[]
  /** What Claude is on, waiting for, or will do next. */
  working: TodayItem[]
  /** What happened, newest first. */
  log: TodayLogEntry[]
  experiments: TodayExperiment[]
  ads: TodayAds | null
  reviews: TodayReviews | null
  links: { label: string; url: string }[]
  /** Claude's next scheduled look, if one is set. */
  next: { at: string; what: string } | null
  /** Dates worth seeing coming: a price change, a reminder, a phased release reaching everyone. */
  upcoming: TodayEvent[]
}

export interface AppBuild {
  version: string
  build: string
  /** App Store Connect's state, as a person would say it: "Waiting for review". */
  state: string
  tone: Tone
  /** Since when it has been in that state (ISO), if known. */
  since: string | null
  /** App Store Connect's own code for the state (WAITING_FOR_REVIEW), in statuses written since 2026-10-01. */
  code?: string
  /** Apple's seven-day phased release of automatic updates, when this version has one. */
  phased?: PhasedRelease | null
}

export interface PhasedRelease {
  /** INACTIVE (not started yet), ACTIVE, PAUSED or COMPLETE. */
  state: string
  /** The day of the seven it is on; 0 before it starts. */
  day: number
}

export interface TodayNumber {
  label: string
  /** Already formatted: "12", "$34.50", "4.8★". */
  value: string
  /** What the value covers: "Sep 29", "last 7 days". */
  period: string
  /** A short second line: "7 days: 40", "vs 3 the day before". */
  detail?: string
  /** Up to 14 daily values, oldest first; the last is the day `value` reports. */
  series?: DayValue[]
  tone?: Tone
  /** Where it comes from: "App Store", "PostHog", "Apple Ads". */
  source?: string
}

export interface DayValue {
  /** YYYY-MM-DD */
  day: string
  value: number
}

export interface TodayFunnel {
  /** What the steps lead to, if not a purchase: "From first open to purchase". */
  title?: string
  /** What it covers: "last 7 days". */
  period: string
  /** In order, each a count of learners who got that far. */
  steps: { label: string; value: number }[]
}

export interface TodayEvent {
  /** YYYY-MM-DD for a day, or an ISO date and time. */
  at: string
  what: string
}

export interface TodayItem {
  title: string
  detail?: string
  state?: 'doing' | 'running' | 'waiting' | 'next' | 'done'
  /** YYYY-MM-DD, when it started or was asked for. */
  since?: string
  url?: string
}

export interface TodayLogEntry {
  /** ISO 8601 */
  at: string
  text: string
  /** What it was about, when the writer said (`today.py log --kind`); otherwise the page reads it from the words. */
  kind?: string
}

export interface TodayExperiment {
  name: string
  placement: string
  /** "running", "paused", "decided". */
  status: string
  note?: string
  variants: {
    name: string
    /** Share of traffic, in percent. */
    share: number
    opens?: number
    trials?: number
    purchases?: number
  }[]
}

export interface TodayAds {
  /** "ready", "running", "paused", "off". */
  state: string
  note?: string
  /** Dollars a day across Paper Coach's campaigns. */
  dailyCap: number | null
  /** Dollars spent since the first campaign started. */
  spentToDate: number
  /** Proceeds from learners the ads brought, after Apple's cut. */
  earnedToDate: number | null
  /** Spend stays under this: the $150 seed plus what the ads earned. */
  spendCeiling: number | null
  campaigns: {
    name: string
    status: string
    spend: number
    installs: number
    trials?: number
    costPerInstall?: number | null
  }[]
}

export interface TodayReviews {
  average: number | null
  count: number
  latest: {
    date: string
    rating: number
    title: string
    body?: string
    territory?: string
    replied: boolean
  }[]
}

/** What the server answers for GET /api/today[?day=YYYY-MM-DD]. */
export interface TodayResponse {
  status: TodayStatus | null
  /** Why there is no status, when there is none. */
  problem: string | null
  /** The past day shown (YYYY-MM-DD), or null for the latest status. */
  day: string | null
  /** Every day kept in the history, newest first. Nothing is ever deleted. */
  days: string[]
  /** How many things Claude logged each day (log.jsonl), oldest first; days with none are left out. */
  activity: DayValue[]
}

export const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Older than this, the page says Claude has not been by. */
export const STALE_AFTER_HOURS = 30

export function hoursSince(iso: string, now: Date = new Date()): number {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return Infinity
  return (now.getTime() - then) / 3_600_000
}

export function isStale(status: TodayStatus, now: Date = new Date()): boolean {
  return hoursSince(status.updated, now) > STALE_AFTER_HOURS
}

/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function ago(iso: string, now: Date = new Date()): string {
  const hours = hoursSince(iso, now)
  if (!Number.isFinite(hours)) return 'at an unknown time'
  if (hours < 1 / 60) return 'just now'
  if (hours < 1) return `${Math.round(hours * 60)} min ago`
  if (hours < 36) return `${Math.round(hours)} h ago`
  return `${Math.round(hours / 24)} days ago`
}

/** How long something has lasted, for "for 3 h": "a moment", "40 min", "3 h", "2 days". */
export function lasted(iso: string, now: Date = new Date()): string {
  const hours = hoursSince(iso, now)
  if (!Number.isFinite(hours)) return 'a while'
  if (hours < 1 / 60) return 'a moment'
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 36) return `${Math.round(hours)} h`
  const days = Math.round(hours / 24)
  return days === 1 ? '1 day' : `${days} days`
}

/** How long until something: "in 5 min", "in 3 h", "in 2 days"; "now" once it is due. */
export function until(iso: string, now: Date = new Date()): string {
  const hours = -hoursSince(iso, now)
  if (!Number.isFinite(hours)) return ''
  if (hours < 1 / 60) return 'now'
  if (hours < 1) return `in ${Math.round(hours * 60)} min`
  if (hours < 36) return `in ${Math.round(hours)} h`
  return `in ${Math.round(hours / 24)} days`
}

/** The word that goes with a tone, so a state never rests on color alone. */
export function toneWord(tone: Tone | undefined): string {
  switch (tone) {
    case 'good':
      return 'Good'
    case 'waiting':
      return 'Waiting'
    case 'attention':
      return 'Needs a look'
    case 'bad':
      return 'Problem'
    default:
      return ''
  }
}

/**
 * Reads a status file's JSON leniently: a missing list becomes empty and a
 * missing part null, so an older or partial file still draws. Anything that is
 * not an object with `updated` (a date that reads) and `headline` is refused.
 */
export function normalizeStatus(raw: unknown): TodayStatus | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<TodayStatus>
  if (typeof value.updated !== 'string' || Number.isNaN(Date.parse(value.updated))) return null
  if (typeof value.headline !== 'string') return null
  const list = <T,>(items: T[] | undefined): T[] => (Array.isArray(items) ? items : [])
  const funnel = value.funnel && Array.isArray(value.funnel.steps) && value.funnel.steps.length ? value.funnel : null
  return {
    updated: value.updated,
    headline: value.headline,
    app: { live: value.app?.live ?? null, inReview: value.app?.inReview ?? null },
    numbers: list(value.numbers),
    funnel,
    needsYou: list(value.needsYou),
    working: list(value.working),
    log: list(value.log),
    experiments: list(value.experiments),
    ads: value.ads ?? null,
    reviews: value.reviews ?? null,
    links: list(value.links),
    next: value.next ?? null,
    upcoming: list(value.upcoming),
  }
}

// ---------------------------------------------------------------- the release track

/** The stations every version passes on its way to learners, in order. */
export const STATIONS = ['Prepared', 'Submitted', 'In review', 'Approved', 'On sale'] as const

/** App Store Connect's state codes, by the station they sit at. */
const STATION_OF_CODE: Record<string, number> = {
  PREPARE_FOR_SUBMISSION: 0,
  READY_FOR_REVIEW: 0,
  WAITING_FOR_EXPORT_COMPLIANCE: 0,
  WAITING_FOR_REVIEW: 1,
  DEVELOPER_REJECTED: 1,
  REPLACED_WITH_NEW_BUILD: 1,
  IN_REVIEW: 2,
  REJECTED: 2,
  METADATA_REJECTED: 2,
  INVALID_BINARY: 2,
  ACCEPTED: 3,
  PENDING_DEVELOPER_RELEASE: 3,
  PENDING_APPLE_RELEASE: 3,
  PROCESSING_FOR_APP_STORE: 3,
  PROCESSING_FOR_DISTRIBUTION: 3,
  READY_FOR_SALE: 4,
  READY_FOR_DISTRIBUTION: 4,
  DEVELOPER_REMOVED_FROM_SALE: 4,
  REMOVED_FROM_SALE: 4,
  REPLACED_WITH_NEW_VERSION: 4,
}

/**
 * The station (an index into STATIONS) a version stands at: by App Store
 * Connect's code, or, in statuses written before the code was kept, by the
 * words today.py puts on the state. `fallback` answers a state neither knows.
 */
export function releaseStation(build: AppBuild, fallback: number): number {
  if (build.code && build.code in STATION_OF_CODE) return STATION_OF_CODE[build.code]!
  const state = build.state.toLowerCase()
  if (state.startsWith('being prepared') || state.startsWith('ready to submit')) return 0
  if (state.startsWith('waiting for review') || state.startsWith('withdrawn')) return 1
  if (state.startsWith('in review') || state.includes('rejected') || state.includes('invalid binary')) return 2
  if (state.startsWith('approved')) return 3
  if (state.startsWith('on sale') || state.includes('removed from sale') || state.startsWith('replaced')) return 4
  return fallback
}

/** Apple's share of automatic updates on each day of a phased release. */
export const PHASED_SHARES = [1, 2, 5, 10, 20, 50, 100] as const

// ---------------------------------------------------------------- days and dates

/** A date's YYYY-MM-DD on this clock. */
export function dayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** A YYYY-MM-DD as that day on this clock (a bare `new Date` would read it as UTC midnight, the day before here). */
export function localDay(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value)
}

/** The day `day` is from `from`, both YYYY-MM-DD: 1 for the day after, -1 for the day before. */
export function daysBetween(from: string, day: string): number {
  return Math.round((localDay(day).getTime() - localDay(from).getTime()) / 86_400_000)
}

export function addDays(day: string, count: number): string {
  const date = localDay(day)
  date.setDate(date.getDate() + count)
  return dayKey(date)
}

const weekdayMonthDay = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

/** "Today", "Yesterday", "Tomorrow", or "Mon, Sep 28"; a day that does not read is shown as written. */
export function dayLabel(day: string, now: Date = new Date()): string {
  if (Number.isNaN(localDay(day).getTime())) return day
  const offset = daysBetween(dayKey(now), day)
  if (offset === 0) return 'Today'
  if (offset === -1) return 'Yesterday'
  if (offset === 1) return 'Tomorrow'
  return weekdayMonthDay.format(localDay(day))
}

/**
 * How long a "Needs you" item has waited, from its `since` day: "new today",
 * "since yesterday", "3 days". An item that waits longer should look older.
 */
export function waited(since: string, now: Date = new Date()): string {
  if (!DAY.test(since)) return ''
  const days = daysBetween(since, dayKey(now))
  if (days <= 0) return 'new today'
  if (days === 1) return 'since yesterday'
  return `${days} days`
}

/** A period as a person says it: "on 2026-09-29" becomes "Sep 29". */
export function friendlyPeriod(period: string): string {
  return period.replace(/\b(?:on )?(\d{4}-\d{2}-\d{2})\b/g, (_, day: string) => monthDay.format(localDay(day)))
}

/**
 * The days the strip shows, oldest first: every calendar day from the first
 * one kept (at most `count` back) to today or the newest kept, whichever is
 * later, so a day with nothing written shows as a gap.
 */
export function stripDays(days: string[], today: string, count = 14): string[] {
  if (!days.length) return []
  const kept = [...days].sort()
  const last = kept[kept.length - 1]! > today ? kept[kept.length - 1]! : today
  const first = kept[0]! > addDays(last, 1 - count) ? kept[0]! : addDays(last, 1 - count)
  const out: string[] = []
  for (let day = first; day <= last; day = addDays(day, 1)) out.push(day)
  return out
}

/** Entries grouped by the day they were written (the writer's own date), keeping their order. */
export function groupByDay<T extends { at: string }>(entries: T[]): { day: string; entries: T[] }[] {
  const groups: { day: string; entries: T[] }[] = []
  for (const entry of entries) {
    const day = entry.at.slice(0, 10)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.entries.push(entry)
    else groups.push({ day, entries: [entry] })
  }
  return groups
}

// ---------------------------------------------------------------- numbers

/**
 * The last seven days against the seven before, from a daily series of at
 * least 14 values; null when there is not a fortnight to compare.
 */
export function weekOverWeek(series: DayValue[] | undefined): { last: number; before: number } | null {
  if (!series || series.length < 14) return null
  const sum = (values: DayValue[]) => values.reduce((total, day) => total + day.value, 0)
  return { last: round2(sum(series.slice(-7))), before: round2(sum(series.slice(-14, -7))) }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

// ---------------------------------------------------------------- paywall tests

/** Opens every variant needs before a test can be decided (docs/ops/README.md, A/B tests). */
export const OPENS_TO_DECIDE = 300

/** The opens of the variant with the fewest: what stands between a test and a decision. */
export function fewestOpens(experiment: TodayExperiment): number {
  if (!experiment.variants.length) return 0
  return Math.min(...experiment.variants.map((variant) => variant.opens ?? 0))
}

/** Purchases per paywall open, the one measure a test is judged by; null before any open. */
export function perOpen(purchases: number | undefined, opens: number | undefined): number | null {
  if (!opens) return null
  return (purchases ?? 0) / opens
}

/**
 * The design ahead on purchases per open, once at least two have opens and one
 * has a purchase; null otherwise, or when two share the lead. A lead is not a
 * decision: that needs the opens and the margin in docs/ops/README.md.
 */
export function leadingVariant(experiment: TodayExperiment): string | null {
  const rated = experiment.variants
    .map((variant) => ({ name: variant.name, rate: perOpen(variant.purchases, variant.opens) }))
    .filter((variant): variant is { name: string; rate: number } => variant.rate != null)
  if (rated.length < 2) return null
  const best = Math.max(...rated.map((variant) => variant.rate))
  const leaders = rated.filter((variant) => variant.rate === best)
  return best > 0 && leaders.length === 1 ? leaders[0]!.name : null
}

// ---------------------------------------------------------------- the log

export type LogKind = 'release' | 'review' | 'ads' | 'tests' | 'social' | 'build' | 'money' | 'learners' | 'check' | 'other'

/** What each kind of log entry is about, for its icon's label. */
export const LOG_KINDS: Record<LogKind, string> = {
  release: 'App Store',
  review: 'Reviews',
  ads: 'Apple Ads',
  tests: 'Paywalls',
  social: 'Lesson videos',
  build: 'Built',
  money: 'Prices and money',
  learners: 'Learners',
  check: 'Check-in',
  other: 'Other',
}

/**
 * What a log line is about, first match wins. Log lines lead with their
 * subject ("Apple approved…", "Built…", "Apple Ads: …"), so the patterns lean
 * on the opening words; a line none of them fits is "other", never a guess.
 */
const KIND_PATTERNS: [LogKind, RegExp][] = [
  ['check', /^(daily check|heartbeat)\b/i],
  ['release', /^(apple (approved|rejected)|submitted|resubmitted|tagged|released|phased release)\b|^\d+\.\d+(\.\d+)?\b.*\b(ready to submit|app store connect|prep|in review|waiting for review|on sale)\b/i],
  ['ads', /^apple ads\b|\bcampaigns?\b.*\bapple ads\b/i],
  ['social', /^(social|lesson videos?)\b/i],
  ['review', /\b(replied|answered) to\b|^(review|rating)s?\b/i],
  ['tests', /\b(superwall|paywalls?|a\/b test)\b|^[\w&' -]{2,30} test\b/i],
  ['money', /^(prices?|proceeds|revenue)\b/i],
  ['build', /^built\b/i],
  ['learners', /^first (real )?learners?\b|\blearners?\b.*\b(finished|started|opened)\b/i],
]

export function logKind(entry: TodayLogEntry): LogKind {
  if (entry.kind && entry.kind in LOG_KINDS) return entry.kind as LogKind
  for (const [kind, pattern] of KIND_PATTERNS) if (pattern.test(entry.text)) return kind
  return 'other'
}

// ---------------------------------------------------------------- the work list

/** "What Claude is on", in the order the groups show, with the states each gathers. */
const WORK_GROUPS: { label: string; mark: string; states: string[] }[] = [
  { label: 'Running', mark: 'running', states: ['doing', 'running'] },
  { label: 'Waiting', mark: 'waiting', states: ['waiting'] },
  { label: 'Next', mark: 'next', states: ['next'] },
  { label: 'Done', mark: 'done', states: ['done'] },
]

/** The work list by state, in WORK_GROUPS' order; an item with no state, or one it doesn't know, goes last. */
export function groupWork(items: TodayItem[]): { label: string; mark: string; items: TodayItem[] }[] {
  const known = new Set(WORK_GROUPS.flatMap((group) => group.states))
  return [
    ...WORK_GROUPS.map((group) => ({
      label: group.label,
      mark: group.mark,
      items: items.filter((item) => item.state && group.states.includes(item.state)),
    })),
    { label: 'Other', mark: 'other', items: items.filter((item) => !item.state || !known.has(item.state)) },
  ].filter((group) => group.items.length)
}

/** The next look and the dates ahead, soonest first; anything already past is left out. */
export function comingUp(status: TodayStatus, now: Date = new Date()): TodayEvent[] {
  const events = [...(status.next ? [status.next] : []), ...status.upcoming]
  const today = dayKey(now)
  const time = (event: TodayEvent) => (DAY.test(event.at) ? localDay(event.at).getTime() : Date.parse(event.at))
  return events
    .filter((event) => (DAY.test(event.at) ? event.at >= today : Date.parse(event.at) >= now.getTime()))
    .filter((event) => !Number.isNaN(time(event)))
    .sort((a, b) => time(a) - time(b))
}
