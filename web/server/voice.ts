import { createHash, randomBytes } from 'node:crypto'

import type { Step, Tutorial } from '../src/schema/types'
import { SUGGESTED_SCRIPT, SUGGESTED_VOICES } from '../src/voice/suggestions'
import {
  QWEN_SPEAKERS,
  type LessonNarration,
  type ScriptLine,
  type StepNarration,
  type Take,
  type Voice,
  type VoiceEngine,
  type VoiceInput,
  type VoiceManifest,
  type VoiceReferenceRecord,
  type VoiceState,
} from '../src/voice/types'

import { readModelChoice, type GenerateDeps } from './generate'
import { GenerationFailed, completeJSON, parseAnswer } from './openrouter'
import {
  MAX_SPOKEN_LINE,
  SPOKEN_LINES_PROMPT_VERSION,
  SPOKEN_LINES_SCHEMA,
  buildSpokenLinesMessages,
  type SpokenLinesStep,
} from './prompts/spokenLinesPrompt'
import { ID_PATTERN, WriteRefused, checkId, checkStepId, type RepoWriter } from './repoWriter'
import {
  addReference,
  convertToM4a,
  probe,
  speak,
  wavDurationMs,
  type StoredReference,
  type TtsDeps,
  type VoiceSettings,
} from './tts'
import type { NarrationEntry, Workspace } from './workspaceStore'

/**
 * Casting Lina, and narrating lessons in her voice.
 *
 * The Studio keeps several candidates for the tutor's voice, has each read the
 * same audition lines, and the creator casts one. Every lesson is then narrated
 * with that voice: one recording per step, of the step's instruction or of a
 * spoken line written for it. Publishing turns those recordings into the AAC
 * files and the manifest the iOS app bundles.
 *
 * Two ideas carry most of this file:
 *
 * - **A take is cached by what made it.** `textHash` covers the engine, the
 *   description, the speaker, the frozen reference and the words, so saying the
 *   same line in the same voice twice costs nothing, and changing any of those
 *   things is a different line that has to be made again. It is also how a step
 *   knows its recording has gone `stale`.
 * - **Nothing reaches `shared/` until it is complete.** Publishing refuses while
 *   a step is missing or stale, and writes the audio before the manifest, so the
 *   folder never promises a file it does not have.
 *
 * Speech itself is `tts.ts`, storage is `workspaceStore.ts`, and `shared/` is
 * `repoWriter.ts`. This file is the rules between them.
 */

export interface VoiceDeps {
  workspace: Workspace
  writer: RepoWriter
  tts: TtsDeps
  /**
   * What writing spoken lines needs from the generation side: the OpenRouter
   * key and the default model. It stays on the server exactly as it does for
   * lesson generation, and everything else here works without it.
   */
  generation?: Pick<GenerateDeps, 'apiKey' | 'defaultModel' | 'fetch'>
}

/** The bytes of one take, as `GET /api/voice/takes/:id` serves them. */
export interface TakeAudio {
  bytes: Uint8Array
  contentType: string
}

// ---------- The cache key ----------

/**
 * What a recording was made from, as one hex digest: the engine, how the voice
 * was described, its speaker, the reference it was frozen to, and the words.
 * Change any of them and the line has to be spoken again; change none and the
 * take already made is the right one.
 */
export function textHash(voice: VoiceSettings, text: string): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        engine: voice.engine,
        instruct: voice.instruct,
        speaker: voice.speaker,
        frozen: voice.frozen?.referenceName ?? null,
        text,
      }),
    )
    .digest('hex')
}

// ---------- Seeding ----------

/**
 * Writes the starting suggestions and the audition script. Every entry point
 * calls it, because the command line can begin anywhere; it costs one lookup
 * and happens once, so a suggestion the creator deletes stays deleted instead
 * of reappearing on the next visit.
 */
function seed(deps: VoiceDeps) {
  if (deps.workspace.voiceSeeded()) return
  const at = new Date().toISOString()
  const voices = SUGGESTED_VOICES.map<Voice>((suggestion) => ({
    id: suggestion.id,
    name: suggestion.name,
    tagline: suggestion.tagline ?? '',
    engine: suggestion.engine,
    instruct: suggestion.instruct ?? '',
    speaker: suggestion.speaker ?? null,
    frozen: null,
    suggested: true,
    createdAt: at,
    updatedAt: at,
  }))
  deps.workspace.seedVoices(voices, SUGGESTED_SCRIPT)
}

// ---------- The page's one read ----------

/** Everything the Voice page needs at once, with the speech server probed live. */
export async function voiceState(deps: VoiceDeps): Promise<VoiceState> {
  seed(deps)
  const server = await probe(deps.tts)
  return {
    server,
    castVoiceId: deps.workspace.castVoiceId(),
    voices: deps.workspace.listVoices(),
    script: deps.workspace.readScript() ?? SUGGESTED_SCRIPT,
    takes: deps.workspace.listTakes(),
  }
}

