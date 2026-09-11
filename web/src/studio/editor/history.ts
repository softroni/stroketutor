/**
 * Undo/redo over immutable values. Editing operations return new documents, so
 * history is just the documents themselves.
 */
export interface History<T> {
  past: T[]
  present: T
  future: T[]
  /**
   * The coalescing key of the last commit. Consecutive commits with the same
   * key (keystrokes in one text field) collapse into a single undo step.
   */
  lastKey: string | null
}

/** Enough to undo a long session; old entries fall off the front. */
export const HISTORY_LIMIT = 200

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastKey: null }
}

export function commit<T>(history: History<T>, next: T, key: string | null = null): History<T> {
  if (next === history.present) return history
  if (key !== null && key === history.lastKey) {
    return { ...history, present: next, future: [] }
  }
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
    lastKey: key,
  }
}

export function undo<T>(history: History<T>): History<T> {
  if (history.past.length === 0) return history
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
    lastKey: null,
  }
}

export function redo<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
    lastKey: null,
  }
}
