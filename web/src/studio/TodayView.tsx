import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'

import { readToday } from './api'
import { routeHref } from './route'
import {
  ago,
  comingUp,
  DAY,
  dayKey,
  dayLabel,
  daysBetween,
  fewestOpens,
  friendlyPeriod,
  groupByDay,
  groupWork,
  isStale,
  lasted,
  leadingVariant,
  localDay,
  LOG_KINDS,
  logKind,
  OPENS_TO_DECIDE,
  perOpen,
  PHASED_SHARES,
  releaseStation,
  STATIONS,
  stripDays,
  toneWord,
  until,
  waited,
  weekOverWeek,
  type AppBuild,
  type DayValue,
  type LogKind,
  type PhasedRelease,
  type Tone,
  type TodayAds,
  type TodayEvent,
  type TodayExperiment,
  type TodayFunnel,
  type TodayItem,
  type TodayNumber,
  type TodayResponse,
  type TodayReviews,
  type TodayStatus,
} from './today'

/** How often the open page asks for a new status. Claude writes it at most a few times a day. */
const REFRESH_MS = 60_000

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const timeOnly = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const shortDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const longDay = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const whole = new Intl.NumberFormat('en-US')
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 })

/** A date in a format, or nothing for one that cannot be read: notes.json is written by hand. */
function fmt(format: Intl.DateTimeFormat, value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : format.format(date)
}

/** "$10" for whole dollars, "$10.50" otherwise. */
function dollars(value: number): string {
  return Number.isInteger(value) ? `$${whole.format(value)}` : money.format(value)
}

/**
 * Today: how Paper Coach stands and what Claude is doing about it, at a glance.
 * Claude writes the status every morning and after anything worth telling
 * (docs/ops/today.py); this page only reads it, and picks up a new one by itself.
 * Every past day is kept (`day`, #/today/YYYY-MM-DD), as it stood at its end.
 */
export function TodayView({ day, available }: { day: string | null; available: boolean }) {
  const [response, setResponse] = useState<TodayResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setResponse(await readToday(day))
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }, [day])

  useEffect(() => {
    if (!available) return
    void load()
    // A past day never changes; only the latest is worth asking for again.
    if (day) return
    const timer = window.setInterval(() => void load(), REFRESH_MS)
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [available, day, load])

  if (!available) {
    return (
      <div className="st-today">
        <h1 className="st-today__title">Today</h1>
        <p className="st-notice">
          Today needs the Studio server. Run npm run dev, or go to{' '}
          <a href={routeHref({ name: 'paths', pathId: null })}>Paths</a>.
        </p>
      </div>
    )
  }

  // Relative times ("3 h ago", "in 14 h") are worked out at each render; the refresh redraws them every minute.
  const now = new Date()
  const status = response?.status ?? null
  const days = response?.days ?? []
  const title = day ? fmt(longDay, localDay(day)) : status ? fmt(longDay, status.updated) : 'Today'
  return (
    <div className="st-today">
      <header className="st-today__masthead">
        <div className="st-today__heading">
          <h1 className="st-today__title">{title}</h1>
          {status ? <Byline status={status} past={Boolean(day)} now={now} /> : null}
        </div>
        {days.length ? <DayStrip day={day} days={days} activity={response?.activity ?? []} now={now} /> : null}
      </header>

      {error ? <p className="st-notice">The Studio server did not answer: {error}</p> : null}
      {response && !status ? <p className="st-notice">{response.problem}</p> : null}
      {status && !day && isStale(status, now) ? (
        <p className="st-notice" role="status">
          Claude has not written a status since {fmt(dateTime, status.updated)}. The morning run may not
          have happened: this Mac asleep, or the Claude app closed.
        </p>
      ) : null}

      {status ? <Status status={status} past={Boolean(day)} now={now} /> : null}
    </div>
  )
}

/** Who wrote the page and when, and when Claude looks next. */
function Byline({ status, past, now }: { status: TodayStatus; past: boolean; now: Date }) {
  const written = new Date(status.updated)
  if (past) {
    return (
      <p className="st-today__byline">
        <span>
          As it stood at the end of the day, last written at{' '}
          <time dateTime={status.updated}>{fmt(timeOnly, written)}</time>.
        </span>
      </p>
    )
  }
  const next = status.next && Date.parse(status.next.at) > now.getTime() ? status.next : null
  return (
    <p className="st-today__byline">
      <span>
        Written by Claude{' '}
        <time dateTime={status.updated} title={fmt(dateTime, written)}>
          {ago(status.updated, now)}
        </time>
        .
      </span>
      {next ? (
        <span className="st-today__next">
          <ClockIcon /> Next: {next.what}, {whenPhrase(next.at, now)}
        </span>
      ) : null}
    </p>
  )
}

