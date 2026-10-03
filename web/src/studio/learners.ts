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
export type Who = 'all' | 'children' | 'teens' | 'adults'
export type Source = 'all' | 'ads' | 'organic'

export const PERIODS: Period[] = ['day', 'week', 'month']

/** The journey's stages, in order: what a new install got as far as. */
export type Stage = 'installed' | 'onboarded' | 'first' | 'second' | 'price' | 'bought'
export const STAGES: Stage[] = ['installed', 'onboarded', 'first', 'second', 'price', 'bought']

/**
 * What narrows the page to some of its learners: a number (Sessions counts everyone, so it
 * has none), a stage of the journey reached (`reached-first`: new installs who made a first
 * drawing; Installed is `installs`), or a stage stopped at (`stopped-first`: who got that far
 * and no further).
 */
export type Only =
  | 'installs'
  | 'lessons'
  | 'photos'
  | 'price'
  | 'trials'
  | 'buys'
  | `reached-${Exclude<Stage, 'installed'>}`
  | `stopped-${Exclude<Stage, 'bought'>}`
export const ONLY: Only[] = [
  'installs',
  'lessons',
  'photos',
  'price',
  'trials',
  'buys',
  'reached-onboarded',
  'reached-first',
  'reached-second',
  'reached-price',
  'reached-bought',
  'stopped-installed',
  'stopped-onboarded',
  'stopped-first',
  'stopped-second',
  'stopped-price',
]

/** Whether a new install got as far as a stage of the journey. */
export function reached(session: LearnerSession, stage: Stage): boolean {
  if (!session.isNew) return false
  switch (stage) {
    case 'installed':
      return true
    case 'onboarded':
      return session.items.some((item) => item.kind === 'onboarding')
    case 'first':
      return session.finished >= 1
    case 'second':
      return session.finished >= 2
    case 'price':
      return session.items.some((item) => item.kind === 'price')
    case 'bought':
      return session.items.some((item) => item.kind === 'bought')
  }
}

/** The stage after this one, or null after the last. */
function nextStage(stage: Stage): Stage | null {
  return STAGES[STAGES.indexOf(stage) + 1] ?? null
}

/** Whether a learner is one of those a number, or a stage of the journey, counts. */
export function counts(session: LearnerSession, only: Only): boolean {
  switch (only) {
    case 'installs':
      return session.isNew
    case 'lessons':
      return session.finished > 0
    case 'photos':
      return session.kept > 0
    case 'price':
      return session.items.some((item) => item.kind === 'price')
    case 'trials':
      return session.items.some((item) => item.kind === 'bought' && item.trial)
    case 'buys':
      return session.items.some((item) => item.kind === 'bought' && !item.trial)
  }
  const [kind, stage] = only.split('-') as ['reached' | 'stopped', Stage]
  if (kind === 'reached') return reached(session, stage)
  const next = nextStage(stage)
  return reached(session, stage) && (!next || !reached(session, next))
}

/** A learner's animal on the page: who they are at a glance, wherever they appear on it. */
export interface Animal {
  emoji: string
  name: string
}

/** Kid-friendly animals that stay distinct at the size of a small circle. */
export const ANIMALS: Animal[] = [
  { emoji: '🦊', name: 'Fox' },
  { emoji: '🐼', name: 'Panda' },
  { emoji: '🐸', name: 'Frog' },
  { emoji: '🐙', name: 'Octopus' },
  { emoji: '🦁', name: 'Lion' },
  { emoji: '🐨', name: 'Koala' },
  { emoji: '🐯', name: 'Tiger' },
  { emoji: '🐰', name: 'Bunny' },
  { emoji: '🐻', name: 'Bear' },
  { emoji: '🐷', name: 'Pig' },
  { emoji: '🐵', name: 'Monkey' },
  { emoji: '🦉', name: 'Owl' },
  { emoji: '🐧', name: 'Penguin' },
  { emoji: '🐢', name: 'Turtle' },
  { emoji: '🦋', name: 'Butterfly' },
  { emoji: '🐝', name: 'Bee' },
  { emoji: '🐞', name: 'Ladybug' },
  { emoji: '🦄', name: 'Unicorn' },
  { emoji: '🐳', name: 'Whale' },
  { emoji: '🦒', name: 'Giraffe' },
  { emoji: '🐘', name: 'Elephant' },
  { emoji: '🦔', name: 'Hedgehog' },
  { emoji: '🐬', name: 'Dolphin' },
  { emoji: '🦜', name: 'Parrot' },
]

/**
 * Every learner's animal, from their order on the page. A learner 13 or over, who can be
 * followed from day to day, claims the animal their id points at first, so they keep it
 * on every day (the next free one if another 13+ learner already has it); everyone else
 * takes the next free animal in order. Past the last animal, they come round again
 * numbered: "Fox 2".
 */
