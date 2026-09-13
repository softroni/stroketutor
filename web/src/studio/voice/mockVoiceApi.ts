import { APP_LINES } from '../../voice/suggestions'
import type {
  AppLineNarration,
  AppNarration,
  LessonNarration,
  ScriptLine,
  StepNarration,
  Take,
  Voice,
  VoiceInput,
  VoiceState,
} from '../../voice/types'

import { SUGGESTED_SCRIPT } from './script'
import { takeHash } from './takeKey'

/**
 * A stand-in for `/api/voice`, used only when the Studio is started with
 * `VITE_VOICE_MOCK=1`.
 *
 * The Voice page is the one Studio screen whose every state depends on a
 * machine that may not be there: a designed voice takes seven seconds to say a
 * sentence, and the speech server lives on the creator's tailnet. This fake
 * answers the same calls with the same shapes, after plausible pauses, and
 * hands back a real (if dull) WAV, so the page's waiting, playing, freezing and
 * narrating states can all be walked through and looked at.
 *
 * It keeps everything in memory: a reload starts again from the suggestions.
 */

const now = () => new Date().toISOString()
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** A little variation, so the fake does not feel like a metronome. */
const around = (ms: number) => ms * (0.75 + Math.random() * 0.5)

let counter = 0
const nextId = (prefix: string) => `${prefix}-${(counter += 1).toString(36)}${Date.now().toString(36).slice(-4)}`

/* ---------- Audio: a short tone, built as a real RIFF WAV ---------- */

const wavCache = new Map<number, string>()

/**
 * A WAV of `durationMs` at 24 kHz mono 16-bit — the shape the speech server
 * returns — holding a quiet 440 Hz tone that fades in and out. Real audio, so
 * the page's player, its duration and its progress line are all exercised.
 */
function toneWav(durationMs: number): string {
  const cached = wavCache.get(durationMs)
  if (cached) return cached

  const rate = 24_000
  const samples = Math.round((rate * durationMs) / 1000)
  const bytes = new Uint8Array(44 + samples * 2)
  const view = new DataView(bytes.buffer)
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
  }

  ascii(0, 'RIFF')
  view.setUint32(4, 36 + samples * 2, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ascii(36, 'data')
  view.setUint32(40, samples * 2, true)

  const fade = Math.min(samples / 4, rate * 0.05)
  for (let i = 0; i < samples; i += 1) {
    const envelope = Math.min(1, i / fade, (samples - i) / fade)
    const value = Math.sin((2 * Math.PI * 440 * i) / rate) * 0.18 * envelope
    view.setInt16(44 + i * 2, Math.round(value * 32767), true)
  }

  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const url = `data:audio/wav;base64,${btoa(binary)}`
  wavCache.set(durationMs, url)
  return url
}

/* ---------- The fake workspace ---------- */

const voice = (
  id: string,
  name: string,
  tagline: string,
  engine: Voice['engine'],
  speaker: Voice['speaker'],
  instruct: string,
): Voice => ({
  id,
  name,
  tagline,
  engine,
  instruct,
  speaker,
  frozen: null,
  suggested: true,
  createdAt: '2026-09-13T09:00:00.000Z',
  updatedAt: '2026-09-13T09:00:00.000Z',
})

const voices: Voice[] = [
  voice(
    'lina-bright',
    'Lina, bright',
    'Warm and genuinely excited to teach you',
    'qwen-design',
    null,
    'A warm, bright woman around thirty, an art teacher who is genuinely excited to show you how to draw. Friendly and encouraging, smiling as she speaks, clear diction, a little playful, never rushed.',
  ),
  voice(
    'lina-studio',
    'Lina, unhurried',
    'A quiet studio, a kind teacher at your shoulder',
    'qwen-design',
    null,
    'A warm woman in her late thirties with a low, unhurried voice, like a favourite teacher in a quiet studio. Kind and precise, quietly delighted when a line goes right.',
  ),
  voice(
    'lina-spark',
    'Lina, spark',
    'Upbeat, quick to encourage',
    'qwen-custom',
    'Vivian',
    'Bright, upbeat and encouraging, with real enthusiasm, as if delighted to teach a friend to draw. Clear and warm, not rushed.',
  ),
  voice(
    'lina-serena',
    'Lina, gentle',
    'Soft, steady, smiling',
    'qwen-custom',
    'Serena',
    'Warm, gentle and encouraging, unhurried, smiling as she speaks, with a little sparkle when something goes right.',
  ),
  voice(
    'house-chatterbox',
    'House voice',
    'Chatterbox Turbo, fast and steady, no styling',
    'chatterbox',
    null,
    '',
  ),
]

