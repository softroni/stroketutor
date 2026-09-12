import { readFile, writeFile } from 'node:fs/promises'

import { generateCandidate } from '../../server/generate'
import { assembleTracedLesson, generateFromTrace, type PlannedStep, type Trace } from '../../server/generateFromTrace'
import { LAYERS, regenerate, type Layer } from '../../server/regenerate'
import { REFERENCE_TYPES, checkId, sniffImage } from '../../server/repoWriter'
import { findLesson, findPathOfLesson, type Analysis, type Lesson } from '../../src/catalog/types'
import type { HistoryRecord } from '../../src/history/types'
import { stepDuration, type Tutorial } from '../../src/schema/types'
import { MAX_STROKES_PER_STEP } from '../../src/studio/quality'
import type { TracedDrawing } from '../../src/trace/traceSvg'

import { parseIndex, stringValue, type OptionSpecs, type Parsed } from '../args'
import { command, type Command } from '../command'
import type { Context } from '../context'
import { editCatalog, lessonRecord, placeInPath, readCatalog, readLesson, replaceTutorial, requirePath } from '../edit'
import { CliError, plural, table } from '../output'
import { TRACE_OPTIONS, traceOptionsFrom } from './svg'

/** Longest edge of the PNG an SVG is rendered to for the model, as `src/studio/referenceImage.ts` does. */
const MODEL_EDGE = 1536

const CONTENT_TYPE_OF_EXTENSION = Object.fromEntries(Object.entries(REFERENCE_TYPES).map(([type, extension]) => [extension, type]))

interface ReferenceFile {
  bytes: Uint8Array
  contentType: string
  svg: boolean
}

/** A reference image from disk, typed by its own bytes, never by its name. */
async function readReferenceFile(file: string): Promise<ReferenceFile> {
  const bytes = new Uint8Array(
    await readFile(file).catch(() => {
      throw new CliError(`Could not read ${file}.`)
    }),
  )
  const extension = sniffImage(bytes)
  if (!extension) throw new CliError(`${file} is not a JPEG, PNG, WebP or SVG.`)
  return { bytes, contentType: CONTENT_TYPE_OF_EXTENSION[extension], svg: extension === 'svg' }
}

/** What the model is sent: a raster as it is, an SVG rendered to PNG on white paper. */
async function imageForModel(ctx: Context, reference: ReferenceFile): Promise<{ contentType: string; base64: string }> {
  if (!reference.svg) return { contentType: reference.contentType, base64: Buffer.from(reference.bytes).toString('base64') }
  const browser = await ctx.browser()
  return { contentType: 'image/png', base64: await browser.renderPng(new TextDecoder().decode(reference.bytes), MODEL_EDGE) }
}

/** Traces an SVG as New lesson does; when tracing fails the picture alone is used, with a warning. */
async function traceReference(ctx: Context, reference: ReferenceFile, args: Parsed): Promise<TracedDrawing | undefined> {
  const traceFile = stringValue(args.values, 'trace')
  if (traceFile) {
    const text = await readFile(traceFile, 'utf8').catch(() => {
      throw new CliError(`Could not read the trace ${traceFile}.`)
    })
    return JSON.parse(text) as TracedDrawing
  }
  if (!reference.svg) return undefined
  try {
    const browser = await ctx.browser()
    return await browser.trace(new TextDecoder().decode(reference.bytes), traceOptionsFrom(args))
  } catch (error) {
    ctx.out.warn(`Tracing failed, so the picture alone is used: ${error instanceof Error ? error.message : String(error)}`)
    return undefined
  }
}

/** Without a model: the traced lines in a few steps of a drawable size, then one colour step. */
function planWithoutModel(trace: Trace): { outline: PlannedStep[]; colour: PlannedStep[] } {
  const outline: PlannedStep[] = []
  for (let start = 0; start < trace.strokes.length; start += MAX_STROKES_PER_STEP) {
    const ids = trace.strokes.slice(start, start + MAX_STROKES_PER_STEP).map((stroke) => stroke.id)
    const end = start + ids.length
    outline.push({
      id: `lines-${outline.length + 1}`,
      title: trace.strokes.length <= MAX_STROKES_PER_STEP ? 'Draw the lines' : `Lines ${start + 1} to ${end}`,
      instruction: 'Draw each line as the animation shows it, one at a time.',
      ids,
    })
  }
  const colour: PlannedStep[] =
    trace.fills.length > 0
      ? [{ id: 'colour', title: 'Colour it in', instruction: 'Colour each area as in the picture, the largest first.', ids: trace.fills.map((fill) => fill.id) }]
      : []
  return { outline, colour }
}

