import type { Tutorial } from '../../src/schema/types'
import { postCaption, subjectOf, type VideoInput } from '../video/plan'

/**
 * Posting lesson videos to Softroni's social accounts through Upload-Post
 * (docs/ops/README.md, "Lesson videos on social"). This file is the pure part:
 * what each platform is sent, which lesson goes next, and the settings file.
 * `uploadPost.ts` talks to the API; `web/cli/commands/social.ts` is the command.
 */

export const APP_STORE_URL = 'https://apps.apple.com/app/id6816231257'

/**
 * The App Store link a platform's post carries: with Softroni's provider token
 * it is a campaign link (`ct=pinterest`…), so App Store Connect → Analytics →
 * Sources counts downloads per platform; without one, the plain link.
 */
export function appStoreLink(campaign: string, providerToken: string | null): string {
  if (!providerToken) return APP_STORE_URL
  return `https://apps.apple.com/app/apple-store/id6816231257?pt=${encodeURIComponent(providerToken)}&ct=${encodeURIComponent(campaign)}&mt=8`
}

export const PLATFORMS = ['youtube', 'tiktok', 'instagram', 'facebook', 'pinterest', 'x'] as const
export type Platform = (typeof PLATFORMS)[number]

/** What Upload-Post calls each platform in `platform[]` and in its results. */
export const API_PLATFORM: Record<Platform, string> = {
  youtube: 'youtube',
  tiktok: 'tiktok',
  instagram: 'instagram',
  facebook: 'facebook',
  pinterest: 'pinterest',
  x: 'twitter',
}

/** Where a post can be kept to the account for a test: YouTube private, TikTok "only me", a Facebook draft. */
export const PRIVATE_PLATFORMS: Platform[] = ['youtube', 'tiktok', 'facebook']

/** The lessons of each path the app gives away (`PremiumAccess.freeLessonsPerPath`). */
export const FREE_LESSONS_PER_PATH = 3

export interface SocialSettings {
  apiKey: string | null
  /** The Upload-Post profile holding Softroni's accounts. */
  profile: string
  platforms: Platform[]
  pinterestBoard: string | null
  facebookPage: string | null
  /** Which platforms get the AI-generated label: TikTok only by default (Lina's voice is synthetic). */
  aiLabel: 'none' | 'tiktok' | 'all'
  youtubeMadeForKids: boolean
  /** Softroni's App Store provider token, for campaign links; null leaves links plain. */
  providerToken: string | null
}

export const SETTINGS_KEYS = {
  apiKey: 'UPLOAD_POST_API_KEY',
  profile: 'UPLOAD_POST_PROFILE',
  platforms: 'UPLOAD_POST_PLATFORMS',
  pinterestBoard: 'UPLOAD_POST_PINTEREST_BOARD',
  facebookPage: 'UPLOAD_POST_FACEBOOK_PAGE',
  aiLabel: 'UPLOAD_POST_AI_LABEL',
  youtubeMadeForKids: 'UPLOAD_POST_YOUTUBE_MADE_FOR_KIDS',
  providerToken: 'APP_STORE_PROVIDER_TOKEN',
} as const

/** A shell-sourceable `KEY=value` file, as `~/.config/pixabay/config` is: comments, `export` and quotes allowed. */
export function parseConfig(text: string): Record<string, string> {
  const values: Record<string, string> = {}
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1)
    else value = value.replace(/\s+#.*$/, '')
    values[match[1]] = value
  }
  return values
}

/** The settings from the config file, with the environment winning. Throws a sentence when a value is wrong. */
export function socialSettings(values: Record<string, string | undefined>): SocialSettings {
  const get = (key: string) => {
    const value = values[key]?.trim()
    return value ? value : null
  }
  const platforms = (get(SETTINGS_KEYS.platforms) ?? PLATFORMS.join(','))
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean)
    .map((name) => (name === 'twitter' ? 'x' : name))
  const unknown = platforms.filter((name) => !(PLATFORMS as readonly string[]).includes(name))
  if (unknown.length > 0) throw new Error(`${SETTINGS_KEYS.platforms} names ${unknown.join(', ')}; the platforms are ${PLATFORMS.join(', ')}.`)
  const aiLabel = (get(SETTINGS_KEYS.aiLabel) ?? 'tiktok').toLowerCase()
  if (aiLabel !== 'none' && aiLabel !== 'tiktok' && aiLabel !== 'all') throw new Error(`${SETTINGS_KEYS.aiLabel} is none, tiktok or all.`)
  return {
    apiKey: get(SETTINGS_KEYS.apiKey),
    profile: get(SETTINGS_KEYS.profile) ?? 'softroni',
    platforms: [...new Set(platforms)] as Platform[],
    pinterestBoard: get(SETTINGS_KEYS.pinterestBoard),
    facebookPage: get(SETTINGS_KEYS.facebookPage),
    aiLabel,
    youtubeMadeForKids: /^(1|yes|true)$/i.test(get(SETTINGS_KEYS.youtubeMadeForKids) ?? ''),
    providerToken: get(SETTINGS_KEYS.providerToken),
  }
}

