import type { Analysis } from '../src/catalog/types'
import { formatPath, parsePath, type PathSegment, type Point } from '../src/player/svgPath'
import type { Fill, Step, Stroke, Tutorial } from '../src/schema/types'

import { generateCandidate, readModelChoice, readRasterImage, type GenerateDeps } from './generate'
import { TRACE_TIMEOUT_MS, generateFromTrace } from './generateFromTrace'
import { lessonContext } from './lessonContext'
import { GenerationFailed, completeJSON, parseAnswer } from './openrouter'
import { count, createPlacer, createStepIds, wasWere } from './placement'
import {
  REGENERATE_PROMPT_VERSIONS,
  REGENERATE_SCHEMAS,
  buildRegenerateMessages,
  type EditLayer,
  type LessonSummary,
} from './prompts/regeneratePrompt'
import { ID_PATTERN, WriteRefused, type Issue } from './repoWriter'

/** The four layers of master plan §24. */
export type Layer = 'drawing' | EditLayer
export const LAYERS: readonly Layer[] = ['drawing', 'order', 'steps', 'instructions']

/** As for SVG generation: the answer is small, but thinking models reason at length first. */
export const REGENERATE_OUTPUT_TOKENS = 32000

export interface RegenerateResult {
  layer: Layer
  /** Unvalidated until checked; `issues` is the verdict. */
  tutorial: unknown
  issues: Issue[]
  /** What the Studio corrected in the model's answer, in sentences. */
  notes: string[]
  /** The model's own account of what it changed (order, steps and instructions). */
  rationale?: string
  /** A new drawing comes with a new analysis of the reference. */
  analysis?: Analysis
  model: string
  promptVersion: string
  usage?: { promptTokens?: number; completionTokens?: number; cost?: number }
}

/** A step as the model planned it. Absent fields are empty. */
export interface PlannedStep {
  id: string
  title: string
  instruction: string
  strokeIds: string[]
  fillIds: string[]
}

/**
 * Regenerates one layer of an existing lesson. Writes nothing: the result
 * goes back to the workspace, where the creator compares it with the current
 * version and chooses.
 *
 * - drawing: a whole new generation for the same lesson id, from the photo, or
 *   from the SVG traced afresh in the browser;
 * - order, steps, instructions: the current lesson is sent, the model answers
 *   with ids and words, and the code rebuilds the lesson from the shapes it
 *   already has, so nothing outside that layer can change.
 */
export async function regenerate(body: Record<string, unknown>, deps: GenerateDeps): Promise<RegenerateResult> {
  const layer = body.layer as Layer
  if (!LAYERS.includes(layer)) {
    throw new WriteRefused(400, 'Choose what to regenerate: the drawing, the order, the steps or the instructions.')
  }
  if (layer === 'drawing') {
    const result =
      body.trace !== undefined
        ? await generateFromTrace(body, deps, 'existing')
        : await generateCandidate(body, deps, 'existing')
    return { layer, notes: [], ...result }
  }
  return regenerateLayer(layer, body, deps)
}

async function regenerateLayer(
  layer: EditLayer,
  body: Record<string, unknown>,
  deps: GenerateDeps,
): Promise<RegenerateResult> {
  // Everything is checked before anything is spent.
  const { apiKey, model } = readModelChoice(body, deps)
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
  const lessonId = text(body.lessonId)
  if (!ID_PATTERN.test(lessonId)) {
    throw new WriteRefused(400, 'The lesson id must use lowercase letters, digits and single dashes.')
  }
  const verdict = deps.validateTutorial(body.tutorial)
  if (!verdict.ok) {
    throw new WriteRefused(400, 'The lesson has validation problems. Fix them before regenerating a layer.', verdict.issues)
  }
  const tutorial = body.tutorial as Tutorial
  if (tutorial.id !== lessonId) throw new WriteRefused(400, `The lesson sent is "${tutorial.id}", not "${lessonId}".`)
  const drawing = readRasterImage(body.drawing, 'A picture of the current drawing is missing.')
  const reference = body.reference == null ? undefined : readRasterImage(body.reference, 'The reference picture is empty.')

  const library = await deps.library()
  if (!library.tutorials.some((file) => file.fileName === `${lessonId}.json`)) {
    throw new WriteRefused(404, `There is no lesson "${lessonId}" to regenerate.`)
  }
  const position = typeof body.position === 'number' && Number.isInteger(body.position) ? body.position : Infinity
  const context = lessonContext(library, text(body.pathId) || null, position, text(body.goal), text(body.constraints))

  const completion = await completeJSON(
    {
      model,
      messages: buildRegenerateMessages({
        layer,
        title: tutorial.title,
        context,
        lesson: summariseLesson(tutorial),
        note: text(body.note),
        drawing,
        reference,
      }),
      schemaName: `papercoach_${layer}`,
      schema: REGENERATE_SCHEMAS[layer],
      maxTokens: REGENERATE_OUTPUT_TOKENS,
      // Ordering or regrouping many lines reasons at length, like the SVG prompt.
      timeoutMs: TRACE_TIMEOUT_MS,
    },
    { apiKey, fetch: deps.fetch },
  )

  const answer = parseAnswer(completion.content) as Record<string, unknown> | null
  if (!Array.isArray(answer?.steps)) throw new GenerationFailed(502, "The model's answer is missing the lesson's steps.")
  const plan = plannedSteps(answer.steps)
  const applied =
    layer === 'instructions'
      ? applyInstructions(tutorial, plan)
      : layer === 'order'
        ? applyOrder(tutorial, plan, strings(answer.reversedStrokeIds))
        : applySteps(tutorial, plan)

  const result = deps.validateTutorial(applied.tutorial)
  return {
    layer,
    tutorial: applied.tutorial,
    issues: result.ok ? [] : result.issues,
    notes: applied.notes,
    rationale: typeof answer.rationale === 'string' ? answer.rationale.trim() : '',
    model: completion.model,
    promptVersion: REGENERATE_PROMPT_VERSIONS[layer],
    usage: completion.usage,
  }
}

