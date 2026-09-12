import { describe, expect, it } from 'vitest'

import { parsePath } from '../player/svgPath'
import type { CollectedShape } from '../trace/traceSvg'

import { buildOptimizedSvg, cornerAwarePath } from './optimize'
import { ellipseSegments, normalizePath, rectSegments } from './pathNormalize'

const black = { rgb: [0, 0, 0] as [number, number, number], alpha: 1, gradient: false }
const red = { rgb: [200, 30, 30] as [number, number, number], alpha: 0.5, gradient: false }

function shape(partial: Partial<CollectedShape>): CollectedShape {
  return { index: 0, segments: [], fill: null, stroke: null, strokeWidth: 0, fillRule: 'nonzero', lineCap: 'butt', lineJoin: 'miter', kind: 'none', ...partial }
}

const paths = (svg: string) => [...svg.matchAll(/<path ([^>]*)\/>/g)].map((match) => match[1])
const dOf = (attributes: string) => attributes.match(/d="([^"]*)"/)![1]

describe('buildOptimizedSvg', () => {
  it('writes one path per painted shape, on the square canvas, with presentation attributes', () => {
    const result = buildOptimizedSvg([
      shape({ segments: rectSegments(10.04, 20, 100, 50), fill: black, kind: 'ink' }),
      shape({ segments: normalizePath('M 0 0 l 10 0 10 10'), stroke: red, strokeWidth: 3.14159, lineCap: 'round', lineJoin: 'round' }),
      shape({ segments: rectSegments(0, 0, 5, 5) }),
    ])
    expect(result.svg).toContain('viewBox="0 0 1000 1000"')
    const found = paths(result.svg)
    expect(found).toHaveLength(2)
    expect(found[0]).toBe('d="M 10 20 L 110 20 L 110 70 L 10 70 Z" fill="#000000"')
    expect(found[1]).toBe('d="M 0 0 L 10 0 L 20 10" fill="none" stroke="#C81E1E" stroke-width="3.1" stroke-opacity="0.5" stroke-linecap="round" stroke-linejoin="round"')
    expect(result.kept).toBe(2)
    expect(result.dropped).toBe(1)
    expect(result.notes).toEqual(['1 shape that painted nothing was left out.'])
  })

  it('emits paths every player parses, with the asked-for decimals', () => {
    const result = buildOptimizedSvg([shape({ segments: ellipseSegments(500, 500, 100, 60), fill: black })], { decimals: 2 })
    const d = dOf(paths(result.svg)[0])
    expect(() => parsePath(d)).not.toThrow()
    expect(d).toMatch(/^M 600 500 C /)
    expect(d).toMatch(/\d\.\d\d /)
    expect(d).not.toMatch(/\d\.\d{3}/)
  })

  it('names gradients as a flat grey and says so', () => {
    const result = buildOptimizedSvg([shape({ segments: rectSegments(0, 0, 100, 100), fill: { ...black, gradient: true } })])
    expect(paths(result.svg)[0]).toContain('fill="#808080"')
    expect(result.notes[0]).toContain('gradient')
  })

  it('keeps evenodd and opacity only when they matter', () => {
    const result = buildOptimizedSvg([
      shape({ segments: rectSegments(0, 0, 100, 100), fill: { ...black, alpha: 0.25 }, fillRule: 'evenodd' }),
      shape({ segments: rectSegments(0, 0, 100, 100), fill: black }),
    ])
    const [first, second] = paths(result.svg)
    expect(first).toContain('fill-opacity="0.25" fill-rule="evenodd"')
    expect(second).not.toContain('fill-rule')
    expect(second).not.toContain('opacity')
  })

  describe('with --simplify', () => {
    it('keeps a rectangle’s four corners', () => {
      const result = buildOptimizedSvg([shape({ segments: rectSegments(100, 100, 300, 200), fill: black })], { simplify: 1.2, decimals: 0 })
      expect(dOf(paths(result.svg)[0])).toBe('M 100 100 L 400 100 L 400 300 L 100 300 Z')
    })

    it('smooths a curve through the points that remain, without corners', () => {
      const result = buildOptimizedSvg([shape({ segments: ellipseSegments(500, 500, 200, 120), fill: black })], { simplify: 1.2 })
      const d = dOf(paths(result.svg)[0])
      expect(d).toMatch(/^M [\d.]+ [\d.]+ C /)
      expect(d).not.toContain(' L ')
      expect(d.endsWith('Z')).toBe(true)
      expect(() => parsePath(d)).not.toThrow()
    })

    it('drops specks and notes them', () => {
      const result = buildOptimizedSvg(
        [shape({ segments: rectSegments(0, 0, 2, 2), fill: black }), shape({ segments: rectSegments(0, 0, 2, 40), fill: black })],
        { simplify: 1, minSize: 4 },
      )
      expect(result.kept).toBe(1)
      expect(result.notes).toEqual(['1 speck smaller than 4 units was left out.'])
    })

    it('reduces a dense polyline to few points', () => {
      const dense = Array.from({ length: 200 }, (_, i) => `${i} ${Math.round(i / 10)}`).join(' L ')
      const result = buildOptimizedSvg([shape({ segments: normalizePath(`M ${dense}`), stroke: black, strokeWidth: 2 })], { simplify: 1.5 })
      const d = dOf(paths(result.svg)[0])
      expect(parsePath(d).length).toBeLessThan(20)
    })
  })
})

describe('cornerAwarePath', () => {
  it('draws a straight run as a line and a bent run as a curve', () => {
    const d = cornerAwarePath([[0, 0], [100, 0], [100, 100], [150, 150], [200, 180]], false, 0, 60)
    expect(d).toMatch(/^M 0 0 L 100 0 C /)
    expect(d.endsWith('200 180')).toBe(true)
    expect(() => parsePath(d)).not.toThrow()
  })
})
