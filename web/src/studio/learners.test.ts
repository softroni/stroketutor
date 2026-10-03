import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  adsTotal,
  withSpend,
  ageBandOf,
  isAgeBand,
  ordinal,
  paywallsOf,
  QUICK_CLOSE_MS,
  adKey,
  adOf,
  countryOf,
  isWhere,
  versionOf,
  DEFAULT_MARK_MS,
  markedChanges,
  markWords,
  noteNumbers,
  buildHistory,
  buildReport,
  compared,
  dayOf,
  endLesson,
  endWords,
  lastedFor,
  ANIMALS,
  animalsFor,
  learnerTag,
  listPrice,
  money,
  periodLabel,
  periodRange,
  spoken,
  stepPeriod,
  stitch,
  type LearnerEvent,
} from './learners'

/** Oct 1 and 2, 2026, as PostHog had them without test devices, with the ids relabeled (server/fixtures). */
const sample = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../server/fixtures/learners-sample.json', import.meta.url)), 'utf8'),
) as { events: LearnerEvent[] }
/**
 * The sample until 3:07 PM on Oct 2, when it was first taken: the day these tests describe.
 * The rest (the evening's learners, the first from an Apple Ads keyword) is in `everything`.
 */
const everything = sample.events
const events = everything.filter((event) => event.at <= Date.parse('2026-10-02T20:07:00.580Z'))
/** Long after the sample's last event, so nobody is "in the app now". */
const later = Date.parse('2026-10-03T18:00:00Z')

describe('periods', () => {
  it('counts days in US Central, where PostHog counts them', () => {
    // 4:30 AM UTC on Oct 2 is still Oct 1 in Chicago.
    expect(dayOf(Date.parse('2026-10-02T04:30:00Z'))).toBe('2026-10-01')
    expect(dayOf(Date.parse('2026-10-02T05:30:00Z'))).toBe('2026-10-02')
  })

  it('runs weeks Monday to Sunday and months from the first', () => {
    expect(periodRange('day', '2026-10-02')).toEqual({ from: '2026-10-02', to: '2026-10-03' })
    expect(periodRange('week', '2026-10-02')).toEqual({ from: '2026-09-28', to: '2026-10-05' })
    expect(periodRange('week', '2026-10-04')).toEqual({ from: '2026-09-28', to: '2026-10-05' })
    expect(periodRange('month', '2026-10-02')).toEqual({ from: '2026-10-01', to: '2026-11-01' })
    expect(periodRange('month', '2026-12-31')).toEqual({ from: '2026-12-01', to: '2027-01-01' })
  })

  it('steps a period back and on, across a change of clocks', () => {
    expect(stepPeriod('day', '2026-11-01', 1)).toBe('2026-11-02')
    expect(stepPeriod('day', '2026-11-02', -1)).toBe('2026-11-01')
    expect(stepPeriod('week', '2026-10-02', -1)).toBe('2026-09-21')
    expect(stepPeriod('month', '2026-10-15', -1)).toBe('2026-09-01')
    expect(stepPeriod('month', '2026-10-15', 1)).toBe('2026-11-01')
  })

  it('names them the way the page does', () => {
    expect(periodLabel('day', '2026-10-02')).toBe('Fri, Oct 2')
    expect(periodLabel('week', '2026-10-02')).toBe('Sep 28 – Oct 4')
    expect(periodLabel('month', '2026-10-02')).toBe('October 2026')
  })

  it('says how long things took in words', () => {
    expect(spoken(2_864)).toBe('3 s')
    expect(spoken(73_000)).toBe('1 min 13 s')
    expect(spoken(180_000)).toBe('3 min')
    expect(spoken(4_200_000)).toBe('1 h 10 min')
    expect(lastedFor(40_000)).toBe('under a minute')
    expect(lastedFor(330_000)).toBe('6 min')
    expect(compared(6, 3, 'Thu')).toBe('+3 vs Thu')
    expect(compared(2, 2, 'Thu')).toBe('same as Thu')
    expect(compared(1, 4, 'Thu')).toBe('−3 vs Thu')
  })
})

