import { drawingImage } from '../../src/studio/drawingImage'
import { renderSvg, toBase64 } from '../../src/studio/referenceImage'
import { imageToSvg, type ImageToSvgOptions, type ImageToSvgResult } from '../../src/trace/imageToSvg'
import { buildOptimizedSvg, type OptimizeOptions, type OptimizeResult } from '../../src/svg/optimize'
import { collectShapesFromText, traceSvg, type TraceOptions, type TracedDrawing } from '../../src/trace/traceSvg'
import type { Tutorial } from '../../src/schema/types'

/**
 * The page the command line opens in headless Chromium (see `../browser.ts`).
 * It runs the Studio's own browser-side code, served by the same Vite the
 * command line loads its modules through, so `studio svg trace` is New
 * lesson's tracer to the byte. Each call answers with a plain result or the
 * error's message, so the command line can report it as its own.
 */

export type Answer<T> = { ok: true; value: T } | { ok: false; error: string }

export interface PageBridge {
  trace(text: string, options: TraceOptions): Promise<Answer<TracedDrawing>>
  renderPng(text: string, longestEdge: number): Promise<Answer<string>>
  drawingPng(tutorial: Tutorial): Promise<Answer<string>>
  optimize(text: string, options: OptimizeOptions): Promise<Answer<OptimizeResult>>
  fromImage(base64: string, contentType: string, size: number, options: ImageToSvgOptions): Promise<Answer<ImageToSvgResult>>
}

declare global {
  interface Window {
    studioBridge: PageBridge
  }
}

async function answer<T>(work: () => Promise<T> | T): Promise<Answer<T>> {
  try {
    return { ok: true, value: await work() }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** The picture's pixels, fitted inside a `size` × `size` sheet of white paper. */
async function pixelsOf(base64: string, contentType: string, size: number): Promise<ImageData> {
  const image = new Image()
  image.src = `data:${contentType};base64,${base64}`
  try {
    await image.decode()
  } catch {
    throw new Error('The browser could not read this picture.')
  }
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('The browser could not draw the picture.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, size, size)
  context.imageSmoothingQuality = 'high'
  const scale = size / Math.max(image.naturalWidth, image.naturalHeight)
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height)
  return context.getImageData(0, 0, size, size)
}

window.studioBridge = {
  trace: (text, options) => answer(() => traceSvg(text, options)),
  renderPng: (text, longestEdge) => answer(async () => toBase64(await renderSvg(text, longestEdge))),
  drawingPng: (tutorial) => answer(async () => (await drawingImage(tutorial)).base64),
  fromImage: (base64, contentType, size, options) => answer(async () => imageToSvg((await pixelsOf(base64, contentType, size)).data, size, size, options)),
  optimize: (text, options) => answer(() => buildOptimizedSvg(collectShapesFromText(text, { size: options.size }), options)),
}
