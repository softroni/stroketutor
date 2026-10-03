import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'

import { readAdNames, readLearnerHistory, readLearners, readPaywallNames } from './api'
import { FinishedDrawing } from './FinishedDrawing'
import {
  adKey,
  ageLabel,
  buildHistory,
  isChildAge,
  buildReport,
  compared,
  dayOf,
  DEFAULT_MARK_MS,
  endLesson,
  endWords,
  finishedLessons,
  lastedFor,
  learnerTag,
  LEARNERS_TIME_ZONE_NAME,
  MARK_CHOICES,
  markedChanges,
  markWords,
  noteNumbers,
  type NumberChange,
  type SeenNumbers,
  periodLabel,
  periodRange,
  type LearnerHistory,
  PERIODS,
  money,
  type Only,
  previousLabel,
  spoken,
  stepPeriod,
  timeOf,
  timeWithSeconds,
  type AdNames,
  type AdSource,
  type AgeBand,
  type DaySummary,
  type PaywallNames,
  type PaywallReport,
  type PaywallShown,
  QUICK_CLOSE_MS,
  type LearnersReport,
  type LearnersResponse,
  type LearnerSession,
  type Period,
  type ReportNumber,
  type SessionItem,
  type Source,
  type TimelineLine,
  type Where,
  type WhereFrom,
  type WhereRow,
  type Who,
} from './learners'
import type { Library } from './library'
import { routeHref } from './route'

/**
 * How often a period that reaches today asks again, while the page is in view: a day every
 * minute, a week or a month every five (they pull far more rows). The server keeps PostHog's
 * answer just as long (`web/server/learners.ts`), and a tab in the background asks nothing.
 */
const DAY_REFRESH_MS = 60_000
const LONG_REFRESH_MS = 5 * 60_000
/** Refresh asks the server past its copy, which it allows once every 15 seconds. */
const REFRESH_FLOOR_MS = 15_000

const PERIOD_NAMES: Record<Period, string> = { day: 'Day', week: 'Week', month: 'Month' }
const WHO_NAMES: Record<Who, string> = { all: 'Everyone', children: 'Children', teens: '13+', adults: '18+' }
const SOURCE_NAMES: Record<Source, string> = { all: 'All sources', ads: 'Apple Ads', organic: 'Organic' }

interface EventsState {
  range: string
  response: LearnersResponse | null
  error: string | null
  /** When the browser last had an answer, for "Updated 40 s ago". */
  loadedAt: number | null
  loading: boolean
}

/**
 * The events of a period and the one before it. While the period reaches today and the
 * page is in view, they are asked for again every minute (a week or a month: every five
 * minutes), and at once when the page comes back into view after that long. `refresh`
 * asks PostHog straight away.
 */
export function useLearnerEvents(period: Period, day: string, available: boolean) {
  const from = periodRange(period, stepPeriod(period, day, -1)).from
  const to = periodRange(period, day).to
  const range = `${from}|${to}`
  const every = period === 'day' ? DAY_REFRESH_MS : LONG_REFRESH_MS
  const [state, setState] = useState<EventsState>({ range, response: null, error: null, loadedAt: null, loading: false })

  const load = useCallback(
    async (fresh = false) => {
      setState((previous) => ({ ...previous, loading: true }))
      try {
        const response = await readLearners(from, to, fresh)
        setState({ range, response, error: null, loadedAt: Date.now(), loading: false })
      } catch (caught) {
        setState((previous) => ({
          range,
          response: previous.range === range ? previous.response : null,
          error: caught instanceof Error ? caught.message : String(caught),
          loadedAt: previous.range === range ? previous.loadedAt : null,
          loading: false,
        }))
      }
    },
    [from, to, range],
  )

  useEffect(() => {
    if (!available) return
    void load()
    if (to <= dayOf(Date.now())) return
    let last = Date.now()
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      last = Date.now()
      void load()
    }
    const timer = window.setInterval(tick, every)
    // Back from the background, or another app: catch up at once if a turn was missed.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - last >= every) tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [available, load, to, every])

  const refresh = useCallback(() => void load(true), [load])
  // What was asked for another range is not this one's.
  const current = state.range === range ? state : { range, response: null, error: null, loadedAt: null, loading: false }
  return { ...current, refresh, live: to > dayOf(Date.now()), every }
}

const SEEN_STORE = 'st-learners-seen'
const MARK_STORE = 'st-learners-mark'
const FORGET_VIEWS_MS = 2 * 86_400_000

function readStore<Value>(key: string, fallback: Value): Value {
  try {
    const kept = window.localStorage.getItem(key)
    return kept === null ? fallback : (JSON.parse(kept) as Value)
  } catch {
    return fallback
  }
}

function writeStore(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // A full or blocked store only means changes go unmarked.
  }
}

/** How long a changed number stays highlighted, as last picked in this browser. */
export function useMarkFor(): [number, (ms: number) => void] {
  const [markFor, setMarkFor] = useState(() => {
    const kept = readStore<number>(MARK_STORE, DEFAULT_MARK_MS)
    return (MARK_CHOICES as readonly number[]).includes(kept) ? kept : DEFAULT_MARK_MS
  })
  const pick = useCallback((ms: number) => {
    setMarkFor(ms)
    writeStore(MARK_STORE, ms)
  }, [])
  return [markFor, pick]
}

/**
 * The numbers of a view that changed since the page last saw them, for `markFor`. What
 * was seen is kept in the browser, per view (period, day and narrowing), so numbers that
 * moved while the page was elsewhere or closed are marked when it comes back.
 */
export function useNumberChanges(
  view: string,
  numbers: readonly { key: string; value: number }[] | null,
  markFor: number,
): Record<string, NumberChange> {
  const [noted, setNoted] = useState<{ view: string; changes: Record<string, NumberChange> } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!numbers) return
    const at = Date.now()
    const seen = readStore<Record<string, SeenNumbers>>(SEEN_STORE, {})
    const next = noteNumbers(seen[view], numbers, at, markFor)
    seen[view] = next
    for (const [key, kept] of Object.entries(seen)) if (at - kept.seenAt > FORGET_VIEWS_MS) delete seen[key]
    writeStore(SEEN_STORE, seen)
    setNoted({ view, changes: next.changes })
    setNow(at)
  }, [view, numbers, markFor])
  const changes = noted?.view === view ? markedChanges(noted.changes, now, markFor) : {}
  const marked = Object.keys(changes).length
  // While something is marked, look again now and then so the mark goes when its time is up.
  useEffect(() => {
    if (!marked) return
    const timer = window.setInterval(() => setNow(Date.now()), 10_000)
    return () => window.clearInterval(timer)
  }, [marked])
  return changes
}

const NO_NAMES: AdNames = { campaigns: {}, adGroups: {}, keywords: {} }
/** The names behind Apple Ads' ids, asked for once per visit to the page. */
const AdNamesContext = createContext<AdNames>(NO_NAMES)

function useAdNames(available: boolean): { names: AdNames; problem: string | null } {
  const [state, setState] = useState<{ names: AdNames; problem: string | null }>({ names: NO_NAMES, problem: null })
  useEffect(() => {
    if (!available) return
    let live = true
    readAdNames()
      .then((response) => live && setState({ names: response.names, problem: response.problem }))
      .catch((error: unknown) => live && setState({ names: NO_NAMES, problem: error instanceof Error ? error.message : String(error) }))
    return () => {
      live = false
    }
  }, [available])
  return state
}

const NO_PAYWALL_NAMES: PaywallNames = { paywalls: {}, variants: {}, placements: {} }
/** The names behind Superwall's paywall and test-version ids, asked for once per visit to the page. */
const PaywallNamesContext = createContext<PaywallNames>(NO_PAYWALL_NAMES)

function usePaywallNames(available: boolean): { names: PaywallNames; problem: string | null } {
  const [state, setState] = useState<{ names: PaywallNames; problem: string | null }>({ names: NO_PAYWALL_NAMES, problem: null })
  useEffect(() => {
    if (!available) return
    let live = true
    readPaywallNames()
      .then((response) => live && setState({ names: response.names, problem: response.problem }))
      .catch((error: unknown) => live && setState({ names: NO_PAYWALL_NAMES, problem: error instanceof Error ? error.message : String(error) }))
    return () => {
      live = false
    }
  }, [available])
  return state
}

const PLACEMENT_WORDS: Record<string, string> = {
  onboarding_offer: 'after onboarding',
  premium_lesson: 'a locked lesson',
  settings_premium: 'Settings',
}

const ENTRY_WORDS: Record<string, string> = {
  onboarding: 'after onboarding',
  premium_lesson: 'a locked lesson',
  settings: 'Settings',
  wish_list: 'the wish list',
  sketchbook: 'the sketchbook',
}