export function animalsFor(learners: { key: string; child: boolean }[]): Map<string, Animal> {
  const given = new Map<string, Animal>()
  const taken = new Set<number>()
  for (const learner of learners) {
    if (learner.child || taken.size >= ANIMALS.length) continue
    let hash = 0
    for (const unit of learner.key) hash = (hash * 31 + unit.charCodeAt(0)) >>> 0
    let index = hash % ANIMALS.length
    while (taken.has(index)) index = (index + 1) % ANIMALS.length
    taken.add(index)
    given.set(learner.key, ANIMALS[index])
  }
  let round = 1
  let next = 0
  for (const learner of learners) {
    if (given.has(learner.key)) continue
    while (taken.has(next)) {
      next += 1
      if (next === ANIMALS.length) {
        next = 0
        round += 1
        taken.clear()
      }
    }
    taken.add(next)
    const animal = ANIMALS[next]
    given.set(learner.key, round > 1 ? { emoji: animal.emoji, name: `${animal.name} ${round}` } : animal)
  }
  return given
}

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
  /** `purchase_attempted`: `yearly`, `weekly`, `lifetime` or `restore`. */
  plan?: string
  /** `asa_attribution`: Apple Ads brought this install. */
  ads?: boolean
  /** `wish_list_changed`: on (true) or off the list. */
  added?: boolean
  /** Apple Ads' ids for the campaign, ad group and keyword that brought the install (`asa_*`). */
  campaign?: string
  adGroup?: string
  keyword?: string
  /** `device_region`: the Region set on the phone ("US"), from the release after 1.1. */
  region?: string
  /** `asa_country_or_region`: the storefront of the ad that brought the install. */
  adsRegion?: string
  /** `$app_version`: "1.0". */
  version?: string
  /** Superwall's events: where the paywall was asked for (`onboarding_offer`, `premium_lesson`, `settings_premium`). */
  placement?: string
  /** Superwall's events: the paywall's identifier (`new-flow-7f9d-2026-09-26`). */
  paywall?: string
  /** Superwall's events: the test version (variant) shown. */
  variant?: string
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
  'superwall_free_trial_start',
  // Apple's answer about the install, often the only event of a first launch that names the ad.
  'install_attributed',
  // A buy tapped on Superwall's paywall, and how it ended.
  'superwall_transaction_start',
  'superwall_transaction_abandon',
  'superwall_transaction_complete',
  'superwall_transaction_fail',
] as const

/** The names behind Apple Ads' ids, from `/api/learners/ads` (`web/server/appleAds.ts`). */
export interface AdNames {
  campaigns: Record<string, string>
  adGroups: Record<string, string>
  keywords: Record<string, { text: string; match: string }>
}

export interface AdNamesResponse {
  names: AdNames
  source: 'apple-ads' | 'sample' | null
  problem: string | null
}

/** The names behind Superwall's ids, from `/api/learners/paywalls` (`web/server/paywallNames.ts`). */
export interface PaywallNames {
  /** By paywall identifier: "Flow 1". */
  paywalls: Record<string, string>
  /** By test version (variant id): its paywall, its campaign ("Onboarding offer") and its share of the traffic. */
  variants: Record<string, { paywall: string; campaign: string; share: number }>
  /** By placement: the campaign it belongs to. */
  placements: Record<string, string>
}

export interface PaywallNamesResponse {
  names: PaywallNames
  source: 'superwall' | 'sample' | null
  problem: string | null
}

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

/** The age bands the app asks for, youngest first; then "age not said", and `none` for no answer (left before it). */
export const AGE_BANDS = ['under6', '6to9', '10to12', '13to15', '16to17', '18plus', 'preferNotToSay', 'none'] as const
export type AgeBand = (typeof AGE_BANDS)[number]

export function isAgeBand(value: string): value is AgeBand {
  return (AGE_BANDS as readonly string[]).includes(value)
}

/** A learner's band: the age they gave, or `none`. */
export function ageBandOf(events: LearnerEvent[]): AgeBand {
  const age = ageOf(events)
  return age && isAgeBand(age) ? age : 'none'
}

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

/** The Apple Ads campaign, ad group and keyword that brought a learner. */
export interface AdSource {
  campaign: string
  adGroup: string | null
  /** None for Search Match, where Apple picked the search. */
  keyword: string | null
}

/** Which ad brought them, from the first of their events that names one. */
export function adOf(events: LearnerEvent[]): AdSource | null {
  const named = events.find((event) => event.campaign && event.ads !== false)
  return named?.campaign ? { campaign: named.campaign, adGroup: named.adGroup ?? null, keyword: named.keyword ?? null } : null
}