let script: ScriptLine[] = SUGGESTED_SCRIPT.map((line) => ({ ...line }))
let castVoiceId: string | null = null
const takes: Take[] = []
const takeAudio = new Map<string, string>()
let generating = false

const findVoice = (id: string): Voice => {
  const found = voices.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`No voice "${id}".`)
  return found
}

const touch = (target: Voice) => {
  target.updatedAt = now()
  return { ...target }
}

async function makeTake(target: Voice, text: string): Promise<Take> {
  // Roughly a syllable-and-a-bit per word, so a long instruction sounds long.
  const durationMs = Math.round(Math.min(9000, 900 + text.split(/\s+/).length * 95))
  const take: Take = {
    id: nextId('take'),
    voiceId: target.id,
    text,
    textHash: await takeHash(target, text),
    durationMs,
    createdAt: now(),
  }
  takeAudio.set(take.id, toneWav(Math.min(durationMs, 2400)))
  takes.unshift(take)
  return take
}

/** How long the real server takes for a line, roughly: chatterbox is the quick one. */
const speechDelay = (target: Voice) =>
  around(target.engine === 'chatterbox' ? 2500 : target.frozen ? 6500 : target.engine === 'qwen-design' ? 5500 : 8000)

/* ---------- Lessons ---------- */

const STEP_TEXT: [string, string][] = [
  ['The trunk', 'Begin at the bottom left of the trunk, near the sand, and draw one long line curving up and slightly to the right.'],
  ['The second side', 'Draw a second line beside the first, a little closer to it at the top, so the trunk narrows as it rises.'],
  ['The first frond', 'From the top of the trunk, sweep one long curve out to the left and let it droop at the end.'],
  ['Fronds on the right', 'Sweep two more curves out to the right, one high and one lower, drooping the same way.'],
  ['The notches', 'Add short strokes along each frond, angled away from its centre line, to make the leaves.'],
  ['The coconuts', 'Draw two small circles where the fronds meet the trunk, touching each other.'],
  ['The sand', 'Finish with one soft line across the bottom of the page for the sand.'],
]

const lessons = new Map<string, LessonNarration>()

function lessonFor(lessonId: string): LessonNarration {
  const existing = lessons.get(lessonId)
  if (existing) return existing
  const steps: StepNarration[] = STEP_TEXT.map(([title, instruction], index) => ({
    stepId: `step-${index + 1}`,
    title,
    instruction,
    spokenLine: null,
    text: instruction,
    take: null,
    stale: 'missing',
  }))
  const made: LessonNarration = {
    lessonId,
    title: lessonId.replace(/-/g, ' ').replace(/^./, (first) => first.toUpperCase()),
    castVoiceId,
    steps,
    published: null,
  }
  lessons.set(lessonId, made)
  return made
}

/** Recomputes what is out of date, the way the server does. */
function refresh(lesson: LessonNarration): LessonNarration {
  lesson.castVoiceId = castVoiceId
  for (const step of lesson.steps) {
    step.text = step.spokenLine ?? step.instruction
    if (!step.take) step.stale = 'missing'
    else if (step.take.voiceId !== castVoiceId) step.stale = 'voice-changed'
    else if (step.take.text !== step.text) step.stale = 'text-changed'
    else step.stale = null
  }
  return structuredClone(lesson)
}

/* ---------- Lina's own lines ---------- */

const appLines: AppLineNarration[] = APP_LINES.map((line) => ({ ...line, take: null, stale: 'missing' }))
let appPublished: AppNarration['published'] = null

/** Recomputes the app lines' staleness, the way the server does for a lesson's steps. */
function refreshAppLines(): AppNarration {
  for (const line of appLines) {
    if (!line.take) line.stale = 'missing'
    else if (line.take.voiceId !== castVoiceId) line.stale = 'voice-changed'
    else if (line.take.text !== line.text) line.stale = 'text-changed'
    else line.stale = null
  }
  if (appPublished) {
    appPublished.behind =
      appLines.some((line) => line.stale !== null) ||
      (castVoiceId !== null && appPublished.voiceId !== castVoiceId)
  }
  return structuredClone({ castVoiceId, lines: appLines, published: appPublished })
}

/* ---------- The fake API ---------- */

