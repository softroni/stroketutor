/**
 * The models the Studio can generate with, read live from OpenRouter's public
 * model list, so no model id is baked into the code (master plan §20, §39).
 * Only models that accept images, support structured outputs and answer in
 * text alone qualify. Image-generation models (output "image,text", such as
 * google/gemini-2.5-flash-image) list structured outputs too, but their
 * provider refuses the request: on 2026-09-11 Google AI Studio answered "JSON
 * mode is not enabled for this model".
 * https://openrouter.ai/docs/api-reference/list-available-models
 */

export const MODELS_URL = 'https://openrouter.ai/api/v1/models'

const CACHE_MS = 10 * 60 * 1000

export interface VisionModel {
  id: string
  name: string
  contextLength: number | null
  /** US dollars per million tokens, as OpenRouter lists them. */
  promptPerMillion: number | null
  completionPerMillion: number | null
}

interface RawModel {
  id?: string
  name?: string
  context_length?: number
  architecture?: { input_modalities?: string[]; output_modalities?: string[] }
  supported_parameters?: string[]
  pricing?: { prompt?: string; completion?: string }
}

let cache: { at: number; models: VisionModel[] } | null = null

export async function listVisionModels(fetcher: typeof fetch = fetch): Promise<VisionModel[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.models
  let response: Response
  try {
    response = await fetcher(MODELS_URL, { headers: { Accept: 'application/json' } })
  } catch {
    return cache?.models ?? []
  }
  if (!response.ok) return cache?.models ?? []

  const body = (await response.json().catch(() => null)) as { data?: RawModel[] } | null
  const models = selectVisionModels(body?.data ?? [])
  cache = { at: Date.now(), models }
  return models
}

export function selectVisionModels(raw: RawModel[]): VisionModel[] {
  const perMillion = (price: string | undefined) => {
    const value = Number(price)
    return Number.isFinite(value) ? Math.round(value * 1_000_000 * 1000) / 1000 : null
  }
  return raw
    .filter(
      (model) =>
        typeof model.id === 'string' &&
        (model.architecture?.input_modalities ?? []).includes('image') &&
        (model.architecture?.output_modalities ?? ['text']).every((output) => output === 'text') &&
        (model.supported_parameters ?? []).includes('structured_outputs'),
    )
    .map((model) => ({
      id: model.id as string,
      name: model.name ?? (model.id as string),
      contextLength: model.context_length ?? null,
      promptPerMillion: perMillion(model.pricing?.prompt),
      completionPerMillion: perMillion(model.pricing?.completion),
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
}
