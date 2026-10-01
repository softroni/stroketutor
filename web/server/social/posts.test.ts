import { describe, expect, it } from 'vitest'

import type { Tutorial } from '../../src/schema/types'
import { postCaption } from '../video/plan'

import {
  APP_STORE_URL,
  announcementTexts,
  appStoreLink,
  boardDescription,
  boardName,
  dayOf,
  entriesByDay,
  platformLink,
  postsByDay,
  pinFields,
  pinTexts,
  normaliseResults,
  parseConfig,
  parseUpNext,
  postedLessons,
  postingOrder,
  settledStatus,
  socialSettings,
  socialTexts,
  uploadFields,
  type PostEntry,
  type PostRequest,
  type SocialRecord,
} from './posts'

const tutorial: Tutorial = {
  schemaVersion: 2,
  id: 'hot-air-balloon',
  title: 'Hot Air Balloon',
  canvas: { width: 1000, height: 1000 },
  steps: [
    { id: 'envelope', title: 'The envelope', instruction: 'A big circle.', voiceover: null, strokes: [{ d: 'M 0 0 L 10 10', duration: 2, lineWidth: 10 }] },
    { id: 'basket', title: 'The basket', instruction: 'A small box.', voiceover: null, strokes: [{ d: 'M 0 0 L 10 10', duration: 2, lineWidth: 10 }] },
    { id: 'colour', title: 'Color it', instruction: 'Red.', voiceover: null, strokes: [], fills: [{ d: 'M 0 0 L 10 0 L 10 10 Z', color: '#FF0000', duration: 1 }] },
  ],
}

const texts = socialTexts(tutorial, { pathTitle: 'In the Air', number: 1, count: 10 })

const request = (overrides: Partial<PostRequest> = {}): PostRequest => ({
  profile: 'softroni',
  platforms: ['youtube', 'tiktok', 'instagram', 'facebook', 'threads', 'pinterest', 'x'],
  texts,
  settings: { pinterestBoard: 'board-1', facebookPage: null, aiLabel: 'tiktok', youtubeMadeForKids: false },
  private: false,
  externalId: 'paper-coach/hot-air-balloon',
  requestId: 'req-1',
  altText: 'A drawing lesson',
  ...overrides,
})

const fieldsOf = (pairs: [string, string][]) => {
  const out: Record<string, string[]> = {}
  for (const [name, value] of pairs) (out[name] ??= []).push(value)
  return out
}

describe('the settings file', () => {
  it('reads a shell-sourceable file: comments, export and quotes', () => {
    expect(parseConfig('# key\nexport UPLOAD_POST_API_KEY="abc def"\nUPLOAD_POST_PROFILE=softroni  # the brand\n\nnot a line\n')).toEqual({
      UPLOAD_POST_API_KEY: 'abc def',
      UPLOAD_POST_PROFILE: 'softroni',
    })
  })

  it('defaults to every platform, the TikTok AI label, and not made for kids', () => {
    expect(socialSettings({ UPLOAD_POST_API_KEY: 'k' })).toEqual({
      apiKey: 'k',
      profile: 'softroni',
      platforms: ['youtube', 'tiktok', 'instagram', 'facebook', 'threads', 'pinterest', 'x'],
      pinterestBoard: null,
      facebookPage: null,
      aiLabel: 'tiktok',
      youtubeMadeForKids: false,
      providerToken: null,
    })
  })

  it('takes twitter for x, and refuses a platform it doesn’t know', () => {
    expect(socialSettings({ UPLOAD_POST_PLATFORMS: 'YouTube, twitter' }).platforms).toEqual(['youtube', 'x'])
    expect(() => socialSettings({ UPLOAD_POST_PLATFORMS: 'youtube,myspace' })).toThrow(/myspace/)
    expect(() => socialSettings({ UPLOAD_POST_AI_LABEL: 'some' })).toThrow(/none, tiktok or all/)
  })
})