// ---------- The script ----------

export function setScript(lines: unknown, deps: VoiceDeps): { script: ScriptLine[] } {
  seed(deps)
  if (!Array.isArray(lines)) throw new WriteRefused(400, '`lines` must be a list of script lines.')
  const script = lines.map((line, index) => {
    const value = (line ?? {}) as Partial<ScriptLine>
    const id = text(value.id, `Line ${index + 1}'s id`)
    if (!ID_PATTERN.test(id)) {
      throw new WriteRefused(422, `"${id}" is not a line id: use lowercase letters, digits and single dashes.`)
    }
    return { id, label: text(value.label, `Line ${index + 1}'s label`), text: text(value.text, `Line ${index + 1}`) }
  })
  const seen = new Set<string>()
  for (const line of script) {
    if (seen.has(line.id)) throw new WriteRefused(422, `Two script lines are called "${line.id}".`)
    seen.add(line.id)
  }
  deps.workspace.saveScript(script)
  return { script }
}

// ---------- The candidates ----------

export function createVoice(input: unknown, deps: VoiceDeps): Voice {
  seed(deps)
  const wanted = readVoiceInput(input, null)
  const at = new Date().toISOString()
  const voice: Voice = {
    id: uniqueId(slug(wanted.name), deps),
    name: wanted.name,
    tagline: wanted.tagline ?? '',
    engine: wanted.engine,
    instruct: wanted.instruct ?? '',
    speaker: wanted.speaker ?? null,
    frozen: null,
    suggested: false,
    createdAt: at,
    updatedAt: at,
  }
  return deps.workspace.saveVoice(voice)
}

export function updateVoice(id: string, input: unknown, deps: VoiceDeps): Voice {
  seed(deps)
  const current = mustReadVoice(id, deps)
  const wanted = readVoiceInput(input, current)
  if (
    current.frozen &&
    (wanted.engine !== current.engine ||
      (wanted.instruct ?? '') !== current.instruct ||
      (wanted.speaker ?? null) !== current.speaker)
  ) {
    throw new WriteRefused(
      422,
      `“${current.name}” is frozen, so it speaks from its recorded reference and no longer listens to its description. Unfreeze it first.`,
    )
  }
  return deps.workspace.saveVoice({
    ...current,
    name: wanted.name,
    tagline: wanted.tagline ?? '',
    engine: wanted.engine,
    instruct: wanted.instruct ?? '',
    speaker: wanted.speaker ?? null,
    updatedAt: new Date().toISOString(),
  })
}

/**
 * Removes a candidate and everything made in it. A voice some lesson is
 * narrated with is refused until `force`, because deleting it silently would
 * leave those steps with nothing to play.
 */
export function deleteVoice(id: string, options: { force?: boolean }, deps: VoiceDeps): { ok: true } {
  seed(deps)
  const voice = mustReadVoice(id, deps)
  const used = deps.workspace.narrationUsing(id)
  if (used.length > 0 && !options.force) {
    const lessons = [...new Set(used.map((step) => step.lessonId))]
    throw new WriteRefused(
      409,
      `“${voice.name}” narrates ${used.length === 1 ? '1 step' : `${used.length} steps`} of ${lessons.join(', ')}. Deleting it removes those recordings too.`,
    )
  }
  deps.workspace.deleteVoice(id)
  if (deps.workspace.castVoiceId() === id) deps.workspace.setCastVoiceId(null)
  return { ok: true }
}

/** Casts a voice as Lina, or clears the casting. */
export function castVoice(voiceId: unknown, deps: VoiceDeps): { castVoiceId: string | null } {
  seed(deps)
  if (voiceId === null) {
    deps.workspace.setCastVoiceId(null)
    return { castVoiceId: null }
  }
  if (typeof voiceId !== 'string') throw new WriteRefused(400, '`voiceId` must be a voice id, or null.')
  mustReadVoice(voiceId, deps)
  deps.workspace.setCastVoiceId(voiceId)
  return { castVoiceId: voiceId }
}

// ---------- Speaking ----------

/**
 * One voice reading one line. The take already made for those exact words in
 * that exact voice is returned as it is, which is what makes the bake-off cheap
 * to re-open; `another` is the way to hear a designed voice's next attempt.
 */
