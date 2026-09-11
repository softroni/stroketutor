/**
 * Any SVG path in, the players' subset out: absolute M, L, C, Q and Z.
 *
 * The tutorial format accepts only that subset (see `player/svgPath.ts`), but
 * SVG files use the whole grammar: relative commands, H and V, the S and T
 * shorthands and elliptical arcs. Each is converted exactly — arcs become cubic
 * Béziers of at most 90° each — so a traced lesson keeps the source's geometry.
 * Grammar: https://www.w3.org/TR/SVG2/paths.html#PathDataBNF
 * Arcs: https://www.w3.org/TR/SVG2/implnote.html#ArcImplementationNotes
 */

export type Point = [number, number]

export type Segment =
  | { type: 'M'; to: Point }
  | { type: 'L'; to: Point }
  | { type: 'C'; c1: Point; c2: Point; to: Point }
  | { type: 'Q'; c: Point; to: Point }
  | { type: 'Z' }

/** An affine transform, as in SVG's `matrix(a b c d e f)`. */
export interface Matrix {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

export class PathSyntaxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PathSyntaxError'
  }
}

const NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y
const COMMAND = /[MmLlHhVvCcSsQqTtAaZz]/

class Scanner {
  index = 0

  constructor(readonly text: string) {}

  done(): boolean {
    this.skipSeparators()
    return this.index >= this.text.length
  }

  skipSeparators(): void {
    while (this.index < this.text.length && /[\s,]/.test(this.text[this.index])) this.index += 1
  }

  peek(): string {
    return this.text[this.index]
  }

  number(): number {
    this.skipSeparators()
    NUMBER.lastIndex = this.index
    const match = NUMBER.exec(this.text)
    if (!match) throw new PathSyntaxError(`Expected a number at position ${this.index}.`)
    const value = Number(match[0])
    if (!Number.isFinite(value)) throw new PathSyntaxError(`The number at position ${this.index} is out of range.`)
    this.index = NUMBER.lastIndex
    return value
  }

  /** Arc flags may be written without separators, as in `a10 10 0 01 20 20`. */
  flag(): boolean {
    this.skipSeparators()
    const ch = this.text[this.index]
    if (ch !== '0' && ch !== '1') throw new PathSyntaxError(`Expected an arc flag, 0 or 1, at position ${this.index}.`)
    this.index += 1
    return ch === '1'
  }

  point(origin: Point): Point {
    const x = this.number()
    const y = this.number()
    return [x + origin[0], y + origin[1]]
  }
}

const reflect = (point: Point, about: Point): Point => [2 * about[0] - point[0], 2 * about[1] - point[1]]

/** Parses path data of any SVG form into absolute M/L/C/Q/Z segments. */
export function normalizePath(d: string): Segment[] {
  const scanner = new Scanner(d)
  const out: Segment[] = []
  let current: Point = [0, 0]
  let start: Point = [0, 0]
  let lastCubic: Point | null = null
  let lastQuad: Point | null = null
  let command = ''

  while (!scanner.done()) {
    const ch = scanner.peek()
    if (/[a-zA-Z]/.test(ch)) {
      if (!COMMAND.test(ch)) throw new PathSyntaxError(`Unknown path command "${ch}" at position ${scanner.index}.`)
      command = ch
      scanner.index += 1
    } else if (command === 'Z' || command === 'z') {
      throw new PathSyntaxError(`Unexpected number after Z at position ${scanner.index}.`)
    }
    if (out.length === 0 && command !== 'M' && command !== 'm') {
      throw new PathSyntaxError('Path data must begin with a moveto (M or m).')
    }

    const relative = command === command.toLowerCase()
    const origin: Point = relative ? current : [0, 0]
    let cubic: Point | null = null
    let quad: Point | null = null

    switch (command.toUpperCase()) {
      case 'M': {
        const to = scanner.point(origin)
        out.push({ type: 'M', to })
        current = start = to
        // Further coordinate pairs after a moveto are implicit linetos.
        command = relative ? 'l' : 'L'
        break
      }
      case 'L': {
        const to = scanner.point(origin)
        out.push({ type: 'L', to })
        current = to
        break
      }
      case 'H': {
        const to: Point = [scanner.number() + (relative ? current[0] : 0), current[1]]
        out.push({ type: 'L', to })
        current = to
        break
      }
      case 'V': {
        const to: Point = [current[0], scanner.number() + (relative ? current[1] : 0)]
        out.push({ type: 'L', to })
        current = to
        break
      }
      case 'C': {
        const c1 = scanner.point(origin)
        const c2 = scanner.point(origin)
        const to = scanner.point(origin)
        out.push({ type: 'C', c1, c2, to })
        current = to
        cubic = c2
        break
      }
      case 'S': {
        const c1 = lastCubic ? reflect(lastCubic, current) : current
        const c2 = scanner.point(origin)
        const to = scanner.point(origin)
        out.push({ type: 'C', c1, c2, to })
        current = to
        cubic = c2
        break
      }
      case 'Q': {
        const c = scanner.point(origin)
        const to = scanner.point(origin)
        out.push({ type: 'Q', c, to })
        current = to
        quad = c
        break
      }
      case 'T': {
        const c: Point = lastQuad ? reflect(lastQuad, current) : current
        const to = scanner.point(origin)
        out.push({ type: 'Q', c, to })
        current = to
        quad = c
        break
      }
      case 'A': {
        const rx = scanner.number()
        const ry = scanner.number()
        const rotation = scanner.number()
        const large = scanner.flag()
        const sweep = scanner.flag()
        const to = scanner.point(origin)
        out.push(...arcToCubics(current, rx, ry, rotation, large, sweep, to))
        current = to
        break
      }
      case 'Z': {
        out.push({ type: 'Z' })
        current = start
        break
      }
    }
    lastCubic = cubic
    lastQuad = quad
  }
  return out
}