describe('socialTexts', () => {
  it('names the lesson, its steps and its place, and links where a link works', () => {
    expect(texts.youtubeTitle).toBe('How to draw a hot air balloon step by step #shorts')
    expect(texts.caption).toContain('Let’s draw a hot air balloon: 2 easy steps, then color it in.')
    expect(texts.caption).toContain('link in bio')
    expect(texts.youtubeDescription).toContain('Lesson 1 of the In the Air path in Paper Coach.')
    expect(texts.youtubeDescription).toContain(APP_STORE_URL)
    expect(texts.facebookDescription).toContain(APP_STORE_URL)
    // Upload-Post strips links from X posts, and X charges more for them.
    expect(texts.x).not.toContain('http')
    // A link in a Threads post can be tapped.
    expect(texts.threads).toContain(APP_STORE_URL)
  })

  it('reads for a free lesson as the video export’s caption does', () => {
    expect(texts.caption).toBe(postCaption(tutorial, { pathTitle: 'In the Air', number: 1, count: 10 }))
  })

  it('says plainly when a lesson is Premium, and that the app is free to download', () => {
    const premium = socialTexts(tutorial, { pathTitle: 'On the Water', number: 7, count: 10 }, null, { premium: true, freeLessons: 30 })
    expect(premium.caption).toContain('Lesson 7 of the On the Water path, in Paper Coach Premium.')
    expect(premium.caption).toContain('The app is free to download, with 30 free lessons, link in bio.')
    expect(premium.youtubeDescription).toContain('The app is free to download, with 30 free lessons: https://apps.apple.com/')
    expect(premium.facebookDescription).toContain('in Paper Coach Premium.')
    expect(premium.pinterestDescription).toContain('This lesson is in Paper Coach Premium.')
    expect(premium.x).toContain('In Paper Coach Premium. The app is free to download, with 30 free lessons.')
    expect(premium.threads).toContain('This lesson is in Paper Coach Premium.')
    for (const text of [premium.caption, premium.youtubeDescription, premium.x, premium.threads, premium.pinterestDescription]) {
      expect(text).not.toContain('Free on the App Store')
    }
    const pin = pinTexts(tutorial, null, { premium: true, freeLessons: 30 })
    expect(pin.description).toContain('This lesson is in Paper Coach Premium.')
    expect(pin.description).toContain('The app is free to download, with 30 free lessons.')
  })

  it('keeps every text within its platform’s limit, however long the title', () => {
    const long = socialTexts({ ...tutorial, id: 'x', title: 'Enormous '.repeat(30).trim() }, null)
    expect([...long.youtubeTitle].length).toBeLessThanOrEqual(100)
    expect([...long.pinterestTitle].length).toBeLessThanOrEqual(100)
    expect([...long.pinterestDescription].length).toBeLessThanOrEqual(500)
    expect([...long.x].length).toBeLessThanOrEqual(280)
    expect([...long.threads].length).toBeLessThanOrEqual(500)
  })
})