export async function say(
  voiceId: string,
  spoken: unknown,
  options: { another?: boolean },
  deps: VoiceDeps,
): Promise<Take> {
  seed(deps)
  const voice = mustReadVoice(voiceId, deps)
  const line = text(spoken, 'The text to say').trim()
  if (!line) throw new WriteRefused(422, 'There is nothing to say: the text is empty.')
  const hash = textHash(voice, line)

  if (!options.another) {
    const cached = deps.workspace.newestTake(voice.id, hash)
    if (cached) return { ...cached, cached: true }
  }

  const wav = await speak(voice, line, deps.tts)
  const take: Take = {
    id: `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`,
    voiceId: voice.id,
    text: line,
    textHash: hash,
    durationMs: wavDurationMs(wav) ?? 0,
    createdAt: new Date().toISOString(),
  }
  deps.workspace.saveTake(take, wav, 'audio/wav')
  return { ...take, cached: false }
}

export function readTakeAudio(takeId: string, deps: VoiceDeps): TakeAudio | null {
  const stored = deps.workspace.readTake(takeId)
  return stored ? { bytes: stored.bytes, contentType: stored.contentType } : null
}

// ---------- Freezing ----------

/**
 * Uploads one take to the speech server as a reference, and points the voice at
 * it. A designed voice varies a little from take to take; once it is frozen
 * every later line is cloned from that one recording, so Lina sounds the same
 * in lesson sixteen as in lesson one.
 */
