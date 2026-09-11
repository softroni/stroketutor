import { describe, expect, it } from 'vitest'

import { parsePath } from '../player/svgPath'

import {
  PathSyntaxError,
  ellipseSegments,
  flattenSegments,
  normalizePath,
  pointsSegments,
  rectSegments,
  segmentsToD,
  transformSegments,
} from './pathNormalize'

const d = (source: string, decimals = 2) => segmentsToD(normalizePath(source), decimals)

describe('normalizePath', () => {
  it('makes relative commands and H/V absolute', () => {
    expect(d('m10 10 h20 v20 h-20 z')).toBe('M 10 10 L 30 10 L 30 30 L 10 30 Z')
  })

  it('treats extra pairs after a moveto as linetos, relative after m', () => {
    expect(d('m 0 0 10 10 5 0')).toBe('M 0 0 L 10 10 L 15 10')
    expect(d('M 0 0 10 10 5 0')).toBe('M 0 0 L 10 10 L 5 0')
  })

  it('reflects the previous control point for S and T', () => {
    expect(d('M0 0 C 0 10 10 10 10 0 S 20 -10 20 0')).toBe('M 0 0 C 0 10 10 10 10 0 C 10 -10 20 -10 20 0')
    expect(d('M0 0 Q 5 10 10 0 T 20 0')).toBe('M 0 0 Q 5 10 10 0 Q 15 -10 20 0')
  })

  it('reads compact numbers the way browsers do', () => {
    expect(d('M1.5.5L-.5-1e1')).toBe('M 1.5 0.5 L -0.5 -10')
  })

  it('turns an arc into cubics that pass where the arc does', () => {
    const segments = normalizePath('M 0 0 A 10 10 0 0 1 20 0')
    expect(segments.map((segment) => segment.type)).toEqual(['M', 'C', 'C'])
    // Sweep 1 on a y-down canvas goes over the top: through (10, -10).
    const middle = segments[1].type === 'C' ? segments[1].to : [NaN, NaN]
    expect(middle[0]).toBeCloseTo(10, 6)
    expect(middle[1]).toBeCloseTo(-10, 6)
    const end = segments[2].type === 'C' ? segments[2].to : [NaN, NaN]
    expect(end).toEqual([20, 0])
  })

  it('reads arc flags written without separators', () => {
    const segments = normalizePath('M0 0a10 10 0 0120 0')
    expect(segments[segments.length - 1]).toMatchObject({ type: 'C', to: [20, 0] })
  })

  it('starts the next subpath where Z closed the last one', () => {
    expect(d('M 10 10 L 20 10 Z l 5 5')).toBe('M 10 10 L 20 10 Z L 15 15')
  })

  it('refuses what a browser would refuse', () => {
    expect(() => normalizePath('L 10 10')).toThrow(PathSyntaxError)
    expect(() => normalizePath('M 10')).toThrow(/Expected a number/)
    expect(() => normalizePath('M 0 0 X 1 1')).toThrow(/Unknown path command/)
  })
})

describe('shapes, transforms and output', () => {
  it('draws a rectangle, rounded or not, as a closed path', () => {
    expect(segmentsToD(rectSegments(10, 20, 30, 40))).toBe('M 10 20 L 40 20 L 40 60 L 10 60 Z')
    const rounded = rectSegments(0, 0, 100, 50, 10)
    expect(rounded.filter((segment) => segment.type === 'C')).toHaveLength(4)
    expect(rounded[rounded.length - 1].type).toBe('Z')
  })

  it('draws a circle as four quarter arcs', () => {
    const circle = ellipseSegments(50, 50, 20, 20)
    expect(circle.filter((segment) => segment.type === 'C')).toHaveLength(4)
    const points = flattenSegments(circle, 8)[0]
    for (const [x, y] of points) expect(Math.hypot(x - 50, y - 50)).toBeCloseTo(20, 0)
  })

  it('reads polygon points, ignoring an odd one out', () => {
    expect(segmentsToD(pointsSegments('0,0 10,0 10,10 5', true))).toBe('M 0 0 L 10 0 L 10 10 Z')
  })

  it('applies an affine transform to every point', () => {
    const moved = transformSegments(normalizePath('M 0 0 L 10 0 Q 10 10 0 10'), { a: 2, b: 0, c: 0, d: 2, e: 5, f: 1 })
    expect(segmentsToD(moved)).toBe('M 5 1 L 25 1 Q 25 21 5 21')
  })

  it('always writes path data both players accept', () => {
    const sources = [
      'm10 10 h20 v20 h-20 z',
      'M0 0 C 0 10 10 10 10 0 S 20 -10 20 0',
      'M0 0 Q 5 10 10 0 T 20 0',
      'M 0 0 A 30 20 45 1 0 50 10',
    ]
    for (const source of sources) expect(() => parsePath(d(source))).not.toThrow()
    expect(() => parsePath(segmentsToD(ellipseSegments(0, 0, 3, 7), 2))).not.toThrow()
  })
})
