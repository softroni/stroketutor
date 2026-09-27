import { useCallback, useEffect, useMemo, useState } from 'react'

import { listScreenshots } from './api'
import { routeHref } from './route'
import { neighbour, type Screenshot, type ScreenshotDevice, type ScreenshotList } from './screenshots'

/** How often the page asks whether anything was rendered again, while it is open. */
const REFRESH_MS = 15_000

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/**
 * The App Store screenshots as they stand in the repository
 * (`docs/app-store/marketing/out`), for one device at a time: the first three
 * as App Store search shows them, then every shot in listing order. A shot opens
 * full size, where ←/→ step through them and Esc closes. Read-only: render.mjs
 * makes them, and this page picks up a new render by itself, a git pull included.
 */
export function ScreenshotsView({
  device,
  shotId,
  available,
}: {
  device: ScreenshotDevice
  shotId: string | null
  /** False in a static build, which has no server to list the files. */
  available: boolean
}) {
  const [list, setList] = useState<ScreenshotList | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const next = await listScreenshots()
      setError(null)
      // Keep the same object while nothing changed, so the images are not rebuilt.
      setList((current) =>
        current && current.updated === next.updated && current.commit?.hash === next.commit?.hash ? current : next,
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }, [])

  useEffect(() => {
    if (!available) return
    void load()
    const timer = window.setInterval(() => void load(), REFRESH_MS)
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [available, load])

  const set = list?.sets.find((candidate) => candidate.device === device) ?? null
  const shots = useMemo(() => set?.shots ?? [], [set])
  const open = shotId ? (shots.find((shot) => shot.id === shotId) ?? null) : null

  if (!available) {
    return (
      <div className="st-shots">
        <h1 className="st-shots__title">App Store screenshots</h1>
        <p className="st-notice">The screenshots need the Studio server. Run npm run dev.</p>
      </div>
    )
  }

  return (
    <div className="st-shots">
      <header className="st-shots__head">
        <div>
          <h1 className="st-shots__title">App Store screenshots</h1>
          <p className="st-shots__meta">
            {list ? <Provenance list={list} /> : 'Reading docs/app-store/marketing/out…'}
          </p>
        </div>
        <div className="st-segmented" role="group" aria-label="Device">
          {(list?.sets ?? []).map((candidate) => (
            <button
              key={candidate.device}
              type="button"
              aria-pressed={candidate.device === device}
              onClick={() => navigate({ device: candidate.device, shot: null })}
            >
              {candidate.label} <span className="st-shots__count">{candidate.shots.length}</span>
            </button>
          ))}
        </div>
      </header>

      {error ? (
        <p className="st-notice st-notice--error" role="alert">
          {error}
        </p>
      ) : null}

      {set && shots.length === 0 ? (
        <p className="st-empty">
          No {set.label} screenshots yet. Render them with <code>node docs/app-store/marketing/render.mjs</code>.
        </p>
      ) : null}

      {shots.length > 0 ? (
        <>
          <section className="st-shots__section">
            <h2 className="st-section-heading">In App Store search</h2>
            <p className="st-section-note">
              Search results show the first three side by side at about a third of the screen's width, so each has
              to read at this size.
            </p>
            <div className={`st-shots__search st-shots__search--${device}`}>
              {shots.slice(0, 3).map((shot) => (
                <a key={shot.id} href={hrefFor(device, shot.id)} title={shot.title}>
                  <img src={shot.url} alt={shot.title} />
                </a>
              ))}
            </div>
          </section>

          <section className="st-shots__section">
            <h2 className="st-section-heading">
              All {shots.length} in listing order
              {set?.width ? (
                <span className="st-shots__size">
                  {' '}
                  · {set.width} × {set.height}
                </span>
              ) : null}
            </h2>
            <div className={`st-shots__grid st-shots__grid--${device}`}>
              {shots.map((shot) => (
                <a key={shot.id} className="st-shots__card" href={hrefFor(device, shot.id)}>
                  <img src={shot.url} alt={shot.title} loading="lazy" />
                  <span className="st-shots__caption">
                    <b>{shot.number}</b> {shot.title}
                  </span>
                </a>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {open ? <Viewer device={device} shots={shots} open={open} /> : null}
    </div>
  )
}

/** One shot full size, with the others in a strip below. */
function Viewer({ device, shots, open }: { device: ScreenshotDevice; shots: Screenshot[]; open: Screenshot }) {
  const step = useCallback(
    (by: 1 | -1) => {
      const next = neighbour(shots, open.id, by)
      if (next) navigate({ device, shot: next.id }, { replace: true })
    },
    [device, open.id, shots],
  )
  const close = useCallback(() => navigate({ device, shot: null }, { replace: true }), [device])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'ArrowRight') step(1)
      else if (event.key === 'ArrowLeft') step(-1)
      else if (event.key === 'Escape') close()
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close, step])

  const position = shots.findIndex((shot) => shot.id === open.id) + 1

  return (
    <div className="st-shots-viewer" role="dialog" aria-modal="true" aria-label={open.title}>
      <div className="st-shots-viewer__bar">
        <span className="st-shots-viewer__title">
          <b>
            {position} of {shots.length}
          </b>{' '}
          {open.title}
        </span>
        <span className="st-shots-viewer__actions">
          <span className="st-shots-viewer__hint">← → to step · Esc to close</span>
          <a className="st-button st-button--compact" href={open.url} target="_blank" rel="noreferrer">
            Open the PNG
          </a>
          <button type="button" className="st-button st-button--compact" onClick={close}>
            Close
          </button>
        </span>
      </div>

      <div className="st-shots-viewer__stage" onClick={(event) => event.target === event.currentTarget && close()}>
        <button type="button" className="st-shots-viewer__step" aria-label="Previous" onClick={() => step(-1)}>
          ‹
        </button>
        <img className="st-shots-viewer__image" src={open.url} alt={open.title} />
        <button type="button" className="st-shots-viewer__step" aria-label="Next" onClick={() => step(1)}>
          ›
        </button>
      </div>

      <nav className="st-shots-viewer__strip" aria-label="Screenshots">
        {shots.map((shot) => (
          <a
            key={shot.id}
            href={hrefFor(device, shot.id)}
            aria-current={shot.id === open.id ? 'true' : undefined}
            title={`${shot.number} ${shot.title}`}
            onClick={(event) => {
              event.preventDefault()
              navigate({ device, shot: shot.id }, { replace: true })
            }}
          >
            <img src={shot.url} alt="" />
          </a>
        ))}
      </nav>
    </div>
  )
}

function Provenance({ list }: { list: ScreenshotList }) {
  return (
    <>
      {list.updated ? <>Rendered {dateTime.format(new Date(list.updated))}</> : 'Nothing rendered yet'}
      {list.commit ? (
        <>
          {' · last committed '}
          <code title={list.commit.subject}>{list.commit.hash}</code> {dateTime.format(new Date(list.commit.date))}
        </>
      ) : null}
      {' · refreshes by itself'}
    </>
  )
}

function hrefFor(device: ScreenshotDevice, shot: string | null) {
  return routeHref({ name: 'screenshots', device, shot })
}

/** Opening a shot adds a history entry (Back closes it); stepping and closing replace it. */
function navigate(to: { device: ScreenshotDevice; shot: string | null }, { replace = false } = {}) {
  const href = hrefFor(to.device, to.shot)
  if (replace) window.location.replace(href)
  else window.location.hash = href
}