export async function freezeVoice(id: string, takeId: unknown, deps: VoiceDeps): Promise<Voice> {
  seed(deps)
  const voice = mustReadVoice(id, deps)
  if (voice.engine === 'chatterbox') {
    throw new WriteRefused(422, 'Chatterbox has one fixed voice that never varies, so there is nothing to freeze.')
  }
  const stored = deps.workspace.readTake(text(takeId, '`takeId`'))
  if (!stored || stored.voiceId !== voice.id) {
    throw new WriteRefused(404, `“${voice.name}” has no take ${String(takeId)} to freeze.`)
  }

  const name = `lina-${voice.id}-${randomBytes(3).toString('hex')}`
  const reference = await addReference(name, stored.text, stored.bytes, deps.tts)
  return deps.workspace.saveVoice({
    ...voice,
    frozen: {
      referenceName: reference.name,
      referenceText: stored.text,
      takeId: stored.id,
      frozenAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  })
}

/** Lets a designed voice vary again. The reference stays on the speech server, harmlessly. */
export function unfreezeVoice(id: string, deps: VoiceDeps): Voice {
  seed(deps)
  const voice = mustReadVoice(id, deps)
  if (!voice.frozen) return voice
  return deps.workspace.saveVoice({ ...voice, frozen: null, updatedAt: new Date().toISOString() })
}

// ---------- Narrating a lesson ----------

/** A lesson's steps, what each would say, and what has been recorded for it. */
export async function lessonNarration(lessonId: string, deps: VoiceDeps): Promise<LessonNarration> {
  seed(deps)
  const tutorial = await readLesson(lessonId, deps)
  const castVoiceId = deps.workspace.castVoiceId()
  const cast = castVoiceId ? deps.workspace.readVoice(castVoiceId) : null
  const lines = deps.workspace.readNarrationLines(lessonId)
  const recorded = new Map(deps.workspace.readNarration(lessonId).map((entry) => [entry.stepId, entry]))

  const steps = tutorial.steps.map<StepNarration>((step) => {
    const spokenLine = lines.get(step.id) ?? null
    const spoken = spokenLine ?? step.instruction
    const entry = recorded.get(step.id)
    const take = entry ? deps.workspace.readTakeInfo(entry.takeId) : null
    return {
      stepId: step.id,
      title: step.title,
      instruction: step.instruction,
      spokenLine,
      text: spoken,
      take,
      stale: stalenessOf(entry, take, spoken, cast),
    }
  })

  return {
    lessonId,
    title: tutorial.title,
    castVoiceId,
    steps,
    published: await publishedState(lessonId, steps, castVoiceId, deps),
  }
}

/**
 * Why a recording no longer matches. The words are checked against the take
 * itself, so a changed instruction reads as a changed instruction; everything
 * else that would make the line sound different — a re-cast, an edited
 * description, a freeze — is the voice having changed.
 */
function stalenessOf(
  entry: NarrationEntry | undefined,
  take: Take | null,
  spoken: string,
  cast: Voice | null,
): StepNarration['stale'] {
  if (!entry || !take) return 'missing'
  if (take.text !== spoken) return 'text-changed'
  if (!cast || entry.voiceId !== cast.id || entry.textHash !== textHash(cast, spoken)) return 'voice-changed'
  return null
}

async function publishedState(
  lessonId: string,
  steps: StepNarration[],
  castVoiceId: string | null,
  deps: VoiceDeps,
): Promise<LessonNarration['published']> {
  const manifest = await deps.writer.readVoiceManifest(lessonId)
  if (!manifest) return null
  const published = manifest.steps ?? {}
  const behind =
    Object.keys(published).length !== steps.length ||
    steps.some((step) => published[step.stepId]?.textHash !== step.take?.textHash) ||
    (castVoiceId !== null && manifest.voiceId !== castVoiceId)
  return {
    generatedAt: manifest.generatedAt,
    voiceId: manifest.voiceId,
    voiceName: manifest.voiceName,
    stepCount: Object.keys(published).length,
    behind,
  }
}

/** Writes (or removes) the line spoken for one step instead of its instruction. */
export async function setNarrationLine(
  lessonId: string,
  stepId: string,
  spoken: unknown,
  deps: VoiceDeps,
): Promise<LessonNarration> {
  const tutorial = await readLesson(lessonId, deps)
  mustHaveStep(tutorial, stepId)
  if (spoken !== null && typeof spoken !== 'string') {
    throw new WriteRefused(400, '`text` must be the line to speak, or null to speak the instruction.')
  }
  const line = spoken === null ? null : spoken.trim()
  deps.workspace.saveNarrationLine(lessonId, stepId, line ? line : null)
  return lessonNarration(lessonId, deps)
}

// ---------- The lines Lina speaks ----------

/**
 * A narration, plus what the model did to get there. Every caller that only
 * wants the table can treat it as the `LessonNarration` it is.
 */
export interface WrittenSpokenLines extends LessonNarration {
  writing: {
    model: string
    promptVersion: string
    /** The model's own account of how it pitched the lesson. */
    rationale: string
    /** The steps whose spoken line this run wrote. */
    written: string[]
    /** The steps whose line was already written and was left alone. */
    kept: string[]
  }
}

export interface SpokenLinesRequest {
  /** The OpenRouter model; the server's default when absent. */
  model?: unknown
  /** What the creator wants different this time. */
  note?: unknown
  /** True to replace lines the creator already wrote. False (the default) only fills the rest. */
  overwrite?: unknown
}

/**
 * Has a model write what Lina says at each step.
 *
 * A step speaks its written instruction unless a line is written for it, and
 * the written instructions are paragraphs: Palm Tree's first is seventeen
 * seconds of speech over a stroke that draws in three. This asks for the other
 * piece of writing — one or two conversational sentences said while the stroke
 * animates — and leaves the instruction on screen for whoever wants the detail.
 *
 * The model is told about every step, including the ones whose lines are being
 * kept, so the lesson has one voice; `overwrite` decides which of its answers
 * are saved. Nothing is written until the whole answer is checked.
 *
 * The run is not kept in the lesson's History: History holds versions of the
 * lesson document (`readHistoryRecord` accepts nothing else), and a spoken line
 * is not part of it — it lives in the workspace beside the narration.
 */
export async function writeSpokenLines(
  lessonId: string,
  request: SpokenLinesRequest,
  deps: VoiceDeps,
): Promise<WrittenSpokenLines> {
  seed(deps)
  const generation = deps.generation ?? {}
  const { apiKey, model } = readModelChoice({ model: request.model }, generation)
  if (request.overwrite !== undefined && typeof request.overwrite !== 'boolean') {
    throw new WriteRefused(400, '`overwrite` must be true or false.')
  }
  const note = request.note === undefined || request.note === null ? '' : text(request.note, 'The note').trim()
  const overwrite = request.overwrite === true

  const tutorial = await readLesson(lessonId, deps)
  if (tutorial.steps.length === 0) throw new WriteRefused(422, `“${tutorial.title}” has no steps to speak.`)
  const existing = deps.workspace.readNarrationLines(lessonId)
  const lesson = await catalogEntry(lessonId, deps)

  const completion = await completeJSON(
    {
      model,
      messages: buildSpokenLinesMessages({
        title: tutorial.title,
        objective: lesson?.objective ?? '',
        steps: tutorial.steps.map<SpokenLinesStep>((step) => ({
          id: step.id,
          title: step.title,
          instruction: step.instruction,
          strokes: step.strokes.length,
          fills: step.fills?.length ?? 0,
          spokenLine: existing.get(step.id) ?? null,
        })),
        note,
        keepWritten: !overwrite,
      }),
      schemaName: 'stroketutor_spoken_lines',
      schema: SPOKEN_LINES_SCHEMA,
    },
    { apiKey, ...(generation.fetch ? { fetch: generation.fetch } : {}) },
  )

  const answer = parseAnswer(completion.content) as { rationale?: unknown; lines?: unknown } | null
  const lines = checkAnswerLines(answer?.lines, tutorial.steps)

  const written: string[] = []
  const kept: string[] = []
  for (const step of tutorial.steps) {
    if (!overwrite && existing.get(step.id)) {
      kept.push(step.id)
      continue
    }
    deps.workspace.saveNarrationLine(lessonId, step.id, lines.get(step.id)!)
    written.push(step.id)
  }

  return {
    ...(await lessonNarration(lessonId, deps)),
    writing: {
      model: completion.model,
      promptVersion: SPOKEN_LINES_PROMPT_VERSION,
      rationale: typeof answer?.rationale === 'string' ? answer.rationale.trim() : '',
      written,
      kept,
    },
  }
}

/**
 * The model's answer as a line for every step, or a refusal. A spoken line is
 * the only thing the app will say at that step, so a half-written answer is
 * worth nothing: one line per step, each step exactly once, nothing empty and
 * nothing longer than a breath.
 */
function checkAnswerLines(value: unknown, steps: Step[]): Map<string, string> {
  if (!Array.isArray(value)) throw new GenerationFailed(502, "The model's answer is missing the spoken lines.")
  const known = new Set(steps.map((step) => step.id))
  const lines = new Map<string, string>()
  for (const entry of value) {
    const line = (entry ?? {}) as { id?: unknown; text?: unknown }
    const id = typeof line.id === 'string' ? line.id.trim() : ''
    const spoken = typeof line.text === 'string' ? line.text.trim() : ''
    if (!known.has(id)) {
      throw new GenerationFailed(502, `The model wrote a line for "${id || '(no id)'}", which is not a step of this lesson.`)
    }
    if (lines.has(id)) throw new GenerationFailed(502, `The model wrote two lines for the step "${id}".`)
    if (!spoken) throw new GenerationFailed(502, `The model left the step "${id}" with nothing to say.`)
    if (spoken.length > MAX_SPOKEN_LINE) {
      throw new GenerationFailed(
        502,
        `The model's line for "${id}" is ${spoken.length} characters; a spoken line must be ${MAX_SPOKEN_LINE} or fewer.`,
      )
    }
    lines.set(id, spoken)
  }
  const missing = steps.filter((step) => !lines.has(step.id)).map((step) => step.id)
  if (missing.length > 0) {
    throw new GenerationFailed(502, `The model wrote nothing for ${missing.length === 1 ? 'the step' : 'the steps'} ${missing.join(', ')}.`)
  }
  return lines
}

/** A plan written by hand (or by an agent): the line for each step it names, or null to clear it. */
export interface SpokenLinesPlan {
  lines?: unknown
}

/**
 * Applies a plan of spoken lines, the way `lessons apply --plan` applies a
 * plan of steps: the whole plan is checked first, each refusal names what is
 * wrong, and nothing is written unless all of it is good.
 */
export async function applySpokenLines(
  lessonId: string,
  plan: SpokenLinesPlan,
  deps: VoiceDeps,
): Promise<LessonNarration> {
  seed(deps)
  const tutorial = await readLesson(lessonId, deps)
  const raw = plan?.lines
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new WriteRefused(400, '`lines` must be an object of step id to the line spoken there, or null to clear it.')
  }

  const known = new Set(tutorial.steps.map((step) => step.id))
  const entries = Object.entries(raw as Record<string, unknown>)
  const unknown = entries.map(([id]) => id).filter((id) => !known.has(id))
  if (unknown.length > 0) {
    throw new WriteRefused(
      404,
      `“${tutorial.title}” has no ${unknown.length === 1 ? 'step' : 'steps'} ${unknown.map((id) => `"${id}"`).join(', ')}.`,
    )
  }

  const checked: [string, string | null][] = entries.map(([id, value]) => {
    if (value === null) return [id, null]
    if (typeof value !== 'string') throw new WriteRefused(400, `The line for "${id}" must be text, or null to clear it.`)
    const spoken = value.trim()
    if (!spoken) throw new WriteRefused(422, `The line for "${id}" is empty. Use null to speak the instruction instead.`)
    if (spoken.length > MAX_SPOKEN_LINE) {
      throw new WriteRefused(
        422,
        `The line for "${id}" is ${spoken.length} characters; a spoken line must be ${MAX_SPOKEN_LINE} or fewer.`,
      )
    }
    return [id, spoken]
  })

  for (const [id, spoken] of checked) deps.workspace.saveNarrationLine(lessonId, id, spoken)
  return lessonNarration(lessonId, deps)
}