export const mockVoiceApi = {
  async readState(): Promise<VoiceState> {
    await delay(around(180))
    // `?tts=down` pretends the speech server is asleep, so the page's
    // unreachable state can be looked at without unplugging anything.
    const down = window.location.search.includes('tts=down')
    return structuredClone({
      server: {
        url: 'https://m4-1.tail958ea4.ts.net',
        reachable: !down,
        warm: down ? [] : ['chatterbox-turbo'],
        generating: down ? false : generating,
        references: down ? [] : ['test-reference', 'lina-probe'],
        ...(down
          ? { error: 'connect ETIMEDOUT 100.71.4.2:443 — the Mac on the tailnet did not answer within 3 s.' }
          : {}),
      },
      castVoiceId,
      voices,
      script,
      takes,
    })
  },

  async saveScript(lines: ScriptLine[]) {
    await delay(around(150))
    script = lines.map((line) => ({ ...line }))
    return { script: structuredClone(script) }
  },

  async createVoice(input: VoiceInput): Promise<Voice> {
    await delay(around(200))
    const base = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'voice'
    let id = base
    for (let n = 2; voices.some((candidate) => candidate.id === id); n += 1) id = `${base}-${n}`
    const made: Voice = {
      id,
      name: input.name,
      tagline: input.tagline ?? '',
      engine: input.engine,
      instruct: input.instruct ?? '',
      speaker: input.engine === 'qwen-custom' ? (input.speaker ?? null) : null,
      frozen: null,
      suggested: false,
      createdAt: now(),
      updatedAt: now(),
    }
    voices.push(made)
    return { ...made }
  },

  async updateVoice(id: string, input: Partial<VoiceInput>): Promise<Voice> {
    await delay(around(200))
    const target = findVoice(id)
    if (target.frozen && (input.engine !== undefined || input.instruct !== undefined || input.speaker !== undefined)) {
      throw new Error('This voice is frozen. Unfreeze it before changing how it sounds.')
    }
    if (input.name !== undefined) target.name = input.name
    if (input.tagline !== undefined) target.tagline = input.tagline
    if (input.engine !== undefined) target.engine = input.engine
    if (input.instruct !== undefined) target.instruct = input.instruct
    if (input.speaker !== undefined) target.speaker = target.engine === 'qwen-custom' ? input.speaker : null
    return touch(target)
  },

  async deleteVoice(id: string) {
    await delay(around(200))
    const index = voices.findIndex((candidate) => candidate.id === id)
    if (index >= 0) voices.splice(index, 1)
    for (let i = takes.length - 1; i >= 0; i -= 1) if (takes[i].voiceId === id) takes.splice(i, 1)
    if (castVoiceId === id) castVoiceId = null
    return { ok: true as const }
  },

  async cast(voiceId: string | null) {
    await delay(around(150))
    castVoiceId = voiceId
    return { castVoiceId }
  },

  async say(voiceId: string, text: string, another: boolean): Promise<Take> {
    const target = findVoice(voiceId)
    const hash = await takeHash(target, text)
    if (!another) {
      const cached = takes.find((take) => take.voiceId === voiceId && take.textHash === hash)
      if (cached) {
        await delay(around(120))
        return { ...cached, cached: true }
      }
    }
    generating = true
    try {
      await delay(speechDelay(target))
      return { ...(await makeTake(target, text)) }
    } finally {
      generating = false
    }
  },

  takeUrl(takeId: string): string {
    return takeAudio.get(takeId) ?? toneWav(1200)
  },

  async freeze(id: string, takeId: string): Promise<Voice> {
    const target = findVoice(id)
    const take = takes.find((candidate) => candidate.id === takeId)
    if (!take) throw new Error('That take is gone.')
    await delay(around(2200))
    target.frozen = {
      referenceName: `lina-${id}-${Math.random().toString(16).slice(2, 8)}`,
      referenceText: take.text,
      takeId: take.id,
      frozenAt: now(),
    }
    return touch(target)
  },

  async unfreeze(id: string): Promise<Voice> {
    await delay(around(200))
    const target = findVoice(id)
    target.frozen = null
    return touch(target)
  },

  async readLesson(lessonId: string): Promise<LessonNarration> {
    await delay(around(250))
    return refresh(lessonFor(lessonId))
  },

  async saveLine(lessonId: string, stepId: string, text: string | null): Promise<LessonNarration> {
    await delay(around(180))
    const lesson = lessonFor(lessonId)
    const step = lesson.steps.find((candidate) => candidate.stepId === stepId)
    if (step) step.spokenLine = text && text.trim() ? text : null
    return refresh(lesson)
  },

  /** The fake's stand-in for a model writing the lines: the first clause of each instruction. */
  async writeLines(
    lessonId: string,
    body: { note?: string; overwrite?: boolean },
  ): Promise<LessonNarration> {
    await delay(around(1400))
    const lesson = lessonFor(lessonId)
    for (const step of lesson.steps) {
      if (!body.overwrite && step.spokenLine) continue
      const first = step.instruction.split(/(?<=[.!?])\s/)[0] ?? step.instruction
      step.spokenLine = first.length > 120 ? `${first.slice(0, 119)}…` : first
    }
    return refresh(lesson)
  },

  async narrate(lessonId: string, stepId: string, another: boolean): Promise<LessonNarration> {
    const lesson = lessonFor(lessonId)
    const step = lesson.steps.find((candidate) => candidate.stepId === stepId)
    if (!step) throw new Error(`No step "${stepId}".`)
    if (!castVoiceId) throw new Error('No voice is cast as Lina yet.')
    const target = findVoice(castVoiceId)
    const text = step.spokenLine ?? step.instruction
    const hash = await takeHash(target, text)
    const cached = another ? undefined : takes.find((take) => take.voiceId === target.id && take.textHash === hash)
    if (cached) {
      await delay(around(150))
      step.take = cached
    } else {
      generating = true
      try {
        await delay(speechDelay(target))
        step.take = await makeTake(target, text)
      } finally {
        generating = false
      }
    }
    return refresh(lesson)
  },

  async publish(lessonId: string) {
    await delay(around(900))
    const lesson = lessonFor(lessonId)
    const target = castVoiceId ? findVoice(castVoiceId) : null
    lesson.published = {
      generatedAt: now(),
      voiceId: target?.id ?? '',
      voiceName: target?.name ?? '',
      stepCount: lesson.steps.length,
      behind: false,
    }
    return {
      files: [
        ...lesson.steps.map((step) => `shared/Assets/Voice/${lessonId}/${step.stepId}.m4a`),
        `shared/Assets/Voice/${lessonId}/manifest.json`,
      ],
    }
  },

  async unpublish(lessonId: string) {
    await delay(around(400))
    const lesson = lessonFor(lessonId)
    const files = lesson.published ? [`shared/Assets/Voice/${lessonId}/`] : []
    lesson.published = null
    return { files }
  },

  async readAppLines(): Promise<AppNarration> {
    await delay(around(200))
    return refreshAppLines()
  },

  async saveAppLine(id: string, text: string): Promise<AppNarration> {
    await delay(around(180))
    const line = appLines.find((candidate) => candidate.id === id)
    if (!line) throw new Error(`"${id}" is not one of the app’s lines.`)
    if (!text.trim()) throw new Error(`“${id}” cannot be empty: the app plays it, so it must say something.`)
    line.text = text.trim()
    return refreshAppLines()
  },

  async narrateAppLine(id: string, another: boolean): Promise<AppNarration> {
    const line = appLines.find((candidate) => candidate.id === id)
    if (!line) throw new Error(`"${id}" is not one of the app’s lines.`)
    if (!castVoiceId) throw new Error('No voice is cast as Lina yet.')
    const target = findVoice(castVoiceId)
    const hash = await takeHash(target, line.text)
    const cached = another ? undefined : takes.find((take) => take.voiceId === target.id && take.textHash === hash)
    if (cached) {
      await delay(around(150))
      line.take = cached
    } else {
      generating = true
      try {
        await delay(speechDelay(target))
        line.take = await makeTake(target, line.text)
      } finally {
        generating = false
      }
    }
    return refreshAppLines()
  },

  async publishAppLines() {
    await delay(around(900))
    const target = castVoiceId ? findVoice(castVoiceId) : null
    appPublished = {
      generatedAt: now(),
      voiceId: target?.id ?? '',
      voiceName: target?.name ?? '',
      lineCount: appLines.length,
      behind: false,
    }
    return {
      files: [
        ...appLines.map((line) => `shared/Assets/Voice/app/${line.id}.m4a`),
        'shared/Assets/Voice/app/manifest.json',
      ],
    }
  },

  async unpublishAppLines() {
    await delay(around(400))
    const files = appPublished ? ['shared/Assets/Voice/app/'] : []
    appPublished = null
    return { files }
  },
}
