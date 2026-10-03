import type { Tutorial } from '../../src/schema/types'
import { subjectOf, type VideoInput } from '../video/plan'

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

export const PLATFORMS = ['youtube', 'tiktok', 'instagram', 'facebook', 'threads', 'pinterest', 'x'] as const
export type Platform = (typeof PLATFORMS)[number]

/** What Upload-Post calls each platform in `platform[]` and in its results. Its docs say "twitter" for X, but the API refuses that ("Invalid platforms: ['twitter']") and wants "x". */
export const API_PLATFORM: Record<Platform, string> = {
  youtube: 'youtube',
  tiktok: 'tiktok',
  instagram: 'instagram',
  facebook: 'facebook',
  threads: 'threads',
  pinterest: 'pinterest',
  x: 'x',
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
  /** At most 500 characters, Threads' limit; a link in a Threads post can be tapped. */
  threads: string
}

/**
 * Whether the app gives a lesson away, and how many lessons it gives away in
 * all. A Premium lesson's post says plainly that it is Premium and that the
 * app is free to download, so nobody downloads for it and finds it locked
 * unwarned (social-plan.md, *Decisions*, 2026-09-30).
 */
export interface Access {
  premium: boolean
  freeLessons: number
}

const FREE_LESSON: Access = { premium: false, freeLessons: 0 }

export function socialTexts(tutorial: Tutorial, place: VideoInput['place'], providerToken: string | null = null, access: Access = FREE_LESSON): SocialTexts {
  const { article, subject } = subjectOf(tutorial.title)
  const what = `${article ? `${article} ` : ''}${subject}`
  const steps = tutorial.steps.filter((step) => step.strokes.length > 0).length
  const opening = `Let’s draw ${what}: ${steps} easy ${steps === 1 ? 'step' : 'steps'}, then color it in.`
  const { premium } = access
  const placeLine = place
    ? `Lesson ${place.number} of the ${place.pathTitle} path${premium ? ', in Paper Coach Premium.' : ' in Paper Coach.'}`
    : premium
      ? 'A lesson in Paper Coach Premium.'
      : null
  const offer = premium ? `The app is free to download, with ${access.freeLessons} free lessons` : 'Free on the App Store'
  const tags = [...TAGS, `#${tutorial.id.replace(/-/g, '')}`, '#papercoach'].join(' ')
  const withLink = (campaign: string) =>
    [opening, placeLine, '', APP_LINE, `${offer}: ${appStoreLink(campaign, providerToken)}`, '', tags]
      .filter((line) => line !== null)
      .join('\n')
  return {
    caption: [opening, placeLine, '', `${APP_LINE} ${offer}, link in bio.`, '', tags].filter((line) => line !== null).join('\n'),
    youtubeTitle: fit(`How to draw ${what} step by step #shorts`, 100, `How to draw ${what} #shorts`),
    youtubeDescription: withLink('youtube'),
    facebookDescription: withLink('facebook'),
    pinterestTitle: fit(`How to draw ${what}: easy step-by-step drawing`, 100, `How to draw ${what}`),
    pinterestDescription: fit(
      [opening, ...(premium ? ['This lesson is in Paper Coach Premium.'] : []), APP_LINE, `${offer}.`, '', tags].join('\n'),
      500,
      [opening, `${offer}.`].join('\n'),
    ),
    pinterestLink: appStoreLink('pinterest', providerToken),
    x: fit(
      premium
        ? [`${opening} ✏️`, '', `In Paper Coach Premium. ${offer}.`, '', '#howtodraw #drawingtutorial'].join('\n')
        : [`${opening} ✏️`, '', `${APP_LINE} Free on the App Store.`, '', '#howtodraw #drawingtutorial'].join('\n'),
      280,
      `${opening} ✏️\n\n${premium ? 'In Paper Coach Premium; the app is free.' : 'Free on the App Store: Paper Coach.'}`,
    ),
    threads: fit(
      [`${opening} ✏️`, '', ...(premium ? ['This lesson is in Paper Coach Premium.'] : []), APP_LINE, `${offer}: ${appStoreLink('threads', providerToken)}`].join('\n'),
      500,
      `${opening}\n\n${offer}: ${appStoreLink('threads', providerToken)}`,
    ),
  }
}

// ---------- The step pin ----------

