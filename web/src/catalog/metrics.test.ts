import { describe, expect, it } from 'vitest'

import type { Tutorial } from '../schema/types'

import { COPY_TIME_FACTOR, SECONDS_PER_STEP, estimateLearnerSeconds, formatMinutes } from './metrics'

const tutorial = (durationsPerStep: number[][]): Tutorial => ({
  schemaVersion: 1,
  id: 't',
  title: 'T',
  canvas: { width: 100, height: 100 },
  steps: durationsPerStep.map((durations, index) => ({
    id: `s${index}`,
    title: 'Step',
    instruction: 'Draw it.',
    strokes: durations.map((duration) => ({ d: 'M 0 0 L 10 10', duration, lineWidth: 4 })),
  })),
})

describe('estimateLearnerSeconds', () => {
  it('adds copying time per animated second and reading time per step', () => {
    const seconds = estimateLearnerSeconds(tutorial([[1, 2], [3]]))
    expect(seconds).toBe(6 * (1 + COPY_TIME_FACTOR) + 2 * SECONDS_PER_STEP)
  })
})

describe('formatMinutes', () => {
  it('rounds to whole minutes and never claims zero', () => {
    expect(formatMinutes(20)).toBe('under 1 min')
    expect(formatMinutes(60)).toBe('about 1 min')
    expect(formatMinutes(269)).toBe('about 4 min')
  })
})
