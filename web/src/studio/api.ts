import type { Analysis, LessonsFile, PathsFile } from '../catalog/types'
import type { HistoryEntry, HistoryRecord } from '../history/types'
import type { Tutorial } from '../schema/types'
import type { ValidationIssue } from '../schema/validate'
import type { TracedDrawing } from '../trace/traceSvg'
import type { AppNarration, LessonNarration, ScriptLine, Take, Voice, VoiceInput, VoiceState } from '../voice/types'

import { mockVoiceApi } from './voice/mockVoiceApi'

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
  /** The text-to-speech server speech is made on, from STUDIO_TTS_URL. */
  ttsUrl: string
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

/* ---------- Voice: casting Lina, and narrating lessons in her voice ---------- */

/**
 * With `VITE_VOICE_MOCK=1` the Voice page talks to a small fake instead of the
 * Studio server, so the page can be looked at (and its states walked through)
 * without the creator's text-to-speech box on the other end. The flag is a
 * build-time constant, so nothing of the fake survives a normal build.
 */
const voiceMock = import.meta.env.VITE_VOICE_MOCK === '1' ? mockVoiceApi : null

/** Everything the Voice page needs at once: the server's health, the voices, the script and every take. */
export function readVoiceState() {
  return voiceMock ? voiceMock.readState() : call<VoiceState>('/api/voice')
}

/** Saves the audition script. Takes are keyed by their words, so editing a line never destroys a recording. */
export function saveVoiceScript(lines: ScriptLine[]) {
  return voiceMock
    ? voiceMock.saveScript(lines)
    : call<{ script: ScriptLine[] }>('/api/voice/script', json('PUT', { lines }))
}

export function createVoice(input: VoiceInput) {
  return voiceMock ? voiceMock.createVoice(input) : call<Voice>('/api/voice/voices', json('POST', input))
}

/** Changes a voice. The server refuses to restyle a frozen voice until it is unfrozen. */
export function updateVoice(id: string, input: Partial<VoiceInput>) {
  return voiceMock
    ? voiceMock.updateVoice(id, input)
    : call<Voice>(`/api/voice/voices/${encodeURIComponent(id)}`, json('PUT', input))
}

/** Deletes a voice and its takes. Refused with 409 while a lesson is narrated in it, unless `force`. */
export function deleteVoice(id: string, { force = false } = {}) {
  const url = `/api/voice/voices/${encodeURIComponent(id)}${force ? '?force=1' : ''}`
  return voiceMock ? voiceMock.deleteVoice(id) : call<{ ok: true }>(url, remove())
}

/** Makes one voice Lina, or clears the casting with `null`. */
export function castVoice(voiceId: string | null) {
  return voiceMock
    ? voiceMock.cast(voiceId)
    : call<{ castVoiceId: string | null }>('/api/voice/cast', json('POST', { voiceId }))
}

/**
 * Says one line in one voice. The server hands back the recording it already
 * has for these exact words and settings; `another` asks for a fresh take,
 * which is how a designed voice is auditioned until one is worth freezing.
 */
export function sayLine(voiceId: string, text: string, { another = false } = {}) {
  return voiceMock
    ? voiceMock.say(voiceId, text, another)
    : call<Take>(`/api/voice/voices/${encodeURIComponent(voiceId)}/say`, json('POST', { text, another }))
}

/** Where a take's audio is. Immutable, so the browser keeps it for as long as the tab lives. */
export function takeAudioUrl(takeId: string): string {
  return voiceMock ? voiceMock.takeUrl(takeId) : `/api/voice/takes/${encodeURIComponent(takeId)}`
}

/** Uploads a take to the speech server as a reference, so this voice stops drifting between takes. */
export function freezeVoice(id: string, takeId: string) {
  return voiceMock
    ? voiceMock.freeze(id, takeId)
    : call<Voice>(`/api/voice/voices/${encodeURIComponent(id)}/freeze`, json('POST', { takeId }))
}

