/**
 * The Learners page's model: what people did in the app over a day, a week or a
 * month, read from the app's own PostHog events (`web/server/learners.ts` fetches
 * them). Plain functions over a list of events, so the page, the Today card and
 * the tests read the same answers.
 *
 * Days are counted in the PostHog project's time zone, US Central, so a day here
 * is the same day PostHog's own charts show.
 *
 * What a "learner" is depends on their age, as the app's analytics allow
 * (PaperCoach/App/Analytics.swift): a child's events carry an id made fresh every
 * launch and no person, so one child's day can be several rows; a learner 13 or
 * over keeps one id, the profile's, from the moment they give their age. Their
 * first few seconds, before the age answer, are under the launch's own id: the two
 * are joined here (`stitch`). So a 13+ learner's visits can be followed over days
 * (`buildHistory`), and a child's never are. Nothing names anyone: an age band,
 * times, lessons, and for a 13+ learner a short tag cut from their random id.
 *
 * Test devices never reach here: the server leaves out debug builds and any id that
 * carried Apple Ads' test payload (`web/server/learners.ts`).
 */

export const LEARNERS_TIME_ZONE = 'America/Chicago'
/** What the time zone is called on the page. */
export const LEARNERS_TIME_ZONE_NAME = 'US Central'

export type Period = 'day' | 'week' | 'month'
export type Who = 'all' | 'children' | 'teens'
export type Source = 'all' | 'ads' | 'organic'

export const PERIODS: Period[] = ['day', 'week', 'month']

/** One app event, as the Studio server hands it over. Only what the page reads. */
export interface LearnerEvent {
  /** Milliseconds since 1970. */
  at: number
  event: string
  /** PostHog's distinct id. */
  id: string
  age?: string
  lesson?: string
  firstOpen?: boolean
  screen?: string
  entry?: string
  outcome?: string
  /** `asa_attribution`: Apple Ads brought this install. */
  ads?: boolean
  /** `wish_list_changed`: on (true) or off the list. */
  added?: boolean
}

/** The events the server asks PostHog for. `ob_beat_viewed` only for the age question (`ob-age`). */
export const LEARNER_EVENTS = [
  'app_opened',
  '$identify',
  'ob_beat_viewed',
  'ob_age_answered',
  'ob_finished',
  'lesson_started',
  'lesson_completed',
  'lesson_left',
  'drawing_saved',
  'premium_lesson_tapped',
  'wish_list_changed',
  'offer_screen_viewed',
  'superwall_paywall_open',
  'superwall_paywall_close',
  'purchase_attempted',
] as const

/** What `/api/learners` answers. */
export interface LearnersResponse {
  /** False until a PostHog key is set; `problem` says how. */
  configured: boolean
  /** `posthog`, or `sample` when STUDIO_LEARNERS_SAMPLE points at a file. */
  source: 'posthog' | 'sample' | null
  problem: string | null
  events: LearnerEvent[]
  /** When PostHog was asked (ISO). */
  fetchedAt: string | null
}

// ---------- Days ----------

export const DAY = /^\d{4}-\d{2}-\d{2}$/

const dayParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: LEARNERS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** The day a moment falls on, in US Central: "2026-10-02". */
export function dayOf(at: number | Date): string {
  return dayParts.format(typeof at === 'number' ? new Date(at) : at)
}

