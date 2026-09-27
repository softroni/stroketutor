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
}

export interface AppBuild {
  version: string
  build: string
  /** App Store Connect's state, as a person would say it: "Waiting for review". */
  state: string
  tone: Tone
  /** Since when it has been in that state (ISO), if known. */
  since: string | null
}

export interface TodayNumber {
  label: string
  /** Already formatted: "12", "$34.50", "4.8★". */
  value: string
  /** What the value covers: "yesterday", "last 7 days". */
  period: string
  /** A short second line: "7 days: 40", "vs 3 the day before". */
  detail?: string
  /** Up to 14 daily values, oldest first; the last is the day `value` reports. */
  series?: DayValue[]
  tone?: Tone
}

export interface DayValue {
  /** YYYY-MM-DD */
  day: string
  value: number
}

export interface TodayItem {
  title: string
  detail?: string
  state?: 'doing' | 'waiting' | 'next' | 'done'
  /** YYYY-MM-DD, when it started or was asked for. */
  since?: string
  url?: string
}

export interface TodayLogEntry {
  /** ISO 8601 */
  at: string
  text: string
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
 * not an object with `updated` and `headline` is refused.
 */
export function normalizeStatus(raw: unknown): TodayStatus | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<TodayStatus>
  if (typeof value.updated !== 'string' || typeof value.headline !== 'string') return null
  const list = <T,>(items: T[] | undefined): T[] => (Array.isArray(items) ? items : [])
  return {
    updated: value.updated,
    headline: value.headline,
    app: { live: value.app?.live ?? null, inReview: value.app?.inReview ?? null },
    numbers: list(value.numbers),
    needsYou: list(value.needsYou),
    working: list(value.working),
    log: list(value.log),
    experiments: list(value.experiments),
    ads: value.ads ?? null,
    reviews: value.reviews ?? null,
    links: list(value.links),
    next: value.next ?? null,
  }
}
