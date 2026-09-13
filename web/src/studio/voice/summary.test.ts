import { describe, expect, it } from 'vitest'

import type { AppLineNarration, StepNarration } from '../../voice/types'

import {
  appLinesNeedingWork,
  appPublishBlocker,
  describeStale,
  narrationHeadline,
  publishBlocker,
  stepsNeedingWork,
  summariseSteps,
} from './summary'

const step = (stepId: string, stale: StepNarration['stale']): StepNarration => ({
  stepId,
  title: stepId,
  instruction: 'Draw a line.',
  spokenLine: null,
  text: 'Draw a line.',
  take: stale === 'missing' ? null : { id: `take-${stepId}`, voiceId: 'lina-bright', text: 'Draw a line.', textHash: 'h', durationMs: 7040, createdAt: '2026-09-13T10:00:00.000Z' },
  stale,
})

const steps = [
  step('s1', null),
  step('s2', null),
  step('s3', 'missing'),
  step('s4', 'text-changed'),
  step('s5', 'voice-changed'),
]

describe('summariseSteps', () => {
  it('counts each kind of staleness', () => {
    expect(summariseSteps(steps)).toEqual({
      total: 5,
      ready: 2,
      missing: 1,
      textChanged: 1,
      voiceChanged: 1,
      needsWork: 3,
    })
  })

  it('says nothing is wrong with an empty lesson', () => {
    expect(summariseSteps([])).toMatchObject({ total: 0, ready: 0, needsWork: 0 })
  })
})

describe('stepsNeedingWork', () => {
  it('lists everything to make, in speaking order', () => {
    expect(stepsNeedingWork(steps)).toEqual(['s3', 's4', 's5'])
  })

  it('is empty when the lesson is fully recorded', () => {
    expect(stepsNeedingWork([step('s1', null)])).toEqual([])
  })
})

describe('describeStale', () => {
  it('names each state', () => {
    expect(describeStale(null)).toEqual({ label: 'Ready', tone: 'ready' })
    expect(describeStale('missing')).toEqual({ label: 'Not yet', tone: 'todo' })
    expect(describeStale('text-changed')).toEqual({ label: 'Words changed', tone: 'changed' })
    expect(describeStale('voice-changed')).toEqual({ label: 'Voice changed', tone: 'changed' })
  })
})

describe('narrationHeadline', () => {
  it('celebrates a finished lesson without fuss', () => {
    expect(narrationHeadline(summariseSteps([step('s1', null)]))).toBe('All 1 step recorded in the cast voice.')
  })

  it('says exactly what is left', () => {
    expect(narrationHeadline(summariseSteps(steps))).toBe(
      '2 of 5 steps ready · 1 not made yet, 1 with words changed, 1 in an older voice.',
    )
  })
})

describe('publishBlocker', () => {
  const summary = summariseSteps([step('s1', null)])

  it('asks for a cast voice before anything else', () => {
    expect(publishBlocker({ summary, lessonPublished: true, castVoiceId: null })).toBe('Cast a voice as Lina first.')
  })

  it('wants the lesson published first', () => {
    expect(publishBlocker({ summary, lessonPublished: false, castVoiceId: 'lina-bright' })).toMatch(
      /Publish the lesson itself/,
    )
  })

  it('counts what is still to make', () => {
    expect(
      publishBlocker({ summary: summariseSteps(steps), lessonPublished: true, castVoiceId: 'lina-bright' }),
    ).toBe('3 steps still to make. Publishing takes the whole lesson at once.')
  })

  it('is clear when publishing is ready', () => {
    expect(publishBlocker({ summary, lessonPublished: true, castVoiceId: 'lina-bright' })).toBeNull()
  })
})

const appLine = (id: string, stale: AppLineNarration['stale']): AppLineNarration => ({
  id: id as AppLineNarration['id'],
  where: `Where ${id} plays`,
  text: 'Something short.',
  take: null,
  stale,
})

describe('Lina’s own lines', () => {
  const lines = [appLine('hello', null), appLine('lesson-1', 'missing'), appLine('path-1', 'text-changed')]

  it('lists the ones to record, by their app ids', () => {
    expect(appLinesNeedingWork(lines)).toEqual(['lesson-1', 'path-1'])
    expect(appLinesNeedingWork([appLine('hello', null)])).toEqual([])
  })

  it('counts lines, not steps, in the headline', () => {
    expect(narrationHeadline(summariseSteps(lines), 'line')).toBe(
      '1 of 3 lines ready · 1 not made yet, 1 with words changed.',
    )
    expect(narrationHeadline(summariseSteps([appLine('hello', null)]), 'line')).toBe(
      'All 1 line recorded in the cast voice.',
    )
  })

  it('blocks publishing on the cast voice, then on what is left to make', () => {
    expect(appPublishBlocker({ summary: summariseSteps(lines), castVoiceId: null })).toBe(
      'Cast a voice as Lina first.',
    )
    expect(appPublishBlocker({ summary: summariseSteps(lines), castVoiceId: 'lina-bright' })).toBe(
      '2 lines still to make. Publishing takes all of them at once.',
    )
    expect(
      appPublishBlocker({ summary: summariseSteps([appLine('hello', null)]), castVoiceId: 'lina-bright' }),
    ).toBeNull()
  })
})
