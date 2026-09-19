import { writeFile } from 'node:fs/promises'

import { MAX_SPOKEN_LINE } from '../../server/prompts/spokenLinesPrompt'
import {
  appLines,
  applySpokenLines,
  castVoice,
  createVoice,
  deletePublishedAppLines,
  deletePublishedVoice,
  exportReference,
  freezeVoice,
  lessonNarration,
  narrateAppLine,
  narrateStep,
  publishAppLines,
  publishVoice,
  readTakeAudio,
  restoreReference,
  say,
  setAppLine,
  setNarrationLine,
  setScript,
  unfreezeVoice,
  voiceState,
  writeSpokenLines,
  type VoiceDeps,
} from '../../server/voice'
import { APP_LINE_IDS, type AppLineNarration, type AppNarration, type LessonNarration, type StepNarration, type Voice } from '../../src/voice/types'

import { UsageError, stringValue } from '../args'
import { command, type Command } from '../command'
import type { Context } from '../context'
import { CliError, gitAddLine, plural, table } from '../output'
import { readPlanFile } from './plan'

/**
 * Casting Lina and narrating lessons from the terminal, on the same workspace
 * and through the same `server/voice.ts` the Voice page calls. Nothing here
 * decides anything: it reads arguments, calls, and prints.
 */