/** "today at 8:00 PM", "tomorrow at 8:00 AM", "Friday at 8:00 AM", "Oct 12 at 8:00 AM". */
function whenPhrase(iso: string, now: Date): string {
  const at = new Date(iso)
  const offset = daysBetween(dayKey(now), dayKey(at))
  const time = fmt(timeOnly, at)
  if (offset === 0) return `today at ${time}`
  if (offset === 1) return `tomorrow at ${time}`
  if (offset > 1 && offset < 7) return `${new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(at)} at ${time}`
  return `${fmt(shortDate, at)} at ${time}`
}

/**
 * The last two weeks as a strip of days, each with how much Claude logged that
 * day; a day kept in the history opens as it stood at its end, and the newest
 * is the live status. Days older than the strip are in a list after it.
 */
function DayStrip({ day, days, activity, now }: { day: string | null; days: string[]; activity: DayValue[]; now: Date }) {
  const today = dayKey(now)
  const shown = stripDays(days, today)
  const kept = new Set(days)
  const counts = new Map(activity.map((entry) => [entry.day, entry.value]))
  const most = Math.max(1, ...shown.map((candidate) => counts.get(candidate) ?? 0))
  const newest = days[0]
  const selected = day ?? newest
  const earlier = days.filter((candidate) => !shown.includes(candidate))
  const go = (next: string | null) => {
    window.location.hash = routeHref({ name: 'today', day: next })
  }
  // Where the strip is narrower than its days (a phone), it opens scrolled to the day shown, not the oldest.
  const list = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const strip = list.current
    const chosen = strip?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!strip || strip.scrollWidth <= strip.clientWidth) return
    strip.scrollLeft = chosen ? chosen.offsetLeft + chosen.offsetWidth - strip.clientWidth + 8 : strip.scrollWidth
  }, [selected, shown.length])
  return (
    <nav className="st-today__strip" aria-label="Days">
      <ol ref={list}>
        {shown.map((candidate) => {
          const date = localDay(candidate)
          const count = counts.get(candidate) ?? 0
          const said = `${fmt(longDay, date)}: ${count ? `${count} logged` : 'nothing logged'}`
          const face = (
            <>
              <span className="st-today__strip-weekday">{fmt(weekday, date)}</span>
              <span className="st-today__strip-date">{date.getDate()}</span>
              <span className="st-today__strip-activity" aria-hidden="true">
                {count ? <span style={{ height: `${Math.max(14, (count / most) * 100)}%` }} /> : null}
              </span>
            </>
          )
          return (
            <li key={candidate} className={candidate === today ? 'st-today__strip-today' : undefined}>
              {kept.has(candidate) ? (
                <a
                  href={routeHref({ name: 'today', day: candidate === newest ? null : candidate })}
                  aria-current={candidate === selected ? 'page' : undefined}
                  aria-label={said}
                  title={said}
                >
                  {face}
                </a>
              ) : (
                <span className="st-today__strip-gap" title={`${fmt(longDay, date)}: nothing kept`}>
                  {face}
                </span>
              )}
            </li>
          )
        })}
      </ol>
      {earlier.length ? (
        <select
          aria-label="An earlier day"
          value={day && earlier.includes(day) ? day : ''}
          onChange={(event) => go(event.target.value || null)}
        >
          <option value="">Earlier…</option>
          {earlier.map((candidate) => (
            <option key={candidate} value={candidate}>
              {fmt(longDay, localDay(candidate))}
            </option>
          ))}
        </select>
      ) : null}
    </nav>
  )
}

function Status({ status, past, now }: { status: TodayStatus; past: boolean; now: Date }) {
  // What is coming belongs to the live page; a past day's plans have come and gone.
  const events = past ? [] : comingUp(status, now)
  // How long things had waited, on a past day, is counted to when it was last written, not to now.
  const asOf = past ? new Date(status.updated) : now
  return (
    <>
      <p className="st-today__headline">{status.headline}</p>

      <ReleaseTrack app={status.app} now={asOf} />

      <div className={events.length ? 'st-today__pair' : 'st-today__pair st-today__pair--single'}>
        <NeedsYou items={status.needsYou} now={asOf} />
        {events.length ? <ComingUp events={events} now={now} /> : null}
      </div>

      {status.numbers.length || status.funnel ? <Numbers numbers={status.numbers} funnel={status.funnel} /> : null}

      <WorkBoard items={status.working} />

      {status.ads || status.reviews ? (
        <div className="st-today__columns">
          <LogTimeline log={status.log} now={now} />
          <div className="st-today__stack">
            {status.ads ? <AdsPanel ads={status.ads} /> : null}
            {status.reviews ? <ReviewsPanel reviews={status.reviews} /> : null}
          </div>
        </div>
      ) : (
        <div className="st-today__solo">
          <LogTimeline log={status.log} now={now} />
        </div>
      )}

      {status.experiments.length ? <Tests experiments={status.experiments} /> : null}

      {status.links.length ? (
        <nav className="st-today__links" aria-label="Elsewhere">
          {status.links.map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
              {link.label} ↗
            </a>
          ))}
        </nav>
      ) : null}
    </>
  )
}