describe('stitch', () => {
  it('joins a 13+ install with the id the app moves them to at the age answer', () => {
    const learners = stitch(events)
    // The 9:05 AM install: its launch id (u06) asked the age question, its profile's (u07) answered.
    const adult = learners.find((learner) => learner.ids.includes('u07'))
    expect(adult?.ids.sort()).toEqual(['u06', 'u07'])
    // The 1:27 PM one too.
    expect(learners.find((learner) => learner.ids.includes('u09'))?.ids.sort()).toEqual(['u08', 'u09'])
    // A child keeps one id from the question to the answer: nothing to join.
    expect(learners.find((learner) => learner.ids.includes('u03'))?.ids).toEqual(['u03'])
  })

  it('counts a batch the app sent twice once', () => {
    const child = stitch(events).find((learner) => learner.ids.includes('u03'))
    const saved = child?.events.filter((event) => event.event === 'drawing_saved' && event.lesson === 'lightning-bolt')
    expect(saved).toHaveLength(1)
  })
})

describe('buildReport for Oct 2', () => {
  const report = buildReport(events, { period: 'day', date: '2026-10-02', now: later })
  const number = (key: string) => report.numbers.find((entry) => entry.key === key)

  it('has the day in numbers, against the day before', () => {
    expect(number('installs')).toMatchObject({ value: 6, previous: 1, sub: '4 under 13' })
    expect(number('sessions')).toMatchObject({ value: 7, sub: '1 returning' })
    expect(number('lessons')).toMatchObject({ value: 19, sub: '9 different' })
    expect(number('photos')).toMatchObject({ value: 7, sub: 'in 2 sessions' })
    expect(number('price')).toMatchObject({ value: 3, sub: '1 for a child' })
    expect(number('trials')).toMatchObject({ value: 0, amount: 0 })
    expect(number('buys')).toMatchObject({ value: 0, amount: 0 })
  })

  it('follows the day’s installs through the journey, children and 13+ apart', () => {
    expect(report.journey.map((stage) => [stage.key, stage.children, stage.teens])).toEqual([
      ['installed', 4, 2],
      ['onboarded', 4, 2],
      ['first', 3, 2],
      ['second', 2, 1],
      ['price', 1, 2],
      ['bought', 0, 0],
    ])
  })

  it('lists what was drawn most, ties by name', () => {
    expect(report.mostDrawn.slice(0, 5)).toEqual([
      { lesson: 'cloud', count: 4 },
      { lesson: 'sun', count: 4 },
      { lesson: 'watermelon-slice', count: 4 },
      { lesson: 'lightning-bolt', count: 2 },
      { lesson: 'apple', count: 1 },
    ])
  })

  it('lists every session newest first, each with where it ended', () => {
    expect(report.sessions).toHaveLength(7)
    expect(report.days).toEqual([])
    const ends = report.sessions.map((session) => [endWords(session.end), endLesson(session.end)])
    expect(ends).toEqual([
      ['Left at the grown-up’s paywall', null],
      ['Left at the paywall after 2 s', null],
      ['Stopped in', 'cactus'],
      ['Stopped in', 'hot-air-balloon'],
      ['Left after keeping', 'cloud'],
      ['Stopped in', 'pine-tree'],
      ['Left after', 'watermelon-slice'],
    ])
  })

  it('opens the 9:05 AM install as a timeline in words', () => {
    const session = report.sessions.find((entry) => entry.end.kind === 'stopped' && endLesson(entry.end) === 'cactus')
    expect(session).toMatchObject({ isNew: true, age: '18plus', child: false, finished: 2, returns: [] })
    expect(session?.items.map((item) => item.kind)).toEqual(['onboarding', 'lesson', 'price', 'lesson', 'lesson'])
    expect(session?.timeline.map((line) => line.text)).toEqual([
      'Opened the app for the first time',
      'Reached the age question',
      'Chose 18+ for their age',
      'Finished onboarding',
      'Started',
      'Finished it in 1 min 13 s',
      'Saw the sketchbook tour',
      'Saw “More coming”',
      'Paywall opened',
      'Closed the paywall after 3 s',
      'Started',
      'Finished it in 2 min 59 s',
      'Started',
    ])
    expect(lastedFor(session?.activeMs ?? 0)).toBe('5 min')
  })

  it('marks the under-6 who came back in the afternoon, and what they kept and wished for', () => {
    const session = report.sessions.find((entry) => entry.age === 'under6')
    expect(session?.returns).toHaveLength(1)
    expect(session?.finished).toBe(8)
    const kinds = session?.items.map((item) => (item.kind === 'lesson' ? `${item.lesson}:${item.state}${item.kept ? '+kept' : ''}` : item.kind))
    expect(kinds).toEqual([
      'onboarding',
      'sun:finished+kept',
      'grownUp',
      'cloud:finished',
      'sun:finished',
      'cloud:finished',
      'lightning-bolt:left',
      'sun:finished',
      'cloud:finished+kept',
      'lightning-bolt:finished',
      'crown',
      'crown',
      'lightning-bolt:finished+kept',
      'crown',
      'wish',
      'later',
      'pine-tree:started',
    ])
  })

  it('shows a learner still drawing as drawing now', () => {
    const afternoon = buildReport(events, { period: 'day', date: '2026-10-02', now: Date.parse('2026-10-02T18:52:00Z') })
    const child = afternoon.sessions.find((entry) => entry.age === 'under6')
    expect(child?.end).toEqual({ kind: 'drawingNow', lesson: 'pine-tree' })
  })

  it('narrows to children or 13+', () => {
    const children = buildReport(events, { period: 'day', date: '2026-10-02', who: 'children', now: later })
    const teens = buildReport(events, { period: 'day', date: '2026-10-02', who: 'teens', now: later })
    expect(children.sessions).toHaveLength(5)
    expect(teens.sessions).toHaveLength(2)
    expect(teens.numbers.find((entry) => entry.key === 'price')?.sub).toBe('all 13+')
  })

  it('ranks who drew most: lessons, then photos kept, then time', () => {
    expect(report.leaders.map((session) => [session.key, session.finished, session.kept])).toEqual([
      ['u03', 8, 3],
      ['u04', 4, 4],
      ['u02', 3, 0],
      ['u07', 2, 0],
      ['u10', 1, 0],
      ['u09', 1, 0],
    ])
  })

  it('narrows to the learners who finished one lesson', () => {
    const cloud = buildReport(events, { period: 'day', date: '2026-10-02', lesson: 'cloud', now: later })
    expect(cloud.sessions.map((session) => session.key).sort()).toEqual(['u03', 'u04'])
    expect(cloud.leaders.map((session) => session.key)).toEqual(['u03', 'u04'])
    expect(cloud.numbers.find((entry) => entry.key === 'installs')?.value).toBe(1)
    expect(cloud.mostDrawn.find((drawn) => drawn.lesson === 'cloud')?.count).toBe(4)
    expect(buildReport(events, { period: 'day', date: '2026-10-02', lesson: 'rocket', now: later }).sessions).toEqual([])
  })

  it('narrows to those a number counts, and keeps the numbers as they are', () => {
    const price = buildReport(events, { period: 'day', date: '2026-10-02', only: 'price', now: later })
    expect(price.sessions.map((session) => session.key).sort()).toEqual(['u07', 'u09', 'u10'])
    expect(price.numbers).toEqual(report.numbers)
    expect(price.journey).toEqual(report.journey)
    const photos = buildReport(events, { period: 'day', date: '2026-10-02', only: 'photos', now: later })
    expect(photos.leaders.map((session) => session.key)).toEqual(['u03', 'u04'])
    expect(buildReport(events, { period: 'day', date: '2026-10-02', only: 'installs', now: later }).sessions).toHaveLength(6)
    expect(buildReport(events, { period: 'day', date: '2026-10-02', only: 'buys', now: later }).sessions).toEqual([])
  })

  it('gives every learner an animal, the same wherever they appear, whatever the page is narrowed to', () => {
    const animal = (list: { key: string; animal?: { name: string } }[], key: string) => list.find((session) => session.key === key)?.animal?.name
    const names = new Set(report.sessions.map((session) => session.animal?.name))
    expect(names.size).toBe(7)
    const cloud = buildReport(events, { period: 'day', date: '2026-10-02', lesson: 'cloud', now: later })
    const teens = buildReport(events, { period: 'day', date: '2026-10-02', who: 'teens', now: later })
    expect(animal(cloud.leaders, 'u03')).toBe(animal(report.sessions, 'u03'))
    expect(animal(teens.sessions, 'u07')).toBe(animal(report.sessions, 'u07'))
    // Children take the animals in order; the first child to open the app is the Fox.
    expect(animal(report.sessions, 'u02')).toBe('Fox')
  })

  it('keeps a 13+ learner’s animal from day to day, and numbers a second round', () => {
    const today = animalsFor([{ key: 'u07', child: false }, { key: 'kid', child: true }])
    const another = animalsFor([{ key: 'x', child: true }, { key: 'y', child: true }, { key: 'u07', child: false }])
    expect(another.get('u07')).toEqual(today.get('u07'))
    const crowd = animalsFor(Array.from({ length: ANIMALS.length + 1 }, (_, index) => ({ key: `c${index}`, child: true })))
    expect(crowd.get(`c${ANIMALS.length}`)?.name).toBe('Fox 2')
    const colors = [...report.sessions].sort((a, b) => a.start - b.start).map((session) => session.color)
    expect(colors).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('follows the journey: who reached a stage, and who stopped there', () => {
    expect(report.journey.map((stage) => [stage.key, stage.stopped])).toEqual([
      ['installed', 0],
      ['onboarded', 1],
      ['first', 2],
      ['second', 2],
      ['price', 3],
      ['bought', 0],
    ])
    const stoppedFirst = buildReport(events, { period: 'day', date: '2026-10-02', only: 'stopped-first', now: later })
    expect(stoppedFirst.sessions.map((session) => session.key).sort()).toEqual(['u09', 'u10'])
    const reachedSecond = buildReport(events, { period: 'day', date: '2026-10-02', only: 'reached-second', now: later })
    expect(reachedSecond.sessions.map((session) => session.key).sort()).toEqual(['u02', 'u03', 'u07'])
    expect(stoppedFirst.journey).toEqual(report.journey)
  })

  it('tags a 13+ learner so they can be told apart across days, and never a child', () => {
    const adult = report.sessions.find((session) => session.key === 'u07')
    const child = report.sessions.find((session) => session.key === 'u03')
    expect(adult && learnerTag(adult)).toBe('#U07')
    expect(child && learnerTag(child)).toBeNull()
  })
})

describe('purchases', () => {
  // A 13+ learner on Oct 3: a free week of the yearly plan, then, a day later, someone else buys a week.
  const at = Date.parse('2026-10-03T15:00:00Z')
  const learner = (id: string, start: number): LearnerEvent[] => [
    { at: start, event: 'app_opened', id, firstOpen: true },
    { at: start + 1_000, event: 'ob_age_answered', id, age: '18plus' },
  ]
  const bought: LearnerEvent[] = [
    ...learner('trialer', at),
    { at: at + 60_000, event: 'superwall_paywall_open', id: 'trialer', age: '18plus' },
    { at: at + 70_000, event: 'purchase_attempted', id: 'trialer', age: '18plus', plan: 'yearly', outcome: 'purchased' },
    { at: at + 71_000, event: 'offer_screen_viewed', id: 'trialer', age: '18plus', screen: 'trial_started' },
    ...learner('payer', at + 3_600_000),
    { at: at + 3_660_000, event: 'purchase_attempted', id: 'payer', age: '18plus', plan: 'weekly', outcome: 'purchased' },
    ...learner('restorer', at + 7_200_000),
    { at: at + 7_260_000, event: 'purchase_attempted', id: 'restorer', age: '18plus', plan: 'restore', outcome: 'restored' },
  ]
  const report = buildReport(bought, { period: 'day', date: '2026-10-03', now: at + 86_400_000 })
  const number = (key: string) => report.numbers.find((entry) => entry.key === key)

  it('tells a free week from a plan paid for, at the day’s list price, and never counts a restore', () => {
    expect(number('trials')).toMatchObject({ value: 1, amount: 29.99, sub: 'a year, if kept' })
    expect(number('buys')).toMatchObject({ value: 1, amount: 3.99, sub: 'at US list price' })
    const trialer = report.sessions.find((session) => session.key === 'trialer')
    expect(trialer?.end).toEqual({ kind: 'bought', trial: true })
    expect(endWords(trialer!.end)).toBe('Started a free week')
    expect(report.journey.find((stage) => stage.key === 'bought')).toMatchObject({ teens: 2 })
  })

  it('joins a free week announced before its purchase', () => {
    const early: LearnerEvent[] = [
      ...learner('quick', at),
      { at: at + 10_000, event: 'superwall_free_trial_start', id: 'quick', age: '18plus' },
      { at: at + 11_000, event: 'purchase_attempted', id: 'quick', age: '18plus', plan: 'yearly', outcome: 'purchased' },
    ]
    const quick = buildReport(early, { period: 'day', date: '2026-10-03', now: at + 86_400_000 })
    expect(quick.numbers.find((entry) => entry.key === 'trials')?.value).toBe(1)
    expect(quick.numbers.find((entry) => entry.key === 'buys')?.value).toBe(0)
  })

  it('prices plans as they were on the day', () => {
    expect(listPrice('yearly', Date.parse('2026-10-01T15:00:00Z'))).toBe(19.99)
    expect(listPrice('yearly', at)).toBe(29.99)
    expect(listPrice('weekly', at)).toBe(3.99)
    expect(listPrice('lifetime', at)).toBe(99.99)
    expect(listPrice('com.example.other', at)).toBeNull()
    expect(money(1049.5)).toBe('$1,049.50')
  })
})

describe('buildHistory', () => {
  it('lays out a 13+ learner’s days, from both their ids', () => {
    const theirs = events.filter((event) => event.id === 'u06' || event.id === 'u07')
    const history = buildHistory(theirs, later)
    expect(history).toMatchObject({ visits: 1, finished: 2, kept: 0, prices: 1, bought: false })
    expect(history?.installedAt).toBe(theirs.find((event) => event.firstOpen)?.at)
    expect(history?.days.map((entry) => entry.day)).toEqual(['2026-10-02'])
    expect(history?.days[0].session.ids.sort()).toEqual(['u06', 'u07'])
    expect(buildHistory([], later)).toBeNull()
  })
})

describe('buildReport for a week', () => {
  it('turns the session list into one column per day', () => {
    const report = buildReport(events, { period: 'week', date: '2026-10-02', now: later })
    expect(report.sessions).toEqual([])
    expect(report.days.map((day) => day.day)).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ])
    expect(report.days.find((day) => day.day === '2026-10-02')).toMatchObject({ installs: 6, lessons: 19, top: 'cloud' })
    // Oct 1's one real install left during onboarding; the rest of that day was test devices.
    expect(report.days.find((day) => day.day === '2026-10-01')).toMatchObject({ installs: 1, lessons: 0, top: null })
  })
})

