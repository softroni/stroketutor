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
): Promise<GenerateResult> {
  if (!deps.apiKey) {
    throw new WriteRefused(
      503,
      'Generation needs an OpenRouter key: add OPENROUTER_API_KEY to web/.env.local, then restart npm run dev.',
    )
  }

  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
  const model = text(body.model) || deps.defaultModel || ''
  if (!model) throw new WriteRefused(400, 'Choose a model in Settings first.')

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

  const image = (body.image ?? {}) as { contentType?: unknown; base64?: unknown }
  const contentType = text(image.contentType).toLowerCase()
  // OpenRouter accepts PNG, JPEG, WebP and GIF, not SVG
  // (https://openrouter.ai/docs/guides/overview/multimodal/image-understanding),
  // so the Studio sends a PNG rendering of an SVG reference instead.
  const extension = RASTER_TYPES[contentType]
  if (!extension) {
    throw new WriteRefused(415, 'The model must be sent a JPEG, PNG or WebP; render an SVG to PNG first.')
  }
  const bytes = Buffer.from(text(image.base64), 'base64')
  if (bytes.byteLength === 0) throw new WriteRefused(400, 'Add a reference photo.')
  if (bytes.byteLength > MAX_REFERENCE_BYTES) {
    throw new WriteRefused(413, `Reference photos must be ${MAX_REFERENCE_BYTES / 1024 / 1024} MB or smaller.`)
  }
  if (sniffImage(bytes) !== extension) {
    throw new WriteRefused(415, `The photo's contents are not a ${extension.toUpperCase()} image.`)
  }

  const library = await deps.library()
  const taken =
    library.tutorials.some((file) => file.fileName === `${lessonId}.json`) ||
    lessonIds(library).has(lessonId)
  if (taken) {
    throw new WriteRefused(
      409,
      `A lesson called "${lessonId}" already exists. Generation never replaces a lesson; choose another id.`,
    )
  }

  const position = typeof body.position === 'number' && Number.isInteger(body.position) ? body.position : Infinity
  const candidate = await requestLesson(
    {
      model,
      lessonId,
      title,
      canvas: GENERATION_CANVAS,
      image: { contentType, base64: bytes.toString('base64') },
      context: lessonContext(library, text(body.pathId) || null, position, goal, text(body.constraints)),
    },
    { apiKey: deps.apiKey, fetch: deps.fetch },
  )

  const verdict = deps.validateTutorial(candidate.tutorial)
  return { ...candidate, issues: verdict.ok ? [] : verdict.issues }
}

function lessonIds(library: LibrarySnapshot): Set<string> {
  try {
    const lessons = (JSON.parse(library.lessons?.text ?? '{}') as { lessons?: { id?: unknown }[] }).lessons
    return new Set((lessons ?? []).map((lesson) => String(lesson.id)))
  } catch {
    return new Set()
  }
}