/** Their country: the phone's Region if the app sent it, else the storefront of the ad that brought them. */
export function countryOf(events: LearnerEvent[]): string | null {
  for (let index = events.length - 1; index >= 0; index -= 1) if (events[index].region) return events[index].region ?? null
  return events.find((event) => event.adsRegion)?.adsRegion ?? null
}

/** The app version of their latest event. */
export function versionOf(events: LearnerEvent[]): string | null {
  for (let index = events.length - 1; index >= 0; index -= 1) if (events[index].version) return events[index].version ?? null
  return null
}

/**
 * One way to narrow the page by where learners came from (`?where=`): an Apple Ads keyword
 * (`keyword-<id>`), a campaign (`campaign-<id>`, for Search Match), `organic`, a country
 * (`country-US`, `country-unknown`) or an app version (`version-1.0`, `version-unknown`).
 */
export type Where = string

export function isWhere(value: string): boolean {
  return /^(?:(?:keyword|campaign)-\d{1,20}|organic|country-(?:[A-Z]{2}|unknown)|version-(?:\d{1,4}(?:\.\d{1,4}){0,3}|unknown))$/.test(
    value,
  )
}

/** The filter key of the ad that brought someone: their keyword's, or their campaign's for Search Match. */
export function adKey(ad: AdSource): Where {
  return ad.keyword ? `keyword-${ad.keyword}` : `campaign-${ad.campaign}`
}

function matchesWhere(learnerEvents: LearnerEvent[], periodEvents: LearnerEvent[], where: Where): boolean {
  if (where === 'organic') return sourceOf(learnerEvents) === 'organic'
  if (where.startsWith('keyword-') || where.startsWith('campaign-')) {
    const ad = adOf(learnerEvents)
    return ad !== null && (adKey(ad) === where || `campaign-${ad.campaign}` === where)
  }
  if (where.startsWith('country-')) return (countryOf(learnerEvents) ?? 'unknown') === where.slice('country-'.length)
  if (where.startsWith('version-')) return (versionOf(periodEvents) ?? 'unknown') === where.slice('version-'.length)
  return true
}

// ---------- Sessions ----------

/** "2nd", "3rd", "11th". */
export function ordinal(count: number): string {
  const tens = count % 100
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[count % 10] ?? 'th'
  return `${count}${suffix}`
}

/** A purchase and the free week it started arrive within this of each other. */
const PURCHASE_WINDOW_MS = 10 * 60_000

/**
 * A plan's US list price on the day it was bought, in dollars: what the App Store shows in
 * the US, before Apple's cut and before other countries' prices. Paper Coach's events carry
 * the plan, not the price. From 2026-10-02 the yearly plan is $29.99 and the weekly $3.99
 * ($19.99 and $1.99 before); Lifetime is $99.99 (from 1.1). Null for a plan it does not know.
 */
export function listPrice(plan: string | null, at: number): number | null {
  const raised = dayOf(at) >= '2026-10-02'
  switch (plan) {
    case 'yearly':
      return raised ? 29.99 : 19.99
    case 'weekly':
      return raised ? 3.99 : 1.99
    case 'lifetime':
      return 99.99
    default:
      return null
  }
}

/** "$29.99" · "$1,049.50". */
export function money(dollars: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dollars)
}

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
  | { kind: 'price'; at: number; forGrownUp: boolean; closedAfter: number | null; shown: PaywallShown | null }
  /** A purchase: a free week of the yearly plan (`trial`), or a plan paid for now, at its list price. */
  | { kind: 'bought'; at: number; trial: boolean; plan: string | null; price: number | null }
  | { kind: 'later'; at: number }

/** Superwall's paywall, as shown once: which test version, where it was asked for, and what came of it. */
export interface PaywallShown {
  placement: string | null
  paywall: string | null
  variant: string | null
  /** Buy was tapped, and Apple's payment sheet came up. */
  tappedBuy: boolean
  /** Apple's sheet was closed without paying. */
  cancelled: boolean
}

/** A child's way to the grown-ups' paywall in one session. */
export interface GrownUpWay {
  /** "This part is for a grown-up", seen. */
  views: number
  /** The grown-ups' check, opened. */
  checks: number
  /** It was passed: the grown-up's paywall came up. */
  passed: boolean
  /** Where they met it (`onboarding`, `premium_lesson`, `settings`…), in order, each once. */
  entries: string[]
}

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
  | { kind: 'bought'; trial: boolean }
  | { kind: 'duringOnboarding' }
  | { kind: 'afterOnboarding' }
  | { kind: 'openedOnly' }

