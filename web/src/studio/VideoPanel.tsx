import { useCallback, useEffect, useState } from 'react'

import type { VideoJob, VideoLessonState } from '../video/types'

import { ApiError, exportLessonVideo, lessonVideoUrl, readLessonVideo, readVideoJob, stopVideoJob } from './api'

export interface VideoPanelProps {
  lessonId: string
  /** The editor has changes not saved yet; the video is made from the lesson as last saved. */
  unsaved: boolean
}

const running = (job: VideoJob | null) => job !== null && (job.state === 'queued' || job.state === 'running')
const megabytes = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`

/**
 * The lesson page's Video tab: a vertical draw-along video of the lesson for
 * Shorts, TikTok and Reels, made on the Studio's Mac by the same code as
 * `studio lessons video` (server/video/). It is saved in `.studio/videos`,
 * outside git, and downloaded from here to wherever the browser saves files.
 */
export function VideoPanel({ lessonId, unsaved }: VideoPanelProps) {
  const [state, setState] = useState<VideoLessonState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [intro, setIntro] = useState('')
  const [cta, setCta] = useState('')
  const [job, setJob] = useState<VideoJob | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(
    async (fillWords: boolean) => {
      try {
        const next = await readLessonVideo(lessonId)
        setState(next)
        setLoadError(null)
        setJob((current) => current ?? next.job)
        if (fillWords) {
          setIntro(next.intro)
          setCta(next.cta)
        }
      } catch (error) {
        setLoadError(error instanceof ApiError ? error.message : String(error))
      }
    },
    [lessonId],
  )

  useEffect(() => {
    setState(null)
    setJob(null)
    void load(true)
  }, [load])

  // While a video is being made, ask how it is going every second; when it is done, read the new file.
  useEffect(() => {
    if (!job || !running(job)) return
    const timer = window.setTimeout(async () => {
      try {
        const next = await readVideoJob(job.id)
        setJob(next)
        if (!running(next)) void load(false)
      } catch (error) {
        setJob({ ...job, state: 'failed', error: error instanceof ApiError ? error.message : String(error), finishedAt: new Date().toISOString() })
      }
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [job, load])

  if (loadError) return <p className="st-notice st-notice--error">{loadError}</p>
  if (!state) return <p className="st-field__hint">Reading the lesson’s video…</p>

  const busy = running(job)
  const blocked = state.missing.length > 0
  const edited = intro !== state.intro || cta !== state.cta
  const video = state.video

  const start = async () => {
    setStartError(null)
    try {
      setJob(await exportLessonVideo(lessonId, { intro, cta }))
    } catch (error) {
      setStartError(error instanceof ApiError ? error.message : String(error))
    }
  }

  const stop = async () => {
    if (!job) return
    try {
      setJob(await stopVideoJob(job.id))
    } catch (error) {
      setStartError(error instanceof ApiError ? error.message : String(error))
    }
  }

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(state.caption)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="st-video">
      <div className="st-video__intro">
        <h3>Video for Shorts, TikTok and Reels</h3>
        <p className="st-field__hint">
          A 1080 × 1920 draw-along: Lina’s opening line over the drawing coming together, every step with her recording, then
          Paper Coach{state.badge ? ' and the App Store badge' : ''}. It is made on the Studio’s Mac and kept in{' '}
          <code>.studio/videos</code>, outside git.
        </p>
      </div>

      {blocked ? (
        <p className="st-notice st-notice--error">
          Lina hasn’t recorded {state.missing.length === 1 ? 'this step' : 'these steps'} yet: {state.missing.join(', ')}. Record them in
          the Voice section under the steps, then export.
        </p>
      ) : null}
      {state.stale.length > 0 ? (
        <p className="st-notice">
          {state.stale.join(', ')} {state.stale.length === 1 ? 'was' : 'were'} recorded before {state.stale.length === 1 ? 'its' : 'their'}{' '}
          words last changed. The video uses the recordings as they are.
        </p>
      ) : null}
      {unsaved ? <p className="st-notice">The video is made from the lesson as last saved; your latest edit saves in a moment.</p> : null}

      <label className="st-field">
        <span className="st-field__label">Lina’s opening line</span>
        <textarea
          id="video-intro"
          className="st-field__input st-field__input--long st-video__words"
          value={intro}
          rows={2}
          maxLength={300}
          disabled={busy}
          onChange={(event) => setIntro(event.target.value)}
        />
        <span className="st-field__hint">Spoken in her voice when you export. The same words are reused next time, even with her speech server off.</span>
      </label>

      <label className="st-field">
        <span className="st-field__label">Under Paper Coach at the end</span>
        <input
          id="video-cta"
          className="st-field__input"
          value={cta}
          maxLength={300}
          disabled={busy}
          onChange={(event) => setCta(event.target.value)}
        />
        <span className="st-field__hint">{state.badge ? 'Beside the Download on the App Store badge.' : 'Under the app’s name.'}</span>
      </label>

      <div className="st-video__actions">
        <button type="button" className="st-button st-button--primary" disabled={busy || blocked || !intro.trim()} onClick={() => void start()}>
          {video ? 'Export again' : 'Export video'}
        </button>
        {busy ? (
          <button type="button" className="st-button" onClick={() => void stop()}>
            Stop
          </button>
        ) : null}
        {edited && !busy ? (
          <button
            type="button"
            className="st-link-button"
            onClick={() => {
              setIntro(state.intro)
              setCta(state.cta)
            }}
          >
            Use the default words
          </button>
        ) : null}
      </div>

      {busy && job ? <VideoProgressBar job={job} /> : null}
      {startError ? <p className="st-notice st-notice--error">{startError}</p> : null}
      {job?.state === 'failed' ? <p className="st-notice st-notice--error">{job.error}</p> : null}
      {job?.state === 'done' && job.result?.timingNote ? <p className="st-notice">{job.result.timingNote}</p> : null}

      {video && !busy ? (
        <div className="st-video__result">
          <video
            key={video.modifiedAt}
            className="st-video__player"
            src={lessonVideoUrl(lessonId, { version: video.modifiedAt })}
            controls
            playsInline
            preload="metadata"
          />
          <div className="st-video__details">
            <p className="st-field__hint">
              Made {new Date(video.modifiedAt).toLocaleString()} · {megabytes(video.bytes)}
            </p>
            <a className="st-button st-button--primary" href={lessonVideoUrl(lessonId, { download: true, version: video.modifiedAt })} download={`${lessonId}.mp4`}>
              Download video
            </a>
            <label className="st-field">
              <span className="st-field__label">Caption to post with it</span>
              <textarea id="video-caption" className="st-field__input st-field__input--long st-video__caption" value={state.caption} readOnly rows={8} />
            </label>
            <button type="button" className="st-button" onClick={() => void copyCaption()}>
              {copied ? 'Copied' : 'Copy caption'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function VideoProgressBar({ job }: { job: VideoJob }) {
  const progress = job.progress
  const framing = progress?.stage === 'frames' && progress.total > 0
  const label =
    job.state === 'queued'
      ? 'Waiting for the video before it to finish'
      : framing
        ? `Drawing the frames: ${progress.done.toLocaleString()} of ${progress.total.toLocaleString()}`
        : (progress?.message ?? 'Starting')
  return (
    <div className="st-video__progress" role="status">
      <progress max={framing ? progress.total : undefined} value={framing ? progress.done : undefined} />
      <span>{label}…</span>
    </div>
  )
}