describe('numbers that changed', () => {
  const at = Date.parse('2026-10-02T21:00:00Z')
  const numbers = (lessons: number, photos = 2) => [
    { key: 'lessons', value: lessons },
    { key: 'photos', value: photos },
  ]

  it('marks nothing the first time a view is seen, or while nothing moves', () => {
    const first = noteNumbers(undefined, numbers(19), at)
    expect(first.changes).toEqual({})
    expect(noteNumbers(first, numbers(19), at + 60_000).changes).toEqual({})
  })

  it('marks a number that moved, between the two looks, for five minutes', () => {
    const first = noteNumbers(undefined, numbers(19), at)
    const second = noteNumbers(first, numbers(21), at + 60_000)
    expect(second.changes).toEqual({ lessons: { from: 19, to: 21, since: at, at: at + 60_000 } })
    // Still marked a minute on, though it has not moved since…
    const third = noteNumbers(second, numbers(21), at + 120_000)
    expect(third.changes.lessons).toEqual(second.changes.lessons)
    expect(markedChanges(third.changes, at + 60_000 + DEFAULT_MARK_MS - 1)).toHaveProperty('lessons')
    // …and no longer five minutes after it moved.
    expect(markedChanges(third.changes, at + 60_000 + DEFAULT_MARK_MS)).toEqual({})
  })

  it('marks for as long as was picked, and remembers a change an hour for a longer pick', () => {
    const first = noteNumbers(undefined, numbers(19), at)
    const second = noteNumbers(first, numbers(21), at + 60_000, 60_000)
    expect(markedChanges(second.changes, at + 90_000, 60_000)).toHaveProperty('lessons')
    expect(markedChanges(second.changes, at + 120_000, 60_000)).toEqual({})
    // Ten minutes on, picking half an hour still shows it…
    const later = noteNumbers(second, numbers(21), at + 11 * 60_000, 60_000)
    expect(markedChanges(later.changes, at + 11 * 60_000, 30 * 60_000)).toHaveProperty('lessons')
    // …but a move after the minute starts again from where it was.
    expect(noteNumbers(later, numbers(22), at + 12 * 60_000, 60_000).changes.lessons).toMatchObject({ from: 21, to: 22 })
    expect(noteNumbers(later, numbers(21), at + 62 * 60_000).changes).toEqual({})
    expect([60_000, 5 * 60_000, 60 * 60_000].map(markWords)).toEqual(['1 min', '5 min', '1 hour'])
  })

  it('keeps where a number started when it moves again, and lets go when it comes back', () => {
    const first = noteNumbers(undefined, numbers(19), at)
    const second = noteNumbers(first, numbers(20), at + 60_000)
    const third = noteNumbers(second, numbers(22, 3), at + 120_000)
    expect(third.changes).toEqual({
      lessons: { from: 19, to: 22, since: at, at: at + 120_000 },
      photos: { from: 2, to: 3, since: at + 60_000, at: at + 120_000 },
    })
    expect(noteNumbers(third, numbers(19, 3), at + 180_000).changes).toEqual({ photos: third.changes.photos })
  })

  it('marks what moved while the page was away, since it last looked', () => {
    const morning = noteNumbers(undefined, numbers(4), at - 3 * 3_600_000)
    expect(noteNumbers(morning, numbers(19), at).changes.lessons).toEqual({ from: 4, to: 19, since: at - 3 * 3_600_000, at })
  })
})

