import { lessonContext } from './lessonContext'
import { GenerationFailed, requestLesson, type Candidate } from './openrouter'
import {
  ID_PATTERN,
  MAX_REFERENCE_BYTES,
  RASTER_TYPES,
  WriteRefused,
  sniffImage,
  type Issue,
  type LibrarySnapshot,
  type Verdict,
} from './repoWriter'

/** Generated lessons use the same square paper as the golden tutorials. */
export const GENERATION_CANVAS = { width: 1000, height: 1000 }

export interface GenerateDeps {
  apiKey?: string
  /** `OPENROUTER_MODEL` from the environment, used when the request names none. */
  defaultModel?: string
  library: () => Promise<LibrarySnapshot>
  validateTutorial: (data: unknown) => Verdict
  fetch?: typeof fetch
}

export interface GenerateResult extends Candidate {
  /** Empty when the candidate is a valid v1 tutorial; otherwise it must not enter the editor. */
  issues: Issue[]
}

/**
 * `new`: the id must be free, so generation can never replace a lesson.
 * `existing`: regenerating a lesson's drawing, so the lesson must exist. Either
 * way nothing is written; the creator decides what to keep.
 */
export type LessonMode = 'new' | 'existing'

export { GenerationFailed }

/**
 * One "Generate Tutorial" (master plan §16): checks the creator's input, asks
 * the model, and validates what comes back. Writes nothing — the creator
 * decides whether a candidate becomes a lesson — and refuses an id that is
 * already taken, so generation can never replace an existing lesson.
 */
export async function generateCandidate(
  body: Record<string, unknown>,
  deps: GenerateDeps,
  mode: LessonMode = 'new',
): Promise<GenerateResult> {
  const input = await readLessonRequest(body, deps, mode)
  const candidate = await requestLesson(
    {
      model: input.model,
      lessonId: input.lessonId,
      title: input.title,
      canvas: GENERATION_CANVAS,
      image: input.image,
      context: lessonContext(input.library, input.pathId, input.position, input.goal, input.constraints),
    },
    { apiKey: input.apiKey, fetch: deps.fetch },
  )

  const verdict = deps.validateTutorial(candidate.tutorial)
  return { ...candidate, issues: verdict.ok ? [] : verdict.issues }
}

/** A generation request, checked before anything is spent. Shared by photo and SVG generation. */
export interface LessonRequest {
  apiKey: string
  model: string
  lessonId: string
  title: string
  goal: string
  constraints: string
  pathId: string | null
  position: number
  /** A raster image the model can be sent. */
  image: { contentType: string; base64: string }
  library: LibrarySnapshot
}

export async function readLessonRequest(
  body: Record<string, unknown>,
  deps: GenerateDeps,
  mode: LessonMode = 'new',
): Promise<LessonRequest> {
  const { apiKey, model } = readModelChoice(body, deps)
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

  const lessonId = text(body.lessonId)
  if (!ID_PATTERN.test(lessonId)) {
    throw new WriteRefused(400, 'The lesson id must use lowercase letters, digits and single dashes.')
  }
  const title = text(body.title)
  if (!title) throw new WriteRefused(400, 'Give the lesson a title.')
  const goal = text(body.goal)
  if (!goal) {
    throw new WriteRefused(400, 'Describe the learning goal: it is what the lesson is planned around.')
  }
  const image = readRasterImage(body.image, 'Add a reference photo.')

  const library = await deps.library()
  const hasFile = library.tutorials.some((file) => file.fileName === `${lessonId}.json`)
  if (mode === 'new' && (hasFile || lessonIds(library).has(lessonId))) {
    throw new WriteRefused(
      409,
      `A lesson called "${lessonId}" already exists. Generation never replaces a lesson; choose another id.`,
    )
  }
  if (mode === 'existing' && !hasFile) {
    throw new WriteRefused(404, `There is no lesson "${lessonId}" to regenerate.`)
  }

  const position = typeof body.position === 'number' && Number.isInteger(body.position) ? body.position : Infinity
  return {
    apiKey,
    model,
    lessonId,
    title,
    goal,
    constraints: text(body.constraints),
    pathId: text(body.pathId) || null,
    position,
    image,
    library,
  }
}

/** The key and the model every generation needs, or a sentence saying which is missing. */
export function readModelChoice(
  body: Record<string, unknown>,
  // Only the two fields are wanted, so writing spoken lines can reach the
  // same refusals without carrying a library and a validator it never uses.
  deps: Pick<GenerateDeps, 'apiKey' | 'defaultModel'>,
): { apiKey: string; model: string } {
  if (!deps.apiKey) {
    throw new WriteRefused(
      503,
      'Generation needs an OpenRouter key: add OPENROUTER_API_KEY to web/.env.local, then restart npm run dev.',
    )
  }
  const model = (typeof body.model === 'string' ? body.model.trim() : '') || deps.defaultModel || ''
  if (!model) throw new WriteRefused(400, 'Choose a model in Settings first.')
  return { apiKey: deps.apiKey, model }
}

/** An image for the model, checked to be the raster type it claims; `missing` is said when it is empty. */
export function readRasterImage(value: unknown, missing: string): { contentType: string; base64: string } {
  const image = (value ?? {}) as { contentType?: unknown; base64?: unknown }
  const contentType = typeof image.contentType === 'string' ? image.contentType.trim().toLowerCase() : ''
  // OpenRouter accepts PNG, JPEG, WebP and GIF, not SVG
  // (https://openrouter.ai/docs/guides/overview/multimodal/image-understanding),
  // so the Studio sends a PNG rendering of an SVG instead.
  const extension = RASTER_TYPES[contentType]
  if (!extension) {
    throw new WriteRefused(415, 'The model must be sent a JPEG, PNG or WebP; render an SVG to PNG first.')
  }
  const bytes = Buffer.from(typeof image.base64 === 'string' ? image.base64 : '', 'base64')
  if (bytes.byteLength === 0) throw new WriteRefused(400, missing)
  if (bytes.byteLength > MAX_REFERENCE_BYTES) {
    throw new WriteRefused(413, `Images sent to the model must be ${MAX_REFERENCE_BYTES / 1024 / 1024} MB or smaller.`)
  }
  if (sniffImage(bytes) !== extension) {
    throw new WriteRefused(415, `The image's contents are not a ${extension.toUpperCase()} image.`)
  }
  return { contentType, base64: bytes.toString('base64') }
}

function lessonIds(library: LibrarySnapshot): Set<string> {
  try {
    const lessons = (JSON.parse(library.lessons?.text ?? '{}') as { lessons?: { id?: unknown }[] }).lessons
    return new Set((lessons ?? []).map((lesson) => String(lesson.id)))
  } catch {
    return new Set()
  }
}
