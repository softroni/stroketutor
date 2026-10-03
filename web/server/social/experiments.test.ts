import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  experimentsOn,
  HOOK_FROM,
  listedArm,
  openingFor,
  openingOn,
  parseRegister,
  readRegister,
  REGISTER_FILE,
  runsOn,
  type Register,
} from './experiments'

// E1 as social-plan.md has it: the hook from Oct 5, the classic opening on the B days of AABB.
const E1 = { E1: { from: '2026-10-05', until: '2026-10-12', classic: ['2026-10-07', '2026-10-08', '2026-10-11', '2026-10-12'] } }

describe('the register of tests', () => {
  it('reads each test’s arms and days, with the days it runs', () => {
    const register = parseRegister(JSON.stringify({ E1: { about: 'The opening.', ...E1.E1 } }))
    expect(register).toEqual({
      E1: { about: 'The opening.', from: '2026-10-05', until: '2026-10-12', arms: { classic: ['2026-10-07', '2026-10-08', '2026-10-11', '2026-10-12'] } },
    })
  })

  it('runs a test from its first listed day to its last when it doesn’t say', () => {
    const register = parseRegister(JSON.stringify({ E1: { classic: ['2026-10-11', '2026-10-07'], hook: ['2026-10-09'] } }))
    expect(register.E1).toMatchObject({ from: '2026-10-07', until: '2026-10-11', arms: { classic: ['2026-10-07', '2026-10-11'], hook: ['2026-10-09'] } })
  })

  it.each([
    ['not JSON', '{ E1: ', /isn’t JSON/],
    ['a list', '[]', /an object of tests/],
    ['an arm that isn’t a list', JSON.stringify({ E1: { classic: '2026-10-07' } }), /E1\.classic should be a list of days/],
    ['a day that isn’t one', JSON.stringify({ E1: { classic: ['2026-10-32'] } }), /"2026-10-32", which isn’t a day/],
    ['a day under two arms', JSON.stringify({ E1: { classic: ['2026-10-07'], hook: ['2026-10-07'] } }), /lists 2026-10-07 under both classic and hook/],
    ['an opening that doesn’t exist', JSON.stringify({ E1: { mystery: ['2026-10-07'] } }), /E1 has no arm “mystery”; its arms are classic and hook/],
    ['days backwards', JSON.stringify({ E1: { from: '2026-10-12', until: '2026-10-05', classic: [] } }), /which is backwards/],
    ['a day outside the test', JSON.stringify({ E1: { from: '2026-10-05', until: '2026-10-08', classic: ['2026-10-11'] } }), /lists 2026-10-11, outside the days it runs/],
    ['no day at all', JSON.stringify({ E1: { classic: [] } }), /lists no day/],
  ])('refuses %s, saying what is wrong', (_what, text, message) => {
    expect(() => parseRegister(text)).toThrow(message)
  })

  it('lets other tests name their own arms', () => {
    expect(parseRegister(JSON.stringify({ E2: { speed: ['2026-10-16'] } })).E2.arms).toEqual({ speed: ['2026-10-16'] })
  })

  it('is the file in docs/ops, which parses', () => {
    const repoDir = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)))
    const register = parseRegister(readFileSync(path.join(repoDir, REGISTER_FILE), 'utf8'))
    expect(register.E1).toMatchObject({ from: '2026-10-05', until: '2026-10-12', arms: { classic: E1.E1.classic } })
  })
})

describe('the opening of the day', () => {
  const register = parseRegister(JSON.stringify(E1)) as Register

  it('stays classic until the hook’s first day, nothing changing before it', () => {
    expect(HOOK_FROM).toBe('2026-10-05')
    for (const day of ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-04']) expect(openingOn(day, register)).toBe('classic')
  })

  it('is the hook from Oct 5, except the days the register gives the classic opening (AABB)', () => {
    const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-11-01']
    expect(days.map((day) => openingOn(day, register))).toEqual(['hook', 'hook', 'classic', 'classic', 'hook', 'hook', 'classic', 'classic', 'hook', 'hook'])
  })

  it('is what the dates alone say with no register', () => {
    expect(openingOn('2026-10-04', {})).toBe('classic')
    expect(openingOn('2026-10-07', {})).toBe('hook')
  })

  it('takes a day the register lists for the hook even before the hook’s first day', () => {
    expect(openingOn('2026-10-03', parseRegister(JSON.stringify({ E1: { hook: ['2026-10-03'] } })))).toBe('hook')
  })

  it('records a post as part of E1, with the opening it really has, only on the days E1 runs', () => {
    expect(runsOn(register, 'E1', '2026-10-04')).toBe(false)
    expect(runsOn(register, 'E1', '2026-10-05')).toBe(true)
    expect(runsOn(register, 'E1', '2026-10-12')).toBe(true)
    expect(runsOn(register, 'E1', '2026-10-13')).toBe(false)
    expect(listedArm(register, 'E1', '2026-10-07')).toBe('classic')
    expect(listedArm(register, 'E1', '2026-10-06')).toBeNull()
    expect(experimentsOn('2026-10-06', register, 'hook')).toEqual({ E1: 'hook' })
    expect(experimentsOn('2026-10-07', register, 'classic')).toEqual({ E1: 'classic' })
    // Chosen by hand against the day's, it is recorded as what went out.
    expect(experimentsOn('2026-10-07', register, 'hook')).toEqual({ E1: 'hook' })
    expect(experimentsOn('2026-10-04', register, 'classic')).toBeNull()
    expect(experimentsOn('2026-10-13', register, 'hook')).toBeNull()
  })
})

describe('the register in a repository', () => {
  let repo: string

  beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), 'studio-experiments-'))
  })

  afterEach(() => rmSync(repo, { recursive: true, force: true }))

  const write = (text: string) => {
    mkdirSync(path.join(repo, 'docs', 'ops'), { recursive: true })
    writeFileSync(path.join(repo, REGISTER_FILE), text)
  }

  it('is empty when there is no file', async () => {
    expect(await readRegister(repo)).toEqual({})
    expect(await openingFor(repo, '2026-10-07')).toEqual({ opening: 'hook', register: {}, problem: null })
  })

  it('gives the day its arm', async () => {
    write(JSON.stringify(E1))
    expect((await openingFor(repo, '2026-10-07')).opening).toBe('classic')
    expect((await openingFor(repo, '2026-10-09')).opening).toBe('hook')
  })

  it('never stops a video when it can’t be read: the day gets the opening it has with no test, and the problem is said', async () => {
    write('{ "E1": { "classic": ["2026-10-07", ] } }')
    await expect(readRegister(repo)).rejects.toThrow(`${REGISTER_FILE}: it isn’t JSON`)
    const chosen = await openingFor(repo, '2026-10-07')
    expect(chosen.opening).toBe('hook')
    expect(chosen.register).toEqual({})
    expect(chosen.problem).toMatch(/^docs\/ops\/social-experiments\.json: it isn’t JSON .* The hook opening is used, as with no test\.$/)
  })
})
