import { formatPath, parsePath, type PathSegment, type Point } from '../../player/svgPath'

type Piece = { from: Point; control1?: Point; control2?: Point; to: Point }

const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

function pointAt(piece: Piece, t: number): Point {
  if (!piece.control1 || !piece.control2) return lerp(piece.from, piece.to, t)
  const a = lerp(piece.from, piece.control1, t)
  const b = lerp(piece.control1, piece.control2, t)
  const c = lerp(piece.control2, piece.to, t)
  return lerp(lerp(a, b, t), lerp(b, c, t), t)
}

/** The part of a piece from `t0` to `t1`, exactly: de Casteljau, once from each side. */
function part(piece: Piece, t0: number, t1: number): Piece {
  if (!piece.control1 || !piece.control2) return { from: lerp(piece.from, piece.to, t0), to: lerp(piece.from, piece.to, t1) }
  const left = (p: Required<Piece>, t: number): Required<Piece> => {
    const a = lerp(p.from, p.control1, t)
    const b = lerp(p.control1, p.control2, t)
    const c = lerp(p.control2, p.to, t)
    const ab = lerp(a, b, t)
    return { from: p.from, control1: a, control2: ab, to: lerp(ab, lerp(b, c, t), t) }
  }
  const flip = (p: Required<Piece>): Required<Piece> => ({ from: p.to, control1: p.control2, control2: p.control1, to: p.from })
  const head = t1 >= 1 ? (piece as Required<Piece>) : left(piece as Required<Piece>, t1)
  return t0 <= 0 ? head : flip(left(flip(head), 1 - t0 / t1))
}

/**
 * Cuts one line into several at the points on it nearest to `cuts`, without
 * changing its shape: a curve cut part-way keeps its exact course on both
 * sides. An open line gives one more line than there are cuts. A closed line
 * needs a pen to lift somewhere, so one cut opens it there (the same loop,
 * begun at that point) and each further cut gives another line; every line
 * runs the way the original did, the first from the first cut along it.
 */
export function splitPath(d: string, cuts: Point[]): string[] {
  const segments = parsePath(d)
  if (segments.filter((segment) => segment.kind === 'move').length !== 1) throw new Error('Only a line drawn in one go can be split.')
  if (cuts.length === 0) throw new Error('Say where to cut the line.')
  const pieces: Piece[] = []
  let current = (segments[0] as Extract<PathSegment, { kind: 'move' }>).to
  const start = current
  let closed = false
  for (const segment of segments.slice(1)) {
    if (segment.kind === 'line') pieces.push({ from: current, to: segment.to })
    else if (segment.kind === 'cubic') pieces.push({ from: current, control1: segment.control1, control2: segment.control2, to: segment.end })
    else if (segment.kind === 'quad') {
      // The same curve as a cubic, so every piece is cut one way.
      const third = (a: Point, b: Point) => lerp(a, b, 2 / 3)
      pieces.push({ from: current, control1: third(current, segment.control), control2: third(segment.end, segment.control), to: segment.end })
    } else if (segment.kind === 'close') {
      closed = true
      if (current.x !== start.x || current.y !== start.y) pieces.push({ from: current, to: start })
      current = start
      continue
    }
    current = pieces[pieces.length - 1].to
  }
  if (pieces.length === 0) throw new Error('This line has no length to split.')

  // Where along the line each cut falls: piece index + t.
  const total = pieces.length
  const SAMPLES = 32
  const places = cuts.map((cut) => {
    let best = { u: 0, distance: Infinity }
    pieces.forEach((piece, index) => {
      for (let k = 0; k <= SAMPLES; k += 1) {
        const at = pointAt(piece, k / SAMPLES)
        const distance = Math.hypot(at.x - cut.x, at.y - cut.y)
        if (distance < best.distance) best = { u: index + k / SAMPLES, distance }
      }
    })
    // Between the samples either side of the best, close in on the nearest point.
    const index = Math.min(total - 1, Math.floor(best.u))
    let low = Math.max(0, best.u - index - 1 / SAMPLES)
    let high = Math.min(1, best.u - index + 1 / SAMPLES)
    const distanceAt = (t: number) => Math.hypot(pointAt(pieces[index], t).x - cut.x, pointAt(pieces[index], t).y - cut.y)
    for (let k = 0; k < 40; k += 1) {
      const a = low + (high - low) / 3
      const b = high - (high - low) / 3
      if (distanceAt(a) < distanceAt(b)) high = b
      else low = a
    }
    const t = (low + high) / 2
    // A cut a hair from a join is meant for the join.
    return index + (t < 1e-4 ? 0 : t > 1 - 1e-4 ? 1 : Number(t.toFixed(4)))
  })
  const sorted = [...new Set(places.map((u) => (closed ? u % total : u)))].sort((a, b) => a - b)
  const inner = closed ? sorted : sorted.filter((u) => u > 0 && u < total)
  if (inner.length === 0) throw new Error('The cut falls on the end of the line, so there is nothing to split.')

  const range = (u0: number, u1: number): string => {
    const out: PathSegment[] = []
    for (let index = Math.floor(u0); index < Math.ceil(u1); index += 1) {
      const piece = pieces[index % total]
      const cutPiece = part(piece, Math.max(0, u0 - index), Math.min(1, u1 - index))
      if (out.length === 0) out.push({ kind: 'move', to: cutPiece.from })
      out.push(cutPiece.control1 && cutPiece.control2 ? { kind: 'cubic', control1: cutPiece.control1, control2: cutPiece.control2, end: cutPiece.to } : { kind: 'line', to: cutPiece.to })
    }
    return formatPath(out)
  }
  if (closed) return inner.map((u, k) => range(u, k + 1 < inner.length ? inner[k + 1] : inner[0] + total))
  const bounds = [0, ...inner, total]
  return bounds.slice(0, -1).map((u, k) => range(u, bounds[k + 1]))
}
