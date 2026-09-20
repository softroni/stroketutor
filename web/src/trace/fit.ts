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
    // A short segment beside a long one (a corner after a long straight, once simplified)
    // would get a handle as long as the straight and hook out past the corner, so a
    // handle is never longer than 0.4 of its own segment. Even spacing is untouched.
    const reach = 0.4 * Math.hypot(p2[0] - p1[0], p2[1] - p1[1])
    const handle = (dx: number, dy: number): Point => {
      const length = Math.hypot(dx, dy)
      const scale = length > reach ? reach / length : 1
      return [dx * scale, dy * scale]
    }
    // At a sharp corner beside a long straight (a cube's edge, a box's side) the tangent through the
    // neighbours would bow the straight outwards, so there the handle lies along the segment itself.
    const along: Point = [(p2[0] - p1[0]) / 3, (p2[1] - p1[1]) / 3]
    const h1 = isCorner(p0, p1, p2) ? along : handle((p2[0] - p0[0]) / 6, (p2[1] - p0[1]) / 6)
    const h2 = isCorner(p1, p2, p3) ? along : handle((p3[0] - p1[0]) / 6, (p3[1] - p1[1]) / 6)
    const c1: Point = [p1[0] + h1[0], p1[1] + h1[1]]
    const c2: Point = [p2[0] - h2[0], p2[1] - h2[1]]
    parts.push(`C ${p(c1)} ${p(c2)} ${p(p2)}`)
  }
  if (closed) parts.push('Z')
  return parts.join(' ')
}

/**
 * Whether a simplified line turns a real corner at `b`: more than about 35°, with a straight of 30 units or more on
 * one side. A small round shape (a seed, a grape) turns as sharply between its few points, but never beside a long
 * segment, so it stays round.
 */
function isCorner(a: Point, b: Point, c: Point): boolean {
  const [ux, uy] = [b[0] - a[0], b[1] - a[1]]
  const [vx, vy] = [c[0] - b[0], c[1] - b[1]]
  const [u, v] = [Math.hypot(ux, uy), Math.hypot(vx, vy)]
  if (u === 0 || v === 0 || Math.max(u, v) < 30) return false
  return (ux * vx + uy * vy) / (u * v) < 0.819
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(point[0] - a[0], point[1] - a[1])
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared))
  return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy))
}

/**
 * Takes the shiver out of a line that was traced pixel by pixel. Each point
 * moves to the weighted mean of its neighbours (a binomial window), `passes`
 * times over; more passes, a calmer line (fewer for a short line, which would shrink). Corners are what a drawing is
 * recognised by, so a point where the line turns sharply stays where it is,
 * and so do the two ends of an open line. The points must be evenly and
 * closely spaced (about a unit apart), as a skeleton's or a resampled contour's are.
 */
export function relax(points: Point[], closed: boolean, passes: number): Point[] {
  const n = points.length
  if (n < 12 || passes <= 0) return points
  // A small shape (a seed, a grape) would shrink under the smoothing a long line needs.
  passes = Math.min(passes, Math.ceil((n / 25) ** 2))
  const SPAN = 12
  const at = (list: Point[], k: number): Point => (closed ? list[((k % n) + n) % n] : list[Math.max(0, Math.min(n - 1, k))])
  // How sharply the line turns at each point, as the cosine between the way in and the way out.
  const turn = points.map((point, k) => {
    if (!closed && (k < SPAN || k >= n - SPAN)) return 1
    const [ax, ay] = at(points, k - SPAN)
    const [bx, by] = at(points, k + SPAN)
    const [ux, uy] = [point[0] - ax, point[1] - ay]
    const [vx, vy] = [bx - point[0], by - point[1]]
    return (ux * vx + uy * vy) / ((Math.hypot(ux, uy) || 1) * (Math.hypot(vx, vy) || 1))
  })
  // Only the sharpest point of each corner is held, or the whole bend would stay stepped.
  const held = new Array<boolean>(n).fill(false)
  if (!closed) held[0] = held[n - 1] = true
  for (let k = 0; k < n; k += 1) {
    if (turn[k] >= CORNER_COS) continue
    let sharpest = k
    while (k < n && turn[k] < CORNER_COS) {
      if (turn[k] < turn[sharpest]) sharpest = k
      k += 1
    }
    held[sharpest] = true
  }
  let current = points
  for (let pass = 0; pass < passes; pass += 1) {
    const previous = current
    current = previous.map((point, k) =>
      held[k]
        ? point
        : ([0, 1].map((axis) => (at(previous, k - 2)[axis] + 4 * at(previous, k - 1)[axis] + 6 * point[axis] + 4 * at(previous, k + 1)[axis] + at(previous, k + 2)[axis]) / 16) as Point),
    )
  }
  return current
}

/** A turn sharper than about 60° over a dozen units either side, so a nick a few units deep (thinning leaves one where lines join) is smoothed away is a corner. */
const CORNER_COS = 0.5

