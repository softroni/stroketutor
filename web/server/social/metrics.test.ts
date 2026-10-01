import { describe, expect, it } from 'vitest'

import {
  audienceRange,
  bioLinkTaps,
  breakoutsOn,
  followersOf,
  isMonday,
  judgedAge,
  lastAudienceRange,
  median,
  metricsKey,
  metricsSummary,
  pinterestClicks,
  postLines,
  postsToSnapshot,
  profileViewsPerThousand,
  publishedPosts,
  readingAt,
  scorecard,
  stillWatchingAt,
  summariseAcquisition,
  type AccountMetricsRecord,
  type MetricsRecord,
  type PostMetricsRecord,
  type PublishedPost,
} from './metrics'
import { platformLink, type SocialRecord } from './posts'

const HOUR = 3_600_000
const NOW = Date.parse('2026-10-12T22:45:00Z') // a Monday, 17:45 Central
const hoursAgo = (hours: number) => new Date(NOW - hours * HOUR).toISOString()

/** A reading of one post on one platform, `age` hours after it went out at `wentOut` hours ago. */
const reading = (requestId: string, platform: string, wentOut: number, age: number, metrics: Record<string, unknown>, lessonId = requestId): PostMetricsRecord => ({
  kind: 'post',
  at: hoursAgo(wentOut - age),
  requestId,
  lessonId,
  media: 'video',
  purpose: 'lesson',
  platform,
  ageHours: age,
  metrics,
})

const account = (platform: string, at: string, metrics: Record<string, unknown>, source: AccountMetricsRecord['source'] = 'analytics'): AccountMetricsRecord => ({ kind: 'account', at, platform, source, metrics })

const posted = (requestId: string, wentOut: number, platforms: string[]): PublishedPost => ({ requestId, lessonId: requestId, media: 'video', purpose: 'lesson', at: hoursAgo(wentOut), platforms })

describe('one shape for every platform’s numbers', () => {
  it('counts Threads’ and X’s replies as comments and Pinterest’s reactions as likes', () => {
    expect(metricsSummary({ views: 12, likes: 1, replies: 3, reposts: 0 })).toEqual({ views: 12, likes: 1, comments: 3 })
    expect(metricsSummary({ impressions: 3, likes: 0, replies: 2 })).toEqual({ views: 3, likes: 0, comments: 2 })
    expect(metricsSummary({ impressions: 40, saves: 2, reactions: 5, comments: 0, outbound_clicks: 1 })).toEqual({ views: 40, likes: 5, comments: 0 })
    expect(metricsSummary({})).toEqual({ views: null, likes: null, comments: null })
  })

  it('gives a pin its own address, not the App Store link it leads to', () => {
    expect(platformLink('pinterest', 'https://apps.apple.com/app/apple-store/id6816231257?pt=1&ct=pinterest&mt=8', '989806824387717196')).toBe('https://www.pinterest.com/pin/989806824387717196/')
    expect(platformLink('pinterest', 'https://www.pinterest.com/pin/42/', '42')).toBe('https://www.pinterest.com/pin/42/')
  })
})