/** A line of an opened session: what happened, in words. */
export interface TimelineLine {
  at: number
  text: string
  lesson: string | null
  mark: 'quiet' | 'started' | 'finished' | 'price' | 'grownUp' | 'kept' | 'crown' | 'wish' | 'bought'
  /** Superwall's paywall, for its name beside the line. */
  shown?: PaywallShown
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
  /** The Apple Ads campaign and keyword that brought them, when Apple said. */
  ad: AdSource | null
  /** ISO code ("US"), when known (`countryOf`). */
  country: string | null
  /** The app version they used in the period. */
  version: string | null
  /** A child's way to the grown-ups' paywall, when they met "This part is for a grown-up". */
  grownUp: GrownUpWay | null
  /** Installed in this period. */
  isNew: boolean
  /** The times later visits began, after a pause of half an hour or more. */
  returns: number[]
  /** Summed over its visits. */
  activeMs: number
  finished: number
  /** Photos kept. */
  kept: number
  /** Who they are on this page: their animal (`animalsFor`). */
  animal?: Animal
  /** Their avatar's color on this page (0 to AVATAR_COLORS − 1), by their order, so neighbors differ. */
  color?: number
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
  let grownUp: GrownUpWay | null = null
  const lastShown = () =>
    ([...items].reverse().find((item) => item.kind === 'price' && item.shown) as Extract<SessionItem, { kind: 'price' }> | undefined)
      ?.shown
  const lastPurchase = () =>
    [...items].reverse().find((item) => item.kind === 'bought') as Extract<SessionItem, { kind: 'bought' }> | undefined
  /**
   * The free week started (at `previous`, the event being read): the purchase just made was
   * its, or its purchase is on its way, and joins it (`purchase_attempted` below).
   */
  const markTrial = () => {
    const recent = lastPurchase()
    if (recent && previous - recent.at < PURCHASE_WINDOW_MS) {
      if (!recent.trial) {
        recent.trial = true
        recent.plan = recent.plan ?? 'yearly'
        recent.price = listPrice('yearly', recent.at)
      }
      return
    }
    items.push({ kind: 'bought', at: previous, trial: true, plan: null, price: listPrice('yearly', previous) })
  }
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
          grownUp ??= { views: 0, checks: 0, passed: false, entries: [] }
          grownUp.views += 1
          if (event.entry && !grownUp.entries.includes(event.entry)) grownUp.entries.push(event.entry)
          line('Saw “This part is for a grown-up”', 'grownUp')
        } else if (screen === 'parental_check') {
          grownUp ??= { views: 0, checks: 0, passed: false, entries: [] }
          grownUp.checks += 1
          line(grownUp.checks > 1 ? `Saw the grown-ups’ check again (${ordinal(grownUp.checks)} time)` : 'Saw the grown-ups’ check', 'grownUp')
        } else if (ENDS_ON_PRICE.has(screen)) {
          const forGrownUp = screen === 'grown_up_paywall'
          if (forGrownUp) {
            grownUp ??= { views: 0, checks: 0, passed: false, entries: [] }
            grownUp.passed = true
          }
          items.push({ kind: 'price', at: event.at, forGrownUp, closedAfter: null, shown: null })
          line(forGrownUp ? 'Passed the check: the grown-up’s paywall' : 'Saw the paywall', 'price')
        } else if (screen === 'sketchbook_tour') {
          line('Saw the sketchbook tour')
        } else if (screen === 'more_coming') {
          line('Saw “More coming”')
        } else if (screen === 'trial_started') {
          markTrial()
          line('Saw “Your free week has started”', 'bought')
        } else if (screen === 'pending') {
          line('Waiting for a grown-up’s approval')
        }
        break
      }
      case 'superwall_paywall_open': {
        const shown: PaywallShown = {
          placement: event.placement ?? null,
          paywall: event.paywall ?? null,
          variant: event.variant ?? null,
          tappedBuy: false,
          cancelled: false,
        }
        items.push({ kind: 'price', at: event.at, forGrownUp: false, closedAfter: null, shown })
        timeline.push({ at: event.at, text: 'Paywall opened', lesson: null, mark: 'price', shown })
        break
      }
      case 'superwall_transaction_start': {
        const shown = lastShown()
        if (shown) shown.tappedBuy = true
        line('Tapped buy: Apple’s payment sheet came up', 'price')
        break
      }
      case 'superwall_transaction_abandon': {
        const shown = lastShown()
        if (shown) shown.cancelled = true
        break
      }
      case 'superwall_paywall_close': {
        const price = [...items].reverse().find((item) => item.kind === 'price') as
          | Extract<SessionItem, { kind: 'price' }>
          | undefined
        if (price && price.closedAfter === null) price.closedAfter = event.at - price.at
        line(price ? `Closed the paywall after ${spoken(event.at - price.at)}` : 'Closed the paywall', 'price')
        break
      }
      case 'superwall_free_trial_start':
        markTrial()
        break
      case 'purchase_attempted': {
        // `plan` rides on the event as `plan`; restoring is not buying.
        const plan = event.plan ?? null
        if (event.outcome === 'purchased' && plan !== 'restore') {
          const waiting = lastPurchase()
          if (waiting && waiting.trial && waiting.plan === null && event.at - waiting.at < PURCHASE_WINDOW_MS) {
            // The free week was announced first; this is its purchase.
            waiting.plan = plan
            waiting.price = listPrice(plan, waiting.at)
          } else {
            items.push({ kind: 'bought', at: event.at, trial: false, plan, price: listPrice(plan, event.at) })
          }
          line(`Bought Premium${plan ? `, ${plan}` : ''}`, 'bought')
        } else if (event.outcome && plan !== 'restore') {
          line(`Tried to buy Premium${plan ? `, ${plan}` : ''}: ${event.outcome}`, 'price')
        } else if (plan === 'restore') {
          line(`Restored purchases: ${event.outcome ?? 'tried'}`, 'quiet')
        }
        break
      }
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
    ad: adOf(learner.events),
    country: countryOf(learner.events),
    version: versionOf(events),
    grownUp,
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
      return { kind: 'bought', trial: lastItem.trial }
    case 'onboarding':
      return { kind: 'afterOnboarding' }
  }
}

