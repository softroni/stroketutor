import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  nearDay,
  platformName,
  platformState,
  postKind,
  postStatus,
  reach,
  shortLink,
  tally,
  type SocialPlatform,
  type SocialPost,
} from '../src/studio/social'

import type { PostEntry, QueueEntry, SocialRecord } from './social/posts'
import { COMING_SHOWN, readSocialPosts, type SocialLessons } from './socialPosts'

describe('the Social page', () => {
  let dir: string
  let files: { record: string; kept: string }

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'studio-social-'))
    files = { record: path.join(dir, 'social', 'posts.jsonl'), kept: path.join(dir, 'ops', 'history', 'social', 'posts.jsonl') }
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  const write = (file: string, lines: unknown[]) => {
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, lines.map((line) => (typeof line === 'string' ? line : JSON.stringify(line))).join('\n'))
  }

  // The first real post: Pine Tree at 23:12 Central on Sep 30, and its step pin scheduled for 3:12 the next morning.
  const now = Date.parse('2026-10-01T04:30:00Z')
  const video: SocialRecord = {
    kind: 'post',
    at: '2026-10-01T04:12:01.163Z',
    lessonId: 'pine-tree',
    profile: 'softroni',
    platforms: ['youtube', 'x'],
    private: false,
    requestId: 'video',
    media: 'video',
    purpose: 'lesson',
    outcome: 'sent',
  }
  const pin: SocialRecord = { ...video, at: '2026-10-01T04:12:03.208Z', platforms: ['pinterest'], requestId: 'pin', media: 'pin', scheduledAt: '2026-10-01T08:12:01.164Z' }
  const test: SocialRecord = { ...video, at: '2026-09-28T21:12:43.995Z', platforms: ['youtube'], private: true, requestId: 'test' }
  const finished: SocialRecord = {
    kind: 'status',
    at: '2026-10-01T04:17:48.133Z',
    requestId: 'video',
    status: 'completed',
    results: {
      youtube: { success: true, url: 'https://www.youtube.com/watch?v=w6lmWyYtzGE', postId: 'w6lmWyYtzGE', error: null },
      x: { success: true, url: 'https://x.com/softronicom/status/2105511106286403893', postId: '2105511106286403893', error: null },
    },
  }
  const titles = (lessonId: string) => (lessonId === 'pine-tree' ? 'Pine Tree' : undefined)
  const library: SocialLessons = { title: titles }

  it('shows no posts, and no error, before anything is posted or when the files can’t be read', async () => {
    const none = { days: [], coming: null, source: null, timeZone: 'America/Chicago', today: '2026-09-30' }
    expect(await readSocialPosts(files, library, now)).toEqual(none)
    // A folder where a file should be can't be read either.
    mkdirSync(files.record, { recursive: true })
    mkdirSync(files.kept, { recursive: true })
    expect(await readSocialPosts(files, library, now)).toEqual(none)
  })

  it('reads this Mac’s record by Central day, newest first, with the library’s titles and no test posts', async () => {
    write(files.record, [test, video, pin, finished])
    const { days, source, today } = await readSocialPosts(files, library, now)
    expect([source, today]).toEqual(['record', '2026-09-30'])
    expect(days.map((day) => [day.day, day.posts.map((post) => [post.requestId, post.title, post.status])])).toEqual([
      ['2026-10-01', [['pin', 'Pine Tree', 'scheduled']]],
      ['2026-09-30', [['video', 'Pine Tree', 'completed']]],
    ])
    expect(days[1].posts[0].platforms.map((platform) => [platform.platform, platform.url])).toEqual([
      ['youtube', 'https://www.youtube.com/watch?v=w6lmWyYtzGE'],
      ['x', 'https://x.com/softronicom/status/2105511106286403893'],
    ])
  })

  it('skips a line that is not a post or a status rather than failing the page', async () => {
    write(files.record, [
      'not json',
      'null',
      '42',
      { kind: 'post', requestId: 'no-platforms', at: '2026-09-30T22:00:00Z', lessonId: 'pine-tree' },
      { ...video, requestId: 'no-date', at: 'yesterday' },
      { kind: 'status', requestId: 'video', status: 'completed', results: null },
      video,
      finished,
    ])
    const { days } = await readSocialPosts(files, library, now)
    expect(days.flatMap((day) => day.posts.map((post) => [post.requestId, post.status]))).toEqual([['video', 'completed']])
  })

  it('falls back to the repo’s copy where this Mac has no record, the library’s titles winning', async () => {
    const kept = (requestId: string, at: string, fields: Partial<PostEntry> = {}): PostEntry => ({
      day: '2026-09-30',
      at,
      requestId,
      lessonId: 'pine-tree',
      title: 'Pine tree, as it was called',
      media: 'video',
      purpose: 'lesson',
      private: false,
      status: 'completed',
      platforms: [{ platform: 'youtube', ok: true, url: 'https://youtube.com/shorts/RkBQaXYFNEo', error: null }],
      ...fields,
    })
    write(files.kept, [
      kept('first', '2026-09-30T22:00:00Z'),
      kept('gone', '2026-09-30T23:00:00Z', { lessonId: 'deleted-lesson', title: 'Deleted Lesson' }),
      kept('test', '2026-09-30T21:00:00Z', { private: true }),
      { ...kept('no-day', '2026-09-30T21:00:00Z'), day: 'whenever' },
      kept('next', '2026-10-01T22:00:00Z', { day: '2026-10-01' }),
    ])
    const { days, source } = await readSocialPosts(files, library, now)
    expect(source).toBe('kept')
    expect(days.map((day) => [day.day, day.posts.map((post) => [post.requestId, post.title])])).toEqual([
      ['2026-10-01', [['next', 'Pine Tree']]],
      ['2026-09-30', [['gone', 'Deleted Lesson'], ['first', 'Pine Tree']]],
    ])
  })

  it('keeps to this Mac’s record whenever there is one, even with nothing in it yet', async () => {
    write(files.kept, [{ day: '2026-09-30', at: '2026-09-30T22:00:00Z', requestId: 'kept', lessonId: 'pine-tree', status: 'completed', platforms: [] }])
    write(files.record, [])
    expect(await readSocialPosts(files, library, now)).toMatchObject({ days: [], source: 'record' })
  })

  describe('what comes next', () => {
    const entry = (lessonId: string, free = true): QueueEntry => ({ lessonId, pathId: 'plants', number: 1, free })
    const order = [entry('pine-tree'), entry('rocket'), entry('draft-lesson'), entry('big-oak', false)]
    const names: Record<string, string> = { 'pine-tree': 'Pine Tree', rocket: 'Rocket', 'big-oak': 'Big Oak' }
    const lessons = (queue: SocialLessons['queue']): SocialLessons => ({ title: (lessonId) => names[lessonId], queue })
    const coming = async (queue: SocialLessons['queue']) => readSocialPosts(files, lessons(queue), now)

    it('lists the lessons still owed a video, one a day at 17:00 from the next run, each with its step pin', async () => {
      write(files.record, [video, finished, pin])
      // Pine Tree has gone out, and the draft may not.
      const response = await coming(async () => ({ order, allowed: (lessonId) => lessonId !== 'draft-lesson' }))
      // Pine Tree was free, so a Premium lesson takes the next turn.
      expect(response.coming).toEqual([
        { at: '2026-10-01T22:00:00.000Z', pinAt: '2026-10-02T02:00:00.000Z', lessonId: 'big-oak', title: 'Big Oak', free: false },
        { at: '2026-10-02T22:00:00.000Z', pinAt: '2026-10-03T02:00:00.000Z', lessonId: 'rocket', title: 'Rocket', free: true },
      ])
    })

    it('starts the day after when the next run comes too soon after the last lesson video', async () => {
      write(files.record, [{ ...video, at: '2026-10-01T12:00:00Z' }])
      const response = await readSocialPosts(files, lessons(async () => ({ order, allowed: () => true })), Date.parse('2026-10-01T16:00:00Z'))
      // A video posted by hand at 7 am leaves that day's 17:00 run, 10 hours on, nothing to do.
      expect(response.coming?.[0]).toMatchObject({ at: '2026-10-02T22:00:00.000Z', lessonId: 'big-oak' })
    })

    it('shows a week of them at most, and the first ones before anything is posted', async () => {
      const long = Array.from({ length: COMING_SHOWN + 3 }, (_, index) => entry(`lesson-${index}`))
      const response = await coming(async () => ({ order: long, allowed: () => true }))
      expect(response.coming?.map((post) => [post.lessonId, post.at.slice(0, 10)])).toEqual(
        long.slice(0, COMING_SHOWN).map((post, index) => [post.lessonId, `2026-10-0${index + 1}`]),
      )
    })

    it('says nothing comes next from the repo’s copy, and why when the order can’t be read', async () => {
      write(files.kept, [{ day: '2026-09-30', at: '2026-09-30T22:00:00Z', requestId: 'kept', lessonId: 'pine-tree', status: 'completed', platforms: [] }])
      expect((await coming(async () => ({ order, allowed: () => true }))).coming).toBeNull()
      write(files.record, [])
      const broken = await coming(async () => {
        throw new Error('facts.json is not valid JSON')
      })
      expect(broken).toMatchObject({ coming: null, comingProblem: 'facts.json is not valid JSON', source: 'record' })
    })
  })
})

