import type { Analysis } from '../src/catalog/types'

import { readLessonRequest, type GenerateDeps } from './generate'
import { lessonContext } from './lessonContext'
import { GenerationFailed, completeJSON, isAnalysis, parseAnswer, slug } from './openrouter'
import { SVG_OUTPUT_SCHEMA, SVG_PROMPT_VERSION, buildSvgMessages, type TraceSummary } from './prompts/svgLessonPrompt'
import { WriteRefused, type Issue } from './repoWriter'

type Box = [number, number, number, number]

/** A traced line as the browser sends it (see `src/trace/traceSvg.ts`), checked again here. */
export interface TraceStroke {
  id: string
  d: string
  lineWidth: number
  length: number
  box: Box
  closed: boolean
  color?: string
}

export interface TraceFill {
  id: string
  d: string
  color: string
  area: number
  box: Box
}

export interface Trace {
  canvas: { width: number; height: number }
  strokes: TraceStroke[]
  fills: TraceFill[]
}

export interface TraceGenerateResult {
  analysis: Analysis
  /** Unvalidated until checked; `issues` is the verdict. */
  tutorial: unknown
  model: string
  promptVersion: string
  usage?: { promptTokens?: number; completionTokens?: number; cost?: number }
  issues: Issue[]
  /** What the Studio corrected in the model's plan, in sentences. */
  notes: string[]
}

/** A step as the model planned it: words plus the ids it covers. */
export interface PlannedStep {
  id: string
  title: string
  instruction: string
  ids: string[]
}

export const MAX_TRACE_STROKES = 400
export const MAX_TRACE_FILLS = 64

/**
 * Output room for the SVG prompt. The answer itself is small, but thinking
 * models spend output tokens reasoning first (OpenRouter counts reasoning as
 * output), and ordering 64 traced lines used up the photo prompt's 16,000 in
 * the first live run, 2026-09-11.
 */
export const TRACE_OUTPUT_TOKENS = 32000

const round1 = (value: number) => Math.round(value * 10) / 10
/** About one second per 200 canvas units, as the photo prompt asks of models. */
export const strokeDuration = (length: number) => round1(Math.min(4, Math.max(0.4, length / 200)))
/** Larger areas take longer to colour, but never long enough to bore. */
export const fillDuration = (area: number) => round1(Math.min(3, Math.max(0.8, 0.6 + Math.sqrt(area) / 150)))

/**
 * A lesson from a traced SVG ("code traces, model teaches"). The browser has
 * already turned the file into exact lines and colours; the model sees only
 * their ids, positions and sizes, plus a picture, and answers with the steps
 * that order them and the words for each. Every shape in the lesson is the
 * traced one. Writes nothing, like photo generation.
 */
export async function generateFromTrace(body: Record<string, unknown>, deps: GenerateDeps): Promise<TraceGenerateResult> {
  // A malformed trace is refused before anything is spent.
  const trace = readTrace(body.trace)
  const input = await readLessonRequest(body, deps)
  const completion = await completeJSON(
    {
      model: input.model,
      messages: buildSvgMessages({
        title: input.title,
        context: lessonContext(input.library, input.pathId, input.position, input.goal, input.constraints),
        trace: summarise(trace),
        image: input.image,
      }),
      schemaName: 'stroketutor_svg_lesson',
      schema: SVG_OUTPUT_SCHEMA,
      maxTokens: TRACE_OUTPUT_TOKENS,
    },
    { apiKey: input.apiKey, fetch: deps.fetch },
  )

  const answer = parseAnswer(completion.content) as Record<string, unknown> | null
  const analysis = answer?.analysis
  if (!isAnalysis(analysis)) throw new GenerationFailed(502, "The model's answer is missing its analysis of the drawing.")
  const outline = plannedSteps(answer?.outlineSteps, 'strokeIds')
  const colour = plannedSteps(answer?.colourSteps, 'fillIds')
  if (!outline || !colour) throw new GenerationFailed(502, "The model's answer is missing the lesson's steps.")

  const { tutorial, notes } = assembleTracedLesson(trace, outline, colour, { id: input.lessonId, title: input.title })
  const verdict = deps.validateTutorial(tutorial)
  return {
    analysis,
    tutorial,
    model: completion.model,
    promptVersion: SVG_PROMPT_VERSION,
    usage: completion.usage,
    issues: verdict.ok ? [] : verdict.issues,
    notes,
  }
}

