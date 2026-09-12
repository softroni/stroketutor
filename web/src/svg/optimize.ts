import { boxOf, simplify, simplifyLoop, smoothPath } from '../trace/fit'
import { hex } from '../trace/palette'
import type { CollectedShape, Paint } from '../trace/traceSvg'

import { flattenSegments, formatNumber, segmentsToD, type Point, type Segment } from './pathNormalize'

/**
 * `svg optimize`: a source file rewritten as the plain drawing the tracer
 * and the players read best. The browser has already resolved the file's
 * CSS, transforms and units into `CollectedShape`s (see `collectShapes` in
 * `trace/traceSvg.ts`); this turns them back into one `<path>` each, in
 * document order, painted with presentation attributes only:
 *
 * - every shape is a path in the players' subset, absolute M/L/C/Q/Z, with
 *   transforms applied and coordinates rounded, on a square canvas;
 * - shapes that paint nothing, and everything that is not a drawing
 *   (scripts, styles, defs, text, images, filters), are left out;
 * - with `simplify`, each path is flattened and simplified within that many
 *   canvas units, specks are dropped, and curves are smoothed again through
 *   the points that remain, keeping real corners sharp.
 *
 * Pure, so it is tested without a browser.
 */

export interface OptimizeOptions {
  /** The canvas the drawing was fitted into; the lesson's 1000 by default. */
  size?: number
  /** Decimal places kept in coordinates. */
  decimals?: number
  /** Simplify within this many canvas units; omit to keep every point. */
  simplify?: number
  /** With `simplify`: shapes whose box is smaller than this in both directions are specks. */
  minSize?: number
  /** A bend sharper than this, in degrees, stays a corner when smoothing. */
  cornerDegrees?: number
}

export interface OptimizeResult {
  svg: string
  kept: number
  dropped: number
  notes: string[]
}

const GRADIENT_STAND_IN = '#808080'

