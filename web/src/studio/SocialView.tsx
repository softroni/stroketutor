import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'

import type { Tutorial } from '../schema/types'

import { madeVideoUrl, readSocialPosts } from './api'
import { FinishedDrawing } from './FinishedDrawing'
import type { Library } from './library'
import { routeHref } from './route'
import {
  fileSize,
  madeKind,
  madeNote,
  nearDay,
  platformName,
  platformState,
  postKind,
  postStatus,
  reach,
  tally,
  type ComingPost,
  type MadeVideo,
  type PlatformState,
  type SocialPlatform,
  type SocialPost,
  type SocialResponse,
} from './social'
import { localDay } from './today'

const longDay = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

/** The mark before a platform's words, so its state never rests on color alone; a link has ↗ after it instead. */
const MARKS: Record<PlatformState['state'], string> = { live: '✓', waiting: '◷', held: '!', failed: '✕' }

/**
 * Social: every lesson video, speed draw, step pin and piece of release news
 * posted to Softroni's accounts, day by day in Central time (where the posting
 * job runs), each with a link to the post on every platform, or why there is
 * none yet; and above them, the lessons the daily job posts next. `studio
 * social` posts them (docs/ops/README.md); this page only reads its record,
 * when it is opened and when the tab comes back. It wears the Today page's
 * paper, tones and type (`.st-today`).
 */
export function SocialView({ library }: { library: Library }) {
  const available = library.writable
  const [response, setResponse] = useState<SocialResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setResponse(await readSocialPosts())
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }, [])

  useEffect(() => {
    if (!available) return
    void load()
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [available, load])

  // Times where the posts went out, whatever this browser's clock says.
  const timeZone = response?.timeZone
  const clock = useMemo((): Clock => {
    const time = formatIn(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }))
    return {
      // "9:00 PM" stays on one line: never "9:00" at the end of one and "PM" on the next.
      time: (iso) => time(iso).replace(/\s(?=[AP]M$)/, '\u00a0'),
      date: formatIn(new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', month: 'long', day: 'numeric' })),
      full: formatIn(
        new Intl.DateTimeFormat('en-US', {
          timeZone,
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        }),
      ),
    }
  }, [timeZone])

  if (!available) {
    return (
      <div className="st-today st-social">
        <h1 className="st-today__title">Social</h1>
        <p className="st-notice">The posts need the Studio server. Run npm run dev.</p>
      </div>
    )
  }

  const days = response?.days ?? []
  // The soonest post Upload-Post holds to publish later, which the note under Coming up points at.
  const scheduled = days
    .flatMap((day) => day.posts)
    .filter((post) => post.status === 'scheduled')
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0]
  return (
    <div className="st-today st-social">
      <header className="st-social__masthead">
        <h1 className="st-today__title">Social</h1>
        <p className="st-today__byline">
          {!response ? <span>Reading the posts…</span> : null}
          {days.length ? <span>{tally(days)} Days and times are Central.</span> : null}
          {days.length && response?.source === 'kept' ? (
            <span className="st-social__source">From the repo’s copy on ops-history: posts show once they have finished.</span>
          ) : null}
        </p>
      </header>

      {error ? <p className="st-notice">The Studio server did not answer: {error}</p> : null}
      {response && (response.coming || response.comingProblem) ? (
        <ComingUp coming={response.coming ?? []} problem={response.comingProblem} scheduled={scheduled} library={library} clock={clock} />
      ) : null}
      {response?.made?.length ? <MadeVideos made={response.made} coming={response.coming ?? []} clock={clock} /> : null}
      {response && !days.length ? (
        <p className="st-social__empty">Nothing posted yet. The daily post goes out at 5 PM Central.</p>
      ) : null}

      {days.map(({ day, posts }) => {
        const near = response ? nearDay(day, response.today) : null
        return (
          <section key={day} className="st-social__day" aria-labelledby={`social-${day}`}>
            <h2 id={`social-${day}`} className="st-social__h2">
              {dayName(day)}
              {near ? <span className="st-social__near">{near}</span> : null}
            </h2>
            <ol className="st-social__posts">
              {posts.map((post) => (
                <Post key={post.requestId} post={post} tutorial={library.tutorials.get(post.lessonId)?.tutorial} clock={clock} />
              ))}
            </ol>
          </section>
        )
      })}
    </div>
  )
}

