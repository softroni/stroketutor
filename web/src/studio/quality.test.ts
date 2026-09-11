import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { Step, Tutorial } from '../schema/types'
import { parseTutorialJSON } from '../schema/validate'

import { NEW_STEP_INSTRUCTION, NEW_STEP_TITLE } from './editor/ops'
import { MAX_STROKES_PER_STEP, qualityWarnings, strokeLength } from './quality'

const tutorialsDir = fileURLToPath(new URL('../../../shared/Tutorials/', import.meta.url))

function golden(file: string): Tutorial {
  const result = parseTutorialJSON(readFileSync(`${tutorialsDir}${file}`, 'utf8'))
  if (!result.ok) throw new Error(`${file} is invalid`)
  return result.tutorial
}

const line = (x: number, length: number, duration = 1) => ({
  d: `M ${x} 100 L ${x} ${100 + length}`,
  duration,
  lineWidth: 8,
})

const step = (id: string, strokes: Step['strokes'], words: Partial<Step> = {}): Step => ({
  id,
  title: `Draw ${id}`,
  instruction: `Draw the ${id}.`,
  strokes,
  ...words,
})

const tutorial = (steps: Step[]): Tutorial => ({
  schemaVersion: 1,
  id: 't',
  title: 'T',
  canvas: { width: 1000, height: 1000 },
  steps,
})

const codes = (t: Tutorial, previous?: Tutorial) => qualityWarnings(t, previous).map((w) => w.code)

describe('strokeLength', () => {
  it('measures lines, closed shapes and separate subpaths exactly', () => {
    expect(strokeLength('M 0 0 L 30 40')).toBe(50)
    expect(strokeLength('M 0 0 L 10 0 L 10 10 L 0 10 Z')).toBe(40)
    expect(strokeLength('M 0 0 L 0 5 M 100 100 L 100 110')).toBe(15)
  })

  it('measures curves closely without a DOM', () => {
    // A quarter circle of radius 100 as a cubic: about 157.08.
    const quarter = strokeLength('M 100 0 C 100 55.23 55.23 100 0 100')
    expect(quarter).toBeGreaterThan(156.5)
    expect(quarter).toBeLessThan(157.5)
    // A straight quadratic is its chord.
    expect(strokeLength('M 0 0 Q 50 0 100 0')).toBeCloseTo(100, 6)
  })
})

describe('qualityWarnings', () => {
  it('finds nothing to flag in the golden lessons', () => {
    expect(codes(golden('simple-house.json'))).toEqual([])
    expect(codes(golden('cat-face.json'))).toEqual([])
  })

  it('flags a lesson estimated past five minutes', () => {
    const slow = tutorial([step('a', [line(100, 400, 60), line(200, 400, 60)])])
    expect(codes(slow)).toContain('long-lesson')
  })

  it('flags a dense stroke count', () => {
    const dense = tutorial(
      Array.from({ length: 9 }, (_, s) =>
        step(`s${s}`, Array.from({ length: 5 }, (_, i) => line(100 + i * 10, 300, 0.2))),
      ),
    )
    expect(codes(dense)).toContain('many-strokes')
  })

  it('flags a lesson made mostly of tiny strokes', () => {
    const specks = tutorial([step('a', [line(100, 400), line(200, 5), line(300, 5), line(400, 5)])])
    expect(codes(specks)).toContain('tiny-strokes')
  })

  it('flags a step that asks for too much at once', () => {
    const crowded = tutorial([
      step('a', Array.from({ length: MAX_STROKES_PER_STEP + 1 }, (_, i) => line(100 + i * 50, 300))),
    ])
    expect(qualityWarnings(crowded)).toContainEqual(
      expect.objectContaining({ code: 'crowded-step', path: 'steps[0]' }),
    )
  })

  it('flags placeholder words left by grouping and splitting', () => {
    const unfinished = tutorial([
      step('a', [line(100, 300)], { title: NEW_STEP_TITLE, instruction: NEW_STEP_INSTRUCTION }),
      step('b', [line(200, 300)], { title: 'Draw b (continued)' }),
    ])
    expect(qualityWarnings(unfinished).map((w) => w.path)).toEqual([
      'steps[0].title',
      'steps[0].instruction',
      'steps[1].title',
    ])
  })

  it('flags a big jump from the previous lesson in the path', () => {
    const house = golden('simple-house.json')
    const doubled = { ...house, steps: [...house.steps, ...house.steps.map((s) => ({ ...s, id: `${s.id}-2` }))] }
    expect(codes(doubled, house)).toContain('complexity-jump')
    expect(codes(house, house)).not.toContain('complexity-jump')
  })
})
