import { describe, expect, it } from 'vitest'

import { pathEnd, pathStart } from '../preview'
import { strokeLength } from '../quality'

import type { Tutorial } from '../../schema/types'

import { joinStrokes, splitStroke, toEditable } from './ops'
import { splitPath } from './splitPath'

const CIRCLE = 'M 100 0 C 155 0 200 45 200 100 C 200 155 155 200 100 200 C 45 200 0 155 0 100 C 0 45 45 0 100 0 Z'

describe('splitting a line', () => {
  it('cuts an open line in two at the nearest point, keeping its length', () => {
    const d = 'M 0 0 L 100 0 L 100 100'
    const [first, second] = splitPath(d, [{ x: 60, y: 8 }])
    expect(first).toBe('M 0 0 L 60 0')
    expect(second).toBe('M 60 0 L 100 0 L 100 100')
  })

  it('cuts a closed line into two halves that meet, each following the curve exactly', () => {
    const parts = splitPath(CIRCLE, [{ x: 100, y: 0 }, { x: 100, y: 200 }])
    expect(parts).toHaveLength(2)
    expect(pathStart(parts[0])).toEqual({ x: 100, y: 0 })
    expect(pathEnd(parts[0])).toEqual({ x: 100, y: 200 })
    expect(pathStart(parts[1])).toEqual({ x: 100, y: 200 })
    expect(pathEnd(parts[1])).toEqual({ x: 100, y: 0 })
    expect(parts.join(' ')).not.toContain('Z')
    expect(strokeLength(parts[0]) + strokeLength(parts[1])).toBeCloseTo(strokeLength(CIRCLE), 0)
  })

  it('cuts part-way along a curve without moving it', () => {
    const [first, second] = splitPath(CIRCLE, [{ x: 171, y: 29 }, { x: 29, y: 171 }])
    const end = pathEnd(first)!
    expect(Math.hypot(end.x - 100, end.y - 100)).toBeCloseTo(100, 0)
    expect(pathStart(second)).toEqual(end)
    expect(strokeLength(first) + strokeLength(second)).toBeCloseTo(strokeLength(CIRCLE), 0)
  })

  it('opens a closed line at a single cut', () => {
    const [only, ...rest] = splitPath(CIRCLE, [{ x: 0, y: 100 }])
    expect(rest).toHaveLength(0)
    expect(pathStart(only)).toEqual({ x: 0, y: 100 })
    expect(pathEnd(only)).toEqual({ x: 0, y: 100 })
  })

  it('refuses a cut at the end of an open line', () => {
    expect(() => splitPath('M 0 0 L 100 0', [{ x: 120, y: 0 }])).toThrow(/nothing to split/)
  })
})

describe('splitting and joining strokes in a lesson', () => {
  const doc = () =>
    toEditable({
      id: 't', title: 'T', schemaVersion: 1, canvas: { width: 1000, height: 1000 },
      steps: [{ id: 'a', title: 'A', instruction: 'a', strokes: [{ d: 'M 0 0 L 100 0 L 100 100', duration: 2, lineWidth: 8 }] }],
    } as unknown as Tutorial)

  it('shares the animation time between the parts by length, and joins them back into the same line', () => {
    const split = splitStroke(doc(), 'k1', [{ x: 100, y: 0 }], strokeLength)
    expect(split.steps[0].strokes.map((stroke) => [stroke.d, stroke.duration])).toEqual([['M 0 0 L 100 0', 1], ['M 100 0 L 100 100', 1]])
    const [first, second] = split.steps[0].strokes
    const joined = joinStrokes(split, first.uid, second.uid)
    expect(joined.steps[0].strokes.map((stroke) => [stroke.d, stroke.duration])).toEqual([['M 0 0 L 100 0 L 100 100', 2]])
  })
})