describe('where learners came from', () => {
  const evening = buildReport(everything, { period: 'day', date: '2026-10-02', now: later })

  it('names the Apple Ads keyword that brought a learner, from Apple’s answer before their age', () => {
    // u11 is the launch before the age question, u12 the 16-to-17 learner it became.
    const fromAds = evening.sessions.find((session) => session.ad)
    expect(fromAds).toMatchObject({
      ids: ['u11', 'u12'],
      age: '16to17',
      source: 'ads',
      ad: { campaign: '2144789293', adGroup: '2151492291', keyword: '2339019453' },
      country: 'US',
      version: '1.0',
    })
    expect(evening.sessions.filter((session) => session.ad)).toHaveLength(1)
  })

  it('counts learners by keyword, organic, country and version, and narrows to one', () => {
    expect(evening.whereFrom.ads).toEqual([
      expect.objectContaining({ key: 'keyword-2339019453', learners: 1, finished: 1, sawPrice: 1, bought: 0 }),
    ])
    expect(evening.whereFrom.organic.learners).toBe(evening.sessions.length - 1)
    // Only Apple's answer says a country, until the app sends the phone's Region.
    expect(evening.whereFrom.countries.map((row) => [row.key, row.learners])).toEqual([
      ['country-unknown', evening.sessions.length - 1],
      ['country-US', 1],
    ])
    expect(evening.whereFrom.versions.map((row) => [row.key, row.learners])).toEqual([['version-1.0', evening.sessions.length]])

    const keyword = buildReport(everything, { period: 'day', date: '2026-10-02', where: 'keyword-2339019453', now: later })
    expect(keyword.sessions.map((session) => session.key)).toEqual(['u12'])
    expect(keyword.numbers.find((number) => number.key === 'installs')).toMatchObject({ value: 1 })
    // Where from stays whole, so another row is one tap away.
    expect(keyword.whereFrom).toEqual(evening.whereFrom)
    const campaign = buildReport(everything, { period: 'day', date: '2026-10-02', where: 'campaign-2144789293', now: later })
    expect(campaign.sessions.map((session) => session.key)).toEqual(['u12'])
    const organic = buildReport(everything, { period: 'day', date: '2026-10-02', where: 'organic', now: later })
    expect(organic.sessions).toHaveLength(evening.sessions.length - 1)
    expect(buildReport(everything, { period: 'day', date: '2026-10-02', where: 'version-1.1', now: later }).sessions).toEqual([])
  })

  it('reads the phone’s Region before the ad’s storefront, and the latest version', () => {
    const at = Date.parse('2026-10-03T15:00:00Z')
    const learner: LearnerEvent[] = [
      { at, event: 'install_attributed', id: 'x', ads: true, campaign: '1', keyword: '2', adsRegion: 'US', version: '1.0' },
      { at: at + 1, event: 'app_opened', id: 'x', region: 'GB', version: '1.2' },
    ]
    expect(countryOf(learner)).toBe('GB')
    expect(countryOf(learner.slice(0, 1))).toBe('US')
    expect(versionOf(learner)).toBe('1.2')
    expect(adOf(learner)).toEqual({ campaign: '1', adGroup: null, keyword: '2' })
    expect(adKey({ campaign: '1', adGroup: null, keyword: null })).toBe('campaign-1')
    expect(adOf([{ at, event: 'install_attributed', id: 'x', ads: false }])).toBeNull()
  })

  it('takes only the narrowings it knows from the address', () => {
    for (const good of ['keyword-2339019453', 'campaign-1', 'organic', 'country-US', 'country-unknown', 'version-1.0', 'version-unknown']) {
      expect(isWhere(good)).toBe(true)
    }
    for (const bad of ['keyword-', 'keyword-abc', 'country-usa', 'version-1.0.0.0.0', "organic'"]) expect(isWhere(bad)).toBe(false)
  })
})