describe('uploadFields', () => {
  it('sends each platform its own text, and Pinterest the App Store link', () => {
    const fields = fieldsOf(uploadFields(request()))
    expect(fields['platform[]']).toEqual(['youtube', 'tiktok', 'instagram', 'facebook', 'threads', 'pinterest', 'x'])
    expect(fields.threads_title).toEqual([texts.threads])
    expect(fields.threads_topic_tag).toEqual(['Drawing'])
    expect(fields.youtube_title).toEqual([texts.youtubeTitle])
    expect(fields.privacyStatus).toEqual(['public'])
    expect(fields.selfDeclaredMadeForKids).toEqual(['false'])
    expect(fields.tiktok_title).toEqual([texts.caption])
    expect(fields.brand_organic_toggle).toEqual(['true'])
    expect(fields.tiktok_is_ai_generated).toEqual(['true'])
    expect(fields.is_ai_generated).toBeUndefined()
    expect(fields.instagram_title).toEqual([texts.caption])
    expect(fields.facebook_title).toEqual(['How to draw a hot air balloon step by step'])
    expect(fields.pinterest_board_id).toEqual(['board-1'])
    expect(fields.pinterest_link).toEqual([APP_STORE_URL])
    expect(fields.x_title).toEqual([texts.x])
    expect(fields.async_upload).toEqual(['true'])
    expect(fields.privacy_level).toBeUndefined()
  })

  it('puts the TikTok and Instagram caption in the general title, which those two publish', () => {
    expect(fieldsOf(uploadFields(request())).title).toEqual([texts.caption])
    expect(fieldsOf(uploadFields(request({ platforms: ['instagram', 'x'] }))).title).toEqual([texts.caption])
    expect(fieldsOf(uploadFields(request({ platforms: ['youtube', 'facebook'] }))).title).toEqual([texts.youtubeTitle])
  })

  it('keeps a test post private where it can be', () => {
    const fields = fieldsOf(uploadFields(request({ platforms: ['youtube', 'tiktok', 'facebook'], private: true })))
    expect(fields.privacyStatus).toEqual(['private'])
    expect(fields.privacy_level).toEqual(['SELF_ONLY'])
    expect(fields.video_state).toEqual(['DRAFT'])
    expect(fields.instagram_title).toBeUndefined()
  })

  it('schedules instead of posting at once, and labels every platform when asked', () => {
    const fields = fieldsOf(
      uploadFields(request({ scheduledAt: '2026-10-02T17:00:00-05:00', settings: { pinterestBoard: null, facebookPage: '42', aiLabel: 'all', youtubeMadeForKids: true } })),
    )
    expect(fields.scheduled_date).toEqual(['2026-10-02T17:00:00-05:00'])
    expect(fields.async_upload).toBeUndefined()
    expect(fields.is_ai_generated).toEqual(['true'])
    expect(fields.tiktok_is_ai_generated).toBeUndefined()
    expect(fields.facebook_page_id).toEqual(['42'])
    expect(fields.selfDeclaredMadeForKids).toEqual(['true'])
  })
})

