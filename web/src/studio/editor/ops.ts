import type { Step, Stroke, Tutorial } from '../../schema/types'
import { formatPath, parsePath, type PathSegment, type Point } from '../../player/svgPath'
import { moveItem } from '../moveItem'

import { splitPath } from './splitPath'

/**
 * Editing operations for the Lesson Workspace (master plan §18).
 *
 * The creator guides generated lessons rather than redrawing them, so every
 * operation rearranges or retimes existing strokes; none creates or reshapes a
 * path (`splitStroke` cuts one into parts that follow it exactly). Each returns a new document and leaves its input untouched, which is
 * what makes undo a matter of keeping the previous value.
 *
 * Invariants every operation keeps, checked by `ops.test.ts`:
 * - every stroke appears exactly once, except after an explicit delete, split or join;
 * - no step is left with nothing to draw (one with no strokes and no fills is removed);
 * - v2 fills stay with their step, after its strokes.
 * - step ids stay unique.
 */

export interface EditableStroke extends Stroke {
  /** Editor-only identity, so a selection survives reordering. Stripped by `toTutorial`. */
  uid: string
}

export interface EditableStep extends Omit<Step, 'strokes'> {
  strokes: EditableStroke[]
}

export interface EditableTutorial extends Omit<Tutorial, 'steps'> {
  steps: EditableStep[]
}

/** An operation that cannot be applied, with a sentence the creator can act on. */
export class EditError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EditError'
  }
}

export const NEW_STEP_TITLE = 'New step'
export const NEW_STEP_INSTRUCTION = 'Describe what to draw in this step.'

export function toEditable(tutorial: Tutorial): EditableTutorial {
  let counter = 0
  return {
    ...tutorial,
    steps: tutorial.steps.map((step) => ({
      ...step,
      strokes: step.strokes.map((stroke) => {
        counter += 1
        return { ...stroke, uid: `k${counter}` }
      }),
    })),
  }
}

/**
 * Back to a plain document. Built field by field, in the order the golden files
 * use, so nothing editor-only can leak into a saved file and a save of an
 * unchanged lesson is byte-identical. v2 fields appear only when present.
 */
export function toTutorial(doc: EditableTutorial): Tutorial {
  const { steps, ...meta } = doc
  return {
    ...meta,
    steps: steps.map((step) => ({
      id: step.id,
      title: step.title,
      instruction: step.instruction,
      ...(step.voiceover !== undefined ? { voiceover: step.voiceover } : {}),
      strokes: step.strokes.map((stroke) => ({
        d: stroke.d,
        duration: stroke.duration,
        lineWidth: stroke.lineWidth,
        ...(stroke.color !== undefined ? { color: stroke.color } : {}),
      })),
      ...(step.fills && step.fills.length > 0
        ? {
            fills: step.fills.map((fill) => ({
              d: fill.d,
              color: fill.color,
              duration: fill.duration,
              ...(fill.fillRule !== undefined ? { fillRule: fill.fillRule } : {}),
            })),
          }
        : {}),
    })),
  }
}

export function strokeUids(doc: EditableTutorial): string[] {
  return doc.steps.flatMap((step) => step.strokes.map((stroke) => stroke.uid))
}

/** Where a stroke currently is. */
export function locateStroke(
  doc: EditableTutorial,
  uid: string,
): { stepIndex: number; strokeIndex: number } | null {
  for (let stepIndex = 0; stepIndex < doc.steps.length; stepIndex += 1) {
    const strokeIndex = doc.steps[stepIndex].strokes.findIndex((stroke) => stroke.uid === uid)
    if (strokeIndex >= 0) return { stepIndex, strokeIndex }
  }
  return null
}

export function reorderSteps(doc: EditableTutorial, from: number, to: number): EditableTutorial {
  return { ...doc, steps: moveItem(doc.steps, from, to) }
}

export function reorderStrokes(
  doc: EditableTutorial,
  stepIndex: number,
  from: number,
  to: number,
): EditableTutorial {
  const step = stepAt(doc, stepIndex)
  return replaceStep(doc, stepIndex, { ...step, strokes: moveItem(step.strokes, from, to) })
}

/**
 * Moves the selected strokes to the end of another step, in drawing order.
 * Steps left empty are removed.
 */
export function moveStrokes(
  doc: EditableTutorial,
  uids: Iterable<string>,
  targetStepId: string,
): EditableTutorial {
  const selection = new Set(uids)
  const moving = pick(doc, selection)
  if (!doc.steps.some((step) => step.id === targetStepId)) {
    throw new EditError(`There is no step "${targetStepId}" to move strokes into.`)
  }

  const steps = doc.steps.map((step) => {
    const kept = step.strokes.filter((stroke) => !selection.has(stroke.uid))
    return { ...step, strokes: step.id === targetStepId ? [...kept, ...moving] : kept }
  })
  return { ...doc, steps: withoutEmptySteps(steps) }
}