export interface PinTexts {
  title: string
  description: string
  link: string
  altText: string
}

/** A step pin's words: a title people search for, the steps by name, and the App Store link on the pin. */
export function pinTexts(tutorial: Tutorial, providerToken: string | null = null, access: Access = FREE_LESSON): PinTexts {
  const { article, subject } = subjectOf(tutorial.title)
  const what = `${article ? `${article} ` : ''}${subject}`
  const count = tutorial.steps.length
  const stepList = tutorial.steps.map((step, index) => `${index + 1}. ${step.title}`).join('\n')
  const tags = [...TAGS, `#${tutorial.id.replace(/-/g, '')}drawing`, '#papercoach'].join(' ')
  const head = `How to draw ${what} in ${count} easy steps, one line at a time.`
  const tail = access.premium
    ? `This lesson is in Paper Coach Premium. ${APP_LINE} The app is free to download, with ${access.freeLessons} free lessons.`
    : `${APP_LINE} Free on the App Store.`
  return {
    title: fit(`${capitalised(subject)} drawing: ${count} easy steps for beginners`, 100, `How to draw ${what}`),
    description: fit([head, '', stepList, '', tail, '', tags].join('\n'), 500, [head, '', tail, '', tags].join('\n')),
    link: appStoreLink('pinterest-steps', providerToken),
    altText: fit(`${count} numbered pictures showing how to draw ${what} step by step, from the first line to the finished drawing in color.`, 500, `How to draw ${what}, step by step.`),
  }
}

/** A step pin's fields for Upload-Post's image upload: Pinterest only. */
export function pinFields(input: { profile: string; texts: PinTexts; board: string; externalId: string; requestId: string; scheduledAt?: string | null }): [string, string][] {
  const fields: [string, string][] = [
    ['user', input.profile],
    ['platform[]', 'pinterest'],
    ['title', input.texts.title],
    ['pinterest_title', input.texts.title],
    ['pinterest_description', input.texts.description],
    ['pinterest_link', input.texts.link],
    ['pinterest_alt_text', input.texts.altText],
    ['pinterest_board_id', input.board],
    ['external_id', input.externalId],
    ['request_id', input.requestId],
  ]
  fields.push(input.scheduledAt ? ['scheduled_date', input.scheduledAt] : ['async_upload', 'true'])
  return fields
}

/** The Pinterest board for a path's lessons, named for what people search. */
export function boardName(pathTitle: string): string {
  return `Easy Drawings: ${pathTitle}`
}

export function boardDescription(pathTitle: string, pathDescription: string | undefined): string {
  return fit(
    [`Easy step-by-step drawings: ${pathTitle.toLowerCase()}.`, pathDescription ?? '', 'Lessons from Paper Coach, which shows one line at a time and waits while you draw it on real paper.']
      .filter(Boolean)
      .join(' '),
    500,
    `Easy step-by-step drawings: ${pathTitle.toLowerCase()}, from Paper Coach.`,
  )
}

// ---------- Release news ----------

/**
 * An announcement's words for every platform, in the same shape as a
 * lesson's, so it is posted the same way: `news` is what's new, in a sentence
 * or two ("10 new lessons: draw your town…"), `headline` a short title.
 */
export function announcementTexts(
  news: string,
  headline: string,
  providerToken: string | null = null,
  { wide = false, campaign = 'news' }: { wide?: boolean; campaign?: string } = {},
): SocialTexts {
  const tags = ['#papercoach', '#howtodraw', '#drawing', '#learntodraw'].join(' ')
  const withLink = (platform: string) => [news, '', APP_LINE, `Free on the App Store: ${appStoreLink(`${platform}-${campaign}`, providerToken)}`, '', tags].join('\n')
  return {
    caption: [news, '', `${APP_LINE} Free on the App Store, link in bio.`, '', tags].join('\n'),
    // A 16:9 video is a normal YouTube video, which "#shorts" would only confuse.
    youtubeTitle: wide ? fit(headline, 100, headline) : fit(`${headline} #shorts`, 100, headline),
    youtubeDescription: withLink('youtube'),
    facebookDescription: withLink('facebook'),
    pinterestTitle: fit(headline, 100, headline),
    pinterestDescription: fit([news, '', `${APP_LINE} Free on the App Store.`, '', tags].join('\n'), 500, news),
    pinterestLink: appStoreLink(`pinterest-${campaign}`, providerToken),
    x: fit([news, '', 'Paper Coach, free on the App Store.'].join('\n'), 280, news),
    threads: fit([news, '', `Free on the App Store: ${appStoreLink(`threads-${campaign}`, providerToken)}`].join('\n'), 500, news),
  }
}