/** How many avatar colors the page has. */
export const AVATAR_COLORS = 8


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
      return end.trial ? 'Started a free week' : 'Bought Premium'
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
  key: 'installs' | 'sessions' | 'lessons' | 'photos' | 'price' | 'trials' | 'buys'
  label: string
  value: number
  previous: number
  sub: string
  /** Dollars, for the trials and the buys: at the plans' US list prices. */
  amount?: number
}

/** How long a number that changed stays marked on the page: the creator picks, five minutes at first. */
export const MARK_CHOICES = [60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000, 60 * 60_000] as const
export const DEFAULT_MARK_MS = 5 * 60_000
const LONGEST_MARK_MS = MARK_CHOICES[MARK_CHOICES.length - 1]

/** "1 min", "1 hour". */
export function markWords(ms: number): string {
  return ms >= 60 * 60_000 ? `${ms / (60 * 60_000)} hour` : `${ms / 60_000} min`
}

/** A number that moved: from what, to what, and between which two looks. */
export interface NumberChange {
  from: number
  to: number
  /** When the page last saw it at `from`. */
  since: number
  /** When the page first saw it at `to`. */
  at: number
}

/** What the page last saw of one view's numbers, kept in the browser between visits. */
export interface SeenNumbers {
  values: Record<string, number>
  seenAt: number
  changes: Record<string, NumberChange>
}

/**
 * The numbers of a view, noted against what was last seen of it: a number that moved is
 * marked for `keepFor`, one that moves again in that time keeps where it started, and one
 * that comes back to where it started is no longer marked. Nothing is marked the first time
 * a view is seen. A change is remembered for the longest choice, so a longer one picked
 * later still shows it.
 */
export function noteNumbers(
  seen: SeenNumbers | undefined,
  numbers: readonly { key: string; value: number }[],
  now: number,
  keepFor: number = DEFAULT_MARK_MS,
): SeenNumbers {
  const changes: Record<string, NumberChange> = {}
  for (const { key, value } of numbers) {
    const kept = seen?.changes[key]
    const marked = kept && now - kept.at < keepFor ? kept : undefined
    const remembered = kept && now - kept.at < Math.max(keepFor, LONGEST_MARK_MS) ? kept : undefined
    const before = seen?.values[key]
    if (seen === undefined || before === undefined || before === value) {
      if (remembered) changes[key] = remembered
      continue
    }
    const from = marked ? marked.from : before
    if (from !== value) changes[key] = { from, to: value, since: marked ? marked.since : seen.seenAt, at: now }
  }
  return { values: Object.fromEntries(numbers.map(({ key, value }) => [key, value])), seenAt: now, changes }
}

/** The changes still marked at `now`. */
export function markedChanges(
  changes: Record<string, NumberChange>,
  now: number,
  keepFor: number = DEFAULT_MARK_MS,
): Record<string, NumberChange> {
  return Object.fromEntries(Object.entries(changes).filter(([, change]) => now - change.at < keepFor))
}

