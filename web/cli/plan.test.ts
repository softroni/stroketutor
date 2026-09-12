import { writeFile } from 'node:fs/promises'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { reversePath, type PlannedStep } from '../server/regenerate'
import type { Tutorial } from '../src/schema/types'

import { fakeBrowser, openTestStudio, type TestStudio } from './testing'

let t: TestStudio

beforeEach(async () => {
  t = await openTestStudio({ browser: fakeBrowser() })
})

afterEach(async () => {
  await t.close()
})

async function house(): Promise<Tutorial> {
  return JSON.parse((await t.workspace.readTutorial('simple-house'))!.text) as Tutorial
}

async function plan(name: string, content: unknown): Promise<string> {
  const file = path.join(t.root, name)
  await writeFile(file, JSON.stringify(content))
  return file
}

/** The house's own steps, each with its own labels, as `lessons summary` prints them. */
const HOUSE_STEPS: PlannedStep[] = [
  { id: 'walls', title: 'Draw the walls', instruction: 'A square.', strokeIds: ['s1'], fillIds: [] },
  { id: 'roof', title: 'Add the roof', instruction: 'A triangle.', strokeIds: ['s2'], fillIds: [] },
  { id: 'door', title: 'Put in the door', instruction: 'A rectangle.', strokeIds: ['s3'], fillIds: [] },
  { id: 'windows', title: 'Add two windows', instruction: 'Two squares.', strokeIds: ['s4', 's5'], fillIds: [] },
  { id: 'chimney', title: 'Finish with a chimney', instruction: 'On the roof.', strokeIds: ['s6'], fillIds: [] },
]

describe('lessons summary', () => {
  it('labels the lines s1..s6 across the steps, in drawing order', async () => {
    const summary = await t.json<{ id: string; title: string; steps: { id: string; strokes: { id: string; start: number[] }[]; fills: unknown[] }[] }>('lessons summary simple-house')
    expect(summary.id).toBe('simple-house')
    expect(summary.title).toBe('Simple House')
    expect(summary.steps.map((step) => [step.id, step.strokes.map((stroke) => stroke.id)])).toEqual([
      ['walls', ['s1']],
      ['roof', ['s2']],
      ['door', ['s3']],
      ['windows', ['s4', 's5']],
      ['chimney', ['s6']],
    ])
    expect(summary.steps[1].strokes[0].start).toEqual([200, 480])
    const outcome = await t.studio('lessons summary simple-house')
    expect(outcome.code).toBe(0)
    expect(outcome.stdout).toContain('4 · windows · Add two windows')
    expect(outcome.stdout).toMatch(/s4 {2}line {2}320 540 420 640/)
  })
})