/** "Flow 1", or the identifier when Superwall's names are missing. */
function paywallWords(names: PaywallNames, shown: { variant: string | null; paywall: string | null }): string {
  return (shown.variant && names.variants[shown.variant]?.paywall) || (shown.paywall && names.paywalls[shown.paywall]) || shown.paywall || 'a paywall'
}

/** "Flow 1, after onboarding (Onboarding offer test, 33%)". */
function shownWords(names: PaywallNames, shown: PaywallShown): string {
  const version = shown.variant ? names.variants[shown.variant] : undefined
  const where = shown.placement ? PLACEMENT_WORDS[shown.placement] ?? shown.placement : null
  return `${paywallWords(names, shown)}${where ? `, ${where}` : ''}${version ? ` (${version.campaign} test, ${version.share}%)` : ''}`
}

/** A campaign's name without Paper Coach's own prefix: "PC - US - Category" → "US - Category". */
function campaignWords(names: AdNames, campaign: string): string {
  const name = names.campaigns[campaign]
  return name ? name.replace(/^PC\s*-\s*/, '') : `campaign ${campaign}`
}

/** "“how to draw app”", or "Search Match" when Apple picked the search. */
function keywordWords(names: AdNames, ad: AdSource): string {
  if (!ad.keyword) return 'Search Match'
  const keyword = names.keywords[ad.keyword]
  return keyword ? `“${keyword.text}”` : `keyword ${ad.keyword}`
}

const regionNames = new Intl.DisplayNames(['en-US'], { type: 'region' })

/** 🇺🇸 from "US". */
function flagOf(country: string): string {
  return /^[A-Z]{2}$/.test(country) ? String.fromCodePoint(...[...country].map((letter) => 0x1f1a5 + letter.charCodeAt(0))) : ''
}

function countryWords(country: string | null): string {
  if (!country) return 'Not sent'
  try {
    return regionNames.of(country) ?? country
  } catch {
    return country
  }
}

/** What a `?where=` narrowing reads as: "from “how to draw app”", "in United States", "on 1.0". */
function whereWords(names: AdNames, where: Where): string {
  if (where === 'organic') return 'not from Apple Ads'
  if (where.startsWith('keyword-')) {
    const keyword = names.keywords[where.slice('keyword-'.length)]
    return `from ${keyword ? `“${keyword.text}”` : `keyword ${where.slice('keyword-'.length)}`}`
  }
  if (where.startsWith('campaign-')) return `from ${campaignWords(names, where.slice('campaign-'.length))}`
  if (where.startsWith('country-')) {
    const country = where.slice('country-'.length)
    return country === 'unknown' ? 'whose country was not sent' : `in ${countryWords(country)}`
  }
  const version = where.slice('version-'.length)
  return version === 'unknown' ? 'on an unknown version' : `on ${version}`
}

/** "+2", "−1". */
function signed(difference: number): string {
  return difference > 0 ? `+${difference}` : `−${-difference}`
}

/** "19 at 3:40 PM, 21 at 3:41 PM". */
function changeWords(change: NumberChange): string {
  return `${change.from} at ${timeOf(change.since)}, ${change.to} at ${timeOf(change.at)}`
}

/**
 * "Updated 40 s ago · every minute · Refresh": how fresh the page is, and the way to ask
 * again now (not more than once every 15 seconds, as the server allows).
 */
function Freshness({
  loadedAt,
  loading,
  live,
  every,
  onRefresh,
  markFor,
  onMarkFor,
}: {
  loadedAt: number | null
  loading: boolean
  live: boolean
  every: number
  onRefresh: () => void
  markFor: number
  onMarkFor: (ms: number) => void
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5_000)
    return () => window.clearInterval(timer)
  }, [])
  const age = loadedAt === null ? null : Math.max(0, now - loadedAt)
  const ago = age === null ? '' : age < 10_000 ? 'just now' : age < 60_000 ? `${Math.floor(age / 1000)} s ago` : `${Math.floor(age / 60_000)} min ago`
  const tooSoon = age !== null && age < REFRESH_FLOOR_MS
  return (
    <span className="st-learners__freshness">
      {/* The minute's update runs quietly: only the first load says so. */}
      {age === null ? (loading ? 'Updating…' : null) : `Updated ${ago}`}
      {live ? <span className="st-learners__muted"> · every {every === DAY_REFRESH_MS ? 'minute' : '5 minutes'}</span> : null}{' '}
      <button type="button" onClick={onRefresh} disabled={loading || tooSoon} title={tooSoon ? 'Just updated' : 'Ask PostHog now'}>
        Refresh
      </button>
      <label className="st-learners__mark-for">
        <span className="st-learners__muted">Highlight changes</span>
        <select value={markFor} onChange={(event) => onMarkFor(Number(event.target.value))}>
          {MARK_CHOICES.map((ms) => (
            <option key={ms} value={ms}>
              {markWords(ms)}
            </option>
          ))}
        </select>
      </label>
    </span>
  )
}

/**
 * Learners: what people did in the app, for a day, a week or a month, read live from
 * PostHog (`web/server/learners.ts`). The numbers and the journey of the period's
 * installs on top, the lessons drawn most as pictures, then every session of the day
 * as a row of the lessons it drew (a week or a month: one column per day). A row
 * opens into a timeline in words. Children stay anonymous: an age band, times and
 * lessons, nothing else.
 */