export interface JourneyStage {
  key: Stage
  label: string
  children: number
  teens: number
  /** Got this far and no further: the drop to the next stage. Zero for the last. */
  stopped: number
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
  /** Where the period's learners came from, before `where` narrows them, so each row stays a way in. */
  whereFrom: WhereFrom
  /** The period's learners by age band, before `age` narrows them: the six bands always, the rest when there are any. */
  ages: (WhereRow & { age: AgeBand })[]
  /** What happened at the paywalls: Superwall's, version by version, and the children's way to the grown-ups'. */
  paywalls: PaywallReport
}

/** One test version of Superwall's paywall, where it was asked for: how it was met. */
export interface PaywallRow {
  key: string
  placement: string | null
  variant: string | null
  paywall: string | null
  opens: number
  learners: number
  /** The middle time from open to close, of those closed. */
  medianLookMs: number | null
  /** Closed within `QUICK_CLOSE_MS`. */
  quickCloses: number
  /** Buy tapped: Apple's payment sheet came up. */
  tappedBuy: number
  /** Closed Apple's sheet without paying. */
  cancelled: number
  /** Started a free week or bought, from it. */
  bought: number
}

export interface GrownUpReport {
  /** Learners who met "This part is for a grown-up". */
  met: number
  /** Who opened the grown-ups' check. */
  triedCheck: number
  /** Opened more than once. */
  triedAgain: number
  /** Who passed it: the grown-up's paywall came up. */
  passed: number
  /** Who then started a free week or bought. */
  bought: number
  /** Where they met it, most first. */
  entries: { entry: string; learners: number }[]
}

export interface PaywallReport {
  rows: PaywallRow[]
  grownUps: GrownUpReport
}

/** A paywall closed this fast was dismissed, not read. */
export const QUICK_CLOSE_MS = 5_000

/** A row of Where from: how many learners, and what they did. */
export interface WhereRow {
  key: Where
  learners: number
  /** Lessons they finished. */
  finished: number
  /** Learners who reached a price. */
  sawPrice: number
  /** Learners who started a free week or bought a plan. */
  bought: number
}

export interface WhereFrom {
  /** By keyword (or by campaign, for Search Match), most learners first. */
  ads: (WhereRow & { ad: AdSource })[]
  organic: WhereRow
  countries: (WhereRow & { country: string | null })[]
  versions: (WhereRow & { version: string | null })[]
}

export interface ReportOptions {
  period: Period
  date: string
  who?: Who
  source?: Source
  /** Only the learners who finished this lesson in the period (and, for the comparison, in the one before). */
  lesson?: string | null
  /**
   * Only the learners one of the numbers counts: the journey, the lessons drawn most, the
   * leaders and the sessions narrow, and the numbers stay as they are, so each still says
   * how many there are of its kind.
   */
  only?: Only | null
  /** Only the learners from one place (`Where`); like `lesson`, the numbers narrow with it. */
  where?: Where | null
  /** Only the learners of one age band; the numbers narrow with it too. */
  age?: AgeBand | null
  now?: number
}

const MOST_DRAWN = 12
const LEADERS = 10

/**
 * Everything the page shows for one period, from the events of that period and the
 * one before it (for the numbers' comparison). `who` and `source` narrow it to
 * children or 13+, and to Apple Ads or the rest; `lesson` to those who finished it;
 * `only` to those one number counts.
 */
