import type { Analysis, LessonsFile, PathsFile } from '../catalog/types'
import type { HistoryEntry, HistoryRecord } from '../history/types'
import type { Tutorial } from '../schema/types'
import type { ValidationIssue } from '../schema/validate'
import type { TracedDrawing } from '../trace/traceSvg'

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

/**
 * Saves a lesson in the workspace. `etag` is the version being replaced, or
 * null to create one. An autosave passes `checkpoint: false`, so only
 * deliberate saves (⌘S) add a version to the lesson's history.
 */
export function saveTutorial(id: string, tutorial: Tutorial, etag: string | null, { checkpoint = true } = {}) {
  return call<{ file: string; etag: string; created: boolean }>(
    `/api/tutorials/${encodeURIComponent(id)}`,
    json('PUT', { tutorial, etag, checkpoint }),
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
  /** SVG lessons: what the Studio corrected in the model's plan. */
  notes?: string[]
}

/** Sends the photo and the goal to the chosen model. Writes nothing. */
export function generateLesson(request: GenerateRequest) {
  return call<GenerateResult>('/api/generate', json('POST', request))
}

/**
 * Sends a traced SVG, its picture and the goal. The model orders the traced
 * lines and colours into steps; every shape stays the traced one. Writes nothing.
 */
export function generateFromTrace(request: GenerateRequest & { trace: TracedDrawing }) {
  return call<GenerateResult>('/api/generate-from-trace', json('POST', request))
}

/** The four layers of master plan §24, each regenerated on its own. */
export type RegenerateLayer = 'drawing' | 'order' | 'steps' | 'instructions'

type ModelImage = { contentType: string; base64: string }

interface RegenerateBase {
  model: string
  lessonId: string
  pathId: string | null
  /** The lesson's place in its path, zero-based. */
  position: number
  goal: string
  constraints: string
  /** What the creator wants different this time; may be empty. */
  note: string
}

export type RegenerateRequest =
  /** A new drawing from the reference: the SVG traced afresh, or the photo. */
  | (RegenerateBase & { layer: 'drawing'; title: string; image: ModelImage; trace?: TracedDrawing })
  /** One layer of the current lesson; the drawing stays exactly as it is. */
  | (RegenerateBase & {
      layer: Exclude<RegenerateLayer, 'drawing'>
      tutorial: Tutorial
      drawing: ModelImage
      reference?: ModelImage
    })

export interface RegenerateResult {
  layer: RegenerateLayer
  /** Unvalidated until checked; `issues` is the server's verdict. */
  tutorial: unknown
  issues: ValidationIssue[]
  /** What the Studio corrected in the model's answer. */
  notes: string[]
  /** The model's own account of what it changed. */
  rationale?: string
  /** Only a new drawing comes with a new analysis. */
  analysis?: Analysis
  model: string
  promptVersion: string
  usage?: { promptTokens?: number; completionTokens?: number; cost?: number }
}

/** Regenerates one layer of an existing lesson. Writes nothing; the creator chooses what to keep. */
export function regenerateLayer(request: RegenerateRequest) {
  return call<RegenerateResult>('/api/regenerate', json('POST', request))
}

/** Every recorded version of a lesson, newest first. */
export function listHistory(lessonId: string) {
  return call<{ entries: HistoryEntry[] }>(`/api/history/${encodeURIComponent(lessonId)}`)
}

/** Keeps a generated or regenerated version beside the lesson. Saves are recorded by the server itself. */
export function recordHistory(lessonId: string, record: HistoryRecord & { kind: 'generated' | 'regenerated' }) {
  return call<{ entry: HistoryEntry }>(`/api/history/${encodeURIComponent(lessonId)}`, json('POST', record))
}

const post = (): RequestInit => ({ method: 'POST', headers: WRITE_HEADERS })
const remove = (): RequestInit => ({ method: 'DELETE', headers: WRITE_HEADERS })

/**
 * Writes lessons, and the curriculum as it now stands, into `shared/`: what
 * git tracks and the app ships. Publishing approves them. An empty list
 * publishes the curriculum alone.
 */
export function publishLessons(lessonIds: string[]) {
  return call<{ files: string[] }>('/api/publish', json('POST', { lessonIds }))
}

/** Takes a lesson out of `shared/`, keeping it in the workspace. */
export function unpublishLesson(lessonId: string) {
  return call<{ files: string[] }>(`/api/unpublish/${encodeURIComponent(lessonId)}`, post())
}

/** A copy of the lesson as a new draft, right after it in its path. */
export function duplicateLesson(lessonId: string) {
  return call<{ lessonId: string }>(`/api/lessons/${encodeURIComponent(lessonId)}/duplicate`, post())
}

/** Moves a lesson to the trash, unpublishing it first if it is published. */
export function deleteLesson(lessonId: string) {
  return call<{ files: string[] }>(`/api/lessons/${encodeURIComponent(lessonId)}`, remove())
}

/** Moves a path to the trash; its lessons become unfiled, or go to the trash too. */
export function removePath(pathId: string, lessons: 'unfile' | 'trash') {
  return call<{ files: string[] }>(`/api/paths/${encodeURIComponent(pathId)}?lessons=${lessons}`, remove())
}

export interface TrashItem {
  id: string
  kind: 'lesson' | 'path'
  itemId: string
  title: string
  deletedAt: string
  detail: string
}

export function listTrash() {
  return call<{ items: TrashItem[] }>('/api/trash')
}

export function restoreFromTrash(id: string) {
  return call<{ kind: 'lesson' | 'path'; itemId: string }>(`/api/trash/${encodeURIComponent(id)}/restore`, post())
}

export function deleteForever(id: string) {
  return call<{ items: TrashItem[] }>(`/api/trash/${encodeURIComponent(id)}`, remove())
}

export function emptyTrash() {
  return call<{ items: TrashItem[] }>('/api/trash', remove())
}

/** Takes `shared/Catalog` as it now is, after a git pull or a hand edit. */
export function adoptShared() {
  return call<{ ok: true }>('/api/adopt-shared', post())
}

export function uploadReference(lessonId: string, file: File) {
  return call<{ file: string }>(`/api/references/${encodeURIComponent(lessonId)}`, {
    method: 'PUT',
    headers: { ...WRITE_HEADERS, 'Content-Type': file.type },
    body: file,
  })
}
