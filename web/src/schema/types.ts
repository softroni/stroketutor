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
}

export interface Step {
  id: string
  title: string
  instruction: string
  /** Reserved for a future version. Always `null` in v1 and ignored by players. */
  voiceover?: string | null
  strokes: Stroke[]
}

export interface Tutorial {
  schemaVersion: 1
  id: string
  title: string
  canvas: CanvasSpec
  style?: TutorialStyle
  steps: Step[]
}

/** The only `schemaVersion` this player understands. */
export const SUPPORTED_SCHEMA_VERSION = 1

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

/** Fills in the optional half of `style`. */
export function resolveStyle(style: TutorialStyle | undefined): ResolvedStyle {
  return {
    strokeColor: normalizeHex(style?.strokeColor) ?? DEFAULT_STYLE.strokeColor,
    backgroundColor: normalizeHex(style?.backgroundColor) ?? DEFAULT_STYLE.backgroundColor,
  }
}

/** Total seconds of animation at 1x, across every step. */
export function totalDuration(tutorial: Tutorial): number {
  return tutorial.steps.reduce(
    (sum, step) => sum + step.strokes.reduce((s, stroke) => s + stroke.duration, 0),
    0,
  )
}

/** Total number of strokes across every step. */
export function totalStrokes(tutorial: Tutorial): number {
  return tutorial.steps.reduce((sum, step) => sum + step.strokes.length, 0)
}