function capitalised(text: string): string {
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : text
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
  /** A 16:9 video: a feed video on Facebook, not a Reel. */
  wide?: boolean
  /** A subtitle file goes with the upload, for YouTube. */
  youtubeSubtitles?: boolean
}

/** The multipart fields of one upload, except the video itself. Order is kept, and `platform[]` repeats. */
export function uploadFields(request: PostRequest): [string, string][] {
  const { texts, settings, platforms } = request
  const has = (platform: Platform) => platforms.includes(platform)
  const fields: [string, string][] = [['user', request.profile]]
  for (const platform of platforms) fields.push(['platform[]', API_PLATFORM[platform]])
  // TikTok and Instagram publish the general `title` as their caption, whatever `tiktok_title` and `instagram_title`
  // say (Pine Tree, 2026-10-01), so `title` carries their caption; every other platform has a text field of its own.
  const title = has('tiktok') || has('instagram') ? texts.caption : texts.youtubeTitle
  fields.push(['title', title], ['external_id', request.externalId], ['request_id', request.requestId])
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
    if (request.youtubeSubtitles) fields.push(['youtube_subtitle_language', 'en'], ['youtube_subtitle_name', 'English'])
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
    fields.push(['facebook_title', texts.youtubeTitle.replace(/\s*#shorts$/, '')], ['facebook_description', texts.facebookDescription], ['facebook_media_type', request.wide ? 'VIDEO' : 'REELS'])
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
  if (has('threads')) {
    // One topic tag a post, which Threads uses to reach people beyond the followers.
    fields.push(['threads_title', texts.threads], ['threads_topic_tag', 'Drawing'], ['threads_alt_text', request.altText])
  }
  if (has('x')) fields.push(['x_title', texts.x])
  return fields
}

// ---------- Which lesson goes next ----------

export interface QueuePath {
  id: string
  title: string
  description?: string
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
 * A list of lessons in docs/ops, one id a line (`#` comments):
 * social-up-next.txt, posted before any other, which is how the weekly review
 * moves subjects that do well up; social-premium-first.txt, the Premium
 * lessons in the order they take their turns.
 */
export function parseUpNext(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/#.*$/, '').trim())
    .filter(Boolean)
}

// ---------- The record of what was posted ----------

export interface PlatformResult {
  success: boolean
  /** TikTok hit its daily cap and put the video in the account's inbox: it is a draft until published in the app. */
  inbox?: boolean
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
      /** What went out: the lesson's whole video (the default, and every record before the others), its speed draw, or its step pin. */
      media?: 'video' | 'speed' | 'pin' | 'wide'
      /** A lesson in the queue (the default), or release news, which never counts the lesson as posted. */
      purpose?: 'lesson' | 'announce'
      /** The file sent, when it was given (`--video`) rather than rendered for the post: what the Social page's "Made, not posted yet" matches. From 2026-10-03. */
      video?: string
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

// ---------- Posts by day: the repo's copy and the Studio's page ----------

/** Days are Central, where the posting job runs: a post at 23:12 Central belongs to that day, not to UTC's next. */
export const POSTING_TIME_ZONE = 'America/Chicago'

/** `YYYY-MM-DD` of a moment in the posting time zone. */
export function dayOf(iso: string, timeZone = POSTING_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

/** One post as the repo keeps it and the Studio shows it: when, what, and each platform's link or error. */
export interface PostEntry {
  /** The day it went out (or is scheduled to), Central. */
  day: string
  /** When it went out, or is scheduled to. */
  at: string
  requestId: string
  lessonId: string
  /** The lesson's title when known, so the record reads without the catalog. */
  title?: string
  media: 'video' | 'speed' | 'pin' | 'wide'
  purpose: 'lesson' | 'announce'
  private: boolean
  /** `scheduled` and `processing` until every platform has answered; then `completed`, `partial` or `failed`. */
  status: string
  platforms: { platform: string; ok: boolean | null; url: string | null; inbox?: boolean; error: string | null }[]
}

export function postEntry({ post, status }: PostState, title?: string, now = Date.now()): PostEntry {
  const at = post.scheduledAt ?? post.at
  const results = status?.results ?? {}
  return {
    day: dayOf(at),
    at,
    requestId: post.requestId,
    lessonId: post.lessonId,
    ...(title ? { title } : {}),
    media: post.media ?? 'video',
    purpose: post.purpose ?? 'lesson',
    private: post.private,
    status: status?.status ?? (post.scheduledAt && Date.parse(post.scheduledAt) > now ? 'scheduled' : 'processing'),
    platforms: post.platforms.map((platform) => {
      const result = results[platform]
      if (!result) return { platform, ok: null, url: null, error: null }
      return {
        platform,
        ok: result.success && !result.inbox,
        url: platformLink(platform, result.url ?? null, result.postId ?? null),
        ...(result.inbox ? { inbox: true } : {}),
        error: result.error ?? null,
      }
    }),
  }
}

/** Every post that went out (refusals sent nothing and are left out), by day, newest day and newest post first. */
export function postsByDay(records: SocialRecord[], titles: (lessonId: string) => string | undefined = () => undefined, now = Date.now()): { day: string; posts: PostEntry[] }[] {
  return entriesByDay(postStates(records).map((state) => postEntry(state, titles(state.post.lessonId), now)))
}

/** Posts under their day, newest day and newest post first: the record's, or the repo's copy as it is kept. */
export function entriesByDay(entries: PostEntry[]): { day: string; posts: PostEntry[] }[] {
  const days = new Map<string, PostEntry[]>()
  for (const entry of entries) days.set(entry.day, [...(days.get(entry.day) ?? []), entry])
  return [...days]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([day, posts]) => ({ day, posts: posts.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)) }))
}

/**
 * Lessons whose whole video went out for everyone to see. A test post, one
 * that failed everywhere, news, a speed draw or a step pin doesn't count: the
 * queue still owes the lesson its video.
 */
export function postedLessons(records: SocialRecord[]): Set<string> {
  const posted = new Set<string>()
  for (const { post, status } of postStates(records)) {
    if (post.private || post.purpose === 'announce' || (post.media ?? 'video') !== 'video') continue
    if (status && FINAL_STATUSES.has(status.status) && !Object.values(status.results).some((result) => result.success)) continue
    posted.add(post.lessonId)
  }
  return posted
}

const STILL_WORKING = new Set(['pending', 'queued', 'processing', 'in_progress', 'retryable'])

/**
 * Where a post can be seen. Upload-Post gives a pin's destination (our App
 * Store link) where its own address should be, and a private YouTube video
 * no link at all; both are rebuilt from the platform's id for the post.
 */
export function platformLink(platform: string, given: string | null, postId: string | null): string | null {
  if (platform === 'pinterest' && postId && !(given && /pinterest\./.test(given))) return `https://www.pinterest.com/pin/${postId}/`
  if (platform === 'youtube' && postId && !given) return `https://youtube.com/shorts/${postId}`
  return given
}

/** Upload-Post's per-platform results (an object by platform, or a list with `platform`) in one shape; those still at work are left out. */
export function normaliseResults(results: unknown): Record<string, PlatformResult> {
  const out: Record<string, PlatformResult> = {}
  const add = (platform: string, value: Record<string, unknown>) => {
    // A platform still at work says `success: false` too; it has answered only once it has a final status.
    if (typeof value.status === 'string' && STILL_WORKING.has(value.status)) return
    const name = platform === 'twitter' ? 'x' : platform
    const text = (candidate: unknown) => (typeof candidate === 'string' && candidate ? candidate : null)
    const postId = text(value.platform_post_id) ?? text(value.post_id) ?? text(value.video_id)
    const given = [value.url, value.post_url, value.postUrl].map(text).find((candidate) => candidate !== null && /^https?:/.test(candidate)) ?? null
    const url = platformLink(name, given, postId)
    const error = text(value.error) ?? text(value.error_message) ?? (value.success === false ? text(value.message) : null)
    out[name] = { success: value.success === true, url, postId, error }
    if (value.fallback_to_inbox === true || /sent to inbox/i.test(String(value.post_url ?? ''))) out[name].inbox = true
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
