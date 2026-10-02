import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'

import { readLearnerHistory, readLearners } from './api'
import { FinishedDrawing } from './FinishedDrawing'
import {
  ageLabel,
  buildHistory,
  buildReport,
  compared,
  dayOf,
  endLesson,
  endWords,
  finishedLessons,
  lastedFor,
  learnerTag,
  LEARNERS_TIME_ZONE_NAME,
  periodLabel,
  periodRange,
  type LearnerHistory,
  PERIODS,
  previousLabel,
  stepPeriod,
  timeOf,
  timeWithSeconds,
  type DaySummary,
  type LearnersReport,
  type LearnersResponse,
  type LearnerSession,
  type Period,
  type ReportNumber,
  type SessionItem,
  type Source,
  type TimelineLine,
  type Who,
} from './learners'
import type { Library } from './library'
import { routeHref } from './route'

/** How often a period that reaches today asks again. The server keeps PostHog's answer five minutes. */
const REFRESH_MS = 120_000

const PERIOD_NAMES: Record<Period, string> = { day: 'Day', week: 'Week', month: 'Month' }
const WHO_NAMES: Record<Who, string> = { all: 'Everyone', children: 'Children', teens: '13+' }
const SOURCE_NAMES: Record<Source, string> = { all: 'All sources', ads: 'Apple Ads', organic: 'Organic' }

/** The events of a period and the one before it, asked for again while the period reaches today. */
export function useLearnerEvents(period: Period, day: string, available: boolean) {
  const from = periodRange(period, stepPeriod(period, day, -1)).from
  const to = periodRange(period, day).to
  const range = `${from}|${to}`
  const [state, setState] = useState<{ range: string; response: LearnersResponse | null; error: string | null }>({
    range,
    response: null,
    error: null,
  })

  const load = useCallback(async () => {
    try {
      const response = await readLearners(from, to)
      setState({ range, response, error: null })
    } catch (caught) {
      setState((previous) => ({
        range,
        response: previous.range === range ? previous.response : null,
        error: caught instanceof Error ? caught.message : String(caught),
      }))
    }
  }, [from, to, range])

  useEffect(() => {
    if (!available) return
    void load()
    if (to <= dayOf(Date.now())) return
    const timer = window.setInterval(() => void load(), REFRESH_MS)
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [available, load, to])

  // What was asked for another range is not this one's.
  return state.range === range ? state : { range, response: null, error: null }
}

/**
 * Learners: what people did in the app, for a day, a week or a month, read live from
 * PostHog (`web/server/learners.ts`). The numbers and the journey of the period's
 * installs on top, the lessons drawn most as pictures, then every session of the day
 * as a row of the lessons it drew (a week or a month: one column per day). A row
 * opens into a timeline in words. Children stay anonymous: an age band, times and
 * lessons, nothing else.
 */
export function LearnersView({ period, date, library }: { period: Period; date: string | null; library: Library }) {
  const today = dayOf(Date.now())
  const day = date ?? today
  const { response, error } = useLearnerEvents(period, day, library.writable)
  const [who, setWho] = useState<Who>('all')
  const [source, setSource] = useState<Source>('all')
  const [opened, setOpened] = useState<string | null>(null)
  // A row opened on one day is not open on the next, nor in a week.
  useEffect(() => setOpened(null), [period, day])

  const report = useMemo(
    () =>
      response?.configured && response.events
        ? buildReport(response.events, { period, date: day, who, source, now: Date.now() })
        : null,
    [response, period, day, who, source],
  )

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
            {response?.source === 'sample' ? (
              <>Sample events (STUDIO_LEARNERS_SAMPLE), not PostHog’s.</>
            ) : response?.fetchedAt ? (
              <>From PostHog, as of {timeOf(Date.parse(response.fetchedAt))}.</>
            ) : (
              <>From PostHog.</>
            )}{' '}
            Days in {LEARNERS_TIME_ZONE_NAME}.
          </p>
        </div>
        <nav className="st-learners__period" aria-label="Period">
          <div className="st-learners__segments" role="group" aria-label="Show">
            {PERIODS.map((candidate) => (
              <a
                key={candidate}
                href={routeHref({ name: 'learners', period: candidate, date })}
                aria-current={candidate === period ? 'page' : undefined}
              >
                {PERIOD_NAMES[candidate]}
              </a>
            ))}
          </div>
          <div className="st-learners__stepper">
            <a
              href={routeHref({ name: 'learners', period, date: stepPeriod(period, day, -1) })}
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
              <a href={routeHref({ name: 'learners', period, date: next > today ? null : next })} aria-label={`The ${period} after`}>
                ›
              </a>
            )}
            {reachesToday ? null : (
              <a className="st-learners__now" href={routeHref({ name: 'learners', period, date: null })}>
                {period === 'day' ? 'Today' : period === 'week' ? 'This week' : 'This month'}
              </a>
            )}
          </div>
        </nav>
      </header>

      <div className="st-learners__filters">
        <Chips label="Who" value={who} names={WHO_NAMES} onChange={setWho} />
        <Chips label="Source" value={source} names={SOURCE_NAMES} onChange={setSource} />
      </div>

      {error ? <p className="st-notice">The Studio server did not answer: {error}</p> : null}
      {response && !response.configured ? <ConnectPostHog problem={response.problem} /> : null}
      {response?.configured && response.problem ? <p className="st-notice">{response.problem}</p> : null}
      {!response && !error ? <p className="st-learners__muted">Asking PostHog…</p> : null}

      {report ? (
        <>
          <Numbers report={report} />
          <div className="st-learners__pair">
            <Journey report={report} />
            <MostDrawn report={report} library={library} />
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
            />
          ) : (
            <Days report={report} library={library} today={today} />
          )}
        </>
      ) : null}
    </div>
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

