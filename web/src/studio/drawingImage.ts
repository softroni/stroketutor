import { cssColor, resolveStyle, type Tutorial } from '../schema/types'

import { renderSvg, toBase64 } from './referenceImage'

/** Longest edge of the picture of a lesson sent with a layer regeneration. */
const DRAWING_EDGE = 1024

/**
 * The finished drawing as a standalone SVG: fills beneath strokes, as the
 * player paints them. Only validated tutorials come here, so every `d` is
 * plain path data and every colour a hex value; neither can break out of an
 * attribute.
 */
export function drawingSvg(tutorial: Tutorial): string {
  const style = resolveStyle(tutorial.style)
  const { width, height } = tutorial.canvas
  const fills = tutorial.steps
    .flatMap((step) => step.fills ?? [])
    .map((fill) => `<path d="${fill.d}" fill="${cssColor(fill.color)}" fill-rule="${fill.fillRule ?? 'nonzero'}"/>`)
  const strokes = tutorial.steps
    .flatMap((step) => step.strokes)
    .map(
      (stroke) =>
        `<path d="${stroke.d}" fill="none" stroke="${cssColor(stroke.color ?? style.strokeColor)}" stroke-width="${stroke.lineWidth}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    `<rect width="${width}" height="${height}" fill="${style.backgroundColor}"/>`,
    ...fills,
    ...strokes,
    '</svg>',
  ].join('')
}

/** A PNG of the finished drawing, so the model can see what the numbered lines make. */
export async function drawingImage(tutorial: Tutorial): Promise<{ contentType: string; base64: string }> {
  const png = await renderSvg(drawingSvg(tutorial), DRAWING_EDGE)
  return { contentType: 'image/png', base64: await toBase64(png) }
}