describe('at the paywall', () => {
  const evening = buildReport(everything, { period: 'day', date: '2026-10-02', now: later })

  it('counts Superwall’s paywall by test version and where it was asked for', () => {
    expect(evening.paywalls.rows.map((row) => [row.placement, row.variant, row.opens, row.quickCloses, row.tappedBuy, row.bought])).toEqual([
      ['onboarding_offer', '643125', 1, 1, 0, 0],
      ['onboarding_offer', '643126', 1, 0, 0, 0],
      ['onboarding_offer', '643129', 1, 1, 0, 0],
      ['settings_premium', '643130', 1, 0, 0, 0],
    ])
    // Paywall 1 after onboarding was closed in 2.9 s; Flow 1 was still open when the sample ends.
    expect(evening.paywalls.rows[0].medianLookMs).toBeLessThan(QUICK_CLOSE_MS)
    expect(evening.paywalls.rows[1].medianLookMs).toBeNull()
  })

  it('follows the children’s way to the grown-ups’ paywall', () => {
    expect(evening.paywalls.grownUps).toMatchObject({ met: 3, triedCheck: 3, passed: 1, bought: 0 })
    expect(evening.paywalls.grownUps.triedAgain).toBeGreaterThanOrEqual(2)
    expect(evening.paywalls.grownUps.entries[0]).toEqual({ entry: 'onboarding', learners: 3 })
    const tries = evening.sessions.flatMap((session) => session.timeline).filter((line) => line.text.startsWith('Saw the grown-ups’ check again'))
    expect(tries.map((line) => line.text)).toContain('Saw the grown-ups’ check again (3rd time)')
  })

  it('marks a buy tapped and cancelled on the paywall it came from, and a purchase on the last one before it', () => {
    const at = Date.parse('2026-10-03T15:00:00Z')
    const paywall = { placement: 'onboarding_offer', paywall: 'new-flow-7f9d-2026-09-26', variant: '643126' }
    const learner = (id: string, rest: Omit<LearnerEvent, 'id' | 'at'>[]): LearnerEvent[] =>
      rest.map((event, index) => ({ ...event, id, at: at + index * 1_000, age: '18plus' }))
    const events = [
      ...learner('a', [
        { event: 'app_opened', firstOpen: true },
        { event: 'superwall_paywall_open', ...paywall },
        { event: 'superwall_transaction_start', ...paywall },
        { event: 'purchase_attempted', plan: 'yearly', outcome: 'cancelled' },
        { event: 'superwall_transaction_abandon', ...paywall },
        { event: 'superwall_paywall_close', ...paywall },
      ]),
      ...learner('b', [
        { event: 'app_opened', firstOpen: true },
        { event: 'superwall_paywall_open', ...paywall },
        { event: 'superwall_transaction_start', ...paywall },
        { event: 'purchase_attempted', plan: 'weekly', outcome: 'purchased' },
        { event: 'superwall_transaction_complete', ...paywall },
      ]),
    ]
    const report = buildReport(events, { period: 'day', date: '2026-10-03', now: at + 3_600_000 })
    expect(report.paywalls.rows).toEqual([
      expect.objectContaining({ variant: '643126', opens: 2, learners: 2, tappedBuy: 2, cancelled: 1, bought: 1, quickCloses: 1 }),
    ])
    const opened = report.sessions.find((session) => session.key === 'a')!.timeline
    expect(opened.find((line) => line.text === 'Paywall opened')?.shown).toMatchObject({ variant: '643126', tappedBuy: true, cancelled: true })
    expect(opened.map((line) => line.text)).toContain('Tapped buy: Apple’s payment sheet came up')
    expect(paywallsOf([]).rows).toEqual([])
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd'])
  })
})

