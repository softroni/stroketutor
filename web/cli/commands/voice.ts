import { writeFile } from 'node:fs/promises'

import {
  castVoice,
  createVoice,
  deletePublishedVoice,
  freezeVoice,
  lessonNarration,
  narrateStep,
  publishVoice,
  readTakeAudio,
  say,
  setNarrationLine,
  setScript,
  unfreezeVoice,
  voiceState,
} from '../../server/voice'
import type { LessonNarration, StepNarration, Voice } from '../../src/voice/types'

import { stringValue } from '../args'
import { command, type Command } from '../command'
import { CliError, gitAddLine, plural, table } from '../output'

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

function stepState(step: StepNarration): string {
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
      ctx.out.result(voice, () => `Froze ${voice.name} as ${voice.frozen?.referenceName}. Every later line is cloned from that recording.`)
    },
  ),

  command('voice unfreeze', 'Let a frozen voice vary again. The reference stays on the speech server.', ['<id>'], {}, async (ctx, args) => {
    const deps = await ctx.voice()
    const voice = unfreezeVoice(args.positionals[0], deps)
    ctx.out.result(voice, () => `${voice.name} is free to vary again.`)
  }),

  command(
    'voice narrate',
    'Record every step of a lesson that has no recording or an out-of-date one.',
    ['<lesson>'],
    { remake: { type: 'boolean', description: 'Record every step again, even the ones that are ready.' } },
    async (ctx, args) => {
      const deps = await ctx.voice()
      const lessonId = args.positionals[0]
      const remake = args.values.remake === true
      let narration = await lessonNarration(lessonId, deps)
      const todo = (remake ? narration.steps : unready(narration)).map((step) => step.stepId)
      if (todo.length === 0) {
        ctx.out.result({ lessonId, recorded: [], steps: narration.steps }, () => narrationLines(narration, deps.workspace.listVoices()))
        return
      }

      const recorded: { stepId: string; durationMs: number; seconds: number }[] = []
      for (const [index, stepId] of todo.entries()) {
        const started = Date.now()
        narration = await narrateStep(lessonId, { stepId, another: remake }, deps)
        const step = narration.steps.find((candidate) => candidate.stepId === stepId)
        const seconds = (Date.now() - started) / 1000
        recorded.push({ stepId, durationMs: step?.take?.durationMs ?? 0, seconds })
        ctx.out.note(`  ${index + 1} of ${todo.length}  ${stepId}  ${clock(step?.take?.durationMs ?? 0)}  in ${seconds.toFixed(1)}s`)
      }
      const done = narration
      ctx.out.result({ lessonId, recorded, steps: done.steps }, () => [
        `Recorded ${plural(recorded.length, 'step')} of ${done.title}.`,
        '',
        ...narrationLines(done, deps.workspace.listVoices()),
      ])
    },
  ),

  command('voice lines set', 'Write the line a step speaks, instead of its written instruction.', ['<lesson>', '<step>', '<text>'], {}, async (ctx, args) => {
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

  command('voice publish', 'Write a lesson’s narration into shared/Assets/Voice/ as AAC files and a manifest.', ['<lesson>'], {}, async (ctx, args) => {
    const deps = await ctx.voice()
    const lessonId = args.positionals[0]
    const { files } = await publishVoice(lessonId, deps)
    ctx.out.result({ lessonId, files }, () => [`Published the voice of ${lessonId}: ${plural(files.length, 'file')}.`, gitAddLine(files)])
  }),

  command('voice unpublish', 'Remove a lesson’s narration from shared/. The recordings stay in the workspace.', ['<lesson>'], {}, async (ctx, args) => {
    const deps = await ctx.voice()
    const lessonId = args.positionals[0]
    await ctx.out.confirm(`This removes shared/Assets/Voice/${lessonId}/.`, lessonId, ctx.flags.yes)
    const { files } = await deletePublishedVoice(lessonId, deps)
    ctx.out.result({ lessonId, files }, () =>
      files.length === 0 ? `${lessonId} had no published voice.` : [`Removed ${plural(files.length, 'file')}.`, gitAddLine(files)],
    )
  }),

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