export function buildOptimizedSvg(shapes: CollectedShape[], options: OptimizeOptions = {}): OptimizeResult {
  const size = options.size ?? 1000
  const decimals = options.decimals ?? 1
  const epsilon = options.simplify
  const minSize = options.minSize ?? 4
  const cornerDegrees = options.cornerDegrees ?? 60
  const notes: string[] = []
  let invisible = 0
  let specks = 0
  let gradients = 0

  const paths: string[] = []
  for (const shape of shapes) {
    if (!shape.fill && !shape.stroke) {
      invisible += 1
      continue
    }
    let d: string
    if (epsilon === undefined) {
      d = segmentsToD(shape.segments, decimals)
    } else {
      const subpaths = simplifySubpaths(shape.segments, epsilon, minSize)
      if (subpaths.length === 0) {
        specks += 1
        continue
      }
      d = subpaths.map(({ points, closed }) => cornerAwarePath(points, closed, decimals, cornerDegrees)).join(' ')
    }
    if (shape.fill?.gradient || shape.stroke?.gradient) gradients += 1
    const attributes = [
      `d="${d}"`,
      `fill="${shape.fill ? colour(shape.fill) : 'none'}"`,
      ...(shape.fill && shape.fill.alpha < 1 ? [`fill-opacity="${formatNumber(shape.fill.alpha, 3)}"`] : []),
      ...(shape.fill && shape.fillRule === 'evenodd' ? ['fill-rule="evenodd"'] : []),
      ...(shape.stroke
        ? [
            `stroke="${colour(shape.stroke)}"`,
            `stroke-width="${formatNumber(shape.strokeWidth, decimals)}"`,
            ...(shape.stroke.alpha < 1 ? [`stroke-opacity="${formatNumber(shape.stroke.alpha, 3)}"`] : []),
            ...(shape.lineCap !== 'butt' ? [`stroke-linecap="${shape.lineCap}"`] : []),
            ...(shape.lineJoin !== 'miter' ? [`stroke-linejoin="${shape.lineJoin}"`] : []),
          ]
        : []),
    ]
    paths.push(`  <path ${attributes.join(' ')}/>`)
  }

  if (invisible > 0) notes.push(`${count(invisible, 'shape')} that painted nothing ${invisible === 1 ? 'was' : 'were'} left out.`)
  if (specks > 0) notes.push(`${count(specks, 'speck')} smaller than ${minSize} units ${specks === 1 ? 'was' : 'were'} left out.`)
  if (gradients > 0) notes.push(`${count(gradients, 'gradient or pattern')} became the flat grey ${GRADIENT_STAND_IN}; give ${gradients === 1 ? 'it' : 'them'} a colour by hand.`)

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`,
    ...paths,
    '</svg>',
    '',
  ].join('\n')
  return { svg, kept: paths.length, dropped: invisible + specks, notes }
}

function colour(paint: Paint): string {
  return paint.gradient ? GRADIENT_STAND_IN : hex(paint.rgb)
}

function count(n: number, one: string): string {
  return `${n} ${n === 1 ? one : `${one}s`}`
}

interface Subpath {
  points: Point[]
  closed: boolean
}

/** Each subpath flattened and simplified, specks dropped. Keeps whether it was closed, which `flattenSegments` does not. */
function simplifySubpaths(segments: Segment[], epsilon: number, minSize: number): Subpath[] {
  const out: Subpath[] = []
  let current: Segment[] = []
  const flush = () => {
    if (current.length === 0) return
    const closed = current.some((segment) => segment.type === 'Z')
    const flat = dedupe(flattenSegments(current)[0] ?? [])
    // A closed loop's flattening ends where it began; the loop form does not repeat the point.
    const raw = [...flat]
    while (closed && raw.length > 1 && samePoint(raw[0], raw[raw.length - 1])) raw.pop()
    const points = closed ? simplifyLoop(raw, epsilon) : simplify(raw, epsilon)
    const [x0, y0, x1, y1] = boxOf(points)
    if (points.length >= 2 && (x1 - x0 >= minSize || y1 - y0 >= minSize)) out.push({ points, closed })
    current = []
  }
  for (const segment of segments) {
    if (segment.type === 'M') flush()
    current.push(segment)
  }
  flush()
  return out
}

/** Consecutive repeats of a point, which a Z after an explicit line back leaves behind. */
function dedupe(points: Point[]): Point[] {
  return points.filter((point, index) => index === 0 || !samePoint(point, points[index - 1]))
}

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6
}

/**
 * Path data through the points: smooth curves between corners, straight
 * lines where a run has only two points. A rectangle keeps its four corners;
 * a leaf stays one curve.
 */
export function cornerAwarePath(points: Point[], closed: boolean, decimals: number, cornerDegrees: number): string {
  const n = points.length
  if (n < 2) return ''
  const corners = cornerIndices(points, closed, cornerDegrees)
  if (corners.length === 0) return smoothPath(points, closed, decimals)

  // Runs between corners; a closed loop starts at its first corner so every run ends at one.
  const ordered = closed ? [...points.slice(corners[0]), ...points.slice(0, corners[0])] : points
  const cornerSet = new Set(corners.map((index) => (closed ? (index - corners[0] + n) % n : index)))
  const runs: Point[][] = []
  let run: Point[] = [ordered[0]]
  for (let i = 1; i < n; i += 1) {
    run.push(ordered[i])
    if (cornerSet.has(i)) {
      runs.push(run)
      run = [ordered[i]]
    }
  }
  if (closed) {
    run.push(ordered[0])
    runs.push(run)
  } else if (run.length > 1) {
    runs.push(run)
  }

  const p = (point: Point) => `${formatNumber(point[0], decimals)} ${formatNumber(point[1], decimals)}`
  const parts = [`M ${p(ordered[0])}`]
  runs.forEach((segment, index) => {
    // A straight run back to the start is what Z draws; a curved one is kept.
    if (closed && index === runs.length - 1 && segment.length === 2) return
    if (segment.length === 2) parts.push(`L ${p(segment[1])}`)
    else parts.push(smoothPath(segment, false, decimals).replace(/^M [^C]*/, '').trim())
  })
  if (closed) parts.push('Z')
  return parts.join(' ')
}

/** Indices where the direction changes by more than `cornerDegrees`. */
function cornerIndices(points: Point[], closed: boolean, cornerDegrees: number): number[] {
  const n = points.length
  const threshold = (cornerDegrees * Math.PI) / 180
  const corners: number[] = []
  const first = closed ? 0 : 1
  const last = closed ? n - 1 : n - 2
  for (let i = first; i <= last; i += 1) {
    const before = points[(i - 1 + n) % n]
    const here = points[i]
    const after = points[(i + 1) % n]
    const a = Math.atan2(here[1] - before[1], here[0] - before[0])
    const b = Math.atan2(after[1] - here[1], after[0] - here[0])
    let bend = Math.abs(b - a)
    if (bend > Math.PI) bend = 2 * Math.PI - bend
    if (bend > threshold) corners.push(i)
  }
  return corners
}
