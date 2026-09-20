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

const sun = () => toEditable(golden('sun.json'))
const strokeOnlySun = () => {
  const doc = sun()
  return { ...doc, steps: doc.steps.filter((step) => step.strokes.length > 0) }
}
const stepIds = (doc: EditableTutorial) => doc.steps.map((step) => step.id)
const uidsIn = (doc: EditableTutorial, stepId: string) =>
  doc.steps.find((step) => step.id === stepId)?.strokes.map((stroke) => stroke.uid) ?? []

/** The three invariants, plus: the result is still a valid v1 tutorial. */
function expectInvariants(doc: EditableTutorial, expectedUids: string[]) {
  expect([...strokeUids(doc)].sort()).toEqual([...expectedUids].sort())
  expect(doc.steps.every((step) => step.strokes.length > 0 || (step.fills?.length ?? 0) > 0)).toBe(true)
  expect(new Set(stepIds(doc)).size).toBe(doc.steps.length)
  const result = validateTutorial(toTutorial(doc))
  expect(result.ok, result.ok ? '' : JSON.stringify(result.issues)).toBe(true)
}

describe('toEditable / toTutorial', () => {
  it('round-trips the golden files byte for byte', () => {
    for (const file of ['sun.json', 'cloud.json']) {
      const original = golden(file)
      expect(JSON.stringify(toTutorial(toEditable(original)))).toBe(JSON.stringify(original))
    }
  })

  it('gives every stroke a distinct uid', () => {
    const uids = strokeUids(sun())
    expect(new Set(uids).size).toBe(uids.length)
  })
})

describe('reordering', () => {
  it('moves a step', () => {
    const doc = reorderSteps(sun(), 1, 0)
    expect(stepIds(doc)).toEqual(['right-half', 'left-half', 'rays-up-down', 'rays-sides', 'rays-corners', 'sun'])
    expectInvariants(doc, strokeUids(sun()))
  })

  it('moves a stroke within its step', () => {
    const before = sun()
    const doc = reorderStrokes(before, 3, 1, 0)
    expect(uidsIn(doc, 'rays-sides')).toEqual([...uidsIn(before, 'rays-sides')].reverse())
    expectInvariants(doc, strokeUids(before))
  })
})

describe('moveStrokes', () => {
  it('appends the strokes to the target step', () => {
    const before = sun()
    const [, rightRay] = uidsIn(before, 'rays-sides')
    const doc = moveStrokes(before, [rightRay], 'left-half')
    expect(uidsIn(doc, 'left-half')).toEqual([...uidsIn(before, 'left-half'), rightRay])
    expect(uidsIn(doc, 'rays-sides')).toHaveLength(1)
    expectInvariants(doc, strokeUids(before))
  })

  it('removes a step it empties', () => {
    const before = sun()
    const doc = moveStrokes(before, uidsIn(before, 'right-half'), 'left-half')
    expect(stepIds(doc)).toEqual(['left-half', 'rays-up-down', 'rays-sides', 'rays-corners', 'sun'])
    expectInvariants(doc, strokeUids(before))
  })

  it('refuses an unknown target step', () => {
    const before = sun()
    expect(() => moveStrokes(before, uidsIn(before, 'left-half'), 'no-such-step')).toThrow(EditError)
  })
})

