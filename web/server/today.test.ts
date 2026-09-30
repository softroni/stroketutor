import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  ago,
  comingUp,
  dayLabel,
  fewestOpens,
  friendlyPeriod,
  groupByDay,
  groupWork,
  isStale,
  lasted,
  leadingVariant,
  logKind,
  normalizeStatus,
  perOpen,
  releaseStation,
  stripDays,
  toneWord,
  until,
  waited,
  weekOverWeek,
  type AppBuild,
  type TodayExperiment,
} from '../src/studio/today'

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

    writeFileSync(path.join(dir, 'status.json'), JSON.stringify({ updated: 'this morning', headline: 'a date that does not read' }))
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
    expect([status?.numbers, status?.working, status?.log, status?.experiments, status?.links, status?.upcoming]).toEqual([
      [],
      [],
      [],
      [],
      [],
      [],
    ])
    expect([status?.ads, status?.reviews, status?.next, status?.funnel]).toEqual([null, null, null, null])
  })

  it('keeps a funnel only when it has steps', () => {
    const base = { updated: '2026-10-01T08:00:00-05:00', headline: 'x' }
    expect(normalizeStatus({ ...base, funnel: { period: 'last 7 days', steps: [] } })?.funnel).toBeNull()
    expect(normalizeStatus({ ...base, funnel: { period: 'last 7 days' } })?.funnel).toBeNull()
    const funnel = { period: 'last 7 days', steps: [{ label: 'First open', value: 9 }] }
    expect(normalizeStatus({ ...base, funnel })?.funnel).toEqual(funnel)
  })

  it('counts what Claude logged each day, by the day it was written, skipping a line that is not an entry', async () => {
    writeFileSync(
      path.join(dir, 'log.jsonl'),
      [
        { at: '2026-09-29T13:15:35-05:00', text: 'Daily check' },
        { at: '2026-09-30T13:57:31-05:00', text: 'Apple approved 1.0 (2)' },
        'not json',
        { text: 'no date' },
        { at: '2026-09-30T23:59:00-05:00', text: 'Late' },
      ]
        .map((line) => (typeof line === 'string' ? line : JSON.stringify(line)))
        .join('\n'),
    )
    expect((await readToday(dir)).activity).toEqual([
      { day: '2026-09-29', value: 1 },
      { day: '2026-09-30', value: 2 },
    ])
  })

  it('has no activity before anything is logged', async () => {
    expect((await readToday(dir)).activity).toEqual([])
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

describe('the Today page, worked out', () => {
  const build = (fields: Partial<AppBuild>): AppBuild => ({
    version: '1.1',
    build: '4',
    state: 'Waiting for review',
    tone: 'waiting',
    since: null,
    ...fields,
  })

  it('puts a version at its station by App Store Connect code, or by its words in older statuses', () => {
    expect(releaseStation(build({ code: 'WAITING_FOR_REVIEW' }), 0)).toBe(1)
    expect(releaseStation(build({ code: 'IN_REVIEW', state: 'In review' }), 0)).toBe(2)
    expect(releaseStation(build({ code: 'METADATA_REJECTED', state: 'Metadata rejected', tone: 'bad' }), 0)).toBe(2)
    expect(releaseStation(build({ code: 'PENDING_DEVELOPER_RELEASE' }), 0)).toBe(3)
    expect(releaseStation(build({ code: 'READY_FOR_DISTRIBUTION', state: 'On sale' }), 0)).toBe(4)
    // Written before the code was kept: the words decide.
    expect(releaseStation(build({ state: 'Being prepared' }), 4)).toBe(0)
    expect(releaseStation(build({ state: 'Waiting for review' }), 4)).toBe(1)
    expect(releaseStation(build({ state: 'Rejected' }), 4)).toBe(2)
    expect(releaseStation(build({ state: 'Approved, waiting to be released' }), 4)).toBe(3)
    expect(releaseStation(build({ state: 'On sale' }), 0)).toBe(4)
    expect(releaseStation(build({ state: 'Something new', code: 'SOMETHING_NEW' }), 1)).toBe(1)
  })

  it('shows two weeks of days at most, every calendar day, gaps included, up to today', () => {
    expect(stripDays([], '2026-09-30')).toEqual([])
    expect(stripDays(['2026-09-29', '2026-09-27'], '2026-09-30')).toEqual(['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30'])
    const month = Array.from({ length: 30 }, (_, index) => `2026-09-${String(index + 1).padStart(2, '0')}`).reverse()
    const shown = stripDays(month, '2026-09-30')
    expect(shown).toHaveLength(14)
    expect([shown[0], shown[13]]).toEqual(['2026-09-17', '2026-09-30'])
    // Across a month's end.
    expect(stripDays(['2026-10-01', '2026-09-30'], '2026-10-01')).toEqual(['2026-09-30', '2026-10-01'])
  })

  it('groups the log by the day each entry was written, newest first as given', () => {
    const groups = groupByDay([
      { at: '2026-09-30T16:29:16-05:00', text: 'c' },
      { at: '2026-09-30T13:57:31-05:00', text: 'b' },
      { at: '2026-09-29T13:15:35-05:00', text: 'a' },
    ])
    expect(groups.map((group) => [group.day, group.entries.map((entry) => entry.text)])).toEqual([
      ['2026-09-30', ['c', 'b']],
      ['2026-09-29', ['a']],
    ])
  })

  it('says days and durations the way a person would', () => {
    const now = new Date(2026, 8, 30, 17, 0)
    expect(dayLabel('2026-09-30', now)).toBe('Today')
    expect(dayLabel('2026-09-29', now)).toBe('Yesterday')
    expect(dayLabel('2026-10-01', now)).toBe('Tomorrow')
    expect(dayLabel('2026-09-28', now)).toBe('Mon, Sep 28')
    expect(dayLabel('garbage', now)).toBe('garbage')
    expect(waited('2026-09-30', now)).toBe('new today')
    expect(waited('2026-09-29', now)).toBe('since yesterday')
    expect(waited('2026-09-25', now)).toBe('5 days')
    expect(friendlyPeriod('on 2026-09-29')).toBe('Sep 29')
    expect(friendlyPeriod('since 27 Sep')).toBe('since 27 Sep')
    const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString()
    expect(lasted(hoursAgo(0.5), now)).toBe('30 min')
    expect(lasted(hoursAgo(5), now)).toBe('5 h')
    expect(lasted(hoursAgo(48), now)).toBe('2 days')
    expect(until(hoursAgo(-15), now)).toBe('in 15 h')
    expect(until(hoursAgo(1), now)).toBe('now')
  })

  it('compares the last seven days with the seven before, only with a fortnight to compare', () => {
    const series = (values: number[]) => values.map((value, index) => ({ day: `2026-09-${String(index + 10).padStart(2, '0')}`, value }))
    expect(weekOverWeek(undefined)).toBeNull()
    expect(weekOverWeek(series([1, 2, 3]))).toBeNull()
    expect(weekOverWeek(series([1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2]))).toEqual({ last: 14, before: 7 })
    expect(weekOverWeek(series([0.1, 0.2, 0, 0, 0, 0, 0, 0.1, 0.2, 0, 0, 0, 0, 0]))).toEqual({ last: 0.3, before: 0.3 })
  })

  it('knows how far a paywall test is from a decision, and who leads', () => {
    const test = (variants: TodayExperiment['variants']): TodayExperiment => ({ name: 'T', placement: 'p', status: 'running', variants })
    const quiet = test([
      { name: 'A', share: 50 },
      { name: 'B', share: 50 },
    ])
    expect(fewestOpens(quiet)).toBe(0)
    expect(leadingVariant(quiet)).toBeNull()
    const busy = test([
      { name: 'A', share: 34, opens: 121, purchases: 2 },
      { name: 'B', share: 33, opens: 117, purchases: 3 },
      { name: 'C', share: 33, opens: 124, purchases: 6 },
    ])
    expect(fewestOpens(busy)).toBe(117)
    expect(leadingVariant(busy)).toBe('C')
    expect(perOpen(6, 124)).toBeCloseTo(0.0484, 4)
    expect(perOpen(1, 0)).toBeNull()
    // No purchase anywhere, or a tie at the top, is no lead.
    expect(leadingVariant(test([{ name: 'A', share: 50, opens: 40, purchases: 0 }, { name: 'B', share: 50, opens: 40, purchases: 0 }]))).toBeNull()
    expect(leadingVariant(test([{ name: 'A', share: 50, opens: 40, purchases: 2 }, { name: 'B', share: 50, opens: 40, purchases: 2 }]))).toBeNull()
  })

  it('reads what a log line is about from its opening words, and takes the kind the writer gave', () => {
    const kind = (text: string, given?: string) => logKind({ at: '2026-09-30T12:00:00-05:00', text, kind: given })
    expect(kind('Apple approved 1.0 (2); Paper Coach is on the App Store (READY_FOR_DISTRIBUTION)')).toBe('release')
    expect(kind("Submitted 1.1 (4) with Premium Lifetime (Kevin's go-ahead)")).toBe('release')
    expect(kind('1.1 in App Store Connect (Prepare for Submission): text, keywords')).toBe('release')
    expect(kind('Tagged afa25bc as 1.0(2) and pushed the tag')).toBe('release')
    expect(kind('Daily check: 1.0 (2) still waiting for review; no reviews')).toBe('check')
    expect(kind('Apple Ads: 4 campaigns live, US, $10 a day')).toBe('ads')
    expect(kind('Lesson videos: layout moved clear of YouTube')).toBe('social')
    expect(kind('Social: lesson videos now post through Upload-Post')).toBe('social')
    expect(kind('Lifetime added to Superwall (product 679735)')).toBe('tests')
    expect(kind('Onboarding test: Flow 2 leads')).toBe('tests')
    expect(kind('Built next-builds item 1 on main (508ec63)')).toBe('build')
    expect(kind('Prices: $29.99/year and $3.99/week for new subscribers from Oct 2')).toBe('money')
    expect(kind('First real learner: onboarding finished, then a Pine Tree drawing')).toBe('learners')
    expect(kind('Replied to 3 reviews')).toBe('review')
    expect(kind('Took over Paper Coach operations')).toBe('other')
    expect(kind('Took over Paper Coach operations', 'release')).toBe('release')
    expect(kind('Something', 'not-a-kind')).toBe('other')
  })

  it('gathers the work list by state, in a fixed order, with anything else last', () => {
    const groups = groupWork([
      { title: 'a', state: 'next' },
      { title: 'b', state: 'waiting' },
      { title: 'c', state: 'running' },
      { title: 'd', state: 'doing' },
      { title: 'e' },
      { title: 'f', state: 'blocked' as never },
    ])
    expect(groups.map((group) => [group.label, group.items.map((item) => item.title)])).toEqual([
      ['Running', ['c', 'd']],
      ['Waiting', ['b']],
      ['Next', ['a']],
      ['Other', ['e', 'f']],
    ])
  })

  it('lists what is coming soonest first, the next look included, and nothing already past', () => {
    const status = normalizeStatus({
      updated: '2026-09-30T16:00:00-05:00',
      headline: 'x',
      next: { at: '2026-10-01T08:00:00-05:00', what: 'Daily check' },
      upcoming: [
        { at: '2026-10-02', what: 'Prices rise' },
        { at: '2026-09-29', what: 'Past' },
        { at: '2026-09-30', what: 'Today' },
        { at: 'whenever', what: 'Unreadable' },
      ],
    })!
    const now = new Date('2026-09-30T17:00:00-05:00')
    expect(comingUp(status, now).map((event) => event.what)).toEqual(['Today', 'Daily check', 'Prices rise'])
  })
})
