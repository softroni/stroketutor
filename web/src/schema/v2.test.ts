import { describe, expect, it } from 'vitest'

import { estimateLearnerSeconds } from '../catalog/metrics'
import { stepDurations } from '../player/usePlayback'

import { stepDuration, totalDuration, totalFills, type Step } from './types'
import { validateTutorial } from './validate'

const square = 'M 10 10 L 90 10 L 90 90 L 10 90 Z'

const document = (schemaVersion: number, steps: unknown[]) => ({
  schemaVersion,
  id: 'case',
  title: 'Case',
  canvas: { width: 100, height: 100 },
  steps,
})

const outlineThenColour: Step = {
  id: 'square',
  title: 'Square',
  instruction: 'Draw the square, then colour it.',
  strokes: [{ d: square, duration: 2, lineWidth: 4, color: '#1F3A5F' }],
  fills: [{ d: square, color: '#E8C872', duration: 1.5 }],
}

describe('schema v2', () => {
  it('times a step as its strokes, then its fills', () => {
    expect(stepDurations(outlineThenColour)).toEqual([2, 1.5])
    expect(stepDuration(outlineThenColour)).toBe(3.5)
  })

  it('counts fill time in the lesson and the learner estimate', () => {
    const result = validateTutorial(document(2, [outlineThenColour]))
    expect(result.ok, result.ok ? '' : JSON.stringify(result.issues)).toBe(true)
    if (!result.ok) return
    expect(totalDuration(result.tutorial)).toBe(3.5)
    expect(totalFills(result.tutorial)).toBe(1)
    expect(estimateLearnerSeconds(result.tutorial)).toBe(3.5 * 3 + 8)
  })

  it('names the allowed fill rules', () => {
    const result = validateTutorial(
      document(2, [{ ...outlineThenColour, fills: [{ d: square, color: '#E8C872', duration: 1, fillRule: 'winding' }] }]),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        path: 'steps[0].fills[0].fillRule',
        message: 'Must be one of "nonzero", "evenodd".',
      }),
    )
  })

  it('refuses a stroke colour in a version 1 document', () => {
    const result = validateTutorial(document(1, [{ ...outlineThenColour, fills: undefined }]))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        path: 'steps[0].strokes[0].color',
        message: expect.stringContaining('not part of schemaVersion 1'),
      }),
    )
  })

  it('explains a step with nothing to draw in one sentence', () => {
    const result = validateTutorial(document(2, [{ ...outlineThenColour, strokes: [], fills: undefined }]))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues).toEqual([
      { path: 'steps[0]', message: 'A step needs at least one stroke or fill.', value: undefined },
    ])
  })

  it('names the versions it understands when refusing another', () => {
    const result = validateTutorial(document(3, [outlineThenColour]))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues[0].message).toBe(
      'Unsupported schemaVersion 3. This player understands schemaVersion 1 and 2.',
    )
  })
})
