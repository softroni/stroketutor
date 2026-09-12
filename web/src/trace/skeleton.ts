import type { Mask } from './bitmap'

export type Point = [number, number]

export interface Polyline {
  /** Pixel centres, in order. */
  points: Point[]
  closed: boolean
}

export interface SkeletonOptions {
  /** Dead-end side branches shorter than this, in pixels, are thinning artefacts and go. */
  minSpur: number
  /** At a junction, two branches continue as one stroke if they bend by less than this, in degrees. */
  maxBend: number
  /**
   * Ends of separate lines closer than this, in pixels, that carry on in the
   * same direction are joined into one stroke. Thinning breaks a line wherever
   * other lines crowd it; a pen would not lift there.
   */
  joinGap?: number
}

const ORTHOGONAL: Point[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
]
const DIAGONAL: Point[] = [
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
]
/** How far along a branch, in pixels, its direction at a junction is measured. */
const DIRECTION_SPAN = 10

interface Branch {
  pixels: number[]
  from: number
  to: number
}

/**
 * Turns a one-pixel skeleton into pen strokes.
 *
 * Pixels are linked by m-adjacency — a diagonal step counts only where no
 * orthogonal route exists — so a staircase reads as a line, not a knot of tiny
 * triangles. Endpoints and junctions split the skeleton into branches; short
 * dead-end spurs are pruned; then at each junction the branches that continue
 * most nearly straight are joined, the way a pen carries on through a crossing.
 */