export function buildReport(events: LearnerEvent[], options: ReportOptions): LearnersReport {
  const { period, date, who = 'all', source = 'all', lesson = null, only = null, where = null, age = null, now = Date.now() } = options
  const { from, to } = periodRange(period, date)
  const before = periodRange(period, stepPeriod(period, date, -1))
  const everybody = stitch(events)
  // Animals and colors in the order learners first opened the app in the period, among
  // everybody, before any narrowing: a learner keeps theirs whatever the page is narrowed to.
  const firstIn = (learner: Learner) =>
    learner.events.find((event) => {
      const day = dayOf(event.at)
      return day >= from && day < to
    })?.at
  const inOrder = everybody
    .map((learner) => ({ key: learner.key, at: firstIn(learner), child: isChildAge(ageOf(learner.events)) }))
    .filter((entry): entry is { key: string; at: number; child: boolean } => entry.at !== undefined)
    .sort((a, b) => a.at - b.at)
  const place = new Map(inOrder.map((entry, index) => [entry.key, index]))
  const animals = animalsFor(inOrder)
  const learners = everybody.filter((learner) => {
    const age = ageOf(learner.events)
    if (who === 'children' && !isChildAge(age)) return false
    if (who === 'teens' && isChildAge(age)) return false
    if (who === 'adults' && age !== '18plus') return false
    if (source !== 'all' && sourceOf(learner.events) !== source) return false
    return true
  })

  /** The learners of a range, narrowed; `whole` leaves one narrowing out, for the panel that is its way in. */
  const inRange = (range: { from: string; to: string }, whole: 'where' | 'age' | null = null) =>
    learners
      .map((learner) => ({
        learner,
        events: learner.events.filter((event) => {
          const day = dayOf(event.at)
          return day >= range.from && day < range.to
        }),
      }))
      .filter((entry) => entry.events.length > 0)
      .filter(
        (entry) =>
          !lesson || entry.events.some((event) => event.event === 'lesson_completed' && event.lesson === lesson),
      )
      .filter((entry) => whole === 'where' || !where || matchesWhere(entry.learner.events, entry.events, where))
      .filter((entry) => whole === 'age' || !age || ageBandOf(entry.learner.events) === age)

  const everyone = inRange({ from, to })
  const everySession = everyone.map((entry) => buildSession(entry.learner, entry.events, now))
  for (const session of everySession) {
    const index = place.get(session.key) ?? 0
    session.animal = animals.get(session.key)
    session.color = index % AVATAR_COLORS
  }
  const previous = inRange(before).map((entry) => buildSession(entry.learner, entry.events, now))
  const previousEvents = inRange(before).flatMap((entry) => entry.events)
  const numbers = numbersOf(everySession, everyone.flatMap((entry) => entry.events), previous, previousEvents)

  const kept = everySession.map((session) => !only || counts(session, only))
  const sessions = everySession.filter((_, index) => kept[index])
  const current = everyone.filter((_, index) => kept[index])

  return {
    period,
    date,
    from,
    to,
    numbers,
    // Like the numbers, the journey is a way in, so it stays whole.
    journey: journeyOf(everySession),
    mostDrawn: mostDrawnOf(current.flatMap((entry) => entry.events)),
    sessions: period === 'day' ? [...sessions].sort((a, b) => b.start - a.start) : [],
    days: period === 'day' ? [] : daysOf(from, to, current),
    leaders: leadersOf(sessions),
    paywalls: paywallsOf(everySession),
    // Each way in stays whole on its own narrowing and follows the other: ages from one keyword, keywords of one age.
    whereFrom: whereFromOf(where ? inRange({ from, to }, 'where').map((entry) => buildSession(entry.learner, entry.events, now)) : everySession),
    ages: agesOf(age ? inRange({ from, to }, 'age').map((entry) => buildSession(entry.learner, entry.events, now)) : everySession),
  }
}