describe('what a snapshot reads', () => {
  const records: SocialRecord[] = [
    { kind: 'post', at: hoursAgo(30), lessonId: 'pine-tree', profile: 'softroni', platforms: ['tiktok', 'pinterest', 'x'], private: false, requestId: 'video', outcome: 'sent' },
    { kind: 'status', at: hoursAgo(29), requestId: 'video', status: 'completed', results: { tiktok: { success: true }, pinterest: { success: true }, x: { success: false, error: 'cap' } } },
    { kind: 'post', at: hoursAgo(30), lessonId: 'pine-tree', profile: 'softroni', platforms: ['pinterest'], private: false, requestId: 'pin', scheduledAt: hoursAgo(26), media: 'pin', outcome: 'sent' },
    { kind: 'status', at: hoursAgo(25), requestId: 'pin', status: 'completed', results: { pinterest: { success: true } } },
    { kind: 'post', at: hoursAgo(20), lessonId: 'pine-tree', profile: 'softroni', platforms: ['youtube'], private: true, requestId: 'test', outcome: 'sent' },
    { kind: 'status', at: hoursAgo(19), requestId: 'test', status: 'completed', results: { youtube: { success: true } } },
    { kind: 'post', at: hoursAgo(500), lessonId: 'sun', profile: 'softroni', platforms: ['tiktok'], private: false, requestId: 'old', outcome: 'sent' },
    { kind: 'status', at: hoursAgo(499), requestId: 'old', status: 'completed', results: { tiktok: { success: true } } },
    { kind: 'post', at: hoursAgo(2), lessonId: 'donut', profile: 'softroni', platforms: ['tiktok'], private: false, requestId: 'busy', outcome: 'sent' },
  ]

  it('takes public posts that finished, where they went out, timed when they went out', () => {
    const posts = publishedPosts(records)
    expect(posts.map((post) => post.requestId)).toEqual(['old', 'pin', 'video'])
    expect(posts.find((post) => post.requestId === 'video')?.platforms).toEqual(['tiktok', 'pinterest'])
    expect(posts.find((post) => post.requestId === 'pin')).toMatchObject({ media: 'pin', at: hoursAgo(26) })
  })

  it('reads posts up to 15 days old every day, and every post when told to (Mondays)', () => {
    const posts = publishedPosts(records)
    expect(postsToSnapshot(posts, NOW, false).map((post) => [post.requestId, post.ageHours])).toEqual([
      ['pin', 26],
      ['video', 30],
    ])
    expect(postsToSnapshot(posts, NOW, true).map((post) => post.requestId)).toEqual(['pin', 'video', 'old'])
    expect(isMonday(NOW)).toBe(true)
    // 01:00 UTC on Tuesday is still Monday evening in Central.
    expect(isMonday(Date.parse('2026-10-13T01:00:00Z'))).toBe(true)
    expect(isMonday(Date.parse('2026-10-13T12:00:00Z'))).toBe(false)
  })

  it('keeps a line per platform with numbers or a reason there are none, and every number as given', () => {
    const tiktok = { views: 41, retention: [{ second: '3', percentage: 0.17 }], impression_sources: [{ impression_source: 'For You', percentage: 1 }] }
    const lines = postLines({ ...posted('video', 30, ['tiktok']), ageHours: 30 }, { tiktok: { raw: tiktok, error: null }, instagram: { raw: {}, error: 'Token expired' }, x: { raw: {}, error: null } }, hoursAgo(0))
    expect(lines).toEqual([
      { kind: 'post', at: hoursAgo(0), requestId: 'video', lessonId: 'video', media: 'video', purpose: 'lesson', platform: 'tiktok', ageHours: 30, metrics: tiktok },
      expect.objectContaining({ platform: 'instagram', metrics: {}, error: 'Token expired' }),
    ])
    expect(metricsKey(lines[0])).toBe(`post|${hoursAgo(0)}|video|tiktok`)
  })

  it('asks TikTok for the days after the last it read, so no day is counted twice', () => {
    expect(audienceRange(null, '2026-10-11')).toEqual({ start: '2026-10-05', end: '2026-10-11' })
    expect(audienceRange({ start: '2026-10-05', end: '2026-10-09' }, '2026-10-11')).toEqual({ start: '2026-10-10', end: '2026-10-11' })
    // Read again the same day: the same days.
    expect(audienceRange({ start: '2026-10-10', end: '2026-10-11' }, '2026-10-11')).toEqual({ start: '2026-10-10', end: '2026-10-11' })
    // Never more than TikTok's 60 days.
    expect(audienceRange({ start: '2026-01-01', end: '2026-01-02' }, '2026-10-11')).toEqual({ start: '2026-08-13', end: '2026-10-11' })
    const lines: MetricsRecord[] = [
      account('tiktok', hoursAgo(48), { range: { start_date: '2026-10-04', end_date: '2026-10-10' } }, 'audience'),
      account('tiktok', hoursAgo(24), { followers: 3 }),
    ]
    expect(lastAudienceRange(lines)).toEqual({ start: '2026-10-04', end: '2026-10-10' })
  })
})