interface Labelled {
  step: Step
  strokes: { id: string; item: Stroke }[]
  fills: { id: string; item: Fill }[]
}

/** Lines are s1, s2, … and colours f1, f2, … in the order the lesson draws them. */
function label(tutorial: Tutorial): Labelled[] {
  let strokes = 0
  let fills = 0
  return tutorial.steps.map((step) => ({
    step,
    strokes: step.strokes.map((item) => ({ id: `s${(strokes += 1)}`, item })),
    fills: (step.fills ?? []).map((item) => ({ id: `f${(fills += 1)}`, item })),
  }))
}

export function summariseLesson(tutorial: Tutorial): LessonSummary {
  return {
    canvas: tutorial.canvas,
    steps: label(tutorial).map(({ step, strokes, fills }) => ({
      id: step.id,
      title: step.title,
      instruction: step.instruction,
      strokes: strokes.map(({ id, item }) => {
        const { box, start, end, length } = shapeFacts(item.d)
        return { id, box, start, end, length }
      }),
      fills: fills.map(({ id, item }) => {
        const { box, area } = shapeFacts(item.d)
        return { id, color: item.color, box, area }
      }),
    })),
  }
}

/** New words for every step the model rewrote. Nothing else changes. */
export function applyInstructions(tutorial: Tutorial, plan: PlannedStep[]): { tutorial: Tutorial; notes: string[] } {
  const known = new Set(tutorial.steps.map((step) => step.id))
  const byId = new Map<string, PlannedStep>()
  let madeUp = 0
  for (const planned of plan) {
    if (!known.has(planned.id)) madeUp += 1
    else if (!byId.has(planned.id)) byId.set(planned.id, planned)
  }
  let unchanged = 0
  const steps = tutorial.steps.map((step) => {
    const planned = byId.get(step.id)
    if (!planned || !planned.title || !planned.instruction) {
      unchanged += 1
      return step
    }
    return { ...step, title: planned.title, instruction: planned.instruction }
  })
  const notes: string[] = []
  if (unchanged > 0) {
    notes.push(`${count(unchanged, 'step keeps its', 'steps keep their')} old words: the model did not rewrite ${unchanged === 1 ? 'it' : 'them'}.`)
  }
  if (madeUp > 0) notes.push(`${count(madeUp, 'step id', 'step ids')} the model made up ${wasWere(madeUp)} ignored.`)
  return { tutorial: { ...tutorial, steps }, notes }
}

/**
 * A new drawing sequence: the steps in the model's order, each step's own
 * lines and colours in the model's order, and some lines drawn from the other
 * end. No line or colour changes step, and each step keeps its words.
 */
