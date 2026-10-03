import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { socialTapsOf } from '../src/studio/learners'
import { forgetSocialTaps, readSocialTaps, socialTapsQuery, toTapRow } from './socialTaps'

const sampleFile = fileURLToPath(new URL('./fixtures/social-taps.json', import.meta.url))
const now = Date.parse('2026-10-02T23:30:00Z')

afterEach(() => forgetSocialTaps())

/** PostHog's query endpoint, answering every query with these rows. */
function fakePostHog(results: unknown[][], calls: { url: string; body: string }[] = []) {
  return (async (url: string, init: RequestInit) => {
    calls.push({ url, body: String(init.body) })
    return new Response(JSON.stringify({ results }), { status: 200 })
  }) as unknown as typeof fetch
}

describe('social profile-link taps', () => {
  it('asks PostHog for the period’s taps, counted, and keeps a range that reaches today a minute', async () => {
    const calls: { url: string; body: string }[] = []
    const fetch = fakePostHog(
      [
        ['tiktok', 'tiktok-bio', 'human', 'tiktok', 3],
        ['tiktok', 'tiktok-bio', 'test', 'browser', '1'],
        [null, null, null, null, 0],
      ],
      calls,
    )
    const options = { apiKey: 'phx_test', fetch }
    const first = await readSocialTaps(options, '2026-10-02', '2026-10-03', now)
    expect(first).toEqual({
      rows: [
        { platform: 'tiktok', campaign: 'tiktok-bio', traffic: 'human', inApp: 'tiktok', taps: 3 },
        { platform: 'tiktok', campaign: 'tiktok-bio', traffic: 'test', inApp: 'browser', taps: 1 },
      ],
      source: 'posthog',
      problem: null,
    })
    expect(calls[0].url).toBe('https://us.posthog.com/api/projects/629055/query/')
    expect(JSON.parse(calls[0].body)).toMatchObject({ refresh: 'force_blocking', query: { kind: 'HogQLQuery' } })

    await readSocialTaps(options, '2026-10-02', '2026-10-03', now + 59_000)
    expect(calls).toHaveLength(1)
    await readSocialTaps(options, '2026-10-02', '2026-10-03', now + 61_000)
    expect(calls).toHaveLength(2)
  })

  it('counts the days in US Central, and only social_link_opened', () => {
    const query = socialTapsQuery('2026-10-01', '2026-10-03')
    expect(query).toContain("event = 'social_link_opened'")
    expect(query).toContain("timestamp >= toDateTime('2026-10-01 00:00:00', 'America/Chicago')")
    expect(query).toContain("timestamp < toDateTime('2026-10-03 00:00:00', 'America/Chicago')")
  })

  it('says what is wrong instead of asking', async () => {
    expect(await readSocialTaps({}, '2026-10-02', '2026-10-03', now)).toMatchObject({ rows: [], problem: expect.stringContaining('POSTHOG_PERSONAL_API_KEY') })
    expect(await readSocialTaps({ apiKey: 'k' }, 'today', '2026-10-03', now)).toMatchObject({ problem: expect.stringContaining('range of days') })
    expect(await readSocialTaps({ apiKey: 'k' }, '2026-01-01', '2026-10-03', now)).toMatchObject({ problem: expect.stringContaining('70 days') })
    const failing = (async () => new Response('nope', { status: 503, statusText: 'Service Unavailable' })) as unknown as typeof fetch
    expect(await readSocialTaps({ apiKey: 'k', fetch: failing }, '2026-10-02', '2026-10-03', now)).toMatchObject({
      rows: [],
      problem: expect.stringContaining('503'),
    })
  })

  it('reads a post’s link with its source, and a profile’s without', () => {
    expect(toTapRow(['youtube', 'youtube-tour-1-1', 'human', 'browser', 3, 'post', 'tour-1-1'])).toEqual({
      platform: 'youtube', campaign: 'youtube-tour-1-1', traffic: 'human', inApp: 'browser', taps: 3, link: 'post', source: 'tour-1-1',
    })
    expect(toTapRow(['tiktok', 'tiktok-bio', 'human', 'tiktok', 1, 'profile', 'none'])).toEqual({ platform: 'tiktok', campaign: 'tiktok-bio', traffic: 'human', inApp: 'tiktok', taps: 1 })
  })

  it('names a missing platform or app, and drops a row without taps', () => {
    expect(toTapRow(['', null, 'human', undefined, 2])).toEqual({ platform: 'unknown', campaign: 'none', traffic: 'human', inApp: 'unknown', taps: 2 })
    expect(toTapRow(['tiktok', 'tiktok-bio', 'human', 'tiktok', 'many'])).toBeNull()
  })

  it('sums the sample’s days', async () => {
    const both = await readSocialTaps({ sampleFile }, '2026-10-01', '2026-10-03', now)
    const first = await readSocialTaps({ sampleFile }, '2026-10-01', '2026-10-02', now)
    expect(first.rows).toEqual([{ platform: 'tiktok', campaign: 'tiktok-bio', traffic: 'test', inApp: 'browser', taps: 1 }])
    expect(both.rows.reduce((total, row) => total + row.taps, 0)).toBe(10)
    expect(both.source).toBe('sample')
  })
})

