import type { Analysis } from '../catalog/types'
import type { Tutorial } from '../schema/types'

/**
 * A lesson's history (M5, master plan §24: "retain good prior versions instead
 * of overwriting blindly"): every version the lesson has had, kept beside it in
 * `shared/History/<lesson>/`, one file per version, never in its place.
 * Studio-only: the iOS target bundles `shared/Tutorials` alone, so the app
 * never sees these files.
 */
export const HISTORY_VERSION = 1

export const HISTORY_LAYERS = ['drawing', 'order', 'steps', 'instructions'] as const

/**
 * - `generated`: a candidate from New lesson, kept or not;
 * - `regenerated`: a layer regeneration, used or not;
 * - `saved`: the lesson as written to `shared/Tutorials` by a save.
 */
export type HistoryKind = 'generated' | 'regenerated' | 'saved'

/** One version and how it came about. The Studio sends this; the server adds the id and time. */
export interface HistoryRecord {
  kind: HistoryKind
  layer?: (typeof HISTORY_LAYERS)[number]
  model?: string
  promptVersion?: string
  goal?: string
  constraints?: string
  /** What the creator asked to be different. */
  note?: string
  /** The model's own account of what it changed. */
  rationale?: string
  /** What the Studio corrected in the model's answer. */
  notes?: string[]
  analysis?: Analysis
  /** US dollars, as OpenRouter reported it. */
  cost?: number
  /** A generated candidate that became the lesson. */
  kept?: boolean
  tutorial: Tutorial
}

export interface HistoryEntry extends HistoryRecord {
  historyVersion: typeof HISTORY_VERSION
  /** Also the file name; sorts by time. */
  id: string
  lessonId: string
  /** ISO 8601, assigned by the server. */
  createdAt: string
  /** The lesson as it was before its first recorded change. */
  baseline?: boolean
}

/** A short name for a version, for lists and headings. */
export function describeEntry(entry: HistoryEntry): string {
  switch (entry.kind) {
    case 'regenerated':
      return entry.layer ? `Regenerated ${entry.layer}` : 'Regenerated'
    case 'generated':
      return entry.kept ? 'Generated, kept' : 'Generated, not kept'
    case 'saved':
      return entry.baseline ? 'Saved, before any recorded change' : 'Saved'
  }
}