export function LearnersView({
  period,
  date,
  lesson = null,
  only = null,
  where = null,
  age = null,
  library,
}: {
  period: Period
  date: string | null
  /** From the address (`?lesson=`): only the learners who finished it. */
  lesson?: string | null
  /** From the address (`?only=`): only the learners one number counts. */
  only?: Only | null
  /** From the address (`?where=`): only the learners from one ad keyword, country or app version. */
  where?: Where | null
  /** From the address (`?age=`): only the learners of one age band. */
  age?: AgeBand | null
  library: Library
}) {
  const today = dayOf(Date.now())
  const day = date ?? today
  const { response, error, loadedAt, loading, live, every, refresh } = useLearnerEvents(period, day, library.writable)
  const [who, setWho] = useState<Who>('all')
  const [source, setSource] = useState<Source>('all')
  const [opened, setOpened] = useState<string | null>(null)
  // A row opened on one day is not open on the next, nor in a week.
  useEffect(() => setOpened(null), [period, day])

  const report = useMemo(
    () =>
      response?.configured && response.events
        ? buildReport(response.events, { period, date: day, who, source, lesson, only, where, age, now: Date.now() })
        : null,
    [response, period, day, who, source, lesson, only, where, age],
  )
  const ads = useAdNames(library.writable)
  const paywallNames = usePaywallNames(library.writable)
  const [markFor, setMarkFor] = useMarkFor()
  // The numbers depend on the period, the day and the narrowing, but not on `only`.
  const changes = useNumberChanges(
    `${period}|${day}|${who}|${source}|${lesson ?? ''}${where ? `|${where}` : ''}${age ? `|age-${age}` : ''}`,
    report?.numbers ?? null,
    markFor,
  )
  /** The same view somewhere else: what is not named stays as it is, the lesson and the number it is narrowed to included. */
  const here = (next: {
    period?: Period
    date?: string | null
    lesson?: string | null
    only?: Only | null
    where?: Where | null
    age?: AgeBand | null
  }) => {
    const pickedLesson = next.lesson === undefined ? lesson : next.lesson
    const pickedOnly = next.only === undefined ? only : next.only
    const pickedWhere = next.where === undefined ? where : next.where
    const pickedAge = next.age === undefined ? age : next.age
    return routeHref({
      name: 'learners',
      period: next.period ?? period,
      date: next.date === undefined ? date : next.date,
      ...(pickedLesson ? { lesson: pickedLesson } : {}),
      ...(pickedOnly ? { only: pickedOnly } : {}),
      ...(pickedWhere ? { where: pickedWhere } : {}),
      ...(pickedAge ? { age: pickedAge } : {}),
    })
  }

  if (!library.writable) {
    return (
      <div className="st-learners">
        <h1 className="st-learners__title">Learners</h1>
        <p className="st-notice">The Learners page needs the Studio server. Run npm run dev.</p>
      </div>
    )
  }

  const next = stepPeriod(period, day, 1)
  const reachesToday = periodRange(period, day).to > today
  return (
    <div className="st-learners">
      <header className="st-learners__head">
        <div className="st-learners__heading">
          <h1 className="st-learners__title">Learners</h1>
          <p className="st-learners__byline">
            {response?.source === 'sample' ? <>Sample events (STUDIO_LEARNERS_SAMPLE), not PostHog’s.</> : <>From PostHog.</>}{' '}
            Days in {LEARNERS_TIME_ZONE_NAME}.{' '}
            {response?.configured ? (
              <Freshness
                loadedAt={loadedAt}
                loading={loading}
                live={live}
                every={every}
                onRefresh={refresh}
                markFor={markFor}
                onMarkFor={setMarkFor}
              />
            ) : null}
          </p>
        </div>
        <nav className="st-learners__period" aria-label="Period">
          <div className="st-learners__segments" role="group" aria-label="Show">
            {PERIODS.map((candidate) => (
              <a
                key={candidate}
                href={here({ period: candidate })}
                aria-current={candidate === period ? 'page' : undefined}
              >
                {PERIOD_NAMES[candidate]}
              </a>
            ))}
          </div>
          <div className="st-learners__stepper">
            <a
              href={here({ date: stepPeriod(period, day, -1) })}
              aria-label={`The ${period} before`}
            >
              ‹
            </a>
            <span className="st-learners__when">{periodLabel(period, day)}</span>
            {reachesToday ? (
              <span className="st-learners__step-off" aria-hidden="true">
                ›
              </span>
            ) : (
              <a href={here({ date: next > today ? null : next })} aria-label={`The ${period} after`}>
                ›
              </a>
            )}
            {reachesToday ? null : (
              <a className="st-learners__now" href={here({ date: null })}>
                {period === 'day' ? 'Today' : period === 'week' ? 'This week' : 'This month'}
              </a>
            )}
          </div>
        </nav>
      </header>

      <div className="st-learners__filters">
        <Chips label="Who" value={who} names={WHO_NAMES} onChange={setWho} />
        <Chips label="Source" value={source} names={SOURCE_NAMES} onChange={setSource} />
        {lesson ? (
          <a className="st-learners__drew" href={here({ lesson: null })} aria-label={`Stop showing only who drew ${titleOf(library, lesson)}`}>
            Drew <LessonPicture library={library} lesson={lesson} size="tiny" /> {titleOf(library, lesson)}
            <span aria-hidden="true">✕</span>
          </a>
        ) : null}
        {only ? (
          <a className="st-learners__drew" href={here({ only: null })} aria-label={`Stop showing only ${ONLY_WORDS[only]}`}>
            Only {ONLY_WORDS[only]}
            <span aria-hidden="true">✕</span>
          </a>
        ) : null}
        {age ? (
          <a className="st-learners__drew" href={here({ age: null })} aria-label={`Stop showing only ${bandWords(age)}`}>
            Only {bandWords(age)}
            <span aria-hidden="true">✕</span>
          </a>
        ) : null}
        {where ? (
          <a className="st-learners__drew" href={here({ where: null })} aria-label={`Stop showing only learners ${whereWords(ads.names, where)}`}>
            Only {whereWords(ads.names, where)}
            <span aria-hidden="true">✕</span>
          </a>
        ) : null}
      </div>

      {error ? <p className="st-notice">The Studio server did not answer: {error}</p> : null}
      {response && !response.configured ? <ConnectPostHog problem={response.problem} /> : null}
      {response?.configured && response.problem ? <p className="st-notice">{response.problem}</p> : null}
      {!response && !error ? <p className="st-learners__muted">Asking PostHog…</p> : null}

      {report ? (
        <AdNamesContext.Provider value={ads.names}>
        <PaywallNamesContext.Provider value={paywallNames.names}>
        <Picked.Provider value={lesson}>
          <Numbers
            report={report}
            only={only}
            changes={changes}
            href={(key) => here({ only: key === 'sessions' || key === only ? null : key })}
          />
          <div className="st-learners__pair">
            <Journey report={report} only={only} href={(next) => here({ only: next === only ? null : next })} />
            <MostDrawn report={report} library={library} picked={lesson} href={(drawn) => here({ lesson: drawn === lesson ? null : drawn })} />
          </div>
          <AtThePaywall paywalls={report.paywalls} problem={paywallNames.problem} />
          <div className="st-learners__pair st-learners__pair--who">
            <Ages ages={report.ages} picked={age} href={(next) => here({ age: next === age ? null : next })} />
            <WhereFromPanel
              whereFrom={report.whereFrom}
              picked={where}
              problem={ads.problem}
              href={(next) => here({ where: next === where ? null : next })}
            />
          </div>
          <Leaders
            report={report}
            library={library}
            opened={opened}
            onToggle={(key) => setOpened((current) => (current === key ? null : key))}
          />
          {period === 'day' ? (
            <Sessions
              sessions={report.sessions}
              library={library}
              opened={opened}
              onToggle={(key) => setOpened((current) => (current === key ? null : key))}
              empty={lesson || only || where || age ? 'Nobody like that on this day.' : 'Nobody opened the app on this day.'}
              whereHref={(next) => here({ where: next })}
            />
          ) : (
            <Days report={report} library={library} today={today} dayHref={(candidate) => here({ period: 'day', date: candidate })} />
          )}
        </Picked.Provider>
        </PaywallNamesContext.Provider>
        </AdNamesContext.Provider>
      ) : null}
    </div>
  )
}

/**
 * What happened at the paywalls: Superwall's (13 and over), test version by test version and
 * where it was asked for, with how long it was looked at and who tapped buy; and the
 * children's way to the grown-ups' paywall, through "This part is for a grown-up" and the
 * grown-ups' check. The A/B test is judged in Superwall by purchases per open; this is for
 * seeing what happens on the way.
 */
function AtThePaywall({ paywalls, problem }: { paywalls: PaywallReport; problem: string | null }) {
  const names = useContext(PaywallNamesContext)
  const groups = new Map<string, PaywallReport['rows']>()
  for (const row of paywalls.rows) {
    const campaign = (row.placement && names.placements[row.placement]) || (row.variant && names.variants[row.variant]?.campaign) || 'Superwall'
    groups.set(campaign, [...(groups.get(campaign) ?? []), row])
  }
  const way = paywalls.grownUps
  const steps = [
    { label: 'Met “This part is for a grown-up”', count: way.met },
    { label: 'Opened the grown-ups’ check', count: way.triedCheck, note: way.triedAgain ? `${way.triedAgain} tried again` : null },
    { label: 'Passed: the grown-ups’ paywall', count: way.passed },
    { label: 'Started a trial or bought', count: way.bought },
  ]
  const most = Math.max(1, way.met)
  return (
    <section className="st-learners__panel st-learners__paywalls" aria-labelledby="learners-paywalls">
      <div className="st-learners__panel-head">
        <h2 id="learners-paywalls" className="st-learners__h2">
          At the paywall
        </h2>
        <span className="st-learners__muted">What learners did when a price came up.</span>
      </div>
      <div className="st-learners__paywall-columns">
        <div>
          <h3 className="st-learners__where-title">13 and over: Superwall’s paywall</h3>
          {paywalls.rows.length ? (
            <table className="st-learners__paywall-table">
              <thead>
                <tr>
                  <th scope="col">Version</th>
                  <th scope="col">Shown</th>
                  <th scope="col" title="The middle time from open to close">
                    Looked
                  </th>
                  <th scope="col" title={`Closed within ${QUICK_CLOSE_MS / 1000} seconds`}>
                    Closed fast
                  </th>
                  <th scope="col" title="Apple’s payment sheet came up">
                    Tapped buy
                  </th>
                  <th scope="col">Bought</th>
                </tr>
              </thead>
              {[...groups.entries()].map(([campaign, rows]) => (
                <tbody key={campaign}>
                  <tr className="st-learners__paywall-group">
                    <th scope="rowgroup" colSpan={6}>
                      {campaign} test
                      <span>
                        {[...new Set(rows.map((row) => (row.placement ? PLACEMENT_WORDS[row.placement] ?? row.placement : null)).filter(Boolean))].join(', ')}
                      </span>
                    </th>
                  </tr>
                  {rows.map((row) => {
                    const version = row.variant ? names.variants[row.variant] : undefined
                    return (
                      <tr key={row.key}>
                        <th scope="row">
                          {paywallWords(names, row)}
                          {version ? <span className="st-learners__paywall-share">{version.share}%</span> : null}
                        </th>
                        <td>
                          {row.opens}
                          {row.learners !== row.opens ? <span className="st-learners__muted"> by {row.learners}</span> : null}
                        </td>
                        <td>{row.medianLookMs === null ? '–' : spoken(row.medianLookMs)}</td>
                        <td className={row.quickCloses ? 'st-learners__paywall-warn' : undefined}>{row.quickCloses}</td>
                        <td>
                          {row.tappedBuy}
                          {row.cancelled ? <span className="st-learners__muted"> ({row.cancelled} cancelled)</span> : null}
                        </td>
                        <td className={row.bought ? 'st-learners__paywall-good' : undefined}>{row.bought}</td>
                      </tr>
                    )
                  })}
                </tbody>
              ))}
            </table>
          ) : (
            <p className="st-learners__muted">Nobody 13 or over saw it in this period.</p>
          )}
          {problem ? <p className="st-learners__muted st-learners__where-note">Paywall names are missing: {problem}</p> : null}
        </div>
        <div>
          <h3 className="st-learners__where-title">Under 13: the way to a grown-up</h3>
          {way.met ? (
            <>
              <ol className="st-learners__way">
                {steps.map((step) => (
                  <li key={step.label}>
                    <span className="st-learners__way-label">{step.label}</span>
                    <span className="st-learners__way-bar" aria-hidden="true">
                      <span style={{ width: `${(step.count / most) * 100}%` }} />
                    </span>
                    <span className="st-learners__way-count">{step.count}</span>
                    {step.note ? <span className="st-learners__way-note">{step.note}</span> : null}
                  </li>
                ))}
              </ol>
              <p className="st-learners__muted st-learners__where-note">
                Met it {way.entries.map((entry) => `${ENTRY_WORDS[entry.entry] ?? entry.entry} (${entry.learners})`).join(', ')}.
              </p>
            </>
          ) : (
            <p className="st-learners__muted">No child met it in this period.</p>
          )}
        </div>
      </div>
    </section>
  )
}

