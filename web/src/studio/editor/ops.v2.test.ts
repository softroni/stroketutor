import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { Tutorial } from '../../schema/types'
import { parseTutorialJSON, validateTutorial } from '../../schema/validate'

import {
  deleteStrokes,
  mergeWithNext,
  moveStrokes,
  splitStep,
  strokeUids,
  toEditable,
  toTutorial,
  type EditableTutorial,
} from './ops'

const casesDir = fileURLToPath(new URL('../../../../shared/conformance/cases/', import.meta.url))

/** The conformance corpus's v2 document: an outline step, then a step that only fills. */
function coloured(): Tutorial {
  const result = parseTutorialJSON(readFileSync(`${casesDir}valid-v2-fills.json`, 'utf8'))
  if (!result.ok) throw new Error('valid-v2-fills.json is invalid')
  return result.tutorial
}

function expectValid(doc: EditableTutorial) {
  const result = validateTutorial(toTutorial(doc))
  expect(result.ok, result.ok ? '' : JSON.stringify(result.issues)).toBe(true)
}

describe('editing a v2 lesson', () => {
  it('round-trips stroke colours and fills exactly', () => {
    const original = coloured()
    expect(JSON.stringify(toTutorial(toEditable(original)))).toBe(JSON.stringify(original))
  })

  it('keeps a step that only fills when the strokes around it move', () => {
    const doc = toEditable(coloured())
    const [outline] = strokeUids(doc)
    const moved = moveStrokes(doc, [outline], 'colour')
    // The outline step empties and goes; the colour step keeps its fills and gains the stroke.
    expect(moved.steps.map((step) => step.id)).toEqual(['colour'])
    expect(moved.steps[0].strokes.map((stroke) => stroke.uid)).toEqual([outline])
    expect(moved.steps[0].fills).toHaveLength(2)
    expectValid(moved)
  })

  it('keeps a step that only fills when strokes are deleted elsewhere', () => {
    const doc = toEditable(coloured())
    const deleted = deleteStrokes(doc, strokeUids(doc))
    expect(deleted.steps.map((step) => step.id)).toEqual(['colour'])
    expectValid(deleted)
  })

  it('sends a split step’s fills with its second half, since they come after its strokes', () => {
    const source = coloured()
    const [outline, colour] = source.steps
    const stroke = outline.strokes[0]
    const doc = toEditable({
      ...source,
      steps: [{ ...outline, strokes: [stroke, { ...stroke, d: 'M 300 500 L 700 500' }], fills: colour.fills }],
    })
    const split = splitStep(doc, 0, 1)
    expect(split.steps[0].fills).toBeUndefined()
    expect(split.steps[1].fills).toEqual(colour.fills)
    expectValid(split)
  })

  it('keeps both steps’ fills, in order, when merging', () => {
    const doc = toEditable(coloured())
    const merged = mergeWithNext(doc, 0)
    expect(merged.steps).toHaveLength(1)
    expect(merged.steps[0].strokes).toHaveLength(1)
    expect(merged.steps[0].fills?.map((fill) => fill.color)).toEqual(['#E8C872', '#C86C35CC'])
    expectValid(merged)
  })
})
