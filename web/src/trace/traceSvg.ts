import {
  ellipseSegments,
  flattenSegments,
  lineSegments,
  normalizePath,
  pointsSegments,
  rectSegments,
  segmentsToD,
  transformSegments,
  type Matrix,
  type Point,
  type Segment,
} from '../svg/pathNormalize'
import { svgProblem } from '../svg/safety'

import { components, createMask, distanceToPaper, thin } from './bitmap'
import { traceContours } from './contours'
import { boxOf, loopArea, polylineLength, simplify, simplifyLoop, smoothPath, type Box } from './fit'
import { growIntoMask, hex, quantize, removeSpecks, type Rgb } from './palette'
import { traceSkeleton } from './skeleton'

export type { Box } from './fit'

/** A pen stroke taken from the file. */
export interface TracedStroke {
  id: string
  /** Absolute M/L/C/Q/Z on the lesson canvas. */
  d: string
  lineWidth: number
  /** Only when the file draws the line in a colour; outlines use the lesson's ink. */
  color?: string
  /** Canvas units, for timing. */
  length: number
  box: Box
  closed: boolean
  /** `outline`: the centre of a dark band the file fills; `stroke`: a line the file strokes; `edge`: a border between colours. */
  origin: 'outline' | 'stroke' | 'edge'
}

/** One colour of the file, as a single evenodd shape covering every region in that colour. */
export interface TracedFill {
  id: string
  d: string
  color: string
  /** Canvas units², for timing and order. */
  area: number
  box: Box
}

export interface TracedDrawing {
  canvas: { width: number; height: number }
  strokes: TracedStroke[]
  fills: TracedFill[]
  /** What the tracer simplified, in sentences for the creator. */
  notes: string[]
  /** Share of the traced outline length the kept strokes follow, 0–1; 1 when nothing was left out. */
  outlineCoverage: number
}

export interface TraceOptions {
  /** The lesson canvas is `size` × `size`; the file is fitted inside it. */
  size?: number
  maxColours?: number
  maxStrokes?: number
  /** Lines shorter than this, in canvas units, are texture and are left out. */
  minStrokeLength?: number
  /** A filled shape counts as drawn ink when no channel of its colour is above this (0–255). */
  inkMaxChannel?: number
  /** Dark areas wider than this, in canvas units, are coloured in rather than drawn as lines. */
  maxOutlineWidth?: number
  /** A traced line carries on through a junction if it bends by less than this, in degrees. */
  maxBend?: number
  /** Line ends closer than this, in canvas units, that continue the same way are joined. */
  joinGap?: number
}

export interface Paint {
  rgb: Rgb
  alpha: number
  /** A gradient or pattern, whose colour is not one value; `rgb` is then a grey stand-in. */
  gradient: boolean
}

/**
 * One rendered shape of the file, its geometry on the lesson canvas
 * (absolute M/L/C/Q/Z, transforms applied) and how the browser paints it.
 * The tracer classifies it as drawn ink, colour, or nothing visible; the
 * `svg optimize` command rewrites the file from these alone.
 */
export interface CollectedShape {
  index: number
  segments: Segment[]
  fill: Paint | null
  stroke: Paint | null
  strokeWidth: number
  fillRule: 'nonzero' | 'evenodd'
  lineCap: 'butt' | 'round' | 'square'
  lineJoin: 'miter' | 'round' | 'bevel'
  kind: 'ink' | 'colour' | 'none'
}

const SHAPES = 'path, rect, circle, ellipse, line, polyline, polygon'
const NOT_RENDERED = 'defs, clipPath, mask, symbol, pattern, marker'

/**
 * Turns an SVG into the strokes and fills of a v2 lesson, following the file
 * as closely as a pen can (the creator's "code traces, model teaches").
 *
 * Runs in the browser, which is what can resolve an SVG's CSS, transforms and
 * rendering. Lines the file strokes are kept exactly. Most illustration files
 * instead draw their outlines as thin dark *filled* shapes; those are rendered
 * to a mask, thinned to their centre lines and traced as pen strokes, with the
 * band's width as the line width. The file's colours are rendered separately,
 * reduced to a few, grown under the outlines so no paper shows between colour
 * and line, and traced as one shape per colour. A file with no outlines at all
 * gets its lines from the borders between its colours.
 */
