import { randomBytes } from 'node:crypto'

import type { VideoJob } from '../../src/video/types'

import { exportVideo, type VideoDeps, type VideoRequest } from './render'

/**
 * Videos made from the Studio's Video tab. A render takes minutes, so the
 * request only starts a job, and the page asks how it is going. One video is
 * made at a time (they compete for the same Chromium and ffmpeg); asking for a
 * lesson that is already queued or being made answers with that job. Jobs live
 * in memory: a server restart forgets them, but the finished files stay in
 * `.studio/videos`.
 */

export type { VideoJob }

export interface VideoJobs {
  start(request: VideoRequest, deps: () => Promise<VideoDeps>): VideoJob
  get(id: string): VideoJob | null
  latest(lessonId: string): VideoJob | null
  stop(id: string): VideoJob | null
}

/** Finished jobs kept for the page to read back. */
const KEPT = 40

export function createVideoJobs(run: typeof exportVideo = exportVideo): VideoJobs {
  const jobs = new Map<string, { job: VideoJob; controller: AbortController }>()
  let queue: Promise<void> = Promise.resolve()

  const view = (id: string): VideoJob | null => {
    const entry = jobs.get(id)
    return entry ? { ...entry.job } : null
  }
  const forget = () => {
    const finished = [...jobs.values()].filter(({ job }) => job.finishedAt !== null)
    for (const { job } of finished.slice(0, Math.max(0, finished.length - KEPT))) jobs.delete(job.id)
  }

  return {
    start(request, deps) {
      const active = [...jobs.values()].find(({ job }) => job.lessonId === request.lessonId && (job.state === 'queued' || job.state === 'running'))
      if (active) return { ...active.job }

      const job: VideoJob = {
        id: `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`,
        lessonId: request.lessonId,
        state: 'queued',
        progress: null,
        error: null,
        result: null,
        createdAt: new Date().toISOString(),
        finishedAt: null,
      }
      const controller = new AbortController()
      jobs.set(job.id, { job, controller })

      queue = queue.then(async () => {
        if (controller.signal.aborted) return
        job.state = 'running'
        try {
          job.result = await run(request, await deps(), {
            signal: controller.signal,
            onProgress: (progress) => {
              job.progress = progress
            },
          })
          job.state = 'done'
        } catch (error) {
          job.state = controller.signal.aborted ? 'stopped' : 'failed'
          job.error = controller.signal.aborted ? 'Stopped.' : error instanceof Error ? error.message : String(error)
        } finally {
          job.finishedAt = new Date().toISOString()
          forget()
        }
      })
      return { ...job }
    },

    get: view,

    latest(lessonId) {
      const mine = [...jobs.values()].filter(({ job }) => job.lessonId === lessonId)
      return mine.length > 0 ? { ...mine[mine.length - 1].job } : null
    },

    stop(id) {
      const entry = jobs.get(id)
      if (!entry) return null
      entry.controller.abort()
      if (entry.job.state === 'queued') {
        entry.job.state = 'stopped'
        entry.job.error = 'Stopped.'
        entry.job.finishedAt = new Date().toISOString()
      }
      return { ...entry.job }
    },
  }
}
