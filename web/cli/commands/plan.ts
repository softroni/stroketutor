import { readFile } from 'node:fs/promises'

import type { PlannedStep as TracePlannedStep } from '../../server/generateFromTrace'
import { applyInstructions, applyOrder, applySteps, summariseLesson, type PlannedStep } from '../../server/regenerate'
import type { EditLayer } from '../../server/prompts/regeneratePrompt'
import type { Tutorial } from '../../src/schema/types'
import type { TracedDrawing } from '../../src/trace/traceSvg'

import { stringValue, type OptionSpecs } from '../args'
import { command, type Command } from '../command'
import { readLesson, saveTutorial } from '../edit'
import { CliError, plural, stepTable, table } from '../output'

/**
 * Plans written by hand (or by an agent) in the vocabulary the models answer
 * in, so one language serves the agent, the prompts and the server:
 *
 * - for building from a trace, `outlineSteps` and `colourSteps` with the
 *   trace's own `strokeIds` and `fillIds` (`SVG_OUTPUT_SCHEMA`);
 * - for reshaping an existing lesson, `steps` (and `reversedStrokeIds`) over
 *   the lesson's labels s1..sN and f1..fM, as `lessons summary` prints them
 *   (`REGENERATE_SCHEMAS`).
 *
 * A plan is checked in full before anything is built or written, and each
 * refusal names what is wrong; the server's assembly then places every shape.
 */

type Raw = Record<string, unknown>

