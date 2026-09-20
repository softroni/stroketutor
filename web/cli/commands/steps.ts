import { reversePath } from '../../server/regenerate'
import { stepDuration, type Tutorial } from '../../src/schema/types'
import {
  deleteStrokes,
  groupIntoNewStep,
  joinStrokes,
  mergeWithNext,
  moveStrokes,
  reorderSteps,
  reorderStrokes,
  splitStep,
  splitStroke,
  toEditable,
  updateStep,
  updateStrokes,
  type EditableTutorial,
} from '../../src/studio/editor/ops'
import { strokeLength } from '../../src/studio/quality'

import { parseIndex, parseNumber, stringValue, type OptionSpecs } from '../args'
import { command, type Command } from '../command'
import type { Context } from '../context'
import { editTutorial, readLesson } from '../edit'
import { CliError, plural, table } from '../output'
import { resolveStep, resolveStrokes, selectorOf } from '../selectors'

const CHECKPOINT: OptionSpecs = {
  'no-checkpoint': { type: 'boolean', description: 'Save like an autosave: do not keep this version in History.' },
}

const stepRows = (tutorial: Tutorial) =>
  tutorial.steps.map((step, index) => [
    String(index + 1),
    step.id,
    step.title,
    plural(step.strokes.length, 'stroke'),
    ...(step.fills?.length ? [plural(step.fills.length, 'fill')] : ['']),
    `${stepDuration(step).toFixed(1)}s`,
    step.instruction,
  ])

const stepSummary = (tutorial: Tutorial) => tutorial.steps.map((step) => ({ id: step.id, title: step.title, strokes: step.strokes.length, fills: step.fills?.length ?? 0 }))

/** Runs one editor operation and reports the steps as they now stand. */
async function edit(ctx: Context, id: string, values: Record<string, unknown>, change: (doc: EditableTutorial) => EditableTutorial, done: string) {
  const outcome = await editTutorial(ctx, id, change, { checkpoint: !values['no-checkpoint'] })
  ctx.out.result({ id, changed: outcome.changed, steps: stepSummary(outcome.after) }, () => [
    done,
    ...table(stepRows(outcome.after), ['#', 'id', 'title', 'strokes', 'fills', 'animation', 'instruction']),
  ])
}

/**
 * The Lesson Workspace's editor of the teaching structure (master plan §18):
 * every operation rearranges, regroups, renames or retimes existing strokes;
 * none draws.
 */