describe('the Social page, worked out', () => {
  const post = (fields: Partial<SocialPost> = {}): SocialPost => ({
    day: '2026-09-30',
    at: '2026-10-01T04:12:01.163Z',
    requestId: 'r',
    lessonId: 'pine-tree',
    media: 'video',
    purpose: 'lesson',
    private: false,
    status: 'completed',
    platforms: [],
    ...fields,
  })
  const up = (ok: boolean | null): SocialPlatform => ({ platform: 'youtube', ok, url: null, error: null })

  it('names each platform as it writes its own name, and what went out', () => {
    expect(['youtube', 'tiktok', 'x', 'bluesky'].map(platformName)).toEqual(['YouTube', 'TikTok', 'X', 'Bluesky'])
    expect([post(), post({ media: 'speed' }), post({ media: 'pin' }), post({ media: 'speed', purpose: 'announce' })].map(postKind)).toEqual([
      'Lesson video',
      'Speed draw',
      'Step pin',
      'Release news',
    ])
  })

  it('gives every status a word, and anything still at work the waiting tone', () => {
    expect(['completed', 'partial', 'failed', 'not_found', 'scheduled'].map((status) => postStatus(status))).toEqual([
      { word: 'Posted', tone: 'good' },
      { word: 'Partly posted', tone: 'attention' },
      { word: 'Failed', tone: 'bad' },
      { word: 'Not found', tone: 'bad' },
      { word: 'Scheduled', tone: 'neutral' },
    ])
    for (const status of ['processing', 'in_progress', 'queued', 'pending']) expect(postStatus(status)).toEqual({ word: 'Processing', tone: 'waiting' })
  })

  it('links a platform once the post is up there, and says in words why not otherwise', () => {
    const state = (fields: Partial<SocialPlatform>, status = 'completed') =>
      platformState({ platform: 'tiktok', ok: null, url: null, error: null, ...fields }, post({ status }), () => '3:12 AM')
    expect(state({ ok: true, url: 'https://www.tiktok.com/t/7691547295380163853' })).toEqual({
      state: 'live',
      words: 'tiktok.com/t/7691547295380163853',
      url: 'https://www.tiktok.com/t/7691547295380163853',
    })
    expect(state({ ok: true })).toEqual({ state: 'live', words: 'posted, with no link given', url: null })
    expect(state({}, 'scheduled')).toEqual({ state: 'waiting', words: 'scheduled for 3:12 AM', url: null })
    expect(state({}, 'in_progress')).toEqual({ state: 'waiting', words: 'still processing', url: null })
    expect(state({ ok: false, inbox: true })).toEqual({ state: 'held', words: 'in TikTok’s inbox, not published', url: null })
    expect(state({ ok: false, error: 'The video is too short for Reels.' }, 'partial')).toEqual({
      state: 'failed',
      words: 'The video is too short for Reels.',
      url: null,
    })
    expect(state({ ok: false }, 'failed').words).toBe('failed, with no reason given')
    // Finished, and this platform never answered: it won't now.
    expect(state({}, 'partial')).toEqual({ state: 'held', words: 'no answer from Upload-Post', url: null })
  })

  it('shortens a post’s address to what a person reads of it', () => {
    expect(shortLink('https://www.youtube.com/watch?v=w6lmWyYtzGE')).toBe('youtube.com/watch?v=w6lmWyYtzGE')
    expect(shortLink('https://www.pinterest.com/pin/989806824387717196/')).toBe('pinterest.com/pin/989806824387717196')
    expect(shortLink('not a link')).toBe('not a link')
  })

  it('says how far a post got, and nothing for one platform or none yet', () => {
    expect(reach(post({ platforms: [up(true), up(true), up(true)] }))).toBe('on all 3 platforms')
    expect(reach(post({ platforms: [up(true), up(true)] }))).toBe('on both platforms')
    expect(reach(post({ status: 'partial', platforms: [up(true), up(false), up(true)] }))).toBe('on 2 of 3 platforms')
    expect(reach(post({ status: 'processing', platforms: [up(true), up(null), up(null)] }))).toBe('on 1 of 3 platforms so far')
    expect(reach(post({ platforms: [up(true)] }))).toBeNull()
    expect(reach(post({ status: 'failed', platforms: [up(false), up(false)] }))).toBeNull()
  })

  it('counts the posts so far and their days, and what is still to go out', () => {
    expect(tally([])).toBe('Nothing posted yet.')
    expect(tally([{ day: '2026-10-01', posts: [post({ status: 'scheduled' })] }])).toBe('Nothing posted yet; 1 scheduled.')
    expect(tally([{ day: '2026-10-01', posts: [post({ status: 'scheduled' })] }, { day: '2026-09-30', posts: [post()] }])).toBe(
      '1 post so far, on one day, and 1 scheduled.',
    )
    expect(tally([{ day: '2026-10-01', posts: [post(), post({ media: 'pin' })] }, { day: '2026-09-30', posts: [post()] }])).toBe('3 posts so far, over 2 days.')
  })

  it('calls the days beside today by name, across a month’s end', () => {
    expect(['2026-09-30', '2026-10-01', '2026-09-29', '2026-09-28', '2026-10-30'].map((day) => nearDay(day, '2026-09-30'))).toEqual([
      'Today',
      'Tomorrow',
      'Yesterday',
      null,
      null,
    ])
  })
})
