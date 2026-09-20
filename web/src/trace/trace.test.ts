import { describe, expect, it } from 'vitest'

import { parsePath } from '../player/svgPath'

import { createMask, distanceToPaper, thin, type Mask } from './bitmap'
import { traceContours } from './contours'
import { PALM_CROP } from './fixtures/palmCrop'
import { boxOf, loopArea, polylineLength, relax, simplify, smoothPath } from './fit'
import { growIntoMask, hex, quantize, removeSpecks } from './palette'
import { traceSkeleton } from './skeleton'

function mask(width: number, height: number, inside: (x: number, y: number) => boolean): Mask {
  const result = createMask(width, height)
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) result.data[y * width + x] = inside(x, y) ? 1 : 0
  return result
}

const options = { minSpur: 12, maxBend: 40 }

describe('outlines: thinning and tracing', () => {
  it('traces a thick bar as one line down its middle, and measures its width', () => {
    const bar = mask(100, 50, (x, y) => x >= 20 && x < 80 && y >= 20 && y < 29)
    const lines = traceSkeleton(thin(bar), options)
    expect(lines).toHaveLength(1)
    const [line] = lines
    expect(line.closed).toBe(false)
    expect(polylineLength(line.points)).toBeGreaterThan(45)
    for (const [, y] of line.points) expect(Math.abs(y - 24.5)).toBeLessThanOrEqual(1.5)
    const distance = distanceToPaper(bar)
    const middle = line.points[line.points.length >> 1]
    expect(Math.round(2 * distance[Math.floor(middle[1]) * 100 + Math.floor(middle[0])] - 1)).toBe(9)
  })

  it('traces a ring as one closed line', () => {
    const ring = mask(100, 100, (x, y) => {
      const r = Math.hypot(x + 0.5 - 50, y + 0.5 - 50)
      return r >= 26 && r <= 34
    })
    const lines = traceSkeleton(thin(ring), options)
    expect(lines).toHaveLength(1)
    expect(lines[0].closed).toBe(true)
    expect(polylineLength(lines[0].points, true)).toBeGreaterThan(2 * Math.PI * 30 * 0.85)
    expect(polylineLength(lines[0].points, true)).toBeLessThan(2 * Math.PI * 30 * 1.15)
  })

  it('joins a line broken by a small gap when it carries straight on', () => {
    const broken = mask(120, 40, (x, y) => y >= 15 && y < 24 && ((x >= 10 && x < 55) || (x >= 60 && x < 110)))
    expect(traceSkeleton(thin(broken), options)).toHaveLength(2)
    const joined = traceSkeleton(thin(broken), { ...options, joinGap: 20 })
    expect(joined).toHaveLength(1)
    expect(boxOf(joined[0].points)[2] - boxOf(joined[0].points)[0]).toBeGreaterThan(80)
  })

  it('carries both lines straight through an X crossing', () => {
    const cross = mask(120, 120, (x, y) => {
      const inside = x >= 12 && x < 108 && y >= 12 && y < 108
      return inside && (Math.abs(x - y) <= 5 || Math.abs(x + y - 119) <= 5)
    })
    const lines = traceSkeleton(thin(cross), options)
    expect(lines).toHaveLength(2)
    for (const line of lines) {
      const [x0, y0, x1, y1] = boxOf(line.points)
      expect(x1 - x0).toBeGreaterThan(70)
      expect(y1 - y0).toBeGreaterThan(70)
    }
  })

  it('keeps a line whole where crowded fronds cross, on a crop of the real palm', () => {
    const crop = mask(PALM_CROP[0].length, PALM_CROP.length, (x, y) => PALM_CROP[y][x] === '#')
    const lines = traceSkeleton(thin(crop), { minSpur: 12, maxBend: 55, joinGap: 10 })
    const lengths = lines.map((line) => polylineLength(line.points, line.closed))
    // Before junctions joined by thinning stubs were merged: 13 pieces, the longest 72 pixels.
    expect(lines.length).toBeLessThanOrEqual(8)
    expect(Math.max(...lengths)).toBeGreaterThan(120)
    // Fewer pieces must not come from losing line: only stubs of a few pixels go.
    expect(lengths.reduce((sum, length) => sum + length, 0)).toBeGreaterThan(200)
  })

  it('carries a line straight on through a junction and ends the branch there', () => {
    const tee = mask(100, 100, (x, y) => (y >= 20 && y < 29 && x >= 10 && x < 90) || (x >= 46 && x < 55 && y >= 20 && y < 85))
    const lines = traceSkeleton(thin(tee), options)
    expect(lines).toHaveLength(2)
    const boxes = lines.map((line) => boxOf(line.points))
    const across = boxes.find(([x0, , x1]) => x1 - x0 > 60)
    const down = boxes.find(([, y0, , y1]) => y1 - y0 > 45)
    expect(across).toBeDefined()
    expect(down).toBeDefined()
  })
})