interface Candidate {
  tutorial: Tutorial
  analysis?: Analysis
  model?: string
  promptVersion?: string
  notes: string[]
  usage?: { promptTokens?: number; completionTokens?: number; cost?: number }
}

function analysisLines(analysis: Analysis | undefined): string[] {
  if (!analysis) return []
  return [
    `Main forms: ${analysis.mainForms.join('; ')}`,
    ...(analysis.importantDetails.length > 0 ? [`Details kept: ${analysis.importantDetails.join('; ')}`] : []),
    ...(analysis.detailsRemoved.length > 0 ? [`Details left out: ${analysis.detailsRemoved.join('; ')}`] : []),
    `Strategy: ${analysis.drawingStrategy}`,
  ]
}

const stepTable = (tutorial: Tutorial) =>
  table(
    tutorial.steps.map((step, index) => [String(index + 1), step.id, step.title, String(step.strokes.length), String(step.fills?.length ?? 0), `${stepDuration(step).toFixed(1)}s`]),
    ['#', 'id', 'title', 'strokes', 'fills', 'animation'],
  )

function candidateLines(candidate: Candidate): string[] {
  return [
    candidate.model
      ? `Generated by ${candidate.model} (${candidate.promptVersion})${candidate.usage?.cost !== undefined ? `, $${candidate.usage.cost.toFixed(4)}` : ''}.`
      : 'Built from the trace without a model.',
    ...analysisLines(candidate.analysis),
    ...candidate.notes.map((note) => `  ${note}`),
    `${candidate.tutorial.title}: schema v${candidate.tutorial.schemaVersion}, ${plural(candidate.tutorial.steps.length, 'step')}.`,
    ...stepTable(candidate.tutorial),
  ]
}

const GENERATE_OPTIONS: OptionSpecs = {
  id: { type: 'string', description: 'The new lesson’s id (lowercase, digits, dashes); also its file name once published.' },
  title: { type: 'string', description: 'The lesson’s title.' },
  objective: { type: 'string', description: 'The one-line objective shown in the path.' },
  goal: { type: 'string', description: 'The learning goal the lesson is planned around.' },
  constraints: { type: 'string', description: 'Anything the model must respect, in a sentence or two.' },
  source: { type: 'string', description: 'Where the reference image came from.' },
  license: { type: 'string', description: 'The terms the image may be used under.' },
  path: { type: 'string', description: 'The path to put the lesson in.', placeholder: 'id' },
  position: { type: 'string', description: 'Its place in that path, counting from 1 (the end by default).', placeholder: 'n' },
  trace: { type: 'string', description: 'A trace from `svg trace --out`, instead of tracing the SVG again.', placeholder: 'file' },
  'no-model': { type: 'boolean', description: 'SVG only: build the lesson from the trace without asking a model, a few lines per step.' },
  'no-keep': { type: 'boolean', description: 'Show (and --out) the candidate; keep nothing in the workspace.' },
  out: { type: 'string', description: 'Write the candidate, its analysis and notes as JSON here.', placeholder: 'file' },
  'dry-run': { type: 'boolean', description: 'Say what would be sent to the model, and stop.' },
  ...TRACE_OPTIONS,
}

/**
 * New lesson from the terminal, ending as "Keep as draft" does: the tutorial
 * (create-only), the reference image, a draft catalog entry with the
 * generation record, then the candidate in the lesson's History.
 */