// ---------- What each platform is sent ----------

const APP_LINE = 'Paper Coach shows one line at a time and waits while you draw it on real paper.'
const TAGS = ['#howtodraw', '#easydrawing', '#drawwithme', '#drawingtutorial', '#stepbystep']

export interface SocialTexts {
  /** TikTok and Instagram: the caption the video export writes beside the file ("link in bio"). */
  caption: string
  youtubeTitle: string
  youtubeDescription: string
  facebookDescription: string
  pinterestTitle: string
  pinterestDescription: string
  /** Where a pin leads: the App Store. */
  pinterestLink: string
  /** At most 280 characters. Upload-Post strips links from X posts, so there is none. */
  x: string
}

export function socialTexts(tutorial: Tutorial, place: VideoInput['place'], providerToken: string | null = null): SocialTexts {
  const { article, subject } = subjectOf(tutorial.title)
  const what = `${article ? `${article} ` : ''}${subject}`
  const steps = tutorial.steps.filter((step) => step.strokes.length > 0).length
  const opening = `Let’s draw ${what}: ${steps} easy ${steps === 1 ? 'step' : 'steps'}, then color it in.`
  const placeLine = place ? `Lesson ${place.number} of the ${place.pathTitle} path in Paper Coach.` : null
  const tags = [...TAGS, `#${tutorial.id.replace(/-/g, '')}`, '#papercoach'].join(' ')
  const withLink = (campaign: string) =>
    [opening, placeLine, '', APP_LINE, `Free on the App Store: ${appStoreLink(campaign, providerToken)}`, '', tags]
      .filter((line) => line !== null)
      .join('\n')
  return {
    caption: postCaption(tutorial, place),
    youtubeTitle: fit(`How to draw ${what} step by step #shorts`, 100, `How to draw ${what} #shorts`),
    youtubeDescription: withLink('youtube'),
    facebookDescription: withLink('facebook'),
    pinterestTitle: fit(`How to draw ${what}: easy step-by-step drawing`, 100, `How to draw ${what}`),
    pinterestDescription: fit(
      [opening, APP_LINE, 'Free on the App Store.', '', tags].join('\n'),
      500,
      [opening, 'Free on the App Store.'].join('\n'),
    ),
    pinterestLink: appStoreLink('pinterest', providerToken),
    x: fit(
      [`${opening} ✏️`, '', `${APP_LINE} Free on the App Store.`, '', '#howtodraw #drawingtutorial'].join('\n'),
      280,
      `${opening} ✏️\n\nFree on the App Store: Paper Coach.`,
    ),
  }
}

/** The text when it fits, else the shorter one, cut if even that is too long. */
function fit(text: string, max: number, shorter: string): string {
  if ([...text].length <= max) return text
  if ([...shorter].length <= max) return shorter
  return `${[...shorter].slice(0, max - 1).join('')}…`
}

export interface PostRequest {
  profile: string
  platforms: Platform[]
  texts: SocialTexts
  settings: Pick<SocialSettings, 'pinterestBoard' | 'facebookPage' | 'aiLabel' | 'youtubeMadeForKids'>
  /** A test: private where the platform allows it (the caller keeps it to PRIVATE_PLATFORMS). */
  private: boolean
  /** Our own id for the post, echoed back in Upload-Post's status and history. */
  externalId: string
  requestId: string
  /** ISO-8601 with an offset; posts at once when absent. */
  scheduledAt?: string | null
  altText: string
}