/**
 * Builds the lesson: outline steps in the model's order, then colour steps.
 * Every traced line and colour appears exactly once whatever the model
 * returned — ids it made up or repeated are ignored, and anything it left out
 * joins the last step of its kind — and each correction is reported. A drawing
 * with no colour at all stays version 1, which every player reads.
 */
export function assembleTracedLesson(
  trace: Trace,
  outline: PlannedStep[],
  colour: PlannedStep[],
  meta: { id: string; title: string },
): { tutorial: Record<string, unknown>; notes: string[] } {
  const notes: string[] = []
  const used = new Set<string>()
  let madeUp = 0
  let repeated = 0
  const take = <T extends { id: string }>(ids: string[], byId: Map<string, T>): T[] =>
    ids.flatMap((id) => {
      const item = byId.get(id)
      if (!item) {
        madeUp += 1
        return []
      }
      if (used.has(id)) {
        repeated += 1
        return []
      }
      used.add(id)
      return [item]
    })

  const strokesById = new Map(trace.strokes.map((stroke) => [stroke.id, stroke]))
  const fillsById = new Map(trace.fills.map((fill) => [fill.id, fill]))
  const outlineSteps = outline
    .map((step) => ({ step, items: take(step.ids, strokesById) }))
    .filter((entry) => entry.items.length > 0)
  const colourSteps = colour
    .map((step) => ({ step, items: take(step.ids, fillsById) }))
    .filter((entry) => entry.items.length > 0)

  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  const missingStrokes = trace.strokes.filter((stroke) => !used.has(stroke.id))
  if (missingStrokes.length > 0) {
    if (outlineSteps.length === 0) {
      outlineSteps.push({
        step: { id: 'outline', title: 'Draw the outline', instruction: 'Draw the lines one at a time, as the animation shows them.', ids: [] },
        items: [],
      })
    }
    outlineSteps[outlineSteps.length - 1].items.push(...missingStrokes)
    notes.push(
      `${count(missingStrokes.length, 'line', 'lines')} the model did not place ${missingStrokes.length === 1 ? 'was' : 'were'} added to the last outline step.`,
    )
  }
  const missingFills = trace.fills.filter((fill) => !used.has(fill.id))
  if (missingFills.length > 0) {
    if (colourSteps.length === 0) {
      colourSteps.push({
        step: { id: 'colour', title: 'Colour it in', instruction: 'Colour each area as in the picture, the largest first.', ids: [] },
        items: [],
      })
    }
    colourSteps[colourSteps.length - 1].items.push(...missingFills)
    notes.push(
      `${count(missingFills.length, 'colour', 'colours')} the model did not place ${missingFills.length === 1 ? 'was' : 'were'} put in the last colour step.`,
    )
  }
  if (madeUp > 0) notes.push(`${count(madeUp, 'id', 'ids')} the model made up ${madeUp === 1 ? 'was' : 'were'} ignored.`)
  if (repeated > 0) {
    notes.push(`${count(repeated, 'repeated id was', 'repeated ids were')} ignored; each line and colour is drawn once.`)
  }

  const taken = new Set<string>()
  const stepId = (step: PlannedStep, fallback: string) => {
    const base = slug(step.id || step.title) || fallback
    let unique = base
    for (let n = 2; taken.has(unique); n += 1) unique = `${base}-${n}`
    taken.add(unique)
    return unique
  }
  const coloured = trace.fills.length > 0 || trace.strokes.some((stroke) => stroke.color)
  const steps = [
    ...outlineSteps.map(({ step, items }, index) => ({
      id: stepId(step, `outline-${index + 1}`),
      title: step.title,
      instruction: step.instruction,
      voiceover: null,
      strokes: items.map((stroke) => ({
        d: stroke.d,
        duration: strokeDuration(stroke.length),
        lineWidth: stroke.lineWidth,
        ...(stroke.color ? { color: stroke.color } : {}),
      })),
    })),
    ...colourSteps.map(({ step, items }, index) => ({
      id: stepId(step, `colour-${index + 1}`),
      title: step.title,
      instruction: step.instruction,
      voiceover: null,
      strokes: [],
      fills: items.map((fill) => ({ d: fill.d, color: fill.color, duration: fillDuration(fill.area), fillRule: 'evenodd' })),
    })),
  ]
  return {
    tutorial: { schemaVersion: coloured ? 2 : 1, id: meta.id, title: meta.title, canvas: trace.canvas, steps },
    notes,
  }
}

