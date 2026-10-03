import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { fileSize, madeKind, madeNote } from '../src/studio/social'

import type { SocialRecord } from './social/posts'
import { madeFile, projectTitle, readMadeVideos } from './socialMade'
import { readSocialPosts } from './socialPosts'

describe('the videos made and not posted yet', () => {
  let studio: string

  beforeEach(() => {
    studio = mkdtempSync(path.join(tmpdir(), 'studio-made-'))
  })

  afterEach(() => rmSync(studio, { recursive: true, force: true }))

  /** A file under .studio, last written at `at`. */
  const make = (id: string, at: string, bytes = 1200) => {
    const file = path.join(studio, id)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, Buffer.alloc(bytes))
    const time = new Date(at)
    utimesSync(file, time, time)
    return file
  }

  const post = (fields: Partial<Extract<SocialRecord, { kind: 'post' }>>): SocialRecord => ({
    kind: 'post',
    at: '2026-10-02T22:03:00.000Z',
    lessonId: 'mushroom',
    profile: 'softroni',
    platforms: ['youtube', 'x'],
    private: false,
    requestId: `post-${Math.random()}`,
    media: 'video',
    purpose: 'lesson',
    outcome: 'sent',
    ...fields,
  })

  const ids = async (records: SocialRecord[]) => (await readMadeVideos(studio, records)).map((video) => video.id)

  it('lists a what’s-new video with its thumbnail, newest first, and the lesson videos of lessons not posted', async () => {
    make('whats-new-1.1/out/paper-coach-whats-new-1.1.mp4', '2026-10-03T03:20:00Z', 14_400_000)
    make('whats-new-1.1/out/thumbnail.jpg', '2026-10-03T03:28:00Z')
    make('whats-new-1.1/out/paper-coach-whats-new-1.1.en.srt', '2026-10-03T03:27:00Z')
    make('videos/donut.mp4', '2026-10-01T18:00:00Z')
    make('videos/rocket-speed.mp4', '2026-09-30T18:00:00Z')
    make('videos/mushroom.mp4', '2026-10-02T22:00:00Z')
    make('videos/mushroom-pin.png', '2026-10-02T22:00:00Z')

    const made = await readMadeVideos(studio, [post({})], (lessonId) => ({ donut: 'Donut', rocket: 'Rocket' })[lessonId])
    expect(made).toEqual([
      {
        id: 'whats-new-1.1/out/paper-coach-whats-new-1.1.mp4',
        kind: 'wide',
        title: 'What’s new in 1.1',
        madeAt: '2026-10-03T03:20:00.000Z',
        bytes: 14_400_000,
        poster: 'whats-new-1.1/out/thumbnail.jpg',
      },
      { id: 'videos/donut.mp4', kind: 'lesson', title: 'Donut', lessonId: 'donut', madeAt: '2026-10-01T18:00:00.000Z', bytes: 1200 },
      { id: 'videos/rocket-speed.mp4', kind: 'speed', title: 'Rocket', lessonId: 'rocket', madeAt: '2026-09-30T18:00:00.000Z', bytes: 1200 },
    ])
  })

  it('leaves a video unlisted on YouTube showing until it is made public', async () => {
    const file = make('overview-1.1/out/tour.mp4', '2026-10-03T03:20:00Z')
    const unlisted = post({ media: 'wide', purpose: 'announce', platforms: ['youtube'], at: '2026-10-03T15:00:00Z', video: file, unlisted: true, requestId: 'tour' })
    expect(await ids([unlisted])).toEqual(['overview-1.1/out/tour.mp4'])
    expect(await ids([unlisted, { kind: 'visibility', at: '2026-10-05T23:00:00Z', requestId: 'tour', platform: 'youtube', privacy: 'public' }])).toEqual([])
  })

  it('counts a 16:9 video as posted once a post names its file', async () => {
    const file = make('whats-new-1.1/out/whats-new.mp4', '2026-10-03T03:20:00Z')
    make('long-landscape/out/landscape.mp4', '2026-10-03T03:00:00Z')
    // A long video posted later, by its own file, says nothing about the what's-new video made before it.
    const long = post({ media: 'wide', purpose: 'announce', at: '2026-10-10T22:00:00Z', video: path.join(studio, 'long-landscape/out/landscape.mp4') })
    expect(await ids([long])).toEqual(['whats-new-1.1/out/whats-new.mp4'])
    expect(await ids([long, post({ media: 'wide', purpose: 'announce', at: '2026-10-08T22:00:00Z', video: file })])).toEqual([])
  })

  it('counts a 16:9 video as posted when a 16:9 post from before the file was named went out after it was made', async () => {
    make('overview-1.0/out/paper-coach-overview-1.0.mp4', '2026-10-02T04:21:00Z')
    make('whats-new-1.1/out/whats-new.mp4', '2026-10-03T03:20:00Z')
    const overview = post({ lessonId: 'sailboat', media: 'wide', purpose: 'announce', at: '2026-10-02T04:33:35Z' })
    expect(await ids([overview])).toEqual(['whats-new-1.1/out/whats-new.mp4'])
  })

  it('leaves a video showing after a test post, a refused one, or one that failed everywhere', async () => {
    make('videos/donut.mp4', '2026-10-01T18:00:00Z')
    make('videos/donut-speed.mp4', '2026-10-01T18:00:00Z')
    const failed = post({ lessonId: 'donut', requestId: 'failed' })
    const records: SocialRecord[] = [
      post({ lessonId: 'donut', private: true }),
      post({ lessonId: 'donut', media: 'speed', outcome: 'refused' }),
      failed,
      { kind: 'status', at: '2026-10-02T22:10:00Z', requestId: 'failed', status: 'failed', results: { youtube: { success: false, error: 'No.' } } },
    ]
    expect(await ids(records)).toEqual(['videos/donut-speed.mp4', 'videos/donut.mp4'])
    // A speed draw that went out, as news or on its own, is posted; the lesson still owes its whole video.
    expect(await ids([...records, post({ lessonId: 'donut', media: 'speed', purpose: 'announce' })])).toEqual(['videos/donut.mp4'])
  })

  it('is no videos when .studio is missing', async () => {
    expect(await readMadeVideos(path.join(studio, 'nowhere'), [])).toEqual([])
  })

  it('serves only a project’s renders and the lesson videos, never a path out of .studio', () => {
    expect(madeFile(studio, 'whats-new-1.1/out/paper-coach-whats-new-1.1.mp4')).toBe(path.join(studio, 'whats-new-1.1/out/paper-coach-whats-new-1.1.mp4'))
    expect(madeFile(studio, 'whats-new-1.1/out/thumbnail.jpg')).toBe(path.join(studio, 'whats-new-1.1/out/thumbnail.jpg'))
    expect(madeFile(studio, 'videos/donut.mp4')).toBe(path.join(studio, 'videos/donut.mp4'))
    for (const id of [
      '../secret/out/x.mp4',
      'whats-new-1.1/out/../../x.mp4',
      'ops/notes.json',
      'social/posts.jsonl',
      'videos/donut-pin.png',
      'videos/../workspace.sqlite',
      '.hidden/out/x.mp4',
      'whats-new-1.1/raw/01.mp4',
      '/etc/out/x.mp4',
      '',
    ]) {
      expect(madeFile(studio, id), id).toBeNull()
    }
  })

  it('names a project by its folder', () => {
    expect(projectTitle('whats-new-1.1')).toBe('What’s new in 1.1')
    expect(projectTitle('overview-1.0')).toBe('Overview of 1.0')
    expect(projectTitle('long-landscape')).toBe('Long landscape')
  })

  it('says what each is and when it goes out', () => {
    expect(madeKind({ id: 'whats-new-1.1/out/a.mp4', kind: 'wide' })).toBe('What’s new video')
    expect(madeKind({ id: 'overview-1.0/out/a.mp4', kind: 'wide' })).toBe('Overview')
    expect(madeKind({ id: 'videos/donut-speed.mp4', kind: 'speed' })).toBe('Speed draw')
    expect(madeNote({ id: 'whats-new-1.1/out/a.mp4', kind: 'wide' })).toBe('Goes to every platform as it is, the day 1.1 is on sale.')
    expect(madeNote({ id: 'videos/donut.mp4', kind: 'lesson' }, 'Saturday, October 3')).toBe('A preview: the post on Saturday, October 3 makes the video again.')
    expect(madeNote({ id: 'videos/donut.mp4', kind: 'lesson' })).toMatch(/when this lesson’s turn comes/)
    expect(fileSize(820_400)).toBe('820 KB')
    expect(fileSize(2_000_000)).toBe('2 MB')
    expect(fileSize(2_450_000)).toBe('2.5 MB')
    expect(fileSize(14_398_040)).toBe('14 MB')
  })

  it('reaches the Social page from this Mac’s record, and not from the repo’s copy', async () => {
    make('whats-new-1.1/out/whats-new.mp4', '2026-10-03T03:20:00Z')
    const files = { record: path.join(studio, 'social', 'posts.jsonl'), kept: path.join(studio, 'ops', 'history', 'social', 'posts.jsonl') }
    const lessons = { title: () => undefined, made: (records: SocialRecord[]) => readMadeVideos(studio, records) }
    expect((await readSocialPosts(files, lessons)).made?.map((video) => video.id)).toEqual(['whats-new-1.1/out/whats-new.mp4'])
    mkdirSync(path.dirname(files.kept), { recursive: true })
    writeFileSync(files.kept, '')
    expect((await readSocialPosts(files, lessons)).made).toBeUndefined()
    // A list that can't be made leaves it out rather than failing the page.
    const broken = { title: () => undefined, made: () => Promise.reject(new Error('no')) }
    expect((await readSocialPosts({ ...files, kept: path.join(studio, 'none') }, broken)).made).toBeUndefined()
  })
})