describe('lessons apply', () => {
  it('regroups the lines with --layer steps and records a saved checkpoint', async () => {
    const file = await plan('steps.json', {
      steps: [
        { id: 'body', title: 'Draw the body', instruction: 'Walls and roof together.', strokeIds: ['s1', 's2'], fillIds: [] },
        { id: 'openings', title: 'Add the openings', instruction: 'The door, then both windows.', strokeIds: ['s3', 's4', 's5'] },
        { id: 'chimney', title: 'Finish with a chimney', instruction: 'On the right.', strokeIds: ['s6'] },
      ],
    })
    const outcome = await t.studio(['lessons', 'apply', 'simple-house', '--layer', 'steps', '--plan', file])
    expect(outcome.stderr).toBe('')
    expect(outcome.code).toBe(0)
    expect(outcome.stdout).toContain('Applied the steps plan to simple-house.')
    const after = await house()
    expect(after.steps.map((step) => [step.id, step.strokes.length])).toEqual([['body', 2], ['openings', 3], ['chimney', 1]])
    expect(after.steps[1].strokes[0].d).toBe('M 440 850 L 440 690 L 560 690 L 560 850')
    expect(after.title).toBe('Simple House')
    expect((await t.workspace.readHistory('simple-house')).map((entry) => entry.kind)).toEqual(['saved', 'saved'])
  })

  it('reverses a line with --layer order, so its d is reversePath(original)', async () => {
    const original = (await house()).steps[1].strokes[0].d
    const file = await plan('order.json', {
      steps: [...HOUSE_STEPS].reverse().map(({ id, strokeIds, fillIds }) => ({ id, strokeIds, fillIds })),
      reversedStrokeIds: ['s2'],
    })
    const outcome = await t.json<{ changed: boolean; notes: string[]; steps: { id: string }[] }>(['lessons', 'apply', 'simple-house', '--layer', 'order', '--plan', file])
    expect(outcome.changed).toBe(true)
    expect(outcome.notes).toContain('1 line is now drawn from the other end.')
    expect(outcome.steps.map((step) => step.id)).toEqual(['chimney', 'windows', 'door', 'roof', 'walls'])
    const roof = (await house()).steps[3].strokes[0].d
    expect(roof).toBe(reversePath(original))
    expect(roof).not.toBe(original)
  })

  it('renames the steps with --layer instructions and nothing else', async () => {
    const before = await house()
    const file = await plan('words.json', { steps: HOUSE_STEPS.map(({ id, title, instruction }) => ({ id, title: title.toUpperCase(), instruction })) })
    const outcome = await t.studio(['lessons', 'apply', 'simple-house', '--layer', 'instructions', '--plan', file, '--no-checkpoint'])
    expect(outcome.code).toBe(0)
    const after = await house()
    expect(after.steps.map((step) => step.title)).toEqual(['DRAW THE WALLS', 'ADD THE ROOF', 'PUT IN THE DOOR', 'ADD TWO WINDOWS', 'FINISH WITH A CHIMNEY'])
    expect(after.steps.map((step) => step.strokes)).toEqual(before.steps.map((step) => step.strokes))
    expect((await t.workspace.readHistory('simple-house')).map((entry) => entry.kind)).toEqual(['saved'])
  })

  it('refuses a plan that leaves a label out, or names one that is not there, and writes nothing', async () => {
    const before = await house()
    const missing = await plan('missing.json', { steps: [{ id: 'all', title: 'All', instruction: 'Everything but the chimney.', strokeIds: ['s1', 's2', 's3', 's4', 's5'] }] })
    const short = await t.studio(['lessons', 'apply', 'simple-house', '--layer', 'steps', '--plan', missing])
    expect(short.code).toBe(1)
    expect(short.stderr).toContain('leaves out 1 label: s6')

    const unknown = await plan('unknown.json', { steps: [{ id: 'all', title: 'All', instruction: 'Everything.', strokeIds: ['s1', 's2', 's3', 's4', 's5', 's6', 's7'] }] })
    const made = await t.studio(['lessons', 'apply', 'simple-house', '--layer', 'steps', '--plan', unknown])
    expect(made.code).toBe(1)
    expect(made.stderr).toContain('not there: s7')

    const twice = await plan('twice.json', { steps: [{ id: 'a', title: 'A', instruction: 'A.', strokeIds: ['s1', 's2', 's3'] }, { id: 'b', title: 'B', instruction: 'B.', strokeIds: ['s3', 's4', 's5', 's6'] }] })
    expect((await t.studio(['lessons', 'apply', 'simple-house', '--layer', 'steps', '--plan', twice])).stderr).toContain('uses s3 twice')

    const wordless = await plan('wordless.json', { steps: HOUSE_STEPS.map(({ id, title }) => ({ id, title })) })
    expect((await t.studio(['lessons', 'apply', 'simple-house', '--layer', 'instructions', '--plan', wordless])).stderr).toContain('has no instruction')

    const foreign = await plan('foreign.json', { steps: HOUSE_STEPS.map((step) => (step.id === 'walls' ? { ...step, strokeIds: ['s1', 's2'] } : step.id === 'roof' ? { ...step, strokeIds: [] } : step)) })
    expect((await t.studio(['lessons', 'apply', 'simple-house', '--layer', 'order', '--plan', foreign])).stderr).toContain('belongs to another step')

    expect(await house()).toEqual(before)
    expect(await t.workspace.readHistory('simple-house')).toEqual([])
  })

  it('needs a layer and a plan', async () => {
    expect((await t.studio(['lessons', 'apply', 'simple-house'])).stderr).toContain('--layer')
    expect((await t.studio(['lessons', 'apply', 'simple-house', '--layer', 'steps'])).stderr).toContain('--plan')
    expect((await t.studio(['lessons', 'apply', 'simple-house', '--layer', 'steps', '--plan', path.join(t.root, 'nope.json')])).stderr).toContain('Could not read the plan')
  })
})
