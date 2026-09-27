import { promises as fs } from 'node:fs'
import path from 'node:path'

import { DAY, normalizeStatus, type TodayResponse } from '../src/studio/today'

/**
 * The Today page's data, from `opsDir` (`.studio/ops`), where Claude writes with
 * `docs/ops/today.py`: `status.json` is the latest, and `history/YYYY-MM-DD.json`
 * each day as it stood at its end (a worktree of the branch `ops-history`, never
 * deleted). Read on every request, so a new status shows as soon as it is
 * written. Read-only: nothing here writes.
 */
export async function readToday(opsDir: string, day: string | null = null): Promise<TodayResponse> {
  const days = await listDays(opsDir)
  if (day !== null && !DAY.test(day)) {
    return { status: null, problem: `${day} is not a day (YYYY-MM-DD).`, day: null, days }
  }
  const file = day ? path.join(opsDir, 'history', `${day}.json`) : path.join(opsDir, 'status.json')
  let text: string
  try {
    text = await fs.readFile(file, 'utf8')
  } catch {
    const problem = day
      ? `Nothing was kept for ${day}.`
      : 'Claude has not written a status yet (.studio/ops/status.json).'
    return { status: null, problem, day, days }
  }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { status: null, problem: 'The status file is not valid JSON. Claude rewrites it on the next run.', day, days }
  }
  const status = normalizeStatus(raw)
  return status
    ? { status, problem: null, day, days }
    : { status: null, problem: 'The status file has no date or headline. Claude rewrites it on the next run.', day, days }
}

/** The days in the history, newest first. */
async function listDays(opsDir: string): Promise<string[]> {
  const names = await fs.readdir(path.join(opsDir, 'history')).catch(() => [] as string[])
  return names
    .filter((name) => name.endsWith('.json') && DAY.test(name.slice(0, -5)))
    .map((name) => name.slice(0, -5))
    .sort()
    .reverse()
}
