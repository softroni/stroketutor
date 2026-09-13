import type { ScriptLine } from '../../voice/types'

/**
 * The audition script a fresh workspace starts with, as the server seeds it:
 * one source (`src/voice/suggestions.ts`), so "Reset to suggested" puts back
 * exactly what a new workspace contains.
 */
export { SUGGESTED_SCRIPT } from '../../voice/suggestions'

/** A short, unique id for a line the creator adds. */
export function newLineId(existing: readonly ScriptLine[]): string {
  const taken = new Set(existing.map((line) => line.id))
  for (let n = existing.length + 1; ; n += 1) {
    const id = `line-${n}`
    if (!taken.has(id)) return id
  }
}