/** A day as a date at noon UTC, for arithmetic that no clock change can tip into the next day. */
function noon(day: string): Date {
  return new Date(`${day}T12:00:00Z`)
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(day: string, count: number): string {
  const date = noon(day)
  date.setUTCDate(date.getUTCDate() + count)
  return iso(date)
}

/** The days a period covers: `from` included, `to` not. Weeks run Monday to Sunday. */
export function periodRange(period: Period, date: string): { from: string; to: string } {
  if (period === 'day') return { from: date, to: addDays(date, 1) }
  if (period === 'week') {
    const weekday = (noon(date).getUTCDay() + 6) % 7
    const from = addDays(date, -weekday)
    return { from, to: addDays(from, 7) }
  }
  const from = `${date.slice(0, 7)}-01`
  const next = noon(from)
  next.setUTCMonth(next.getUTCMonth() + 1)
  return { from, to: iso(next) }
}

/** The same period one step back (-1) or on (+1), named by its first day. */
export function stepPeriod(period: Period, date: string, step: -1 | 1): string {
  const { from, to } = periodRange(period, date)
  return step === 1 ? to : periodRange(period, addDays(from, -1)).from
}

/** Every day in a range, oldest first. */
export function daysIn(from: string, to: string): string[] {
  const days: string[] = []
  for (let day = from; day < to; day = addDays(day, 1)) days.push(day)
  return days
}

const longDay = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const shortDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const weekdayName = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' })

/** "Thu, Oct 2" · "Sep 29 – Oct 5" · "October 2026". */
export function periodLabel(period: Period, date: string): string {
  if (period === 'day') return longDay.format(noon(date))
  const { from, to } = periodRange(period, date)
  if (period === 'week') return `${shortDay.format(noon(from))} – ${shortDay.format(noon(addDays(to, -1)))}`
  return monthName.format(noon(from))
}

/** What the period before is called beside a number: "Wed" · "last week" · "Sep". */
export function previousLabel(period: Period, date: string): string {
  const before = stepPeriod(period, date, -1)
  if (period === 'day') return weekdayName.format(noon(before))
  if (period === 'week') return 'the week before'
  return new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(noon(before))
}

const clock = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: LEARNERS_TIME_ZONE })
const clockSeconds = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  timeZone: LEARNERS_TIME_ZONE,
})

/** "9:05 AM", in US Central. */
export function timeOf(at: number): string {
  return clock.format(new Date(at))
}

/** "9:05:28 AM", for a session's timeline. */
export function timeWithSeconds(at: number): string {
  return clockSeconds.format(new Date(at))
}

/** "40 s" · "1 min 13 s" · "5 min" · "1 h 10 min". */
export function spoken(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 10 && seconds % 60) return `${minutes} min ${seconds % 60} s`
  if (minutes < 60) return `${Math.round(seconds / 60)} min`
  const hours = Math.floor(minutes / 60)
  return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`
}

/** How long a session lasted, for its row: "under a minute" · "5 min". */
export function lastedFor(ms: number): string {
  if (ms < 60_000) return 'under a minute'
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`
}

// ---------- Ages ----------

const AGE_LABELS: Record<string, string> = {
  under6: 'under 6',
  '6to9': '6–9',
  '10to12': '10–12',
  '13to15': '13–15',
  '16to17': '16–17',
  '18plus': '18+',
  preferNotToSay: 'age not said',
}

const TEEN_AND_OVER = new Set(['13to15', '16to17', '18plus'])

/** "6–9" · "18+" · "no age", for a learner's age group. */
export function ageLabel(age: string | null): string {
  return (age && AGE_LABELS[age]) ?? 'no age'
}

/** Whether the app treats this learner as a child: under 13, or never said. */
export function isChildAge(age: string | null): boolean {
  return !age || !TEEN_AND_OVER.has(age)
}

// ---------- Learners: one id, or the two of a learner who gave an age of 13 or over ----------

/** One learner's events, under one id or the two the app gives a learner 13 or over. */
export interface Learner {
  key: string
  ids: string[]
  events: LearnerEvent[]
}

/** How long the app takes between the age question and the answer that moves a 13+ learner to their own id. */
const STITCH_WINDOW_MS = 120_000

/**
 * Every event once, grouped by learner, oldest first.
 *
 * - A batch the app sent twice (same id, event, moment, lesson and screen) counts once.
 * - A learner 13 or over: the app moves their events from the launch's id to their
 *   profile's the moment they answer the age question, so the install shows as two
 *   ids. The profile's id begins with the answer (`ob_age_answered`, after an
 *   `$identify`); the launch's id ends at the question (`ob_beat_viewed` for `ob-age`)
 *   without an answer. The two closest in time, within two minutes, are one learner.
 */
