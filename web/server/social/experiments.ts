import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { OPENINGS, type Opening } from '../video/plan'

/**
 * The tests running on the posts (docs/ops/social-plan.md, *Growth*), and
 * which arm each day's post is in: `docs/ops/social-experiments.json`, which
 * the weekly review edits and `social next` reads before it renders the day's
 * video. Days are `YYYY-MM-DD` in Central time, as `dayOf` counts them.
 *
 * The file maps each test to its arms, each arm to the days it gets:
 *
 *     { "E1": { "about": "…", "from": "2026-10-05", "until": "2026-10-12",
 *               "classic": ["2026-10-07", "2026-10-08", "2026-10-11", "2026-10-12"] } }
 *
 * `about` says what it is for whoever reads the file; `from` and `until` are
 * the days the test runs (by default its first and last listed day); a day
 * listed under no arm gets what it would get with no test. So E1 above posts
 * the classic opening on four days and the hook on every other day from
 * `HOOK_FROM`, and every post from Oct 5 to Oct 12 is recorded with its arm.
 */

export const REGISTER_FILE = 'docs/ops/social-experiments.json'

/** The test of the opening (social-plan.md, E1): its arms are the openings. */
export const OPENING_TEST = 'E1'

/** From this day (Central) a video opens with the hook unless the register lists the day under another opening; before it, the classic opening. */
export const HOOK_FROM = '2026-10-05'

export interface Experiment {
  about?: string
  /** The first and last day the test runs, inclusive. */
  from: string
  until: string
  /** Each arm and the days it gets. */
  arms: Record<string, string[]>
}

export type Register = Record<string, Experiment>

/** The arms a known test may have; any other test may name its own. */
const KNOWN_ARMS: Record<string, readonly string[]> = { [OPENING_TEST]: OPENINGS }

const DAY = /^\d{4}-\d{2}-\d{2}$/

function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY.test(value)) return false
  const [year, month, date] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date)).toISOString().slice(0, 10) === value
}

/** The register from the file's text. Throws a sentence naming what is wrong, so nobody guesses which day is which arm. */
export function parseRegister(text: string): Register {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error(`it isn’t JSON (${(error as Error).message}).`)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('it should be an object of tests, like { "E1": { "classic": ["2026-10-07"] } }.')
  const register: Register = {}
  for (const [id, value] of Object.entries(parsed)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${id} should be an object of arms and their days.`)
    const arms: Record<string, string[]> = {}
    const seen = new Map<string, string>()
    let about: string | undefined
    let from: string | undefined
    let until: string | undefined
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'about') {
        if (typeof entry !== 'string') throw new Error(`${id}.about should be text.`)
        about = entry
      } else if (key === 'from' || key === 'until') {
        if (!isDay(entry)) throw new Error(`${id}.${key} should be a day, YYYY-MM-DD.`)
        if (key === 'from') from = entry
        else until = entry
      } else {
        if (!Array.isArray(entry)) throw new Error(`${id}.${key} should be a list of days, YYYY-MM-DD.`)
        const known = KNOWN_ARMS[id]
        if (known && !known.includes(key)) throw new Error(`${id} has no arm “${key}”; its arms are ${known.join(' and ')}.`)
        for (const day of entry) {
          if (!isDay(day)) throw new Error(`${id}.${key} has ${JSON.stringify(day)}, which isn’t a day (YYYY-MM-DD).`)
          const other = seen.get(day)
          if (other !== undefined && other !== key) throw new Error(`${id} lists ${day} under both ${other} and ${key}.`)
          seen.set(day, key)
        }
        arms[key] = [...new Set(entry as string[])].sort()
      }
    }
    const days = [...seen.keys()].sort()
    from ??= days[0]
    until ??= days[days.length - 1]
    if (!from || !until) throw new Error(`${id} lists no day: give it from and until, or days under an arm.`)
    if (from > until) throw new Error(`${id} runs from ${from} until ${until}, which is backwards.`)
    const outside = days.find((day) => day < from! || day > until!)
    if (outside) throw new Error(`${id} lists ${outside}, outside the days it runs (${from} to ${until}).`)
    register[id] = { ...(about === undefined ? {} : { about }), from, until, arms }
  }
  return register
}

/** The register in the repository; an empty one when there is no file. Throws a sentence when the file is wrong. */
export async function readRegister(repoDir: string): Promise<Register> {
  const file = path.join(repoDir, REGISTER_FILE)
  const text = await readFile(file, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null
    throw error
  })
  if (text === null) return {}
  try {
    return parseRegister(text)
  } catch (error) {
    throw new Error(`${REGISTER_FILE}: ${(error as Error).message}`)
  }
}

/** Whether the test runs on `day`. */
export function runsOn(register: Register, id: string, day: string): boolean {
  const test = register[id]
  return Boolean(test) && day >= test.from && day <= test.until
}

/** The arm the register lists `day` under for the test; null when it lists it under none. */
export function listedArm(register: Register, id: string, day: string): string | null {
  const test = register[id]
  if (!test) return null
  return Object.entries(test.arms).find(([, days]) => days.includes(day))?.[0] ?? null
}

/** How a video posted on `day` opens: the opening the register lists the day under, else the hook from HOOK_FROM and the classic opening before. */
export function openingOn(day: string, register: Register): Opening {
  const listed = listedArm(register, OPENING_TEST, day)
  if (listed !== null) return listed as Opening
  return day >= HOOK_FROM ? 'hook' : 'classic'
}

/**
 * The tests a video posted on `day` with this opening belongs to, and its arm
 * in each, for its record (`SocialRecord.experiments`), so the scorecard can
 * split the posts by arm: `{ E1: 'hook' }` while E1 runs; null outside every
 * test. The arm is the opening the video really has, even when it was chosen
 * by hand against the day's.
 */
export function experimentsOn(day: string, register: Register, opening: Opening): Record<string, string> | null {
  return runsOn(register, OPENING_TEST, day) ? { [OPENING_TEST]: opening } : null
}

/**
 * The day's opening from the register in `repoDir`. A register that can't be
 * read never stops a video: the day gets the opening it would have with no
 * test, and `problem` says why, for a warning.
 */
export async function openingFor(repoDir: string, day: string): Promise<{ opening: Opening; register: Register; problem: string | null }> {
  try {
    const register = await readRegister(repoDir)
    return { opening: openingOn(day, register), register, problem: null }
  } catch (error) {
    const problem = `${(error as Error).message} The ${openingOn(day, {})} opening is used, as with no test.`
    return { opening: openingOn(day, {}), register: {}, problem }
  }
}