export async function traceSvg(text: string, options: TraceOptions = {}): Promise<TracedDrawing> {
  const size = options.size ?? 1000
  const maxColours = options.maxColours ?? 8
  // Enough to follow a detailed illustration closely (the palm: 83% of its outlines);
  // above the 40 the quality check flags, which only warns.
  const maxStrokes = options.maxStrokes ?? 64
  const minStrokeLength = options.minStrokeLength ?? 16
  const inkMaxChannel = options.inkMaxChannel ?? 56
  const maxOutlineWidth = options.maxOutlineWidth ?? 26
  const lineOptions = { minSpur: 12, maxBend: options.maxBend ?? 55, joinGap: options.joinGap ?? 10 }

  const { svg, unmount } = mountSvg(text, size)
  try {
    const notes: string[] = []
    const drawables = collectShapes(svg, inkMaxChannel)
    if (drawables.length === 0) throw new Error('This SVG has no shapes to trace.')

    const [inkImage, colourImage] = await Promise.all([
      rasterise(svg, drawables, 'ink', size),
      rasterise(svg, drawables, 'colour', size),
    ])

    // ---------- outlines ----------
    const ink = createMask(size, size)
    for (let i = 0; i < ink.data.length; i += 1) ink.data[i] = inkImage.data[i * 4 + 3] >= 128 ? 1 : 0
    const skeleton = thin(ink)

    // Dark areas too wide to be a drawn line are coloured in instead.
    const parts = components(ink)
    const spine = new Array<number>(parts.sizes.length).fill(0)
    for (let i = 0; i < skeleton.data.length; i += 1) if (skeleton.data[i]) spine[parts.labels[i]] += 1
    const solid = parts.sizes.map((area, k) => spine[k] === 0 || area / spine[k] > maxOutlineWidth)
    if (solid.some(Boolean)) {
      const [r, g, b] = dominantInk(drawables)
      let solidCount = 0
      for (let i = 0; i < ink.data.length; i += 1) {
        const k = parts.labels[i]
        if (k < 0 || !solid[k]) continue
        ink.data[i] = 0
        skeleton.data[i] = 0
        colourImage.data.set([r, g, b, 255], i * 4)
        solidCount += 1
      }
      if (solidCount > 0) notes.push('Dark areas too wide to be a line are coloured in instead of drawn.')
    }

    const distance = distanceToPaper(ink)
    const strokes: Omit<TracedStroke, 'id'>[] = []
    for (const line of traceSkeleton(skeleton, lineOptions)) {
      const widths = line.points
        .map(([x, y]) => distance[Math.floor(y) * size + Math.floor(x)])
        .filter((value) => value > 0)
        .sort((a, b) => a - b)
      const median = widths.length > 0 ? widths[widths.length >> 1] : 2
      const lineWidth = Math.max(2, Math.min(24, Math.round(2 * median - 1)))
      strokes.push(strokeFromPoints(line.points, line.closed, lineWidth, 'outline'))
    }

    // Lines the file strokes are kept as it draws them.
    for (const drawable of drawables) {
      if (!drawable.stroke) continue
      const points = flattenSegments(drawable.segments).flat()
      if (points.length < 2) continue
      const dark = drawable.stroke.alpha > 0.5 && Math.max(...drawable.stroke.rgb) <= inkMaxChannel
      strokes.push({
        d: segmentsToD(drawable.segments),
        lineWidth: Math.max(1, Math.round(drawable.strokeWidth)),
        ...(dark || drawable.stroke.gradient ? {} : { color: hex(drawable.stroke.rgb) }),
        length: flattenSegments(drawable.segments).reduce((sum, path) => sum + polylineLength(path), 0),
        box: boxOf(points),
        closed: drawable.segments.some((segment) => segment.type === 'Z'),
        origin: 'stroke',
      })
    }

    // ---------- colours ----------
    const sourceColours = new Set(
      drawables.filter((d) => d.kind === 'colour' && d.fill && !d.fill.gradient).map((d) => hex(d.fill!.rgb)),
    )
    const { labels, palette } = quantize(colourImage.data, { maxColours, mergeDistance: 10, alphaThreshold: 128 })
    growIntoMask(labels, size, size, ink, Math.ceil(maxOutlineWidth / 2) + 2)
    removeSpecks(labels, size, size, 48)
    if (sourceColours.size > palette.length) {
      notes.push(`The file's ${sourceColours.size} colours were reduced to ${palette.length} to colour in.`)
    }

    const fills: Omit<TracedFill, 'id'>[] = []
    palette.forEach((rgb, k) => {
      let area = 0
      for (let i = 0; i < labels.length; i += 1) if (labels[i] === k) area += 1
      if (area < 48) return
      const loops = traceContours(size, size, (i) => labels[i] === k)
        .filter((loop) => Math.abs(loopArea(loop)) >= 24)
        .map((loop) => simplifyLoop(loop, 1.5))
        .filter((loop) => loop.length >= 3)
      if (loops.length === 0) return
      fills.push({
        d: loops.map((loop) => smoothPath(loop, true)).join(' '),
        color: hex(rgb),
        area,
        box: boxOf(loops.flat()),
      })
    })
    fills.sort((a, b) => b.area - a.area)

    // ---------- a file without outlines ----------
    if (strokes.length === 0 && fills.length > 0) {
      const edges = createMask(size, size)
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const i = y * size + x
          const label = labels[i]
          if (label < 0) continue
          const border =
            x === 0 || y === 0 || x === size - 1 || y === size - 1 ||
            labels[i - 1] !== label || labels[i + 1] !== label || labels[i - size] !== label || labels[i + size] !== label
          if (border) edges.data[i] = 1
        }
      }
      for (const line of traceSkeleton(thin(edges), lineOptions)) {
        strokes.push(strokeFromPoints(line.points, line.closed, 6, 'edge'))
      }
      notes.push('The file has no drawn outlines, so the lines follow the borders between its colours.')
    }

    // ---------- a drawable number of lines ----------
    const long = strokes.filter((stroke) => stroke.length >= minStrokeLength).sort((a, b) => b.length - a.length)
    const kept = long.slice(0, maxStrokes)
    const dropped = strokes.length - kept.length
    if (dropped > 0) notes.push(`${dropped} short ${dropped === 1 ? 'line was' : 'lines were'} left out, such as texture marks.`)
    kept.sort((a, b) => a.box[1] - b.box[1] || a.box[0] - b.box[0])

    const traced = (list: Omit<TracedStroke, 'id'>[]) =>
      list.filter((stroke) => stroke.origin !== 'stroke').reduce((sum, stroke) => sum + stroke.length, 0)
    const outlineCoverage = traced(strokes) > 0 ? traced(kept) / traced(strokes) : 1
    if (dropped > 0 && traced(strokes) > 0) {
      notes.push(`The lines kept follow ${Math.round(outlineCoverage * 100)}% of the file's outlines by length.`)
    }

    return {
      canvas: { width: size, height: size },
      strokes: kept.map((stroke, index) => ({ id: `s${index + 1}`, ...stroke })),
      fills: fills.map((fill, index) => ({ id: `f${index + 1}`, ...fill })),
      notes,
      outlineCoverage,
    }
  } finally {
    unmount()
  }
}