export function stitch(events: LearnerEvent[]): Learner[] {
  const seen = new Set<string>()
  const byId = new Map<string, LearnerEvent[]>()
  for (const event of [...events].sort((a, b) => a.at - b.at)) {
    const key = `${event.id}|${event.event}|${event.at}|${event.lesson ?? ''}|${event.screen ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    const list = byId.get(event.id)
    if (list) list.push(event)
    else byId.set(event.id, [event])
  }

  const groups = [...byId.entries()].map(([id, list]) => ({ id, events: list }))
  const answered = (list: LearnerEvent[]) => list.some((event) => event.event === 'ob_age_answered')
  const merged = new Map<string, string>()
  for (const later of groups) {
    const meaningful = later.events.filter((event) => event.event !== '$identify')
    if (meaningful[0]?.event !== 'ob_age_answered' || isChildAge(meaningful[0].age ?? null)) continue
    const start = later.events[0].at
    let best: { id: string; gap: number } | null = null
    for (const earlier of groups) {
      if (earlier === later || merged.has(earlier.id) || answered(earlier.events)) continue
      const last = earlier.events[earlier.events.length - 1]
      if (!last || last.event !== 'ob_beat_viewed') continue
      const gap = start - last.at
      if (gap >= 0 && gap <= STITCH_WINDOW_MS && (!best || gap < best.gap)) best = { id: earlier.id, gap }
    }
    if (best) merged.set(best.id, later.id)
  }

  const learners = new Map<string, Learner>()
  for (const group of groups) {
    const owner = merged.get(group.id) ?? group.id
    const learner = learners.get(owner) ?? { key: owner, ids: [], events: [] }
    learner.ids.push(group.id)
    learner.events.push(...group.events)
    learners.set(owner, learner)
  }
  for (const learner of learners.values()) learner.events.sort((a, b) => a.at - b.at)
  return [...learners.values()].sort((a, b) => a.events[0].at - b.events[0].at)
}

/** The age a learner last gave, or null. */
export function ageOf(events: LearnerEvent[]): string | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const age = events[index].age
    if (age && age !== 'unanswered') return age
  }
  return null
}

/** Apple Ads, when any of their events says so; otherwise everything else, called organic. */
export function sourceOf(events: LearnerEvent[]): 'ads' | 'organic' {
  return events.some((event) => event.ads === true) ? 'ads' : 'organic'
}

// ---------- Sessions ----------

/** A pause longer than this starts a new visit within a row ("back at 1:47 PM"). */
export const VISIT_GAP_MS = 30 * 60_000
/** A learner whose last event is this recent, today, is shown as still in the app. */
export const HERE_NOW_MS = 10 * 60_000

/** One step of a session's strip, in order. */
export type SessionItem =
  | { kind: 'onboarding'; at: number }
  | { kind: 'lesson'; at: number; lesson: string; state: 'started' | 'finished' | 'left'; kept: boolean; endedAt: number | null }
  | { kind: 'crown'; at: number; lesson: string }
  | { kind: 'wish'; at: number; lesson: string }
  | { kind: 'grownUp'; at: number }
  | { kind: 'price'; at: number; forGrownUp: boolean; closedAfter: number | null }
  | { kind: 'bought'; at: number }
  | { kind: 'later'; at: number }

/** Where a session ended, or where it is now. */
export type SessionEnd =
  | { kind: 'drawingNow'; lesson: string }
  | { kind: 'hereNow' }
  | { kind: 'stopped'; lesson: string }
  | { kind: 'after'; lesson: string; kept: boolean }
  | { kind: 'atLocked'; lesson: string }
  | { kind: 'atPaywall'; closedAfter: number | null }
  | { kind: 'atGrownUpPaywall' }
  | { kind: 'atGrownUp' }
  | { kind: 'bought' }
  | { kind: 'duringOnboarding' }
  | { kind: 'afterOnboarding' }
  | { kind: 'openedOnly' }

/** A line of an opened session: what happened, in words. */
export interface TimelineLine {
  at: number
  text: string
  lesson: string | null
  mark: 'quiet' | 'started' | 'finished' | 'price' | 'grownUp' | 'kept' | 'crown' | 'wish' | 'bought'
}

export interface LearnerSession {
  key: string
  /** Every id the learner's events came under (two for a 13+ install). */
  ids: string[]
  start: number
  last: number
  age: string | null
  child: boolean
  source: 'ads' | 'organic'
  /** Installed in this period. */
  isNew: boolean
  /** The times later visits began, after a pause of half an hour or more. */
  returns: number[]
  /** Summed over its visits. */
  activeMs: number
  finished: number
  /** Photos kept. */
  kept: number
  items: SessionItem[]
  end: SessionEnd
  timeline: TimelineLine[]
}

const ENDS_ON_PRICE = new Set(['paywall', 'grown_up_paywall'])

/** A learner's events within a period, as one row of the session list. */
export function buildSession(learner: Learner, events: LearnerEvent[], now: number): LearnerSession {
  const items: SessionItem[] = []
  const timeline: TimelineLine[] = []
  const returns: number[] = []
  let activeMs = 0
  let visitStart = events[0].at
  let previous = events[0].at
  let finished = 0
  let kept = 0
  const openLesson = (lesson: string) =>
    [...items].reverse().find((item) => item.kind === 'lesson' && item.lesson === lesson && item.state === 'started') as
      | Extract<SessionItem, { kind: 'lesson' }>
      | undefined

  for (const event of events) {
    if (event.at - previous > VISIT_GAP_MS) {
      activeMs += previous - visitStart
      visitStart = event.at
      returns.push(event.at)
      items.push({ kind: 'later', at: event.at })
    }
    previous = event.at
    const line = (text: string, mark: TimelineLine['mark'] = 'quiet', lesson: string | null = null) =>
      timeline.push({ at: event.at, text, lesson, mark })

    switch (event.event) {
      case 'app_opened': {
        if (event.firstOpen) line('Opened the app for the first time')
        else if (timeline.length === 0 || returns[returns.length - 1] === event.at) line('Came back to the app')
        break
      }
      case 'ob_beat_viewed':
        line('Reached the age question')
        break
      case 'ob_age_answered':
        line(event.age ? `Chose ${ageLabel(event.age)} for their age` : 'Answered the age question')
        break
      case 'ob_finished':
        if (!items.some((item) => item.kind === 'onboarding')) items.push({ kind: 'onboarding', at: event.at })
        line('Finished onboarding')
        break
      case 'lesson_started':
        if (event.lesson) {
          items.push({ kind: 'lesson', at: event.at, lesson: event.lesson, state: 'started', kept: false, endedAt: null })
          line('Started', 'started', event.lesson)
        }
        break
      case 'lesson_completed': {
        if (!event.lesson) break
        finished += 1
        const open = openLesson(event.lesson)
        if (open) {
          open.state = 'finished'
          open.endedAt = event.at
          line(`Finished it in ${spoken(event.at - open.at)}`, 'finished', event.lesson)
        } else {
          items.push({ kind: 'lesson', at: event.at, lesson: event.lesson, state: 'finished', kept: false, endedAt: event.at })
          line('Finished', 'finished', event.lesson)
        }
        break
      }
      case 'lesson_left': {
        if (!event.lesson) break
        const open = openLesson(event.lesson)
        if (open) {
          open.state = 'left'
          open.endedAt = event.at
        }
        line('Left it partway', 'quiet', event.lesson)
        break
      }
      case 'drawing_saved': {
        if (!event.lesson) break
        kept += 1
        const drawn = [...items]
          .reverse()
          .find((item) => item.kind === 'lesson' && item.lesson === event.lesson && item.state === 'finished') as
          | Extract<SessionItem, { kind: 'lesson' }>
          | undefined
        if (drawn) drawn.kept = true
        line('Kept a photo of it', 'kept', event.lesson)
        break
      }
      case 'premium_lesson_tapped':
        if (event.lesson) {
          items.push({ kind: 'crown', at: event.at, lesson: event.lesson })
          line('Tapped a locked lesson', 'crown', event.lesson)
        }
        break
      case 'wish_list_changed':
        if (event.lesson && event.added !== false) {
          items.push({ kind: 'wish', at: event.at, lesson: event.lesson })
          line('Saved it to their wish list', 'wish', event.lesson)
        } else if (event.lesson) {
          line('Took it off their wish list', 'quiet', event.lesson)
        }
        break
      case 'offer_screen_viewed': {
        const screen = event.screen ?? ''
        if (screen === 'grown_up') {
          if (items[items.length - 1]?.kind !== 'grownUp') items.push({ kind: 'grownUp', at: event.at })
          line('Saw “This part is for a grown-up”', 'grownUp')
        } else if (screen === 'parental_check') {
          line('Saw the grown-ups’ check', 'grownUp')
        } else if (ENDS_ON_PRICE.has(screen)) {
          const forGrownUp = screen === 'grown_up_paywall'
          items.push({ kind: 'price', at: event.at, forGrownUp, closedAfter: null })
          line(forGrownUp ? 'Passed the check: the grown-up’s paywall' : 'Saw the paywall', 'price')
        } else if (screen === 'sketchbook_tour') {
          line('Saw the sketchbook tour')
        } else if (screen === 'more_coming') {
          line('Saw “More coming”')
        } else if (screen === 'trial_started') {
          line('Saw “Your free week has started”', 'bought')
        } else if (screen === 'pending') {
          line('Waiting for a grown-up’s approval')
        }
        break
      }
      case 'superwall_paywall_open':
        items.push({ kind: 'price', at: event.at, forGrownUp: false, closedAfter: null })
        line('Paywall opened', 'price')
        break
      case 'superwall_paywall_close': {
        const price = [...items].reverse().find((item) => item.kind === 'price') as
          | Extract<SessionItem, { kind: 'price' }>
          | undefined
        if (price && price.closedAfter === null) price.closedAfter = event.at - price.at
        line(price ? `Closed the paywall after ${spoken(event.at - price.at)}` : 'Closed the paywall', 'price')
        break
      }
      case 'purchase_attempted':
        if (event.outcome === 'purchased') {
          items.push({ kind: 'bought', at: event.at })
          line('Bought Premium', 'bought')
        } else if (event.outcome) {
          line(`Tried to buy Premium: ${event.outcome}`, 'price')
        }
        break
    }
  }
  activeMs += previous - visitStart

  const first = events[0]
  const last = events[events.length - 1] ?? first
  const age = ageOf(learner.events)
  const isNew = events.some((event) => event.event === 'app_opened' && event.firstOpen)
  return {
    key: learner.key,
    ids: learner.ids,
    start: first.at,
    last: last.at,
    age,
    child: isChildAge(age),
    source: sourceOf(learner.events),
    isNew,
    returns,
    activeMs,
    finished,
    kept,
    items,
    end: endOf(items, events, now - last.at < HERE_NOW_MS),
    timeline,
  }
}

function endOf(items: SessionItem[], events: LearnerEvent[], hereNow: boolean): SessionEnd {
  const lastItem = [...items].reverse().find((item) => item.kind !== 'later')
  if (hereNow) {
    return lastItem?.kind === 'lesson' && lastItem.state === 'started'
      ? { kind: 'drawingNow', lesson: lastItem.lesson }
      : { kind: 'hereNow' }
  }
  if (!lastItem) {
    const installed = events.some((event) => event.event === 'app_opened' && event.firstOpen)
    return installed ? { kind: 'duringOnboarding' } : { kind: 'openedOnly' }
  }
  switch (lastItem.kind) {
    case 'lesson':
      return lastItem.state === 'finished'
        ? { kind: 'after', lesson: lastItem.lesson, kept: lastItem.kept }
        : { kind: 'stopped', lesson: lastItem.lesson }
    case 'crown':
    case 'wish':
      return { kind: 'atLocked', lesson: lastItem.lesson }
    case 'price':
      return lastItem.forGrownUp ? { kind: 'atGrownUpPaywall' } : { kind: 'atPaywall', closedAfter: lastItem.closedAfter }
    case 'grownUp':
      return { kind: 'atGrownUp' }
    case 'bought':
      return { kind: 'bought' }
    case 'onboarding':
      return { kind: 'afterOnboarding' }
  }
}

/** "#3F2A" for a learner 13 or over, from their profile's random id, so they can be told apart across days. A child has none. */
export function learnerTag(session: Pick<LearnerSession, 'key' | 'child'>): string | null {
  return session.child ? null : `#${session.key.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()}`
}

/** The words before a session's last picture, or all its words when it ended on no lesson. */
export function endWords(end: SessionEnd): string {
  switch (end.kind) {
    case 'drawingNow':
      return 'Drawing now'
    case 'hereNow':
      return 'In the app now'
    case 'stopped':
      return 'Stopped in'
    case 'after':
      return end.kept ? 'Left after keeping' : 'Left after'
    case 'atLocked':
      return 'Left at a locked lesson'
    case 'atPaywall':
      return end.closedAfter !== null ? `Left at the paywall after ${spoken(end.closedAfter)}` : 'Left at the paywall'
    case 'atGrownUpPaywall':
      return 'Left at the grown-up’s paywall'
    case 'atGrownUp':
      return 'Left at “for a grown-up”'
    case 'bought':
      return 'Bought Premium'
    case 'duringOnboarding':
      return 'Left during onboarding'
    case 'afterOnboarding':
      return 'Left after onboarding'
    case 'openedOnly':
      return 'Opened, nothing else'
  }
}

/** The lesson a session's end shows as a picture, if any. */
export function endLesson(end: SessionEnd): string | null {
  return 'lesson' in end ? end.lesson : null
}

// ---------- The report ----------

export interface ReportNumber {
  key: 'installs' | 'sessions' | 'lessons' | 'photos' | 'price' | 'bought'
  label: string
  value: number
  previous: number
  sub: string
}

export interface JourneyStage {
  key: 'installed' | 'onboarded' | 'first' | 'second' | 'price' | 'bought'
  label: string
  children: number
  teens: number
}

export interface DrawnLesson {
  lesson: string
  count: number
}

export interface DaySummary {
  day: string
  installs: number
  sessions: number
  lessons: number
  top: string | null
}

export interface LearnersReport {
  period: Period
  date: string
  from: string
  to: string
  numbers: ReportNumber[]
  journey: JourneyStage[]
  mostDrawn: DrawnLesson[]
  /** Newest first. The day view's list; empty for a week or a month. */
  sessions: LearnerSession[]
  /** One per day of a week or a month; empty for a day. */
  days: DaySummary[]
  /** Who drew most in the period, best first. */
  leaders: LearnerSession[]
}

export interface ReportOptions {
  period: Period
  date: string
  who?: Who
  source?: Source
  now?: number
}

const MOST_DRAWN = 12
const LEADERS = 10

/**
 * Everything the page shows for one period, from the events of that period and the
 * one before it (for the numbers' comparison). `who` and `source` narrow it to
 * children or 13+, and to Apple Ads or the rest.
 */
export function buildReport(events: LearnerEvent[], options: ReportOptions): LearnersReport {
  const { period, date, who = 'all', source = 'all', now = Date.now() } = options
  const { from, to } = periodRange(period, date)
  const before = periodRange(period, stepPeriod(period, date, -1))
  const learners = stitch(events).filter((learner) => {
    const age = ageOf(learner.events)
    if (who === 'children' && !isChildAge(age)) return false
    if (who === 'teens' && isChildAge(age)) return false
    if (source !== 'all' && sourceOf(learner.events) !== source) return false
    return true
  })

  const inRange = (range: { from: string; to: string }) =>
    learners
      .map((learner) => ({
        learner,
        events: learner.events.filter((event) => {
          const day = dayOf(event.at)
          return day >= range.from && day < range.to
        }),
      }))
      .filter((entry) => entry.events.length > 0)

  const current = inRange({ from, to })
  const sessions = current.map((entry) => buildSession(entry.learner, entry.events, now))
  const previous = inRange(before).map((entry) => buildSession(entry.learner, entry.events, now))
  const currentEvents = current.flatMap((entry) => entry.events)
  const previousEvents = inRange(before).flatMap((entry) => entry.events)

  return {
    period,
    date,
    from,
    to,
    numbers: numbersOf(sessions, currentEvents, previous, previousEvents),
    journey: journeyOf(sessions),
    mostDrawn: mostDrawnOf(currentEvents),
    sessions: period === 'day' ? [...sessions].sort((a, b) => b.start - a.start) : [],
    days: period === 'day' ? [] : daysOf(from, to, current),
    leaders: leadersOf(sessions),
  }
}

/** The learners who finished most, then kept most photos, then stayed longest; anyone who finished nothing is left off. */
export function leadersOf(sessions: LearnerSession[]): LearnerSession[] {
  return sessions
    .filter((session) => session.finished > 0)
    .sort((a, b) => b.finished - a.finished || b.kept - a.kept || b.activeMs - a.activeMs || a.start - b.start)
    .slice(0, LEADERS)
}

/** The lessons a session finished, most often first, each once. */
export function finishedLessons(session: LearnerSession): string[] {
  const counts = new Map<string, number>()
  for (const item of session.items) {
    if (item.kind === 'lesson' && item.state === 'finished') counts.set(item.lesson, (counts.get(item.lesson) ?? 0) + 1)
  }
  return [...counts.entries()].sort(([, a], [, b]) => b - a).map(([lesson]) => lesson)
}

// ---------- One learner over time (13 and over) ----------

export interface LearnerHistory {
  firstSeen: number
  /** When the app was first opened, if that falls within what PostHog keeps. */
  installedAt: number | null
  /** Every visit: each day's first, and each return after a pause of half an hour. */
  visits: number
  finished: number
  kept: number
  /** How many times a paywall opened. */
  prices: number
  bought: boolean
  /** One per day they used the app, newest first. */
  days: { day: string; session: LearnerSession }[]
}

/**
 * Every day a learner 13 or over used the app, from the events of their ids (the
 * server asks PostHog for up to a year of them). Null when there are none.
 */
export function buildHistory(events: LearnerEvent[], now: number): LearnerHistory | null {
  const learners = stitch(events)
  if (!learners.length) return null
  const learner: Learner = {
    key: learners[learners.length - 1].key,
    ids: learners.flatMap((entry) => entry.ids),
    events: learners.flatMap((entry) => entry.events).sort((a, b) => a.at - b.at),
  }
  const byDay = new Map<string, LearnerEvent[]>()
  for (const event of learner.events) {
    const day = dayOf(event.at)
    const list = byDay.get(day)
    if (list) list.push(event)
    else byDay.set(day, [event])
  }
  const days = [...byDay.entries()]
    .map(([day, dayEvents]) => ({ day, session: buildSession(learner, dayEvents, now) }))
    .sort((a, b) => b.day.localeCompare(a.day))
  const install = learner.events.find((event) => event.event === 'app_opened' && event.firstOpen)
  const sessions = days.map((entry) => entry.session)
  return {
    firstSeen: learner.events[0].at,
    installedAt: install?.at ?? null,
    visits: sessions.reduce((total, session) => total + 1 + session.returns.length, 0),
    finished: sessions.reduce((total, session) => total + session.finished, 0),
    kept: sessions.reduce((total, session) => total + session.kept, 0),
    prices: sessions.reduce((total, session) => total + session.items.filter((item) => item.kind === 'price').length, 0),
    bought: sessions.some((session) => session.items.some((item) => item.kind === 'bought')),
    days,
  }
}

function count(events: LearnerEvent[], name: string): number {
  return events.filter((event) => event.event === name).length
}

function numbersOf(
  sessions: LearnerSession[],
  events: LearnerEvent[],
  previousSessions: LearnerSession[],
  previousEvents: LearnerEvent[],
): ReportNumber[] {
  const installs = sessions.filter((session) => session.isNew)
  const sawPrice = sessions.filter((session) => session.items.some((item) => item.kind === 'price'))
  const bought = sessions.filter((session) => session.items.some((item) => item.kind === 'bought'))
  const lessons = events.filter((event) => event.event === 'lesson_completed')
  const different = new Set(lessons.map((event) => event.lesson)).size
  const photoSessions = sessions.filter((session) =>
    session.items.some((item) => item.kind === 'lesson' && item.kept),
  ).length
  const childPrices = sawPrice.filter((session) => session.child).length
  const previousOf = (pick: (sessions: LearnerSession[], events: LearnerEvent[]) => number) =>
    pick(previousSessions, previousEvents)

  return [
    {
      key: 'installs',
      label: 'Installs',
      value: installs.length,
      previous: previousOf((list) => list.filter((session) => session.isNew).length),
      sub: `${installs.filter((session) => session.child).length} under 13`,
    },
    {
      key: 'sessions',
      label: 'Sessions',
      value: sessions.length,
      previous: previousSessions.length,
      sub: `${sessions.filter((session) => !session.isNew).length} returning`,
    },
    {
      key: 'lessons',
      label: 'Lessons done',
      value: lessons.length,
      previous: previousOf((_, list) => count(list, 'lesson_completed')),
      sub: `${different} different`,
    },
    {
      key: 'photos',
      label: 'Photos kept',
      value: count(events, 'drawing_saved'),
      previous: previousOf((_, list) => count(list, 'drawing_saved')),
      sub: photoSessions === 1 ? 'in 1 session' : `in ${photoSessions} sessions`,
    },
    {
      key: 'price',
      label: 'Saw a price',
      value: sawPrice.length,
      previous: previousOf((list) => list.filter((session) => session.items.some((item) => item.kind === 'price')).length),
      sub: sawPrice.length === 0 ? 'nobody yet' : childPrices ? `${childPrices} for a child` : 'all 13+',
    },
    {
      key: 'bought',
      label: 'Trials and buys',
      value: bought.length,
      previous: previousOf((list) => list.filter((session) => session.items.some((item) => item.kind === 'bought')).length),
      sub: bought.length ? `of ${sawPrice.length} who saw a price` : 'none yet',
    },
  ]
}

function journeyOf(sessions: LearnerSession[]): JourneyStage[] {
  const installs = sessions.filter((session) => session.isNew)
  const stage = (key: JourneyStage['key'], label: string, test: (session: LearnerSession) => boolean): JourneyStage => {
    const passed = installs.filter(test)
    return {
      key,
      label,
      children: passed.filter((session) => session.child).length,
      teens: passed.filter((session) => !session.child).length,
    }
  }
  return [
    stage('installed', 'Installed', () => true),
    stage('onboarded', 'Finished onboarding', (session) => session.items.some((item) => item.kind === 'onboarding')),
    stage('first', 'First drawing', (session) => session.finished >= 1),
    stage('second', 'Second drawing', (session) => session.finished >= 2),
    stage('price', 'Saw a price', (session) => session.items.some((item) => item.kind === 'price')),
    stage('bought', 'Started a trial or bought', (session) => session.items.some((item) => item.kind === 'bought')),
  ]
}

function mostDrawnOf(events: LearnerEvent[]): DrawnLesson[] {
  const counts = new Map<string, number>()
  for (const event of events) {
    if (event.event === 'lesson_completed' && event.lesson) counts.set(event.lesson, (counts.get(event.lesson) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .slice(0, MOST_DRAWN)
    .map(([lesson, value]) => ({ lesson, count: value }))
}

function daysOf(from: string, to: string, current: { learner: Learner; events: LearnerEvent[] }[]): DaySummary[] {
  return daysIn(from, to).map((day) => {
    const entries = current
      .map((entry) => ({ entry, events: entry.events.filter((event) => dayOf(event.at) === day) }))
      .filter((item) => item.events.length > 0)
    const events = entries.flatMap((item) => item.events)
    return {
      day,
      installs: events.filter((event) => event.event === 'app_opened' && event.firstOpen).length,
      sessions: entries.length,
      lessons: count(events, 'lesson_completed'),
      top: mostDrawnOf(events)[0]?.lesson ?? null,
    }
  })
}

/** "+3 vs Wed" · "same as Wed" · "−2 vs Wed". */
export function compared(value: number, previous: number, label: string): string {
  if (value === previous) return `same as ${label}`
  return `${value > previous ? '+' : '−'}${Math.abs(value - previous)} vs ${label}`
}