describe('socialTapsOf', () => {
  it('counts people’s taps by platform, most first, and leaves bots and tests out', () => {
    const taps = socialTapsOf([
      { platform: 'instagram', campaign: 'instagram-bio', traffic: 'human', inApp: 'instagram', taps: 2 },
      { platform: 'tiktok', campaign: 'tiktok-bio', traffic: 'human', inApp: 'browser', taps: 1 },
      { platform: 'tiktok', campaign: 'tiktok-bio', traffic: 'human', inApp: 'tiktok', taps: 3 },
      { platform: 'tiktok', campaign: 'tiktok-bio', traffic: 'test', inApp: 'browser', taps: 1 },
      { platform: 'facebook', campaign: 'facebook-page', traffic: 'bot', inApp: 'browser', taps: 2 },
      { platform: 'x', campaign: 'x-bio', traffic: 'unknown', inApp: 'browser', taps: 1 },
    ])
    expect(taps).toEqual({
      platforms: [
        { platform: 'tiktok', taps: 4, openedIn: [{ app: 'tiktok', taps: 3 }, { app: 'browser', taps: 1 }] },
        { platform: 'instagram', taps: 2, openedIn: [{ app: 'instagram', taps: 2 }] },
      ],
      taps: 6,
      posts: [],
      postTaps: 0,
      bots: 3,
      tests: 1,
    })
  })

  it('counts the taps on posts’ links by source, apart from the profiles’', () => {
    const taps = socialTapsOf([
      { platform: 'youtube', campaign: 'youtube-channel', traffic: 'human', inApp: 'browser', taps: 1 },
      { platform: 'youtube', campaign: 'youtube-tour-1-1', traffic: 'human', inApp: 'browser', taps: 4, link: 'post', source: 'tour-1-1' },
      { platform: 'facebook', campaign: 'facebook-tour-1-1', traffic: 'human', inApp: 'facebook', taps: 1, link: 'post', source: 'tour-1-1' },
      { platform: 'pinterest', campaign: 'pinterest-steps', traffic: 'human', inApp: 'pinterest', taps: 2, link: 'post', source: 'donut-pin' },
      { platform: 'youtube', campaign: 'youtube-tour-1-1', traffic: 'bot', inApp: 'browser', taps: 1, link: 'post', source: 'tour-1-1' },
    ])
    expect(taps.platforms).toEqual([{ platform: 'youtube', taps: 1, openedIn: [{ app: 'browser', taps: 1 }] }])
    expect(taps.posts).toEqual([
      { source: 'tour-1-1', taps: 5, platforms: ['facebook', 'youtube'] },
      { source: 'donut-pin', taps: 2, platforms: ['pinterest'] },
    ])
    expect([taps.taps, taps.postTaps, taps.bots]).toEqual([1, 7, 1])
  })

  it('is empty without taps', () => {
    expect(socialTapsOf([])).toEqual({ platforms: [], taps: 0, posts: [], postTaps: 0, bots: 0, tests: 0 })
  })
})