describe('groupIntoNewStep', () => {
  it('takes the place of the first step when it empties it', () => {
    const before = sun()
    const rightHalf = uidsIn(before, 'right-half')
    const [topRay] = uidsIn(before, 'rays-up-down')
    const doc = groupIntoNewStep(before, [topRay, ...rightHalf], { title: 'Right side and top ray' })

    expect(stepIds(doc)).toEqual(['left-half', 'new-step', 'rays-up-down', 'rays-sides', 'rays-corners', 'sun'])
    // Drawing order, not selection order.
    expect(uidsIn(doc, 'new-step')).toEqual([...rightHalf, topRay])
    expect(doc.steps[1].title).toBe('Right side and top ray')
    expectInvariants(doc, strokeUids(before))
  })

  it('follows the first step when that step keeps strokes', () => {
    const before = sun()
    const [, , lowerRightRay, lowerLeftRay] = uidsIn(before, 'rays-corners')
    const doc = groupIntoNewStep(before, [lowerRightRay, lowerLeftRay])
    expect(stepIds(doc)).toEqual([
      'left-half',
      'right-half',
      'rays-up-down',
      'rays-sides',
      'rays-corners',
      'new-step',
      'sun',
    ])
    expectInvariants(doc, strokeUids(before))
  })

  it('refuses an empty selection', () => {
    expect(() => groupIntoNewStep(sun(), [])).toThrow(EditError)
  })
})

describe('splitStep and mergeWithNext', () => {
  it('splits a step into two consecutive steps', () => {
    const before = sun()
    const doc = splitStep(before, 2, 1)
    expect(stepIds(doc)).toEqual(['left-half', 'right-half', 'rays-up-down', 'rays-up-down-2', 'rays-sides', 'rays-corners', 'sun'])
    expect(doc.steps[3].title).toBe('Draw the top and bottom rays (continued)')
    expectInvariants(doc, strokeUids(before))
  })

  it('refuses to split a one-stroke step or at the edges', () => {
    const before = sun()
    expect(() => splitStep(before, 0, 1)).toThrow(EditError)
    expect(() => splitStep(before, 2, 0)).toThrow(EditError)
    expect(() => splitStep(before, 2, 2)).toThrow(EditError)
  })

  it('merges a step with the next, keeping its own words', () => {
    const before = sun()
    const doc = mergeWithNext(before, 3)
    expect(stepIds(doc)).toEqual(['left-half', 'right-half', 'rays-up-down', 'rays-sides', 'sun'])
    expect(uidsIn(doc, 'rays-sides')).toEqual([
      ...uidsIn(before, 'rays-sides'),
      ...uidsIn(before, 'rays-corners'),
    ])
    expectInvariants(doc, strokeUids(before))
  })

  it('undoes a split with a merge', () => {
    const before = sun()
    const doc = mergeWithNext(splitStep(before, 2, 1), 2)
    expect(JSON.stringify(toTutorial(doc))).toBe(JSON.stringify(toTutorial(before)))
  })

  it('refuses to merge the last step', () => {
    expect(() => mergeWithNext(sun(), 5)).toThrow(EditError)
  })
})

describe('deleting and editing', () => {
  it('deletes strokes and any step they empty', () => {
    const before = sun()
    const rightHalf = uidsIn(before, 'right-half')
    const doc = deleteStrokes(before, rightHalf)
    expectInvariants(
      doc,
      strokeUids(before).filter((uid) => !rightHalf.includes(uid)),
    )
    expect(stepIds(doc)).not.toContain('right-half')
  })

  it('refuses to delete every stroke', () => {
    const before = strokeOnlySun()
    expect(() => deleteStrokes(before, strokeUids(before))).toThrow(EditError)
  })

  it('edits words and timing without touching the input', () => {
    const before = sun()
    const snapshot = JSON.stringify(before)
    const [leftRay, rightRay] = uidsIn(before, 'rays-sides')

    let doc = updateStep(before, 3, { title: 'Add the side rays', instruction: 'One each side.' })
    doc = updateStrokes(doc, [leftRay, rightRay], { duration: 2, lineWidth: 10 })

    expect(doc.steps[3].title).toBe('Add the side rays')
    expect(doc.steps[3].strokes.map((stroke) => [stroke.duration, stroke.lineWidth])).toEqual([
      [2, 10],
      [2, 10],
    ])
    expect(JSON.stringify(before)).toBe(snapshot)
    expectInvariants(doc, strokeUids(before))
  })

  it('refuses a stale selection', () => {
    expect(() => updateStrokes(sun(), ['nope'], { duration: 1 })).toThrow(EditError)
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
    ['sun', sun],
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
