import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { Tutorial } from '../../schema/types'
import { parseTutorialJSON, validateTutorial } from '../../schema/validate'

import {
  EditError,
  deleteStrokes,
  groupIntoNewStep,
  mergeWithNext,
  moveStrokes,
  reorderSteps,
  reorderStrokes,
  splitStep,
  strokeUids,
  toEditable,
  toTutorial,
  updateStep,
  updateStrokes,
  type EditableTutorial,
} from './ops'

const tutorialsDir = fileURLToPath(new URL('../../../../shared/Tutorials/', import.meta.url))

function golden(file: string): Tutorial {
  const result = parseTutorialJSON(readFileSync(`${tutorialsDir}${file}`, 'utf8'))
  if (!result.ok) throw new Error(`${file} is invalid`)
  return result.tutorial
}

const house = () => toEditable(golden('simple-house.json'))
const cat = () => toEditable(golden('cat-face.json'))
const stepIds = (doc: EditableTutorial) => doc.steps.map((step) => step.id)
const uidsIn = (doc: EditableTutorial, stepId: string) =>
  doc.steps.find((step) => step.id === stepId)?.strokes.map((stroke) => stroke.uid) ?? []

/** The three invariants, plus: the result is still a valid v1 tutorial. */
function expectInvariants(doc: EditableTutorial, expectedUids: string[]) {
  expect([...strokeUids(doc)].sort()).toEqual([...expectedUids].sort())
  expect(doc.steps.every((step) => step.strokes.length > 0)).toBe(true)
  expect(new Set(stepIds(doc)).size).toBe(doc.steps.length)
  const result = validateTutorial(toTutorial(doc))
  expect(result.ok, result.ok ? '' : JSON.stringify(result.issues)).toBe(true)
}

describe('toEditable / toTutorial', () => {
  it('round-trips the golden files byte for byte', () => {
    for (const file of ['simple-house.json', 'cat-face.json']) {
      const original = golden(file)
      expect(JSON.stringify(toTutorial(toEditable(original)))).toBe(JSON.stringify(original))
    }
  })

  it('gives every stroke a distinct uid', () => {
    const uids = strokeUids(cat())
    expect(new Set(uids).size).toBe(uids.length)
  })
})

describe('reordering', () => {
  it('moves a step', () => {
    const doc = reorderSteps(house(), 1, 0)
    expect(stepIds(doc)).toEqual(['roof', 'walls', 'door', 'windows', 'chimney'])
    expectInvariants(doc, strokeUids(house()))
  })

  it('moves a stroke within its step', () => {
    const before = house()
    const doc = reorderStrokes(before, 3, 1, 0)
    expect(uidsIn(doc, 'windows')).toEqual([...uidsIn(before, 'windows')].reverse())
    expectInvariants(doc, strokeUids(before))
  })
})

describe('moveStrokes', () => {
  it('appends the strokes to the target step', () => {
    const before = house()
    const [, rightWindow] = uidsIn(before, 'windows')
    const doc = moveStrokes(before, [rightWindow], 'door')
    expect(uidsIn(doc, 'door')).toEqual([...uidsIn(before, 'door'), rightWindow])
    expect(uidsIn(doc, 'windows')).toHaveLength(1)
    expectInvariants(doc, strokeUids(before))
  })

  it('removes a step it empties', () => {
    const before = house()
    const doc = moveStrokes(before, uidsIn(before, 'chimney'), 'roof')
    expect(stepIds(doc)).toEqual(['walls', 'roof', 'door', 'windows'])
    expectInvariants(doc, strokeUids(before))
  })

  it('refuses an unknown target step', () => {
    const before = house()
    expect(() => moveStrokes(before, uidsIn(before, 'door'), 'porch')).toThrow(EditError)
  })
})

describe('groupIntoNewStep', () => {
  it('takes the place of the first step when it empties it', () => {
    const before = house()
    const door = uidsIn(before, 'door')
    const [leftWindow] = uidsIn(before, 'windows')
    const doc = groupIntoNewStep(before, [leftWindow, ...door], { title: 'Door and window' })

    expect(stepIds(doc)).toEqual(['walls', 'roof', 'new-step', 'windows', 'chimney'])
    // Drawing order, not selection order.
    expect(uidsIn(doc, 'new-step')).toEqual([...door, leftWindow])
    expect(doc.steps[2].title).toBe('Door and window')
    expectInvariants(doc, strokeUids(before))
  })

  it('follows the first step when that step keeps strokes', () => {
    const before = cat()
    const [, , leftCurve, rightCurve] = uidsIn(before, 'nose-mouth')
    const doc = groupIntoNewStep(before, [leftCurve, rightCurve])
    expect(stepIds(doc)).toEqual([
      'head',
      'left-ear',
      'right-ear',
      'eyes',
      'nose-mouth',
      'new-step',
      'whiskers',
    ])
    expectInvariants(doc, strokeUids(before))
  })

  it('refuses an empty selection', () => {
    expect(() => groupIntoNewStep(house(), [])).toThrow(EditError)
  })
})