/** "ages 6–9", "18 and over", "learners who did not say their age". */
function bandWords(age: AgeBand): string {
  switch (age) {
    case '18plus':
      return '18 and over'
    case 'under6':
      return 'under 6'
    case 'preferNotToSay':
      return 'who did not say their age'
    case 'none':
      return 'who left before the age question'
    default:
      return `ages ${ageLabel(age)}`
  }
}

const BAND_SHORT: Record<AgeBand, string> = {
  under6: '<6',
  '6to9': '6–9',
  '10to12': '10–12',
  '13to15': '13–15',
  '16to17': '16–17',
  '18plus': '18+',
  preferNotToSay: 'Not said',
  none: 'No answer',
}

/**
 * The period's learners by age band, as bars (children blue, 13 and over orange, the
 * rest gray), with what each band did beneath. A bar narrows the page to that band;
 * tapped again, it shows everyone. It follows the other narrowings, so with a keyword
 * picked it shows the ages that keyword brought.
 */
function Ages({
  ages,
  picked,
  href,
}: {
  ages: LearnersReport['ages']
  picked: AgeBand | null
  href: (age: AgeBand) => string
}) {
  const most = Math.max(1, ...ages.map((row) => row.learners))
  const shown = ages.find((row) => row.age === picked)
  const total = ages.reduce((sum, row) => sum + row.learners, 0)
  const teens = ages.filter((row) => !isChildAge(row.age === 'none' ? null : row.age)).reduce((sum, row) => sum + row.learners, 0)
  return (
    <section className="st-learners__panel st-learners__ages" aria-labelledby="learners-ages">
      <div className="st-learners__panel-head">
        <h2 id="learners-ages" className="st-learners__h2">
          Ages
        </h2>
        <span className="st-learners__muted">{picked ? 'Tap it again for everyone.' : 'Tap a bar for only them.'}</span>
      </div>
      <ol className="st-learners__age-chart">
        {ages.map((row) => {
          const tone = row.age === 'preferNotToSay' || row.age === 'none' ? 'quiet' : isChildAge(row.age) ? 'children' : 'teens'
          return (
            <li key={row.age}>
              <a
                className={`st-learners__age-bar st-learners__age-bar--${tone}`}
                href={href(row.age)}
                aria-current={row.age === picked ? 'true' : undefined}
                aria-label={`${bandWords(row.age)}: ${row.learners} ${row.learners === 1 ? 'learner' : 'learners'}, ${row.finished} lessons done, ${row.sawPrice} saw a price, ${row.bought} bought: ${row.age === picked ? 'show everyone' : 'show only them'}`}
              >
                <span className="st-learners__age-count">{row.learners}</span>
                <span className="st-learners__age-column" aria-hidden="true">
                  <span style={{ height: `${(row.learners / most) * 100}%` }} />
                </span>
                <span className="st-learners__age-label">{BAND_SHORT[row.age]}</span>
              </a>
            </li>
          )
        })}
      </ol>
      <p className="st-learners__muted st-learners__age-note">
        {shown
          ? `${bandWords(shown.age)[0].toUpperCase()}${bandWords(shown.age).slice(1)}: ${shown.learners} ${shown.learners === 1 ? 'learner' : 'learners'}, ${shown.finished} ${shown.finished === 1 ? 'lesson' : 'lessons'} done, ${shown.sawPrice} saw a price, ${shown.bought} bought.`
          : `${total - teens} children and ${teens} learners 13 or over.`}
      </p>
    </section>
  )
}

/**
 * Where the period's learners came from: Apple Ads keyword by keyword (or campaign, for
 * Search Match) against the rest, their countries and their app versions. A row narrows
 * the page to its learners; tapped again, it shows everyone.
 */
function WhereFromPanel({
  whereFrom,
  picked,
  problem,
  href,
}: {
  whereFrom: WhereFrom
  picked: Where | null
  problem: string | null
  href: (where: Where) => string
}) {
  const names = useContext(AdNamesContext)
  const row = (data: WhereRow, label: ReactNode, words: string, detail?: ReactNode) => (
    <li key={data.key}>
      <a
        className="st-learners__where-row"
        href={href(data.key)}
        aria-current={data.key === picked ? 'true' : undefined}
        aria-label={`${words}: ${data.learners} ${data.learners === 1 ? 'learner' : 'learners'}, ${data.finished} lessons done, ${data.sawPrice} saw a price, ${data.bought} bought: ${data.key === picked ? 'show everyone' : 'show only them'}`}
      >
        <span className="st-learners__where-label">{label}</span>
        <span className="st-learners__where-count">{data.learners}</span>
        <span className="st-learners__where-did">
          {detail ? <>{detail} · </> : null}
          {data.finished} {data.finished === 1 ? 'lesson' : 'lessons'}
          {data.sawPrice ? ` · ${data.sawPrice} saw a price` : ''}
          {data.bought ? ` · ${data.bought} bought` : ''}
        </span>
      </a>
    </li>
  )
  return (
    <section className="st-learners__panel st-learners__where" aria-labelledby="learners-where">
      <div className="st-learners__panel-head">
        <h2 id="learners-where" className="st-learners__h2">
          Where from
        </h2>
        <span className="st-learners__muted">Learners, and what they did. Tap one to see only them.</span>
      </div>
      <div className="st-learners__where-columns">
        <div>
          <h3 className="st-learners__where-title">Came from</h3>
          <ul className="st-learners__where-list">
            {whereFrom.ads.map((ad) =>
              row(ad, <>Apple Ads {keywordWords(names, ad.ad)}</>, `Apple Ads, ${keywordWords(names, ad.ad)}`, campaignWords(names, ad.ad.campaign)),
            )}
            {whereFrom.organic.learners ? row(whereFrom.organic, 'Not from Apple Ads', 'Not from Apple Ads', 'the App Store, a link, a friend') : null}
          </ul>
          {problem ? <p className="st-learners__muted st-learners__where-note">Ads’ names are missing: {problem}</p> : null}
        </div>
        <div>
          <h3 className="st-learners__where-title">Country</h3>
          <ul className="st-learners__where-list">
            {whereFrom.countries.map((country) =>
              row(
                country,
                <>
                  {country.country ? <span aria-hidden="true">{flagOf(country.country)} </span> : null}
                  {countryWords(country.country)}
                </>,
                countryWords(country.country),
                country.country ? undefined : 'sent from the release after 1.1',
              ),
            )}
          </ul>
        </div>
        <div>
          <h3 className="st-learners__where-title">App version</h3>
          <ul className="st-learners__where-list">
            {whereFrom.versions.map((version) =>
              row(version, version.version ?? 'Unknown', `Version ${version.version ?? 'unknown'}`),
            )}
          </ul>
        </div>
      </div>
    </section>
  )
}

/**
 * Where an opened session's learner came from, in full: the ad's campaign, ad group and
 * keyword, their country and the app version, each a way to see only learners like them.
 */
