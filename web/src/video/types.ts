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

export interface VideoResult {
  lessonId: string
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
}

/** A lesson's video before anything is made: its default words, what is missing, and the last video. */
export interface VideoDefaults {
  lessonId: string
  title: string
  /** Lina's default opening line. */
  intro: string
  /** The default line under Paper Coach at the end. */
  cta: string
  /** True when the App Store badge is in the repository and goes beside the call to action. */
  badge: boolean
  /** Steps Lina has not recorded; a video needs every one. */
  missing: string[]
  /** Recordings whose words have changed since; the video uses them as they are. */
  stale: string[]
  caption: string
  /** The last video made of this lesson, in .studio/videos. */
  video: { file: string; bytes: number; modifiedAt: string } | null
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