async function generateLesson(ctx: Context, args: Parsed, accepts: 'svg' | 'raster' | 'any') {
  const file = args.positionals[0]
  const reference = await readReferenceFile(file)
  if (accepts === 'svg' && !reference.svg) throw new CliError(`${file} is not an SVG; use \`studio image to-steps\` for a photo.`)
  if (accepts === 'raster' && reference.svg) throw new CliError(`${file} is an SVG; use \`studio svg to-steps\` for it.`)

  const text = (name: string) => stringValue(args.values, name)?.trim() ?? ''
  const id = text('id')
  if (!id) throw new CliError('Give the lesson an id: --id <id>.')
  checkId(id)
  const title = text('title')
  const objective = text('objective')
  const source = text('source')
  const license = text('license')
  const withoutModel = Boolean(args.values['no-model'])
  const goal = text('goal')
  const missing = [
    ...(title ? [] : ['--title']),
    ...(objective ? [] : ['--objective']),
    ...(goal || withoutModel ? [] : ['--goal']),
    ...(source ? [] : ['--source']),
    ...(license ? [] : ['--license']),
  ]
  if (missing.length > 0) throw new CliError(`Still needed: ${missing.join(', ')}.`)
  if (withoutModel && !reference.svg) throw new CliError('--no-model needs an SVG: a photo has no lines to trace.')

  const { catalog } = await readCatalog(ctx)
  const library = await ctx.library()
  if (library.tutorials.has(id) || findLesson(catalog, id)) throw new CliError(`A lesson called "${id}" already exists. Generation never replaces a lesson; choose another id.`)
  const pathId = text('path') || null
  const pathOf = pathId ? requirePath(catalog, pathId) : null
  const position = args.values.position === undefined ? (pathOf?.lessonIds.length ?? 0) : parseIndex(stringValue(args.values, 'position'), 'The position') - 1

  const trace = await traceReference(ctx, reference, args)
  if (withoutModel && !trace) throw new CliError('The SVG could not be traced, so there is nothing to build a lesson from without a model.')

  if (args.values['dry-run']) {
    const deps = await ctx.generation()
    ctx.out.result(
      { id, title, path: pathId, position: position + 1, reference: { type: reference.contentType, bytes: reference.bytes.byteLength }, trace: trace ? { strokes: trace.strokes.length, fills: trace.fills.length } : null, model: withoutModel ? null : (ctx.flags.model || deps.defaultModel || null), keyConfigured: Boolean(deps.apiKey) },
      () => [
        `Would make "${title}" (${id})${pathOf ? ` at ${position + 1} in "${pathOf.id}"` : ' in no path'} from ${file} (${reference.contentType}, ${reference.bytes.byteLength} bytes).`,
        ...(trace ? [`The trace has ${plural(trace.strokes.length, 'line')} and ${plural(trace.fills.length, 'colour')}.`] : []),
        withoutModel ? 'No model would be asked.' : `Model: ${ctx.flags.model || deps.defaultModel || 'none: pass --model'}; key ${deps.apiKey ? 'configured' : 'missing'}.`,
        'Nothing was generated or written (--dry-run).',
      ],
    )
    return
  }

  let candidate: Candidate
  if (withoutModel) {
    const plan = planWithoutModel(trace!)
    const built = assembleTracedLesson(trace!, plan.outline, plan.colour, { id, title })
    const verdict = ctx.validateTutorial(built.tutorial)
    if (!verdict.ok) throw new CliError('The traced lesson is not valid.', verdict.issues)
    candidate = { tutorial: built.tutorial as unknown as Tutorial, notes: built.notes }
  } else {
    const deps = await ctx.generation()
    const body = {
      model: ctx.flags.model,
      lessonId: id,
      title,
      goal,
      constraints: text('constraints'),
      pathId,
      position,
      image: await imageForModel(ctx, reference),
      ...(trace ? { trace } : {}),
    }
    ctx.out.note(`Asking ${ctx.flags.model || deps.defaultModel || 'the model'}${trace ? ' to order the traced lines' : ' for a lesson'}…`)
    const result = trace ? await generateFromTrace(body, deps) : await generateCandidate(body, deps)
    if (result.issues.length > 0) {
      const out = stringValue(args.values, 'out')
      if (out) await writeFile(out, `${JSON.stringify(result, null, 2)}\n`)
      throw new CliError(`The model's answer is not a valid lesson, so nothing was kept${out ? ` (written to ${out} to inspect)` : ''}.`, result.issues)
    }
    candidate = { tutorial: result.tutorial as Tutorial, analysis: result.analysis, model: result.model, promptVersion: result.promptVersion, notes: 'notes' in result ? result.notes : [], usage: result.usage }
  }
  candidate.tutorial = { ...candidate.tutorial, id, title }

  const out = stringValue(args.values, 'out')
  if (out) await writeFile(out, `${JSON.stringify({ ...candidate, kept: !args.values['no-keep'] }, null, 2)}\n`)

  let kept: { file: string } | null = null
  if (!args.values['no-keep']) {
    const store = await ctx.workspace()
    await store.writeTutorial(id, candidate.tutorial, { etag: null })
    const stored = await store.writeReference(id, reference.contentType, reference.bytes)
    kept = stored
    const lesson: Lesson = lessonRecord({
      id,
      status: 'draft',
      objective,
      reference: { file: stored.file, source, license },
      ...(candidate.model && candidate.promptVersion && candidate.analysis
        ? { generation: { model: candidate.model, promptVersion: candidate.promptVersion, createdAt: new Date().toISOString(), goal, ...(text('constraints') ? { constraints: text('constraints') } : {}), analysis: candidate.analysis } }
        : {}),
    })
    await editCatalog(ctx, (current) => {
      const withEntry = { ...current, lessons: [...current.lessons, lesson] }
      return pathId ? placeInPath(withEntry, id, pathId, position + 1) : withEntry
    })
    const record: HistoryRecord = {
      kind: 'generated',
      tutorial: candidate.tutorial,
      ...(candidate.model ? { model: candidate.model } : {}),
      ...(candidate.promptVersion ? { promptVersion: candidate.promptVersion } : {}),
      ...(goal ? { goal } : {}),
      ...(text('constraints') ? { constraints: text('constraints') } : {}),
      ...(candidate.analysis ? { analysis: candidate.analysis } : {}),
      ...(candidate.notes.length > 0 ? { notes: candidate.notes } : {}),
      ...(candidate.usage?.cost !== undefined ? { cost: candidate.usage.cost } : {}),
      kept: true,
    }
    await store.appendHistory(id, record).catch((error: unknown) => ctx.out.warn(`The lesson was kept, but not recorded in its history: ${String(error)}`))
  }

  ctx.out.result({ id, kept: kept !== null, reference: kept?.file ?? null, path: pathId, position: position + 1, out: out ?? null, ...candidate }, () => [
    ...candidateLines(candidate),
    ...(out ? [`Wrote ${out}.`] : []),
    kept ? `Kept as the draft ${id}${pathOf ? ` at ${position + 1} in "${pathOf.id}"` : ''}, with ${kept.file} as its reference.` : 'Not kept (--no-keep).',
  ])
}

