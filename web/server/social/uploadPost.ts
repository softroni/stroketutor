import { openAsBlob } from 'node:fs'
import path from 'node:path'

/**
 * The few Upload-Post endpoints the social command uses
 * (https://docs.upload-post.com): who the key belongs to, the profile's
 * connected accounts, Pinterest boards and Facebook Pages, an upload, and its
 * status. `fetch` is injectable so tests never reach the network.
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
  upload(fields: [string, string][], videoFile: string, requestId: string): Promise<UploadAccepted>
  status(id: { requestId?: string; jobId?: string }): Promise<UploadStatus>
}

export function uploadPostClient(apiKey: string, fetchImpl: typeof fetch = fetch, base = UPLOAD_POST_API): UploadPostClient {
  const call = async (method: 'GET' | 'POST', route: string, init: { body?: FormData; headers?: Record<string, string> } = {}) => {
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

    async upload(fields, videoFile, requestId) {
      const form = new FormData()
      for (const [name, value] of fields) form.append(name, value)
      form.append('video', await openAsBlob(videoFile, { type: 'video/mp4' }), path.basename(videoFile))
      // The same key on a retry returns the job already made instead of posting twice.
      const body = await call('POST', '/api/upload', { body: form, headers: { 'Idempotency-Key': requestId } })
      const usage = body.usage as { count?: unknown; limit?: unknown } | undefined
      return {
        requestId: text(body.request_id) ?? requestId,
        jobId: text(body.job_id),
        results: body.results ?? null,
        usage: usage && typeof usage.count === 'number' && typeof usage.limit === 'number' ? { count: usage.count, limit: usage.limit } : null,
        warnings: Array.isArray(body.warnings) ? body.warnings.filter((warning): warning is string => typeof warning === 'string') : [],
      }
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
