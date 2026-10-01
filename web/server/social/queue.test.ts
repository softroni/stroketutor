import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { postingOrder, postStates, type QueueEntry, type QueuePath, type SocialRecord } from './posts'
import {
  hourOn,
  lastLessonVideo,
  mayPost,
  pathsOnSale,
  POSTING_HOUR,
  postingQueue,
  postingRuns,
  stillToPost,
  tooSoonAfter,
} from './queue'

const onSalePaths: QueuePath[] = [
  { id: 'plants', title: 'Plants', lessonIds: ['palm-tree', 'cactus', 'bonsai', 'big-oak'] },
  { id: 'space', title: 'Space', lessonIds: ['rocket', 'comet'] },
]

describe('the posting queue', () => {
  let repo: string

  beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), 'studio-queue-'))
  })

  afterEach(() => rmSync(repo, { recursive: true, force: true }))

  const write = (file: string, text: string) => {
    mkdirSync(path.dirname(path.join(repo, file)), { recursive: true })
    writeFileSync(path.join(repo, file), text)
  }

  /** A repository whose build `1.0(2)` has `paths` in its catalog, with `live` in facts.json. */
  const tagged = (paths: QueuePath[], live: Record<string, unknown> | null = { version: '1.0', build: '2' }) => {
    const git = (...args: string[]) => execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { stdio: 'pipe' })
    write('shared/Catalog/paths.json', JSON.stringify({ paths }))
    git('init', '-q')
    git('add', 'shared/Catalog')
    git('commit', '-qm', 'build')
    git('tag', '1.0(2)')
    write('.studio/ops/facts.json', JSON.stringify({ versions: { live, pending: null } }))
  }

  it('reads the paths of the build on sale from its tag, and nothing where that is unknown', async () => {
    expect(await pathsOnSale(repo)).toBeNull()
    tagged(onSalePaths)
    expect(await pathsOnSale(repo)).toEqual(onSalePaths)
    write('.studio/ops/facts.json', JSON.stringify({ versions: { live: { version: '1.0' } } }))
    expect(await pathsOnSale(repo)).toBeNull()
    write('.studio/ops/facts.json', JSON.stringify({ versions: { live: { version: '9.9', build: '1' } } }))
    expect(await pathsOnSale(repo)).toBeNull()
  })

  it('posts from the version on sale, with the two lists in docs/ops', async () => {
    tagged(onSalePaths)
    write('docs/ops/social-up-next.txt', '# moved up after a good week\ncomet\n')
    write('docs/ops/social-premium-first.txt', '# the most eye-catching first\nbig-oak\n')
    const working: QueuePath[] = [...onSalePaths, { id: 'cars', title: 'Cars', lessonIds: ['classic-red-car'] }]
    const queue = await postingQueue(repo, working)
    expect(queue.paths).toEqual(onSalePaths)
    expect(queue.order).toEqual(postingOrder(onSalePaths))
    expect(queue.upNext).toEqual(['comet'])
    expect(queue.premiumFirst).toEqual(['big-oak'])
    expect([...queue.inApp!].sort()).toEqual(['big-oak', 'bonsai', 'cactus', 'comet', 'palm-tree', 'rocket'])
  })

  it('falls back to the working curriculum where the version on sale is unknown', async () => {
    const queue = await postingQueue(repo, onSalePaths)
    expect(queue.order).toEqual(postingOrder(onSalePaths))
    expect(queue.inApp).toBeNull()
  })

  it('lets a published lesson go, edited since or not, and only one in the version on sale when that is known', () => {
    const known = { inApp: new Set(['palm-tree']) }
    expect(mayPost(known, 'palm-tree', 'published')).toBe(true)
    expect(mayPost(known, 'palm-tree', 'published-edited')).toBe(true)
    expect(mayPost(known, 'palm-tree', 'workspace')).toBe(false)
    expect(mayPost(known, 'cactus', 'published')).toBe(false)
    expect(mayPost({ inApp: null }, 'cactus', 'published')).toBe(true)
    expect(mayPost({ inApp: null }, 'cactus', undefined)).toBe(false)
  })

  it('owes a video to every lesson not posted yet that may go, in order', () => {
    const order: QueueEntry[] = ['palm-tree', 'rocket', 'cactus', 'comet'].map((lessonId, index) => ({ lessonId, pathId: 'p', number: index + 1, free: true }))
    expect(stillToPost({ order }, new Set(['palm-tree']), (lessonId) => lessonId !== 'cactus').map((entry) => entry.lessonId)).toEqual(['rocket', 'comet'])
  })

  describe('free and Premium by turns (social-plan.md, Decisions, 2026-09-30)', () => {
    const lesson = (lessonId: string, free: boolean): QueueEntry => ({ lessonId, pathId: 'p', number: 1, free })
    // In posting order: the free lessons of each path come first, the Premium ones after.
    const order = [lesson('f1', true), lesson('f2', true), lesson('f3', true), lesson('p1', false), lesson('p2', false), lesson('p3', false)]
    const ids = (entries: QueueEntry[]) => entries.map((entry) => entry.lessonId)
    const lastVideo = (lessonId: string) => postStates([{ kind: 'post', at: '2026-09-30T22:00:00Z', lessonId, profile: 's', platforms: ['youtube'], private: false, requestId: 'r', outcome: 'sent' }])[0]
    const everything = () => true

    it('starts free before anything has gone out, then takes turns', () => {
      expect(ids(stillToPost({ order }, new Set(), everything))).toEqual(['f1', 'p1', 'f2', 'p2', 'f3', 'p3'])
    })

    it('follows a free lesson with a Premium one, and a Premium one with a free one', () => {
      expect(ids(stillToPost({ order }, new Set(['f1']), everything, lastVideo('f1')))).toEqual(['p1', 'f2', 'p2', 'f3', 'p3'])
      expect(ids(stillToPost({ order }, new Set(['f1', 'p1']), everything, lastVideo('p1')))).toEqual(['f2', 'p2', 'f3', 'p3'])
    })

    it('takes the Premium lessons in the premium-first order, then the rest in posting order', () => {
      expect(ids(stillToPost({ order, premiumFirst: ['p3', 'f2', 'nowhere'] }, new Set(), everything))).toEqual(['f1', 'p3', 'f2', 'p1', 'f3', 'p2'])
    })

    it('puts the up-next lessons first, and takes turns from the last of them', () => {
      // Watermelon Slice on 2026-10-01 was free and up next, so Premium follows it.
      expect(ids(stillToPost({ order, upNext: ['f2'] }, new Set(['f1']), everything, lastVideo('f1')))).toEqual(['f2', 'p1', 'f3', 'p2', 'p3'])
    })

    it('takes a lesson from another path than the day before where it can', () => {
      const paths = [
        { lessonId: 'cupcake', pathId: 'food', number: 7, free: false },
        { lessonId: 'donut', pathId: 'food', number: 1, free: true },
        { lessonId: 'cube', pathId: 'forms', number: 1, free: true },
      ]
      expect(ids(stillToPost({ order: paths }, new Set(), everything, lastVideo('sun')))).toEqual(['donut', 'cupcake', 'cube'])
      // After the cupcake, the donut would make two food days in a row: the cube goes first.
      expect(ids(stillToPost({ order: paths, premiumFirst: ['cupcake'] }, new Set(), everything, lastVideo('nothing-free')))).toEqual(['donut', 'cupcake', 'cube'])
      const afterCupcake = postStates([{ kind: 'post', at: '2026-10-04T22:00:00Z', lessonId: 'cupcake', profile: 's', platforms: ['youtube'], private: false, requestId: 'r', outcome: 'sent' }])[0]
      expect(ids(stillToPost({ order: paths }, new Set(['cupcake']), everything, afterCupcake))).toEqual(['cube', 'donut'])
    })

    it('carries on with one kind when the other runs out, and skips what may not go', () => {
      expect(ids(stillToPost({ order }, new Set(['f1', 'f2', 'f3']), (lessonId) => lessonId !== 'p2', lastVideo('f3')))).toEqual(['p1', 'p3'])
    })
  })
})