function SessionFacts({ session, whereHref }: { session: LearnerSession; whereHref: (where: Where) => string }) {
  const names = useContext(AdNamesContext)
  const ad = session.ad
  const keyword = ad?.keyword ? names.keywords[ad.keyword] : undefined
  // An ad group named like its campaign ("US - Category" › "Category") says nothing more.
  const group = ad?.adGroup ? names.adGroups[ad.adGroup] : undefined
  const groupWords = ad && group && !campaignWords(names, ad.campaign).endsWith(group) ? ` › ${group}` : ''
  return (
    <p className="st-learners__facts">
      {ad ? (
        <a href={whereHref(adKey(ad))} title="Show only learners from this keyword">
          From Apple Ads: {campaignWords(names, ad.campaign)}
          {groupWords} › {keywordWords(names, ad)}
          {keyword?.match ? ` (${keyword.match.toLowerCase()})` : ''}
        </a>
      ) : session.source === 'ads' ? (
        <span>From Apple Ads (no campaign sent)</span>
      ) : (
        <a href={whereHref('organic')} title="Show only learners not from Apple Ads">
          Not from Apple Ads
        </a>
      )}
      <a href={whereHref(`country-${session.country ?? 'unknown'}`)} title="Show only learners from this country">
        {session.country ? `${flagOf(session.country)} ${countryWords(session.country)}` : 'Country not sent'}
      </a>
      <a href={whereHref(`version-${session.version ?? 'unknown'}`)} title="Show only learners on this version">
        App {session.version ?? 'version unknown'}
      </a>
    </p>
  )
}

function Chips<Value extends string>({
  label,
  value,
  names,
  onChange,
}: {
  label: string
  value: Value
  names: Record<Value, string>
  onChange: (value: Value) => void
}) {
  return (
    <div className="st-learners__chips" role="group" aria-label={label}>
      {(Object.keys(names) as Value[]).map((candidate) => (
        <button
          key={candidate}
          type="button"
          aria-pressed={candidate === value}
          onClick={() => onChange(candidate)}
        >
          {names[candidate]}
        </button>
      ))}
    </div>
  )
}

/** What to do before the page has anything to show: a key, in web/.env.local. */
function ConnectPostHog({ problem }: { problem: string | null }) {
  return (
    <section className="st-learners__connect" aria-labelledby="learners-connect">
      <h2 id="learners-connect" className="st-learners__h2">
        Connect PostHog
      </h2>
      <p>{problem}</p>
      <ol>
        <li>
          In PostHog, open <strong>Settings › Personal API keys</strong> and create a key for the project
          “Paper Coach” with <strong>Query: Read</strong> and nothing else.
        </li>
        <li>
          Add it to <code>web/.env.local</code> on the Mac that runs the Studio:{' '}
          <code>POSTHOG_PERSONAL_API_KEY=phx_…</code>
        </li>
        <li>Restart the Studio. The key stays on that Mac; the browser never sees it.</li>
      </ol>
      <p className="st-learners__muted">
        To try the page first, start the Studio with{' '}
        <code>STUDIO_LEARNERS_SAMPLE=server/fixtures/learners-sample.json</code>: Oct 1 and 2, 2026.
      </p>
    </section>
  )
}

// ---------- The numbers ----------

/** What the page says it is showing, once a number has narrowed it. */
const ONLY_WORDS: Record<Only, string> = {
  installs: 'new installs',
  lessons: 'who finished a lesson',
  photos: 'who kept a photo',
  price: 'who saw a price',
  trials: 'who started a free trial',
  buys: 'who bought a plan',
  'reached-onboarded': 'new installs who finished onboarding',
  'reached-first': 'new installs who made a first drawing',
  'reached-second': 'new installs who made a second drawing',
  'reached-price': 'new installs who saw a price',
  'reached-bought': 'new installs who started a trial or bought',
  'stopped-installed': 'new installs who left during onboarding',
  'stopped-onboarded': 'new installs who finished onboarding but drew nothing',
  'stopped-first': 'new installs who stopped after one drawing',
  'stopped-second': 'new installs who drew twice or more but saw no price',
  'stopped-price': 'new installs who saw a price but did not buy',
}

/**
 * The period in six numbers, each against the one before. A number is also a way in:
 * a tap narrows everything under it to the learners it counts (Sessions, which counts
 * everyone, shows everyone again), and a second tap undoes it. The numbers themselves
 * stay put, so each keeps saying how many there are of its kind.
 */
function Numbers({
  report,
  only,
  changes,
  href,
}: {
  report: LearnersReport
  only: Only | null
  changes: Record<string, NumberChange>
  href: (key: ReportNumber['key']) => string
}) {
  const before = previousLabel(report.period, report.date)
  return (
    <section className="st-learners__numbers" aria-label="Numbers">
      {report.numbers.map((number) => (
        <NumberTile
          key={number.key}
          number={number}
          before={before}
          href={href(number.key)}
          picked={number.key === only}
          change={changes[number.key]}
          hint={number.key === 'sessions' || number.key === only ? 'show everyone' : `show only ${ONLY_WORDS[number.key as Only]}`}
        />
      ))}
    </section>
  )
}

function NumberTile({
  number,
  before,
  href,
  picked,
  change,
  hint,
}: {
  number: ReportNumber
  before: string
  href: string
  picked: boolean
  /** Moved since the page last saw it: flashes once, then stays highlighted a while. */
  change?: NumberChange
  hint: string
}) {
  const tone = number.value === number.previous ? 'same' : number.value > number.previous ? 'up' : 'down'
  return (
    <a
      className={`st-learners__stat${change ? ' st-learners__stat--changed' : ''}`}
      href={href}
      aria-current={picked ? 'true' : undefined}
      aria-label={`${number.value} ${number.label.toLowerCase()}${number.amount !== undefined ? `, ${money(number.amount)}` : ''}, ${number.sub}, ${compared(number.value, number.previous, before)}${change ? `, changed: ${changeWords(change)}` : ''}: ${hint}`}
    >
      {change ? (
        <>
          {/* Keyed by when it moved, so each new move flashes again. */}
          <span key={change.at} className="st-learners__stat-flash" aria-hidden="true" />
          <span className="st-learners__stat-new" title={`Changed: ${changeWords(change)}`} aria-hidden="true">
            {signed(change.to - change.from)}
          </span>
        </>
      ) : null}
      <span className="st-learners__stat-value">{number.value}</span>
      <span className="st-learners__stat-label">{number.label}</span>
      {number.amount !== undefined ? <span className="st-learners__stat-money">{money(number.amount)}</span> : null}
      <span className="st-learners__stat-sub">{number.sub}</span>
      <span className={`st-learners__stat-delta st-learners__stat-delta--${tone}`}>
        {compared(number.value, number.previous, before)}
      </span>
    </a>
  )
}

/**
 * Who a session or a leader is, at a glance: their animal on a circle of their own
 * color, the same wherever they appear on the page. A learner 13 or over, who can be
 * followed from day to day, keeps their animal on every day and wears a ring. The
 * animal is the page's name for them, not the avatar they chose in the app, which
 * is never sent.
 */
function LearnerAvatar({ session }: { session: LearnerSession }) {
  const tag = learnerTag(session)
  const label = [session.animal?.name ?? 'Learner', tag, ageLabel(session.age)].filter(Boolean).join(', ')
  return (
    <span
      className={`st-learners__avatar st-learners__avatar--${session.color ?? 0}${session.child ? '' : ' st-learners__avatar--known'}`}
      role="img"
      aria-label={label}
      title={label}
    >
      {session.animal?.emoji ?? '•'}
    </span>
  )
}

// ---------- The journey ----------

/**
 * The journey of the period's installs, stage by stage. A stage is a way in: a tap shows
 * the installs who got that far, and "N stopped" those who got that far and no further.
 */
