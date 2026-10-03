import { openAsBlob } from 'node:fs'
import path from 'node:path'

import { metricsSummary } from './metrics'
import { platformLink } from './posts'

/**
 * The few Upload-Post endpoints the social command uses
 * (https://docs.upload-post.com): who the key belongs to, the profile's
 * connected accounts, Pinterest boards and Facebook Pages, an upload, its
 * status, and the numbers of posts and accounts. `fetch` is injectable so
 * tests never reach the network.
 */

export const UPLOAD_POST_API = 'https://api.upload-post.com'

export class UploadPostError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: unknown = null,
  ) {
    super(message)
    this.name = 'UploadPostError'
  }
}

export interface Account {
  platform: string
  /** The handle or name the account shows, when Upload-Post reports one. */
  name: string | null
  connected: boolean
  reauthRequired: boolean
}

export interface UploadAccepted {
  requestId: string | null
  jobId: string | null
  /** Per-platform results, when the upload finished before the response. */
  results: unknown
  /** Uploads counted this month and the plan's limit, when reported. */
  usage: { count: number; limit: number } | null
  warnings: string[]
}

export interface UploadStatus {
  status: string
  results: unknown
  message: string | null
}

export interface UploadPostClient {
  me(): Promise<{ email: string | null; plan: string | null }>
  accounts(profile: string): Promise<Account[]>
  pinterestBoards(profile: string): Promise<{ id: string; name: string }[]>
  facebookPages(profile: string): Promise<{ id: string; name: string }[]>
  /** `files` go with the video: a YouTube thumbnail (`thumbnail`), a subtitle file (`youtube_subtitle_file`). */
  upload(fields: [string, string][], videoFile: string, requestId: string, files?: { field: string; file: string; type: string }[]): Promise<UploadAccepted>
  /** An image post (a Pinterest pin, say): the same fields, the pictures as `photos[]`. */
  uploadPhotos(fields: [string, string][], imageFiles: string[], requestId: string): Promise<UploadAccepted>
  createPinterestBoard(profile: string, name: string, description: string): Promise<{ id: string; name: string }>
  status(id: { requestId?: string; jobId?: string }): Promise<UploadStatus>
  /** How a post is doing on each platform it went to, as the platforms report it (read live; at most 100 calls in 5 minutes). */
  postMetrics(requestId: string): Promise<Record<string, PostMetrics>>
  /**
   * The accounts' own numbers (followers, reach, Instagram's bio-link taps, Threads' link clicks,
   * Pinterest's outbound clicks…), each platform's object as Upload-Post gives it. Facebook needs
   * its Page, and takes a window in days (30 by default).
   */
  accountMetrics(profile: string, platforms: string[], options?: { pageId?: string | null; days?: number }): Promise<Record<string, Record<string, unknown>>>
  /** TikTok's audience over whole days (`YYYY-MM-DD`): bio-link taps, followers by day, when followers are online. */
  tiktokAudience(profile: string, range: { start: string; end: string }): Promise<Record<string, unknown>>
  /** Changes a live YouTube video (POST /api/uploadposts/posts/edit): its `privacyStatus`, title, description… */
  editYouTube(profile: string, videoId: string, changes: Record<string, string>): Promise<Record<string, unknown>>
}

export interface PostMetrics {
  /** Views, likes and comments, whatever the platform calls them (`metricsSummary`). */
  views: number | null
  likes: number | null
  comments: number | null
  /** Where the post can be seen: for a pin its own address, not the App Store link it leads to. */
  url: string | null
  /** The platform's own id for the post. */
  postId: string | null
  /** Why a platform's numbers are missing (a token to refresh, a post not found), when they are. */
  error: string | null
  /** Everything the platform reported (`post_metrics`): TikTok's retention, Pinterest's outbound clicks, saves… */
  raw: Record<string, unknown>
}