/**
 * The road every version travels, from being prepared to on sale, drawn like a
 * lesson's stroke: inked as far as the newest version has come, a faint guide
 * beyond. Each version sits at its station, the one on its way to Apple
 * marked by its state.
 */
function ReleaseTrack({ app, now }: { app: TodayStatus['app']; now: Date }) {
  const { live, inReview } = app
  const last = STATIONS.length - 1
  const pendingAt = inReview ? releaseStation(inReview, 1) : null
  const liveAt = live ? releaseStation(live, last) : null
  // The ink runs as far as the version on its way has come, or to the end when only the live one is out.
  const reached = pendingAt ?? liveAt ?? -1
  const aside = live && !inReview ? 'Nothing with Apple right now.' : inReview && !live ? 'Nothing on the App Store yet.' : null
  return (
    <section className="st-today__release" aria-labelledby="today-release">
      <div className="st-today__release-head">
        <h2 id="today-release" className="st-today__h2">
          Releases
        </h2>
        {aside ? <p className="st-today__muted">{aside}</p> : null}
      </div>
      {live || inReview ? (
        <ol className="st-today__track">
          {STATIONS.map((name, index) => {
            const here: { build: AppBuild; slot: 'live' | 'pending' }[] = []
            if (inReview && pendingAt === index) here.push({ build: inReview, slot: 'pending' })
            if (live && liveAt === index) here.push({ build: live, slot: 'live' })
            const tone = here[0]?.build.tone
            const place = here.length ? 'here' : index <= reached ? 'passed' : 'ahead'
            return (
              <li
                key={name}
                className={`st-today__station st-today__station--${place}${index < reached ? ' st-today__station--inked' : ''}`}
                data-tone={tone}
                data-moving={here.some((entry) => entry.slot === 'pending' && entry.build.tone === 'waiting') || undefined}
              >
                <span className="st-today__station-dot" aria-hidden="true" />
                <span className="st-today__station-name">{name}</span>
                {here.map((entry) => (
                  <VersionCard key={entry.slot} build={entry.build} slot={entry.slot} now={now} />
                ))}
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="st-today__quiet">Nothing on the App Store yet, and nothing with Apple.</p>
      )}
    </section>
  )
}

function VersionCard({ build, slot, now }: { build: AppBuild; slot: 'live' | 'pending'; now: Date }) {
  const phased = build.phased && build.phased.state !== 'INACTIVE' ? build.phased : null
  return (
    <article className={`st-today__version st-today__version--${build.tone}`}>
      <h3 className="st-today__version-name">
        {build.version} <span className="st-today__version-build">({build.build})</span>
        <span className="st-visually-hidden">{slot === 'live' ? ', on the App Store' : ', with Apple'}</span>
      </h3>
      <p className="st-today__version-state">
        <ToneMark tone={build.tone} /> {build.state}
      </p>
      {build.since && !Number.isNaN(Date.parse(build.since)) ? (
        <p className="st-today__version-since" title={fmt(dateTime, build.since)}>
          {slot === 'live' ? `since ${fmt(shortDate, build.since)}` : `for ${lasted(build.since, now)}`}
        </p>
      ) : null}
      {phased ? <PhasedMeter phased={phased} /> : null}
    </article>
  )
}

/** Apple's seven days of automatic updates: which day, and the share of learners it reaches. */
function PhasedMeter({ phased }: { phased: PhasedRelease }) {
  const complete = phased.state === 'COMPLETE'
  const day = complete ? PHASED_SHARES.length : Math.min(PHASED_SHARES.length, Math.max(0, phased.day))
  const said = complete
    ? 'Automatic updates reach everyone'
    : `${phased.state === 'PAUSED' ? 'Paused on' : 'Automatic updates,'} day ${day} of 7: ${PHASED_SHARES[Math.max(0, day - 1)]}%`
  return (
    <div className="st-today__phased">
      <span className="st-today__phased-days" aria-hidden="true">
        {PHASED_SHARES.map((share, index) => (
          <span key={share} className={index < day ? 'st-today__phased-on' : undefined} />
        ))}
      </span>
      <span className="st-today__phased-label">{said}</span>
    </div>
  )
}

function NeedsYou({ items, now }: { items: TodayItem[]; now: Date }) {
  return (
    <section className="st-today__needs" aria-labelledby="today-needs-you">
      <h2 id="today-needs-you" className="st-today__h2">
        Needs you {items.length ? <span className="st-today__count">{items.length}</span> : null}
      </h2>
      {items.length ? (
        <ul className="st-today__needs-list">
          {items.map((item) => {
            const age = item.since ? waited(item.since, now) : ''
            const old = item.since && DAY.test(item.since) ? daysBetween(item.since, dayKey(now)) >= 3 : false
            return (
              <li key={item.title}>
                <span className="st-today__needs-mark" aria-hidden="true">
                  !
                </span>
                <ItemBody item={item} />
                {age ? (
                  <span className={old ? 'st-today__age st-today__age--old' : 'st-today__age'} title={`Asked for on ${fmt(shortDate, localDay(item.since!))}`}>
                    {age}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="st-today__clear">
          <span aria-hidden="true">✓</span> Nothing needs you. Claude has what it needs.
        </p>
      )}
    </section>
  )
}

function ComingUp({ events, now }: { events: TodayEvent[]; now: Date }) {
  return (
    <section className="st-today__coming" aria-labelledby="today-coming">
      <h2 id="today-coming" className="st-today__h2">
        Coming up
      </h2>
      <ol className="st-today__agenda">
        {events.map((event) => {
          const dateOnly = DAY.test(event.at)
          const when = dateOnly ? localDay(event.at) : new Date(event.at)
          const offset = daysBetween(dayKey(now), dayKey(when))
          return (
            <li key={`${event.at}-${event.what}`}>
              <time dateTime={event.at} className="st-today__agenda-when">
                <span className="st-today__agenda-day">{dayLabel(dayKey(when), now)}</span>
                <span className="st-today__agenda-time">
                  {dateOnly ? (offset > 1 ? `in ${offset} days` : '') : fmt(timeOnly, when)}
                </span>
              </time>
              <span className="st-today__agenda-what">
                {event.what}
                {dateOnly ? null : <span className="st-today__agenda-in"> {until(event.at, now)}</span>}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function Numbers({ numbers, funnel }: { numbers: TodayNumber[]; funnel: TodayFunnel | null }) {
  // One row of up to six; more wrap into two even rows, and narrower screens halve it.
  const wide = numbers.length <= 6 ? numbers.length : Math.ceil(numbers.length / 2)
  const columns = {
    '--columns': wide,
    '--columns-medium': wide > 3 ? Math.ceil(wide / 2) : wide,
    '--columns-narrow': Math.min(2, wide),
  } as CSSProperties
  return (
    <section className="st-today__section" aria-labelledby="today-numbers">
      <h2 id="today-numbers" className="st-today__h2">
        Numbers
      </h2>
      {numbers.length ? (
        <div className="st-today__stats" style={columns}>
          {numbers.map((number) => (
            <StatTile key={number.label} number={number} />
          ))}
        </div>
      ) : null}
      {funnel ? <Funnel funnel={funnel} /> : null}
    </section>
  )
}

function StatTile({ number }: { number: TodayNumber }) {
  const series = number.series && number.series.length > 1 ? number.series.slice(-14) : null
  const flat = series ? series.every((day) => day.value === 0) : false
  const week = flat ? null : weekOverWeek(number.series)
  const format = number.value.trim().startsWith('$') ? (value: number) => money.format(value) : (value: number) => whole.format(value)
  return (
    <article className="st-today__stat">
      <h3 className="st-today__stat-label">{number.label}</h3>
      <p className="st-today__stat-value">
        {number.value}
        {number.tone && number.tone !== 'neutral' ? (
          <span className={`st-today__stat-tone st-today__tone--${number.tone}`}>
            <ToneMark tone={number.tone} /> {toneWord(number.tone)}
          </span>
        ) : null}
      </p>
      <p className="st-today__stat-period">
        {friendlyPeriod(number.period)}
        {number.source ? <span className="st-today__stat-source">{number.source}</span> : null}
      </p>
      {week ? (
        <p className="st-today__stat-week">
          7 days: {format(week.last)}{' '}
          <span className="st-today__delta">
            {week.last === week.before
              ? 'same as the week before'
              : `${week.last > week.before ? '▲' : '▼'} from ${format(week.before)}`}
          </span>
        </p>
      ) : number.detail && !(series && /^14 days:/.test(number.detail)) ? (
        <p className="st-today__stat-detail" title={number.detail}>
          {number.detail}
        </p>
      ) : null}
      {series ? (
        <div className="st-today__stat-trend">
          {flat ? (
            <p className="st-today__stat-flat">None in {series.length} days</p>
          ) : (
            <Sparkline series={series} label={number.label} />
          )}
        </div>
      ) : null}
    </article>
  )
}

/**
 * Up to 14 days as thin bars from a shared baseline: the earlier days recessive,
 * the day the tile reports in the accent. Each bar says its day and value on hover.
 */
function Sparkline({ series, label }: { series: DayValue[]; label: string }) {
  const max = Math.max(...series.map((day) => day.value), 0) || 1
  const height = 30
  const step = 8
  return (
    <svg
      className="st-today__spark"
      viewBox={`0 0 ${series.length * step} ${height}`}
      preserveAspectRatio="none"
      style={{ maxWidth: series.length * 14 }}
      role="img"
      aria-label={`${label}, last ${series.length} days: ${series.map((day) => day.value).join(', ')}`}
    >
      <line x1="0" x2={series.length * step} y1={height - 0.5} y2={height - 0.5} className="st-today__spark-base" />
      {series.map((day, index) => {
        const barHeight = day.value <= 0 ? 0 : Math.max(2, (day.value / max) * (height - 2))
        return (
          <g key={day.day}>
            <rect x={index * step} y={0} width={step} height={height} fill="transparent">
              <title>{`${fmt(shortDate, localDay(day.day))}: ${day.value}`}</title>
            </rect>
            {barHeight ? (
              <rect
                x={index * step + 1}
                y={height - barHeight}
                width={step - 2}
                height={barHeight}
                rx={1.5}
                className={index === series.length - 1 ? 'st-today__spark-now' : 'st-today__spark-bar'}
                pointerEvents="none"
              />
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

/** Learners at each step from a first open to a purchase, each bar against the first step. */
function Funnel({ funnel }: { funnel: TodayFunnel }) {
  const first = funnel.steps[0]?.value || 1
  return (
    <figure className="st-today__funnel">
      <figcaption className="st-today__funnel-caption">
        <span className="st-today__h3">{funnel.title ?? 'From first open to purchase'}</span>
        <span className="st-today__muted">
          {friendlyPeriod(funnel.period)}. Each share is of the step before.
        </span>
      </figcaption>
      <ol className="st-today__funnel-steps">
        {funnel.steps.map((step, index) => {
          const before = index ? funnel.steps[index - 1]!.value : null
          return (
            <li key={step.label}>
              <span className="st-today__funnel-label">{step.label}</span>
              <span className="st-today__funnel-bar" aria-hidden="true">
                <span style={{ width: `${step.value ? Math.min(100, Math.max(1, (step.value / first) * 100)) : 0}%` }} />
              </span>
              <span className="st-today__funnel-value">{whole.format(step.value)}</span>
              <span className="st-today__funnel-share">{before ? percent.format(step.value / before) : ''}</span>
            </li>
          )
        })}
      </ol>
    </figure>
  )
}

/** What Claude is on, as a board with a column per state: what runs, what waits on someone, what comes next. */
function WorkBoard({ items }: { items: TodayItem[] }) {
  const groups = groupWork(items)
  return (
    <section className="st-today__section" aria-labelledby="today-working">
      <h2 id="today-working" className="st-today__h2">
        What Claude is on
      </h2>
      {groups.length ? (
        <div className="st-today__board">
          {groups.map((group) => (
            <div key={group.label} className={`st-today__work st-today__work--${group.mark}`}>
              <h3 className="st-today__work-label">
                {group.label} <span className="st-today__work-count">{group.items.length}</span>
              </h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item.title}>
                    <ItemBody item={item} showSince />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="st-today__quiet">Nothing open.</p>
      )}
    </section>
  )
}

/** How many log entries show before "Show all". */
const LOG_SHOWN = 5

/**
 * The newest few entries, under the day they happened, each cut to two lines
 * (the full text on hover); the rest, in full, on request. Nothing is dropped
 * from the log itself: every entry stays in log.jsonl and the day's history.
 */
function LogTimeline({ log, now }: { log: TodayStatus['log']; now: Date }) {
  const [open, setOpen] = useState(false)
  const entries = open ? log : log.slice(0, LOG_SHOWN)
  return (
    <section className="st-today__section" aria-labelledby="today-log">
      <h2 id="today-log" className="st-today__h2">
        Log
      </h2>
      {log.length ? (
        <>
          <div className={open ? 'st-today__log st-today__log--open' : 'st-today__log'}>
            {groupByDay(entries).map((group) => (
              <section key={group.day} className="st-today__log-day">
                <h3 className="st-today__log-date">{dayLabel(group.day, now)}</h3>
                <ol>
                  {group.entries.map((entry) => {
                    const kind = logKind(entry)
                    return (
                      <li key={`${entry.at}-${entry.text}`} className="st-today__log-entry">
                        <time dateTime={entry.at} title={fmt(dateTime, entry.at)}>
                          {fmt(timeOnly, entry.at)}
                        </time>
                        <span className="st-today__log-icon" title={LOG_KINDS[kind]}>
                          <KindIcon kind={kind} />
                          <span className="st-visually-hidden">{LOG_KINDS[kind]}:</span>
                        </span>
                        <span className="st-today__log-text" title={open ? undefined : entry.text}>
                          {entry.text}
                        </span>
                      </li>
                    )
                  })}
                </ol>
              </section>
            ))}
          </div>
          {log.length > LOG_SHOWN ? (
            <button
              type="button"
              className="st-button st-button--compact st-today__more"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              {open ? 'Show less' : `Show all ${log.length}`}
            </button>
          ) : null}
        </>
      ) : (
        <p className="st-today__quiet">Nothing yet.</p>
      )}
    </section>
  )
}

function Tests({ experiments }: { experiments: TodayExperiment[] }) {
  return (
    <section className="st-today__section" aria-labelledby="today-tests">
      <h2 id="today-tests" className="st-today__h2">
        Paywall tests
      </h2>
      <p className="st-today__lede">
        Judged by purchases per paywall open. A test can be decided once every design has {OPENS_TO_DECIDE} opens.
      </p>
      <div className="st-today__tests">
        {experiments.map((experiment) => (
          <TestPanel key={experiment.name} experiment={experiment} />
        ))}
      </div>
    </section>
  )
}

function TestPanel({ experiment }: { experiment: TodayExperiment }) {
  const fewest = fewestOpens(experiment)
  const lead = leadingVariant(experiment)
  return (
    <article className="st-today__panel st-today__test">
      <header className="st-today__panel-head">
        <h3 className="st-today__h3">{experiment.name}</h3>
        <span className="st-today__placement">{experiment.placement}</span>
      </header>
      <p className="st-today__test-status">{experiment.status}</p>
      <SplitBar variants={experiment.variants} />
      <table className="st-today__table">
        <thead>
          <tr>
            <th scope="col">Design</th>
            <th scope="col">Share</th>
            <th scope="col">Opens</th>
            <th scope="col">Trials</th>
            <th scope="col">Bought</th>
            <th scope="col">Per open</th>
          </tr>
        </thead>
        <tbody>
          {experiment.variants.map((variant, index) => {
            const rate = perOpen(variant.purchases, variant.opens)
            return (
              <tr key={variant.name}>
                <th scope="row">
                  <span className="st-today__swatch" style={{ background: variantColor(index) }} aria-hidden="true" />
                  {variant.name}
                </th>
                <td>{variant.share}%</td>
                <td>{variant.opens != null ? whole.format(variant.opens) : '–'}</td>
                <td>{variant.trials != null ? whole.format(variant.trials) : '–'}</td>
                <td>{variant.purchases != null ? whole.format(variant.purchases) : '–'}</td>
                <td className={variant.name === lead ? 'st-today__lead' : undefined} title={variant.name === lead ? 'Ahead so far' : undefined}>
                  {rate == null ? '–' : percent.format(rate)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="st-today__decide">
        <Meter
          value={fewest}
          max={OPENS_TO_DECIDE}
          label={`${fewest} of the ${OPENS_TO_DECIDE} opens a decision needs, on the design with the fewest`}
          tone="good"
        />
        <p className="st-today__muted">
          {fewest >= OPENS_TO_DECIDE
            ? 'Every design has the opens a decision needs.'
            : `${whole.format(fewest)} of ${OPENS_TO_DECIDE} opens on the design with the fewest`}
        </p>
      </div>
      {experiment.note ? <p className="st-today__muted">{experiment.note}</p> : null}
    </article>
  )
}

/** The dataviz palette's first four categorical slots, validated together; a fifth design folds to gray. */
function variantColor(index: number): string {
  return index < 4 ? `var(--today-variant-${index + 1})` : 'var(--ink-faint)'
}

/** How the test splits its traffic: one bar, a segment per design in its color, the share inside when it fits. */
function SplitBar({ variants }: { variants: TodayExperiment['variants'] }) {
  const total = variants.reduce((sum, variant) => sum + variant.share, 0) || 1
  return (
    <div
      className="st-today__split"
      role="img"
      aria-label={`Traffic split: ${variants.map((variant) => `${variant.name} ${variant.share}%`).join(', ')}`}
    >
      {variants.map((variant, index) => (
        <span
          key={variant.name}
          className={index === 0 ? 'st-today__split-light' : undefined}
          style={{ flexGrow: variant.share, background: variantColor(index) }}
          title={`${variant.name}: ${variant.share}%`}
        >
          {variant.share / total >= 0.14 ? `${variant.share}%` : ''}
        </span>
      ))}
    </div>
  )
}

function AdsPanel({ ads }: { ads: TodayAds }) {
  const ceiling = ads.spendCeiling
  const most = Math.max(0, ...ads.campaigns.map((campaign) => campaign.spend)) || 1
  return (
    <section className="st-today__section" aria-labelledby="today-ads">
      <h2 id="today-ads" className="st-today__h2">
        Apple Ads
      </h2>
      <article className="st-today__panel">
        <p className="st-today__ads-head">
          <span className={`st-pill st-today__ads-state st-today__ads-state--${ads.state}`}>{ads.state}</span>
          {ads.dailyCap != null ? (
            <span>
              <strong>{dollars(ads.dailyCap)}</strong> a day
            </span>
          ) : null}
        </p>
        <div className="st-today__budget">
          <p className="st-today__budget-line">
            <strong className="st-today__budget-spent">{money.format(ads.spentToDate)}</strong>
            <span>
              spent
              {ceiling ? ` of the ${dollars(ceiling)} the ads may spend so far` : ''}
            </span>
          </p>
          {ceiling ? (
            <Meter
              value={ads.spentToDate}
              max={ceiling}
              label={`Spent ${money.format(ads.spentToDate)} of the ${money.format(ceiling)} the ads may spend so far`}
            />
          ) : null}
          {ads.earnedToDate != null ? (
            <p className="st-today__muted">{money.format(ads.earnedToDate)} earned back from learners the ads brought</p>
          ) : null}
        </div>
        {ads.note ? <p className="st-today__muted">{ads.note}</p> : null}
        {ads.campaigns.length ? (
          <table className="st-today__table">
            <thead>
              <tr>
                <th scope="col">Campaign</th>
                <th scope="col">Spend</th>
                <th scope="col">Installs</th>
                <th scope="col">Trials</th>
                <th scope="col">Per install</th>
              </tr>
            </thead>
            <tbody>
              {ads.campaigns.map((campaign) => (
                <tr key={campaign.name}>
                  <th scope="row">
                    {campaign.name}
                    <span className="st-today__campaign-status">{campaign.status}</span>
                  </th>
                  <td>
                    <span className="st-today__spend">
                      <span className="st-today__spend-bar" aria-hidden="true">
                        <span style={{ width: `${(campaign.spend / most) * 100}%` }} />
                      </span>
                      {money.format(campaign.spend)}
                    </span>
                  </td>
                  <td>{whole.format(campaign.installs)}</td>
                  <td>{campaign.trials != null ? whole.format(campaign.trials) : '–'}</td>
                  <td>{campaign.costPerInstall != null ? money.format(campaign.costPerInstall) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </article>
    </section>
  )
}

function ReviewsPanel({ reviews }: { reviews: TodayReviews }) {
  // Apple's lookup answers 0 for an app nobody has rated yet; that is no rating, not a zero-star one.
  const rated = reviews.average != null && reviews.average > 0 && reviews.count > 0
  const unanswered = reviews.latest.filter((review) => !review.replied).length
  return (
    <section className="st-today__section" aria-labelledby="today-reviews">
      <h2 id="today-reviews" className="st-today__h2">
        Reviews
      </h2>
      <article className="st-today__panel">
        <div className="st-today__rating">
          {rated ? (
            <>
              <span className="st-today__rating-value">{reviews.average!.toFixed(1)}</span>
              <Stars rating={reviews.average!} />
              <span className="st-today__muted">
                {whole.format(reviews.count)} rating{reviews.count === 1 ? '' : 's'} in the US
              </span>
            </>
          ) : (
            <span className="st-today__rating-none">No ratings yet</span>
          )}
        </div>
        {unanswered ? (
          <p className="st-today__unanswered">
            <ToneMark tone="attention" /> {unanswered} written review{unanswered === 1 ? '' : 's'} not replied to yet
          </p>
        ) : null}
        {reviews.latest.length ? (
          <ul className="st-today__reviews">
            {reviews.latest.slice(0, 6).map((review) => (
              <li key={`${review.date}-${review.title}`}>
                <p className="st-today__review-head">
                  <Stars rating={review.rating} />
                  <strong>{review.title}</strong>
                </p>
                {review.body ? <p className="st-today__review-body">{review.body}</p> : null}
                <p className="st-today__muted">
                  {[fmt(shortDate, review.date), review.territory, review.replied ? 'replied' : 'not replied to yet']
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="st-today__muted">No written reviews yet.</p>
        )}
      </article>
    </section>
  )
}

function Stars({ rating }: { rating: number }) {
  const full = Math.min(5, Math.max(0, Math.round(rating) || 0))
  return (
    <span className="st-today__stars" role="img" aria-label={`${rating % 1 ? rating.toFixed(1) : rating} of 5 stars`}>
      {'★'.repeat(full)}
      <span className="st-today__stars-off">{'★'.repeat(5 - full)}</span>
    </span>
  )
}

function ItemBody({ item, showSince = false }: { item: TodayItem; showSince?: boolean }) {
  return (
    <div className="st-today__item">
      <span className="st-today__item-title">
        {item.url ? (
          <a href={item.url} target="_blank" rel="noreferrer">
            {item.title}
          </a>
        ) : (
          item.title
        )}
      </span>
      {item.detail ? <span className="st-today__item-detail">{item.detail}</span> : null}
      {showSince && item.since && DAY.test(item.since) ? (
        <span className="st-today__item-since">since {fmt(shortDate, localDay(item.since))}</span>
      ) : null}
    </div>
  )
}

/** A state as a mark and a word, never a color alone. */
function ToneMark({ tone }: { tone: Tone }) {
  const mark = { good: '✓', waiting: '◷', attention: '!', bad: '✕', neutral: '•' }[tone]
  return (
    <span className={`st-today__tone st-today__tone--${tone}`} title={toneWord(tone) || undefined} aria-hidden="true">
      {mark}
    </span>
  )
}

function Meter({ value, max, label, tone }: { value: number; max: number; label: string; tone?: 'good' }) {
  const share = Math.min(1, Math.max(0, value / max))
  const near = !tone && share > 0.9
  return (
    <div className="st-today__meter" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <span
        style={{ width: `${share * 100}%` }}
        className={near ? 'st-today__meter-fill--near' : tone === 'good' && share >= 1 ? 'st-today__meter-fill--done' : undefined}
      />
    </div>
  )
}

function ClockIcon() {
  return (
    <svg className="st-today__icon" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.75V8l2.25 1.5" />
    </svg>
  )
}

/** One small line drawing per kind of log entry; the kind's name goes with it for screen readers and on hover. */
function KindIcon({ kind }: { kind: LogKind }) {
  const drawing: Record<LogKind, JSX.Element> = {
    release: <path d="M14.25 1.75 1.75 7.1l5 1.9m7.5-7.25L9 14.25 6.75 9m7.5-7.25L6.75 9" />,
    review: <path d="M8 2l1.7 4.25 4.58.31-3.52 2.94 1.12 4.44L8 11.5l-3.88 2.44 1.12-4.44-3.52-2.94 4.58-.31z" />,
    ads: (
      <>
        <path d="M2.25 6.25h2.5l6.5-3.5v10.5l-6.5-3.5h-2.5z" />
        <path d="M5.5 10.25 6.75 14" />
      </>
    ),
    tests: (
      <>
        <rect x="2" y="3" width="12" height="10" rx="2" />
        <path d="M8 3v10" />
      </>
    ),
    social: (
      <>
        <rect x="1.75" y="3" width="12.5" height="10" rx="2.5" />
        <path d="M6.75 5.9v4.2L10.25 8z" />
      </>
    ),
    build: <path d="M5.5 4.5 2 8l3.5 3.5m5-7L14 8l-3.5 3.5" />,
    money: (
      <>
        <path d="M2 2.5h5.5l6.5 6.5-5 5-6.5-6.5z" />
        <circle cx="5.25" cy="5.75" r="1" />
      </>
    ),
    learners: (
      <>
        <circle cx="8" cy="5" r="2.5" />
        <path d="M3.25 14c0-2.75 2.1-4.75 4.75-4.75S12.75 11.25 12.75 14" />
      </>
    ),
    check: (
      <>
        <circle cx="8" cy="8" r="6.25" />
        <path d="m5.25 8.25 1.9 1.9 3.6-3.9" />
      </>
    ),
    other: <circle cx="8" cy="8" r="1.75" className="st-today__icon-dot" />,
  }
  return (
    <svg className="st-today__icon" viewBox="0 0 16 16" aria-hidden="true">
      {drawing[kind]}
    </svg>
  )
}