function Journey({ report, only, href }: { report: LearnersReport; only: Only | null; href: (only: Only) => string }) {
  const most = Math.max(1, ...report.journey.map((stage) => stage.children + stage.teens))
  const installs = report.journey[0].children + report.journey[0].teens
  const what = report.period === 'day' ? 'the day’s' : report.period === 'week' ? 'the week’s' : 'the month’s'
  return (
    <section className="st-learners__panel" aria-labelledby="learners-journey">
      <div className="st-learners__panel-head">
        <h2 id="learners-journey" className="st-learners__h2">
          Journey of {what} {installs} {installs === 1 ? 'install' : 'installs'}
        </h2>
        <span className="st-learners__key">
          <span className="st-learners__swatch st-learners__swatch--children" /> under 13
          <span className="st-learners__swatch st-learners__swatch--teens" /> 13 and over
        </span>
      </div>
      {installs === 0 ? (
        <p className="st-learners__muted">No installs in this {report.period}.</p>
      ) : (
        <ol className="st-learners__journey">
          {report.journey.map((stage) => {
            const total = stage.children + stage.teens
            const reachedIt: Only = stage.key === 'installed' ? 'installs' : (`reached-${stage.key}` as Only)
            const stoppedIt = stage.key === 'bought' ? null : (`stopped-${stage.key}` as Only)
            return (
              <li key={stage.key}>
                <a
                  className="st-learners__stage-row"
                  href={href(reachedIt)}
                  aria-current={only === reachedIt ? 'true' : undefined}
                  aria-label={`${stage.label}: ${total}, ${stage.children} under 13, ${stage.teens} 13 and over. ${only === reachedIt ? 'Show everyone' : 'Show only them'}`}
                >
                  <span className="st-learners__stage">{stage.label}</span>
                  <span className="st-learners__bar" aria-hidden="true">
                    <span
                      className="st-learners__bar-children"
                      style={{ width: `${(stage.children / most) * 100}%` }}
                    />
                    <span className="st-learners__bar-teens" style={{ width: `${(stage.teens / most) * 100}%` }} />
                  </span>
                  <span className="st-learners__count" title={`${stage.children} under 13, ${stage.teens} 13 and over`}>
                    {total}
                  </span>
                </a>
                {stoppedIt && stage.stopped > 0 ? (
                  <a
                    className="st-learners__stopped"
                    href={href(stoppedIt)}
                    aria-current={only === stoppedIt ? 'true' : undefined}
                    title={`Show only the ${ONLY_WORDS[stoppedIt]}`}
                  >
                    {stage.stopped} stopped
                  </a>
                ) : (
                  <span className="st-learners__stopped st-learners__stopped--none" />
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

// ---------- Most drawn ----------

/** The lessons finished most, as pictures; a tap shows only the learners who finished that one, and a second tap everyone again. */
function MostDrawn({
  report,
  library,
  picked,
  href,
}: {
  report: LearnersReport
  library: Library
  picked: string | null
  href: (lesson: string) => string
}) {
  return (
    <section className="st-learners__panel" aria-labelledby="learners-drawn">
      <div className="st-learners__panel-head">
        <h2 id="learners-drawn" className="st-learners__h2">
          Most drawn
        </h2>
        <span className="st-learners__muted">
          {picked ? `By those who drew ${titleOf(library, picked)}. Tap it again for everyone.` : 'Tap one to see who drew it.'}
        </span>
      </div>
      {report.mostDrawn.length ? (
        <ul className="st-learners__drawn">
          {report.mostDrawn.map((drawn) => (
            <li key={drawn.lesson}>
              <a
                className="st-learners__drawn-pick"
                href={href(drawn.lesson)}
                aria-current={drawn.lesson === picked ? 'true' : undefined}
                aria-label={`${titleOf(library, drawn.lesson)}, finished ${drawn.count} ${drawn.count === 1 ? 'time' : 'times'}: ${drawn.lesson === picked ? 'show everyone' : 'show who drew it'}`}
              >
                <LessonPicture library={library} lesson={drawn.lesson} size="large" />
                <span className="st-learners__times">×{drawn.count}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="st-learners__muted">Nothing finished in this {report.period}.</p>
      )}
    </section>
  )
}

// ---------- A lesson as its picture ----------

type PictureState = 'finished' | 'started' | 'locked'
type Badge = 'kept' | 'crown' | 'wish'

/** The lesson the page is narrowed to, picked out wherever it is drawn. */
const Picked = createContext<string | null>(null)

/** A lesson's title, or its id when the library has no such lesson. */
function titleOf(library: Library, lesson: string): string {
  return library.tutorials.get(lesson)?.tutorial.title ?? lesson
}

/** A lesson as the app draws it, on white paper; dashed and faded when it was not finished. */
export function LessonPicture({
  library,
  lesson,
  size = 'small',
  state = 'finished',
  badge,
}: {
  library: Library
  lesson: string
  size?: 'tiny' | 'chip' | 'small' | 'medium' | 'large'
  state?: PictureState
  badge?: Badge
}) {
  const picked = useContext(Picked) === lesson
  const entry = library.tutorials.get(lesson)
  const title = entry?.tutorial.title ?? lesson
  const label = [title, state === 'started' ? 'not finished' : state === 'locked' ? 'locked' : null, badge ? BADGE_WORDS[badge] : null]
    .filter(Boolean)
    .join(', ')
  return (
    <span
      className={`st-learners__pic st-learners__pic--${size} st-learners__pic--${state}${picked ? ' st-learners__pic--picked' : ''}`}
      role="img"
      aria-label={label}
      title={label}
    >
      <span className="st-learners__pic-paper">
        {entry ? <FinishedDrawing tutorial={entry.tutorial} /> : <span className="st-learners__pic-missing">{title}</span>}
      </span>
      {badge ? <span className={`st-learners__badge st-learners__badge--${badge}`}>{BADGE_ICONS[badge]}</span> : null}
    </span>
  )
}

const BADGE_WORDS: Record<Badge, string> = { kept: 'photo kept', crown: 'tapped while locked', wish: 'on the wish list' }

const BADGE_ICONS: Record<Badge, ReactNode> = {
  kept: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5.5 4 6.6 2.5h2.8L10.5 4H13a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <circle cx="8" cy="8.5" r="2.4" className="st-learners__badge-lens" />
    </svg>
  ),
  crown: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 12V5l3.2 3L8 3l2.8 5L14 5v7z" />
    </svg>
  ),
  wish: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="m8 1.8 1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" />
    </svg>
  ),
}

// ---------- Sessions ----------

function Sessions({
  sessions,
  library,
  opened,
  onToggle,
  empty,
  whereHref,
}: {
  sessions: LearnerSession[]
  library: Library
  opened: string | null
  onToggle: (key: string) => void
  /** What to say when there is nobody. */
  empty: string
  whereHref: (where: Where) => string
}) {
  return (
    <section className="st-learners__section" aria-labelledby="learners-sessions">
      <div className="st-learners__panel-head">
        <h2 id="learners-sessions" className="st-learners__h2">
          {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
        </h2>
        <span className="st-learners__muted">Newest first. Tap one for its timeline.</span>
      </div>
      <StripKey />
      {sessions.length ? (
        <ol className="st-learners__sessions">
          {sessions.map((session) => (
            <SessionRow
              key={session.key}
              session={session}
              library={library}
              open={opened === session.key}
              onToggle={() => onToggle(session.key)}
              whereHref={whereHref}
            />
          ))}
        </ol>
      ) : (
        <p className="st-learners__muted">{empty}</p>
      )}
    </section>
  )
}

function SessionRow({
  session,
  library,
  open,
  onToggle,
  whereHref,
}: {
  session: LearnerSession
  library: Library
  open: boolean
  onToggle: () => void
  whereHref: (where: Where) => string
}) {
  const names = useContext(AdNamesContext)
  const meta = [
    learnerTag(session),
    ageLabel(session.age),
    lastedFor(session.activeMs),
    session.country ? `${flagOf(session.country)} ${session.country}` : null,
    session.version ? `App ${session.version}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <li className={`st-learners__session${open ? ' st-learners__session--open' : ''}`}>
      <button type="button" className="st-learners__session-face" aria-expanded={open} onClick={onToggle}>
        <LearnerAvatar session={session} />
        <span className="st-learners__session-head">
          <span className="st-learners__session-time">{timeOf(session.start)}</span>
          <span className={`st-learners__status st-learners__status--${session.isNew ? 'new' : 'back'}`}>
            {session.isNew ? 'New' : 'Back'}
          </span>
          <span className="st-learners__session-meta">{meta}</span>
          {session.ad || session.source === 'ads' ? (
            <span className="st-learners__ad" title={session.ad ? campaignWords(names, session.ad.campaign) : undefined}>
              Apple Ads{session.ad ? ` ${keywordWords(names, session.ad)}` : ''}
            </span>
          ) : null}
        </span>
        <Strip items={session.items} library={library} />
        <SessionEnd end={session.end} library={library} />
      </button>
      {open ? <SessionFacts session={session} whereHref={whereHref} /> : null}
      {open ? <Timeline lines={session.timeline} library={library} /> : null}
      {open && !session.child ? <History session={session} library={library} /> : null}
    </li>
  )
}

/** A session's steps in order: its lessons as pictures, and small marks for the rest. */
function Strip({ items, library }: { items: SessionItem[]; library: Library }) {
  // Onboarding is in the timeline, and "New" says it: the strip is for what they did after it.
  const shown = items.filter((item) => item.kind !== 'onboarding')
  if (!shown.length) {
    return (
      <span className="st-learners__strip">
        <span className="st-learners__strip-empty">Nothing drawn</span>
      </span>
    )
  }
  return (
    <span className="st-learners__strip">
      {shown.map((item, index) => (
        <StripItem key={`${item.kind}-${item.at}-${index}`} item={item} library={library} />
      ))}
    </span>
  )
}

const END_TONES: Record<SessionEndKind, 'good' | 'stopped' | 'price' | 'quiet'> = {
  drawingNow: 'good',
  hereNow: 'good',
  after: 'good',
  bought: 'good',
  stopped: 'stopped',
  atLocked: 'stopped',
  duringOnboarding: 'stopped',
  afterOnboarding: 'stopped',
  atPaywall: 'price',
  atGrownUpPaywall: 'price',
  atGrownUp: 'price',
  openedOnly: 'quiet',
}

type SessionEndKind = LearnerSession['end']['kind']

/**
 * Where a session ended, as one pill on the right of its row: green when it ended on
 * something done, amber where someone stopped, blue at a price or a grown-up's screen.
 * The lesson it ended on is in it as a small picture.
 */
function SessionEnd({ end, library }: { end: LearnerSession['end']; library: Library }) {
  const lesson = endLesson(end)
  const state: PictureState = end.kind === 'after' ? 'finished' : end.kind === 'atLocked' ? 'locked' : 'started'
  return (
    <span className={`st-learners__end st-learners__end--${END_TONES[end.kind]}${lesson ? ' st-learners__end--with-pic' : ''}`}>
      {end.kind === 'drawingNow' || end.kind === 'hereNow' ? <span className="st-learners__live" aria-hidden="true" /> : null}
      <span>{endWords(end)}</span>
      {lesson ? (
        <LessonPicture
          library={library}
          lesson={lesson}
          size="chip"
          state={state}
          badge={end.kind === 'after' && end.kept ? 'kept' : undefined}
        />
      ) : null}
    </span>
  )
}

function StripItem({ item, library }: { item: SessionItem; library: Library }) {
  switch (item.kind) {
    case 'onboarding':
      return <span className="st-learners__mark st-learners__mark--onboarding" title="Finished onboarding" />
    case 'lesson':
      return (
        <LessonPicture
          library={library}
          lesson={item.lesson}
          state={item.state === 'finished' ? 'finished' : 'started'}
          badge={item.kept ? 'kept' : undefined}
        />
      )
    case 'crown':
      return <LessonPicture library={library} lesson={item.lesson} state="locked" badge="crown" />
    case 'wish':
      return <LessonPicture library={library} lesson={item.lesson} state="locked" badge="wish" />
    case 'grownUp':
      return <span className="st-learners__mark st-learners__mark--grown-up" title="“This part is for a grown-up”" />
    case 'price':
      return (
        <span
          className="st-learners__mark st-learners__mark--price"
          title={item.forGrownUp ? 'The grown-up’s paywall' : 'The paywall'}
        />
      )
    case 'bought':
      return (
        <span
          className={`st-learners__purchase st-learners__purchase--${item.trial ? 'trial' : 'paid'}`}
          title={item.trial ? 'Started a free week' : `Bought ${item.plan ?? 'Premium'}`}
        >
          {item.trial ? 'Free week' : item.price !== null ? money(item.price) : 'Bought'}
        </span>
      )
    case 'later':
      return <span className="st-learners__later">back {timeOf(item.at)}</span>
  }
}

function StripKey() {
  return (
    <ul className="st-learners__strip-key" aria-label="Key">
      <li>
        <span className="st-learners__key-tile st-learners__key-tile--finished" /> drawn
      </li>
      <li>
        <span className="st-learners__key-tile st-learners__key-tile--started" /> stopped in it
      </li>
      <li>
        <span className="st-learners__badge st-learners__badge--kept st-learners__badge--inline">{BADGE_ICONS.kept}</span>{' '}
        photo kept
      </li>
      <li>
        <span className="st-learners__badge st-learners__badge--crown st-learners__badge--inline">{BADGE_ICONS.crown}</span>{' '}
        tapped while locked
      </li>
      <li>
        <span className="st-learners__badge st-learners__badge--wish st-learners__badge--inline">{BADGE_ICONS.wish}</span>{' '}
        wished for
      </li>
      <li>
        <span className="st-learners__mark st-learners__mark--grown-up" /> grown-up screen
      </li>
      <li>
        <span className="st-learners__mark st-learners__mark--price" /> saw a price
      </li>
      <li>
        <span className="st-learners__later">back 1:47 PM</span> came back later
      </li>
    </ul>
  )
}

/** An opened session: every step in words, with the lesson's picture beside it. */
/** ": Flow 1, after onboarding (Onboarding offer test, 33%)", beside "Paywall opened". */
function ShownName({ shown }: { shown: PaywallShown }) {
  const names = useContext(PaywallNamesContext)
  return <span className="st-learners__line-shown">: {shownWords(names, shown)}</span>
}

function Timeline({ lines, library }: { lines: TimelineLine[]; library: Library }) {
  return (
    <ol className="st-learners__timeline">
      {lines.map((line, index) => (
        <li key={`${line.at}-${index}`} className={`st-learners__line st-learners__line--${line.mark}`}>
          <time className="st-learners__line-time">{timeWithSeconds(line.at)}</time>
          <span className="st-learners__line-mark" aria-hidden="true" />
          {line.lesson ? (
            <LessonPicture
              library={library}
              lesson={line.lesson}
              state={line.mark === 'started' ? 'started' : line.mark === 'crown' || line.mark === 'wish' ? 'locked' : 'finished'}
            />
          ) : null}
          <span className="st-learners__line-text">
            {line.text}
            {line.shown ? <ShownName shown={line.shown} /> : null}
          </span>
        </li>
      ))}
    </ol>
  )
}

// ---------- Who drew most ----------

const leaderKey = (key: string) => `leader:${key}`

/**
 * The learners who finished most lessons in the period, best first: each with the
 * lessons they finished as pictures. A learner 13 or over opens into their history;
 * a child, whose id lasts one launch, into that launch's timeline.
 */
function Leaders({
  report,
  library,
  opened,
  onToggle,
}: {
  report: LearnersReport
  library: Library
  opened: string | null
  onToggle: (key: string) => void
}) {
  if (!report.leaders.length) return null
  return (
    <section className="st-learners__section st-learners__leaders" aria-labelledby="learners-leaders">
      <div className="st-learners__panel-head">
        <h2 id="learners-leaders" className="st-learners__h2">
          Top learners
        </h2>
        <span className="st-learners__muted">
          By lessons finished. A child’s id lasts one launch, so a child can appear once per launch.
        </span>
      </div>
      <ol className="st-learners__board">
        {report.leaders.map((session, index) => {
          const open = opened === leaderKey(session.key)
          const tag = learnerTag(session)
          const who = [tag, ageLabel(session.age), session.child ? 'one launch' : null, session.isNew ? 'new' : null]
            .filter(Boolean)
            .join(' · ')
          const figures = [
            `${session.finished} ${session.finished === 1 ? 'lesson' : 'lessons'}`,
            session.kept ? `${session.kept} ${session.kept === 1 ? 'photo' : 'photos'}` : null,
            lastedFor(session.activeMs),
            session.returns.length ? `${session.returns.length + 1} visits` : null,
          ]
            .filter(Boolean)
            .join(' · ')
          return (
            <li key={session.key} className={`st-learners__leader${open ? ' st-learners__leader--open' : ''}`}>
              <button type="button" className="st-learners__leader-face" aria-expanded={open} onClick={() => onToggle(leaderKey(session.key))}>
                <span className={`st-learners__rank st-learners__rank--${index < 3 ? index + 1 : 'rest'}`}>{index + 1}</span>
                <LearnerAvatar session={session} />
                <span className="st-learners__leader-who">
                  <span className="st-learners__leader-name">{who}</span>
                  <span className="st-learners__leader-figures">{figures}</span>
                </span>
                <span className="st-learners__leader-pics">
                  {finishedLessons(session)
                    .slice(0, 10)
                    .map((lesson) => (
                      <LessonPicture key={lesson} library={library} lesson={lesson} />
                    ))}
                </span>
              </button>
              {open ? (
                session.child ? (
                  <Timeline lines={session.timeline} library={library} />
                ) : (
                  <History session={session} library={library} />
                )
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

// ---------- One learner over time ----------

const historyDay = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })

/**
 * Every day a learner 13 or over used the app, newest first, each as its row of
 * lessons and where it ended: their ids are the same on every launch, so PostHog
 * can be asked for all of it (a year back). A day opens in place, as its timeline
 * in words, without leaving the page.
 */
function History({ session, library }: { session: LearnerSession; library: Library }) {
  const [state, setState] = useState<{ history: LearnerHistory | null; problem: string | null } | null>(null)
  const [openDay, setOpenDay] = useState<string | null>(null)
  const ids = session.ids.join(',')
  useEffect(() => {
    let live = true
    readLearnerHistory(ids.split(','))
      .then((response) => {
        if (!live) return
        setState({ history: buildHistory(response.events, Date.now()), problem: response.problem })
      })
      .catch((caught: unknown) => {
        if (live) setState({ history: null, problem: caught instanceof Error ? caught.message : String(caught) })
      })
    return () => {
      live = false
    }
  }, [ids])

  const thisDay = dayOf(session.start)
  if (!state) return <p className="st-learners__history st-learners__muted">Asking PostHog for their other visits…</p>
  if (!state.history) return <p className="st-learners__history st-learners__muted">{state.problem ?? 'PostHog has nothing more for them.'}</p>
  const { history } = state
  const days = history.days.length
  const summary = [
    history.installedAt ? `installed ${historyDay.format(new Date(`${dayOf(history.installedAt)}T12:00:00Z`))}` : `first seen ${historyDay.format(new Date(`${dayOf(history.firstSeen)}T12:00:00Z`))}`,
    `${days} ${days === 1 ? 'day' : 'days'}`,
    `${history.visits} ${history.visits === 1 ? 'visit' : 'visits'}`,
    `${history.finished} ${history.finished === 1 ? 'lesson' : 'lessons'} finished`,
    history.kept ? `${history.kept} ${history.kept === 1 ? 'photo' : 'photos'} kept` : null,
    history.prices ? `saw a paywall ${history.prices === 1 ? 'once' : `${history.prices} times`}` : 'never saw a paywall',
    history.bought ? 'bought a plan' : history.trialed ? 'started a free week' : 'not bought',
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <section className="st-learners__history" aria-label={`Every visit of ${learnerTag(session) ?? 'this learner'}`}>
      <h3 className="st-learners__history-title">
        <LearnerAvatar session={session} />
        <span>Every visit of {learnerTag(session)}</span>
        <span className="st-learners__history-summary">{summary}</span>
      </h3>
      {days === 1 ? <p className="st-learners__muted">This is their only day so far.</p> : null}
      <ol className="st-learners__history-days">
        {history.days.map(({ day, session: visit }) => {
          return (
            <li
              key={day}
              className={[
                'st-learners__history-day',
                day === thisDay ? 'st-learners__history-day--this' : null,
                openDay === day ? 'st-learners__history-day--open' : null,
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <button
                type="button"
                className="st-learners__history-face"
                aria-expanded={openDay === day}
                onClick={() => setOpenDay((current) => (current === day ? null : day))}
              >
                <span className="st-learners__history-when">
                  <strong>{historyDay.format(new Date(`${day}T12:00:00Z`))}</strong>
                  <span>
                    {timeOf(visit.start)} · {lastedFor(visit.activeMs)}
                    {visit.returns.length ? ` · ${visit.returns.length + 1} visits` : ''}
                  </span>
                </span>
                <Strip items={visit.items} library={library} />
                <SessionEnd end={visit.end} library={library} />
              </button>
              {openDay === day ? (
                <div className="st-learners__history-open">
                  <Timeline lines={visit.timeline} library={library} />
                  {day === thisDay ? null : (
                    <a className="st-learners__history-link" href={routeHref({ name: 'learners', period: 'day', date: day })}>
                      Everyone on {historyDay.format(new Date(`${day}T12:00:00Z`))} ›
                    </a>
                  )}
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

// ---------- A week or a month, day by day ----------

const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' })

function Days({
  report,
  library,
  today,
  dayHref,
}: {
  report: LearnersReport
  library: Library
  today: string
  dayHref: (day: string) => string
}) {
  const most = Math.max(1, ...report.days.map((day) => day.lessons))
  // A month starts in its weekday's column, so the grid reads like a calendar.
  const lead = report.period === 'month' ? (new Date(`${report.from}T12:00:00Z`).getUTCDay() + 6) % 7 : 0
  return (
    <section className="st-learners__section" aria-labelledby="learners-days">
      <div className="st-learners__panel-head">
        <h2 id="learners-days" className="st-learners__h2">
          Day by day
        </h2>
        <span className="st-learners__muted">Lessons finished each day, and the one drawn most.</span>
      </div>
      <ol className="st-learners__days" style={{ '--lead': lead } as CSSProperties}>
        {report.days.map((day, index) => (
          <DayCell
            key={day.day}
            day={day}
            most={most}
            library={library}
            future={day.day > today}
            first={index === 0}
            href={dayHref(day.day)}
          />
        ))}
      </ol>
    </section>
  )
}

function DayCell({
  day,
  most,
  library,
  future,
  first,
  href,
}: {
  day: DaySummary
  most: number
  library: Library
  future: boolean
  first: boolean
  href: string
}) {
  const date = new Date(`${day.day}T12:00:00Z`)
  const face = (
    <>
      <span className="st-learners__day-name">
        {weekday.format(date)} <strong>{date.getUTCDate()}</strong>
      </span>
      <span className="st-learners__day-bar" aria-hidden="true">
        <span style={{ height: `${(day.lessons / most) * 100}%` }} />
      </span>
      <span className="st-learners__day-figures">
        {day.lessons} {day.lessons === 1 ? 'lesson' : 'lessons'}
        <br />
        {day.installs} {day.installs === 1 ? 'install' : 'installs'}
      </span>
      <span className="st-learners__day-top">
        {day.top ? <LessonPicture library={library} lesson={day.top} size="medium" /> : null}
      </span>
    </>
  )
  return (
    <li className={first ? 'st-learners__day st-learners__day--first' : 'st-learners__day'}>
      {future ? (
        <span className="st-learners__day-face st-learners__day-face--future">{face}</span>
      ) : (
        <a className="st-learners__day-face" href={href}>
          {face}
        </a>
      )}
    </li>
  )
}

// ---------- Today's summary of it ----------

/**
 * The Learners page in brief, on Today: the day's numbers and the lessons drawn
 * most, and the way to every session. The same day as the Today page shows.
 */
export function LearnersSummary({ day, library }: { day: string; library: Library }) {
  const { response, error } = useLearnerEvents('day', day, library.writable)
  const report = useMemo(
    () => (response?.configured ? buildReport(response.events, { period: 'day', date: day, now: Date.now() }) : null),
    [response, day],
  )
  // The same view as the Learners page's day with nothing narrowed: one memory of what was seen.
  const [markFor] = useMarkFor()
  const changes = useNumberChanges(`day|${day}|all|all|`, report?.numbers ?? null, markFor)
  const date = day === dayOf(Date.now()) ? null : day
  const href = routeHref({ name: 'learners', period: 'day', date })
  return (
    <section className="st-today__section st-learners-summary" aria-labelledby="today-learners">
      <div className="st-learners-summary__head">
        <h2 id="today-learners" className="st-today__h2">
          Learners
        </h2>
        <a href={href}>Every session ›</a>
      </div>
      {error ? <p className="st-learners__muted">The Studio server did not answer: {error}</p> : null}
      {response && !response.configured ? (
        <p className="st-learners__muted">
          Connect PostHog to see who drew what: the <a href={href}>Learners page</a> says how.
        </p>
      ) : null}
      {report ? (
        <>
          <div className="st-learners-summary__numbers">
            {report.numbers.map((number) => (
              <a
                key={number.key}
                className={`st-learners-summary__number${changes[number.key] ? ' st-learners-summary__number--changed' : ''}`}
                href={routeHref({ name: 'learners', period: 'day', date, ...(number.key === 'sessions' ? {} : { only: number.key }) })}
                title={changes[number.key] ? `Changed: ${changeWords(changes[number.key])}` : undefined}
              >
                <strong key={changes[number.key]?.at}>{number.value}</strong> {number.label.toLowerCase()}
                {number.amount ? ` (${money(number.amount)})` : ''}
                {changes[number.key] ? (
                  <span className="st-learners-summary__new">{signed(changes[number.key].to - changes[number.key].from)}</span>
                ) : null}
              </a>
            ))}
          </div>
          {report.mostDrawn.length ? (
            <ul className="st-learners__drawn st-learners__drawn--compact" aria-label="Drawn most">
              {report.mostDrawn.slice(0, 10).map((drawn) => (
                <li key={drawn.lesson}>
                  <a
                    className="st-learners__drawn-pick"
                    href={routeHref({ name: 'learners', period: 'day', date, lesson: drawn.lesson })}
                    aria-label={`${titleOf(library, drawn.lesson)}, finished ${drawn.count} ${drawn.count === 1 ? 'time' : 'times'}: see who drew it`}
                  >
                    <LessonPicture library={library} lesson={drawn.lesson} size="medium" />
                    <span className="st-learners__times">×{drawn.count}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="st-learners__muted">Nothing drawn yet today.</p>
          )}
        </>
      ) : null}
    </section>
  )
}