describe('ages', () => {
  const evening = buildReport(everything, { period: 'day', date: '2026-10-02', now: later })

  it('counts the day’s learners by age band, the six bands always, the rest when someone is in them', () => {
    expect(evening.ages.map((row) => row.age)).toEqual(['under6', '6to9', '10to12', '13to15', '16to17', '18plus'])
    expect(evening.ages.reduce((sum, row) => sum + row.learners, 0)).toBe(evening.sessions.length)
    expect(evening.ages.find((row) => row.age === '16to17')).toMatchObject({ learners: 2, sawPrice: 2 })
    expect(ageBandOf([{ at: 1, event: 'ob_age_answered', id: 'x', age: 'unanswered' }])).toBe('none')
    expect(isAgeBand('18plus') && !isAgeBand('adult')).toBe(true)
  })

  it('narrows to 18 and over, and to one band', () => {
    const adults = buildReport(everything, { period: 'day', date: '2026-10-02', who: 'adults', now: later })
    expect(adults.sessions.every((session) => session.age === '18plus')).toBe(true)
    expect(adults.sessions).toHaveLength(evening.ages.find((row) => row.age === '18plus')!.learners)
    const sixToNine = buildReport(everything, { period: 'day', date: '2026-10-02', age: '6to9', now: later })
    expect(sixToNine.sessions.every((session) => session.age === '6to9')).toBe(true)
    expect(sixToNine.numbers.find((number) => number.key === 'sessions')!.value).toBe(sixToNine.sessions.length)
    // The chart stays whole, so another band is a tap away; Where from follows the band.
    expect(sixToNine.ages).toEqual(evening.ages)
    expect(sixToNine.whereFrom.organic.learners).toBe(sixToNine.sessions.length)
  })

  it('follows a keyword: the ages it brought', () => {
    const keyword = buildReport(everything, { period: 'day', date: '2026-10-02', where: 'keyword-2339019453', now: later })
    expect(keyword.ages.filter((row) => row.learners).map((row) => [row.age, row.learners])).toEqual([['16to17', 1]])
  })
})

describe('Apple Ads spend beside its learners', () => {
  const evening = buildReport(everything, { period: 'day', date: '2026-10-02', now: later })
  const spend = [
    { key: 'keyword-2339019453', campaign: '2144789293', adGroup: '2151492291', keyword: '2339019453', spend: 2.44, impressions: 11, taps: 1, installs: 1 },
    { key: 'keyword-2334871441', campaign: '2144789293', adGroup: '2151492291', keyword: '2334871441', spend: 1.9, impressions: 9, taps: 2, installs: 0 },
    { key: 'keyword-1', campaign: '2144789293', adGroup: '2151492291', keyword: '1', spend: 0, impressions: 30, taps: 0, installs: 0 },
  ]

  it('puts each keyword’s spend beside the learners it brought, then the keywords that brought nobody', () => {
    const rows = withSpend(evening.whereFrom.ads, spend)
    expect(rows.map((row) => [row.key, row.learners, row.spend?.spend])).toEqual([
      ['keyword-2339019453', 1, 2.44],
      ['keyword-2334871441', 0, 1.9],
    ])
    expect(adsTotal(rows)).toEqual({ spend: 4.34, taps: 3, installs: 1, learners: 1, sawPrice: 1, bought: 0 })
  })
})
