import { describe, expect, it } from 'vitest'

import type { Tutorial } from '../schema/types'
import { INTRO_ID, OUTRO_ID, defaultBookend, subjectOf } from '../voice/bookends'

import { introFrame, introSeconds } from './intro'

const stroke = (duration: number) => ({ d: 'M 0 0 L 10 0', duration, lineWidth: 8 })
const lesson = {
  id: 'apple',
  title: 'Apple',
  steps: [
    { id: 'a', title: 'A', instruction: 'a', strokes: [stroke(1), stroke(1)] },
    { id: 'b', title: 'B', instruction: 'b', strokes: [stroke(2)] },
  ],
} as unknown as Tutorial

describe('the intro’s timeline', () => {
  it('shows the finished drawing, builds every step in order by its share of the time, and rests on the drawing', () => {
    // 10 s: 2.2 s of the goal, 1.2 s of rest, 6.6 s to build 4 s of animation.
    expect(introFrame(lesson, 0, 10)).toEqual({ stage: 'goal' })
    expect(introFrame(lesson, 2.1, 10)).toEqual({ stage: 'goal' })
    const first = introFrame(lesson, 2.2 + 0.825, 10)
    expect(first).toMatchObject({ stage: 'build', stepIndex: 0, itemIndex: 0 })
    expect(first.stage === 'build' && first.progress).toBeCloseTo(0.5)
    expect(introFrame(lesson, 2.2 + 1.65 + 0.1, 10)).toMatchObject({ stepIndex: 0, itemIndex: 1 })
    expect(introFrame(lesson, 2.2 + 3.3 + 1.65, 10)).toMatchObject({ stepIndex: 1, itemIndex: 0 })
    expect(introFrame(lesson, 8.9, 10)).toEqual({ stage: 'rest' })
    expect(introFrame(lesson, 60, 10)).toEqual({ stage: 'rest' })
  })

  it('runs between 8 and 14 seconds when nothing is spoken over it', () => {
    expect(introSeconds(lesson)).toBe(8)
    expect(introSeconds({ ...lesson, steps: Array(30).fill(lesson.steps[0]) })).toBe(14)
  })
})

describe('what Lina says around a lesson', () => {
  it('names the subject as a person would', () => {
    expect(subjectOf('Apple')).toEqual({ subject: 'an apple', thing: 'apple' })
    expect(subjectOf('Cherries').subject).toBe('cherries')
    expect(subjectOf('Watermelon Slice').subject).toBe('a watermelon slice')
    expect(subjectOf('Compass').subject).toBe('a compass')
  })

  it('always says the same thing for one lesson, names it, and leaves no pattern unfilled', () => {
    for (const title of ['Apple', 'Cherries', 'Fruit Bowl', 'Sun', 'Sailing Boat']) {
      const tutorial = { id: title.toLowerCase().replace(' ', '-'), title }
      for (const kind of ['intro', 'outro'] as const) {
        const line = defaultBookend(kind, tutorial)
        expect(line).toBe(defaultBookend(kind, tutorial))
        expect(line.toLowerCase()).toContain(title.toLowerCase())
        expect(line).not.toContain('{')
        expect(line.length).toBeLessThanOrEqual(240)
      }
    }
    expect(INTRO_ID).not.toBe(OUTRO_ID)
  })
})
