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

/** How long a generation may take before it is stopped, unless a request allows more. */
export const DEFAULT_TIMEOUT_MS = 180_000

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

interface ChatError {
  code?: number
  message?: string
  metadata?: Record<string, unknown>
}

interface ChatResponse {
  model?: string
  /** The provider that served the request, e.g. "Google". */
  provider?: string
  error?: ChatError
  choices?: {
    finish_reason?: string | null
    /** The provider's own stop reason, such as Gemini's "SAFETY" or "MALFORMED_FUNCTION_CALL". */
    native_finish_reason?: string | null
    message?: { content?: string | null }
  }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }
}

export async function requestLesson(
  request: GenerateRequest,
  options: OpenRouterOptions,
): Promise<Candidate> {
  const completion = await completeJSON(
    { model: request.model, messages: buildMessages(request), schemaName: 'papercoach_lesson', schema: OUTPUT_SCHEMA },
    options,
  )
  const output = parseOutput(completion.content)
  return {
    analysis: output.analysis,
    tutorial: toCandidate(output.steps, request),
    model: completion.model,
    promptVersion: PROMPT_VERSION,
    usage: completion.usage,
  }
}

export interface Completion {
  /** The model's answer text, not yet parsed. */
  content: string
  /** The model that actually answered, as OpenRouter reports it. */
  model: string
  usage?: Candidate['usage']
}

/**
 * One strict-JSON chat completion through OpenRouter, with every documented
 * failure turned into a sentence the creator can act on. Shared by the photo
 * and SVG lesson prompts.
 */
export async function completeJSON(
  request: {
    model: string
    messages: unknown[]
    schemaName: string
    schema: unknown
    maxTokens?: number
    /** Defaults to {@link DEFAULT_TIMEOUT_MS}. */
    timeoutMs?: number
  },
  options: OpenRouterOptions,
): Promise<Completion> {
  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const body = {
    model: request.model,
    messages: request.messages,
    response_format: {
      type: 'json_schema',
      json_schema: { name: request.schemaName, strict: true, schema: request.schema },
    },
    provider: { require_parameters: true },
    max_tokens: request.maxTokens ?? MAX_OUTPUT_TOKENS,
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response: Response
  try {
    response = await (options.fetch ?? fetch)(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost',
        'X-OpenRouter-Title': 'Paper Couch Studio',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch {
    throw new GenerationFailed(
      504,
      controller.signal.aborted
        ? `OpenRouter took longer than ${describeWait(timeoutMs)} to answer, so the request was stopped. Try again, or choose a faster model in Settings.`
        : 'Could not reach OpenRouter. Check the network connection.',
    )
  } finally {
    clearTimeout(timer)
  }

  const payload = (await response.json().catch(() => null)) as ChatResponse | null
  if (!response.ok) throw failureFor(response.status, payload?.error)

  const choice = payload?.choices?.[0]
  if (payload?.error || choice?.finish_reason === 'error') {
    // A failure after the answer began arrives as a 200. The top-level error is
    // often absent; the provider and its native stop reason are then all there is.
    const native = choice?.native_finish_reason ? `it stopped with "${choice.native_finish_reason}"` : ''
    const reasons = [payload?.error ? reasonOf(payload.error) : '', native].filter(Boolean).join('; ')
    console.warn(
      '[studio] generation failed inside a 200:',
      JSON.stringify({
        model: payload?.model ?? request.model,
        provider: payload?.provider,
        finish_reason: choice?.finish_reason,
        native_finish_reason: choice?.native_finish_reason,
        error: payload?.error,
        usage: payload?.usage,
      }),
    )
    throw new GenerationFailed(
      502,
      `The model's provider${payload?.provider ? ` (${payload.provider})` : ''} failed while answering: ${
        reasons || 'no details given'
      }. Try again, or choose another model in Settings.`,
    )
  }
  if (choice?.finish_reason === 'length') {
    // Thinking models spend output tokens on reasoning before they answer, so
    // what was spent is the only clue to why the answer was cut off.
    console.warn(
      '[studio] generation cut off at the output limit:',
      JSON.stringify({ model: payload?.model ?? request.model, provider: payload?.provider, maxTokens: body.max_tokens, usage: payload?.usage }),
    )
    throw new GenerationFailed(
      502,
      'The model ran out of room before finishing the lesson. Try again, or choose a model with a larger output limit.',
    )
  }
  const content = choice?.message?.content
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new GenerationFailed(502, 'The model answered without a lesson.')
  }

  return {
    content,
    model: payload?.model ?? request.model,
    usage: payload?.usage
      ? {
          promptTokens: payload.usage.prompt_tokens,
          completionTokens: payload.usage.completion_tokens,
          cost: payload.usage.cost,
        }
      : undefined,
  }
}

/**
 * OpenRouter's message, plus the provider's own reason when OpenRouter passes
 * one on in `error.metadata` (provider name, the upstream body as `raw`, and
 * `provider_code`). On its own, "Provider returned error" gives the creator
 * nothing to act on.
 */
export function reasonOf(error: ChatError | undefined): string {
  const message = error?.message?.trim() || 'no details given'
  const metadata = error?.metadata ?? {}
  const provider = typeof metadata.provider_name === 'string' ? metadata.provider_name : ''
  const raw = upstreamMessage(metadata.raw)
  const code = typeof metadata.provider_code === 'string' ? metadata.provider_code : ''
  const detail = raw || (code ? `code ${code}` : '')
  if (!provider && !detail) return message
  return `${message} (${[provider, detail].filter(Boolean).join(': ')})`
}

/** The readable part of a provider's error body, which arrives as JSON text, an object or plain text. */
function upstreamMessage(raw: unknown): string {
  let value = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      return raw.trim().slice(0, 300)
    }
  }
  const nested = value as { error?: { message?: unknown } | string; message?: unknown } | null
  const text =
    (typeof nested?.error === 'object' && typeof nested.error?.message === 'string' && nested.error.message) ||
    (typeof nested?.error === 'string' && nested.error) ||
    (typeof nested?.message === 'string' && nested.message) ||
    (value === null || value === undefined ? '' : JSON.stringify(value))
  return text.trim().slice(0, 300)
}

