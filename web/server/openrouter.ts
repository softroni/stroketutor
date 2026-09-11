import type { Analysis } from '../src/catalog/types'

import { OUTPUT_SCHEMA, PROMPT_VERSION, buildMessages, type PromptInput } from './prompts/lessonPrompt'

/**
 * Lesson generation through OpenRouter (master plan §20–22). Runs only on the
 * Studio's local server, so the API key never reaches the browser.
 *
 * Request and response handling follow OpenRouter's documentation as read on
 * 2026-09-11:
 * - endpoint, bearer auth, attribution headers:
 *   https://openrouter.ai/docs/api-reference/overview
 * - images as `image_url` content parts carrying base64 data URLs:
 *   https://openrouter.ai/docs/guides/overview/multimodal/image-understanding
 * - strict JSON-schema output through `response_format`, with
 *   `provider.require_parameters` so only providers that honour it are used:
 *   https://openrouter.ai/docs/features/structured-outputs
 * - status codes, and provider failures that arrive as 200 with
 *   `finish_reason: "error"`: https://openrouter.ai/docs/api-reference/errors
 */

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

/** Room for a detailed lesson; a truncated answer is reported, never used. */
export const MAX_OUTPUT_TOKENS = 16000

const TIMEOUT_MS = 180_000

export interface GenerateRequest extends PromptInput {
  model: string
  lessonId: string
}

/** A v1 tutorial as generated: complete in shape, not yet validated. */
export interface CandidateTutorial {
  schemaVersion: 1
  id: string
  title: string
  canvas: { width: number; height: number }
  steps: unknown[]
}

export interface Candidate {
  analysis: Analysis
  tutorial: CandidateTutorial
  /** The model that actually answered, as OpenRouter reports it. */
  model: string
  promptVersion: string
  usage?: { promptTokens?: number; completionTokens?: number; cost?: number }
}

/** A generation that produced nothing usable, with a sentence the creator can act on. */
export class GenerationFailed extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail?: string,
  ) {
    super(message)
    this.name = 'GenerationFailed'
  }
}

export interface OpenRouterOptions {
  apiKey: string
  fetch?: typeof fetch
}

interface ChatResponse {
  model?: string
  error?: { code?: number; message?: string }
  choices?: { finish_reason?: string | null; message?: { content?: string | null } }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }
}

export async function requestLesson(
  request: GenerateRequest,
  options: OpenRouterOptions,
): Promise<Candidate> {
  const body = {
    model: request.model,
    messages: buildMessages(request),
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'stroketutor_lesson', strict: true, schema: OUTPUT_SCHEMA },
    },
    provider: { require_parameters: true },
    max_tokens: MAX_OUTPUT_TOKENS,
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response: Response
  try {
    response = await (options.fetch ?? fetch)(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost',
        'X-OpenRouter-Title': 'StrokeTutor Studio',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch {
    throw new GenerationFailed(
      504,
      controller.signal.aborted
        ? 'OpenRouter took too long to answer, so the request was stopped. Try again.'
        : 'Could not reach OpenRouter. Check the network connection.',
    )
  } finally {
    clearTimeout(timer)
  }

  const payload = (await response.json().catch(() => null)) as ChatResponse | null
  if (!response.ok) throw failureFor(response.status, payload?.error?.message)

  const choice = payload?.choices?.[0]
  if (payload?.error || choice?.finish_reason === 'error') {
    throw new GenerationFailed(
      502,
      `The model's provider failed while answering: ${payload?.error?.message ?? 'no details given'}. Try again.`,
    )
  }
  if (choice?.finish_reason === 'length') {
    throw new GenerationFailed(
      502,
      'The model ran out of room before finishing the lesson. Try again, or choose a model with a larger output limit.',
    )
  }
  const content = choice?.message?.content
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new GenerationFailed(502, 'The model answered without a lesson.')
  }

  const output = parseOutput(content)
  return {
    analysis: output.analysis,
    tutorial: toCandidate(output.steps, request),
    model: payload?.model ?? request.model,
    promptVersion: PROMPT_VERSION,
    usage: payload?.usage
      ? {
          promptTokens: payload.usage.prompt_tokens,
          completionTokens: payload.usage.completion_tokens,
          cost: payload.usage.cost,
        }
      : undefined,
  }
}

function failureFor(status: number, message = 'no details given'): GenerationFailed {
  switch (status) {
    case 400:
      return new GenerationFailed(400, `OpenRouter refused the request: ${message}`)
    case 401:
      return new GenerationFailed(
        401,
        'OpenRouter rejected the API key. Check OPENROUTER_API_KEY in web/.env.local, then restart npm run dev.',
      )
    case 402:
      return new GenerationFailed(402, 'The OpenRouter account has run out of credits.')
    case 403:
      return new GenerationFailed(
        403,
        `OpenRouter or the model's provider refused this request (moderation or permissions): ${message}`,
      )
    case 408:
      return new GenerationFailed(504, 'OpenRouter timed out. Try again.')
    case 429:
      return new GenerationFailed(429, 'OpenRouter is rate-limiting requests. Wait a moment, then try again.')
    case 502:
    case 503:
      return new GenerationFailed(
        503,
        `No provider could serve this model with structured output just now. Try again, or choose another model. (${message})`,
      )
    default:
      return new GenerationFailed(502, `OpenRouter answered ${status}: ${message}`)
  }
}

/** The model's JSON, tolerating a Markdown fence some providers add anyway. */
function parseOutput(content: string): { analysis: Analysis; steps: unknown[] } {
  const unfenced = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  let data: unknown
  try {
    data = JSON.parse(unfenced)
  } catch {
    throw new GenerationFailed(502, "The model's answer was not the JSON that was asked for.", content.slice(0, 500))
  }

  const root = data as { analysis?: unknown; tutorial?: { steps?: unknown } } | null
  const analysis = root?.analysis as Partial<Analysis> | undefined
  const isStrings = (value: unknown) =>
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  if (
    !analysis ||
    !isStrings(analysis.mainForms) ||
    !isStrings(analysis.importantDetails) ||
    !isStrings(analysis.detailsRemoved) ||
    typeof analysis.drawingStrategy !== 'string'
  ) {
    throw new GenerationFailed(502, "The model's answer is missing its analysis of the photo.")
  }
  if (!Array.isArray(root?.tutorial?.steps)) {
    throw new GenerationFailed(502, "The model's answer is missing the lesson's steps.")
  }
  return { analysis: analysis as Analysis, steps: root.tutorial.steps as unknown[] }
}

/**
 * Completes the model's steps into a v1 document. Step contents are copied as
 * given — strict validation afterwards reports anything wrong by its exact
 * path — but step ids are made safe and unique, since the editor relies on it.
 */
function toCandidate(steps: unknown[], request: GenerateRequest): CandidateTutorial {
  const taken = new Set<string>()
  return {
    schemaVersion: 1,
    id: request.lessonId,
    title: request.title,
    canvas: request.canvas,
    steps: steps.map((step, index) => {
      if (step === null || typeof step !== 'object') return step
      const { id, title, instruction, strokes } = step as Record<string, unknown>
      const base = slug(typeof id === 'string' && id ? id : String(title ?? '')) || `step-${index + 1}`
      let unique = base
      for (let n = 2; taken.has(unique); n += 1) unique = `${base}-${n}`
      taken.add(unique)
      return { id: unique, title, instruction, voiceover: null, strokes }
    }),
  }
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
