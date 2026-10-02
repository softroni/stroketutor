import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  buildReport,
  compared,
  dayOf,
  endLesson,
  endWords,
  lastedFor,
  periodLabel,
  periodRange,
  spoken,
  stepPeriod,
  stitch,
  type LearnerEvent,
} from './learners'

/** Oct 1 and 2, 2026, as PostHog had them, with the ids relabeled (server/fixtures). */
const sample = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../server/fixtures/learners-sample.json', import.meta.url)), 'utf8'),
) as { events: LearnerEvent[] }
const events = sample.events
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
    // The 9:05 AM install: its launch id (u18) asked the age question, its profile's (u19) answered.
    const adult = learners.find((learner) => learner.ids.includes('u19'))
    expect(adult?.ids.sort()).toEqual(['u18', 'u19'])
    // The 1:27 PM one too.
    expect(learners.find((learner) => learner.ids.includes('u21'))?.ids.sort()).toEqual(['u20', 'u21'])
    // A child keeps one id from the question to the answer: nothing to join.
    expect(learners.find((learner) => learner.ids.includes('u15'))?.ids).toEqual(['u15'])
  })

  it('counts a batch the app sent twice once', () => {
    const child = stitch(events).find((learner) => learner.ids.includes('u15'))
    const saved = child?.events.filter((event) => event.event === 'drawing_saved' && event.lesson === 'lightning-bolt')
    expect(saved).toHaveLength(1)
  })
})

describe('buildReport for Oct 2', () => {
  const report = buildReport(events, { period: 'day', date: '2026-10-02', now: later })
  const number = (key: string) => report.numbers.find((entry) => entry.key === key)

  it('has the day in numbers, against the day before', () => {
    expect(number('installs')).toMatchObject({ value: 6, previous: 3, sub: '4 under 13' })
    expect(number('sessions')).toMatchObject({ value: 8, sub: '2 returning' })
    expect(number('lessons')).toMatchObject({ value: 19, sub: '9 different' })
    expect(number('photos')).toMatchObject({ value: 7, sub: 'in 2 sessions' })
    expect(number('price')).toMatchObject({ value: 3, sub: '1 for a child' })
    expect(number('bought')).toMatchObject({ value: 0, sub: 'none yet' })
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
    expect(report.sessions).toHaveLength(8)
    expect(report.days).toEqual([])
    const ends = report.sessions.map((session) => [endWords(session.end), endLesson(session.end)])
    expect(ends).toEqual([
      ['Left at the grown-up’s paywall', null],
      ['Left at the paywall after 2 s', null],
      ['Stopped in', 'cactus'],
      ['Opened, nothing else', null],
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
    expect(children.sessions).toHaveLength(6)
    expect(teens.sessions).toHaveLength(2)
    expect(teens.numbers.find((entry) => entry.key === 'price')?.sub).toBe('all 13+')
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
    expect(report.days.find((day) => day.day === '2026-10-01')).toMatchObject({ installs: 3 })
  })
})