/**
 * An elliptical arc as cubic Béziers of at most 90° each (SVG 2 implementation
 * notes, B.2.4 and B.2.5): endpoint to centre parameterisation, then the
 * standard `4/3 · tan(θ/4)` control-point distance.
 */
export function arcToCubics(
  from: Point,
  rxIn: number,
  ryIn: number,
  rotationDegrees: number,
  largeArc: boolean,
  sweep: boolean,
  to: Point,
): Segment[] {
  if (from[0] === to[0] && from[1] === to[1]) return []
  let rx = Math.abs(rxIn)
  let ry = Math.abs(ryIn)
  if (rx === 0 || ry === 0) return [{ type: 'L', to }]

  const phi = (rotationDegrees * Math.PI) / 180
  const cos = Math.cos(phi)
  const sin = Math.sin(phi)
  const dx = (from[0] - to[0]) / 2
  const dy = (from[1] - to[1]) / 2
  const x1 = cos * dx + sin * dy
  const y1 = -sin * dx + cos * dy

  // Radii too small to reach are scaled up just enough (B.2.5).
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
  if (lambda > 1) {
    const scale = Math.sqrt(lambda)
    rx *= scale
    ry *= scale
  }

  const rx2 = rx * rx
  const ry2 = ry * ry
  const numerator = rx2 * ry2 - rx2 * y1 * y1 - ry2 * x1 * x1
  const denominator = rx2 * y1 * y1 + ry2 * x1 * x1
  let coefficient = denominator === 0 ? 0 : Math.sqrt(Math.max(0, numerator / denominator))
  if (largeArc === sweep) coefficient = -coefficient
  const cxPrime = (coefficient * rx * y1) / ry
  const cyPrime = (-coefficient * ry * x1) / rx
  const cx = cos * cxPrime - sin * cyPrime + (from[0] + to[0]) / 2
  const cy = sin * cxPrime + cos * cyPrime + (from[1] + to[1]) / 2

  const angle = (ux: number, uy: number, vx: number, vy: number) =>
    Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
  const startAngle = angle(1, 0, (x1 - cxPrime) / rx, (y1 - cyPrime) / ry)
  let delta = angle((x1 - cxPrime) / rx, (y1 - cyPrime) / ry, (-x1 - cxPrime) / rx, (-y1 - cyPrime) / ry)
  if (!sweep && delta > 0) delta -= 2 * Math.PI
  if (sweep && delta < 0) delta += 2 * Math.PI

  const parts = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9))
  const step = delta / parts
  const k = (4 / 3) * Math.tan(step / 4)
  const at = (t: number): Point => {
    const x = rx * Math.cos(t)
    const y = ry * Math.sin(t)
    return [cos * x - sin * y + cx, sin * x + cos * y + cy]
  }
  const tangent = (t: number): Point => {
    const x = -rx * Math.sin(t)
    const y = ry * Math.cos(t)
    return [cos * x - sin * y, sin * x + cos * y]
  }

  const out: Segment[] = []
  for (let index = 0; index < parts; index += 1) {
    const t1 = startAngle + index * step
    const t2 = t1 + step
    const a = at(t1)
    const b = index === parts - 1 ? to : at(t2)
    const ta = tangent(t1)
    const tb = tangent(t2)
    out.push({
      type: 'C',
      c1: [a[0] + k * ta[0], a[1] + k * ta[1]],
      c2: [b[0] - k * tb[0], b[1] - k * tb[1]],
      to: b,
    })
  }
  return out
}

// ---------- basic shapes ----------

export function ellipseSegments(cx: number, cy: number, rx: number, ry: number): Segment[] {
  if (!(rx > 0) || !(ry > 0)) return []
  const east: Point = [cx + rx, cy]
  const south: Point = [cx, cy + ry]
  const west: Point = [cx - rx, cy]
  const north: Point = [cx, cy - ry]
  return [
    { type: 'M', to: east },
    ...arcToCubics(east, rx, ry, 0, false, true, south),
    ...arcToCubics(south, rx, ry, 0, false, true, west),
    ...arcToCubics(west, rx, ry, 0, false, true, north),
    ...arcToCubics(north, rx, ry, 0, false, true, east),
    { type: 'Z' },
  ]
}

