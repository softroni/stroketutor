import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import type { LessonState } from '../../src/catalog/publishing'

import {
  dayOf,
  parseUpNext,
  POSTING_TIME_ZONE,
  postingOrder,
  postStates,
  type PostState,
  type QueueEntry,
  type QueuePath,
  type SocialRecord,
} from './posts'

/**
 * Which lesson the daily job posts next, and when: shared by `studio social
 * next`, which posts it, and the Studio's Social page, which shows what is
 * coming, so the two never disagree. The lessons are the version on sale's:
 * the up-next list first, then a free lesson and a Premium one by turns
 * (docs/ops/social-plan.md, *Decisions*); a lesson goes out once, and never
 * two within POST_GAP_HOURS.
 */

/** When the launch agent runs `social next` (docs/ops/com.softroni.papercoach-social.plist): 17:00 Central. */
export const POSTING_HOUR = 17

/** Hours between a lesson's video and its step pin on Pinterest: the evening's second pin. */
export const PIN_DELAY_HOURS = 4

/** `social next` posts no lesson within this many hours of the last one, so the daily job can't post twice in a day. */
export const POST_GAP_HOURS = 12

/**
 * The paths of the version on sale, from the tag of its build (`1.0(2)`), so a
 * video never sends people to a lesson that is only on main. Null when that is
 * unknown here: no `facts.json`, nothing live, or no such tag.
 */
export async function pathsOnSale(repoDir: string): Promise<QueuePath[] | null> {
  const text = await readFile(path.join(repoDir, '.studio', 'ops', 'facts.json'), 'utf8').catch(() => null)
  const live = text ? (JSON.parse(text) as { versions?: { live?: { version?: string; build?: string } | null } }).versions?.live : null
  if (!live?.version || !live.build) return null
  try {
    const { stdout } = await promisify(execFile)('git', ['-C', repoDir, 'show', `${live.version}(${live.build}):shared/Catalog/paths.json`], { maxBuffer: 16 << 20 })
    return (JSON.parse(stdout) as { paths: QueuePath[] }).paths
  } catch {
    return null
  }
}

export interface PostingQueue {
  /** The paths as on sale, or the working curriculum's where that is unknown: their titles, boards and colors. */
  paths: QueuePath[]
  /** Every lesson in `postingOrder` (lesson 1 of every path, then lesson 2…): which are free, and each one's place. */
  order: QueueEntry[]
  /** docs/ops/social-up-next.txt: lessons posted before any other, in that order. */
  upNext: string[]
  /** docs/ops/social-premium-first.txt: the Premium lessons to post first, the most eye-catching first. */
  premiumFirst: string[]
  /** The lessons of the version on sale; null where that is unknown, and any published lesson may go. */
  inApp: Set<string> | null
}

/**
 * What `social next` posts from: the paths of the version on sale
 * (`workingPaths` where that is unknown) in `postingOrder`, and the two lists
 * in docs/ops that put lessons first. `stillToPost` makes the order of them.
 */
export async function postingQueue(repoDir: string, workingPaths: QueuePath[]): Promise<PostingQueue> {
  const onSale = await pathsOnSale(repoDir)
  const paths = onSale ?? workingPaths
  const list = async (name: string) => parseUpNext(await readFile(path.join(repoDir, 'docs', 'ops', name), 'utf8').catch(() => ''))
  return {
    paths,
    order: postingOrder(paths),
    upNext: await list('social-up-next.txt'),
    premiumFirst: await list('social-premium-first.txt'),
    inApp: onSale ? new Set(onSale.flatMap((entry) => entry.lessonIds)) : null,
  }
}

/** Whether a lesson may go out: published (in `shared/`, edited since or not), and in the version on sale where that is known. */
export function mayPost(queue: Pick<PostingQueue, 'inApp'>, lessonId: string, state: LessonState | undefined): boolean {
  return (state === 'published' || state === 'published-edited') && (queue.inApp?.has(lessonId) ?? true)
}

/**
 * The lessons still owed their video (never posted, and `allowed` to go), in
 * the order the daily job posts them: the up-next lessons first; then a free
 * lesson and a Premium one by turns, starting with the kind `last` (the last
 * lesson video) wasn't, or free before anything has gone out. Free lessons go
 * in posting order; Premium ones in the premium-first list's order, the rest
 * after in posting order. Each turn takes the first of its kind from another
 * path than the lesson before, so two days in a row never show the same path
 * where it can be helped. When one kind runs out, the other carries on.
 * `social next` posts the first Lina has narrated.
 */