describe('posts by day', () => {
  const sent = (requestId: string, at: string, extra: Partial<Extract<SocialRecord, { kind: 'post' }>> = {}): SocialRecord => ({
    kind: 'post', at, lessonId: 'pine-tree', profile: 'softroni', platforms: ['youtube', 'pinterest'], private: false, requestId, outcome: 'sent', ...extra,
  })
  const finished = (requestId: string): SocialRecord => ({
    kind: 'status', at: '2026-10-01T04:14:00Z', requestId, status: 'completed',
    results: {
      youtube: { success: true, url: 'https://www.youtube.com/watch?v=w6lmWyYtzGE', postId: 'w6lmWyYtzGE' },
      // As Upload-Post reported the first real post: the pin's destination where its address should be.
      pinterest: { success: true, url: 'https://apps.apple.com/app/apple-store/id6816231257?pt=1&ct=pinterest&mt=8', postId: '989806824387717196' },
    },
  })

  it('counts days in Central time, where the posting job runs', () => {
    expect(dayOf('2026-10-01T04:12:01Z')).toBe('2026-09-30')
    expect(dayOf('2026-10-01T22:00:00Z')).toBe('2026-10-01')
  })

  it('gives a pin its own address, and a private Short one from its id', () => {
    expect(platformLink('pinterest', 'https://apps.apple.com/app/x', '98')).toBe('https://www.pinterest.com/pin/98/')
    expect(platformLink('pinterest', 'https://www.pinterest.com/pin/98/', '98')).toBe('https://www.pinterest.com/pin/98/')
    expect(platformLink('youtube', null, 'abc')).toBe('https://youtube.com/shorts/abc')
    expect(platformLink('x', 'https://x.com/s/1', '1')).toBe('https://x.com/s/1')
  })

  it('groups what went out by day, newest first, with each platform’s link and no refusals', () => {
    const records: SocialRecord[] = [
      sent('first', '2026-10-01T04:12:01Z'),
      finished('first'),
      sent('refused', '2026-10-01T22:00:00Z', { outcome: 'refused' }),
      sent('pin', '2026-10-01T04:12:03Z', { platforms: ['pinterest'], media: 'pin', scheduledAt: '2026-10-01T08:12:01Z' }),
      sent('second', '2026-10-01T22:01:00Z', { lessonId: 'watermelon-slice' }),
    ]
    const days = postsByDay(records, (id) => (id === 'pine-tree' ? 'Pine Tree' : undefined), Date.parse('2026-10-01T05:00:00Z'))
    expect(days.map((day) => day.day)).toEqual(['2026-10-01', '2026-09-30'])
    // The pin goes out at 3:12 am Central on the next day, so it belongs to that day.
    expect(days[0].posts.map((post) => [post.requestId, post.media, post.status])).toEqual([
      ['second', 'video', 'processing'],
      ['pin', 'pin', 'scheduled'],
    ])
    const [video] = days[1].posts
    expect(video.title).toBe('Pine Tree')
    expect(video.platforms).toEqual([
      { platform: 'youtube', ok: true, url: 'https://www.youtube.com/watch?v=w6lmWyYtzGE', error: null },
      { platform: 'pinterest', ok: true, url: 'https://www.pinterest.com/pin/989806824387717196/', error: null },
    ])
  })

  it('keeps the opening and the test’s arm in the repo’s copy, for the scorecard, and nothing on records from before', () => {
    const hook = sent('hook', '2026-10-06T22:00:00Z', { opening: 'hook', experiments: { E1: 'hook' } })
    const [entry] = postsByDay([hook, finished('hook')])[0].posts
    expect(entry).toMatchObject({ requestId: 'hook', day: '2026-10-06', opening: 'hook', experiments: { E1: 'hook' } })
    const [before] = postsByDay([sent('first', '2026-10-01T04:12:01Z'), finished('first')])[0].posts
    expect(before).not.toHaveProperty('opening')
    expect(before).not.toHaveProperty('experiments')
  })

  it('groups the repo’s copy, kept a post a line in the order each finished, the same way', () => {
    const kept = (requestId: string, day: string, at: string): PostEntry => ({
      day, at, requestId, lessonId: 'pine-tree', media: 'video', purpose: 'lesson', private: false, status: 'completed', platforms: [],
    })
    const days = entriesByDay([
      kept('evening', '2026-09-30', '2026-10-01T04:12:01Z'),
      kept('next-day', '2026-10-01', '2026-10-01T22:00:00Z'),
      kept('afternoon', '2026-09-30', '2026-09-30T22:00:00Z'),
    ])
    expect(days.map((day) => [day.day, day.posts.map((post) => post.requestId)])).toEqual([
      ['2026-10-01', ['next-day']],
      ['2026-09-30', ['evening', 'afternoon']],
    ])
  })
})

describe('the step pin', () => {
  it('names the drawing people search for, lists the steps, and leads to the App Store', () => {
    const pin = pinTexts(tutorial, '123456')
    expect(pin.title).toBe('Hot air balloon drawing: 3 easy steps for beginners')
    expect(pin.description).toContain('How to draw a hot air balloon in 3 easy steps, one line at a time.')
    expect(pin.description).toContain('1. The envelope\n2. The basket\n3. Color it')
    expect(pin.link).toContain('ct=pinterest-steps')
    expect([...pin.description].length).toBeLessThanOrEqual(500)
  })

  it('drops the step list rather than go past Pinterest’s 500 characters', () => {
    const long = { ...tutorial, steps: Array.from({ length: 40 }, (_, index) => ({ ...tutorial.steps[0], id: `s${index}`, title: `A rather long step title number ${index}` })) }
    const pin = pinTexts(long)
    expect([...pin.description].length).toBeLessThanOrEqual(500)
    expect(pin.description).not.toContain('1. A rather long')
  })

  it('goes to Pinterest alone, scheduled, on the board given', () => {
    const fields = fieldsOf(pinFields({ profile: 'softroni', texts: pinTexts(tutorial), board: 'b1', externalId: 'e', requestId: 'r', scheduledAt: '2026-10-01T02:00:00Z' }))
    expect(fields['platform[]']).toEqual(['pinterest'])
    expect(fields.pinterest_board_id).toEqual(['b1'])
    expect(fields.scheduled_date).toEqual(['2026-10-01T02:00:00Z'])
    expect(fields.async_upload).toBeUndefined()
  })

  it('names a path’s board for what people search', () => {
    expect(boardName('Food & Treats')).toBe('Easy Drawings: Food & Treats')
    expect(boardDescription('Plants', 'Trees and flowers.')).toBe(
      'Easy step-by-step drawings: plants. Trees and flowers. Lessons from Paper Coach, which shows one line at a time and waits while you draw it on real paper.',
    )
  })
})