export function rectSegments(x: number, y: number, width: number, height: number, rxIn = 0, ryIn = 0): Segment[] {
  if (!(width > 0) || !(height > 0)) return []
  // An absent radius takes the other's value (SVG 2 §10.2).
  const rx = Math.min(Math.max(0, rxIn || ryIn), width / 2)
  const ry = Math.min(Math.max(0, ryIn || rxIn), height / 2)
  const right = x + width
  const bottom = y + height
  if (rx === 0 || ry === 0) {
    return [
      { type: 'M', to: [x, y] },
      { type: 'L', to: [right, y] },
      { type: 'L', to: [right, bottom] },
      { type: 'L', to: [x, bottom] },
      { type: 'Z' },
    ]
  }
  const corner = (from: Point, to: Point) => arcToCubics(from, rx, ry, 0, false, true, to)
  return [
    { type: 'M', to: [x + rx, y] },
    { type: 'L', to: [right - rx, y] },
    ...corner([right - rx, y], [right, y + ry]),
    { type: 'L', to: [right, bottom - ry] },
    ...corner([right, bottom - ry], [right - rx, bottom]),
    { type: 'L', to: [x + rx, bottom] },
    ...corner([x + rx, bottom], [x, bottom - ry]),
    { type: 'L', to: [x, y + ry] },
    ...corner([x, y + ry], [x + rx, y]),
    { type: 'Z' },
  ]
}

export function lineSegments(x1: number, y1: number, x2: number, y2: number): Segment[] {
  return [
    { type: 'M', to: [x1, y1] },
    { type: 'L', to: [x2, y2] },
  ]
}

/** `<polyline>` and `<polygon>` points. An odd trailing number is ignored, as SVG does. */
export function pointsSegments(points: string, closed: boolean): Segment[] {
  const numbers = (points.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? []).map(Number)
  const pairs = Math.floor(numbers.length / 2)
  if (pairs < 2) return []
  const out: Segment[] = [{ type: 'M', to: [numbers[0], numbers[1]] }]
  for (let index = 1; index < pairs; index += 1) out.push({ type: 'L', to: [numbers[2 * index], numbers[2 * index + 1]] })
  if (closed) out.push({ type: 'Z' })
  return out
}

// ---------- transforms, output, sampling ----------

export function transformPoint(point: Point, m: Matrix): Point {
  return [m.a * point[0] + m.c * point[1] + m.e, m.b * point[0] + m.d * point[1] + m.f]
}

/** Affine maps keep lines lines and Béziers Béziers, so transforming control points is exact. */
export function transformSegments(segments: Segment[], m: Matrix): Segment[] {
  const t = (point: Point) => transformPoint(point, m)
  return segments.map((segment) => {
    switch (segment.type) {
      case 'M':
      case 'L':
        return { type: segment.type, to: t(segment.to) }
      case 'C':
        return { type: 'C', c1: t(segment.c1), c2: t(segment.c2), to: t(segment.to) }
      case 'Q':
        return { type: 'Q', c: t(segment.c), to: t(segment.to) }
      case 'Z':
        return segment
    }
  })
}

export function formatNumber(value: number, decimals = 0): string {
  const factor = 10 ** decimals
  const rounded = Math.round(value * factor) / factor
  return String(Object.is(rounded, -0) ? 0 : rounded)
}

/** Path data in the players' subset: absolute, space-separated, plain numbers. */
export function segmentsToD(segments: Segment[], decimals = 0): string {
  const p = (point: Point) => `${formatNumber(point[0], decimals)} ${formatNumber(point[1], decimals)}`
  return segments
    .map((segment) => {
      switch (segment.type) {
        case 'M':
          return `M ${p(segment.to)}`
        case 'L':
          return `L ${p(segment.to)}`
        case 'C':
          return `C ${p(segment.c1)} ${p(segment.c2)} ${p(segment.to)}`
        case 'Q':
          return `Q ${p(segment.c)} ${p(segment.to)}`
        case 'Z':
          return 'Z'
      }
    })
    .join(' ')
}

/** Each subpath as a polyline, curves sampled `steps` times. */
export function flattenSegments(segments: Segment[], steps = 12): Point[][] {
  const paths: Point[][] = []
  let points: Point[] = []
  let pen: Point = [0, 0]
  let start: Point = [0, 0]
  for (const segment of segments) {
    switch (segment.type) {
      case 'M':
        if (points.length > 1) paths.push(points)
        points = [segment.to]
        pen = start = segment.to
        break
      case 'L':
        points.push(segment.to)
        pen = segment.to
        break
      case 'C':
        for (let k = 1; k <= steps; k += 1) points.push(cubicAt(pen, segment.c1, segment.c2, segment.to, k / steps))
        pen = segment.to
        break
      case 'Q':
        for (let k = 1; k <= steps; k += 1) points.push(quadAt(pen, segment.c, segment.to, k / steps))
        pen = segment.to
        break
      case 'Z':
        points.push(start)
        pen = start
        break
    }
  }
  if (points.length > 1) paths.push(points)
  return paths
}

function cubicAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ]
}

function quadAt(p0: Point, p1: Point, p2: Point, t: number): Point {
  const u = 1 - t
  return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]
}