/**
 * Turns the selected strokes into one new teaching step, e.g. two windows that
 * were generated as separate steps becoming "Add the windows".
 *
 * The new step takes the place of the first step it draws from. If that step
 * keeps other strokes, the new one follows it instead, so nothing that was
 * drawn before the selection is drawn after it.
 */
export function groupIntoNewStep(
  doc: EditableTutorial,
  uids: Iterable<string>,
  fields: { title?: string; instruction?: string } = {},
): EditableTutorial {
  const selection = new Set(uids)
  const grouped = pick(doc, selection)

  const firstIndex = doc.steps.findIndex((step) =>
    step.strokes.some((stroke) => selection.has(stroke.uid)),
  )
  const firstKeepsStrokes = doc.steps[firstIndex].strokes.some(
    (stroke) => !selection.has(stroke.uid),
  )

  const steps = doc.steps.map((step) => ({
    ...step,
    strokes: step.strokes.filter((stroke) => !selection.has(stroke.uid)),
  }))
  steps.splice(firstKeepsStrokes ? firstIndex + 1 : firstIndex, 0, {
    id: uniqueStepId(doc, 'new-step'),
    title: fields.title ?? NEW_STEP_TITLE,
    instruction: fields.instruction ?? NEW_STEP_INSTRUCTION,
    voiceover: null,
    strokes: grouped,
  })
  return { ...doc, steps: withoutEmptySteps(steps) }
}

/**
 * Splits a step before the stroke at `atStrokeIndex`. The second half becomes a
 * new step right after it, carrying the same instruction until it is edited.
 */
export function splitStep(
  doc: EditableTutorial,
  stepIndex: number,
  atStrokeIndex: number,
): EditableTutorial {
  const step = stepAt(doc, stepIndex)
  if (atStrokeIndex <= 0 || atStrokeIndex >= step.strokes.length) {
    throw new EditError(
      step.strokes.length < 2
        ? `"${step.title}" has only one stroke, so there is nothing to split.`
        : 'Split before a stroke after the first one.',
    )
  }

  // Fills come after a step's strokes, so they go with the second half.
  const { fills, ...first } = step
  const steps = [...doc.steps]
  steps.splice(
    stepIndex,
    1,
    { ...first, strokes: step.strokes.slice(0, atStrokeIndex) },
    {
      id: uniqueStepId(doc, step.id),
      title: `${step.title} (continued)`,
      instruction: step.instruction,
      voiceover: step.voiceover ?? null,
      strokes: step.strokes.slice(atStrokeIndex),
      ...(fills ? { fills } : {}),
    },
  )
  return { ...doc, steps }
}

/** Folds the next step's strokes and fills into this one, keeping this step's words. */
export function mergeWithNext(doc: EditableTutorial, stepIndex: number): EditableTutorial {
  const step = stepAt(doc, stepIndex)
  const next = doc.steps[stepIndex + 1]
  if (!next) throw new EditError(`"${step.title}" is the last step; there is nothing to merge into it.`)

  const fills = [...(step.fills ?? []), ...(next.fills ?? [])]
  const steps = [...doc.steps]
  steps.splice(stepIndex, 2, {
    ...step,
    strokes: [...step.strokes, ...next.strokes],
    ...(fills.length > 0 ? { fills } : {}),
  })
  return { ...doc, steps }
}

/** Removes strokes for good, and any step they leave empty. */
export function deleteStrokes(doc: EditableTutorial, uids: Iterable<string>): EditableTutorial {
  const selection = new Set(uids)
  pick(doc, selection)
  const steps = withoutEmptySteps(
    doc.steps.map((step) => ({
      ...step,
      strokes: step.strokes.filter((stroke) => !selection.has(stroke.uid)),
    })),
  )
  if (steps.length === 0) throw new EditError('A lesson needs at least one stroke.')
  return { ...doc, steps }
}

export function updateStep(
  doc: EditableTutorial,
  stepIndex: number,
  patch: Partial<Pick<Step, 'title' | 'instruction'>>,
): EditableTutorial {
  return replaceStep(doc, stepIndex, { ...stepAt(doc, stepIndex), ...patch })
}

/**
 * One stroke becomes several, cut at the points on it nearest to `cuts` (see
 * `splitPath`). The parts stay where the stroke was, in its step, and share
 * its animation time by their length.
 */