export const stepCommands: Command[] = [
  command('steps list', 'The steps of a lesson, numbered as the other commands name them.', ['<id>'], {}, async (ctx, args) => {
    const { tutorial } = await readLesson(ctx, args.positionals[0])
    ctx.out.result({ id: tutorial.id, steps: stepSummary(tutorial) }, () => table(stepRows(tutorial), ['#', 'id', 'title', 'strokes', 'fills', 'animation', 'instruction']))
  }),

  command(
    'steps set',
    'A step’s title and instruction.',
    ['<id>', '<step>'],
    { title: { type: 'string', description: 'The new title.' }, instruction: { type: 'string', description: 'The new instruction.' }, ...CHECKPOINT },
    async (ctx, args) => {
      const [id, step] = args.positionals
      const title = stringValue(args.values, 'title')
      const instruction = stringValue(args.values, 'instruction')
      if (title === undefined && instruction === undefined) throw new CliError('Say what to change: --title and/or --instruction.')
      await edit(ctx, id, args.values, (doc) => updateStep(doc, resolveStep(doc, step), { ...(title !== undefined ? { title } : {}), ...(instruction !== undefined ? { instruction } : {}) }), `Updated step ${step}.`)
    },
  ),

  command(
    'steps split',
    'Split a step before one of its strokes; the second half becomes a new step after it.',
    ['<id>', '<step>'],
    { at: { type: 'string', description: 'The stroke the new step starts with, counting from 1 within the step.', placeholder: 'n' }, ...CHECKPOINT },
    async (ctx, args) => {
      const [id, step] = args.positionals
      const at = parseIndex(stringValue(args.values, 'at'), '--at')
      await edit(ctx, id, args.values, (doc) => splitStep(doc, resolveStep(doc, step), at - 1), `Split step ${step} before its stroke ${at}.`)
    },
  ),

  command('steps merge', 'Fold the next step into this one, keeping this step’s words.', ['<id>', '<step>'], CHECKPOINT, async (ctx, args) => {
    const [id, step] = args.positionals
    await edit(ctx, id, args.values, (doc) => mergeWithNext(doc, resolveStep(doc, step)), `Merged step ${step} with the one after it.`)
  }),

  command(
    'steps move',
    'Change where a step comes in the lesson.',
    ['<id>', '<step>'],
    { to: { type: 'string', description: 'Its new number.', placeholder: 'n' }, ...CHECKPOINT },
    async (ctx, args) => {
      const [id, step] = args.positionals
      const to = parseIndex(stringValue(args.values, 'to'), '--to')
      await edit(
        ctx,
        id,
        args.values,
        (doc) => {
          if (to > doc.steps.length) throw new CliError(`The lesson has ${doc.steps.length} steps; --to must be between 1 and ${doc.steps.length}.`)
          return reorderSteps(doc, resolveStep(doc, step), to - 1)
        },
        `Moved step ${step} to ${to}.`,
      )
    },
  ),

  command(
    'steps group',
    'Turn the selected strokes into one new step, where the first of them was.',
    ['<id>', '<strokes...>'],
    { title: { type: 'string', description: 'The new step’s title.' }, instruction: { type: 'string', description: 'The new step’s instruction.' }, ...CHECKPOINT },
    async (ctx, args) => {
      const [id, ...selectors] = args.positionals
      const title = stringValue(args.values, 'title')
      const instruction = stringValue(args.values, 'instruction')
      await edit(ctx, id, args.values, (doc) => groupIntoNewStep(doc, resolveStrokes(doc, selectors), { title, instruction }), `Grouped ${selectors.join(' ')} into a new step.`)
    },
  ),

  command('strokes list', 'The strokes of a lesson, or of one step, with their selectors.', ['<id>', '[step]'], {}, async (ctx, args) => {
    const { tutorial } = await readLesson(ctx, args.positionals[0])
    const doc = toEditable(tutorial)
    const only = args.positionals[1] === undefined ? null : resolveStep(doc, args.positionals[1])
    const rows = doc.steps.flatMap((step, stepIndex) =>
      only !== null && stepIndex !== only
        ? []
        : step.strokes.map((stroke, strokeIndex) => ({
            selector: selectorOf(stepIndex, strokeIndex),
            step: step.id,
            duration: stroke.duration,
            lineWidth: stroke.lineWidth,
            color: stroke.color ?? null,
            length: Math.round(strokeLength(stroke.d)),
            d: stroke.d,
          })),
    )
    ctx.out.result({ id: tutorial.id, strokes: rows }, () =>
      table(
        rows.map((row) => [row.selector, row.step, `${row.duration}s`, String(row.lineWidth), row.color ?? '', String(row.length), row.d.length > 60 ? `${row.d.slice(0, 57)}…` : row.d]),
        ['sel', 'step', 'duration', 'width', 'colour', 'length', 'd'],
      ),
    )
  }),

  command(
    'strokes move',
    'Move the selected strokes to the end of another step. A step left empty goes.',
    ['<id>', '<strokes...>'],
    { 'to-step': { type: 'string', description: 'The step to move them into.', placeholder: 'step' }, ...CHECKPOINT },
    async (ctx, args) => {
      const [id, ...selectors] = args.positionals
      const target = stringValue(args.values, 'to-step')
      if (!target) throw new CliError('Say which step: --to-step <step>.')
      await edit(ctx, id, args.values, (doc) => moveStrokes(doc, resolveStrokes(doc, selectors), doc.steps[resolveStep(doc, target)].id), `Moved ${selectors.join(' ')} into step ${target}.`)
    },
  ),

  command(
    'strokes reorder',
    'Change where a stroke comes within its step.',
    ['<id>', '<step>', '<n>'],
    { to: { type: 'string', description: 'Its new place in the step, counting from 1.', placeholder: 'n' }, ...CHECKPOINT },
    async (ctx, args) => {
      const [id, step, n] = args.positionals
      const from = parseIndex(n, 'The stroke number')
      const to = parseIndex(stringValue(args.values, 'to'), '--to')
      await edit(
        ctx,
        id,
        args.values,
        (doc) => {
          const stepIndex = resolveStep(doc, step)
          const count = doc.steps[stepIndex].strokes.length
          if (from > count || to > count) throw new CliError(`Step ${step} has ${plural(count, 'stroke')}.`)
          return reorderStrokes(doc, stepIndex, from - 1, to - 1)
        },
        `Moved stroke ${n} of step ${step} to ${to}.`,
      )
    },
  ),

  command('strokes reverse', 'Draw the selected strokes from their other end: the same shape, animated the other way round.', ['<id>', '<strokes...>'], CHECKPOINT, async (ctx, args) => {
    const [id, ...selectors] = args.positionals
    await edit(
      ctx,
      id,
      args.values,
      (doc) => {
        const chosen = new Set(resolveStrokes(doc, selectors))
        return { ...doc, steps: doc.steps.map((step) => ({ ...step, strokes: step.strokes.map((stroke) => (chosen.has(stroke.uid) ? { ...stroke, d: reversePath(stroke.d) } : stroke)) })) }
      },
      `Reversed ${selectors.join(' ')}.`,
    )
  }),

  command(
    'strokes split',
    'Cut one stroke into several, where a pen would lift: the same shape, drawn in parts. One cut opens a closed line at that point; two make two lines.',
    ['<id>', '<stroke>'],
    { at: { type: 'string', description: 'Where to cut, on the lesson canvas: "x,y", or several as "x,y x,y". Each cut is made at the nearest point of the line.', placeholder: 'points' }, ...CHECKPOINT },
    async (ctx, args) => {
      const [id, selector] = args.positionals
      const cuts = (stringValue(args.values, 'at') ?? '').split(/\s+/).filter(Boolean).map((text) => {
        const [x, y, extra] = text.split(',').map((value) => parseNumber(value, '--at'))
        if (y === undefined || extra !== undefined) throw new CliError(`--at takes points as x,y; "${text}" is not one.`)
        return { x, y }
      })
      if (cuts.length === 0) throw new CliError('Say where to cut: --at "x,y" (see `lessons summary` for where each line starts and ends).')
      await edit(
        ctx,
        id,
        args.values,
        (doc) => {
          const [uid, ...others] = resolveStrokes(doc, [selector])
          if (others.length > 0) throw new CliError('Split one stroke at a time.')
          return splitStroke(doc, uid, cuts, strokeLength)
        },
        `Split ${selector} at ${plural(cuts.length, 'point')}.`,
      )
    },
  ),

  command(
    'strokes join',
    'Make two open strokes one, drawn without lifting: the second carries on from the end of the first. Reverse one first if it runs the wrong way.',
    ['<id>', '<first>', '<second>'],
    CHECKPOINT,
    async (ctx, args) => {
      const [id, first, second] = args.positionals
      await edit(
        ctx,
        id,
        args.values,
        (doc) => {
          const uids = resolveStrokes(doc, [first, second])
          if (uids.length !== 2) throw new CliError('Name two strokes: the one drawn first, then the one that carries on from it.')
          return joinStrokes(doc, resolveStrokes(doc, [first])[0], resolveStrokes(doc, [second])[0])
        },
        `Joined ${second} onto ${first}.`,
      )
    },
  ),

  command('strokes delete', 'Remove the selected strokes for good, and any step they leave empty.', ['<id>', '<strokes...>'], CHECKPOINT, async (ctx, args) => {
    const [id, ...selectors] = args.positionals
    await edit(ctx, id, args.values, (doc) => deleteStrokes(doc, resolveStrokes(doc, selectors)), `Deleted ${selectors.join(' ')}.`)
  }),

  command(
    'strokes set',
    'Retime the selected strokes, or change their line width.',
    ['<id>', '<strokes...>'],
    {
      duration: { type: 'string', description: 'Seconds of animation for each selected stroke.', placeholder: 's' },
      'line-width': { type: 'string', description: 'Line width in canvas units.', placeholder: 'w' },
      ...CHECKPOINT,
    },
    async (ctx, args) => {
      const [id, ...selectors] = args.positionals
      const duration = args.values.duration === undefined ? undefined : parseNumber(stringValue(args.values, 'duration'), '--duration')
      const lineWidth = args.values['line-width'] === undefined ? undefined : parseNumber(stringValue(args.values, 'line-width'), '--line-width')
      if (duration === undefined && lineWidth === undefined) throw new CliError('Say what to change: --duration and/or --line-width.')
      await edit(
        ctx,
        id,
        args.values,
        (doc) => updateStrokes(doc, resolveStrokes(doc, selectors), { ...(duration !== undefined ? { duration } : {}), ...(lineWidth !== undefined ? { lineWidth } : {}) }),
        `Updated ${selectors.join(' ')}.`,
      )
    },
  ),
]