describe('release news', () => {
  it('says what’s new on every platform, with its own campaign links and no link on X', () => {
    const news = announcementTexts('10 new lessons: draw your town, from a bus stop to a skyline.', 'New: draw your town', '123456')
    expect(news.youtubeTitle).toBe('New: draw your town #shorts')
    expect(news.caption.startsWith('10 new lessons')).toBe(true)
    expect(news.caption).toContain('link in bio')
    expect(news.youtubeDescription).toContain('ct=youtube-news')
    expect(news.pinterestLink).toContain('ct=pinterest-news')
    expect(news.x).not.toContain('http')
    expect(news.threads).toContain('ct=threads-news')
  })
})

describe('campaign links', () => {
  it('tags each platform’s App Store link once there is a provider token, and leaves it plain before', () => {
    expect(appStoreLink('pinterest', null)).toBe(APP_STORE_URL)
    expect(appStoreLink('pinterest', '123456')).toBe('https://apps.apple.com/app/apple-store/id6816231257?pt=123456&ct=pinterest&mt=8')
    const tagged = socialTexts(tutorial, null, '123456')
    expect(tagged.pinterestLink).toContain('ct=pinterest')
    expect(tagged.youtubeDescription).toContain('ct=youtube')
    expect(tagged.facebookDescription).toContain('ct=facebook')
    expect(fieldsOf(uploadFields(request({ texts: tagged }))).pinterest_link).toEqual([tagged.pinterestLink])
  })
})

describe('the lists in docs/ops', () => {
  it('read one id a line, without comments or blanks', () => {
    expect(parseUpNext('# first the rockets\ns2  # it did well\n\np2\n')).toEqual(['s2', 'p2'])
  })
})

describe('postingOrder', () => {
  it('takes lesson 1 of every path, then lesson 2, so the free lessons come first and a path never repeats', () => {
    const order = postingOrder([
      { id: 'plants', title: 'Plants', lessonIds: ['p1', 'p2', 'p3', 'p4'] },
      { id: 'space', title: 'Space', lessonIds: ['s1', 's2'] },
    ])
    expect(order.map((entry) => entry.lessonId)).toEqual(['p1', 's1', 'p2', 's2', 'p3', 'p4'])
    expect(order.map((entry) => entry.free)).toEqual([true, true, true, true, true, false])
    expect(order[3]).toEqual({ lessonId: 's2', pathId: 'space', number: 2, free: true })
  })
})

