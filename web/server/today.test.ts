import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ago, isStale, normalizeStatus, toneWord } from '../src/studio/today'

import { readToday } from './today'

describe('the Today page', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'studio-today-'))
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('says so when Claude has written nothing yet', async () => {
    const today = await readToday(dir)
    expect(today.status).toBeNull()
    expect(today.problem).toMatch(/has not written a status/)
  })

  it('refuses a file that is not JSON, or has no date or headline', async () => {
    writeFileSync(path.join(dir, 'status.json'), '{ not json')
    expect((await readToday(dir)).problem).toMatch(/not valid JSON/)

    writeFileSync(path.join(dir, 'status.json'), JSON.stringify({ headline: 'no date' }))
    expect((await readToday(dir)).problem).toMatch(/no date or headline/)
  })

  it('reads a partial status with every list present and every missing part null', async () => {
    writeFileSync(
      path.join(dir, 'status.json'),
      JSON.stringify({
        updated: '2026-09-27T08:00:00-05:00',
        headline: '1.0 is waiting for review.',
        app: { inReview: { version: '1.0', build: '2', state: 'Waiting for review', tone: 'waiting', since: null } },
        needsYou: [{ title: 'Add Crash Data to App Privacy' }],
      }),
    )

    const { status, problem } = await readToday(dir)

    expect(problem).toBeNull()
    expect(status?.app).toEqual({
      live: null,
      inReview: { version: '1.0', build: '2', state: 'Waiting for review', tone: 'waiting', since: null },
    })
    expect(status?.needsYou).toEqual([{ title: 'Add Crash Data to App Privacy' }])
    expect([status?.numbers, status?.working, status?.log, status?.experiments, status?.links]).toEqual([[], [], [], [], []])
    expect([status?.ads, status?.reviews, status?.next]).toEqual([null, null, null])
  })

  it('keeps every past day, newest first, and shows any one of them', async () => {
    mkdirSync(path.join(dir, 'history'))
    for (const day of ['2026-09-27', '2026-09-29', '2026-09-28']) {
      writeFileSync(path.join(dir, 'history', `${day}.json`), JSON.stringify({ updated: `${day}T23:00:00-05:00`, headline: day }))
    }
    writeFileSync(path.join(dir, 'history', 'README.md'), '# not a day')
    writeFileSync(path.join(dir, 'history', 'log.jsonl'), '')

    const past = await readToday(dir, '2026-09-28')
    expect(past.days).toEqual(['2026-09-29', '2026-09-28', '2026-09-27'])
    expect(past.day).toBe('2026-09-28')
    expect(past.status?.headline).toBe('2026-09-28')

    expect((await readToday(dir, '2026-09-01')).problem).toBe('Nothing was kept for 2026-09-01.')
    expect((await readToday(dir, '../status')).problem).toMatch(/is not a day/)
  })

  it('calls a status stale after 30 hours', () => {
    const status = normalizeStatus({ updated: '2026-09-27T08:00:00Z', headline: 'x' })!
    expect(isStale(status, new Date('2026-09-28T13:59:00Z'))).toBe(false)
    expect(isStale(status, new Date('2026-09-28T14:01:00Z'))).toBe(true)
    expect(isStale({ ...status, updated: 'whenever' })).toBe(true)
  })

  it('says how long ago in words', () => {
    const now = new Date('2026-09-27T12:00:00Z')
    expect(ago('2026-09-27T11:59:50Z', now)).toBe('just now')
    expect(ago('2026-09-27T11:30:00Z', now)).toBe('30 min ago')
    expect(ago('2026-09-27T07:00:00Z', now)).toBe('5 h ago')
    expect(ago('2026-09-24T12:00:00Z', now)).toBe('3 days ago')
    expect(ago('whenever', now)).toBe('at an unknown time')
  })

  it('gives every tone but neutral a word, so a state never rests on color', () => {
    expect(['good', 'waiting', 'attention', 'bad'].map((tone) => toneWord(tone as never))).toEqual([
      'Good',
      'Waiting',
      'Needs a look',
      'Problem',
    ])
    expect(toneWord('neutral')).toBe('')
  })
})
