import type { Point } from '../svg/pathNormalize'

import { traceContours } from './contours'
import { loopArea, relax as relaxLine, simplifyLoop, smoothPath } from './fit'
import { hex, quantize, removeSpecks, rgbToLab, type Rgb } from './palette'

export interface ImageToSvgOptions {
  maxColours?: number
  /** A pixel is paper when every channel is at least this (0–255). */
  paperMinChannel?: number
  /** A pixel is flat colour, not an edge, when no channel differs from a neighbour's by more than this. */
  flatness?: number
  /** Regions smaller than this, in pixels, are specks and join what surrounds them. */
  minArea?: number
  /** The course's colours: each colour found is replaced by the nearest of these within `snapDistance`. */
  palette?: Rgb[]
  /** How far, in CIELAB (ΔE*76), a colour may be from a palette colour and still be snapped to it. */
  snapDistance?: number
}

export interface ImageToSvgResult {
  svg: string
  /** The colours written, largest area first, and what each was before snapping. */
  colours: { color: string; from: string; area: number }[]
  notes: string[]
}

/**
 * Turns a flat-colour picture (a generated PNG of a drawing: even dark
 * outlines, solid colour, white paper) into an SVG of plain filled shapes,
 * one evenodd path per colour, which is the kind of file `traceSvg` expects.
 *
 * A raster picture's edges are antialiased: between an outline and a colour
 * lies a band of in-between pixels that a quantiser would make into colours
 * of their own. So only flat pixels, those that match their neighbours, are
 * given a colour by `quantize`; every edge pixel then takes the colour of the
 * flat region nearest to it, a ring at a time, and the border between two
 * regions falls in the middle of the blur. Paper is a region like any other
 * until the end, so colour does not leak over an outline's outer edge.
 */
export function imageToSvg(rgba: ArrayLike<number>, width: number, height: number, options: ImageToSvgOptions = {}): ImageToSvgResult {
  const maxColours = options.maxColours ?? 8
  const paperMin = options.paperMinChannel ?? 236
  const flatness = options.flatness ?? 14
  const minArea = options.minArea ?? 48
  const snapDistance = options.snapDistance ?? 18
  const count = width * height
  const notes: string[] = []

  // ---------- flat pixels ----------
  const differs = (i: number, j: number) =>
    Math.abs(rgba[i * 4] - rgba[j * 4]) > flatness ||
    Math.abs(rgba[i * 4 + 1] - rgba[j * 4 + 1]) > flatness ||
    Math.abs(rgba[i * 4 + 2] - rgba[j * 4 + 2]) > flatness
  const PAPER = -2
  const labels = new Int16Array(count).fill(-1)
  const flat = new Uint8ClampedArray(count * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x
      if (rgba[i * 4 + 3] < 128) {
        labels[i] = PAPER
        continue
      }
      if ((x > 0 && differs(i, i - 1)) || (x < width - 1 && differs(i, i + 1)) || (y > 0 && differs(i, i - width)) || (y < height - 1 && differs(i, i + width))) continue
      if (rgba[i * 4] >= paperMin && rgba[i * 4 + 1] >= paperMin && rgba[i * 4 + 2] >= paperMin) {
        labels[i] = PAPER
        continue
      }
      flat.set([rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2], 255], i * 4)
    }
  }
  const quantized = quantize(flat, { maxColours, mergeDistance: 10, alphaThreshold: 128 })
  for (let i = 0; i < count; i += 1) if (quantized.labels[i] >= 0) labels[i] = quantized.labels[i]

  // ---------- edge pixels take the nearest region ----------
  /** The label of a 4-neighbour that has one, or -1. */
  const neighbourLabel = (i: number): number => {
    const x = i % width
    if (x > 0 && labels[i - 1] !== -1) return labels[i - 1]
    if (x < width - 1 && labels[i + 1] !== -1) return labels[i + 1]
    if (i >= width && labels[i - width] !== -1) return labels[i - width]
    if (i < count - width && labels[i + width] !== -1) return labels[i + width]
    return -1
  }
  let frontier: number[] = []
  for (let i = 0; i < count; i += 1) if (labels[i] === -1) frontier.push(i)
  while (frontier.length > 0) {
    const taken: [number, number][] = []
    const waiting: number[] = []
    for (const i of frontier) {
      const near = neighbourLabel(i)
      if (near === -1) waiting.push(i)
      else taken.push([i, near])
    }
    if (taken.length === 0) break
    for (const [i, label] of taken) labels[i] = label
    frontier = waiting
  }
  for (let i = 0; i < count; i += 1) if (labels[i] === PAPER) labels[i] = -1
  removeSpecks(labels, width, height, minArea)

  // ---------- one path per colour ----------
  const course = (options.palette ?? []).map((rgb) => ({ rgb, lab: rgbToLab(...rgb) }))
  const shapes: { color: string; from: string; area: number; d: string; dark: number }[] = []
  quantized.palette.forEach((rgb, k) => {
    let area = 0
    for (let i = 0; i < count; i += 1) if (labels[i] === k) area += 1
    if (area < minArea) return
    const loops = traceContours(width, height, (i) => labels[i] === k)
      .filter((loop) => Math.abs(loopArea(loop)) >= minArea / 2)
      .map((loop) => simplifyLoop(relax(loop), 0.7))
      .filter((loop) => loop.length >= 3)
    if (loops.length === 0) return
    let written = rgb
    if (course.length > 0) {
      const lab = rgbToLab(...rgb)
      const nearest = course
        .map((entry) => ({ entry, distance: Math.hypot(lab[0] - entry.lab[0], lab[1] - entry.lab[1], lab[2] - entry.lab[2]) }))
        .sort((a, b) => a.distance - b.distance)[0]
      if (nearest.distance <= snapDistance) written = nearest.entry.rgb
      else notes.push(`${hex(rgb)} is not close to any colour of the palette, so it is kept as it is.`)
    }
    shapes.push({ color: hex(written), from: hex(rgb), area, d: loops.map((loop) => smoothPath(loop, true, 1)).join(' '), dark: Math.max(...written) })
  })
  if (shapes.length === 0) throw new Error('This picture has no flat colour to trace: it may be a photograph, or blank.')

  // Colours first, largest first, and the darkest shape, the outlines, on top.
  shapes.sort((a, b) => b.area - a.area)
  const ink = shapes.reduce((a, b) => (b.dark < a.dark ? b : a))
  const ordered = [...shapes.filter((shape) => shape !== ink), ink]
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    ...ordered.map((shape) => `  <path fill="${shape.color}" fill-rule="evenodd" d="${shape.d}"/>`),
    '</svg>',
    '',
  ].join('\n')
  return { svg, colours: shapes.map(({ color, from, area }) => ({ color, from, area })), notes }
}

/**
 * A contour runs along pixel edges, in steps. Fitting a curve through the
 * corners of the steps gives a line that shivers, so the loop is first walked
 * at even one-unit spacing and relaxed (`fit.relax`), which takes out the steps
 * and leaves the shape and its corners.
 */
function relax(loop: Point[]): Point[] {
  const points: Point[] = []
  for (let k = 0; k < loop.length; k += 1) {
    const [ax, ay] = loop[k]
    const [bx, by] = loop[(k + 1) % loop.length]
    const steps = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay)))
    for (let step = 0; step < steps; step += 1) points.push([ax + ((bx - ax) * step) / steps, ay + ((by - ay) * step) / steps])
  }
  return points.length < 12 ? loop : relaxLine(points, true, 3)
}