describe('the scorecard’s numbers', () => {
  it('judges a post at 72 hours, YouTube at 7 days and Pinterest at 14', () => {
    expect([judgedAge('tiktok'), judgedAge('youtube'), judgedAge('pinterest')]).toEqual([72, 168, 336])
  })

  it('takes the first reading at or after the age, never one from days later', () => {
    const lines = [24.75, 48.75, 72.75, 96.75].map((age) => reading('a', 'tiktok', 100, age, { views: age }))
    expect(readingAt(lines, 72)?.ageHours).toBe(72.75)
    expect(readingAt(lines.filter((line) => line.ageHours !== 72.75), 72)?.ageHours).toBe(96.75)
    expect(readingAt([reading('a', 'tiktok', 200, 120.75, { views: 1 })], 72)).toBeNull()
  })

  it('takes medians, not means', () => {
    expect(median([])).toBeNull()
    expect(median([3, 1000, 2])).toBe(3)
    expect(median([1, 2, 3, 10])).toBe(2.5)
  })

  it('reads TikTok’s hold at 3 s from its retention, and profile views per 1,000 views', () => {
    const raw = { views: 400, profile_views: 2, retention: [{ second: '0', percentage: 1 }, { second: '3', percentage: 0.17 }] }
    expect(stillWatchingAt(raw)).toBe(0.17)
    expect(stillWatchingAt({ views: 3 })).toBeNull()
    expect(profileViewsPerThousand(raw)).toBe(5)
    expect(profileViewsPerThousand({ views: 0, profile_views: 0 })).toBeNull()
  })

  it('counts Pinterest’s outbound clicks of the window, over every pin, however old', () => {
    const byPost = new Map([
      // Out before the window: 4 clicks before it, 10 by its end.
      ['old', [reading('old', 'pinterest', 900, 700, { outbound_clicks: 4 }), reading('old', 'pinterest', 900, 890, { outbound_clicks: 10 })]],
      // Out in the window: every click counts.
      ['new', [reading('new', 'pinterest', 50, 2, { outbound_clicks: 1 }), reading('new', 'pinterest', 50, 48, { outbound_clicks: 3 })]],
      // Never read in the window.
      ['gone', [reading('gone', 'pinterest', 900, 600, { outbound_clicks: 9 })]],
    ])
    const published = new Map([
      ['old', { at: NOW - 900 * HOUR }],
      ['new', { at: NOW - 50 * HOUR }],
      ['gone', { at: NOW - 900 * HOUR }],
    ])
    expect(pinterestClicks(byPost, published, NOW - 7 * 24 * HOUR, NOW)).toEqual({ count: 9, pins: 2 })
    expect(pinterestClicks(new Map(), published, NOW - 7 * 24 * HOUR, NOW)).toEqual({ count: null, pins: 0 })
  })

  it('opens the week at last Monday’s reading even when it ran a little late, so an old pin’s clicks count once', () => {
    // An old pin is read on Mondays only: two weeks ago, last Monday 40 minutes after this week's window opened,
    // and now. Its week is 9 - 5, not the two weeks since 2.
    const lines = [
      reading('old', 'pinterest', 2000, 2000 - 336.1, { outbound_clicks: 2 }),
      reading('old', 'pinterest', 2000, 2000 - 167.3, { outbound_clicks: 5 }),
      reading('old', 'pinterest', 2000, 2000 - 0.05, { outbound_clicks: 9 }),
    ]
    expect(pinterestClicks(new Map([['old', lines]]), new Map([['old', { at: NOW - 2000 * HOUR }]]), NOW - 168 * HOUR, NOW)).toEqual({ count: 4, pins: 1 })
    // Followers likewise, from the reading nearest the window's start.
    const followers = [account('x', hoursAgo(191), { followers: 2 }), account('x', hoursAgo(167.3), { followers: 5 }), account('x', hoursAgo(0.05), { followers: 9 })]
    expect(followersOf(followers, NOW - 168 * HOUR)).toEqual({ now: 9, change: 4 })
  })

  it('adds up TikTok’s bio-link taps over the days read, each day once, the latest reading of the same days winning', () => {
    const audience = (at: number, start: string, end: string, clicks: number | null) =>
      account('tiktok', hoursAgo(at), { range: { start_date: start, end_date: end }, profile_actions: { bio_link_clicks: clicks } }, 'audience')
    const lines = [
      audience(200, '2026-09-28', '2026-10-04', 2),
      audience(100, '2026-10-05', '2026-10-07', 1),
      audience(99, '2026-10-05', '2026-10-07', 3),
      audience(24, '2026-10-08', '2026-10-11', 4),
    ]
    expect(bioLinkTaps(lines, '2026-10-05', '2026-10-12')).toEqual({ count: 7, range: { start: '2026-10-05', end: '2026-10-11' } })
    expect(bioLinkTaps([audience(1, '2026-10-05', '2026-10-11', null)], '2026-10-05', '2026-10-12')).toEqual({ count: null, range: { start: '2026-10-05', end: '2026-10-11' } })
  })

  it('gives followers now and since the window began', () => {
    const lines = [account('x', hoursAgo(300), { followers: 2 }), account('x', hoursAgo(170), { followers: 5 }), account('x', hoursAgo(1), { followers: 9 })]
    expect(followersOf(lines, NOW - 168 * HOUR)).toEqual({ now: 9, change: 4 })
    expect(followersOf([account('x', hoursAgo(1), { followers: 9 })], NOW - 168 * HOUR)).toEqual({ now: 9, change: null })
    expect(followersOf([], NOW)).toEqual({ now: null, change: null })
  })

  it('calls a breakout at 5× the 14 posts before it, at the same age, and 1,000 views', () => {
    const published = new Map<string, { at: number; lessonId: string; media: 'video' }>()
    const byPost = new Map<string, PostMetricsRecord[]>()
    const add = (id: string, wentOut: number, views: number) => {
      published.set(id, { at: NOW - wentOut * HOUR, lessonId: id, media: 'video' })
      byPost.set(id, [reading(id, 'tiktok', wentOut, 48.75, { views })])
    }
    for (let day = 0; day < 15; day += 1) add(`earlier-${day}`, 400 + day * 24, 200 + day)
    add('hit', 60, 1500)
    add('busy-but-small', 59, 900)
    expect(breakoutsOn(byPost, published, NOW - 168 * HOUR, NOW)).toEqual([
      { requestId: 'hit', lessonId: 'hit', media: 'video', views: 1500, ageHours: 48.75, baseline: 206.5, baselinePosts: 14 },
    ])
    // 5× a median of 400 is 2,000: 1,500 isn't a breakout.
    for (const [id, lines] of byPost) if (id.startsWith('earlier')) lines[0].metrics = { views: 400 }
    expect(breakoutsOn(byPost, published, NOW - 168 * HOUR, NOW)).toEqual([])
  })

  it('judges a breakout by its last reading with views, not a later one that only says why there are none', () => {
    const published = new Map<string, { at: number; lessonId: string; media: 'video' }>()
    const byPost = new Map<string, PostMetricsRecord[]>()
    for (let day = 0; day < 5; day += 1) {
      published.set(`earlier-${day}`, { at: NOW - (400 + day * 24) * HOUR, lessonId: `earlier-${day}`, media: 'video' })
      byPost.set(`earlier-${day}`, [reading(`earlier-${day}`, 'tiktok', 400 + day * 24, 48.75, { views: 100 })])
    }
    published.set('hit', { at: NOW - 80 * HOUR, lessonId: 'hit', media: 'video' })
    byPost.set('hit', [reading('hit', 'tiktok', 80, 48.75, { views: 3000 }), { ...reading('hit', 'tiktok', 80, 72.75, {}), error: 'The token may need to be refreshed.' }])
    expect(breakoutsOn(byPost, published, NOW - 168 * HOUR, NOW)).toMatchObject([{ requestId: 'hit', views: 3000, ageHours: 48.75, baseline: 100 }])
  })
})

