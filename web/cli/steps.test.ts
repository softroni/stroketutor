import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { reversePath } from '../server/regenerate'
import type { Tutorial } from '../src/schema/types'
import { toEditable } from '../src/studio/editor/ops'

import { resolveStrokes } from './selectors'
import { openTestStudio, type TestStudio } from './testing'

let t: TestStudio

beforeEach(async () => {
  t = await openTestStudio()
})

afterEach(async () => {
  await t.close()
})

async function house(): Promise<Tutorial> {
  return JSON.parse((await t.workspace.readTutorial('simple-house'))!.text) as Tutorial
}

describe('stroke selectors', () => {
  it('name strokes by step number or id, singly, in ranges, all, and in lists', async () => {
    const doc = toEditable(await house())
    expect(resolveStrokes(doc, ['4.1'])).toEqual(['k4'])
    expect(resolveStrokes(doc, ['windows.*'])).toEqual(['k4', 'k5'])
    expect(resolveStrokes(doc, ['4.1-2'])).toEqual(['k4', 'k5'])
    expect(resolveStrokes(doc, ['1.1,4.2', '2.1'])).toEqual(['k1', 'k2', 'k5'])
  })

  it('refuse what is not there', async () => {
    const doc = toEditable(await house())
    expect(() => resolveStrokes(doc, ['9.1'])).toThrow('no step 9')
    expect(() => resolveStrokes(doc, ['1.3'])).toThrow('out of range')
    expect(() => resolveStrokes(doc, ['roof'])).toThrow('not a stroke selector')
    expect(() => resolveStrokes(doc, ['nope.1'])).toThrow('no step "nope"')
  })
})

describe('steps', () => {
  it('lists steps with their numbers and ids', async () => {
    const outcome = await t.studio('steps list simple-house')
    expect(outcome.code).toBe(0)
    expect(outcome.stdout).toMatch(/4 {2}windows {2}Add two windows {8}2 strokes/)
  })

  it('sets a title and instruction, keeping the version in History', async () => {
    const outcome = await t.studio(['steps', 'set', 'simple-house', 'roof', '--title', 'The roof', '--instruction', 'A triangle on top.'])
    expect(outcome.code).toBe(0)
    const steps = (await house()).steps
    expect(steps[1].title).toBe('The roof')
    expect(steps[1].instruction).toBe('A triangle on top.')
    const history = await t.workspace.readHistory('simple-house')
    expect(history.map((e) => e.kind)).toEqual(['saved', 'saved'])
  })

  it('saves without a History entry with --no-checkpoint', async () => {
    await t.studio(['steps', 'set', 'simple-house', '1', '--title', 'Walls', '--no-checkpoint'])
    const history = await t.workspace.readHistory('simple-house')
    expect(history.map((e) => e.baseline)).toEqual([true])
  })

  it('splits, merges and moves steps', async () => {
    expect((await t.studio('steps split simple-house windows --at 2')).code).toBe(0)
    let steps = (await house()).steps
    expect(steps.map((s) => s.id)).toEqual(['walls', 'roof', 'door', 'windows', 'windows-2', 'chimney'])
    expect(steps[4].title).toBe('Add two windows (continued)')

    expect((await t.studio('steps merge simple-house 4')).code).toBe(0)
    steps = (await house()).steps
    expect(steps.map((s) => s.strokes.length)).toEqual([1, 1, 1, 2, 1])

    expect((await t.studio('steps move simple-house chimney --to 1')).code).toBe(0)
    expect((await house()).steps[0].id).toBe('chimney')

    const bad = await t.studio('steps split simple-house walls --at 1')
    expect(bad.code).toBe(1)
    expect(bad.stderr).toContain('only one stroke')
  })

  it('groups strokes into a new step with its own words', async () => {
    const outcome = await t.studio(['steps', 'group', 'simple-house', '3.1', '4.*', '--title', 'Openings', '--instruction', 'Door and windows.'])
    expect(outcome.code).toBe(0)
    const steps = (await house()).steps
    expect(steps.map((s) => [s.id, s.strokes.length])).toEqual([['walls', 1], ['roof', 1], ['new-step', 3], ['chimney', 1]])
    expect(steps[2].title).toBe('Openings')
  })

  it('leaves an unchanged lesson byte-identical', async () => {
    const before = (await t.workspace.readTutorial('simple-house'))!.text
    await t.studio(['steps', 'set', 'simple-house', '1', '--title', 'Draw the walls'])
    expect((await t.workspace.readTutorial('simple-house'))!.text).toBe(before)
  })
})

describe('strokes', () => {
  it('lists strokes with selectors, for the whole lesson or one step', async () => {
    const all = await t.json<{ strokes: { selector: string }[] }>('strokes list simple-house')
    expect(all.strokes.map((s) => s.selector)).toEqual(['1.1', '2.1', '3.1', '4.1', '4.2', '5.1'])
    const one = await t.json<{ strokes: { selector: string; step: string }[] }>('strokes list simple-house windows')
    expect(one.strokes.map((s) => s.step)).toEqual(['windows', 'windows'])
  })

  it('moves, reorders, retimes and deletes strokes', async () => {
    const door = (await house()).steps[2].strokes[0].d
    expect((await t.studio('strokes move simple-house 3.1 --to-step windows')).code).toBe(0)
    let steps = (await house()).steps
    expect(steps.map((s) => [s.id, s.strokes.length])).toEqual([['walls', 1], ['roof', 1], ['windows', 3], ['chimney', 1]])

    expect((await t.studio('strokes reorder simple-house windows 3 --to 1')).code).toBe(0)
    steps = (await house()).steps
    expect(steps[2].strokes[0].d).toBe(door)

    expect((await t.studio('strokes set simple-house windows.* --duration 1.5 --line-width 10')).code).toBe(0)
    steps = (await house()).steps
    expect(steps[2].strokes.every((s) => s.duration === 1.5 && s.lineWidth === 10)).toBe(true)

    expect((await t.studio('strokes delete simple-house 4.1')).code).toBe(0)
    expect((await house()).steps.map((s) => s.id)).toEqual(['walls', 'roof', 'windows'])

    const bad = await t.studio('strokes set simple-house 1.1 --duration 0')
    expect(bad.code).toBe(1)
    expect(bad.stderr).toContain('duration')
  })

  it('refuses to delete the last stroke', async () => {
    const outcome = await t.studio('strokes delete simple-house 1.* 2.* 3.* 4.* 5.*')
    expect(outcome.code).toBe(1)
    expect(outcome.stderr).toContain('at least one stroke')
  })
})

describe('strokes reverse', () => {
  it('draws a stroke from its other end, and back again when reversed twice', async () => {
    const original = (await house()).steps[1].strokes[0].d
    const once = await t.studio(['strokes', 'reverse', 'simple-house', '2.1'])
    expect(once.stderr).toBe('')
    expect(once.code).toBe(0)
    expect(once.stdout).toContain('Reversed 2.1.')
    const reversed = (await house()).steps[1].strokes[0].d
    expect(reversed).toBe(reversePath(original))
    expect(reversed).not.toBe(original)
    await t.studio(['strokes', 'reverse', 'simple-house', '2.1'])
    expect((await house()).steps[1].strokes[0].d).toBe(original)
    expect((await t.workspace.readHistory('simple-house')).map((e) => e.kind)).toEqual(['saved', 'saved', 'saved'])
  })
})