/** What happened at the paywalls in these sessions. */
export function paywallsOf(sessions: LearnerSession[]): PaywallReport {
  const rows = new Map<string, PaywallRow & { looks: number[]; who: Set<string> }>()
  const grownUps: GrownUpReport = { met: 0, triedCheck: 0, triedAgain: 0, passed: 0, bought: 0, entries: [] }
  const entries = new Map<string, number>()
  for (const session of sessions) {
    session.items.forEach((item, index) => {
      if (item.kind !== 'price' || !item.shown) return
      const { placement, variant, paywall } = item.shown
      const key = `${placement ?? ''}|${variant ?? paywall ?? ''}`
      if (!rows.has(key)) {
        rows.set(key, {
          key,
          placement,
          variant,
          paywall,
          opens: 0,
          learners: 0,
          medianLookMs: null,
          quickCloses: 0,
          tappedBuy: 0,
          cancelled: 0,
          bought: 0,
          looks: [],
          who: new Set(),
        })
      }
      const row = rows.get(key)!
      row.opens += 1
      row.who.add(session.key)
      if (item.closedAfter !== null) {
        row.looks.push(item.closedAfter)
        if (item.closedAfter < QUICK_CLOSE_MS) row.quickCloses += 1
      }
      if (item.shown.tappedBuy) row.tappedBuy += 1
      if (item.shown.cancelled) row.cancelled += 1
      // A purchase counts for the last paywall before it.
      const next = session.items.slice(index + 1).find((later) => later.kind === 'price' || later.kind === 'bought')
      if (next?.kind === 'bought') row.bought += 1
    })
    const way = session.grownUp
    if (way) {
      grownUps.met += 1
      if (way.checks > 0) grownUps.triedCheck += 1
      if (way.checks > 1) grownUps.triedAgain += 1
      if (way.passed) grownUps.passed += 1
      if (way.passed && session.items.some((item) => item.kind === 'bought')) grownUps.bought += 1
      for (const entry of way.entries) entries.set(entry, (entries.get(entry) ?? 0) + 1)
    }
  }
  grownUps.entries = [...entries.entries()].map(([entry, learners]) => ({ entry, learners })).sort((a, b) => b.learners - a.learners)
  return {
    rows: [...rows.values()]
      .map(({ looks, who, ...row }) => ({ ...row, learners: who.size, medianLookMs: median(looks) }))
      .sort(
        (a, b) =>
          (a.placement ?? '').localeCompare(b.placement ?? '') || b.opens - a.opens || (a.variant ?? '').localeCompare(b.variant ?? ''),
      ),
    grownUps,
  }
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

const emptyRow = (key: string): WhereRow => ({ key, learners: 0, finished: 0, sawPrice: 0, bought: 0 })

/** Counts a session into a row of Where from or Ages. */
function addTo(into: WhereRow, session: LearnerSession) {
  into.learners += 1
  into.finished += session.finished
  if (session.items.some((item) => item.kind === 'price')) into.sawPrice += 1
  if (session.items.some((item) => item.kind === 'bought')) into.bought += 1
}

/** Learners by age band, youngest first; "age not said" and no answer only when someone is in them. */
export function agesOf(sessions: LearnerSession[]): (WhereRow & { age: AgeBand })[] {
  const rows = AGE_BANDS.map((age) => ({ ...emptyRow(age), age }))
  for (const session of sessions) addTo(rows[AGE_BANDS.indexOf(session.age && isAgeBand(session.age) ? session.age : 'none')], session)
  return rows.filter((row) => row.learners > 0 || (row.age !== 'preferNotToSay' && row.age !== 'none'))
}

/** Where from: learners counted by ad keyword, organic, country and app version. */
export function whereFromOf(sessions: LearnerSession[]): WhereFrom {
  const row = emptyRow
  const add = addTo
  const ads = new Map<Where, WhereRow & { ad: AdSource }>()
  const countries = new Map<string, WhereRow & { country: string | null }>()
  const versions = new Map<string, WhereRow & { version: string | null }>()
  const organic = row('organic')
  for (const session of sessions) {
    if (session.ad) {
      const key = adKey(session.ad)
      if (!ads.has(key)) ads.set(key, { ...row(key), ad: session.ad })
      add(ads.get(key)!, session)
    } else if (session.source === 'organic') {
      add(organic, session)
    }
    const country = session.country ?? 'unknown'
    if (!countries.has(country)) countries.set(country, { ...row(`country-${country}`), country: session.country })
    add(countries.get(country)!, session)
    const version = session.version ?? 'unknown'
    if (!versions.has(version)) versions.set(version, { ...row(`version-${version}`), version: session.version })
    add(versions.get(version)!, session)
  }
  const most = <Row extends WhereRow>(rows: Iterable<Row>) => [...rows].sort((a, b) => b.learners - a.learners || b.finished - a.finished)
  return { ads: most(ads.values()), organic, countries: most(countries.values()), versions: most(versions.values()) }
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
  /** Paid for a plan. */
  bought: boolean
  /** Started a free week. */
  trialed: boolean
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
    bought: sessions.some((session) => session.items.some((item) => item.kind === 'bought' && !item.trial)),
    trialed: sessions.some((session) => session.items.some((item) => item.kind === 'bought' && item.trial)),
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
  const purchases = (list: LearnerSession[], trial: boolean) =>
    list.flatMap((session) =>
      session.items.filter((item): item is Extract<SessionItem, { kind: 'bought' }> => item.kind === 'bought' && item.trial === trial),
    )
  const trials = purchases(sessions, true)
  const buys = purchases(sessions, false)
  const dollars = (list: { price: number | null }[]) => list.reduce((total, item) => total + (item.price ?? 0), 0)
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
      key: 'trials',
      label: 'Free trials',
      value: trials.length,
      previous: previousOf((list) => purchases(list, true).length),
      amount: dollars(trials),
      sub: 'a year, if kept',
    },
    {
      key: 'buys',
      label: 'Buys',
      value: buys.length,
      previous: previousOf((list) => purchases(list, false).length),
      amount: dollars(buys),
      sub: 'at US list price',
    },
  ]
}

const STAGE_LABELS: Record<Stage, string> = {
  installed: 'Installed',
  onboarded: 'Finished onboarding',
  first: 'First drawing',
  second: 'Second drawing',
  price: 'Saw a price',
  bought: 'Started a trial or bought',
}

function journeyOf(sessions: LearnerSession[]): JourneyStage[] {
  return STAGES.map((key) => {
    const passed = sessions.filter((session) => reached(session, key))
    const next = nextStage(key)
    return {
      key,
      label: STAGE_LABELS[key],
      children: passed.filter((session) => session.child).length,
      teens: passed.filter((session) => !session.child).length,
      stopped: next ? passed.filter((session) => !reached(session, next)).length : 0,
    }
  })
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