/** A moment as a time of day ("11:12 PM"), its day ("Thursday, October 1"), and in full for a tooltip, where the posts go out. */
interface Clock {
  time: (iso: string) => string
  date: (iso: string) => string
  full: (iso: string) => string
}

/**
 * The lessons the daily job posts next, one a day at 17:00 Central, as `social
 * next` will pick them, each with the step pin that follows it on Pinterest.
 * The 17:45 social check is the `paper-coach-social` routine (docs/ops/README.md, "A day").
 */
function ComingUp({
  coming,
  problem,
  scheduled,
  library,
  clock,
}: {
  coming: ComingPost[]
  problem: string | undefined
  scheduled: SocialPost | undefined
  library: Library
  clock: Clock
}) {
  // Down one column, then the next, so the days still read in order on a wide page.
  const rows = Math.ceil(coming.length / 2)
  return (
    <section className="st-social__coming" aria-labelledby="social-coming">
      <h2 id="social-coming" className="st-social__h2">
        Coming up
      </h2>
      <p className="st-today__lede">
        {coming.length ? `One a day at ${clock.time(coming[0].at)}, as the daily job will pick them. ` : ''}
        The 5:45 PM social check confirms each post; scheduled posts
        {scheduled ? `, like the ${postKind(scheduled).toLowerCase()} at ${clock.time(scheduled.at)},` : ''} are published by
        Upload-Post itself and turn “Posted” once a check has read them back.
      </p>
      {problem ? <p className="st-notice">What comes next couldn’t be worked out: {problem}</p> : null}
      {coming.length ? (
        <ol className="st-social__queue" style={{ '--rows': rows } as CSSProperties}>
          {coming.map((post, index) => {
            const tutorial = library.tutorials.get(post.lessonId)?.tutorial
            return (
              <li key={post.lessonId} className="st-social__next" data-column-top={index % rows === 0 || undefined}>
                <span className="st-social__drawing" aria-hidden="true">
                  {tutorial ? <FinishedDrawing tutorial={tutorial} /> : null}
                </span>
                <div className="st-social__what">
                  <time className="st-social__when" dateTime={post.at}>
                    {clock.date(post.at)} · {clock.time(post.at)}
                  </time>
                  <a className="st-social__lesson" href={routeHref({ name: 'lesson', lessonId: post.lessonId })}>
                    {post.title ?? tutorial?.title ?? post.lessonId}
                  </a>
                  <span className="st-social__kind">Step pin on Pinterest at {clock.time(post.pinAt)}</span>
                </div>
                <span className={`st-pill st-social__access st-social__access--${post.free ? 'free' : 'premium'}`}>
                  {post.free ? 'Free' : 'Premium'}
                </span>
              </li>
            )
          })}
        </ol>
      ) : problem ? null : (
        <p className="st-today__quiet">Every lesson in the version on sale has been posted.</p>
      )}
    </section>
  )
}

/**
 * The videos made on this Mac that haven't gone out, to watch before they do:
 * a 16:9 video (a version's what's-new) goes out as it is; a lesson's video is
 * a preview, since the daily post makes it again (server/socialMade.ts).
 */
function MadeVideos({ made, coming, clock }: { made: MadeVideo[]; coming: ComingPost[]; clock: Clock }) {
  const wide = made.filter((video) => video.kind === 'wide')
  const tall = made.filter((video) => video.kind !== 'wide')
  return (
    <section className="st-social__made" aria-labelledby="social-made">
      <h2 id="social-made" className="st-social__h2">
        Made, not posted yet
      </h2>
      <p className="st-today__lede">
        Videos made on this Mac that haven’t gone out. A 16:9 video goes out as it is; a lesson’s video is a preview,
        since the daily post makes it again.
      </p>
      {wide.length ? (
        <ul className="st-social__made-list st-social__made-list--wide">
          {wide.map((video) => (
            <MadeCard key={video.id} video={video} clock={clock} />
          ))}
        </ul>
      ) : null}
      {tall.length ? (
        <ul className="st-social__made-list st-social__made-list--tall">
          {tall.map((video) => {
            const due = coming.find((post) => post.lessonId === video.lessonId)
            return <MadeCard key={video.id} video={video} clock={clock} due={due ? clock.date(due.at) : undefined} />
          })}
        </ul>
      ) : null}
    </section>
  )
}