export function applyOrder(
  tutorial: Tutorial,
  plan: PlannedStep[],
  reversed: string[],
): { tutorial: Tutorial; notes: string[] } {
  const labelled = label(tutorial)
  const stepsById = new Map(labelled.map((entry) => [entry.step.id, entry]))
  const planById = new Map<string, PlannedStep>()
  const ordered: Labelled[] = []
  let madeUpSteps = 0
  for (const planned of plan) {
    const entry = stepsById.get(planned.id)
    if (!entry) madeUpSteps += 1
    else if (!planById.has(planned.id)) {
      planById.set(planned.id, planned)
      ordered.push(entry)
    }
  }
  const leftOutSteps = labelled.filter((entry) => !planById.has(entry.step.id))
  ordered.push(...leftOutSteps)

  let foreign = 0
  let unordered = 0
  const arrange = <T>(items: { id: string; item: T }[], ids: string[]) => {
    const own = new Map(items.map((entry) => [entry.id, entry]))
    const placed = new Set<string>()
    const result: { id: string; item: T }[] = []
    for (const id of ids) {
      const entry = own.get(id)
      if (!entry) foreign += 1
      else if (!placed.has(id)) {
        placed.add(id)
        result.push(entry)
      }
    }
    const rest = items.filter((entry) => !placed.has(entry.id))
    unordered += rest.length
    return [...result, ...rest]
  }

  const allStrokeIds = new Set(labelled.flatMap((entry) => entry.strokes.map((stroke) => stroke.id)))
  const flip = new Set(reversed.filter((id) => allStrokeIds.has(id)))
  const steps = ordered.map((entry) => {
    const planned = planById.get(entry.step.id)
    const strokes = planned ? arrange(entry.strokes, planned.strokeIds) : entry.strokes
    const fills = planned ? arrange(entry.fills, planned.fillIds) : entry.fills
    return {
      ...entry.step,
      strokes: strokes.map(({ id, item }) => (flip.has(id) ? { ...item, d: reversePath(item.d) } : item)),
      ...(entry.step.fills ? { fills: fills.map(({ item }) => item) } : {}),
    }
  })

  const notes: string[] = []
  if (flip.size > 0) notes.push(`${count(flip.size, 'line is', 'lines are')} now drawn from the other end.`)
  if (leftOutSteps.length > 0) {
    notes.push(`${count(leftOutSteps.length, 'step', 'steps')} the model left out ${wasWere(leftOutSteps.length)} kept at the end.`)
  }
  if (unordered > 0) {
    notes.push(`${count(unordered, 'line or colour', 'lines and colours')} the model did not order stayed at the end of ${unordered === 1 ? 'its' : 'their'} step.`)
  }
  const madeUp = madeUpSteps + foreign + reversed.filter((id) => !allStrokeIds.has(id)).length
  if (madeUp > 0) {
    notes.push(`${count(madeUp, 'id', 'ids')} from another step or made up ${wasWere(madeUp)} ignored: reordering never moves a line to another step.`)
  }
  return { tutorial: { ...tutorial, steps }, notes }
}

/**
 * New steps from the same lines and colours: the model's grouping and words,
 * every shape placed exactly once, each keeping its timing, width and colour.
 */
export function applySteps(tutorial: Tutorial, plan: PlannedStep[]): { tutorial: Tutorial; notes: string[] } {
  const labelled = label(tutorial)
  const strokes = labelled.flatMap((entry) => entry.strokes)
  const fills = labelled.flatMap((entry) => entry.fills)
  const placer = createPlacer()
  const strokesById = new Map(strokes.map(({ id, item }) => [id, item]))
  const fillsById = new Map(fills.map(({ id, item }) => [id, item]))

  const groups = plan
    .map((planned) => ({
      planned,
      strokes: placer.take(planned.strokeIds, strokesById),
      fills: placer.take(planned.fillIds, fillsById),
    }))
    .filter((group) => group.strokes.length + group.fills.length > 0)

  const notes: string[] = []
  const missingStrokes = strokes.filter(({ id }) => !placer.used.has(id)).map(({ item }) => item)
  if (missingStrokes.length > 0) {
    let last = [...groups].reverse().find((group) => group.strokes.length > 0)
    if (!last) {
      last = {
        planned: { id: 'lines', title: 'Draw the lines', instruction: 'Draw the lines one at a time, as the animation shows them.', strokeIds: [], fillIds: [] },
        strokes: [],
        fills: [],
      }
      groups.unshift(last)
    }
    last.strokes.push(...missingStrokes)
    notes.push(`${count(missingStrokes.length, 'line', 'lines')} the model did not place ${wasWere(missingStrokes.length)} added to the last step with lines.`)
  }
  const missingFills = fills.filter(({ id }) => !placer.used.has(id)).map(({ item }) => item)
  if (missingFills.length > 0) {
    let last = [...groups].reverse().find((group) => group.fills.length > 0)
    if (!last) {
      last = {
        planned: { id: 'colour', title: 'Colour it in', instruction: 'Colour each area as in the picture, the largest first.', strokeIds: [], fillIds: [] },
        strokes: [],
        fills: [],
      }
      groups.push(last)
    }
    last.fills.push(...missingFills)
    notes.push(`${count(missingFills.length, 'colour', 'colours')} the model did not place ${wasWere(missingFills.length)} put in the last colour step.`)
  }
  notes.push(...placer.notes())

  const stepId = createStepIds()
  const steps: Step[] = groups.map((group, index) => ({
    id: stepId(group.planned.id || group.planned.title, `step-${index + 1}`),
    title: group.planned.title,
    instruction: group.planned.instruction,
    voiceover: null,
    strokes: group.strokes,
    ...(group.fills.length > 0 ? { fills: group.fills } : {}),
  }))
  return { tutorial: { ...tutorial, steps }, notes }
}