export async function readPlanFile(file: string): Promise<Raw> {
  const text = await readFile(file, 'utf8').catch(() => {
    throw new CliError(`Could not read the plan ${file}.`)
  })
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new CliError(`The plan ${file} is not JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new CliError(`The plan ${file} must be a JSON object.`)
  return parsed as Raw
}

const isObject = (value: unknown): value is Raw => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const list = (name: string, what: string) => `The plan's ${name} must be a list of ${what}.`

/** The entries of one list, each an object with a non-empty title and instruction (when `words` is asked for). */
function entries(raw: Raw, name: string, { required, words }: { required: boolean; words: boolean }): Raw[] {
  const value = raw[name]
  if (value === undefined) {
    if (required) throw new CliError(`The plan has no ${name} list.`)
    return []
  }
  if (!Array.isArray(value)) throw new CliError(list(name, 'steps'))
  return value.map((entry, index) => {
    if (!isObject(entry)) throw new CliError(`${name}[${index}] is not a step object.`)
    if (words && !text(entry.title)) throw new CliError(`${name}[${index}]${entry.id ? ` ("${String(entry.id)}")` : ''} has no title.`)
    if (words && !text(entry.instruction)) throw new CliError(`${name}[${index}]${entry.id ? ` ("${String(entry.id)}")` : ''} has no instruction.`)
    return entry
  })
}

function ids(entry: Raw, key: string, where: string): string[] {
  const value = entry[key]
  if (value === undefined) return []
  if (!Array.isArray(value) || !value.every((id) => typeof id === 'string')) throw new CliError(`${where}: ${key} must be a list of ids.`)
  return value as string[]
}

/** Every id named must exist, and none may be named twice, across all the steps of a plan. */
function checkIds(named: { id: string; where: string }[], known: Set<string>, what: string) {
  const unknown = named.filter(({ id }) => !known.has(id)).map(({ id }) => id)
  if (unknown.length > 0) throw new CliError(`The plan names ${plural(unknown.length, what)} that ${unknown.length === 1 ? 'is' : 'are'} not there: ${[...new Set(unknown)].join(', ')}.`)
  const seen = new Set<string>()
  for (const { id, where } of named) {
    if (seen.has(id)) throw new CliError(`The plan uses ${id} twice (the second time in ${where}); each line and colour is drawn once.`)
    seen.add(id)
  }
}

/** A plan for `svg to-steps --plan`: the trace's ids grouped into outline steps, then colour steps, and the lines to draw from the other end. */
export function tracePlan(raw: Raw, trace: TracedDrawing): { outline: TracePlannedStep[]; colour: TracePlannedStep[]; reversed: string[] } {
  const outlineEntries = entries(raw, 'outlineSteps', { required: true, words: true })
  const colourEntries = entries(raw, 'colourSteps', { required: trace.fills.length > 0, words: true })
  const where = (name: string, entry: Raw, index: number) => `${name}[${index}]${entry.id ? ` ("${String(entry.id)}")` : ''}`
  const outline = outlineEntries.map((entry, index) => ({ id: text(entry.id), title: text(entry.title), instruction: text(entry.instruction), ids: ids(entry, 'strokeIds', where('outlineSteps', entry, index)) }))
  const colour = colourEntries.map((entry, index) => ({ id: text(entry.id), title: text(entry.title), instruction: text(entry.instruction), ids: ids(entry, 'fillIds', where('colourSteps', entry, index)) }))
  checkIds(
    outline.flatMap((step, index) => step.ids.map((id) => ({ id, where: where('outlineSteps', outlineEntries[index], index) }))),
    new Set(trace.strokes.map((stroke) => stroke.id)),
    'line id',
  )
  checkIds(
    colour.flatMap((step, index) => step.ids.map((id) => ({ id, where: where('colourSteps', colourEntries[index], index) }))),
    new Set(trace.fills.map((fill) => fill.id)),
    'colour id',
  )
  if (outline.length === 0 && trace.strokes.length > 0) throw new CliError('The plan has no outline steps, and the trace has lines to draw.')
  const reversed = raw.reversedStrokeIds === undefined ? [] : ids(raw, 'reversedStrokeIds', 'The plan')
  const strokeIds = new Set(trace.strokes.map((stroke) => stroke.id))
  const unknownReversed = reversed.filter((id) => !strokeIds.has(id))
  if (unknownReversed.length > 0) throw new CliError(`reversedStrokeIds names ${plural(unknownReversed.length, 'line id')} that ${unknownReversed.length === 1 ? 'is' : 'are'} not there: ${unknownReversed.join(', ')}.`)
  return { outline, colour, reversed: [...new Set(reversed)] }
}

/** The lesson's labels, per step, as `summariseLesson` assigns them. */
function labelsOf(tutorial: Tutorial) {
  const summary = summariseLesson(tutorial)
  return summary.steps.map((step) => ({ id: step.id, strokeIds: step.strokes.map((stroke) => stroke.id), fillIds: step.fills.map((fill) => fill.id) }))
}

/** A plan for `lessons apply`: checked against the lesson's own steps and labels for the layer it changes. */
export function layerPlan(raw: Raw, tutorial: Tutorial, layer: EditLayer): { steps: PlannedStep[]; reversedStrokeIds: string[] } {
  const own = labelsOf(tutorial)
  const stepIds = new Set(own.map((step) => step.id))
  const strokeLabels = new Set(own.flatMap((step) => step.strokeIds))
  const fillLabels = new Set(own.flatMap((step) => step.fillIds))
  const raws = entries(raw, 'steps', { required: true, words: layer !== 'order' })
  const where = (entry: Raw, index: number) => `steps[${index}]${entry.id ? ` ("${String(entry.id)}")` : ''}`
  const steps: PlannedStep[] = raws.map((entry, index) => ({
    id: text(entry.id),
    title: text(entry.title),
    instruction: text(entry.instruction),
    strokeIds: ids(entry, 'strokeIds', where(entry, index)),
    fillIds: ids(entry, 'fillIds', where(entry, index)),
  }))

  const named = (key: 'strokeIds' | 'fillIds') => steps.flatMap((step, index) => step[key].map((id) => ({ id, where: where(raws[index], index) })))
  const eachLabelOnce = () => {
    checkIds(named('strokeIds'), strokeLabels, 'line label')
    checkIds(named('fillIds'), fillLabels, 'colour label')
    const placed = new Set([...named('strokeIds'), ...named('fillIds')].map(({ id }) => id))
    const missing = [...strokeLabels, ...fillLabels].filter((label) => !placed.has(label))
    if (missing.length > 0) throw new CliError(`The plan leaves out ${plural(missing.length, 'label')}: ${missing.join(', ')}. Every line and colour of the lesson must be placed.`)
  }

  if (layer === 'steps') {
    for (const [index, step] of steps.entries()) {
      if (step.strokeIds.length + step.fillIds.length === 0) throw new CliError(`${where(raws[index], index)} has no strokeIds or fillIds.`)
    }
    eachLabelOnce()
    return { steps, reversedStrokeIds: [] }
  }

  // instructions and order: one entry per existing step, each step exactly once.
  const unknown = steps.filter((step) => !stepIds.has(step.id))
  if (unknown.length > 0) throw new CliError(`The plan names ${plural(unknown.length, 'step')} the lesson does not have: ${unknown.map((step) => step.id || '(no id)').join(', ')}.`)
  const seen = new Set<string>()
  for (const step of steps) {
    if (seen.has(step.id)) throw new CliError(`The plan lists the step "${step.id}" twice.`)
    seen.add(step.id)
  }
  const left = own.filter((step) => !seen.has(step.id))
  if (left.length > 0) throw new CliError(`The plan leaves out ${plural(left.length, 'step')}: ${left.map((step) => step.id).join(', ')}. Every step must be listed.`)

  if (layer === 'instructions') return { steps, reversedStrokeIds: [] }

  eachLabelOnce()
  for (const step of steps) {
    const mine = own.find((candidate) => candidate.id === step.id)!
    const foreign = [...step.strokeIds.filter((id) => !mine.strokeIds.includes(id)), ...step.fillIds.filter((id) => !mine.fillIds.includes(id))]
    if (foreign.length > 0) throw new CliError(`The step "${step.id}" lists ${foreign.join(', ')}, which ${foreign.length === 1 ? 'belongs' : 'belong'} to another step; reordering never moves a line to another step (use --layer steps).`)
  }
  const reversed = raw.reversedStrokeIds === undefined ? [] : ids(raw, 'reversedStrokeIds', 'The plan')
  const unknownReversed = reversed.filter((id) => !strokeLabels.has(id))
  if (unknownReversed.length > 0) throw new CliError(`reversedStrokeIds names ${plural(unknownReversed.length, 'line label')} that ${unknownReversed.length === 1 ? 'is' : 'are'} not there: ${unknownReversed.join(', ')}.`)
  return { steps, reversedStrokeIds: reversed }
}

const APPLY_LAYERS: readonly EditLayer[] = ['steps', 'order', 'instructions']

const APPLY_OPTIONS: OptionSpecs = {
  layer: { type: 'string', description: 'What the plan changes: steps (regroup and reword), order (steps, lines within them, reversed lines) or instructions (words only).' },
  plan: { type: 'string', description: 'The plan JSON: `steps` over the labels `lessons summary` prints, plus `reversedStrokeIds` for --layer order.', placeholder: 'file' },
  'no-checkpoint': { type: 'boolean', description: 'Save like an autosave: do not keep this version in History.' },
}

const n = (value: number) => String(Math.round(value))
const box = (b: [number, number, number, number]) => `${n(b[0])} ${n(b[1])} ${n(b[2])} ${n(b[3])}`

/** The commands that take a plan for an existing lesson, and the summary a plan is written against. */
export const planCommands: Command[] = [
  command('lessons summary', 'The lesson as ids: each step with its lines (s1, s2, …) and colours (f1, f2, …), for writing a plan.', ['<id>'], {}, async (ctx, args) => {
    const { tutorial } = await readLesson(ctx, args.positionals[0])
    const summary = summariseLesson(tutorial)
    ctx.out.result({ id: tutorial.id, title: tutorial.title, ...summary }, () => {
      const lines = [`${tutorial.title} (${tutorial.id}): ${plural(summary.steps.length, 'step')} on a ${summary.canvas.width}×${summary.canvas.height} canvas.`]
      summary.steps.forEach((step, index) => {
        lines.push('', `${index + 1} · ${step.id} · ${step.title}`, `  ${step.instruction}`)
        const rows = [
          ...step.strokes.map((stroke) => [stroke.id, 'line', box(stroke.box), `${n(stroke.start[0])},${n(stroke.start[1])} → ${n(stroke.end[0])},${n(stroke.end[1])}`, n(stroke.length), '']),
          ...step.fills.map((fill) => [fill.id, 'colour', box(fill.box), '', n(fill.area), fill.color]),
        ]
        lines.push(...table(rows, ['id', 'kind', 'box', 'from → to', 'length/area', 'colour']).map((line) => `  ${line}`))
      })
      return lines
    })
  }),

  command('lessons apply', 'Reshape a lesson with a plan written by hand: regroup its steps, reorder them, or reword them.', ['<id>'], APPLY_OPTIONS, async (ctx, args) => {
    const id = args.positionals[0]
    const layer = stringValue(args.values, 'layer') as EditLayer | undefined
    if (!layer || !APPLY_LAYERS.includes(layer)) throw new CliError('Say what the plan changes: --layer steps, order or instructions.')
    const file = stringValue(args.values, 'plan')
    if (!file) throw new CliError('Give the plan: --plan <file>.')
    const { tutorial } = await readLesson(ctx, id)
    const plan = layerPlan(await readPlanFile(file), tutorial, layer)
    const applied =
      layer === 'instructions' ? applyInstructions(tutorial, plan.steps) : layer === 'order' ? applyOrder(tutorial, plan.steps, plan.reversedStrokeIds) : applySteps(tutorial, plan.steps)
    const next: Tutorial = { ...applied.tutorial, id: tutorial.id, title: tutorial.title }
    const outcome = await saveTutorial(ctx, id, next, { checkpoint: !args.values['no-checkpoint'] })
    const steps = outcome.after.steps.map((step) => ({ id: step.id, title: step.title, strokes: step.strokes.length, fills: step.fills?.length ?? 0 }))
    ctx.out.result({ id, layer, notes: applied.notes, changed: outcome.changed, steps }, () => [
      `Applied the ${layer} plan to ${id}${outcome.changed ? '' : ' (nothing changed)'}.`,
      ...applied.notes.map((note) => `  ${note}`),
      '',
      'Before:',
      ...stepTable(outcome.before),
      '',
      'After:',
      ...stepTable(outcome.after),
    ])
  }),
]