function plannedSteps(value: unknown, key: 'strokeIds' | 'fillIds'): PlannedStep[] | null {
  if (!Array.isArray(value)) return null
  return value
    .filter((step): step is Record<string, unknown> => step !== null && typeof step === 'object')
    .map((step) => ({
      id: typeof step.id === 'string' ? step.id : '',
      title: typeof step.title === 'string' ? step.title.trim() : '',
      instruction: typeof step.instruction === 'string' ? step.instruction.trim() : '',
      ids: Array.isArray(step[key]) ? (step[key] as unknown[]).filter((id): id is string => typeof id === 'string') : [],
    }))
}

function summarise(trace: Trace): TraceSummary {
  return {
    canvas: trace.canvas,
    strokes: trace.strokes.map(({ id, box, length, closed }) => ({ id, box, length, closed })),
    fills: trace.fills.map(({ id, color, area, box }) => ({ id, color, area, box })),
  }
}

/** The browser's trace, re-checked: the server never trusts a shape it did not see validated. */
function readTrace(value: unknown): Trace {
  const refuse = (why: string) => new WriteRefused(400, `The traced drawing is malformed: ${why}`)
  const trace = value as Partial<Trace> | null | undefined
  if (!trace || typeof trace !== 'object') throw refuse('it is missing.')
  const canvas = trace.canvas
  if (!canvas || !(canvas.width > 0) || !(canvas.height > 0)) throw refuse('its canvas has no size.')
  if (!Array.isArray(trace.strokes) || !Array.isArray(trace.fills)) throw refuse('it has no lists of lines and colours.')
  if (trace.strokes.length === 0 && trace.fills.length === 0) throw refuse('it has nothing to draw.')
  if (trace.strokes.length > MAX_TRACE_STROKES || trace.fills.length > MAX_TRACE_FILLS) {
    throw refuse('it has more lines or colours than a lesson can hold.')
  }

  const ids = new Set<string>()
  const checkId = (id: unknown) => {
    if (typeof id !== 'string' || !/^[a-z0-9-]{1,24}$/.test(id) || ids.has(id)) {
      throw refuse(`the id ${JSON.stringify(id)} is missing, repeated or not a short id.`)
    }
    ids.add(id)
  }
  const isBox = (box: unknown): box is Box =>
    Array.isArray(box) && box.length === 4 && box.every((n) => typeof n === 'number' && Number.isFinite(n))

  const strokes = trace.strokes.map((stroke): TraceStroke => {
    checkId(stroke?.id)
    const complete =
      typeof stroke.d === 'string' &&
      stroke.d.length > 0 &&
      stroke.lineWidth > 0 &&
      stroke.length >= 0 &&
      isBox(stroke.box) &&
      typeof stroke.closed === 'boolean' &&
      (stroke.color === undefined || typeof stroke.color === 'string')
    if (!complete) throw refuse(`line ${stroke.id} is incomplete.`)
    return {
      id: stroke.id,
      d: stroke.d,
      lineWidth: stroke.lineWidth,
      length: stroke.length,
      box: stroke.box,
      closed: stroke.closed,
      ...(stroke.color ? { color: stroke.color } : {}),
    }
  })
  const fills = trace.fills.map((fill): TraceFill => {
    checkId(fill?.id)
    const complete = typeof fill.d === 'string' && fill.d.length > 0 && typeof fill.color === 'string' && fill.area > 0 && isBox(fill.box)
    if (!complete) throw refuse(`colour ${fill.id} is incomplete.`)
    return { id: fill.id, d: fill.d, color: fill.color, area: fill.area, box: fill.box }
  })
  return { canvas: { width: canvas.width, height: canvas.height }, strokes, fills }
}