/** The multipart fields of one upload, except the video itself. Order is kept, and `platform[]` repeats. */
export function uploadFields(request: PostRequest): [string, string][] {
  const { texts, settings, platforms } = request
  const has = (platform: Platform) => platforms.includes(platform)
  const fields: [string, string][] = [['user', request.profile]]
  for (const platform of platforms) fields.push(['platform[]', API_PLATFORM[platform]])
  fields.push(['title', texts.youtubeTitle], ['external_id', request.externalId], ['request_id', request.requestId])
  if (request.scheduledAt) fields.push(['scheduled_date', request.scheduledAt])
  else fields.push(['async_upload', 'true'])
  if (settings.aiLabel === 'all') fields.push(['is_ai_generated', 'true'])

  if (has('youtube')) {
    fields.push(
      ['youtube_title', texts.youtubeTitle],
      ['youtube_description', texts.youtubeDescription],
      ['categoryId', '26'], // Howto & Style
      ['privacyStatus', request.private ? 'private' : 'public'],
      ['selfDeclaredMadeForKids', String(settings.youtubeMadeForKids)],
      ['defaultLanguage', 'en'],
      ['defaultAudioLanguage', 'en'],
    )
  }
  if (has('tiktok')) {
    fields.push(
      ['tiktok_title', texts.caption],
      // The videos promote Softroni's own app, which TikTok asks to be disclosed ("Promotional content").
      ['brand_organic_toggle', 'true'],
    )
    if (request.private) fields.push(['privacy_level', 'SELF_ONLY'])
    if (settings.aiLabel === 'tiktok') fields.push(['tiktok_is_ai_generated', 'true'])
  }
  if (has('instagram')) {
    fields.push(['instagram_title', texts.caption], ['media_type', 'REELS'], ['share_to_feed', 'true'])
  }
  if (has('facebook')) {
    fields.push(['facebook_title', texts.youtubeTitle.replace(/\s*#shorts$/, '')], ['facebook_description', texts.facebookDescription], ['facebook_media_type', 'REELS'])
    if (settings.facebookPage) fields.push(['facebook_page_id', settings.facebookPage])
    if (request.private) fields.push(['video_state', 'DRAFT'])
  }
  if (has('pinterest')) {
    fields.push(
      ['pinterest_title', texts.pinterestTitle],
      ['pinterest_description', texts.pinterestDescription],
      ['pinterest_link', texts.pinterestLink],
      ['pinterest_alt_text', request.altText],
    )
    if (settings.pinterestBoard) fields.push(['pinterest_board_id', settings.pinterestBoard])
  }
  if (has('x')) fields.push(['x_title', texts.x])
  return fields
}

// ---------- Which lesson goes next ----------

export interface QueuePath {
  id: string
  title: string
  lessonIds: string[]
}

export interface QueueEntry {
  lessonId: string
  pathId: string
  /** 1-based, in the path. */
  number: number
  free: boolean
}

/**
 * Every lesson in the order it is posted: lesson 1 of every path in curriculum
 * order, then lesson 2 of every path, and so on. Consecutive posts are never
 * from the same path, and the free lessons (the first three of each) all come
 * before any Premium one.
 */
export function postingOrder(paths: QueuePath[]): QueueEntry[] {
  const longest = Math.max(0, ...paths.map((entry) => entry.lessonIds.length))
  const order: QueueEntry[] = []
  for (let index = 0; index < longest; index += 1) {
    for (const entry of paths) {
      const lessonId = entry.lessonIds[index]
      if (lessonId) order.push({ lessonId, pathId: entry.id, number: index + 1, free: index < FREE_LESSONS_PER_PATH })
    }
  }
  return order
}

/**
 * `docs/ops/social-up-next.txt`: one lesson id a line (`#` comments), posted
 * before the rest of the queue, in that order. How the weekly review moves
 * subjects that do well up.
 */
export function parseUpNext(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/#.*$/, '').trim())
    .filter(Boolean)
}

/** The posting order with the up-next lessons first; an id not in the order (not on sale) is left out. */
export function withUpNext(order: QueueEntry[], upNext: string[]): QueueEntry[] {
  const first = upNext.flatMap((lessonId) => order.filter((entry) => entry.lessonId === lessonId))
  const firstIds = new Set(first.map((entry) => entry.lessonId))
  return [...first, ...order.filter((entry) => !firstIds.has(entry.lessonId))]
}

// ---------- The record of what was posted ----------

export interface PlatformResult {
  success: boolean
  url?: string | null
  /** The platform's own id for the post, which a private video has instead of a link. */
  postId?: string | null
  error?: string | null
}

/** One line of `.studio/social/posts.jsonl`, which only grows. */
export type SocialRecord =
  | {
      kind: 'post'
      at: string
      lessonId: string
      profile: string
      platforms: Platform[]
      private: boolean
      requestId: string
      jobId?: string | null
      scheduledAt?: string | null
      /** `sent`: Upload-Post took it. `refused`: it said no, and nothing was posted. */
      outcome: 'sent' | 'refused'
      message?: string | null
    }
  | {
      kind: 'status'
      at: string
      requestId: string
      /** Upload-Post's overall status: pending, queued, processing, in_progress, completed, failed. */
      status: string
      results: Record<string, PlatformResult>
    }

/** `partial`: every platform answered, and some failed. Ours, not Upload-Post's. */
export const FINAL_STATUSES = new Set(['completed', 'partial', 'failed', 'not_found'])

/**
 * Upload-Post's status, or ours once every platform has answered: a platform
 * that never reports (one not connected to the profile, say) would otherwise
 * leave the post "in_progress" for good.
 */
export function settledStatus(status: string, results: Record<string, PlatformResult>, platforms: Platform[]): string {
  if (FINAL_STATUSES.has(status)) return status
  const answered = platforms.map((platform) => results[platform]).filter((result): result is PlatformResult => Boolean(result))
  if (answered.length < platforms.length || platforms.length === 0) return status
  if (answered.every((result) => result.success)) return 'completed'
  return answered.some((result) => result.success) ? 'partial' : 'failed'
}

export interface PostState {
  post: Extract<SocialRecord, { kind: 'post' }>
  /** The latest status seen for it, if any. */
  status: Extract<SocialRecord, { kind: 'status' }> | null
}

/** Every post that was sent, newest first, with the last status seen for each. */
export function postStates(records: SocialRecord[]): PostState[] {
  const statuses = new Map<string, Extract<SocialRecord, { kind: 'status' }>>()
  for (const record of records) if (record.kind === 'status') statuses.set(record.requestId, record)
  return records
    .filter((record): record is Extract<SocialRecord, { kind: 'post' }> => record.kind === 'post' && record.outcome === 'sent')
    .map((post) => ({ post, status: statuses.get(post.requestId) ?? null }))
    .reverse()
}

/** Lessons already posted for everyone to see: a test post, or one that failed everywhere, doesn't count. */
export function postedLessons(records: SocialRecord[]): Set<string> {
  const posted = new Set<string>()
  for (const { post, status } of postStates(records)) {
    if (post.private) continue
    if (status && FINAL_STATUSES.has(status.status) && !Object.values(status.results).some((result) => result.success)) continue
    posted.add(post.lessonId)
  }
  return posted
}

const STILL_WORKING = new Set(['pending', 'queued', 'processing', 'in_progress', 'retryable'])

/** Upload-Post's per-platform results (an object by platform, or a list with `platform`) in one shape; those still at work are left out. */
export function normaliseResults(results: unknown): Record<string, PlatformResult> {
  const out: Record<string, PlatformResult> = {}
  const add = (platform: string, value: Record<string, unknown>) => {
    // A platform still at work says `success: false` too; it has answered only once it has a final status.
    if (typeof value.status === 'string' && STILL_WORKING.has(value.status)) return
    const name = platform === 'twitter' ? 'x' : platform
    const text = (candidate: unknown) => (typeof candidate === 'string' && candidate ? candidate : null)
    const postId = text(value.platform_post_id) ?? text(value.post_id) ?? text(value.video_id)
    // A private YouTube video has no public link, but the owner can open it by its id.
    const url =
      [value.url, value.post_url, value.postUrl].map(text).find((candidate) => candidate !== null && /^https?:/.test(candidate)) ??
      (name === 'youtube' && postId ? `https://youtube.com/shorts/${postId}` : null)
    const error = text(value.error) ?? text(value.error_message) ?? (value.success === false ? text(value.message) : null)
    out[name] = { success: value.success === true, url, postId, error }
  }
  if (Array.isArray(results)) {
    for (const entry of results) {
      if (entry && typeof entry === 'object' && typeof (entry as { platform?: unknown }).platform === 'string') {
        add((entry as { platform: string }).platform, entry as Record<string, unknown>)
      }
    }
  } else if (results && typeof results === 'object') {
    for (const [platform, value] of Object.entries(results)) if (value && typeof value === 'object') add(platform, value as Record<string, unknown>)
  }
  return out
}
