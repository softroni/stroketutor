import { promises as fs } from 'node:fs'

import type { ComingPost, MadeVideo, SocialResponse } from '../src/studio/social'
import { DAY } from '../src/studio/today'

import {
  dayOf,
  entriesByDay,
  postedLessons,
  postsByDay,
  POSTING_TIME_ZONE,
  type PostEntry,
  type QueueEntry,
  type SocialRecord,
} from './social/posts'
import { lastLessonVideo, PIN_DELAY_HOURS, postingRuns, stillToPost } from './social/queue'

/** How many of the lessons coming the page shows: a week of daily posts. */
export const COMING_SHOWN = 7

/** What the page needs of the working library and the curriculum on sale. */
export interface SocialLessons {
  /** A lesson's title, where the working library has it. */
  title: (lessonId: string) => string | undefined
  /** The posting order and which lessons may go, as `social next` reads them (server/social/queue.ts); without it, nothing shows as coming. */
  queue?: () => Promise<{ order: QueueEntry[]; upNext?: string[]; premiumFirst?: string[]; allowed: (lessonId: string) => boolean }>
  /** The videos made on this Mac that haven't gone out, given what was posted (server/socialMade.ts); without it, none show. */
  made?: (records: SocialRecord[]) => Promise<MadeVideo[]>
}

/**
 * The Social page's data: every post `studio social` sent, by day (Central,
 * where the posting job runs), newest first, with each platform's link or what
 * stopped it, and the lessons the daily job posts next. From this Mac's record,
 * `record` (`.studio/social/posts.jsonl`, outside git), or, where there is none
 * (another machine), from `kept`, the repo's copy of the finished posts on the
 * ops-history branch (`.studio/ops/history/social/posts.jsonl`), which can't
 * say what comes next. Test posts, kept private on the platforms, are left out.
 * Read on every request; nothing here writes, and a file that is missing or
 * can't be read is no posts, not an error.
 */
export async function readSocialPosts(
  files: { record: string; kept: string },
  lessons: SocialLessons = { title: () => undefined },
  now = Date.now(),
): Promise<SocialResponse> {
  const shown = (
    source: SocialResponse['source'],
    days: { day: string; posts: PostEntry[] }[],
    coming: Pick<SocialResponse, 'coming' | 'comingProblem'>,
    made?: MadeVideo[],
  ): SocialResponse => ({
    days: days
      .map(({ day, posts }) => ({ day, posts: posts.filter((post) => !post.private) }))
      .filter((day) => day.posts.length > 0),
    ...coming,
    ...(made ? { made } : {}),
    source,
    timeZone: POSTING_TIME_ZONE,
    today: dayOf(new Date(now).toISOString()),
  })
  const records = await readLines(files.record, isRecord)
  if (records) return shown('record', postsByDay(records, lessons.title, now), await comingUp(records, lessons, now), await madeVideos(records, lessons))
  const kept = await readLines(files.kept, isEntry)
  // The working library's title wins over the one kept, so a lesson renamed since reads as it is called now.
  if (kept) return shown('kept', entriesByDay(kept.map((entry) => ({ ...entry, title: lessons.title(entry.lessonId) ?? entry.title }))), { coming: null })
  return shown(null, [], await comingUp([], lessons, now), await madeVideos([], lessons))
}

/** The videos made and not posted; a folder that can't be read leaves the list out rather than failing the page. */
async function madeVideos(records: SocialRecord[], lessons: SocialLessons): Promise<MadeVideo[] | undefined> {
  if (!lessons.made) return undefined
  try {
    return await lessons.made(records)
  } catch {
    return undefined
  }
}

/**
 * The next lessons the daily job will post, one a run, as `social next` picks
 * them (server/social/queue.ts), leaving out its check that Lina has narrated
 * each. A curriculum that can't be read says so, rather than failing the page.
 */
async function comingUp(records: SocialRecord[], lessons: SocialLessons, now: number): Promise<Pick<SocialResponse, 'coming' | 'comingProblem'>> {
  if (!lessons.queue) return { coming: null }
  let queue
  try {
    queue = await lessons.queue()
  } catch (error) {
    return { coming: null, comingProblem: error instanceof Error ? error.message : String(error) }
  }
  const next = stillToPost(queue, postedLessons(records), queue.allowed, lastLessonVideo(records)).slice(0, COMING_SHOWN)
  const runs = postingRuns(now, lastLessonVideo(records), next.length)
  return {
    coming: next.map((entry, index): ComingPost => {
      const title = lessons.title(entry.lessonId)
      return {
        at: runs[index],
        pinAt: new Date(Date.parse(runs[index]) + PIN_DELAY_HOURS * 3600_000).toISOString(),
        lessonId: entry.lessonId,
        ...(title ? { title } : {}),
        free: entry.free,
      }
    }),
  }
}

/** A JSON-lines file's entries, skipping a line that is not one rather than failing the page; null when there is no file to read. */
async function readLines<T>(file: string, is: (value: unknown) => value is T): Promise<T[] | null> {
  const text = await fs.readFile(file, 'utf8').catch(() => null)
  if (text === null) return null
  return text.split('\n').flatMap((line) => {
    if (!line.trim()) return []
    try {
      const value: unknown = JSON.parse(line)
      return is(value) ? [value] : []
    } catch {
      return []
    }
  })
}

const isTime = (value: unknown) => typeof value === 'string' && !Number.isNaN(Date.parse(value))

/** A line of the record with what the page reads of it: a post's time, lesson and platforms, or a status's results. */
function isRecord(value: unknown): value is SocialRecord {
  if (!value || typeof value !== 'object') return false
  const line = value as Record<string, unknown>
  if (typeof line.requestId !== 'string') return false
  if (line.kind === 'status') return typeof line.status === 'string' && typeof line.results === 'object' && line.results !== null
  return (
    line.kind === 'post' &&
    isTime(line.at) &&
    (line.scheduledAt == null || isTime(line.scheduledAt)) &&
    typeof line.lessonId === 'string' &&
    Array.isArray(line.platforms) &&
    line.platforms.every((platform) => typeof platform === 'string')
  )
}

/** A line of the repo's copy: one post on its day, each platform with its name. */
function isEntry(value: unknown): value is PostEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.day === 'string' &&
    DAY.test(entry.day) &&
    isTime(entry.at) &&
    typeof entry.requestId === 'string' &&
    typeof entry.lessonId === 'string' &&
    typeof entry.status === 'string' &&
    Array.isArray(entry.platforms) &&
    entry.platforms.every((platform) => typeof (platform as { platform?: unknown } | null)?.platform === 'string')
  )
}