describe('the record of posts', () => {
  const post = (lessonId: string, requestId: string, extra: Partial<Extract<SocialRecord, { kind: 'post' }>> = {}): SocialRecord => ({
    kind: 'post',
    at: '2026-10-01T22:00:00Z',
    lessonId,
    profile: 'softroni',
    platforms: ['youtube'],
    private: false,
    requestId,
    outcome: 'sent',
    ...extra,
  })
  const status = (requestId: string, value: string, success: boolean): SocialRecord => ({
    kind: 'status',
    at: '2026-10-01T22:05:00Z',
    requestId,
    status: value,
    results: { youtube: { success } },
  })

  it('counts a lesson once it went out for everyone, not a test, a refusal, or a post that failed everywhere', () => {
    const records: SocialRecord[] = [
      post('a', '1'),
      status('1', 'completed', true),
      post('b', '2', { private: true }),
      post('c', '3', { outcome: 'refused' }),
      post('d', '4'),
      status('4', 'failed', false),
      post('e', '5'),
      status('5', 'processing', false),
    ]
    expect([...postedLessons(records)].sort()).toEqual(['a', 'e'])
  })

  it('reads results as a list or by platform, with twitter as x and a link where there is one', () => {
    expect(normaliseResults([{ platform: 'twitter', success: true, post_url: 'https://x.com/s/1' }, { platform: 'tiktok', success: false, message: 'Private account' }])).toEqual({
      x: { success: true, url: 'https://x.com/s/1', postId: null, error: null },
      tiktok: { success: false, url: null, postId: null, error: 'Private account' },
    })
    expect(normaliseResults({ youtube: { success: true, url: 'https://youtu.be/abc' }, linkedin: { success: false, error: 'Expired' } })).toEqual({
      youtube: { success: true, url: 'https://youtu.be/abc', postId: null, error: null },
      linkedin: { success: false, url: null, postId: null, error: 'Expired' },
    })
    expect(normaliseResults([{ platform: 'tiktok', success: true, post_url: 'Video sent to Inbox (No Public URL)' }]).tiktok.url).toBeNull()
    // TikTok's daily cap puts the video in the inbox, unpublished, though Upload-Post says it succeeded.
    expect(normaliseResults([{ platform: 'tiktok', success: true, fallback_to_inbox: true, post_url: 'Video sent to Inbox (No Public URL)' }]).tiktok.inbox).toBe(true)
    expect(normaliseResults([{ platform: 'tiktok', success: true, post_url: 'https://tiktok.com/@s/video/1' }]).tiktok.inbox).toBeUndefined()
  })

  it('links a private YouTube video by its id, as Upload-Post reported the first test post', () => {
    const answer = [
      { platform: 'youtube', success: true, platform_post_id: 'RkBQaXYFNEo', post_url: 'Post uploaded as Private. No public URL available.', error_message: null },
      { platform: 'instagram', success: false, error_message: 'Media type not supported' },
    ]
    expect(normaliseResults(answer)).toEqual({
      youtube: { success: true, url: 'https://youtube.com/shorts/RkBQaXYFNEo', postId: 'RkBQaXYFNEo', error: null },
      instagram: { success: false, url: null, postId: null, error: 'Media type not supported' },
    })
  })

  it('leaves out a platform still at work, which Upload-Post also reports as success: false', () => {
    // As Upload-Post answered for the first Facebook test, a minute in.
    expect(normaliseResults([{ platform: 'facebook', status: 'processing', attempts: 1, success: false }])).toEqual({})
    expect(settledStatus('processing', normaliseResults([{ platform: 'facebook', status: 'processing', success: false }]), ['facebook'])).toBe('processing')
    expect(normaliseResults([{ platform: 'facebook', status: 'failed', success: false, error_message: 'No permission' }]).facebook.error).toBe('No permission')
  })

  it('settles a post once every platform has answered, whatever Upload-Post still says', () => {
    const ok = { success: true }
    const failed = { success: false, error: 'No' }
    expect(settledStatus('in_progress', { youtube: ok }, ['youtube', 'facebook'])).toBe('in_progress')
    expect(settledStatus('in_progress', { youtube: ok, facebook: ok }, ['youtube', 'facebook'])).toBe('completed')
    expect(settledStatus('in_progress', { youtube: ok, facebook: failed }, ['youtube', 'facebook'])).toBe('partial')
    expect(settledStatus('in_progress', { youtube: failed }, ['youtube'])).toBe('failed')
    expect(settledStatus('completed', {}, ['youtube'])).toBe('completed')
  })
})