export function splitStroke(doc: EditableTutorial, uid: string, cuts: Point[], lengthOf: (d: string) => number): EditableTutorial {
  pick(doc, new Set([uid]))
  return {
    ...doc,
    steps: doc.steps.map((step) => ({
      ...step,
      strokes: step.strokes.flatMap((stroke) => {
        if (stroke.uid !== uid) return [stroke]
        let parts: string[]
        try {
          parts = splitPath(stroke.d, cuts)
        } catch (error) {
          throw new EditError(error instanceof Error ? error.message : String(error))
        }
        const lengths = parts.map(lengthOf)
        const whole = lengths.reduce((sum, length) => sum + length, 0) || 1
        return parts.map((d, index) => ({
          ...stroke,
          d,
          duration: Math.max(0.2, Number(((stroke.duration * lengths[index]) / whole).toFixed(2))),
          uid: `${stroke.uid}-${index + 1}`,
        }))
      }),
    })),
  }
}

/**
 * Two strokes become one, drawn without lifting: the second carries on from
 * the end of the first (a short straight line bridges any gap between them).
 * The joined stroke takes the first one's place and both animation times.
 */
export function joinStrokes(doc: EditableTutorial, firstUid: string, secondUid: string): EditableTutorial {
  const [first, second] = [firstUid, secondUid].map((uid) => pick(doc, new Set([uid]))[0])
  if (firstUid === secondUid) throw new EditError('Join two different strokes.')
  const tail = parsePath(second.d)
  if (tail.filter((segment) => segment.kind === 'move').length !== 1 || /z\s*$/i.test(first.d) || /z\s*$/i.test(second.d)) {
    throw new EditError('Only open lines, each drawn in one go, can be joined.')
  }
  const head = parsePath(first.d)
  const last = head[head.length - 1]
  const end = last.kind === 'move' || last.kind === 'line' ? last.to : last.kind === 'close' ? null : last.end
  const start = (tail[0] as Extract<PathSegment, { kind: 'move' }>).to
  const bridge: PathSegment[] = end && Math.hypot(end.x - start.x, end.y - start.y) > 0.5 ? [{ kind: 'line', to: start }] : []
  const joined: EditableStroke = { ...first, d: formatPath([...head, ...bridge, ...tail.slice(1)]), duration: Number((first.duration + second.duration).toFixed(2)) }
  return {
    ...doc,
    steps: doc.steps
      .map((step) => ({ ...step, strokes: step.strokes.flatMap((stroke) => (stroke.uid === secondUid ? [] : stroke.uid === firstUid ? [joined] : [stroke])) }))
      .filter((step) => step.strokes.length > 0 || (step.fills?.length ?? 0) > 0),
  }
}

/** Applies the same timing or width to every selected stroke. */
export function updateStrokes(
  doc: EditableTutorial,
  uids: Iterable<string>,
  patch: Partial<Pick<Stroke, 'duration' | 'lineWidth'>>,
): EditableTutorial {
  const selection = new Set(uids)
  pick(doc, selection)
  return {
    ...doc,
    steps: doc.steps.map((step) => ({
      ...step,
      strokes: step.strokes.map((stroke) =>
        selection.has(stroke.uid) ? { ...stroke, ...patch } : stroke,
      ),
    })),
  }
}

/** The selected strokes, in drawing order. Throws if the selection is empty or stale. */
function pick(doc: EditableTutorial, selection: ReadonlySet<string>): EditableStroke[] {
  if (selection.size === 0) throw new EditError('Select at least one stroke first.')
  const found = doc.steps.flatMap((step) => step.strokes.filter((stroke) => selection.has(stroke.uid)))
  if (found.length !== selection.size) {
    throw new EditError('Part of the selection is no longer in this lesson.')
  }
  return found
}

function stepAt(doc: EditableTutorial, stepIndex: number): EditableStep {
  const step = doc.steps[stepIndex]
  if (!step) throw new EditError(`There is no step ${stepIndex + 1}.`)
  return step
}

function replaceStep(doc: EditableTutorial, stepIndex: number, step: EditableStep): EditableTutorial {
  const steps = [...doc.steps]
  steps[stepIndex] = step
  return { ...doc, steps }
}

function withoutEmptySteps(steps: EditableStep[]): EditableStep[] {
  return steps.filter((step) => step.strokes.length > 0 || (step.fills?.length ?? 0) > 0)
}

/** `base`, or `base-2`, `base-3`… whichever is not taken yet. */
function uniqueStepId(doc: EditableTutorial, base: string): string {
  const taken = new Set(doc.steps.map((step) => step.id))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}
