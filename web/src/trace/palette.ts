import type { Mask } from './bitmap'

export type Rgb = [number, number, number]
type Lab = [number, number, number]

export interface Quantized {
  /** Palette index per pixel; -1 where the image is transparent. */
  labels: Int16Array
  /** Each colour is the most common exact source colour in its cluster, so fills keep the file's own colours. */
  palette: Rgb[]
}

export interface QuantizeOptions {
  maxColours: number
  /** Clusters closer than this in CIELAB (ΔE*76) become one colour. */
  mergeDistance: number
  /** Pixels less opaque than this (0–255) are paper. */
  alphaThreshold: number
}

/**
 * Reduces an image to a few colours a learner can colour in with: k-means in
 * CIELAB (so "close" means close to the eye), seeded deterministically so the
 * same file always traces the same way, then clusters that ended up nearly the
 * same colour are merged.
 */
export function quantize(rgba: ArrayLike<number>, options: QuantizeOptions): Quantized {
  const count = Math.floor(rgba.length / 4)
  const labels = new Int16Array(count).fill(-1)
  const opaque: number[] = []
  for (let i = 0; i < count; i += 1) if (rgba[i * 4 + 3] >= options.alphaThreshold) opaque.push(i)
  if (opaque.length === 0) return { labels, palette: [] }

  const stride = Math.max(1, Math.floor(opaque.length / 20000))
  const samples: Lab[] = []
  for (let s = 0; s < opaque.length; s += stride) samples.push(labAt(rgba, opaque[s]))

  let centroids = seed(samples, Math.min(options.maxColours, samples.length))
  let weights = new Array<number>(centroids.length).fill(0)
  for (let round = 0; round < 12; round += 1) {
    const sums = centroids.map((): [number, number, number] => [0, 0, 0])
    weights = new Array<number>(centroids.length).fill(0)
    for (const sample of samples) {
      const k = nearest(centroids, sample)
      sums[k][0] += sample[0]
      sums[k][1] += sample[1]
      sums[k][2] += sample[2]
      weights[k] += 1
    }
    let moved = 0
    centroids = centroids.map((centroid, k) => {
      if (weights[k] === 0) return centroid
      const next: Lab = [sums[k][0] / weights[k], sums[k][1] / weights[k], sums[k][2] / weights[k]]
      moved = Math.max(moved, distance(next, centroid))
      return next
    })
    if (moved < 0.5) break
  }
  centroids = mergeClose(centroids, weights, options.mergeDistance)

  const modes = centroids.map(() => new Map<number, number>())
  const cluster = new Map<number, number>()
  for (const i of opaque) {
    const key = (rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2]
    let k = cluster.get(key)
    if (k === undefined) {
      k = nearest(centroids, labAt(rgba, i))
      cluster.set(key, k)
    }
    labels[i] = k
    modes[k].set(key, (modes[k].get(key) ?? 0) + 1)
  }

  // Drop colours nothing was assigned to, and renumber.
  const renumber = new Int16Array(centroids.length).fill(-1)
  const palette: Rgb[] = []
  modes.forEach((mode, k) => {
    if (mode.size === 0) return
    let best = 0
    let bestCount = -1
    for (const [key, n] of mode) {
      if (n > bestCount) {
        best = key
        bestCount = n
      }
    }
    renumber[k] = palette.length
    palette.push([(best >> 16) & 255, (best >> 8) & 255, best & 255])
  })
  for (let i = 0; i < count; i += 1) if (labels[i] >= 0) labels[i] = renumber[labels[i]]
  return { labels, palette }
}

/**
 * Reassigns 4-connected specks smaller than `minArea` to the colour they touch
 * most, or to paper if that is what surrounds them. Antialiasing and tiny
 * highlights would otherwise each become a fill.
 */
export function removeSpecks(labels: Int16Array, width: number, _height: number, minArea: number): void {
  const seen = new Uint8Array(labels.length)
  const stack: number[] = []
  const members: number[] = []
  for (let seed = 0; seed < labels.length; seed += 1) {
    if (seen[seed] || labels[seed] < 0) continue
    const label = labels[seed]
    members.length = 0
    stack.push(seed)
    seen[seed] = 1
    const touching = new Map<number, number>()
    while (stack.length > 0) {
      const i = stack.pop()!
      members.push(i)
      const x = i % width
      const around = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i >= width ? i - width : -1, i + width < labels.length ? i + width : -1]
      for (const j of around) {
        if (j < 0) {
          touching.set(-1, (touching.get(-1) ?? 0) + 1)
          continue
        }
        if (labels[j] === label) {
          if (!seen[j]) {
            seen[j] = 1
            stack.push(j)
          }
        } else {
          touching.set(labels[j], (touching.get(labels[j]) ?? 0) + 1)
        }
      }
    }
    if (members.length >= minArea) continue
    let target = -1
    let most = -1
    for (const [other, n] of touching) {
      if (n > most) {
        target = other
        most = n
      }
    }
    for (const i of members) labels[i] = target
  }
}