export function unfreezeVoice(id: string) {
  return voiceMock ? voiceMock.unfreeze(id) : call<Voice>(`/api/voice/voices/${encodeURIComponent(id)}/unfreeze`, post())
}

/** One lesson's steps, what each would say, and what is recorded for it. */
export function readLessonNarration(lessonId: string) {
  return voiceMock
    ? voiceMock.readLesson(lessonId)
    : call<LessonNarration>(`/api/voice/lessons/${encodeURIComponent(lessonId)}`)
}

/** Writes a spoken line for a step, or removes it with `null` so the instruction is spoken instead. */
export function saveNarrationLine(lessonId: string, stepId: string, text: string | null) {
  return voiceMock
    ? voiceMock.saveLine(lessonId, stepId, text)
    : call<LessonNarration>(
        `/api/voice/lessons/${encodeURIComponent(lessonId)}/lines/${encodeURIComponent(stepId)}`,
        json('PUT', { text }),
      )
}

/**
 * Has a model write what Lina says at each step: one or two spoken sentences
 * said while the stroke animates, with the written instruction still on screen.
 * `overwrite` false (the default) keeps the lines already written and only
 * fills the rest; the model is told about every step either way, so the lesson
 * has one voice.
 */
export function generateSpokenLines(
  lessonId: string,
  body: { model?: string; note?: string; overwrite?: boolean },
) {
  return voiceMock
    ? voiceMock.writeLines(lessonId, body)
    : call<LessonNarration>(
        `/api/voice/lessons/${encodeURIComponent(lessonId)}/lines/generate`,
        json('POST', body),
      )
}

/**
 * Records one step in the cast voice. One step per request on purpose: the page
 * loops over the steps itself, so a long lesson shows its progress and can be
 * stopped part way.
 */
export function narrateStep(lessonId: string, stepId: string, { another = false } = {}) {
  return voiceMock
    ? voiceMock.narrate(lessonId, stepId, another)
    : call<LessonNarration>(
        `/api/voice/lessons/${encodeURIComponent(lessonId)}/narrate`,
        json('POST', { stepId, another }),
      )
}

/** Writes `shared/Assets/Voice/<lessonId>/`: one m4a per step and the manifest the iOS app reads. */
export function publishVoice(lessonId: string) {
  return voiceMock
    ? voiceMock.publish(lessonId)
    : call<{ files: string[] }>(`/api/voice/lessons/${encodeURIComponent(lessonId)}/publish`, post())
}

/** Takes a lesson's audio back out of `shared/`. */
export function unpublishVoice(lessonId: string) {
  return voiceMock
    ? voiceMock.unpublish(lessonId)
    : call<{ files: string[] }>(`/api/voice/lessons/${encodeURIComponent(lessonId)}/published`, remove())
}

/** Lina's own lines: what the app says outside any lesson, and what is recorded for each. */
export function readAppLines() {
  return voiceMock ? voiceMock.readAppLines() : call<AppNarration>('/api/voice/app')
}

/** Rewrites one app line. The id is the app's and never changes; only the words are sent. */
export function saveAppLine(id: string, text: string) {
  return voiceMock
    ? voiceMock.saveAppLine(id, text)
    : call<AppNarration>(`/api/voice/app/lines/${encodeURIComponent(id)}`, json('PUT', { text }))
}

/** Records one app line in the cast voice, one request at a time as the lesson table does. */
export function narrateAppLine(id: string, { another = false } = {}) {
  return voiceMock
    ? voiceMock.narrateAppLine(id, another)
    : call<AppNarration>('/api/voice/app/narrate', json('POST', { id, another }))
}

/** Writes `shared/Assets/Voice/app/`: one m4a per line and the manifest the iOS app reads. */
export function publishAppLines() {
  return voiceMock ? voiceMock.publishAppLines() : call<{ files: string[] }>('/api/voice/app/publish', post())
}

/** Takes Lina's own lines back out of `shared/`. */
export function unpublishAppLines() {
  return voiceMock ? voiceMock.unpublishAppLines() : call<{ files: string[] }>('/api/voice/app/published', remove())
}