export function traceSkeleton(skeleton: Mask, options: SkeletonOptions): Polyline[] {
  const { width: w, height: h, data } = skeleton
  const size = w * h
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && data[y * w + x] === 1
  const xy = (i: number): Point => {
    const x = i % w
    return [x, (i - x) / w]
  }
  const neighbours = (i: number): number[] => {
    const [x, y] = xy(i)
    const out: number[] = []
    for (const [dx, dy] of ORTHOGONAL) if (on(x + dx, y + dy)) out.push(i + dy * w + dx)
    for (const [dx, dy] of DIAGONAL) {
      if (on(x + dx, y + dy) && !on(x + dx, y) && !on(x, y + dy)) out.push(i + dy * w + dx)
    }
    return out
  }

  const pixels: number[] = []
  for (let i = 0; i < size; i += 1) if (data[i]) pixels.push(i)
  const degree = new Uint8Array(size)
  for (const i of pixels) degree[i] = neighbours(i).length

  // Nodes: endpoints, isolated pixels, and clusters of touching junction pixels.
  const group = new Int32Array(size).fill(-1)
  const nodes: { point: Point; pixels: number[] }[] = []
  for (const seed of pixels) {
    if (degree[seed] === 2 || group[seed] >= 0) continue
    const id = nodes.length
    const members: number[] = []
    const stack = [seed]
    group[seed] = id
    while (stack.length > 0) {
      const i = stack.pop()!
      members.push(i)
      if (degree[i] < 3) continue
      const [x, y] = xy(i)
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const j = i + dy * w + dx
          if ((dx || dy) && on(x + dx, y + dy) && degree[j] >= 3 && group[j] < 0) {
            group[j] = id
            stack.push(j)
          }
        }
      }
    }
    const point: Point = [0, 0]
    for (const i of members) {
      const [x, y] = xy(i)
      point[0] += x / members.length
      point[1] += y / members.length
    }
    nodes.push({ point, pixels: members })
  }

  // Branches run from node to node through pixels of degree 2.
  const used = new Set<number>()
  const step = (a: number, b: number) => (a < b ? a * size + b : b * size + a)
  const visited = new Uint8Array(size)
  const branches: Branch[] = []
  for (const node of nodes) {
    for (const start of node.pixels) {
      visited[start] = 1
      for (const next of neighbours(start)) {
        if (used.has(step(start, next))) continue
        used.add(step(start, next))
        if (group[next] === group[start]) continue
        const path = [start, next]
        let previous = start
        let current = next
        while (group[current] < 0) {
          visited[current] = 1
          const onward = neighbours(current).filter((q) => q !== previous && !used.has(step(current, q)))
          if (onward.length === 0) break
          used.add(step(current, onward[0]))
          path.push(onward[0])
          previous = current
          current = onward[0]
        }
        visited[current] = 1
        branches.push({ pixels: path, from: group[start], to: group[current] >= 0 ? group[current] : group[start] })
      }
    }
  }

  // Closed loops with no node on them, such as a ring.
  const loops: number[][] = []
  for (const seed of pixels) {
    if (visited[seed] || degree[seed] !== 2) continue
    const loop = [seed]
    visited[seed] = 1
    let current = seed
    for (;;) {
      const next = neighbours(current).find((q) => !visited[q])
      if (next === undefined) break
      visited[next] = 1
      loop.push(next)
      current = next
    }
    loops.push(loop)
  }

  // Prune dead-end spurs; a junction left with two branches then simply continues.
  const alive = branches.map(() => true)
  for (let round = 0; round < 3; round += 1) {
    const count = new Array<number>(nodes.length).fill(0)
    branches.forEach((branch, k) => {
      if (!alive[k]) return
      count[branch.from] += 1
      count[branch.to] += 1
    })
    let pruned = false
    branches.forEach((branch, k) => {
      if (!alive[k] || branch.pixels.length >= options.minSpur) return
      const deadEnd =
        (count[branch.from] === 1 && count[branch.to] >= 3) || (count[branch.to] === 1 && count[branch.from] >= 3)
      if (deadEnd) {
        alive[k] = false
        pruned = true
      }
    })
    if (!pruned) break
  }

  // Thinning splits a crossing into junctions a few pixels apart, joined by a
  // stub no pen would draw, and leaves tiny loops at some junctions. Where
  // lines crowd, those stubs cut every line that passes through. Junctions
  // joined by a branch shorter than minSpur become one, and both kinds of stub
  // go, so lines are paired across the whole crossing.
  const root = nodes.map((_, n) => n)
  const find = (n: number): number => {
    let r = n
    while (root[r] !== r) r = root[r]
    while (root[n] !== r) [n, root[n]] = [root[n], r]
    return r
  }
  const branchCount = new Array<number>(nodes.length).fill(0)
  branches.forEach((branch, k) => {
    if (!alive[k]) return
    branchCount[branch.from] += 1
    branchCount[branch.to] += 1
  })
  branches.forEach((branch, k) => {
    if (!alive[k] || branch.pixels.length >= options.minSpur) return
    if (branch.from === branch.to) {
      // A loop that is the whole line stays; a loop hanging off a junction goes.
      if (branchCount[branch.from] > 2) alive[k] = false
    } else if (branchCount[branch.from] >= 3 && branchCount[branch.to] >= 3) {
      alive[k] = false
      root[find(branch.from)] = find(branch.to)
    }
  })
  const merged = nodes.map(() => ({ x: 0, y: 0, n: 0 }))
  nodes.forEach((node, n) => {
    const into = merged[find(n)]
    into.x += node.point[0]
    into.y += node.point[1]
    into.n += 1
  })

  // Pair branch ends at each node. End key: branch * 2, +1 for the `to` end.
  const ends: number[][] = nodes.map(() => [])
  branches.forEach((branch, k) => {
    if (!alive[k]) return
    ends[find(branch.from)].push(k * 2)
    ends[find(branch.to)].push(k * 2 + 1)
  })
  const direction = (end: number): Point => {
    const pixelsOf = branches[end >> 1].pixels
    const sequence = end & 1 ? [...pixelsOf].reverse() : pixelsOf
    const [ax, ay] = xy(sequence[0])
    const [bx, by] = xy(sequence[Math.min(sequence.length - 1, DIRECTION_SPAN)])
    const length = Math.hypot(bx - ax, by - ay) || 1
    return [(bx - ax) / length, (by - ay) / length]
  }
  const partner = new Int32Array(branches.length * 2).fill(-1)
  const straightEnough = -Math.cos((options.maxBend * Math.PI) / 180)
  nodes.forEach((_, n) => {
    const list = ends[n]
    if (list.length === 2) {
      partner[list[0]] = list[1]
      partner[list[1]] = list[0]
      return
    }
    if (list.length < 3) return
    const pairs: { a: number; b: number; dot: number }[] = []
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const [ax, ay] = direction(list[i])
        const [bx, by] = direction(list[j])
        const dot = ax * bx + ay * by
        if (dot <= straightEnough) pairs.push({ a: list[i], b: list[j], dot })
      }
    }
    pairs.sort((p, q) => p.dot - q.dot)
    for (const { a, b } of pairs) {
      if (partner[a] >= 0 || partner[b] >= 0) continue
      partner[a] = b
      partner[b] = a
    }
  })

  const centre = (i: number): Point => {
    const [x, y] = xy(i)
    return [x + 0.5, y + 0.5]
  }
  const nodePoint = (n: number): Point => {
    const node = merged[find(n)]
    return [node.x / node.n + 0.5, node.y / node.n + 0.5]
  }
  const endNode = (end: number) => find(end & 1 ? branches[end >> 1].to : branches[end >> 1].from)

  // Walk chains of paired branches, starting from ends that stop.
  const walked = new Uint8Array(branches.length)
  const polylines: Polyline[] = []
  const walk = (entry: number) => {
    const points: Point[] = []
    const startNode = endNode(entry)
    if (ends[startNode].length >= 3) points.push(nodePoint(startNode))
    let end = entry
    let closed = false
    for (;;) {
      const k = end >> 1
      walked[k] = 1
      const sequence = end & 1 ? [...branches[k].pixels].reverse() : branches[k].pixels
      for (const pixel of sequence) points.push(centre(pixel))
      const exit = end ^ 1
      const next = partner[exit]
      if (next < 0) {
        if (ends[endNode(exit)].length >= 3) points.push(nodePoint(endNode(exit)))
        break
      }
      if (walked[next >> 1]) {
        closed = next === entry
        break
      }
      end = next
    }
    polylines.push({ points: dedupe(points), closed })
  }
  branches.forEach((_, k) => {
    for (const end of [k * 2, k * 2 + 1]) {
      if (alive[k] && !walked[k] && partner[end] < 0) walk(end)
    }
  })
  branches.forEach((_, k) => {
    if (alive[k] && !walked[k]) walk(k * 2)
  })
  for (const loop of loops) polylines.push({ points: loop.map(centre), closed: true })

  const lines = polylines.filter((polyline) => polyline.points.length >= 2)
  return options.joinGap ? bridgeGaps(lines, options.joinGap, options.maxBend) : lines
}