describe('when the daily job posts', () => {
  const post = (requestId: string, at: string, fields: Partial<Extract<SocialRecord, { kind: 'post' }>> = {}): SocialRecord => ({
    kind: 'post', at, lessonId: 'palm-tree', profile: 'softroni', platforms: ['youtube'], private: false, requestId, outcome: 'sent', ...fields,
  })
  const at = (iso: string) => Date.parse(iso)

  it('runs at the hour the launch agent says', () => {
    const plist = readFileSync(new URL('../../../docs/ops/com.softroni.papercoach-social.plist', import.meta.url), 'utf8')
    expect(plist).toMatch(new RegExp(`<key>Hour</key>\\s*<integer>${POSTING_HOUR}</integer>`))
  })

  it('finds 17:00 Central on a day, daylight saving or not', () => {
    expect(new Date(hourOn('2026-10-01', 17)).toISOString()).toBe('2026-10-01T22:00:00.000Z')
    // Daylight saving ends at 2 am on November 1, 2026, and starts at 2 am on March 8.
    expect(new Date(hourOn('2026-11-01', 17)).toISOString()).toBe('2026-11-01T23:00:00.000Z')
    expect(new Date(hourOn('2026-03-08', 1)).toISOString()).toBe('2026-03-08T07:00:00.000Z')
    expect(new Date(hourOn('2026-03-08', 3)).toISOString()).toBe('2026-03-08T08:00:00.000Z')
  })

  it('counts the gap from the last lesson video, not a step pin, a speed draw, news or a test', () => {
    const records = [
      post('video', '2026-10-01T04:12:01Z'),
      post('pin', '2026-10-01T04:12:03Z', { media: 'pin', scheduledAt: '2026-10-01T08:12:01Z' }),
      post('news', '2026-10-01T05:00:00Z', { media: 'speed', purpose: 'announce' }),
      post('test', '2026-10-01T06:00:00Z', { private: true }),
    ]
    expect(lastLessonVideo(records)?.post.requestId).toBe('video')
    expect(lastLessonVideo([])).toBeNull()
    const last = postStates(records).find((state) => state.post.requestId === 'video')!
    expect(tooSoonAfter(last, at('2026-10-01T16:12:00Z'))).toBe(true)
    expect(tooSoonAfter(last, at('2026-10-01T16:12:01Z'))).toBe(false)
  })

  it('posts each day at 17:00 from the next run', () => {
    // At 3 pm on September 30: that day's run is still to come.
    expect(postingRuns(at('2026-09-30T20:00:00Z'), null, 2)).toEqual(['2026-09-30T22:00:00.000Z', '2026-10-01T22:00:00.000Z'])
    // At 17:00 itself the run is under way: the next is the day after.
    expect(postingRuns(at('2026-10-01T22:00:00Z'), null, 1)).toEqual(['2026-10-02T22:00:00.000Z'])
    expect(postingRuns(at('2026-09-30T20:00:00Z'), null, 0)).toEqual([])
  })

  it('skips a run that would come within 12 hours of the last lesson video', () => {
    // The first real post went out at 23:12 on September 30: the next 17:00 is nearly 18 hours on.
    const late = lastLessonVideo([post('video', '2026-10-01T04:12:01Z')])
    expect(postingRuns(at('2026-10-01T04:30:00Z'), late, 2)).toEqual(['2026-10-01T22:00:00.000Z', '2026-10-02T22:00:00.000Z'])
    // One posted by hand at 7 am leaves that day's 17:00 run nothing to do.
    const morning = lastLessonVideo([post('video', '2026-10-01T12:00:00Z')])
    expect(postingRuns(at('2026-10-01T15:00:00Z'), morning, 2)).toEqual(['2026-10-02T22:00:00.000Z', '2026-10-03T22:00:00.000Z'])
  })

  it('keeps to 17:00 Central across the end of daylight saving', () => {
    expect(postingRuns(at('2026-10-31T23:30:00Z'), null, 2)).toEqual(['2026-11-01T23:00:00.000Z', '2026-11-02T23:00:00.000Z'])
  })
})