/** The lesson's catalog entry, when the working curriculum has one. */
async function catalogEntry(lessonId: string, deps: VoiceDeps) {
  const { lessons } = await deps.workspace.readCatalog()
  if (!lessons) return null
  try {
    const parsed = JSON.parse(lessons.text) as { lessons?: { id: string; objective?: string }[] }
    return parsed.lessons?.find((lesson) => lesson.id === lessonId) ?? null
  } catch {
    // A curriculum that will not parse is the catalog's problem, not the voice's.
    return null
  }
}

/**
 * Records one step in the cast voice. One step, not the lesson: the page loops
 * over them so it can show what is happening and be stopped, and the server
 * serialises the work anyway.
 */
export async function narrateStep(
  lessonId: string,
  body: { stepId?: unknown; another?: unknown },
  deps: VoiceDeps,
): Promise<LessonNarration> {
  seed(deps)
  const castVoiceId = deps.workspace.castVoiceId()
  if (!castVoiceId) throw new WriteRefused(409, 'No voice is cast as Lina yet, so there is nothing to narrate with.')
  const tutorial = await readLesson(lessonId, deps)
  const stepId = text(body.stepId, '`stepId`')
  const step = mustHaveStep(tutorial, stepId)

  const spoken = deps.workspace.readNarrationLines(lessonId).get(stepId) ?? step.instruction
  if (!spoken.trim()) {
    throw new WriteRefused(422, `Step “${step.title}” has nothing to say: write a spoken line for it first.`)
  }
  const take = await say(castVoiceId, spoken, { another: body.another === true }, deps)
  deps.workspace.saveNarration(lessonId, {
    stepId,
    takeId: take.id,
    voiceId: take.voiceId,
    textHash: take.textHash,
    generatedAt: new Date().toISOString(),
  })
  return lessonNarration(lessonId, deps)
}

