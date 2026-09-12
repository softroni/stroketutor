import type { EditableTutorial } from '../src/studio/editor/ops'

import { UsageError } from './args'
import { CliError } from './output'

/**
 * How the command line names steps and strokes.
 *
 * A step is its number as `steps list` shows it (1-based), or its id. A
 * stroke selector is `<step>.<strokes>`, where the strokes part is a number,
 * a range, `*` for all of them, or a comma-separated list of those:
 * `2.1`, `2.1-3`, `walls.*`, `2.1,2.4-5`. Several selectors may be given.
 * Selectors resolve to the editor's stroke uids, so the editor's own
 * operations apply unchanged.
 */

export function resolveStep(doc: EditableTutorial, ref: string): number {
  if (/^\d+$/.test(ref)) {
    const index = Number(ref) - 1
    if (index < 0 || index >= doc.steps.length) throw new CliError(`There is no step ${ref}; the lesson has ${doc.steps.length}.`)
    return index
  }
  const index = doc.steps.findIndex((step) => step.id === ref)
  if (index < 0) throw new CliError(`There is no step "${ref}". Steps are named by number or id; see studio steps list.`)
  return index
}

/** The uids the selectors name, in drawing order, each once. */
export function resolveStrokes(doc: EditableTutorial, selectors: string[]): string[] {
  const chosen = new Set<string>()
  for (const selector of selectors) {
    for (const part of selector.split(',')) {
      const match = part.trim().match(/^([a-zA-Z0-9-]+)\.(\*|\d+(?:-\d+)?)$/)
      if (!match) throw new UsageError(`"${part}" is not a stroke selector; use <step>.<n>, <step>.<a>-<b> or <step>.*.`)
      const stepIndex = resolveStep(doc, match[1])
      const strokes = doc.steps[stepIndex].strokes
      const [from, to] = range(match[2], strokes.length, match[1])
      for (let k = from; k <= to; k += 1) chosen.add(strokes[k - 1].uid)
    }
  }
  if (chosen.size === 0) throw new UsageError('Name at least one stroke, such as 2.1 or walls.*.')
  return doc.steps.flatMap((step) => step.strokes.filter((stroke) => chosen.has(stroke.uid)).map((stroke) => stroke.uid))
}

function range(part: string, count: number, step: string): [number, number] {
  if (part === '*') {
    if (count === 0) throw new CliError(`Step ${step} has no strokes.`)
    return [1, count]
  }
  const [a, b = a] = part.split('-').map(Number)
  if (a < 1 || b < a || b > count) {
    throw new CliError(`Step ${step} has ${count} ${count === 1 ? 'stroke' : 'strokes'}; "${part}" is out of range.`)
  }
  return [a, b]
}

/** `2.3`: the selector of a stroke, for lists. */
export function selectorOf(stepIndex: number, strokeIndex: number): string {
  return `${stepIndex + 1}.${strokeIndex + 1}`
}