const REGENERATE_OPTIONS: OptionSpecs = {
  layer: { type: 'string', description: 'What to regenerate: instructions, steps, order or drawing.' },
  note: { type: 'string', description: 'What should be different this time.' },
  goal: { type: 'string', description: 'The learning goal (default: the one it was generated with, else the objective).' },
  constraints: { type: 'string', description: 'What the model must respect (default: the ones it was generated with).' },
  use: { type: 'boolean', description: 'Make the regenerated version the lesson (kept in History like ⌘S). Otherwise it is only recorded.' },
  out: { type: 'string', description: 'Write the regenerated version, its rationale and notes as JSON here.', placeholder: 'file' },
  'dry-run': { type: 'boolean', description: 'Say what would be sent to the model, and stop.' },
  ...TRACE_OPTIONS,
}

/** The Regenerate drawer: one layer of an existing lesson, recorded in History whether or not it is used. */
async function regenerateLesson(ctx: Context, args: Parsed) {
  const id = args.positionals[0]
  const layer = stringValue(args.values, 'layer') as Layer | undefined
  if (!layer || !LAYERS.includes(layer)) throw new CliError('Say what to regenerate: --layer instructions, steps, order or drawing.')
  const { tutorial } = await readLesson(ctx, id)
  const { catalog } = await readCatalog(ctx)
  const lesson = findLesson(catalog, id)
  const pathOf = findPathOfLesson(catalog, id)
  const position = pathOf ? pathOf.lessonIds.indexOf(id) : 0
  const text = (name: string) => stringValue(args.values, name)?.trim()
  const goal = text('goal') ?? lesson?.generation?.goal ?? lesson?.objective ?? ''
  const constraints = text('constraints') ?? lesson?.generation?.constraints ?? ''
  const note = text('note') ?? ''

  const store = await ctx.workspace()
  const stored = lesson?.reference ? await store.readReference(lesson.reference.file) : null
  const reference: ReferenceFile | null = stored ? { bytes: stored.bytes, contentType: stored.contentType, svg: stored.contentType === 'image/svg+xml' } : null
  if (layer === 'drawing' && !reference) throw new CliError(`A new drawing starts from the reference, and ${id} has none (studio lessons reference set).`)
  if (layer === 'drawing' && !goal) throw new CliError('Describe the learning goal: --goal "…".')

  const deps = await ctx.generation()
  const model = ctx.flags.model || deps.defaultModel || null
  if (args.values['dry-run']) {
    ctx.out.result({ id, layer, model, keyConfigured: Boolean(deps.apiKey), goal, constraints, note, reference: reference ? { type: reference.contentType, bytes: reference.bytes.byteLength } : null }, () => [
      `Would regenerate the ${layer} of "${tutorial.title}" (${id}) with ${model ?? 'no model: pass --model'}; key ${deps.apiKey ? 'configured' : 'missing'}.`,
      `Goal: ${goal || '(none)'}${constraints ? `; constraints: ${constraints}` : ''}${note ? `; note: ${note}` : ''}`,
      reference ? `Reference: ${lesson?.reference?.file} (${reference.contentType}).` : 'No reference image.',
      'Nothing was generated or written (--dry-run).',
    ])
    return
  }

  const common = { model: ctx.flags.model, lessonId: id, pathId: pathOf?.id ?? null, position, goal, constraints, note }
  let body: Record<string, unknown>
  if (layer === 'drawing') {
    const trace = await traceReference(ctx, reference!, args)
    body = { ...common, layer, title: tutorial.title, image: await imageForModel(ctx, reference!), ...(trace ? { trace } : {}) }
  } else {
    const browser = await ctx.browser()
    body = {
      ...common,
      layer,
      tutorial,
      drawing: { contentType: 'image/png', base64: await browser.drawingPng(tutorial) },
      ...(reference ? { reference: await imageForModel(ctx, reference) } : {}),
    }
  }
  ctx.out.note(`Asking ${model ?? 'the model'} to regenerate the ${layer}…`)
  const result = await regenerate(body, deps)
  const out = stringValue(args.values, 'out')
  if (result.issues.length > 0) {
    if (out) await writeFile(out, `${JSON.stringify(result, null, 2)}\n`)
    throw new CliError(`The regenerated ${layer} is not a valid lesson, so it was not recorded${out ? ` (written to ${out} to inspect)` : ''}.`, result.issues)
  }
  const regenerated = { ...(result.tutorial as Tutorial), id }
  const record: HistoryRecord = {
    kind: 'regenerated',
    tutorial: regenerated,
    layer,
    model: result.model,
    promptVersion: result.promptVersion,
    ...(note ? { note } : {}),
    ...(layer === 'drawing' ? { goal, ...(constraints ? { constraints } : {}) } : {}),
    ...(result.rationale ? { rationale: result.rationale } : {}),
    ...(result.notes.length > 0 ? { notes: result.notes } : {}),
    ...(result.analysis ? { analysis: result.analysis } : {}),
    ...(result.usage?.cost !== undefined ? { cost: result.usage.cost } : {}),
  }
  const { entry } = await store.appendHistory(id, record)
  if (out) await writeFile(out, `${JSON.stringify({ ...result, tutorial: regenerated }, null, 2)}\n`)
  if (args.values.use) await replaceTutorial(ctx, id, regenerated, { checkpoint: true })

  ctx.out.result({ id, layer, used: Boolean(args.values.use), entry: entry.id, model: result.model, promptVersion: result.promptVersion, rationale: result.rationale ?? null, notes: result.notes, analysis: result.analysis ?? null, usage: result.usage ?? null, tutorial: regenerated }, () => [
    `Regenerated the ${layer} with ${result.model} (${result.promptVersion})${result.usage?.cost !== undefined ? `, $${result.usage.cost.toFixed(4)}` : ''}.`,
    ...(result.rationale ? [`Rationale: ${result.rationale}`] : []),
    ...analysisLines(result.analysis),
    ...result.notes.map((line) => `  ${line}`),
    '',
    'Before:',
    ...stepTable(tutorial),
    '',
    'After:',
    ...stepTable(regenerated),
    '',
    ...(out ? [`Wrote ${out}.`] : []),
    args.values.use ? `${id} is now the regenerated version; \`studio history use ${id} 2\` brings the previous one back.` : `Recorded in History as ${entry.id}; \`studio history use ${id} ${entry.id}\` makes it the lesson.`,
  ])
}

const REFERENCE_SPEC = ['<file>']

export const generateCommands: Command[] = [
  command('lessons generate', 'A new lesson from a reference image (a photo, or an SVG traced into exact lines), kept as a draft.', REFERENCE_SPEC, GENERATE_OPTIONS, (ctx, args) => generateLesson(ctx, args, 'any')),
  command('svg to-steps', 'A new lesson from an SVG: the file is traced into exact lines and colours, and a model orders them into steps (or --no-model).', REFERENCE_SPEC, GENERATE_OPTIONS, (ctx, args) => generateLesson(ctx, args, 'svg')),
  command('image to-steps', 'A new lesson from a photo (JPEG, PNG or WebP): a model draws the steps from the picture.', REFERENCE_SPEC, GENERATE_OPTIONS, (ctx, args) => generateLesson(ctx, args, 'raster')),
  command('lessons regenerate', 'Redo one layer of a lesson: its instructions, steps, order, or the whole drawing.', ['<id>'], REGENERATE_OPTIONS, regenerateLesson),
]
