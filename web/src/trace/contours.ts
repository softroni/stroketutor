import type { Point } from '../svg/pathNormalize'

/**
 * The boundary loops of a region, along pixel edges: outer edges and the edges
 * of holes alike. Every pixel side between an inside and an outside pixel
 * becomes a directed edge running clockwise around its inside pixel, so outer
 * loops come out clockwise and holes anticlockwise, and together they fill the
 * region exactly under the evenodd rule. Where two inside pixels touch only
 * at a corner, the walk turns so they stay joined, matching the 8-connected
 * regions used elsewhere. Straight runs are collapsed to their corners.
 */
export function traceContours(width: number, height: number, inside: (index: number) => boolean): Point[][] {
  const vertex = (x: number, y: number) => y * (width + 1) + x
  const fromVertex: number[] = []
  const toVertex: number[] = []
  const outgoing = new Map<number, number[]>()
  const addEdge = (ax: number, ay: number, bx: number, by: number) => {
    const edge = fromVertex.length
    const a = vertex(ax, ay)
    fromVertex.push(a)
    toVertex.push(vertex(bx, by))
    const list = outgoing.get(a)
    if (list) list.push(edge)
    else outgoing.set(a, [edge])
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x
      if (!inside(i)) continue
      if (y === 0 || !inside(i - width)) addEdge(x, y, x + 1, y)
      if (x === width - 1 || !inside(i + 1)) addEdge(x + 1, y, x + 1, y + 1)
      if (y === height - 1 || !inside(i + width)) addEdge(x + 1, y + 1, x, y + 1)
      if (x === 0 || !inside(i - 1)) addEdge(x, y + 1, x, y)
    }
  }

  const coordinates = (v: number): Point => {
    const x = v % (width + 1)
    return [x, (v - x) / (width + 1)]
  }
  const used = new Uint8Array(fromVertex.length)
  const loops: Point[][] = []
  for (let first = 0; first < fromVertex.length; first += 1) {
    if (used[first]) continue
    const loop: Point[] = []
    let edge = first
    while (!used[edge]) {
      used[edge] = 1
      loop.push(coordinates(fromVertex[edge]))
      const [ax, ay] = coordinates(fromVertex[edge])
      const [bx, by] = coordinates(toVertex[edge])
      const candidates = (outgoing.get(toVertex[edge]) ?? []).filter((e) => !used[e])
      if (candidates.length === 0) break
      if (candidates.length === 1) {
        edge = candidates[0]
        continue
      }
      // A saddle: turn left (anticlockwise), joining the diagonal pixels.
      const [dx, dy] = [bx - ax, by - ay]
      edge = candidates.reduce((best, e) => {
        const [cx, cy] = coordinates(toVertex[e])
        const turn = dx * (cy - by) - dy * (cx - bx)
        const [bestX, bestY] = coordinates(toVertex[best])
        const bestTurn = dx * (bestY - by) - dy * (bestX - bx)
        return turn < bestTurn ? e : best
      })
    }
    loops.push(corners(loop))
  }
  return loops.filter((loop) => loop.length >= 3)
}

/** Drops the points in the middle of straight runs. */
function corners(loop: Point[]): Point[] {
  const n = loop.length
  return loop.filter((point, i) => {
    const previous = loop[(i - 1 + n) % n]
    const next = loop[(i + 1) % n]
    return (point[0] - previous[0]) * (next[1] - point[1]) - (point[1] - previous[1]) * (next[0] - point[0]) !== 0
  })
}
