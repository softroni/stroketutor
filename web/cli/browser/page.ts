import { drawingImage } from '../../src/studio/drawingImage'
import { renderSvg, toBase64 } from '../../src/studio/referenceImage'
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

window.studioBridge = {
  trace: (text, options) => answer(() => traceSvg(text, options)),
  renderPng: (text, longestEdge) => answer(async () => toBase64(await renderSvg(text, longestEdge))),
  drawingPng: (tutorial) => answer(async () => (await drawingImage(tutorial)).base64),
  optimize: (text, options) => answer(() => buildOptimizedSvg(collectShapesFromText(text, { size: options.size }), options)),
}
