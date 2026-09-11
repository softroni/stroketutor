/** A one-bit image: 1 for ink, 0 for paper. Row-major, `width * height` long. */
export interface Mask {
  width: number
  height: number
  data: Uint8Array
}

export function createMask(width: number, height: number): Mask {
  return { width, height, data: new Uint8Array(width * height) }
}

/**
 * Zhang–Suen thinning: peels a mask down to one-pixel-wide centre lines while
 * keeping every part connected. T. Y. Zhang and C. Y. Suen, "A fast parallel
 * algorithm for thinning digital patterns", Communications of the ACM 27(3),
 * 1984. Only pixels still on are revisited, so the cost follows the amount of
 * ink rather than the size of the canvas.
 */
export function thin(mask: Mask): Mask {
  const { width: w, height: h } = mask
  const img = mask.data.slice()
  // Border pixels lack a full neighbourhood; clearing them keeps indexing in range.
  for (let x = 0; x < w; x += 1) {
    img[x] = 0
    img[(h - 1) * w + x] = 0
  }
  for (let y = 0; y < h; y += 1) {
    img[y * w] = 0
    img[y * w + w - 1] = 0
  }

  let candidates: number[] = []
  for (let i = 0; i < img.length; i += 1) if (img[i]) candidates.push(i)
  const remove: number[] = []
  let changed = true
  while (changed) {
    changed = false
    for (let pass = 0; pass < 2; pass += 1) {
      remove.length = 0
      for (const i of candidates) {
        if (!img[i]) continue
        const p2 = img[i - w]
        const p3 = img[i - w + 1]
        const p4 = img[i + 1]
        const p5 = img[i + w + 1]
        const p6 = img[i + w]
        const p7 = img[i + w - 1]
        const p8 = img[i - 1]
        const p9 = img[i - w - 1]
        const neighbours = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
        if (neighbours < 2 || neighbours > 6) continue
        const transitions =
          (!p2 && p3 ? 1 : 0) +
          (!p3 && p4 ? 1 : 0) +
          (!p4 && p5 ? 1 : 0) +
          (!p5 && p6 ? 1 : 0) +
          (!p6 && p7 ? 1 : 0) +
          (!p7 && p8 ? 1 : 0) +
          (!p8 && p9 ? 1 : 0) +
          (!p9 && p2 ? 1 : 0)
        if (transitions !== 1) continue
        const keep = pass === 0 ? (p2 && p4 && p6) || (p4 && p6 && p8) : (p2 && p4 && p8) || (p2 && p6 && p8)
        if (keep) continue
        remove.push(i)
      }
      for (const i of remove) img[i] = 0
      if (remove.length > 0) changed = true
    }
    candidates = candidates.filter((i) => img[i])
  }
  return { width: w, height: h, data: img }
}

/**
 * For every ink pixel, the distance to the nearest paper pixel, in pixels
 * (3-4 chamfer, within a few percent of Euclidean). A pixel on the edge of the
 * ink is 1, so a band `n` pixels thick peaks at about `(n + 1) / 2`.
 */
export function distanceToPaper(mask: Mask): Float32Array {
  const { width: w, height: h, data } = mask
  const far = 1e9
  const dist = new Float32Array(w * h)
  for (let i = 0; i < dist.length; i += 1) dist[i] = data[i] ? far : 0

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x
      if (!dist[i]) continue
      let d = dist[i]
      d = Math.min(d, x > 0 ? dist[i - 1] + 3 : 3)
      if (y > 0) {
        d = Math.min(d, dist[i - w] + 3)
        if (x > 0) d = Math.min(d, dist[i - w - 1] + 4)
        if (x < w - 1) d = Math.min(d, dist[i - w + 1] + 4)
      } else {
        d = Math.min(d, 3)
      }
      dist[i] = d
    }
  }
  for (let y = h - 1; y >= 0; y -= 1) {
    for (let x = w - 1; x >= 0; x -= 1) {
      const i = y * w + x
      if (!dist[i]) continue
      let d = dist[i]
      d = Math.min(d, x < w - 1 ? dist[i + 1] + 3 : 3)
      if (y < h - 1) {
        d = Math.min(d, dist[i + w] + 3)
        if (x < w - 1) d = Math.min(d, dist[i + w + 1] + 4)
        if (x > 0) d = Math.min(d, dist[i + w - 1] + 4)
      } else {
        d = Math.min(d, 3)
      }
      dist[i] = d
    }
  }
  for (let i = 0; i < dist.length; i += 1) dist[i] /= 3
  return dist
}

/** 8-connected parts of the ink: a label per pixel (-1 for paper) and each part's size. */
export function components(mask: Mask): { labels: Int32Array; sizes: number[] } {
  const { width: w, height: h, data } = mask
  const labels = new Int32Array(w * h).fill(-1)
  const sizes: number[] = []
  const stack = new Int32Array(w * h)
  for (let seed = 0; seed < data.length; seed += 1) {
    if (!data[seed] || labels[seed] >= 0) continue
    const label = sizes.length
    let top = 0
    stack[top++] = seed
    labels[seed] = label
    let size = 0
    while (top > 0) {
      const i = stack[--top]
      size += 1
      const x = i % w
      const y = (i - x) / w
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const j = ny * w + nx
          if (data[j] && labels[j] < 0) {
            labels[j] = label
            stack[top++] = j
          }
        }
      }
    }
    sizes.push(size)
  }
  return { labels, sizes }
}
