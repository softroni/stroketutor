/**
 * The contract between the Studio's Video tab, the Studio server and the
 * command line for lesson videos (server/video/). The server makes them; the
 * page only asks for one and watches it being made.
 */

export type VideoStage = 'preparing' | 'voice' | 'frames' | 'audio' | 'done'

export interface VideoProgress {
  stage: VideoStage
  /** Frames drawn so far, while `stage` is `frames`. */
  done: number
  total: number
  message: string
}

/** How a video opens (server/video/plan.ts, `Opening`): the classic opening, or the hook. */
export type VideoOpening = 'classic' | 'hook'

export interface VideoResult {
  lessonId: string
  /** How it opens. */
  opening: VideoOpening
  /** The video, or null when stills were asked for. */
  file: string | null
  captionFile: string | null
  /** A caption to post with the video. */
  caption: string
  stills: string[]
  durationS: number
  frames: number
  /** Frames that reused the picture before them because nothing had moved. */
  stillFrames: number
  /** How long the export took. */
  renderSeconds: number
  bytes: number
  /** Recordings used although their words no longer match the step's (the Voice section says "out of date"). */
  staleSteps: string[]
  /** Why the captions light up words at estimated times rather than when Lina says them (no Whisper, say); null when every word was heard. */
  timingNote: string | null
}

/** A lesson's video before anything is made: its default words, what is missing, and the last video. */
export interface VideoDefaults {
  lessonId: string
  title: string
  /** Lina's default opening line. */
  intro: string
  /** Her default last words, said as Paper Coach takes her place: its name, and that it is free on the App Store. */
  signoff: string
  /** The default line under Paper Coach at the end. */
  cta: string
  /** How a video made now opens: the day's opening, as the posts have it (docs/ops/social-experiments.json). */
  opening: VideoOpening
  /** True when the App Store badge is in the repository and goes beside the call to action. */
  badge: boolean
  /** Steps Lina has not recorded; a video needs every one. */
  missing: string[]
  /** Recordings whose words have changed since; the video uses them as they are. */
  stale: string[]
  caption: string
  /** The last video made of this lesson, in .studio/videos, of either opening. */
  video: { file: string; bytes: number; modifiedAt: string; opening: VideoOpening } | null
}

export type VideoJobState = 'queued' | 'running' | 'done' | 'failed' | 'stopped'

export interface VideoJob {
  id: string
  lessonId: string
  state: VideoJobState
  progress: VideoProgress | null
  error: string | null
  result: VideoResult | null
  createdAt: string
  finishedAt: string | null
}

/** `GET /api/video/lessons/:lesson`. */
export interface VideoLessonState extends VideoDefaults {
  /** The newest job for this lesson since the server started, if any. */
  job: VideoJob | null
}