describe('splitStep and mergeWithNext', () => {
  it('splits a step into two consecutive steps', () => {
    const before = house()
    const doc = splitStep(before, 3, 1)
    expect(stepIds(doc)).toEqual(['walls', 'roof', 'door', 'windows', 'windows-2', 'chimney'])
    expect(doc.steps[4].title).toBe('Add two windows (continued)')
    expectInvariants(doc, strokeUids(before))
  })

  it('refuses to split a one-stroke step or at the edges', () => {
    const before = house()
    expect(() => splitStep(before, 0, 1)).toThrow(EditError)
    expect(() => splitStep(before, 3, 0)).toThrow(EditError)
    expect(() => splitStep(before, 3, 2)).toThrow(EditError)
  })

  it('merges a step with the next, keeping its own words', () => {
    const before = house()
    const doc = mergeWithNext(before, 3)
    expect(stepIds(doc)).toEqual(['walls', 'roof', 'door', 'windows'])
    expect(uidsIn(doc, 'windows')).toEqual([
      ...uidsIn(before, 'windows'),
      ...uidsIn(before, 'chimney'),
    ])
    expectInvariants(doc, strokeUids(before))
  })

  it('undoes a split with a merge', () => {
    const before = house()
    const doc = mergeWithNext(splitStep(before, 3, 1), 3)
    expect(JSON.stringify(toTutorial(doc))).toBe(JSON.stringify(toTutorial(before)))
  })

  it('refuses to merge the last step', () => {
    expect(() => mergeWithNext(house(), 4)).toThrow(EditError)
  })
})

describe('deleting and editing', () => {
  it('deletes strokes and any step they empty', () => {
    const before = house()
    const chimney = uidsIn(before, 'chimney')
    const doc = deleteStrokes(before, chimney)
    expectInvariants(
      doc,
      strokeUids(before).filter((uid) => !chimney.includes(uid)),
    )
    expect(stepIds(doc)).not.toContain('chimney')
  })

  it('refuses to delete every stroke', () => {
    const before = house()
    expect(() => deleteStrokes(before, strokeUids(before))).toThrow(EditError)
  })

  it('edits words and timing without touching the input', () => {
    const before = house()
    const snapshot = JSON.stringify(before)
    const [leftWindow, rightWindow] = uidsIn(before, 'windows')

    let doc = updateStep(before, 3, { title: 'Add the windows', instruction: 'One each side.' })
    doc = updateStrokes(doc, [leftWindow, rightWindow], { duration: 2, lineWidth: 10 })

    expect(doc.steps[3].title).toBe('Add the windows')
    expect(doc.steps[3].strokes.map((stroke) => [stroke.duration, stroke.lineWidth])).toEqual([
      [2, 10],
      [2, 10],
    ])
    expect(JSON.stringify(before)).toBe(snapshot)
    expectInvariants(doc, strokeUids(before))
  })

  it('refuses a stale selection', () => {
    expect(() => updateStrokes(house(), ['nope'], { duration: 1 })).toThrow(EditError)
  })
})

describe('any sequence of edits', () => {
  // A small deterministic generator, so a failure reproduces exactly.
  function random(seed: number) {
    let state = seed
    return (below: number) => {
      state = (state * 1103515245 + 12345) % 2147483648
      return state % below
    }
  }

  for (const [name, load] of [
    ['simple-house', house],
    ['cat-face', cat],
  ] as const) {
    it(`keeps the invariants on ${name} across 300 random operations`, () => {
      const next = random(name.length * 7919)
      let doc = load()
      const uids = strokeUids(doc)

      for (let i = 0; i < 300; i += 1) {
        const all = strokeUids(doc)
        const someStrokes = all.filter(() => next(3) === 0)
        const selection = someStrokes.length > 0 ? someStrokes : [all[next(all.length)]]
        const stepIndex = next(doc.steps.length)
        const step = doc.steps[stepIndex]

        try {
          switch (next(6)) {
            case 0:
              doc = reorderSteps(doc, stepIndex, next(doc.steps.length))
              break
            case 1:
              doc = reorderStrokes(doc, stepIndex, next(step.strokes.length), next(step.strokes.length))
              break
            case 2:
              doc = moveStrokes(doc, selection, doc.steps[next(doc.steps.length)].id)
              break
            case 3:
              doc = groupIntoNewStep(doc, selection)
              break
            case 4:
              doc = splitStep(doc, stepIndex, 1 + next(Math.max(1, step.strokes.length - 1)))
              break
            case 5:
              doc = mergeWithNext(doc, stepIndex)
              break
          }
        } catch (error) {
          // Refusals are fine; anything else is a bug.
          if (!(error instanceof EditError)) throw error
        }
        expectInvariants(doc, uids)
      }
    })
  }
})