/**
 * Parses the file and mounts it off-screen, fitted to a `size` × `size`
 * canvas, so the browser resolves its CSS, transforms and rendering. A shadow
 * root keeps the file's own <style> from restyling the page around it.
 * `unmount` takes it down again.
 */
export function mountSvg(text: string, size: number): { svg: SVGSVGElement; unmount: () => void } {
  const problem = svgProblem(text)
  if (problem) throw new Error(`This SVG can't be traced: ${problem}`)
  const parsed = new DOMParser().parseFromString(text, 'image/svg+xml')
  const root = parsed.documentElement
  if (parsed.getElementsByTagName('parsererror').length > 0 || root.localName !== 'svg') {
    throw new Error('This file is not a readable SVG.')
  }

  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:${-3 * size}px;top:0;width:${size}px;height:${size}px;overflow:hidden;pointer-events:none;`
  const shadow = host.attachShadow({ mode: 'open' })
  const svg = document.importNode(root, true) as unknown as SVGSVGElement
  fitToCanvas(svg, size)
  shadow.appendChild(svg)
  document.body.appendChild(host)
  return { svg, unmount: () => host.remove() }
}

/** The file's shapes as the tracer sees them, without tracing: mount, collect, unmount. */
export function collectShapesFromText(text: string, options: { size?: number; inkMaxChannel?: number } = {}): CollectedShape[] {
  const { svg, unmount } = mountSvg(text, options.size ?? 1000)
  try {
    return collectShapes(svg, options.inkMaxChannel ?? 56)
  } finally {
    unmount()
  }
}

function fitToCanvas(svg: SVGSVGElement, size: number) {
  if (!svg.getAttribute('viewBox')) {
    const width = parseFloat(svg.getAttribute('width') ?? '')
    const height = parseFloat(svg.getAttribute('height') ?? '')
    if (!(width > 0 && height > 0)) {
      throw new Error('This SVG has neither a viewBox nor a width and height, so its drawing area is unknown.')
    }
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  }
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  svg.style.display = 'block'
}

/** Every rendered shape, its geometry mapped onto the lesson canvas, and how it is painted. */
export function collectShapes(svg: SVGSVGElement, inkMaxChannel: number): CollectedShape[] {
  const origin = svg.getBoundingClientRect()
  const out: CollectedShape[] = []
  svg.querySelectorAll<SVGGraphicsElement>(SHAPES).forEach((element) => {
    if (element.closest(NOT_RENDERED)) return
    const style = getComputedStyle(element)
    if (style.display === 'none' || style.visibility === 'hidden') return
    const local = geometry(element)
    const ctm = element.getScreenCTM()
    if (local.length === 0 || !ctm) return
    const matrix: Matrix = { a: ctm.a, b: ctm.b, c: ctm.c, d: ctm.d, e: ctm.e - origin.left, f: ctm.f - origin.top }
    const opacity = parseFloat(style.opacity || '1')
    const fill = paint(style.fill, opacity * parseFloat(style.fillOpacity || '1'))
    const strokePaint = paint(style.stroke, opacity * parseFloat(style.strokeOpacity || '1'))
    const scale = Math.sqrt(Math.abs(matrix.a * matrix.d - matrix.b * matrix.c))
    const strokeWidth = strokePaint ? parseFloat(style.strokeWidth || '1') * scale : 0
    const index = out.length
    element.setAttribute('data-st-trace', String(index))
    out.push({
      index,
      segments: transformSegments(local, matrix),
      fill,
      stroke: strokePaint && strokeWidth >= 0.5 ? strokePaint : null,
      strokeWidth,
      fillRule: style.fillRule === 'evenodd' ? 'evenodd' : 'nonzero',
      lineCap: style.strokeLinecap === 'round' || style.strokeLinecap === 'square' ? style.strokeLinecap : 'butt',
      lineJoin: style.strokeLinejoin === 'round' || style.strokeLinejoin === 'bevel' ? style.strokeLinejoin : 'miter',
      kind: fill ? (!fill.gradient && fill.alpha > 0.5 && Math.max(...fill.rgb) <= inkMaxChannel ? 'ink' : 'colour') : 'none',
    })
  })
  return out
}

function geometry(element: SVGGraphicsElement): Segment[] {
  const number = (name: string) => {
    const value = parseFloat(element.getAttribute(name) ?? '')
    return Number.isFinite(value) ? value : 0
  }
  try {
    switch (element.localName) {
      case 'path':
        return normalizePath(element.getAttribute('d') ?? '')
      case 'rect':
        return rectSegments(number('x'), number('y'), number('width'), number('height'), number('rx'), number('ry'))
      case 'circle':
        return ellipseSegments(number('cx'), number('cy'), number('r'), number('r'))
      case 'ellipse':
        return ellipseSegments(number('cx'), number('cy'), number('rx'), number('ry'))
      case 'line':
        return lineSegments(number('x1'), number('y1'), number('x2'), number('y2'))
      case 'polyline':
        return pointsSegments(element.getAttribute('points') ?? '', false)
      case 'polygon':
        return pointsSegments(element.getAttribute('points') ?? '', true)
      default:
        return []
    }
  } catch {
    // Browsers skip a path they cannot parse; so does the tracer.
    return []
  }
}

function paint(value: string, alpha: number): Paint | null {
  if (!value || value === 'none' || !(alpha > 0.05)) return null
  if (value.startsWith('url(')) return { rgb: [128, 128, 128], alpha, gradient: true }
  const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+)(%?))?\s*\)/)
  if (!match) return null
  const own = match[4] === undefined ? 1 : parseFloat(match[4]) / (match[5] ? 100 : 1)
  if (!(own * alpha > 0.05)) return null
  return { rgb: [Number(match[1]), Number(match[2]), Number(match[3])], alpha: own * alpha, gradient: false }
}

function dominantInk(drawables: CollectedShape[]): Rgb {
  const counts = new Map<string, { rgb: Rgb; n: number }>()
  for (const drawable of drawables) {
    if (drawable.kind !== 'ink' || !drawable.fill) continue
    const key = hex(drawable.fill.rgb)
    const entry = counts.get(key) ?? { rgb: drawable.fill.rgb, n: 0 }
    entry.n += 1
    counts.set(key, entry)
  }
  let best: Rgb = [16, 16, 16]
  let most = 0
  for (const { rgb, n } of counts.values()) {
    if (n > most) {
      best = rgb
      most = n
    }
  }
  return best
}

/**
 * Renders just the ink (as solid black) or just the colours (with strokes
 * removed) of the mounted SVG at canvas size. The file's own <style> travels
 * with the clone, so classes resolve exactly as they did on screen.
 */
async function rasterise(svg: SVGSVGElement, drawables: CollectedShape[], mode: 'ink' | 'colour', size: number): Promise<ImageData> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.querySelectorAll<SVGElement>('[data-st-trace]').forEach((element) => {
    const drawable = drawables[Number(element.getAttribute('data-st-trace'))]
    if (!drawable || drawable.kind !== mode) {
      element.style.display = 'none'
      return
    }
    element.style.stroke = 'none'
    if (mode === 'ink') {
      element.style.fill = '#000'
      element.style.fillOpacity = '1'
      element.style.opacity = '1'
    }
  })
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('The browser could not render the SVG.')
    context.drawImage(image, 0, 0, size, size)
    return context.getImageData(0, 0, size, size)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * A centre line as a stroke: started where a hand would start it (the top, or
 * the left of a mostly level line; a loop at its highest point), simplified
 * within a little over a pixel, and smoothed into cubic curves.
 */
function strokeFromPoints(points: Point[], closed: boolean, lineWidth: number, origin: 'outline' | 'edge'): Omit<TracedStroke, 'id'> {
  let ordered = points
  if (closed) {
    let top = 0
    points.forEach((point, i) => {
      if (point[1] < points[top][1]) top = i
    })
    ordered = [...points.slice(top), ...points.slice(0, top)]
  } else {
    const [first, last] = [points[0], points[points.length - 1]]
    const level = Math.abs(last[0] - first[0]) > 2 * Math.abs(last[1] - first[1])
    const reverse = level ? last[0] < first[0] : last[1] < first[1]
    if (reverse) ordered = [...points].reverse()
  }
  const simplified = closed ? simplifyLoop(ordered, 1.2) : simplify(ordered, 1.2)
  return {
    d: smoothPath(simplified, closed),
    lineWidth,
    length: polylineLength(simplified, closed),
    box: boxOf(simplified),
    closed,
    origin,
  }
}
