import type { PostEntry } from '../../server/social/posts'

import { daysBetween, type Tone } from './today'

/**
 * The Social page: every lesson video, speed draw, step pin and piece of
 * release news `studio social` posted to Softroni's accounts (docs/ops/README.md,
 * "Lesson videos on social"), day by day, with each platform's link. The Studio
 * server reads the record (`server/socialPosts.ts`); this is what the page
 * makes of it.
 */

/** One post, as `server/social/posts.ts` makes it for the repo's copy and for this page. */
export type SocialPost = PostEntry
export type SocialPlatform = PostEntry['platforms'][number]

/** A lesson the daily job is going to post, as `social next` will pick it. */
export interface ComingPost {
  /** When the job posts it (ISO): 17:00 Central. */
  at: string
  /** When its step pin follows on Pinterest (ISO). */
  pinAt: string
  lessonId: string
  title?: string
  /** One of the lessons the app gives away, or one Premium unlocks. */
  free: boolean
}

/** What the server answers for GET /api/social/posts. */
export interface SocialResponse {
  /** Every post that went out, test posts left out, by day: newest day and newest post first. */
  days: { day: string; posts: SocialPost[] }[]
  /** The lessons the daily job posts next, one a day, soonest first; null where there is no record of what was posted to go by. */
  coming: ComingPost[] | null
  /** Why what comes next couldn't be worked out, when it couldn't. */
  comingProblem?: string
  /** Where the posts were read: this Mac's record, the repo's copy of the finished posts (another machine), or neither yet. */
  source: 'record' | 'kept' | null
  /** The posting job's time zone, which the days and times are in. */
  timeZone: string
  /** Today's date there, YYYY-MM-DD. */
  today: string
}

const PLATFORM_NAMES: Record<string, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  facebook: 'Facebook',
  threads: 'Threads',
  pinterest: 'Pinterest',
  x: 'X',
}

/** A platform as it writes its own name: YouTube, TikTok, X. */
export function platformName(platform: string): string {
  return PLATFORM_NAMES[platform] ?? `${platform.charAt(0).toUpperCase()}${platform.slice(1)}`
}

/** What went out: a lesson's whole video, its speed draw or its step pin, or release news over a speed draw. */
export function postKind(post: Pick<SocialPost, 'media' | 'purpose'>): string {
  if (post.purpose === 'announce') return 'Release news'
  if (post.media === 'speed') return 'Speed draw'
  if (post.media === 'pin') return 'Step pin'
  return 'Lesson video'
}

/**
 * A post's status as a word and a tone: Upload-Post's own, or ours (`scheduled`
 * and `processing` before it has answered, `partial` once every platform has and
 * some failed). Anything still at work is waiting.
 */
export function postStatus(status: string): { word: string; tone: Tone } {
  switch (status) {
    case 'completed':
      return { word: 'Posted', tone: 'good' }
    case 'partial':
      return { word: 'Partly posted', tone: 'attention' }
    case 'failed':
      return { word: 'Failed', tone: 'bad' }
    case 'not_found':
      return { word: 'Not found', tone: 'bad' }
    case 'scheduled':
      return { word: 'Scheduled', tone: 'neutral' }
    default:
      return { word: 'Processing', tone: 'waiting' }
  }
}

export interface PlatformState {
  /** `live`: up for everyone. `waiting`: not yet. `held`: up but not published, or never answered. `failed`: it said no. */
  state: 'live' | 'waiting' | 'held' | 'failed'
  /** What the line says: the post's address, shortened, or why there is none. */
  words: string
  /** Where the post is, when it is up and the platform gave its address. */
  url: string | null
}

/**
 * Where one platform stands on a post: its link once it is up; else "still
 * processing", "scheduled for 3:12 AM", "in TikTok’s inbox, not published", or
 * the error the platform gave. `time` says a moment as a time of day.
 */
export function platformState(
  platform: SocialPlatform,
  post: Pick<SocialPost, 'status' | 'at'>,
  time: (iso: string) => string,
): PlatformState {
  if (platform.inbox) return { state: 'held', words: `in ${platformName(platform.platform)}’s inbox, not published`, url: null }
  if (platform.ok) return { state: 'live', words: platform.url ? shortLink(platform.url) : 'posted, with no link given', url: platform.url }
  if (platform.ok === false) return { state: 'failed', words: platform.error || 'failed, with no reason given', url: null }
  if (post.status === 'scheduled') return { state: 'waiting', words: `scheduled for ${time(post.at)}`, url: null }
  if (postStatus(post.status).tone === 'waiting') return { state: 'waiting', words: 'still processing', url: null }
  return { state: 'held', words: 'no answer from Upload-Post', url: null }
}

/** A post's address as a person reads it, without the scheme or `www.`: youtube.com/watch?v=w6lmWyYtzGE. */
export function shortLink(url: string): string {
  try {
    const { host, pathname, search } = new URL(url)
    return `${host.replace(/^www\./, '')}${pathname.replace(/\/$/, '')}${search}`
  } catch {
    return url
  }
}

/** How far a post got, for the line under its title: "on all 7 platforms", "on 5 of 7 platforms"; nothing for one platform, or before it is up anywhere. */
export function reach(post: Pick<SocialPost, 'status' | 'platforms'>): string | null {
  const total = post.platforms.length
  const live = post.platforms.filter((platform) => platform.ok).length
  if (total < 2 || live === 0) return null
  if (live === total) return total === 2 ? 'on both platforms' : `on all ${total} platforms`
  return `on ${live} of ${total} platforms${postStatus(post.status).tone === 'waiting' ? ' so far' : ''}`
}

/** The line under the page's title: how many posts so far and over how many days, and any still to go out. */
export function tally(days: SocialResponse['days']): string {
  const posts = days.flatMap((day) => day.posts)
  const scheduled = posts.filter((post) => post.status === 'scheduled').length
  const sent = posts.length - scheduled
  const sentDays = days.filter((day) => day.posts.some((post) => post.status !== 'scheduled')).length
  const later = scheduled ? `${scheduled} scheduled` : ''
  if (!sent) return later ? `Nothing posted yet; ${later}.` : 'Nothing posted yet.'
  const so = `${sent} ${sent === 1 ? 'post' : 'posts'} so far, ${sentDays === 1 ? 'on one day' : `over ${sentDays} days`}`
  return later ? `${so}, and ${later}.` : `${so}.`
}

/** "Today", "Tomorrow" or "Yesterday" for a day beside `today` (both YYYY-MM-DD, in the posting time zone); null further off. */
export function nearDay(day: string, today: string): string | null {
  const offset = daysBetween(today, day)
  if (offset === 0) return 'Today'
  if (offset === 1) return 'Tomorrow'
  if (offset === -1) return 'Yesterday'
  return null
}
