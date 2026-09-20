import type { ImageToSvgOptions, ImageToSvgResult } from '../src/trace/imageToSvg'
import type { TraceOptions, TracedDrawing } from '../src/trace/traceSvg'
import type { Tutorial } from '../src/schema/types'

/**
 * What the command line asks a browser for: the pieces of the Studio that
 * need a real rendering engine (an SVG's CSS, transforms and pixels). The
 * implementation in `browser.ts` runs the Studio's own code in headless
 * Chromium; tests substitute a fake.
 */
export interface BrowserBridge {
  /** `src/trace/traceSvg.ts`, as New lesson runs it. */
  trace(svgText: string, options?: TraceOptions): Promise<TracedDrawing>
  /** A PNG of an SVG on white paper, `longestEdge` pixels on its longer side, as base64. */
  renderPng(svgText: string, longestEdge: number): Promise<string>
  /** A PNG of a lesson's finished drawing, as sent with a layer regeneration. */
  drawingPng(tutorial: Tutorial): Promise<string>
  /** `svg optimize`: the file's shapes as the tracer sees them, rewritten as a clean SVG. */
  optimize(svgText: string, options: OptimizeOptions): Promise<OptimizeResult>
  /** `svg from-image`: a flat-colour PNG, JPEG or WebP as an SVG of plain filled shapes, on a `size` × `size` canvas. */
  fromImage(base64: string, contentType: string, size: number, options: ImageToSvgOptions): Promise<ImageToSvgResult>
  close(): Promise<void>
}

export interface OptimizeOptions {
  /** The canvas the drawing is fitted into; the lesson's 1000 by default. */
  size?: number
  /** Decimal places kept in coordinates. */
  decimals?: number
  /** Simplify paths within this many canvas units, and smooth them; omit to keep every point. */
  simplify?: number
  /** With `simplify`: shapes whose box is smaller than this, in canvas units, are specks and are dropped. */
  minSize?: number
}

export interface OptimizeResult {
  svg: string
  kept: number
  dropped: number
  notes: string[]
}
