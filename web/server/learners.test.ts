import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import {
  FORCE_FLOOR_MS,
  forgetLearners,
  historyQuery,
  learnersQuery,
  readLearnerHistory,
  readLearners,
  TODAY_MS,
  toEvent,
} from './learners'

const sampleFile = fileURLToPath(new URL('./fixtures/learners-sample.json', import.meta.url))
const now = Date.parse('2026-10-02T21:00:00Z')

afterEach(() => forgetLearners())

describe('readLearners', () => {
  it('says how to set the key up until there is one', async () => {
    const response = await readLearners({}, '2026-10-01', '2026-10-03', now)
    expect(response.configured).toBe(false)
    expect(response.problem).toContain('POSTHOG_PERSONAL_API_KEY')
    expect(response.events).toEqual([])
  })

  it('refuses a range that is not days, or is too long', async () => {
    expect((await readLearners({ sampleFile }, 'yesterday', '2026-10-03', now)).problem).toContain('range of days')
    expect((await readLearners({ sampleFile }, '2026-10-03', '2026-10-01', now)).problem).toContain('range of days')
    expect((await readLearners({ sampleFile }, '2026-01-01', '2026-10-01', now)).problem).toContain('70 days')
  })

  it('reads a sample file instead of PostHog, cut to the days asked for', async () => {
    const response = await readLearners({ sampleFile }, '2026-10-02', '2026-10-03', now)
    expect(response).toMatchObject({ configured: true, source: 'sample', problem: null })
    expect(response.events.length).toBeGreaterThan(100)
    expect(response.events.every((event) => event.at >= Date.parse('2026-10-02T05:00:00Z'))).toBe(true)
  })

  it('asks PostHog once, with the key, and keeps a day that reaches today a minute', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response(
        JSON.stringify({
          results: [
            [1790949956518, 'ob_age_answered', 'abc', '18plus', null, null, null, null, null, null, null],
            [1790949975257, 'lesson_started', 'abc', '18plus', 'pine-tree', null, null, null, null, 'False', null],
          ],
        }),
        { status: 200 },
      )
    }) as unknown as typeof fetch
    const options = { apiKey: 'phx_test', fetch: fake }

    const first = await readLearners(options, '2026-10-02', '2026-10-03', now)
    const second = await readLearners(options, '2026-10-02', '2026-10-03', now + 30_000)

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://us.posthog.com/api/projects/629055/query/')
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer phx_test')
    // Today's events are always worked out afresh, never PostHog's cached copy.
    expect(JSON.parse(String(calls[0].init.body)).refresh).toBe('force_blocking')
    expect(first).toMatchObject({ configured: true, source: 'posthog', problem: null })
    expect(first.events).toEqual([
      { at: 1790949956518, event: 'ob_age_answered', id: 'abc', age: '18plus' },
      { at: 1790949975257, event: 'lesson_started', id: 'abc', age: '18plus', lesson: 'pine-tree', ads: false },
    ])
    expect(second).toBe(first)
  })

  it('asks again after a minute for today, at once on Refresh, but not twice in 15 seconds', async () => {
    let calls = 0
    const fake = (async () => {
      calls += 1
      return new Response(JSON.stringify({ results: [] }), { status: 200 })
    }) as unknown as typeof fetch
    const options = { apiKey: 'phx_test', fetch: fake }

    await readLearners(options, '2026-10-01', '2026-10-03', now)
    await readLearners(options, '2026-10-01', '2026-10-03', now + TODAY_MS + 1)
    expect(calls).toBe(2)
    await readLearners(options, '2026-10-01', '2026-10-03', now + TODAY_MS + 5_000, true)
    expect(calls).toBe(2)
    await readLearners(options, '2026-10-01', '2026-10-03', now + TODAY_MS + FORCE_FLOOR_MS + 2, true)
    expect(calls).toBe(3)
  })

  it('keeps a week reaching today five minutes, and days that are over an hour, from PostHog’s cache', async () => {
    const bodies: { refresh: string }[] = []
    const fake = (async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)) as { refresh: string })
      return new Response(JSON.stringify({ results: [] }), { status: 200 })
    }) as unknown as typeof fetch
    const options = { apiKey: 'phx_test', fetch: fake }

    await readLearners(options, '2026-09-21', '2026-10-05', now)
    await readLearners(options, '2026-09-21', '2026-10-05', now + 4 * 60_000)
    expect(bodies).toHaveLength(1)
    await readLearners(options, '2026-09-28', '2026-09-30', now)
    await readLearners(options, '2026-09-28', '2026-09-30', now + 50 * 60_000)
    expect(bodies).toHaveLength(2)
    expect(bodies[1].refresh).toBe('blocking')
  })

  it('says what PostHog answered when it refuses', async () => {
    const fake = (async () => new Response('{"detail":"Invalid key"}', { status: 401, statusText: 'Unauthorized' })) as unknown as typeof fetch
    const response = await readLearners({ apiKey: 'phx_bad', fetch: fake }, '2026-10-02', '2026-10-03', now)
    expect(response.problem).toContain('401 Unauthorized')
    expect(response.events).toEqual([])
  })
})

describe('readLearnerHistory', () => {
  it('refuses ids that are not ids', async () => {
    expect((await readLearnerHistory({ sampleFile }, null, now)).problem).toContain('learner ids')
    expect((await readLearnerHistory({ sampleFile }, "x'); DROP", now)).problem).toContain('learner ids')
    expect((await readLearnerHistory({ sampleFile }, 'a,b,c,d,e', now)).problem).toContain('learner ids')
  })

  it('reads a learner’s events from the sample, whatever the day', async () => {
    const response = await readLearnerHistory({ sampleFile }, 'u06,u07', now)
    expect(response.source).toBe('sample')
    expect(new Set(response.events.map((event) => event.id))).toEqual(new Set(['u06', 'u07']))
  })
})

describe('the query', () => {
  it('counts days in US Central and asks only for the age question among the onboarding beats', () => {
    const query = learnersQuery('2026-10-01', '2026-10-03')
    expect(query).toContain("toDateTime('2026-10-01 00:00:00', 'America/Chicago')")
    expect(query).toContain("toDateTime('2026-10-03 00:00:00', 'America/Chicago')")
    expect(query).toContain("'lesson_completed'")
    expect(query).toContain("properties.beat = 'ob-age'")
  })

  it('leaves out debug builds, and every id that carried Apple Ads’ test payload', () => {
    const query = learnersQuery('2026-10-01', '2026-10-03')
    expect(query).toContain("coalesce(properties.build, '') != 'debug'")
    expect(query).toContain('distinct_id NOT IN (')
    expect(query).toContain('properties.asa_test_payload = true')
    expect(historyQuery(['a-1'])).toContain("coalesce(properties.build, '') != 'debug'")
  })

  it('asks for one learner’s ids, a year back', () => {
    const query = historyQuery(['33346358-aaaa', '57E6A03D-bbbb'])
    expect(query).toContain("distinct_id IN ('33346358-aaaa', '57E6A03D-bbbb')")
    expect(query).toContain('INTERVAL 365 DAY')
  })

  it('reads PostHog’s booleans whether they come as booleans or as words', () => {
    expect(toEvent([1, 'app_opened', 'x', null, null, 'True', null, null, null, true, null])).toEqual({
      at: 1,
      event: 'app_opened',
      id: 'x',
      firstOpen: true,
      ads: true,
    })
    expect(toEvent([null, 'app_opened', 'x'])).toBeNull()
  })
})