/**
 * The same path drawn from the other end: subpaths in reverse order, each one
 * reversed segment by segment. A closed subpath keeps its start point and runs
 * the other way round; reversing twice gives the path back as it was. The
 * player animates a stroke from its start, so this is how a line's drawing
 * direction changes without changing its shape.
 */
export function reversePath(d: string): string {
  const subpaths: { start: Point; parts: Exclude<PathSegment, { kind: 'move' } | { kind: 'close' }>[]; closed: boolean }[] = []
  for (const segment of parsePath(d)) {
    if (segment.kind === 'move') {
      subpaths.push({ start: segment.to, parts: [], closed: false })
    } else if (segment.kind === 'close') {
      subpaths[subpaths.length - 1].closed = true
    } else {
      let current = subpaths[subpaths.length - 1]
      // Drawing on after Z starts again from the subpath's first point.
      if (current.closed) {
        current = { start: current.start, parts: [], closed: false }
        subpaths.push(current)
      }
      current.parts.push(segment)
    }
  }

  const reversed: PathSegment[] = []
  for (const { start, parts, closed } of [...subpaths].reverse()) {
    const points = [start, ...parts.map((part) => (part.kind === 'line' ? part.to : part.end))]
    const last = points[points.length - 1]
    if (closed) {
      reversed.push({ kind: 'move', to: start })
      if (last.x !== start.x || last.y !== start.y) reversed.push({ kind: 'line', to: last })
    } else {
      reversed.push({ kind: 'move', to: last })
    }
    for (let index = parts.length - 1; index >= 0; index -= 1) {
      const part = parts[index]
      const to = points[index]
      // Z draws the straight line back to the start itself, so a line there is
      // not written; that keeps reversing twice byte-identical for closed shapes.
      if (part.kind === 'line' && closed && index === 0) continue
      if (part.kind === 'line') reversed.push({ kind: 'line', to })
      else if (part.kind === 'quad') reversed.push({ kind: 'quad', control: part.control, end: to })
      else reversed.push({ kind: 'cubic', control1: part.control2, control2: part.control1, end: to })
    }
    if (closed) reversed.push({ kind: 'close' })
  }
  return formatPath(reversed)
}

/** Box, ends, length and rough area of a validated path, from its geometry alone. */
function shapeFacts(d: string) {
  const outlines: Point[][] = []
  let current: Point = { x: 0, y: 0 }
  let start = current
  const add = (point: Point) => {
    outlines[outlines.length - 1].push(point)
    current = point
  }
  const curve = (at: (t: number) => Point) => {
    for (let i = 1; i <= 12; i += 1) add(at(i / 12))
  }
  for (const segment of parsePath(d)) {
    const from = current
    switch (segment.kind) {
      case 'move':
        outlines.push([segment.to])
        current = start = segment.to
        break
      case 'line':
        add(segment.to)
        break
      case 'close':
        add(start)
        break
      case 'quad':
        curve((t) => bezier([from, segment.control, segment.end], t))
        break
      case 'cubic':
        curve((t) => bezier([from, segment.control1, segment.control2, segment.end], t))
        break
    }
  }

  const all = outlines.flat()
  const xs = all.map((point) => point.x)
  const ys = all.map((point) => point.y)
  let length = 0
  let area = 0
  for (const outline of outlines) {
    let signed = 0
    for (let i = 1; i < outline.length; i += 1) {
      length += Math.hypot(outline[i].x - outline[i - 1].x, outline[i].y - outline[i - 1].y)
      signed += outline[i - 1].x * outline[i].y - outline[i].x * outline[i - 1].y
    }
    area += Math.abs(signed) / 2
  }
  const first = all[0]
  const finish = all[all.length - 1]
  return {
    box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as [number, number, number, number],
    start: [first.x, first.y] as [number, number],
    end: [finish.x, finish.y] as [number, number],
    length,
    area,
  }
}

/** A point on a Bézier curve of any degree, by de Casteljau. */
function bezier(points: Point[], t: number): Point {
  let level = points
  while (level.length > 1) {
    level = level.slice(1).map((point, i) => ({
      x: level[i].x + (point.x - level[i].x) * t,
      y: level[i].y + (point.y - level[i].y) * t,
    }))
  }
  return level[0]
}

function plannedSteps(value: unknown[]): PlannedStep[] {
  return value
    .filter((step): step is Record<string, unknown> => step !== null && typeof step === 'object')
    .map((step) => ({
      id: typeof step.id === 'string' ? step.id : '',
      title: typeof step.title === 'string' ? step.title.trim() : '',
      instruction: typeof step.instruction === 'string' ? step.instruction.trim() : '',
      strokeIds: strings(step.strokeIds),
      fillIds: strings(step.fillIds),
    }))
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}