/**
 * Joins the ends of lines that nearly meet and continue in the same direction,
 * nearest first, and closes a line whose own two ends meet that way.
 */
function bridgeGaps(input: Polyline[], gap: number, maxBend: number): Polyline[] {
  const lines = input.map((line) => ({ points: line.points.slice(), closed: line.closed }))
  const straightOn = -Math.cos((maxBend * Math.PI) / 180)
  const tip = (points: Point[], atEnd: boolean) => (atEnd ? points[points.length - 1] : points[0])
  const outward = (points: Point[], atEnd: boolean): Point => {
    const n = points.length
    const back = atEnd ? points[Math.max(0, n - 1 - DIRECTION_SPAN)] : points[Math.min(n - 1, DIRECTION_SPAN)]
    const end = tip(points, atEnd)
    const length = Math.hypot(end[0] - back[0], end[1] - back[1]) || 1
    return [(end[0] - back[0]) / length, (end[1] - back[1]) / length]
  }
  const lengthOf = (points: Point[]) =>
    points.reduce((sum, point, i) => (i === 0 ? 0 : sum + Math.hypot(point[0] - points[i - 1][0], point[1] - points[i - 1][1])), 0)

  for (;;) {
    let best: { a: number; aEnd: boolean; b: number; bEnd: boolean; distance: number } | null = null
    for (let a = 0; a < lines.length; a += 1) {
      if (lines[a].closed) continue
      for (const aEnd of [false, true]) {
        const pa = tip(lines[a].points, aEnd)
        const da = outward(lines[a].points, aEnd)
        for (let b = a; b < lines.length; b += 1) {
          if (lines[b].closed) continue
          for (const bEnd of [false, true]) {
            // Each pair of ends once; a line meets itself only start to end.
            if (a === b && (aEnd || !bEnd)) continue
            const pb = tip(lines[b].points, bEnd)
            const dx = pb[0] - pa[0]
            const dy = pb[1] - pa[1]
            const distance = Math.hypot(dx, dy)
            if (distance > gap || (best && distance >= best.distance)) continue
            const db = outward(lines[b].points, bEnd)
            if (da[0] * db[0] + da[1] * db[1] > straightOn) continue
            // The other end must lie ahead, not behind.
            if (distance > 1 && dx * da[0] + dy * da[1] < 0) continue
            if (a === b && lengthOf(lines[a].points) < 4 * gap) continue
            best = { a, aEnd, b, bEnd, distance }
          }
        }
      }
    }
    if (!best) break
    if (best.a === best.b) {
      lines[best.a].closed = true
      continue
    }
    const first = best.aEnd ? lines[best.a].points : [...lines[best.a].points].reverse()
    const second = best.bEnd ? [...lines[best.b].points].reverse() : lines[best.b].points
    lines[best.a] = { points: [...first, ...second], closed: false }
    lines.splice(best.b, 1)
  }
  return lines
}

function dedupe(points: Point[]): Point[] {
  return points.filter((point, index) => {
    const previous = points[index - 1]
    return !previous || previous[0] !== point[0] || previous[1] !== point[1]
  })
}
