import { describe, expect, it } from 'vitest'

import type { VideoResult } from '../../src/video/types'

import { createVideoJobs } from './jobs'
import type { VideoDeps, exportVideo } from './render'

const deps = async () => ({}) as VideoDeps
const result = (lessonId: string): VideoResult => ({
  lessonId,
  file: `/videos/${lessonId}.mp4`,
  captionFile: null,
  caption: '',
  stills: [],
  durationS: 60,
  frames: 1800,
  stillFrames: 900,
  renderSeconds: 50,
  bytes: 1,
  staleSteps: [],
})

/** A render that finishes only when the test says so, and stops when asked. */
function controllableRun() {
  const finishers = new Map<string, () => void>()
  const run: typeof exportVideo = (request, _deps, options = {}) =>
    new Promise((resolve, reject) => {
      options.onProgress?.({ stage: 'frames', done: 1, total: 10, message: 'Drawing the frames' })
      options.signal?.addEventListener('abort', () => reject(new Error('The video was stopped.')))
      finishers.set(request.lessonId, () => resolve(result(request.lessonId)))
    })
  return { run, finish: (lessonId: string) => finishers.get(lessonId)?.() }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('createVideoJobs', () => {
  it('makes one video at a time and reports how it went', async () => {
    const { run, finish } = controllableRun()
    const jobs = createVideoJobs(run)
    const first = jobs.start({ lessonId: 'rocket' }, deps)
    const second = jobs.start({ lessonId: 'apple' }, deps)
    await settle()
    expect(jobs.get(first.id)?.state).toBe('running')
    expect(jobs.get(first.id)?.progress?.done).toBe(1)
    expect(jobs.get(second.id)?.state).toBe('queued')

    finish('rocket')
    await settle()
    expect(jobs.get(first.id)).toMatchObject({ state: 'done', result: { file: '/videos/rocket.mp4' } })
    expect(jobs.get(second.id)?.state).toBe('running')
    expect(jobs.latest('rocket')?.id).toBe(first.id)
  })

  it('answers a second request for the same lesson with the job already under way', async () => {
    const { run } = controllableRun()
    const jobs = createVideoJobs(run)
    const first = jobs.start({ lessonId: 'rocket' }, deps)
    expect(jobs.start({ lessonId: 'rocket', intro: 'Other words' }, deps).id).toBe(first.id)
  })

  it('stops a video being made, and one still waiting', async () => {
    const { run } = controllableRun()
    const jobs = createVideoJobs(run)
    const first = jobs.start({ lessonId: 'rocket' }, deps)
    const second = jobs.start({ lessonId: 'apple' }, deps)
    await settle()
    expect(jobs.stop(second.id)?.state).toBe('stopped')
    jobs.stop(first.id)
    await settle()
    expect(jobs.get(first.id)).toMatchObject({ state: 'stopped', error: 'Stopped.' })
    expect(jobs.stop('unknown')).toBeNull()
  })
})