export function stillToPost(
  queue: Pick<PostingQueue, 'order'> & Partial<Pick<PostingQueue, 'upNext' | 'premiumFirst'>>,
  posted: Set<string>,
  allowed: (lessonId: string) => boolean,
  last: PostState | null = null,
): QueueEntry[] {
  const byId = new Map(queue.order.map((entry) => [entry.lessonId, entry]))
  const owed = (entry: QueueEntry | undefined): entry is QueueEntry => Boolean(entry) && !posted.has(entry!.lessonId) && allowed(entry!.lessonId)
  const listed = (ids: string[] = []) => [...new Set(ids)].map((id) => byId.get(id)).filter(owed)
  const first = listed(queue.upNext)
  const placed = new Set(first.map((entry) => entry.lessonId))
  const rest = queue.order.filter((entry) => owed(entry) && !placed.has(entry.lessonId))
  const premiumListed = listed(queue.premiumFirst).filter((entry) => !entry.free && !placed.has(entry.lessonId))
  const premiumIds = new Set(premiumListed.map((entry) => entry.lessonId))
  const free = rest.filter((entry) => entry.free)
  const premium = [...premiumListed, ...rest.filter((entry) => !entry.free && !premiumIds.has(entry.lessonId))]

  const before = first.length > 0 ? first[first.length - 1] : last ? byId.get(last.post.lessonId) : undefined
  const order = [...first]
  let previous = before
  let wantFree = previous ? !previous.free : true
  while (free.length > 0 || premium.length > 0) {
    const pool = (wantFree && free.length > 0) || premium.length === 0 ? free : premium
    const otherPath = pool.findIndex((entry) => entry.pathId !== previous?.pathId)
    const [next] = pool.splice(Math.max(otherPath, 0), 1)
    order.push(next)
    previous = next
    wantFree = !next.free
  }
  return order
}

/** The last lesson video that went out for everyone: its step pin, a speed draw or news don't hold the next lesson back. */
export function lastLessonVideo(records: SocialRecord[]): PostState | null {
  return postStates(records).find(({ post }) => !post.private && (post.purpose ?? 'lesson') === 'lesson' && (post.media ?? 'video') === 'video') ?? null
}

/** Whether a lesson posted at `at` (ms) would follow `last` within POST_GAP_HOURS, which `social next` refuses. */
export function tooSoonAfter(last: PostState, at: number): boolean {
  return at - Date.parse(last.post.at) < POST_GAP_HOURS * 3600_000
}

/**
 * When the daily job will post the next `count` lessons: at POSTING_HOUR
 * Central on each day from its first run after `now`. A run too soon after the
 * last lesson video posts nothing, so then the first is the day after.
 */
export function postingRuns(now: number, last: PostState | null, count: number): string[] {
  let day = dayOf(new Date(now).toISOString())
  if (hourOn(day, POSTING_HOUR) <= now) day = dayAfter(day)
  if (last && tooSoonAfter(last, hourOn(day, POSTING_HOUR))) day = dayAfter(day)
  const runs: string[] = []
  for (let index = 0; index < count; index += 1, day = dayAfter(day)) runs.push(new Date(hourOn(day, POSTING_HOUR)).toISOString())
  return runs
}

/** The moment (ms) it is `hour`:00 on `day` (YYYY-MM-DD) in the posting time zone, daylight saving or not. */
export function hourOn(day: string, hour: number, timeZone = POSTING_TIME_ZONE): number {
  const [year, month, date] = day.split('-').map(Number)
  const wall = Date.UTC(year, month - 1, date, hour)
  // The zone's offset is read from its clock at a first guess, then again in case the guess fell across a change.
  let at = wall
  for (let pass = 0; pass < 2; pass += 1) at = wall - offsetAt(at, timeZone)
  return at
}

/** How far ahead of UTC the zone's clock is at `at`, in ms (negative for Central). */
function offsetAt(at: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(at))
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((candidate) => candidate.type === type)?.value)
  return Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second')) - Math.floor(at / 1000) * 1000
}

function dayAfter(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date + 1)).toISOString().slice(0, 10)
}