export function uploadPostClient(apiKey: string, fetchImpl: typeof fetch = fetch, base = UPLOAD_POST_API): UploadPostClient {
  const call = async (method: 'GET' | 'POST', route: string, init: { body?: FormData | string; headers?: Record<string, string> } = {}) => {
    const response = await fetchImpl(`${base}${route}`, {
      method,
      headers: { Authorization: `Apikey ${apiKey}`, ...init.headers },
      body: init.body,
    })
    const text = await response.text()
    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = text
    }
    if (!response.ok) {
      const record = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
      const message = [record.message, record.error, typeof body === 'string' ? body.slice(0, 200) : null].find((value) => typeof value === 'string' && value)
      throw new UploadPostError(response.status, `Upload-Post said ${response.status}: ${message ?? response.statusText}`, body)
    }
    return (body ?? {}) as Record<string, unknown>
  }
  const text = (value: unknown) => (typeof value === 'string' && value ? value : null)
  const accepted = (body: Record<string, unknown>, requestId: string): UploadAccepted => {
    const usage = body.usage as { count?: unknown; limit?: unknown } | undefined
    return {
      requestId: text(body.request_id) ?? requestId,
      jobId: text(body.job_id),
      results: body.results ?? null,
      usage: usage && typeof usage.count === 'number' && typeof usage.limit === 'number' ? { count: usage.count, limit: usage.limit } : null,
      warnings: Array.isArray(body.warnings) ? body.warnings.filter((warning): warning is string => typeof warning === 'string') : [],
    }
  }

  return {
    async me() {
      const body = await call('GET', '/api/uploadposts/me')
      return { email: text(body.email), plan: text(body.plan) }
    },

    async accounts(profile) {
      const body = await call('GET', `/api/uploadposts/users/${encodeURIComponent(profile)}`)
      const found = (body.profile ?? {}) as { social_accounts?: Record<string, unknown> }
      return Object.entries(found.social_accounts ?? {}).map(([platform, value]) => {
        const account = (value && typeof value === 'object' ? value : null) as Record<string, unknown> | null
        return {
          platform: platform === 'twitter' ? 'x' : platform,
          name: account ? (text(account.handle) ?? text(account.display_name) ?? text(account.username)) : null,
          connected: account !== null,
          reauthRequired: account?.reauth_required === true,
        }
      })
    },

    async pinterestBoards(profile) {
      const body = await call('GET', `/api/uploadposts/pinterest/boards?profile=${encodeURIComponent(profile)}`)
      return ((body.boards ?? []) as { id: unknown; name: unknown }[]).map((board) => ({ id: String(board.id), name: String(board.name) }))
    },

    async facebookPages(profile) {
      const body = await call('GET', `/api/uploadposts/facebook/pages?profile=${encodeURIComponent(profile)}`)
      return ((body.pages ?? []) as { id: unknown; name: unknown }[]).map((page) => ({ id: String(page.id), name: String(page.name) }))
    },

    async upload(fields, videoFile, requestId, files = []) {
      const form = new FormData()
      for (const [name, value] of fields) form.append(name, value)
      form.append('video', await openAsBlob(videoFile, { type: 'video/mp4' }), path.basename(videoFile))
      for (const extra of files) form.append(extra.field, await openAsBlob(extra.file, { type: extra.type }), path.basename(extra.file))
      // The same key on a retry returns the job already made instead of posting twice.
      return accepted(await call('POST', '/api/upload', { body: form, headers: { 'Idempotency-Key': requestId } }), requestId)
    },

    async uploadPhotos(fields, imageFiles, requestId) {
      const form = new FormData()
      for (const [name, value] of fields) form.append(name, value)
      for (const file of imageFiles) form.append('photos[]', await openAsBlob(file, { type: 'image/png' }), path.basename(file))
      return accepted(await call('POST', '/api/upload_photos', { body: form, headers: { 'Idempotency-Key': requestId } }), requestId)
    },

    async createPinterestBoard(profile, name, description) {
      const body = await call('POST', '/api/uploadposts/pinterest/boards', {
        body: JSON.stringify({ user: profile, name, description, privacy: 'PUBLIC' }),
        headers: { 'Content-Type': 'application/json' },
      })
      const board = (body.board ?? body) as { id?: unknown; name?: unknown }
      if (board.id === undefined) throw new UploadPostError(500, `Upload-Post made the board “${name}” but didn’t say its id.`, body)
      return { id: String(board.id), name: String(board.name ?? name) }
    },

    async postMetrics(requestId) {
      const body = await call('GET', `/api/uploadposts/post-analytics/${encodeURIComponent(requestId)}`)
      const out: Record<string, PostMetrics> = {}
      for (const [name, value] of Object.entries((body.platforms ?? {}) as Record<string, Record<string, unknown>>)) {
        if (!value || typeof value !== 'object') continue
        const platform = name.toLowerCase() === 'twitter' ? 'x' : name.toLowerCase()
        const raw = (value.post_metrics && typeof value.post_metrics === 'object' ? value.post_metrics : {}) as Record<string, unknown>
        const postId = text(value.platform_post_id)
        const given = text(value.post_url) && /^https?:/.test(String(value.post_url)) ? String(value.post_url) : null
        out[platform] = { ...metricsSummary(raw), url: platformLink(platform, given, postId), postId, error: text(value.post_metrics_error), raw }
      }
      return out
    },

    async accountMetrics(profile, platforms, options = {}) {
      const query = [`platforms=${platforms.map(encodeURIComponent).join(',')}`]
      if (options.pageId) query.push(`page_id=${encodeURIComponent(options.pageId)}`)
      if (options.days) query.push(`days=${options.days}`)
      const body = await call('GET', `/api/analytics/${encodeURIComponent(profile)}?${query.join('&')}`)
      const out: Record<string, Record<string, unknown>> = {}
      for (const [name, value] of Object.entries(body)) {
        const platform = name === 'twitter' ? 'x' : name
        // The platforms asked for, each an object; anything else in the answer is not a platform's numbers.
        if (platforms.includes(platform) && value && typeof value === 'object' && !Array.isArray(value)) out[platform] = value as Record<string, unknown>
      }
      return out
    },

    async tiktokAudience(profile, range) {
      const query = `platform=tiktok&user=${encodeURIComponent(profile)}&start_date=${range.start}&end_date=${range.end}`
      const numbers = { ...(await call('GET', `/api/uploadposts/audience?${query}`)) }
      // The 25 benchmark categories it always lists are a picker's choices, not numbers.
      for (const key of ['success', 'platform', 'benchmark_categories']) delete numbers[key]
      return numbers
    },

    async editYouTube(profile, videoId, changes) {
      return call('POST', '/api/uploadposts/posts/edit', {
        body: JSON.stringify({ platform: 'youtube', user: profile, post_id: videoId, ...changes }),
        headers: { 'Content-Type': 'application/json' },
      })
    },

    async status({ requestId, jobId }) {
      const query = jobId ? `job_id=${encodeURIComponent(jobId)}` : `request_id=${encodeURIComponent(requestId ?? '')}`
      try {
        const body = await call('GET', `/api/uploadposts/status?${query}`)
        return { status: text(body.status) ?? 'pending', results: body.results ?? null, message: text(body.message) }
      } catch (error) {
        if (error instanceof UploadPostError && error.status === 404) return { status: 'not_found', results: null, message: error.message }
        throw error
      }
    },
  }
}
