import { useCallback, useEffect, useState } from 'react'

import { readToday } from './api'
import { routeHref } from './route'
import {
  ago,
  isStale,
  toneWord,
  type AppBuild,
  type DayValue,
  type Tone,
  type TodayItem,
  type TodayNumber,
  type TodayResponse,
  type TodayStatus,
} from './today'

/** How often the open page asks for a new status. Claude writes it at most a few times a day. */
const REFRESH_MS = 60_000

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const shortDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const longDay = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

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
        <p className="st-notice">Today needs the Studio server. Run npm run dev.</p>
      </div>
    )
  }

  const status = response?.status ?? null
  const days = response?.days ?? []
  return (
    <div className="st-today">
      <header className="st-today__head">
        <div>
          <h1 className="st-today__title">{day ? longDay.format(localDay(day)) : 'Today'}</h1>
          {status ? (
            <p className="st-today__meta">
              {day ? 'As it stood at the end of the day, last written ' : 'Written by Claude '}
              {day ? null : `${ago(status.updated)} · `}
              <time dateTime={status.updated}>{dateTime.format(new Date(status.updated))}</time>
              {status.next && !day ? (
                <>
                  {' '}
                  · next: {status.next.what}, {dateTime.format(new Date(status.next.at))}
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        {days.length ? <DayPicker day={day} days={days} /> : null}
      </header>

      {error ? <p className="st-notice">The Studio server did not answer: {error}</p> : null}
      {response && !status ? <p className="st-notice">{response.problem}</p> : null}
      {status && !day && isStale(status) ? (
        <p className="st-notice" role="status">
          Claude has not written a status since {dateTime.format(new Date(status.updated))}. The morning run may not
          have happened: this Mac asleep, or the Claude app closed.
        </p>
      ) : null}

      {status ? <Status status={status} /> : null}
    </div>
  )
}

/** Earlier and later days, and a list of every day kept. The newest is the live status. */
function DayPicker({ day, days }: { day: string | null; days: string[] }) {
  // `days` is newest first; the live status stands in for the newest day.
  const index = day ? days.indexOf(day) : 0
  const earlier = index >= 0 && index + 1 < days.length ? days[index + 1] : null
  const later = day && index > 1 ? days[index - 1] : null
  const go = (next: string | null) => {
    window.location.hash = routeHref({ name: 'today', day: next })
  }
  return (
    <div className="st-today__days" role="group" aria-label="Day">
      <button type="button" className="st-button st-button--compact" disabled={!earlier} onClick={() => go(earlier)}>
        ← Earlier
      </button>
      <select
        aria-label="Show a day"
        value={day ?? ''}
        onChange={(event) => go(event.target.value || null)}
      >
        <option value="">Now</option>
        {days.map((candidate, position) =>
          position === 0 && !day ? null : (
            <option key={candidate} value={candidate}>
              {longDay.format(localDay(candidate))}
            </option>
          ),
        )}
      </select>
      <button type="button" className="st-button st-button--compact" disabled={!day} onClick={() => go(later)}>
        {later ? 'Later →' : 'Now →'}
      </button>
    </div>
  )
}

function Status({ status }: { status: TodayStatus }) {
  return (
    <>
      <p className="st-today__headline">{status.headline}</p>

      <section className="st-today__apps" aria-label="The app">
        <BuildCard label="On the App Store" build={status.app.live} empty="Not on sale yet" />
        <BuildCard label="With Apple" build={status.app.inReview} empty="Nothing in review" />
      </section>

      <section className="st-today__section" aria-labelledby="today-needs-you">
        <h2 id="today-needs-you" className="st-today__h2">
          Needs you
        </h2>
        {status.needsYou.length ? (
          <ul className="st-today__needs">
            {status.needsYou.map((item) => (
              <li key={item.title}>
                <ItemBody item={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="st-today__quiet">Nothing. Claude has what it needs.</p>
        )}
      </section>

      {status.numbers.length ? (
        <section className="st-today__section" aria-labelledby="today-numbers">
          <h2 id="today-numbers" className="st-today__h2">
            Numbers
          </h2>
          <div className="st-today__tiles">
            {status.numbers.map((number) => (
              <StatTile key={number.label} number={number} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="st-today__columns">
        <section className="st-today__section" aria-labelledby="today-working">
          <h2 id="today-working" className="st-today__h2">
            What Claude is on
          </h2>
          {status.working.length ? (
            <ul className="st-today__work">
              {status.working.map((item) => (
                <li key={item.title}>
                  {item.state ? <span className={`st-today__state st-today__state--${item.state}`}>{item.state}</span> : null}
                  <ItemBody item={item} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="st-today__quiet">Nothing open.</p>
          )}
        </section>

        <section className="st-today__section" aria-labelledby="today-log">
          <h2 id="today-log" className="st-today__h2">
            Log
          </h2>
          {status.log.length ? <LogList log={status.log} /> : <p className="st-today__quiet">Nothing yet.</p>}
        </section>
      </div>

      {status.experiments.length ? (
        <section className="st-today__section" aria-labelledby="today-tests">
          <h2 id="today-tests" className="st-today__h2">
            Paywall A/B tests
          </h2>
          <div className="st-today__cards">
            {status.experiments.map((experiment) => (
              <article key={experiment.name} className="st-today__card">
                <h3 className="st-today__h3">
                  {experiment.name} <span className="st-today__muted">· {experiment.placement}</span>
                </h3>
                <p className="st-today__muted">
                  {experiment.status}
                  {experiment.note ? ` · ${experiment.note}` : ''}
                </p>
                <table className="st-today__table">
                  <thead>
                    <tr>
                      <th scope="col">Variant</th>
                      <th scope="col">Share</th>
                      <th scope="col">Opens</th>
                      <th scope="col">Trials</th>
                      <th scope="col">Bought</th>
                    </tr>
                  </thead>
                  <tbody>
                    {experiment.variants.map((variant) => (
                      <tr key={variant.name}>
                        <th scope="row">{variant.name}</th>
                        <td>{variant.share}%</td>
                        <td>{variant.opens ?? '–'}</td>
                        <td>{variant.trials ?? '–'}</td>
                        <td>{variant.purchases ?? '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {status.ads ? (
        <section className="st-today__section" aria-labelledby="today-ads">
          <h2 id="today-ads" className="st-today__h2">
            Apple Ads
          </h2>
          <article className="st-today__card">
            <p className="st-today__adsline">
              <span className="st-pill">{status.ads.state}</span>
              {status.ads.dailyCap != null ? <span>{money.format(status.ads.dailyCap)} a day</span> : null}
              <span>
                {money.format(status.ads.spentToDate)} spent
                {status.ads.earnedToDate != null ? `, ${money.format(status.ads.earnedToDate)} earned back` : ''}
              </span>
            </p>
            {status.ads.spendCeiling ? (
              <Meter
                value={status.ads.spentToDate}
                max={status.ads.spendCeiling}
                label={`Spent ${money.format(status.ads.spentToDate)} of the ${money.format(status.ads.spendCeiling)} the ads may spend so far`}
              />
            ) : null}
            {status.ads.note ? <p className="st-today__muted">{status.ads.note}</p> : null}
            {status.ads.campaigns.length ? (
              <table className="st-today__table">
                <thead>
                  <tr>
                    <th scope="col">Campaign</th>
                    <th scope="col">Status</th>
                    <th scope="col">Spend</th>
                    <th scope="col">Installs</th>
                    <th scope="col">Trials</th>
                    <th scope="col">Per install</th>
                  </tr>
                </thead>
                <tbody>
                  {status.ads.campaigns.map((campaign) => (
                    <tr key={campaign.name}>
                      <th scope="row">{campaign.name}</th>
                      <td>{campaign.status}</td>
                      <td>{money.format(campaign.spend)}</td>
                      <td>{campaign.installs}</td>
                      <td>{campaign.trials ?? '–'}</td>
                      <td>{campaign.costPerInstall != null ? money.format(campaign.costPerInstall) : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </article>
        </section>
      ) : null}

      {status.reviews ? (
        <section className="st-today__section" aria-labelledby="today-reviews">
          <h2 id="today-reviews" className="st-today__h2">
            App Store reviews
          </h2>
          <p className="st-today__muted">
            {status.reviews.average != null
              ? `${status.reviews.average.toFixed(1)}★ from ${status.reviews.count} ratings`
              : `${status.reviews.count} written reviews, no rating shown yet`}
          </p>
          {status.reviews.latest.length ? (
            <ul className="st-today__reviews">
              {status.reviews.latest.slice(0, 6).map((review) => (
                <li key={`${review.date}-${review.title}`}>
                  <span className="st-today__stars" aria-label={`${review.rating} of 5 stars`}>
                    {'★'.repeat(review.rating)}
                    <span aria-hidden="true" className="st-today__stars-off">
                      {'★'.repeat(5 - review.rating)}
                    </span>
                  </span>
                  <strong>{review.title}</strong>
                  <span className="st-today__muted">
                    {shortDate.format(new Date(review.date))}
                    {review.territory ? ` · ${review.territory}` : ''} · {review.replied ? 'replied' : 'not replied yet'}
                  </span>
                  {review.body ? <p>{review.body}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

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

/** How many log entries show before "Show all". */
const LOG_SHOWN = 5

/**
 * The newest few entries, each cut to two lines (the full text on hover); the rest, in full, on request.
 * Nothing is dropped from the log itself: every entry stays in log.jsonl and the day's history.
 */
function LogList({ log }: { log: TodayStatus['log'] }) {
  const [open, setOpen] = useState(false)
  const entries = open ? log : log.slice(0, LOG_SHOWN)
  return (
    <>
      <ol className={open ? 'st-today__log st-today__log--open' : 'st-today__log'}>
        {entries.map((entry) => (
          <li key={`${entry.at}-${entry.text}`}>
            <time dateTime={entry.at}>{dateTime.format(new Date(entry.at))}</time>
            <span title={open ? undefined : entry.text}>{entry.text}</span>
          </li>
        ))}
      </ol>
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
  )
}

function BuildCard({ label, build, empty }: { label: string; build: AppBuild | null; empty: string }) {
  return (
    <article className="st-today__card st-today__build">
      <h2 className="st-today__label">{label}</h2>
      {build ? (
        <>
          <p className="st-today__version">
            {build.version} <span className="st-today__muted">({build.build})</span>
          </p>
          <p>
            <ToneMark tone={build.tone} /> {build.state}
            {build.since ? <span className="st-today__muted"> · since {dateTime.format(new Date(build.since))}</span> : null}
          </p>
        </>
      ) : (
        <p className="st-today__muted">{empty}</p>
      )}
    </article>
  )
}

/** A YYYY-MM-DD as that day on this clock (a bare `new Date` would read it as UTC midnight, the day before here). */
function localDay(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value)
}

function ItemBody({ item }: { item: TodayItem }) {
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
        {item.since ? <span className="st-today__muted"> · since {shortDate.format(localDay(item.since))}</span> : null}
      </span>
      {item.detail ? <span className="st-today__item-detail">{item.detail}</span> : null}
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

function StatTile({ number }: { number: TodayNumber }) {
  return (
    <article className="st-today__tile">
      <h3 className="st-today__label">{number.label}</h3>
      <p className="st-today__value">
        {number.value}
        {number.tone && number.tone !== 'neutral' ? (
          <span className={`st-today__tone st-today__tone--${number.tone}`}> {toneWord(number.tone)}</span>
        ) : null}
      </p>
      <p className="st-today__muted">
        {number.period}
        {number.detail ? ` · ${number.detail}` : ''}
      </p>
      {number.series && number.series.length > 1 ? <Sparkline series={number.series} label={number.label} /> : null}
    </article>
  )
}

/**
 * Up to 14 days as thin bars from a shared baseline: the earlier days recessive,
 * the day the tile reports in the accent. Each bar says its day and value on hover.
 */
function Sparkline({ series, label }: { series: DayValue[]; label: string }) {
  const days = series.slice(-14)
  const max = Math.max(1, ...days.map((day) => day.value))
  const height = 28
  const step = 8
  return (
    <svg
      className="st-today__spark"
      viewBox={`0 0 ${days.length * step} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${label}, last ${days.length} days: ${days.map((day) => day.value).join(', ')}`}
    >
      <line x1="0" x2={days.length * step} y1={height - 0.5} y2={height - 0.5} className="st-today__spark-base" />
      {days.map((day, index) => {
        const barHeight = day.value === 0 ? 0 : Math.max(2, (day.value / max) * (height - 2))
        return (
          <g key={day.day}>
            <rect x={index * step} y={0} width={step} height={height} fill="transparent">
              <title>{`${day.day}: ${day.value}`}</title>
            </rect>
            {barHeight ? (
              <rect
                x={index * step + 1}
                y={height - barHeight}
                width={step - 2}
                height={barHeight}
                rx={1.5}
                className={index === days.length - 1 ? 'st-today__spark-now' : 'st-today__spark-bar'}
                pointerEvents="none"
              />
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const share = Math.min(1, Math.max(0, value / max))
  return (
    <div className="st-today__meter" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <span style={{ width: `${share * 100}%` }} className={share > 0.9 ? 'st-today__meter-fill--near' : undefined} />
    </div>
  )
}
