/**
 * TypeScript mirror of `tutorial.schema.json`.
 *
 * The schema is the source of truth — it is what actually validates input, and
 * it is what the iOS player's decoder is kept in step with. These types exist so
 * the rest of the app can talk about a *validated* document. Change one, change
 * the other; `validate.ts` is the only place allowed to mint a `Tutorial`.
 */

/** The coordinate space every stroke coordinate and line width lives in. */
export interface CanvasSpec {
  width: number
  height: number
}

/** Optional palette. Missing fields fall back to {@link DEFAULT_STYLE}. */
export interface TutorialStyle {
  strokeColor?: string
  backgroundColor?: string
}

/** A palette with nothing left to resolve. */
export interface ResolvedStyle {
  strokeColor: string
  backgroundColor: string
}

export interface Stroke {
  /** SVG path data, absolute `M`/`L`/`C`/`Q`/`Z` only. */
  d: string
  /** Seconds to draw this stroke at 1x speed. */
  duration: number
  /** Stroke width in canvas units. */
  lineWidth: number
  /** v2: this stroke's colour, instead of `style.strokeColor`. */
  color?: string
}

/** v2: a shape painted in one colour, beneath every stroke of the lesson. */
export interface Fill {
  /** Absolute `M`/`L`/`C`/`Q`/`Z` path data. Several subpaths may form one shape, holes included. */
  d: string
  color: string
  /** Seconds to paint this fill at 1x speed. */
  duration: number
  /** As in SVG; `nonzero` when absent. */
  fillRule?: 'nonzero' | 'evenodd'
}

export interface Step {
  id: string
  title: string
  instruction: string
  /** Reserved for a future version. Ignored by players. */
  voiceover?: string | null
  /** Drawn in order. Empty only in a v2 step that fills. */
  strokes: Stroke[]
  /** v2: painted after the strokes, in order. */
  fills?: Fill[]
}

export type SchemaVersion = 1 | 2

export interface Tutorial {
  schemaVersion: SchemaVersion
  id: string
  title: string
  canvas: CanvasSpec
  style?: TutorialStyle
  steps: Step[]
}

/** The `schemaVersion`s this player understands. iOS understands 1 only, until M7. */
export const SUPPORTED_SCHEMA_VERSIONS: readonly SchemaVersion[] = [1, 2]

export const DEFAULT_STYLE: ResolvedStyle = {
  strokeColor: '#2B2B2B',
  backgroundColor: '#FAF7F0',
}

/**
 * Normalises a hex colour the way iOS `Color(hex:)` does — it accepts the
 * string with or without the leading `#`, so the web player has to add one
 * back before handing it to SVG, which does not.
 */
function normalizeHex(hex: string | undefined): string | undefined {
  if (hex === undefined) return undefined
  const trimmed = hex.trim()
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}

/** A document colour as SVG needs it: always with its leading `#`. */
export function cssColor(hex: string): string {
  return normalizeHex(hex) ?? hex
}

/** Fills in the optional half of `style`. */
export function resolveStyle(style: TutorialStyle | undefined): ResolvedStyle {
  return {
    strokeColor: normalizeHex(style?.strokeColor) ?? DEFAULT_STYLE.strokeColor,
    backgroundColor: normalizeHex(style?.backgroundColor) ?? DEFAULT_STYLE.backgroundColor,
  }
}

/** Seconds of animation at 1x for one step: its strokes, then its fills. */
export function stepDuration(step: Step): number {
  const strokes = step.strokes.reduce((sum, stroke) => sum + stroke.duration, 0)
  return strokes + (step.fills ?? []).reduce((sum, fill) => sum + fill.duration, 0)
}

/** Total seconds of animation at 1x, across every step. */
export function totalDuration(tutorial: Tutorial): number {
  return tutorial.steps.reduce((sum, step) => sum + stepDuration(step), 0)
}

/** Total number of fills across every step (v2). */
export function totalFills(tutorial: Tutorial): number {
  return tutorial.steps.reduce((sum, step) => sum + (step.fills?.length ?? 0), 0)
}

/** Total number of strokes across every step. */
export function totalStrokes(tutorial: Tutorial): number {
  return tutorial.steps.reduce((sum, step) => sum + step.strokes.length, 0)
}
