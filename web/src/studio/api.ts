import type { Analysis, LessonsFile, PathsFile } from '../catalog/types'
import type { Tutorial } from '../schema/types'
import type { ValidationIssue } from '../schema/validate'

// Every write carries this header; see STUDIO_HEADER in server/studioApi.ts.
const WRITE_HEADERS = { 'X-StrokeTutor-Studio': '1' }

/** A refusal from the Studio server, with the validation issues behind it. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues: ValidationIssue[] = [],
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch {
    throw new ApiError(0, 'The Studio server is not reachable. Is `npm run dev` still running?')
  }
  const body = (await response.json().catch(() => null)) as
    | { error?: string; issues?: ValidationIssue[] }
    | null
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.error ?? `The Studio server answered ${response.status}.`,
      body?.issues ?? [],
    )
  }
  return body as T
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { ...WRITE_HEADERS, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export function readTutorial(id: string) {
  return call<{ text: string; etag: string }>(`/api/tutorials/${encodeURIComponent(id)}`)
}

/** `etag` is the version being replaced, or null to create a new file. */
export function saveTutorial(id: string, tutorial: Tutorial, etag: string | null) {
  return call<{ file: string; etag: string; created: boolean }>(
    `/api/tutorials/${encodeURIComponent(id)}`,
    json('PUT', { tutorial, etag }),
  )
}

export function saveCatalog(
  paths: PathsFile,
  lessons: LessonsFile,
  etags: { paths: string | null; lessons: string | null },
) {
  return call<{ paths: { etag: string }; lessons: { etag: string } }>(
    '/api/catalog',
    json('PUT', { paths, lessons, etags }),
  )
}

/** Whether the server has an OpenRouter key. The key itself never reaches the browser. */
export interface StudioSettings {
  keyConfigured: boolean
  defaultModel: string | null
}

export function readSettings() {
  return call<StudioSettings>('/api/settings')
}

export interface VisionModel {
  id: string
  name: string
  contextLength: number | null
  promptPerMillion: number | null
  completionPerMillion: number | null
}

export function listModels() {
  return call<{ models: VisionModel[] }>('/api/models')
}

export interface GenerateRequest {
  model: string
  lessonId: string
  title: string
  pathId: string | null
  /** Where the lesson will sit in its path, zero-based. */
  position: number
  goal: string
  constraints: string
  image: { contentType: string; base64: string }
}

export interface GenerateResult {
  analysis: Analysis
  /** Unvalidated until checked; `issues` is the server's verdict. */
  tutorial: unknown
  model: string
  promptVersion: string
  usage?: { promptTokens?: number; completionTokens?: number; cost?: number }
  issues: ValidationIssue[]
}

/** Sends the photo and the goal to the chosen model. Writes nothing. */
export function generateLesson(request: GenerateRequest) {
  return call<GenerateResult>('/api/generate', json('POST', request))
}

export function uploadReference(lessonId: string, file: File) {
  return call<{ file: string }>(`/api/references/${encodeURIComponent(lessonId)}`, {
    method: 'PUT',
    headers: { ...WRITE_HEADERS, 'Content-Type': file.type },
    body: file,
  })
}