// ---------- Publishing ----------

/**
 * Writes a lesson's narration into `shared/Assets/Voice/<lessonId>/`: one AAC
 * file per step and the manifest beside them.
 *
 * It refuses while anything is missing or stale, because a half-narrated lesson
 * in the app would be worse than a silent one, and while the lesson itself is
 * unpublished, because the app would bundle audio for a lesson it does not have.
 */
export async function publishVoice(lessonId: string, deps: VoiceDeps): Promise<{ files: string[] }> {
  const narration = await lessonNarration(lessonId, deps)
  if (!(await deps.writer.readTutorial(lessonId))) {
    throw new WriteRefused(
      422,
      `“${narration.title}” is not published yet. Publish the lesson first; its voice goes beside it.`,
    )
  }
  // Narration follows the lesson as it stands in the workspace, so a draft
  // edited since it was published would ship audio for words the app does not
  // have. The lesson goes first; its voice follows.
  if ((await deps.workspace.readLibrary()).publishing.editedIds.includes(lessonId)) {
    throw new WriteRefused(
      409,
      `“${narration.title}” has edits that are not published yet. Publish the lesson first, so its voice matches the words the app has.`,
    )
  }
  if (narration.steps.length === 0) {
    throw new WriteRefused(422, `“${narration.title}” has no steps to narrate.`)
  }
  const unready = narration.steps.filter((step) => step.stale !== null)
  if (unready.length > 0) {
    const missing = unready.filter((step) => step.stale === 'missing').length
    const changed = unready.length - missing
    const parts = [
      missing > 0 ? `${missing} ${missing === 1 ? 'step has' : 'steps have'} no recording` : '',
      changed > 0 ? `${changed} ${changed === 1 ? 'is' : 'are'} out of date` : '',
    ].filter(Boolean)
    throw new WriteRefused(422, `“${narration.title}” is not ready: ${parts.join(' and ')}. Narrate what is missing first.`)
  }
  const voice = narration.castVoiceId ? deps.workspace.readVoice(narration.castVoiceId) : null
  if (!voice) throw new WriteRefused(409, 'No voice is cast as Lina yet, so there is nothing to publish.')

  // Every name is checked, and every file converted, before anything is written.
  for (const step of narration.steps) checkStepId(step.stepId)
  const convert = deps.tts.convert ?? convertToM4a
  const files: { stepId: string; bytes: Uint8Array }[] = []
  const steps: VoiceManifest['steps'] = {}
  for (const step of narration.steps) {
    const stored = deps.workspace.readTake(step.take!.id)
    if (!stored) throw new WriteRefused(409, `The recording for “${step.title}” is gone. Make it again.`)
    files.push({ stepId: step.stepId, bytes: await convert(stored.bytes) })
    steps[step.stepId] = {
      file: `${step.stepId}.m4a`,
      text: stored.text,
      textHash: stored.textHash,
      durationMs: stored.durationMs,
    }
  }

  const manifest: VoiceManifest = {
    manifestVersion: 1,
    lessonId,
    voiceId: voice.id,
    voiceName: voice.name,
    model: voice.frozen ? `qwen-base clone of ${voice.frozen.referenceName}` : voice.engine,
    generatedAt: new Date().toISOString(),
    steps,
  }
  const written = await deps.writer.writeVoice(lessonId, files, manifest)
  const reference = await exportReferenceIfStale(voice, deps)
  return { files: [...new Set([...written.files, ...reference])].sort() }
}

