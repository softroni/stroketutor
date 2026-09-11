import { slug } from './openrouter'

/**
 * Helpers for building a lesson from a model's plan when every shape is fixed:
 * the model names ids, the code places the shapes. Shared by SVG generation
 * and layer regeneration, so both correct a plan the same way and say so in
 * the same words.
 */

export const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
export const wasWere = (n: number) => (n === 1 ? 'was' : 'were')

/** Hands out each id's shape once: ids the model made up or repeated are skipped and counted. */
export function createPlacer() {
  const used = new Set<string>()
  let madeUp = 0
  let repeated = 0
  return {
    used,
    take<T>(ids: string[], byId: ReadonlyMap<string, T>): T[] {
      return ids.flatMap((id) => {
        const item = byId.get(id)
        if (item === undefined) {
          madeUp += 1
          return []
        }
        if (used.has(id)) {
          repeated += 1
          return []
        }
        used.add(id)
        return [item]
      })
    },
    notes(): string[] {
      const notes: string[] = []
      if (madeUp > 0) notes.push(`${count(madeUp, 'id', 'ids')} the model made up ${wasWere(madeUp)} ignored.`)
      if (repeated > 0) {
        notes.push(`${count(repeated, 'repeated id was', 'repeated ids were')} ignored; each line and colour is drawn once.`)
      }
      return notes
    },
  }
}

/** Safe, unique step ids: the model's own where it gave a usable one. */
export function createStepIds() {
  const taken = new Set<string>()
  return (preferred: string, fallback: string) => {
    const base = slug(preferred) || fallback
    let unique = base
    for (let n = 2; taken.has(unique); n += 1) unique = `${base}-${n}`
    taken.add(unique)
    return unique
  }
}
