import type { LessonsFile, PathsFile } from '../catalog/types'
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

export function uploadReference(lessonId: string, file: File) {
  return call<{ file: string }>(`/api/references/${encodeURIComponent(lessonId)}`, {
    method: 'PUT',
    headers: { ...WRITE_HEADERS, 'Content-Type': file.type },
    body: file,
  })
}