describe('the scorecard', () => {
  const posts = [posted('a', 100, ['tiktok', 'youtube']), posted('b', 76, ['tiktok']), posted('c', 30, ['tiktok', 'pinterest'])]
  const records: MetricsRecord[] = [
    reading('a', 'tiktok', 100, 72.75, { views: 40, profile_views: 0, retention: [{ second: '3', percentage: 0.2 }] }),
    reading('a', 'tiktok', 100, 96.75, { views: 400, profile_views: 4 }),
    reading('b', 'tiktok', 76, 72.75, { views: 60, profile_views: 3, retention: [{ second: '3', percentage: 0.1 }] }),
    reading('a', 'youtube', 100, 96.75, { views: 2 }),
    reading('c', 'pinterest', 30, 6, { impressions: 0, outbound_clicks: 0, reactions: 0 }),
    reading('c', 'pinterest', 30, 29, { impressions: 10, outbound_clicks: 2, reactions: 1 }),
    account('tiktok', hoursAgo(200), { followers: 1 }),
    account('tiktok', hoursAgo(1), { followers: 6 }),
    account('instagram', hoursAgo(1), { followers: 0, profile_links_taps: 1 }),
    account('threads', hoursAgo(1), { followers: 0, link_clicks: [{ url: 'https://softroni.com/th/papercoach', clicks: 1 }, { url: 'https://apps.apple.com/…ct=threads', clicks: 2 }] }),
    account('tiktok', hoursAgo(1), { range: { start_date: '2026-10-05', end_date: '2026-10-11' }, profile_actions: { bio_link_clicks: 3 } }, 'audience'),
  ]

  it('gives each platform its posts, views at its age, hold, taps, followers', () => {
    const card = scorecard({ records, posts, now: NOW, days: 7 })
    expect(card.platforms.map((score) => score.platform)).toEqual(['pinterest', 'tiktok', 'youtube', 'instagram', 'threads'])
    const tiktok = card.platforms.find((score) => score.platform === 'tiktok')!
    expect(tiktok).toMatchObject({
      posts: 3,
      views: { ageHours: 72, median: 50, posts: 2, tooYoung: 1 },
      stillWatching3s: { median: expect.closeTo(0.15, 5), posts: 2 },
      profileViewsPer1000: { median: 25, posts: 2 },
      taps: { what: 'bio-link taps', count: 3, note: '2026-10-05 to 2026-10-11' },
      followers: { now: 6, change: 5 },
      breakouts: [],
      appStore: null,
    })
    expect(card.platforms.find((score) => score.platform === 'youtube')?.views).toEqual({ ageHours: 168, median: null, posts: 0, tooYoung: 1 })
    expect(card.platforms.find((score) => score.platform === 'pinterest')).toMatchObject({ views: { ageHours: 336, median: null, tooYoung: 1 }, taps: { count: 2, note: '1 pin read' } })
    expect(card.platforms.find((score) => score.platform === 'instagram')?.taps).toEqual({ what: 'bio-link taps', count: 1, note: 'latest account reading' })
    expect(card.platforms.find((score) => score.platform === 'threads')?.taps).toEqual({ what: 'link clicks', count: 3, note: 'latest account reading' })
    // Readings 27, 24, 3 and 1 hours ago; the one 200 hours ago is before the window.
    expect(card.snapshots).toBe(4)
  })

  it('passes over a line that only says why a platform had no numbers', () => {
    // Read at 72.75 h with a token to refresh, then at 96.75 h: the later reading is its 72-hour one.
    const lines: MetricsRecord[] = [
      { ...reading('a', 'tiktok', 100, 72.75, {}), error: 'The token may need to be refreshed.' },
      reading('a', 'tiktok', 100, 96.75, { views: 400, profile_views: 4 }),
    ]
    expect(scorecard({ records: lines, posts: [posted('a', 100, ['tiktok'])], now: NOW, days: 7 }).platforms[0].views).toEqual({ ageHours: 72, median: 400, posts: 1, tooYoung: 0 })
  })

  /** A period of the acquisition pull, as `.studio/ops/acquisition.json` keeps it. */
  const period = (date: string, end: string, extra: Record<string, unknown> = {}) => ({
    date,
    end,
    total: { pageViews: 20, getTaps: 8, firstDownloads: 9, redownloads: 0 },
    sourceTypes: [
      { sourceType: 'App Store search', pageViews: 6, firstDownloads: 4 },
      { sourceType: 'App referrer', pageViews: 14, firstDownloads: 5 },
    ],
    hidden: { firstDownloads: { standard: 9, detailed: 6, hidden: 3, share: 0.33 } },
    campaigns: [],
    platforms: [],
    ...extra,
  })

  it('adds App Store Connect’s numbers per platform, a platform with no row as <5', () => {
    const acquisition = {
      periods: {
        DAILY: [
          period('2026-10-06', '2026-10-06', { platforms: [{ platform: 'tiktok', pageViews: 12, firstDownloads: 5 }] }),
          period('2026-10-07', '2026-10-07', { platforms: [{ platform: 'tiktok', pageViews: 3, firstDownloads: null }, { platform: 'pinterest', pageViews: 7, firstDownloads: 6 }] }),
          period('2026-09-01', '2026-09-01', { platforms: [{ platform: 'threads', pageViews: 50, firstDownloads: 9 }] }),
        ],
        WEEKLY: [],
      },
    }
    const card = scorecard({ records, posts, now: NOW, days: 7, acquisition })
    expect(card.acquisition).toMatchObject({
      granularity: 'DAILY',
      covered: { start: '2026-10-06', end: '2026-10-07' },
      total: { pageViews: 40, firstDownloads: 18 },
      sources: [
        { source: 'App referrer', firstDownloads: 10 },
        { source: 'App Store search', firstDownloads: 8 },
      ],
      hidden: { firstDownloads: 6, of: 18 },
    })
    expect(card.platforms.find((score) => score.platform === 'tiktok')?.appStore).toEqual({ pageViews: 15, firstDownloads: '5+' })
    expect(card.platforms.find((score) => score.platform === 'pinterest')?.appStore).toEqual({ pageViews: '7+', firstDownloads: '6+' })
    expect(card.platforms.find((score) => score.platform === 'threads')?.appStore).toEqual({ pageViews: '<5 a day', firstDownloads: '<5 a day' })
    // A file with nothing for the window says nothing per platform.
    expect(scorecard({ records, posts, now: NOW, days: 7, acquisition: { periods: { DAILY: [] } } }).platforms[0].appStore).toBeNull()
  })

  it('reads a platform’s campaigns added up, from the periods that cover most of the window', () => {
    const acquisition = {
      periods: {
        DAILY: [period('2026-10-11', '2026-10-11')],
        WEEKLY: [
          period('2026-09-28', '2026-10-04', {
            campaigns: [
              { campaign: 'pinterest', pageViews: 9, firstDownloads: 5 },
              { campaign: 'pinterest-steps', pageViews: 6, firstDownloads: 7 },
              { campaign: 'x-bio', pageViews: 5, firstDownloads: 5 },
            ],
          }),
        ],
      },
    }
    const summary = summariseAcquisition(acquisition, '2026-09-28', '2026-10-12')
    expect(summary).toMatchObject({ granularity: 'WEEKLY', covered: { start: '2026-09-28', end: '2026-10-04' } })
    expect(summary.platforms.pinterest).toEqual({ pageViews: 15, firstDownloads: 12 })
    expect(summary.platforms.x).toEqual({ pageViews: 5, firstDownloads: 5 })
    expect(summary.platforms.tiktok).toEqual({ pageViews: '<5', firstDownloads: '<5' })
  })

  it('takes a 0 in the pull’s campaign rows as hidden, never as nobody', () => {
    // As acquisition.py writes a day: a number with no Detailed row comes out 0, and `platforms` adds the campaigns up.
    const counts = (pageViews: number, firstDownloads: number) => ({ pageViews, getTaps: 0, firstDownloads, redownloads: 0, purchases: 0, proceedsUsd: 0 })
    const day = period('2026-10-06', '2026-10-06', {
      campaigns: [
        { campaign: 'pinterest', ...counts(0, 6) },
        { campaign: 'tiktok-bio', ...counts(8, 0) },
        { campaign: 'pinterest-steps', ...counts(7, 0) },
      ],
      platforms: [
        { platform: 'pinterest', campaigns: ['pinterest', 'pinterest-steps'], ...counts(7, 6) },
        { platform: 'tiktok', campaigns: ['tiktok-bio'], ...counts(8, 0) },
      ],
    })
    const oneDay = summariseAcquisition({ periods: { DAILY: [day] } }, '2026-10-06', '2026-10-06')
    expect(oneDay.platforms.pinterest).toEqual({ pageViews: '7+', firstDownloads: '6+' })
    expect(oneDay.platforms.tiktok).toEqual({ pageViews: 8, firstDownloads: '<5' })
    expect(oneDay.platforms.threads).toEqual({ pageViews: '<5', firstDownloads: '<5' })
    // Several days hidden are under 5 each, not under 5 in all.
    const twoDays = summariseAcquisition({ periods: { DAILY: [day, period('2026-10-07', '2026-10-07')] } }, '2026-10-06', '2026-10-07')
    expect(twoDays.platforms.tiktok).toEqual({ pageViews: '8+', firstDownloads: '<5 a day' })
    expect(twoDays.platforms.threads).toEqual({ pageViews: '<5 a day', firstDownloads: '<5 a day' })
    // Only `platforms`, as an older file might have: the same rule.
    const platformsOnly = summariseAcquisition({ periods: { DAILY: [{ ...day, campaigns: [] }] } }, '2026-10-06', '2026-10-06')
    expect(platformsOnly.platforms.tiktok).toEqual({ pageViews: 8, firstDownloads: '<5' })
  })
})
