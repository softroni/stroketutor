/** The formats a reference image may be kept in (same list as the server's `REFERENCE_TYPES`). */
export const REFERENCE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
export const REFERENCE_TYPES_LABEL = 'JPEG, PNG, WebP or SVG'

/** Longest edge of the PNG an SVG is rendered to for the model. */
const MODEL_EDGE = 1536

/**
 * The image the model is sent. OpenRouter takes PNG, JPEG, WebP and GIF but
 * not SVG (https://openrouter.ai/docs/guides/overview/multimodal/image-understanding),
 * so an SVG is rendered to a PNG on white paper here. The SVG itself is still
 * what is kept as the lesson's reference.
 */
export async function imageForModel(file: Blob): Promise<{ contentType: string; base64: string }> {
  if (file.type !== 'image/svg+xml') return { contentType: file.type, base64: await toBase64(file) }
  const png = await renderSvg(await file.text(), MODEL_EDGE)
  return { contentType: 'image/png', base64: await toBase64(png) }
}

export async function renderSvg(text: string, longestEdge: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.src = url
    try {
      await image.decode()
    } catch {
      throw new Error('The browser could not draw this SVG, so it cannot be sent to the model.')
    }
    const [width, height] = svgAspect(text) ?? [image.naturalWidth || 1, image.naturalHeight || 1]
    const scale = longestEdge / Math.max(width, height)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('The browser could not render the SVG.')
    // SVGs are usually transparent; a model reads transparency unpredictably.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The SVG could not be rendered.'))), 'image/png'),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Width and height from the root element's `viewBox`, else its `width` and
 * `height`. An SVG with only a viewBox has no natural size of its own, and
 * browsers disagree about what to report for it.
 */
export function svgAspect(text: string): [number, number] | null {
  const root = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement
  if (root.nodeName !== 'svg') return null
  const box = (root.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number)
  if (box.length === 4 && box[2] > 0 && box[3] > 0) return [box[2], box[3]]
  const width = parseFloat(root.getAttribute('width') ?? '')
  const height = parseFloat(root.getAttribute('height') ?? '')
  return width > 0 && height > 0 ? [width, height] : null
}

export async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}