/**
 * Spreads colours into the pixels under drawn outlines, a ring at a time, so
 * a fill reaches the middle of its outline and no paper shows between the two.
 */
export function growIntoMask(labels: Int16Array, width: number, _height: number, mask: Mask, rings: number): void {
  let frontier: number[] = []
  for (let i = 0; i < labels.length; i += 1) if (mask.data[i] && labels[i] < 0) frontier.push(i)
  for (let ring = 0; ring < rings && frontier.length > 0; ring += 1) {
    const assigned: [number, number][] = []
    const waiting: number[] = []
    for (const i of frontier) {
      const x = i % width
      const around = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i >= width ? i - width : -1, i + width < labels.length ? i + width : -1]
      const votes = new Map<number, number>()
      for (const j of around) if (j >= 0 && labels[j] >= 0) votes.set(labels[j], (votes.get(labels[j]) ?? 0) + 1)
      if (votes.size === 0) {
        waiting.push(i)
        continue
      }
      let best = -1
      let most = -1
      for (const [label, n] of votes) {
        if (n > most) {
          best = label
          most = n
        }
      }
      assigned.push([i, best])
    }
    for (const [i, label] of assigned) labels[i] = label
    frontier = waiting
  }
}

export function hex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

export function rgbToLab(r: number, g: number, b: number): Lab {
  const linear = (channel: number) => {
    const c = channel / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const R = linear(r)
  const G = linear(g)
  const B = linear(b)
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047)
  const fy = f(0.2126 * R + 0.7152 * G + 0.0722 * B)
  const fz = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function labAt(rgba: ArrayLike<number>, i: number): Lab {
  return rgbToLab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2])
}

function distance(a: Lab, b: Lab): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

function nearest(centroids: Lab[], point: Lab): number {
  let best = 0
  let bestDistance = Infinity
  centroids.forEach((centroid, k) => {
    const d = (centroid[0] - point[0]) ** 2 + (centroid[1] - point[1]) ** 2 + (centroid[2] - point[2]) ** 2
    if (d < bestDistance) {
      best = k
      bestDistance = d
    }
  })
  return best
}

/** k-means++ seeding with a fixed pseudo-random sequence (mulberry32), for repeatable traces. */
function seed(samples: Lab[], k: number): Lab[] {
  let state = 0x2f6b1d
  const random = () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const centroids: Lab[] = [samples[Math.floor(random() * samples.length)]]
  const nearestSquared = samples.map((sample) => distance(sample, centroids[0]) ** 2)
  while (centroids.length < k) {
    const total = nearestSquared.reduce((sum, d) => sum + d, 0)
    if (total === 0) break
    let target = random() * total
    let pick = 0
    for (; pick < samples.length - 1; pick += 1) {
      target -= nearestSquared[pick]
      if (target <= 0) break
    }
    centroids.push(samples[pick])
    samples.forEach((sample, i) => {
      nearestSquared[i] = Math.min(nearestSquared[i], distance(sample, samples[pick]) ** 2)
    })
  }
  return centroids
}

function mergeClose(centroids: Lab[], weights: number[], limit: number): Lab[] {
  const points = centroids.map((centroid, k) => ({ centroid, weight: Math.max(weights[k], 1) }))
  let merged = true
  while (merged) {
    merged = false
    outer: for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        if (distance(points[i].centroid, points[j].centroid) >= limit) continue
        const a = points[i]
        const b = points[j]
        const total = a.weight + b.weight
        a.centroid = [
          (a.centroid[0] * a.weight + b.centroid[0] * b.weight) / total,
          (a.centroid[1] * a.weight + b.centroid[1] * b.weight) / total,
          (a.centroid[2] * a.weight + b.centroid[2] * b.weight) / total,
        ]
        a.weight = total
        points.splice(j, 1)
        merged = true
        break outer
      }
    }
  }
  return points.map((point) => point.centroid)
}