function Numbers({ report }: { report: LearnersReport }) {
  const before = previousLabel(report.period, report.date)
  return (
    <section className="st-learners__numbers" aria-label="Numbers">
      {report.numbers.map((number) => (
        <NumberTile key={number.key} number={number} before={before} />
      ))}
    </section>
  )
}

function NumberTile({ number, before }: { number: ReportNumber; before: string }) {
  const tone = number.value === number.previous ? 'same' : number.value > number.previous ? 'up' : 'down'
  return (
    <div className="st-learners__stat">
      <span className="st-learners__stat-value">{number.value}</span>
      <span className="st-learners__stat-label">{number.label}</span>
      <span className="st-learners__stat-sub">{number.sub}</span>
      <span className={`st-learners__stat-delta st-learners__stat-delta--${tone}`}>
        {compared(number.value, number.previous, before)}
      </span>
    </div>
  )
}

// ---------- The journey ----------

function Journey({ report }: { report: LearnersReport }) {
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
            return (
              <li key={stage.key}>
                <span className="st-learners__stage">{stage.label}</span>
                <span className="st-learners__bar" aria-hidden="true">
                  <span
                    className="st-learners__bar-children"
                    style={{ width: `${(stage.children / most) * 100}%` }}
                  />
                  <span className="st-learners__bar-teens" style={{ width: `${(stage.teens / most) * 100}%` }} />
                </span>
                <span
                  className="st-learners__count"
                  aria-label={`${total}: ${stage.children} under 13, ${stage.teens} 13 and over`}
                  title={`${stage.children} under 13, ${stage.teens} 13 and over`}
                >
                  {total}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

// ---------- Most drawn ----------

function MostDrawn({ report, library }: { report: LearnersReport; library: Library }) {
  return (
    <section className="st-learners__panel" aria-labelledby="learners-drawn">
      <div className="st-learners__panel-head">
        <h2 id="learners-drawn" className="st-learners__h2">
          Most drawn
        </h2>
      </div>
      {report.mostDrawn.length ? (
        <ul className="st-learners__drawn">
          {report.mostDrawn.map((drawn) => (
            <li key={drawn.lesson}>
              <LessonPicture library={library} lesson={drawn.lesson} size="large" />
              <span className="st-learners__times">×{drawn.count}</span>
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
  size?: 'small' | 'medium' | 'large'
  state?: PictureState
  badge?: Badge
}) {
  const entry = library.tutorials.get(lesson)
  const title = entry?.tutorial.title ?? lesson
  const label = [title, state === 'started' ? 'not finished' : state === 'locked' ? 'locked' : null, badge ? BADGE_WORDS[badge] : null]
    .filter(Boolean)
    .join(', ')
  return (
    <span className={`st-learners__pic st-learners__pic--${size} st-learners__pic--${state}`} role="img" aria-label={label} title={label}>
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
}: {
  sessions: LearnerSession[]
  library: Library
  opened: string | null
  onToggle: (key: string) => void
}) {
  return (
    <section className="st-learners__section" aria-labelledby="learners-sessions">
      <div className="st-learners__panel-head">
        <h2 id="learners-sessions" className="st-learners__h2">
          {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
        </h2>
        <StripKey />
      </div>
      {sessions.length ? (
        <ol className="st-learners__sessions">
          {sessions.map((session) => (
            <SessionRow
              key={session.key}
              session={session}
              library={library}
              open={opened === session.key}
              onToggle={() => onToggle(session.key)}
            />
          ))}
        </ol>
      ) : (
        <p className="st-learners__muted">Nobody opened the app on this day.</p>
      )}
    </section>
  )
}

function SessionRow({
  session,
  library,
  open,
  onToggle,
}: {
  session: LearnerSession
  library: Library
  open: boolean
  onToggle: () => void
}) {
  const lesson = endLesson(session.end)
  const ended = session.end
  const endState: PictureState = ended.kind === 'after' ? 'finished' : ended.kind === 'atLocked' ? 'locked' : 'started'
  const tag = [
    session.isNew ? 'New' : 'Back',
    learnerTag(session),
    ageLabel(session.age),
    lastedFor(session.activeMs),
    ...session.returns.map((at) => `back at ${timeOf(at)}`),
    session.source === 'ads' ? 'Apple Ads' : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <li className={`st-learners__session${open ? ' st-learners__session--open' : ''}`}>
      <button type="button" className="st-learners__session-face" aria-expanded={open} onClick={onToggle}>
        <span className="st-learners__session-top">
          <span className="st-learners__session-time">{timeOf(session.start)}</span>
          <span className="st-learners__session-tag">{tag}</span>
          <span className="st-learners__session-end">
            <span>{endWords(ended)}</span>
            {lesson ? (
              <LessonPicture
                library={library}
                lesson={lesson}
                size="medium"
                state={endState}
                badge={ended.kind === 'after' && ended.kept ? 'kept' : undefined}
              />
            ) : null}
          </span>
        </span>
        <Strip items={session.items} library={library} />
      </button>
      {open ? <Timeline lines={session.timeline} library={library} /> : null}
      {open && !session.child ? <History session={session} library={library} /> : null}
    </li>
  )
}

/** A session's steps in order: its lessons as pictures, and small marks for the rest. */
function Strip({ items, library }: { items: SessionItem[]; library: Library }) {
  if (!items.length) {
    return (
      <span className="st-learners__strip">
        <span className="st-learners__mark st-learners__mark--opened" title="Opened the app" />
      </span>
    )
  }
  return (
    <span className="st-learners__strip">
      {items.map((item, index) => (
        <StripItem key={`${item.kind}-${item.at}-${index}`} item={item} library={library} />
      ))}
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
      return <span className="st-learners__mark st-learners__mark--bought" title="Bought Premium" />
    case 'later':
      return <span className="st-learners__mark st-learners__mark--later" title={`Came back at ${timeOf(item.at)}`} />
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
        <span className="st-learners__mark st-learners__mark--onboarding" /> onboarding
      </li>
    </ul>
  )
}

/** An opened session: every step in words, with the lesson's picture beside it. */
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
          <span className="st-learners__line-text">{line.text}</span>
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
    history.bought ? 'bought Premium' : 'not bought',
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <section className="st-learners__history" aria-label={`Every visit of ${learnerTag(session) ?? 'this learner'}`}>
      <h3 className="st-learners__history-title">
        Every visit of {learnerTag(session)} <span>{summary}</span>
      </h3>
      {days === 1 ? <p className="st-learners__muted">This is their only day so far.</p> : null}
      <ol className="st-learners__history-days">
        {history.days.map(({ day, session: visit }) => {
          const lesson = endLesson(visit.end)
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
                <span className="st-learners__session-end">
                  <span>{endWords(visit.end)}</span>
                  {lesson ? <LessonPicture library={library} lesson={lesson} state={visit.end.kind === 'after' ? 'finished' : 'started'} /> : null}
                </span>
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

function Days({ report, library, today }: { report: LearnersReport; library: Library; today: string }) {
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
          <DayCell key={day.day} day={day} most={most} library={library} future={day.day > today} first={index === 0} />
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
}: {
  day: DaySummary
  most: number
  library: Library
  future: boolean
  first: boolean
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
        <a className="st-learners__day-face" href={routeHref({ name: 'learners', period: 'day', date: day.day })}>
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
  const href = routeHref({ name: 'learners', period: 'day', date: day === dayOf(Date.now()) ? null : day })
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
              <span key={number.key} className="st-learners-summary__number">
                <strong>{number.value}</strong> {number.label.toLowerCase()}
              </span>
            ))}
          </div>
          {report.mostDrawn.length ? (
            <ul className="st-learners__drawn st-learners__drawn--compact" aria-label="Drawn most">
              {report.mostDrawn.slice(0, 10).map((drawn) => (
                <li key={drawn.lesson}>
                  <LessonPicture library={library} lesson={drawn.lesson} size="medium" />
                  <span className="st-learners__times">×{drawn.count}</span>
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
