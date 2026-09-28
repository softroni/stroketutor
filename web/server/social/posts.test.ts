import { describe, expect, it } from 'vitest'

import type { Tutorial } from '../../src/schema/types'

import {
  APP_STORE_URL,
  normaliseResults,
  parseConfig,
  postedLessons,
  postingOrder,
  settledStatus,
  socialSettings,
  socialTexts,
  uploadFields,
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
  platforms: ['youtube', 'tiktok', 'instagram', 'facebook', 'pinterest', 'x'],
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
      platforms: ['youtube', 'tiktok', 'instagram', 'facebook', 'pinterest', 'x'],
      pinterestBoard: null,
      facebookPage: null,
      aiLabel: 'tiktok',
      youtubeMadeForKids: false,
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
  })

  it('keeps every text within its platform’s limit, however long the title', () => {
    const long = socialTexts({ ...tutorial, id: 'x', title: 'Enormous '.repeat(30).trim() }, null)
    expect([...long.youtubeTitle].length).toBeLessThanOrEqual(100)
    expect([...long.pinterestTitle].length).toBeLessThanOrEqual(100)
    expect([...long.pinterestDescription].length).toBeLessThanOrEqual(500)
    expect([...long.x].length).toBeLessThanOrEqual(280)
  })
})

describe('uploadFields', () => {
  it('sends each platform its own text, and Pinterest the App Store link', () => {
    const fields = fieldsOf(uploadFields(request()))
    expect(fields['platform[]']).toEqual(['youtube', 'tiktok', 'instagram', 'facebook', 'pinterest', 'twitter'])
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