/** `7040` → `0:07`, the way the page shows a take's length. */
function clock(ms: number): string {
  const seconds = Math.round(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function describeVoice(voice: Voice): string {
  if (voice.frozen) return `frozen (${voice.frozen.referenceName})`
  if (voice.engine === 'qwen-custom') return `custom · ${voice.speaker ?? '?'}`
  return voice.engine === 'qwen-design' ? 'designed' : 'chatterbox'
}

/** The one-word state of any recording, a lesson's step or one of the app's own lines. */
function stepState(step: Pick<StepNarration, 'stale'>): string {
  if (step.stale === 'missing') return 'not yet'
  if (step.stale === 'text-changed') return 'words changed'
  if (step.stale === 'voice-changed') return 'voice changed'
  return 'ready'
}

function narrationLines(narration: LessonNarration, voices: Voice[]): string[] {
  const cast = voices.find((voice) => voice.id === narration.castVoiceId)
  const lines = [
    `${narration.title} (${narration.lessonId}): ${plural(narration.steps.length, 'step')}, narrated as ${cast ? `${cast.name}${cast.frozen ? ', frozen' : ''}` : 'nobody yet (studio voice cast <id>)'}.`,
    '',
    ...table(
      narration.steps.map((step, index) => [
        String(index + 1),
        step.stepId,
        stepState(step),
        step.take ? clock(step.take.durationMs) : '',
        step.spokenLine ? 'written line' : 'instruction',
      ]),
      ['#', 'step', 'state', 'length', 'says'],
    ),
  ]
  if (narration.published) {
    lines.push(
      '',
      `Published ${narration.published.generatedAt.slice(0, 10)}: ${plural(narration.published.stepCount, 'file')} as ${narration.published.voiceName}${narration.published.behind ? ' — behind the workspace' : ''}.`,
    )
  }
  return lines
}

/** The steps a plain `voice narrate` would make: everything not ready. */
const unready = (narration: LessonNarration) => narration.steps.filter((step) => step.stale !== null)

/** The app's own lines as a table, and where each is heard. */
function appLineRows(narration: AppNarration): string[] {
  return table(
    narration.lines.map((line) => [
      line.id,
      stepState(line),
      line.take ? clock(line.take.durationMs) : '',
      line.where,
      line.text,
    ]),
    ['id', 'state', 'length', 'where', 'what Lina says'],
  )
}

/** What `voice app list` and every `voice app` command print afterwards. */
function appLinesLines(narration: AppNarration, voices: Voice[]): string[] {
  const cast = voices.find((voice) => voice.id === narration.castVoiceId)
  const left = narration.lines.filter((line) => line.stale !== null).length
  const lines = [
    `Lina’s own lines: ${plural(narration.lines.length, 'line')}, ${left === 0 ? 'all recorded' : `${left} still to make`}, in ${cast ? `${cast.name}${cast.frozen ? ', frozen' : ''}` : 'nobody yet (studio voice cast <id>)'}.`,
    '',
    ...appLineRows(narration),
  ]
  if (narration.published) {
    lines.push(
      '',
      `Published ${narration.published.generatedAt.slice(0, 10)}: ${plural(narration.published.lineCount, 'file')} as ${narration.published.voiceName}${narration.published.behind ? ' — behind the workspace' : ''}.`,
    )
  }
  return lines
}

/** What a step would say, shortened to fit a column. */
function saying(step: StepNarration, width = 68): string {
  const spoken = step.text.replace(/\s+/g, ' ').trim()
  return spoken.length > width ? `${spoken.slice(0, width - 1)}…` : spoken
}

/**
 * Every lesson in the working library in the order the curriculum teaches
 * them, then the ones no path has picked up, by id. Batch commands walk the
 * catalog rather than the file system so the creator sees them in the order
 * they think about them.
 */
async function libraryLessons(ctx: Context): Promise<{ id: string; title: string; published: boolean }[]> {
  const library = await ctx.library()
  const published = new Set(library.publishing.publishedIds)
  const ordered: string[] = []
  const seen = new Set<string>()
  for (const path of library.catalog?.paths ?? []) {
    for (const id of path.lessonIds) {
      if (library.tutorials.has(id) && !seen.has(id)) {
        seen.add(id)
        ordered.push(id)
      }
    }
  }
  for (const id of [...library.tutorials.keys()].sort()) if (!seen.has(id)) ordered.push(id)
  return ordered.map((id) => ({
    id,
    title: library.tutorials.get(id)!.tutorial.title,
    published: published.has(id),
  }))
}

/** One lesson's turn at `voice narrate`, printing a line per step as it goes. */
async function narrateOne(
  ctx: Context,
  deps: VoiceDeps,
  lessonId: string,
  options: { remake: boolean; prefix?: string },
): Promise<{ narration: LessonNarration; recorded: { stepId: string; durationMs: number; seconds: number }[] }> {
  let narration = await lessonNarration(lessonId, deps)
  const todo = (options.remake ? narration.steps : unready(narration)).map((step) => step.stepId)
  const recorded: { stepId: string; durationMs: number; seconds: number }[] = []
  for (const [index, stepId] of todo.entries()) {
    const started = Date.now()
    narration = await narrateStep(lessonId, { stepId, another: options.remake }, deps)
    const step = narration.steps.find((candidate) => candidate.stepId === stepId)
    const seconds = (Date.now() - started) / 1000
    recorded.push({ stepId, durationMs: step?.take?.durationMs ?? 0, seconds })
    ctx.out.note(
      `  ${options.prefix ?? ''}${index + 1} of ${todo.length}  ${stepId}  ${clock(step?.take?.durationMs ?? 0)}  in ${seconds.toFixed(1)}s`,
    )
  }
  return { narration, recorded }
}

/** `not yet` / `words changed` for the steps holding a lesson back, in one phrase. */
function whyNotReady(narration: LessonNarration): string {
  const counts = new Map<string, number>()
  for (const step of unready(narration)) counts.set(stepState(step), (counts.get(stepState(step)) ?? 0) + 1)
  return [...counts].map(([state, count]) => `${count} ${state}`).join(', ')
}

/** The lesson a command was given, or a refusal saying `--all` is the other way. */
function oneLesson(args: { positionals: string[]; values: Record<string, unknown> }, what: string): string | null {
  const lessonId = args.positionals[0]
  if (args.values.all === true) {
    if (lessonId) throw new UsageError(`Name a lesson or pass --all, not both.`)
    return null
  }
  if (!lessonId) throw new UsageError(`Missing <lesson>. Pass --all to ${what} every lesson.`)
  return lessonId
}

export const voiceCommands: Command[] = [
  command('voice status', 'The speech server, the voice cast as Lina, and what has been recorded.', [], {}, async (ctx) => {
    const deps = await ctx.voice()
    const state = await voiceState(deps)
    const cast = state.voices.find((voice) => voice.id === state.castVoiceId) ?? null
    ctx.out.result(
      { server: state.server, castVoiceId: state.castVoiceId, voices: state.voices.length, takes: state.takes.length },
      () => [
        `Voice server: ${state.server.url}`,
        state.server.reachable
          ? `  up${state.server.warm.length > 0 ? `, warm: ${state.server.warm.join(', ')}` : ''}${state.server.generating ? ', making speech now' : ''}`
          : `  unreachable — ${state.server.error ?? 'no reason given'}`,
        ...(state.server.references.length > 0 ? [`  references: ${state.server.references.join(', ')}`] : []),
        '',
        `Cast as Lina: ${cast ? `${cast.name} (${cast.id})` : 'nobody yet'}`,
        `${plural(state.voices.length, 'voice')}, ${plural(state.takes.length, 'take')} recorded.`,
      ],
    )
  }),

  command(
    'voice list',
    'The candidates for Lina’s voice, and which one is cast.',
    [],
    { takes: { type: 'boolean', description: 'Also list each voice’s recordings, with the ids `voice freeze --take` wants.' } },
    async (ctx, args) => {
      const deps = await ctx.voice()
      const state = await voiceState(deps)
      const withTakes = args.values.takes === true
      ctx.out.result({ castVoiceId: state.castVoiceId, voices: state.voices, ...(withTakes ? { takes: state.takes } : {}) }, () => {
        const lines = table(
          state.voices.map((voice) => [
            voice.id === state.castVoiceId ? '*' : '',
            voice.id,
            voice.name,
            describeVoice(voice),
            String(state.takes.filter((take) => take.voiceId === voice.id).length),
            voice.tagline,
          ]),
          ['', 'id', 'name', 'engine', 'takes', 'tagline'],
        )
        if (!withTakes) return lines
        for (const voice of state.voices) {
          const takes = state.takes.filter((take) => take.voiceId === voice.id)
          if (takes.length === 0) continue
          lines.push('', `${voice.name}:`)
          lines.push(
            ...table(takes.map((take) => [`  ${take.id}`, clock(take.durationMs), `“${take.text.slice(0, 60)}${take.text.length > 60 ? '…' : ''}”`])),
          )
        }
        return lines
      })
    },
  ),

  command('voice cast', 'Cast a voice as Lina. Every lesson is narrated with it from then on.', ['<id>'], {}, async (ctx, args) => {
    const deps = await ctx.voice()
    const result = castVoice(args.positionals[0], deps)
    const voice = deps.workspace.readVoice(args.positionals[0])
    ctx.out.result(result, () => `Cast ${voice?.name ?? result.castVoiceId} as Lina.`)
  }),

  command(
    'voice add',
    'Add a candidate voice.',
    [],
    {
      name: { type: 'string', description: 'What to call it, which also becomes its id.', placeholder: 'text' },
      engine: { type: 'string', description: 'chatterbox, qwen-design or qwen-custom.', placeholder: 'id' },
      speaker: { type: 'string', description: 'For qwen-custom: Vivian, Serena, Ryan, Aiden, Dylan, Eric, Uncle_Fu, Ono_Anna or Sohee.', placeholder: 'name' },
      instruct: { type: 'string', description: 'Who she is (qwen-design) or how she delivers the line (qwen-custom).', placeholder: 'text' },
      tagline: { type: 'string', description: 'One line about the personality, for the card.', placeholder: 'text' },
    },
    async (ctx, args) => {
      const deps = await ctx.voice()
      const voice = createVoice(
        {
          name: stringValue(args.values, 'name'),
          engine: stringValue(args.values, 'engine'),
          speaker: stringValue(args.values, 'speaker') ?? null,
          instruct: stringValue(args.values, 'instruct') ?? '',
          tagline: stringValue(args.values, 'tagline') ?? '',
        },
        deps,
      )
      ctx.out.result(voice, () => `Added ${voice.name} (${voice.id}), ${describeVoice(voice)}.`)
    },
  ),

  command(
    'voice say',
    'Have one voice read a line. The take already made for those words is reused.',
    ['<id>', '<text>'],
    {
      out: { type: 'string', description: 'Write the audio here as a WAV file.', placeholder: 'file' },
      another: { type: 'boolean', description: 'Make a new take even though one exists.' },
    },
    async (ctx, args) => {
      const deps = await ctx.voice()
      const [id, text] = args.positionals
      const started = Date.now()
      const take = await say(id, text, { another: args.values.another === true }, deps)
      const out = stringValue(args.values, 'out')
      if (out) {
        const audio = readTakeAudio(take.id, deps)
        if (!audio) throw new CliError('The take was recorded but could not be read back.')
        await writeFile(out, audio.bytes)
      }
      ctx.out.result({ ...take, file: out ?? null }, () => [
        `${take.cached ? 'Already recorded' : `Recorded in ${((Date.now() - started) / 1000).toFixed(1)}s`}: ${clock(take.durationMs)}, take ${take.id}.`,
        ...(out ? [`Wrote ${out}.`] : ['Pass --out <file.wav> to keep the audio.']),
      ])
    },
  ),

  command(
    'voice freeze',
    'Upload one take as this voice’s reference, so it stops varying between takes.',
    ['<id>'],
    { take: { type: 'string', description: 'The take to freeze from (see `voice list --takes`). 5–15 seconds is ideal.', placeholder: 'id' } },
    async (ctx, args) => {
      const deps = await ctx.voice()
      const voice = await freezeVoice(args.positionals[0], stringValue(args.values, 'take'), deps)
      ctx.out.result(voice, () => [
        `Froze ${voice.name} as ${voice.frozen?.referenceName}. Every later line is cloned from that recording.`,
        'The freeze is kept in shared/, so commit it and every clone of the repository speaks in this voice:',
        gitAddLine([`shared/Assets/VoiceReference/${voice.id}.wav`, `shared/Assets/VoiceReference/${voice.id}.json`]),
      ])
    },
  ),

  command('voice unfreeze', 'Let a frozen voice vary again, and take its record out of shared/. The reference stays on the speech server.', ['<id>'], {}, async (ctx, args) => {
    const deps = await ctx.voice()
    const voice = await unfreezeVoice(args.positionals[0], deps)
    ctx.out.result(voice, () => `${voice.name} is free to vary again.`)
  }),

  command(
    'voice narrate',
    'Record every step of a lesson that has no recording or an out-of-date one, or of every lesson with --all.',
    ['[lesson]'],
    {
      remake: { type: 'boolean', description: 'Record every step again, even the ones that are ready.' },
      all: { type: 'boolean', description: 'Every lesson in the working library, drafts included, in curriculum order.' },
    },
    async (ctx, args) => {
      const deps = await ctx.voice()
      const remake = args.values.remake === true
      const only = oneLesson(args, 'narrate')

      if (only) {
        const { narration, recorded } = await narrateOne(ctx, deps, only, { remake })
        ctx.out.result({ lessonId: only, recorded, steps: narration.steps }, () =>
          recorded.length === 0
            ? narrationLines(narration, deps.workspace.listVoices())
            : [`Recorded ${plural(recorded.length, 'step')} of ${narration.title}.`, '', ...narrationLines(narration, deps.workspace.listVoices())],
        )
        return
      }

      // One lesson's failure — a step with nothing to say, a line the server
      // refused — must not end a run of sixteen: the rest are still worth
      // making, and the failures are gathered up at the end.
      const lessons = await libraryLessons(ctx)
      const done: { lessonId: string; recorded: number }[] = []
      const failures: { lessonId: string; message: string }[] = []
      for (const lesson of lessons) {
        ctx.out.note(`${lesson.title} (${lesson.id})`)
        try {
          const { recorded } = await narrateOne(ctx, deps, lesson.id, { remake, prefix: `${lesson.id}  ` })
          done.push({ lessonId: lesson.id, recorded: recorded.length })
          if (recorded.length === 0) ctx.out.note('  nothing to do')
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          failures.push({ lessonId: lesson.id, message })
          ctx.out.note(`  failed: ${message}`)
        }
      }

      const steps = done.reduce((total, lesson) => total + lesson.recorded, 0)
      if (failures.length > 0) {
        throw new CliError(
          `Narrated ${plural(steps, 'step')} across ${plural(done.length, 'lesson')}; ${plural(failures.length, 'lesson')} failed.`,
          failures.map((failure) => ({ path: failure.lessonId, message: failure.message })),
        )
      }
      ctx.out.result({ lessons: done, failures }, () => [
        `Narrated ${plural(steps, 'step')} across ${plural(done.length, 'lesson')}.`,
        ...table(done.filter((lesson) => lesson.recorded > 0).map((lesson) => [lesson.lessonId, plural(lesson.recorded, 'step')])),
      ])
    },
  ),

  command('voice lines set', `Write the line a step speaks, instead of its written instruction (at most ${MAX_SPOKEN_LINE} characters).`, ['<lesson>', '<step>', '<text>'], {}, async (ctx, args) => {
    const deps = await ctx.voice()
    const [lessonId, stepId, text] = args.positionals
    const narration = await setNarrationLine(lessonId, stepId, text, deps)
    ctx.out.result(narration, () => [`${stepId} now says: “${text}”`, '', ...narrationLines(narration, deps.workspace.listVoices())])
  }),

  command('voice lines clear', 'Go back to speaking the step’s written instruction.', ['<lesson>', '<step>'], {}, async (ctx, args) => {
    const deps = await ctx.voice()
    const [lessonId, stepId] = args.positionals
    const narration = await setNarrationLine(lessonId, stepId, null, deps)
    ctx.out.result(narration, () => [`${stepId} speaks its instruction again.`, '', ...narrationLines(narration, deps.workspace.listVoices())])
  }),

  command(
    'voice publish',
    'Write a lesson’s narration into shared/Assets/Voice/ as AAC files and a manifest, or every ready lesson with --all.',
    ['[lesson]'],
    {
      all: {
        type: 'boolean',
        description:
          'Every published lesson whose narration is complete, and Lina’s own lines; the rest are listed with the reason.',
      },
    },
    async (ctx, args) => {
      const deps = await ctx.voice()
      const only = oneLesson(args, 'publish')
      if (only) {
        const { files } = await publishVoice(only, deps)
        ctx.out.result({ lessonId: only, files }, () => [`Published the voice of ${only}: ${plural(files.length, 'file')}.`, gitAddLine(files)])
        return
      }

      const lessons = await libraryLessons(ctx)
      const published: { lessonId: string; files: string[] }[] = []
      const skipped: { lessonId: string; reason: string }[] = []
      const failures: { lessonId: string; message: string }[] = []
      for (const lesson of lessons) {
        if (!lesson.published) {
          skipped.push({ lessonId: lesson.id, reason: 'the lesson itself is not published' })
          continue
        }
        const narration = await lessonNarration(lesson.id, deps)
        if (narration.steps.length === 0) {
          skipped.push({ lessonId: lesson.id, reason: 'it has no steps' })
          continue
        }
        if (unready(narration).length > 0) {
          skipped.push({ lessonId: lesson.id, reason: `its narration is not complete (${whyNotReady(narration)})` })
          continue
        }
        try {
          const { files } = await publishVoice(lesson.id, deps)
          published.push({ lessonId: lesson.id, files })
          ctx.out.note(`  ${lesson.id}  ${plural(files.length, 'file')}`)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          failures.push({ lessonId: lesson.id, message })
          ctx.out.note(`  ${lesson.id}  failed: ${message}`)
        }
      }

      // Lina's own lines belong to no lesson, so `--all` would miss them
      // otherwise, and the app would ship a catalog with nothing to say
      // between the lessons.
      const app = await appLines(deps)
      const appLeft = app.lines.filter((line) => line.stale !== null)
      let appFiles: string[] = []
      let appReason = `${plural(appLeft.length, 'line')} still to make (studio voice app narrate)`
      if (appLeft.length === 0) {
        // A failure here must not throw away the report of sixteen lessons
        // already published, so it joins the skipped list with its reason.
        try {
          appFiles = (await publishAppLines(deps)).files
          ctx.out.note(`  Lina’s own lines  ${plural(appFiles.length, 'file')}`)
        } catch (error) {
          appReason = error instanceof Error ? error.message : String(error)
        }
      }
      if (appFiles.length === 0) ctx.out.note(`  Lina’s own lines  skipped: ${appReason}`)

      const files = [...new Set([...published.flatMap((lesson) => lesson.files), ...appFiles])].sort()
      if (failures.length > 0) {
        throw new CliError(
          `Published ${plural(published.length, 'lesson')}; ${plural(failures.length, 'lesson')} failed.`,
          failures.map((failure) => ({ path: failure.lessonId, message: failure.message })),
        )
      }
      ctx.out.result({ published, skipped, appLines: appFiles.length > 0, files }, () => [
        `Published the voice of ${plural(published.length, 'lesson')}: ${plural(files.length, 'file')}.`,
        appFiles.length > 0
          ? `Lina’s own lines went too: ${plural(appFiles.length, 'file')}.`
          : `Lina’s own lines were skipped: ${appReason}.`,
        ...(skipped.length > 0 ? ['', `Skipped ${plural(skipped.length, 'lesson')}:`, ...table(skipped.map((lesson) => [`  ${lesson.lessonId}`, lesson.reason]))] : []),
        '',
        gitAddLine(files),
      ])
    },
  ),

  command('voice unpublish', 'Remove a lesson’s narration from shared/. The recordings stay in the workspace.', ['<lesson>'], {}, async (ctx, args) => {
    const deps = await ctx.voice()
    const lessonId = args.positionals[0]
    await ctx.out.confirm(`This removes shared/Assets/Voice/${lessonId}/.`, lessonId, ctx.flags.yes)
    const { files } = await deletePublishedVoice(lessonId, deps)
    ctx.out.result({ lessonId, files }, () =>
      files.length === 0 ? `${lessonId} had no published voice.` : [`Removed ${plural(files.length, 'file')}.`, gitAddLine(files)],
    )
  }),

  command(
    'voice lines list',
    'What Lina says at each step: the written line, or the instruction she falls back to.',
    ['<lesson>'],
    {},
    async (ctx, args) => {
      const deps = await ctx.voice()
      const lessonId = args.positionals[0]
      const narration = await lessonNarration(lessonId, deps)
      // The JSON is exactly the plan `voice lines apply` reads, so a line can
      // be listed, edited in a file and fed straight back.
      const lines = Object.fromEntries(narration.steps.map((step) => [step.stepId, step.spokenLine]))
      ctx.out.result({ lines }, () => [
        `${narration.title} (${narration.lessonId}): ${plural(narration.steps.length, 'step')}.`,
        '',
        ...table(
          narration.steps.map((step) => [step.stepId, step.spokenLine ? 'written line' : '(instruction)', saying(step)]),
          ['step', 'line', 'what Lina says'],
        ),
      ])
    },
  ),

  command(
    'voice lines generate',
    'Have a model write what Lina says at each step: one or two spoken sentences instead of the written instruction.',
    ['<lesson>'],
    {
      note: { type: 'string', description: 'What to change this time, in a sentence.', placeholder: 'text' },
      overwrite: { type: 'boolean', description: 'Replace the lines already written, instead of only filling the rest.' },
      'dry-run': { type: 'boolean', description: 'Say what would be sent to the model, and stop.' },
    },
    async (ctx, args) => {
      const deps = await ctx.voice()
      const lessonId = args.positionals[0]
      const note = stringValue(args.values, 'note') ?? ''
      const overwrite = args.values.overwrite === true

      if (args.values['dry-run']) {
        const generation = await ctx.generation()
        const narration = await lessonNarration(lessonId, deps)
        const todo = narration.steps.filter((step) => overwrite || step.spokenLine === null)
        const model = ctx.flags.model || generation.defaultModel || null
        ctx.out.result(
          { lessonId, model, keyConfigured: Boolean(generation.apiKey), note, overwrite, steps: narration.steps.length, wouldWrite: todo.map((step) => step.stepId) },
          () => [
            `Would ask ${model ?? 'no model: pass --model'} for spoken lines for “${narration.title}” (${lessonId}); key ${generation.apiKey ? 'configured' : 'missing'}.`,
            `All ${plural(narration.steps.length, 'step')} would be described to the model; ${plural(todo.length, 'line')} would be saved${overwrite ? '' : ' (the written ones are kept)'}.`,
            ...(note ? [`Note: ${note}`] : []),
            'Nothing was generated or written (--dry-run).',
          ],
        )
        return
      }

      ctx.out.note(`Asking ${ctx.flags.model || (await ctx.generation()).defaultModel || 'the model'} for spoken lines…`)
      const narration = await writeSpokenLines(lessonId, { model: ctx.flags.model, note, overwrite }, deps)
      ctx.out.result(narration, () => [
        `${narration.writing.model} wrote ${plural(narration.writing.written.length, 'line')} for ${narration.title} (${narration.writing.promptVersion})${narration.writing.kept.length > 0 ? `, keeping ${plural(narration.writing.kept.length, 'line')} already written` : ''}.`,
        ...(narration.writing.rationale ? [`Rationale: ${narration.writing.rationale}`] : []),
        '',
        ...table(
          narration.steps.map((step) => [step.stepId, step.spokenLine ? 'written line' : '(instruction)', saying(step)]),
          ['step', 'line', 'what Lina says'],
        ),
      ])
    },
  ),

  command(
    'voice lines apply',
    'Write the spoken lines of a whole lesson from a plan: { "lines": { "<step>": "…" | null } }.',
    ['<lesson>'],
    { plan: { type: 'string', description: 'The plan JSON, as `voice lines list --json` prints it.', placeholder: 'file' } },
    async (ctx, args) => {
      const deps = await ctx.voice()
      const lessonId = args.positionals[0]
      const file = stringValue(args.values, 'plan')
      if (!file) throw new CliError('Give the plan: --plan <file>.')
      const narration = await applySpokenLines(lessonId, await readPlanFile(file), deps)
      ctx.out.result(narration, () => [
        `Applied the spoken lines to ${lessonId}.`,
        '',
        ...table(
          narration.steps.map((step) => [step.stepId, step.spokenLine ? 'written line' : '(instruction)', saying(step)]),
          ['step', 'line', 'what Lina says'],
        ),
      ])
    },
  ),

  command(
    'voice reference export',
    'Keep a frozen voice’s reference recording in shared/Assets/VoiceReference/, so Lina survives a wiped machine.',
    ['<id>'],
    {},
    async (ctx, args) => {
      const deps = await ctx.voice()
      const voiceId = args.positionals[0]
      const { files, record } = await exportReference(voiceId, deps)
      ctx.out.result({ voiceId, files, record }, () => [
        `Wrote the reference for ${record.name} (${record.referenceName}, ${clock(record.durationMs)}).`,
        gitAddLine(files),
      ])
    },
  ),

  command(
    'voice reference restore',
    'Put a frozen voice back from shared/: upload its reference to the speech server and return it to the workspace.',
    ['<id>'],
    {},
    async (ctx, args) => {
      const deps = await ctx.voice()
      const voiceId = args.positionals[0]
      const restored = await restoreReference(voiceId, deps)
      ctx.out.result(restored, () => [
        `Restored ${restored.voice.name} (${restored.voice.id}) from shared/.`,
        `The speech server now holds ${restored.reference.name} (${restored.reference.bytes} bytes).`,
        ...(restored.createdVoice ? ['The workspace did not have this voice; it was created from the record.'] : []),
        ...(restored.restoredTake ? ['Its frozen take is back in the workspace.'] : []),
        `Cast it with \`studio voice cast ${restored.voice.id}\`.`,
      ])
    },
  ),

  command(
    'voice app list',
    'Lina’s own lines: what the app says outside any lesson, and what is recorded for each.',
    [],
    {},
    async (ctx) => {
      const deps = await ctx.voice()
      const narration = await appLines(deps)
      ctx.out.result(narration, () => appLinesLines(narration, deps.workspace.listVoices()))
    },
  ),

  command(
    'voice app set',
    `Rewrite one of the app’s lines (at most ${MAX_SPOKEN_LINE} characters). The id is fixed: ${APP_LINE_IDS.join(', ')}.`,
    ['<id>', '<text>'],
    {},
    async (ctx, args) => {
      const deps = await ctx.voice()
      const [id, text] = args.positionals
      const narration = await setAppLine(id, text, deps)
      ctx.out.result(narration, () => [`${id} now says: “${text}”`, '', ...appLinesLines(narration, deps.workspace.listVoices())])
    },
  ),

  command(
    'voice app narrate',
    'Record every one of Lina’s own lines that has no recording or an out-of-date one.',
    [],
    { remake: { type: 'boolean', description: 'Record every line again, even the ones that are ready.' } },
    async (ctx, args) => {
      const deps = await ctx.voice()
      const remake = args.values.remake === true
      let narration = await appLines(deps)
      const todo = (remake ? narration.lines : narration.lines.filter((line) => line.stale !== null)).map(
        (line: AppLineNarration) => line.id,
      )
      const recorded: { id: string; durationMs: number; seconds: number }[] = []
      for (const [index, id] of todo.entries()) {
        const started = Date.now()
        narration = await narrateAppLine(id, { another: remake }, deps)
        const line = narration.lines.find((candidate) => candidate.id === id)
        const seconds = (Date.now() - started) / 1000
        recorded.push({ id, durationMs: line?.take?.durationMs ?? 0, seconds })
        ctx.out.note(
          `  ${index + 1} of ${todo.length}  ${id}  ${clock(line?.take?.durationMs ?? 0)}  in ${seconds.toFixed(1)}s`,
        )
      }
      const voices = deps.workspace.listVoices()
      ctx.out.result({ recorded, lines: narration.lines }, () =>
        recorded.length === 0
          ? appLinesLines(narration, voices)
          : [`Recorded ${plural(recorded.length, 'line')} of Lina’s own.`, '', ...appLinesLines(narration, voices)],
      )
    },
  ),

  command(
    'voice app publish',
    'Write Lina’s own lines into shared/Assets/Voice/app/ as AAC files and a manifest.',
    [],
    {},
    async (ctx) => {
      const deps = await ctx.voice()
      const { files } = await publishAppLines(deps)
      ctx.out.result({ files }, () => [`Published Lina’s own lines: ${plural(files.length, 'file')}.`, gitAddLine(files)])
    },
  ),

  command(
    'voice app unpublish',
    'Remove Lina’s own lines from shared/. The recordings stay in the workspace.',
    [],
    {},
    async (ctx) => {
      const deps = await ctx.voice()
      await ctx.out.confirm('This removes shared/Assets/Voice/app/.', 'app', ctx.flags.yes)
      const { files } = await deletePublishedAppLines(deps)
      ctx.out.result({ files }, () =>
        files.length === 0 ? 'Lina’s own lines were not published.' : [`Removed ${plural(files.length, 'file')}.`, gitAddLine(files)],
      )
    },
  ),

  command('voice script', 'The audition lines every voice reads.', [], {}, async (ctx) => {
    const deps = await ctx.voice()
    const state = await voiceState(deps)
    ctx.out.result({ script: state.script }, () =>
      table(state.script.map((line) => [line.id, line.label, line.text]), ['id', 'label', 'text']),
    )
  }),

  command('voice script set', 'Change one audition line, or add it.', ['<id>', '<text>'], { label: { type: 'string', description: 'What to call the line (default: its id, or what it was called).', placeholder: 'text' } }, async (ctx, args) => {
    const deps = await ctx.voice()
    const [id, text] = args.positionals
    const current = (await voiceState(deps)).script
    const label = stringValue(args.values, 'label') ?? current.find((line) => line.id === id)?.label ?? id
    const lines = current.some((line) => line.id === id)
      ? current.map((line) => (line.id === id ? { ...line, label, text } : line))
      : [...current, { id, label, text }]
    const { script } = setScript(lines, deps)
    ctx.out.result({ script }, () => table(script.map((line) => [line.id, line.label, line.text]), ['id', 'label', 'text']))
  }),
]