describe('colour regions', () => {
  it('traces a square with a hole as an outer loop and a hole, in opposite directions', () => {
    const loops = traceContours(40, 40, (i) => {
      const x = i % 40
      const y = Math.floor(i / 40)
      return x >= 10 && x < 30 && y >= 10 && y < 30 && !(x >= 15 && x < 25 && y >= 15 && y < 25)
    })
    expect(loops.map((loop) => loopArea(loop)).sort((a, b) => a - b)).toEqual([-100, 400])
    expect(loops.find((loop) => loopArea(loop) === 400)).toHaveLength(4)
  })

  it('keeps pixels that touch only at a corner in one region', () => {
    const loops = traceContours(4, 4, (i) => i === 5 || i === 10)
    expect(loops).toHaveLength(1)
  })

  it('finds a two-colour image’s exact colours and leaves transparency as paper', () => {
    const width = 10
    const rgba = new Uint8ClampedArray(width * width * 4)
    for (let i = 0; i < width * width; i += 1) {
      const left = i % width < 5
      rgba.set(left ? [200, 40, 40, 255] : [30, 60, 200, 255], i * 4)
    }
    rgba[3] = 0
    const { labels, palette } = quantize(rgba, { maxColours: 4, mergeDistance: 10, alphaThreshold: 128 })
    expect(palette.map(hex).sort()).toEqual(['#1E3CC8', '#C82828'])
    expect(labels[0]).toBe(-1)
    expect(labels[1]).not.toBe(labels[9])
  })

  it('folds specks into the colour around them', () => {
    const labels = new Int16Array(25).fill(0)
    labels[12] = 1
    labels[13] = 1
    removeSpecks(labels, 5, 5, 3)
    expect([...labels].every((label) => label === 0)).toBe(true)
  })

  it('grows colour under an outline so no paper shows between them', () => {
    const labels = new Int16Array([0, -1, -1, 1])
    const outline = createMask(4, 1)
    outline.data.set([0, 1, 1, 0])
    growIntoMask(labels, 4, 1, outline, 3)
    expect([...labels]).toEqual([0, 0, 1, 1])
  })
})

describe('smoothing', () => {
  it('reduces a straight run to its ends', () => {
    const points: [number, number][] = Array.from({ length: 10 }, (_, i) => [i * 10, 5])
    expect(simplify(points, 1)).toEqual([
      [0, 5],
      [90, 5],
    ])
  })

  it('writes curves both players accept, closed with Z', () => {
    const square: [number, number][] = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ]
    const closed = smoothPath(square, true)
    expect(closed.endsWith('Z')).toBe(true)
    expect(() => parsePath(closed)).not.toThrow()
    expect(smoothPath(square.slice(0, 2), false)).toBe('M 0 0 L 100 0')
    expect(() => parsePath(smoothPath(square, false))).not.toThrow()
  })
})

describe('outlines: shapes that touch', () => {
  it('traces two rings that touch as two closed lines, not a figure of eight', () => {
    const ringAt = (cx: number, x: number, y: number) => {
      const r = Math.hypot(x + 0.5 - cx, y + 0.5 - 60)
      return r >= 26 && r <= 34
    }
    const rings = mask(200, 120, (x, y) => ringAt(60, x, y) || ringAt(126, x, y))
    const lines = traceSkeleton(thin(rings), { minSpur: 12, maxBend: 55 })
    expect(lines).toHaveLength(2)
    for (const line of lines) {
      expect(line.closed).toBe(true)
      expect(polylineLength(line.points, true)).toBeGreaterThan(150)
      expect(polylineLength(line.points, true)).toBeLessThan(230)
    }
  })
})

describe('relaxing a traced line', () => {
  it('takes the steps out of a staircase and keeps its ends and its corner', () => {
    // Up a 1-in-3 slope in pixel steps, then a right-angle turn straight down.
    const stairs: [number, number][] = []
    for (let x = 0; x <= 90; x += 1) stairs.push([x, 100 - Math.floor(x / 3)])
    for (let y = 71; y <= 160; y += 1) stairs.push([90, y])
    const calm = relax(stairs, false, 40)
    expect(calm[0]).toEqual(stairs[0])
    expect(calm[calm.length - 1]).toEqual(stairs[stairs.length - 1])
    expect(calm.some(([x, y]) => Math.hypot(x - 90, y - 70) < 1.5)).toBe(true)
    for (const [x, y] of calm.slice(10, 70)) expect(Math.abs(y - (100 - x / 3 + 0.33))).toBeLessThan(0.6)
  })
})