function failureFor(status: number, error: ChatError | undefined): GenerationFailed {
  const message = reasonOf(error)
  switch (status) {
    case 400:
      return new GenerationFailed(
        400,
        typeof error?.metadata?.provider_name === 'string'
          ? `The model's provider refused the request: ${message}. Try another model in Settings.`
          : `OpenRouter refused the request: ${message}`,
      )
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

function describeWait(ms: number): string {
  return ms >= 60_000 ? `${Math.round(ms / 60_000)} minutes` : `${Math.round(ms / 1000)} seconds`
}

/** The model's JSON, tolerating a Markdown fence some providers add anyway. */
export function parseAnswer(content: string): unknown {
  const unfenced = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  try {
    return JSON.parse(unfenced)
  } catch {
    throw new GenerationFailed(502, "The model's answer was not the JSON that was asked for.", content.slice(0, 500))
  }
}

/** Whether a value is a complete analysis, as both prompts ask for. */
export function isAnalysis(value: unknown): value is Analysis {
  const analysis = value as Partial<Analysis> | null | undefined
  const isStrings = (list: unknown) => Array.isArray(list) && list.every((item) => typeof item === 'string')
  return Boolean(
    analysis &&
      isStrings(analysis.mainForms) &&
      isStrings(analysis.importantDetails) &&
      isStrings(analysis.detailsRemoved) &&
      typeof analysis.drawingStrategy === 'string',
  )
}

function parseOutput(content: string): { analysis: Analysis; steps: unknown[] } {
  const root = parseAnswer(content) as { analysis?: unknown; tutorial?: { steps?: unknown } } | null
  if (!isAnalysis(root?.analysis)) {
    throw new GenerationFailed(502, "The model's answer is missing its analysis of the photo.")
  }
  if (!Array.isArray(root?.tutorial?.steps)) {
    throw new GenerationFailed(502, "The model's answer is missing the lesson's steps.")
  }
  return { analysis: root.analysis, steps: root.tutorial.steps as unknown[] }
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

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