// ---------- The reference kept in the repository ----------

/** What `restoreReference` put back, so the caller can say what it did. */
export interface RestoredReference {
  voice: Voice
  /** What the speech server reports about the reference it now holds. */
  reference: StoredReference
  /** True when the workspace had no such voice and it was created from the record. */
  createdVoice: boolean
  /** True when the frozen take was put back into the workspace. */
  restoredTake: boolean
}

/** Everything about a frozen voice that its record in `shared/` holds. */
function referenceRecordOf(voice: Voice, take: { id: string; durationMs: number }): VoiceReferenceRecord {
  return {
    referenceVersion: 1,
    voiceId: voice.id,
    name: voice.name,
    tagline: voice.tagline,
    engine: voice.engine,
    instruct: voice.instruct,
    speaker: voice.speaker,
    referenceName: voice.frozen!.referenceName,
    referenceText: voice.frozen!.referenceText,
    frozenAt: voice.frozen!.frozenAt,
    takeId: take.id,
    durationMs: take.durationMs,
  }
}

/**
 * Writes a frozen voice's reference recording into `shared/`.
 *
 * Freezing leaves the reference in two places git never sees — the speech
 * server's `voices/` directory and the local workspace — so the voice the whole
 * catalog is narrated in would not survive a wiped Mac. This is the copy that
 * does.
 */
export async function exportReference(
  voiceId: string,
  deps: VoiceDeps,
): Promise<{ files: string[]; record: VoiceReferenceRecord }> {
  seed(deps)
  const voice = mustReadVoice(voiceId, deps)
  if (!voice.frozen) {
    throw new WriteRefused(422, `“${voice.name}” is not frozen, so there is no reference recording to keep.`)
  }
  const stored = deps.workspace.readTake(voice.frozen.takeId)
  if (!stored) {
    throw new WriteRefused(
      409,
      `The take “${voice.name}” was frozen from is no longer in the workspace, so its reference cannot be written out. Freeze it again from a take you still have.`,
    )
  }
  const record = referenceRecordOf(voice, stored)
  const { files } = await deps.writer.writeVoiceReference(voice.id, stored.bytes, record)
  return { files, record }
}

/**
 * Puts a frozen voice back from what `shared/` holds: the WAV goes up to the
 * speech server under the name it had, the take returns to the workspace if it
 * is missing, and the voice is created from the record if the workspace has
 * never heard of it. This is what a new machine runs.
 *
 * The speech server stores references by name, so uploading again replaces the
 * one already there rather than making a second: restoring twice is harmless,
 * and a name that belonged to a different voice would be overwritten (the names
 * freezing mints end in six random hex digits, so that takes deliberate effort).
 */
export async function restoreReference(voiceId: string, deps: VoiceDeps): Promise<RestoredReference> {
  seed(deps)
  const kept = await deps.writer.readVoiceReference(checkId(voiceId))
  if (!kept) {
    throw new WriteRefused(404, `shared/Assets/Voice/reference/ has nothing for "${voiceId}".`)
  }
  const { wav, record } = kept
  const reference = await addReference(record.referenceName, record.referenceText, wav, deps.tts)

  const frozen = {
    referenceName: record.referenceName,
    referenceText: record.referenceText,
    takeId: record.takeId,
    frozenAt: record.frozenAt,
  }
  const current = deps.workspace.readVoice(record.voiceId)
  const at = new Date().toISOString()
  const voice = deps.workspace.saveVoice(
    current
      ? { ...current, frozen, updatedAt: at }
      : {
          id: record.voiceId,
          name: record.name,
          tagline: record.tagline,
          engine: record.engine,
          instruct: record.instruct,
          speaker: record.speaker,
          frozen,
          suggested: false,
          createdAt: record.frozenAt,
          updatedAt: at,
        },
  )

  // The take was recorded before the voice was frozen, so its key is the one
  // the unfrozen voice had; anything else would leave a duplicate behind.
  const restoredTake = deps.workspace.readTakeInfo(record.takeId) === null
  if (restoredTake) {
    deps.workspace.saveTake(
      {
        id: record.takeId,
        voiceId: voice.id,
        text: record.referenceText,
        textHash: textHash({ engine: record.engine, instruct: record.instruct, speaker: record.speaker, frozen: null }, record.referenceText),
        durationMs: record.durationMs,
        createdAt: record.frozenAt,
      },
      wav,
      'audio/wav',
    )
  }

  return { voice, reference, createdVoice: current === null, restoredTake }
}