/** One made video: the player, what it is, when it was made, when it goes out, and a way to save it. */
function MadeCard({ video, clock, due }: { video: MadeVideo; clock: Clock; due?: string }) {
  const src = madeVideoUrl(video.id)
  const wide = video.kind === 'wide'
  return (
    <li className={`st-social__made-item st-social__made-item--${wide ? 'wide' : 'tall'}`}>
      <video
        className="st-social__player"
        controls
        playsInline
        preload="metadata"
        // Without a poster, the frame a tenth of a second in, so Safari shows a picture before it plays.
        src={video.poster ? src : `${src}#t=0.1`}
        poster={video.poster ? madeVideoUrl(video.poster) : undefined}
        aria-label={video.title}
      />
      <div className="st-social__what">
        {video.lessonId ? (
          <a className="st-social__lesson" href={routeHref({ name: 'lesson', lessonId: video.lessonId })}>
            {video.title}
          </a>
        ) : (
          <span className="st-social__lesson">{video.title}</span>
        )}
        <span className="st-social__kind">
          {madeKind(video)} · made {clock.date(video.madeAt)}, {clock.time(video.madeAt)} · {fileSize(video.bytes)}
        </span>
        <span className="st-social__made-note">{madeNote(video, due)}</span>
        <a className="st-social__made-save" href={madeVideoUrl(video.id, { download: true })} download>
          Download
        </a>
      </div>
    </li>
  )
}

/** One post: when it went out, the lesson and its drawing, what it was, how it went, and each platform. */
function Post({ post, tutorial, clock }: { post: SocialPost; tutorial: Tutorial | undefined; clock: Clock }) {
  const status = postStatus(post.status)
  const how = reach(post)
  return (
    <li className="st-social__post">
      <time className="st-social__time" dateTime={post.at} title={clock.full(post.at)}>
        {clock.time(post.at)}
      </time>
      <article className="st-social__card">
        <header className="st-social__head">
          <span className="st-social__drawing" aria-hidden="true">
            {tutorial ? <FinishedDrawing tutorial={tutorial} /> : null}
          </span>
          <div className="st-social__what">
            <a className="st-social__lesson" href={routeHref({ name: 'lesson', lessonId: post.lessonId })}>
              {post.title ?? tutorial?.title ?? post.lessonId}
            </a>
            <span className="st-social__kind">
              {postKind(post)}
              {how ? ` · ${how}` : ''}
            </span>
          </div>
          <span className={`st-pill st-social__status st-social__status--${status.tone}`}>{status.word}</span>
        </header>
        <ul className="st-social__platforms">
          {post.platforms.map((platform) => (
            <PlatformTile key={platform.platform} platform={platform} post={post} time={clock.time} />
          ))}
        </ul>
      </article>
    </li>
  )
}

/** A platform's tile: it opens the post there once it is up, or says in words why it can't. */
function PlatformTile({ platform, post, time }: { platform: SocialPlatform; post: SocialPost; time: (iso: string) => string }) {
  const { state, words, url } = platformState(platform, post, time)
  const mark = (glyph: string) => (
    <span className="st-social__mark" aria-hidden="true">
      {glyph}
    </span>
  )
  const face = (
    <>
      <span className="st-social__platform-name">{platformName(platform.platform)}</span>
      <span className="st-social__platform-state">
        {url ? null : mark(MARKS[state])}
        <span className="st-social__platform-words">{words}</span>
        {url ? mark('↗') : null}
      </span>
    </>
  )
  return (
    <li>
      {url ? (
        <a className={`st-social__platform st-social__platform--${state}`} href={url} target="_blank" rel="noreferrer" title={url}>
          {face}
        </a>
      ) : (
        <div className={`st-social__platform st-social__platform--${state}`} title={words}>
          {face}
        </div>
      )}
    </li>
  )
}

/** "Wednesday, September 30"; a day that does not read, as written. */
function dayName(day: string): string {
  const date = localDay(day)
  return Number.isNaN(date.getTime()) ? day : longDay.format(date)
}

/** A format for ISO moments; one that does not read is shown as written. */
function formatIn(format: Intl.DateTimeFormat): (iso: string) => string {
  return (iso) => {
    const date = new Date(iso)
    return Number.isNaN(date.getTime()) ? iso : format.format(date)
  }
}
