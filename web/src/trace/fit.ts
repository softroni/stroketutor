import { formatNumber, type Point } from '../svg/pathNormalize'

export type Box = [number, number, number, number]

/** Ramer–Douglas–Peucker: the fewest points that stay within `epsilon` of the line. Keeps both ends. */
export function simplify(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points.slice()
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length > 0) {
    const [first, last] = stack.pop()!
    let farthest = -1
    let farthestDistance = epsilon
    for (let i = first + 1; i < last; i += 1) {
      const distance = distanceToSegment(points[i], points[first], points[last])
      if (distance > farthestDistance) {
        farthest = i
        farthestDistance = distance
      }
    }
    if (farthest >= 0) {
      keep[farthest] = 1
      stack.push([first, farthest], [farthest, last])
    }
  }
  return points.filter((_, i) => keep[i])
}

/** `simplify` for a closed loop: split at the point farthest from the first, simplify both halves. */
export function simplifyLoop(points: Point[], epsilon: number): Point[] {
  if (points.length < 4) return points.slice()
  let far = 0
  let best = -1
  for (let i = 1; i < points.length; i += 1) {
    const distance = Math.hypot(points[i][0] - points[0][0], points[i][1] - points[0][1])
    if (distance > best) {
      best = distance
      far = i
    }
  }
  const first = simplify(points.slice(0, far + 1), epsilon)
  const second = simplify([...points.slice(far), points[0]], epsilon)
  return [...first, ...second.slice(1, -1)]
}

export function polylineLength(points: Point[], closed = false): number {
  let total = 0
  for (let i = 1; i < points.length; i += 1) total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
  if (closed && points.length > 2) {
    const last = points[points.length - 1]
    total += Math.hypot(points[0][0] - last[0], points[0][1] - last[1])
  }
  return total
}

export function boxOf(points: Point[]): Box {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [x, y] of points) {
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }
  return [x0, y0, x1, y1]
}

/** Signed area by the shoelace formula; positive for clockwise loops on a y-down canvas. */
export function loopArea(points: Point[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    sum += x1 * y2 - x2 * y1
  }
  return sum / 2
}

/**
 * A smooth curve through the points as absolute `M`/`C` path data: a uniform
 * Catmull–Rom spline, converted exactly to cubic Béziers. A closed curve ends
 * back at its first point with `Z`.
 */
export function smoothPath(points: Point[], closed: boolean, decimals = 0): string {
  const n = points.length
  const p = (point: Point) => `${formatNumber(point[0], decimals)} ${formatNumber(point[1], decimals)}`
  if (n === 0) return ''
  if (n === 1) return `M ${p(points[0])}`
  if (n === 2) return `M ${p(points[0])} L ${p(points[1])}`
  const at = (i: number): Point => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))])
  const parts = [`M ${p(points[0])}`]
  const segments = closed ? n : n - 1
  for (let i = 0; i < segments; i += 1) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    parts.push(`C ${p(c1)} ${p(c2)} ${p(p2)}`)
  }
  if (closed) parts.push('Z')
  return parts.join(' ')
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(point[0] - a[0], point[1] - a[1])
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared))
  return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy))
}