/**
 * The reference files publishing writes beside the audio, when the cast voice
 * is frozen and what is on disk is missing or out of date. A publish is the
 * moment the lesson enters git, so it is also the moment the voice it was
 * narrated in ought to.
 *
 * A frozen voice whose take has left the workspace is passed over rather than
 * failing the publish: the lesson's audio is already made, and `voice reference
 * export` says exactly what is wrong when the creator asks for it.
 */
async function exportReferenceIfStale(voice: Voice, deps: VoiceDeps): Promise<string[]> {
  if (!voice.frozen) return []
  const stored = deps.workspace.readTake(voice.frozen.takeId)
  if (!stored) return []
  const record = referenceRecordOf(voice, stored)
  const kept = await deps.writer.readVoiceReference(voice.id).catch(() => null)
  if (kept && sameBytes(kept.wav, stored.bytes) && JSON.stringify(kept.record) === JSON.stringify(record)) return []
  return (await deps.writer.writeVoiceReference(voice.id, stored.bytes, record)).files
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false
  for (let index = 0; index < a.byteLength; index += 1) if (a[index] !== b[index]) return false
  return true
}

/** Takes a lesson's narration out of `shared/`. The recordings stay in the workspace. */
export async function deletePublishedVoice(lessonId: string, deps: VoiceDeps): Promise<{ files: string[] }> {
  checkId(lessonId)
  return deps.writer.deleteVoice(lessonId)
}

// ---------- Reading what the caller sent ----------

function readVoiceInput(input: unknown, current: Voice | null): VoiceInput {
  if (input !== undefined && (typeof input !== 'object' || input === null || Array.isArray(input))) {
    throw new WriteRefused(400, 'A voice must be a JSON object.')
  }
  const value = (input ?? {}) as Record<string, unknown>
  const name = (value.name === undefined && current ? current.name : text(value.name, 'The voice’s name')).trim()
  if (!name) throw new WriteRefused(422, 'A voice needs a name.')

  const engine = (value.engine === undefined && current ? current.engine : value.engine) as VoiceEngine
  if (engine !== 'chatterbox' && engine !== 'qwen-design' && engine !== 'qwen-custom') {
    throw new WriteRefused(422, `"${String(engine)}" is not an engine: use chatterbox, qwen-design or qwen-custom.`)
  }
  const tagline = value.tagline === undefined && current ? current.tagline : optionalText(value.tagline, 'The tagline')
  const instruct =
    value.instruct === undefined && current ? current.instruct : optionalText(value.instruct, 'The description')
  const speaker = value.speaker === undefined && current ? current.speaker : (value.speaker ?? null)

  if (engine === 'qwen-custom') {
    if (typeof speaker !== 'string' || !(QWEN_SPEAKERS as readonly string[]).includes(speaker)) {
      throw new WriteRefused(422, `A CustomVoice voice needs a speaker: one of ${QWEN_SPEAKERS.join(', ')}.`)
    }
  } else if (speaker !== null && speaker !== undefined && speaker !== '') {
    throw new WriteRefused(422, 'Only a CustomVoice voice has a speaker; the others are designed or fixed.')
  }
  if (engine === 'qwen-design' && !instruct.trim()) {
    throw new WriteRefused(422, 'A designed voice is its description: say who she is, her age, her warmth, her pace.')
  }

  return {
    name,
    tagline: tagline.trim(),
    engine,
    instruct: instruct.trim(),
    speaker: engine === 'qwen-custom' ? (speaker as VoiceInput['speaker']) : null,
  }
}

function text(value: unknown, what: string): string {
  if (typeof value !== 'string') throw new WriteRefused(400, `${what} must be text.`)
  return value
}

function optionalText(value: unknown, what: string): string {
  if (value === undefined || value === null) return ''
  return text(value, what)
}

function mustReadVoice(id: string, deps: VoiceDeps): Voice {
  const voice = deps.workspace.readVoice(id)
  if (!voice) throw new WriteRefused(404, `There is no voice "${id}".`)
  return voice
}

async function readLesson(lessonId: string, deps: VoiceDeps): Promise<Tutorial> {
  const stored = await deps.workspace.readTutorial(lessonId)
  if (!stored) throw new WriteRefused(404, `There is no lesson "${lessonId}".`)
  return JSON.parse(stored.text) as Tutorial
}

function mustHaveStep(tutorial: Tutorial, stepId: string) {
  const step = tutorial.steps.find((candidate) => candidate.id === stepId)
  if (!step) throw new WriteRefused(404, `“${tutorial.title}” has no step "${stepId}".`)
  return step
}

/** A voice's id is the slug of the name it was created with, and never changes after that. */
function slug(name: string): string {
  const cleaned = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned || 'voice'
}

function uniqueId(base: string, deps: VoiceDeps): string {
  let id = base
  for (let n = 2; deps.workspace.readVoice(id); n += 1) id = `${base}-${n}`
  return id
}
