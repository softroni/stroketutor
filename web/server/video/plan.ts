import type { Tutorial } from '../../src/schema/types'
import { OUTRO_ID } from '../../src/voice/bookends'

import { estimateWords, type TimedWord } from './words'

/**
 * The plan of a lesson video: when each part starts, what is on screen, and
 * when each of Lina's recordings plays. Pure, so the timing is tested without
 * a browser, a speech server or ffmpeg; `render.ts` does the rest.
 *
 * The video runs:
 *
 * 1. **The opening.** The finished picture, then the whole lesson drawn fast
 *    while Lina says one line of invitation ("Let's draw a rocket. Grab a
 *    pencil and draw along with me.").
 * 2. **Every step** at the lesson's own pace: Lina starts its recording, the
 *    lines follow a moment later, and the step lasts as long as the longer of
 *    the two, plus a short beat.
 * 3. **The ending.** "Now draw it yourself" over the finished picture while
 *    Lina says her closing line, and Paper Coach with the call to action takes
 *    her place at the bottom.
 */

/** One of Lina's recordings: the words she says, how long they take, and when she says each one. */
export interface Clip {
  text: string
  durationS: number
  /** Each word's time in the recording (`words.ts`); estimated from the words' lengths when absent. */
  words?: TimedWord[]
}

export interface VideoInput {
  tutorial: Tutorial
  /** Each step's recording by step id, and the closing line under `lesson-outro`. A step without one is silent. */
  clips: Record<string, Clip>
  /** The opening line. */
  intro: Clip
  /** Where the lesson sits in the curriculum, for the opening's label; null outside every path. */
  place: { pathTitle: string; number: number; count: number } | null
  /** The line under Paper Coach at the end. */
  cta: string
}

export type Segment =
  | { kind: 'intro'; start: number; end: number }
  | { kind: 'step'; index: number; start: number; end: number; drawAt: number }
  | { kind: 'outro'; start: number; end: number; swapAt: number }

/**
 * A few of Lina's words on one line, on screen from `from` until `to`. Each
 * word lights up from its own `from` until its `to`, as she says it. Plain text.
 */
export interface Caption {
  text: string
  from: number
  to: number
  words: { text: string; from: number; to: number }[]
}

/** A recording starting at `at` seconds: `intro`, a step id, or `lesson-outro`. */
export interface Cue {
  key: string
  at: number
}

export interface VideoPlan {
  segments: Segment[]
  captions: Caption[]
  cues: Cue[]
  /** The opening's fast drawing: the finished picture until `hold`, then everything drawn from `drawFrom` at `speed` × the lesson's pace. */
  hook: { hold: number; drawFrom: number; speed: number }
  total: number
  /** What the page shows, as HTML with every piece of text escaped. */
  text: { introChip: string; introTitle: string; outroTitle: string; cta: string }
}

export const DEFAULT_CTA = 'Free on the App Store · link in bio'
/** The line under Paper Coach when the App Store badge is beside it, which already says where. */
export const DEFAULT_CTA_WITH_BADGE = 'Free · link in bio'

/** Lina's opening line starts this long into the video. */
const INTRO_VOICE_AT = 0.35
/** Held after it, with the finished picture, before step 1. */
const INTRO_TAIL = 0.6
/** A step's recording starts this long after the step. */
const LEAD = 0.25
/** Its lines start this long after the recording. */
const DRAW_DELAY = 0.35
/** Held after the longer of the recording and the lines. */
const BEAT = 0.9
/** The ending's recording starts this long in, and Paper Coach fades in over Lina from `SWAP_AT`. */
const OUTRO_VOICE_AT = 0.3
const SWAP_AT = 0.15
/** The call to action stays this long after Lina's last word. */
const OUTRO_HOLD = 2.6
const HOOK = { hold: 0.8, drawFrom: 1.1, tail: 0.8 }

export function planVideo(input: VideoInput): VideoPlan {
  const { tutorial, clips, intro } = input
  const segments: Segment[] = []
  const captions: Caption[] = []
  const cues: Cue[] = []

  const introEnd = INTRO_VOICE_AT + intro.durationS + INTRO_TAIL
  segments.push({ kind: 'intro', start: 0, end: introEnd })
  cues.push({ key: 'intro', at: INTRO_VOICE_AT })
  captions.push(...captionsFor(intro, INTRO_VOICE_AT, 0, introEnd))

  let t = introEnd
  tutorial.steps.forEach((step, index) => {
    const clip = clips[step.id]
    const voiceAt = t + LEAD
    const drawAt = voiceAt + DRAW_DELAY
    const end = Math.max(voiceAt + (clip?.durationS ?? 0), drawAt + stepSeconds(step)) + BEAT
    if (clip) {
      cues.push({ key: step.id, at: voiceAt })
      captions.push(...captionsFor(clip, voiceAt, t, end))
    }
    segments.push({ kind: 'step', index, start: t, end, drawAt })
    t = end
  })

  const outro = clips[OUTRO_ID]
  if (outro) cues.push({ key: OUTRO_ID, at: t + OUTRO_VOICE_AT })
  const end = t + OUTRO_VOICE_AT + (outro?.durationS ?? 1) + OUTRO_HOLD
  segments.push({ kind: 'outro', start: t, end, swapAt: t + SWAP_AT })

  // As fast as it takes to finish with a moment to spare before step 1, and never slower than the lesson itself.
  const window = Math.max(1, introEnd - HOOK.tail - HOOK.drawFrom)
  const all = tutorial.steps.reduce((sum, step) => sum + stepSeconds(step), 0)
  const hook = { hold: HOOK.hold, drawFrom: HOOK.drawFrom, speed: Math.max(1, all / window) }

  const { article, subject } = subjectOf(tutorial.title)
  return {
    segments,
    captions,
    cues,
    hook,
    total: end,
    text: {
      introChip: escapeHtml(input.place ? `${input.place.pathTitle} · Lesson ${input.place.number} of ${input.place.count}` : 'Paper Coach'),
      introTitle: `Let’s draw ${article ? `${article} ` : ''}<em>${escapeHtml(subject)}</em>`,
      outroTitle: 'Now draw it <em>yourself</em><small>One line at a time, at your own pace</small>',
      cta: escapeHtml(input.cta),
    },
  }
}

/** A step's lines and colours, one after another, at the lesson's pace. */
export function stepSeconds(step: Tutorial['steps'][number]): number {
  const strokes = step.strokes.reduce((sum, stroke) => sum + stroke.duration, 0)
  const fills = (step.fills ?? []).reduce((sum, fill) => sum + fill.duration, 0)
  return strokes + fills
}

/** A caption stays this long after Lina's last word of a recording, then the line clears while the drawing goes on. */
const LINGER = 1.2
/** A word stays lit this long after she finishes it, unless the next one starts first. */
const WORD_TAIL = 0.25

/**
 * A recording's words a few at a time on one line (`lineChunks`), each chunk
 * from its first word until the next chunk. The first shows from the start of
 * its part, so the words are there as Lina begins; the last stays a moment
 * after she stops, never past the part's end.
 */
export function captionsFor(clip: Clip, at: number, from: number, to: number): Caption[] {
  const words = (clip.words ?? estimateWords(clip.text, clip.durationS)).map((word) => ({ ...word, start: at + word.start, end: at + word.end }))
  const chunks = lineChunks(words)
  return chunks.map((chunk, index) => {
    const next = chunks[index + 1]
    const captionFrom = index === 0 ? Math.min(from, chunk[0].start) : chunk[0].start
    const captionTo = next ? next[0].start : Math.max(captionFrom, Math.min(to, chunk[chunk.length - 1].end + LINGER))
    return {
      text: chunk.map((word) => word.text).join(' '),
      from: captionFrom,
      to: captionTo,
      words: chunk.map((word, i) => {
        const following = chunk[i + 1]
        const lit = following ? Math.max(word.end, following.start) : word.end + WORD_TAIL
        return { text: word.text, from: word.start, to: Math.min(captionTo, Math.max(word.start, lit)) }
      }),
    }
  })
}

/** The most a line holds: it fits beside Lina's portrait at full size (72 px Fredoka is about 32 px a character). Four short words only when three would split badly. */
const MAX_WORDS = 4
const MAX_CHARS = 18
/** The length a line reads best at. */
const IDEAL_CHARS = 12
/** A pause this long in Lina's voice always starts a new line. */
const BREAK_PAUSE = 0.3
/** Words a line never ends on, since they belong to the word after them. */
const NEVER_LAST = new Set(['a', 'an', 'the', 'your', 'my', 'its', 'our', 'their', 'his', 'her'])
/** Words a line would rather not end on. */
const WEAK_LAST = new Set(['and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'into', 'onto', 'over', 'under', 'then', 'so', 'as', 'if', 'than', 'is', 'are'])

/**
 * Words cut into lines of two or three, never across a comma, a sentence's end
 * or a pause, and within that the cut that reads most naturally: lines near
 * twelve characters, no "a" or "the" left hanging at the end of one, and no
 * word alone on a line when it could have company.
 */
export function lineChunks<W extends { text: string; start: number; end: number }>(words: W[]): W[][] {
  // Phrases first: the hard breaks.
  const phrases: W[][] = []
  words.forEach((word, index) => {
    const before = words[index - 1]
    const breaks = !before || /[.!?,;:—–]["'’”)\]]*$/.test(before.text) || word.start - before.end >= BREAK_PAUSE
    if (breaks) phrases.push([word])
    else phrases[phrases.length - 1].push(word)
  })
  return phrases.flatMap((phrase) => {
    // best[i]: the cheapest way to cut the phrase's first i words, and where its last line starts.
    const best: { cost: number; from: number }[] = [{ cost: 0, from: 0 }]
    for (let end = 1; end <= phrase.length; end += 1) {
      best[end] = { cost: Number.POSITIVE_INFINITY, from: 0 }
      for (let start = Math.max(0, end - MAX_WORDS); start < end; start += 1) {
        const cost = best[start].cost + lineCost(phrase.slice(start, end), phrase.length, end === phrase.length)
        if (cost < best[end].cost) best[end] = { cost, from: start }
      }
    }
    const lines: W[][] = []
    for (let end = phrase.length; end > 0; end = best[end].from) lines.unshift(phrase.slice(best[end].from, end))
    return lines
  })
}

function lineCost(line: { text: string }[], phraseLength: number, endsPhrase: boolean): number {
  const chars = line.reduce((sum, word) => sum + word.text.length, 0) + line.length - 1
  if (line.length > 1 && chars > MAX_CHARS) return Number.POSITIVE_INFINITY
  const last = line[line.length - 1].text.toLowerCase().replace(/[’']/g, "'")
  let cost = ((chars - IDEAL_CHARS) / 5) ** 2
  if (!endsPhrase && NEVER_LAST.has(last)) cost += 10
  if (!endsPhrase && WEAK_LAST.has(last)) cost += 2
  if (line.length === 1 && phraseLength > 1) cost += 2
  if (line.length === 4) cost += 1.5
  return cost + 0.1
}

// ---------- Words ----------

/** Words kept as they are written when a title is lowered into a sentence. */
const PROPER_NOUNS = new Set(['Mars'])
/** Titles that are already plural, so they take no article: "Let's draw grapes." */
const PLURAL_WITHOUT_S = new Set(['dice'])

/**
 * A lesson's title as the object of "Let's draw …": lowered except for names
 * and acronyms, with "a" or "an" unless it is plural. "Watermelon Slice" is
 * "a watermelon slice", "Grapes" is "grapes", "UFO" is "a UFO", "Mars Rover"
 * is "a Mars rover".
 */
export function subjectOf(title: string): { article: 'a' | 'an' | ''; subject: string } {
  const words = title.trim().split(/\s+/)
  const subject = words
    .map((word) => (PROPER_NOUNS.has(word) || (word.length > 1 && word === word.toUpperCase()) ? word : word.toLowerCase()))
    .join(' ')
  // The head noun is the last word before "of", "with" or "over": a stack (of books), a planet (with rings).
  const cut = words.findIndex((word, index) => index > 0 && /^(of|with|over|in|on)$/i.test(word))
  const head = (cut > 0 ? words[cut - 1] : words[words.length - 1]).toLowerCase()
  const plural = PLURAL_WITHOUT_S.has(head) || (/s$/.test(head) && !/(ss|us|is)$/.test(head))
  if (plural) return { article: '', subject }
  return { article: startsWithVowelSound(subject) ? 'an' : 'a', subject }
}

function startsWithVowelSound(phrase: string): boolean {
  // "a UFO", "a unicorn", "a one-eyed…": a written vowel that sounds like "you" or "won".
  if (/^(u[bcdfgjklmnpqrstvwxyz][aeiou]|uni|use|usu|ufo|eu|one\b)/i.test(phrase)) return false
  return /^[aeiou]/i.test(phrase)
}

/** Lina's default opening line for a lesson. */
export function defaultIntro(title: string): string {
  const { article, subject } = subjectOf(title)
  return `Let’s draw ${article ? `${article} ` : ''}${subject}. Grab a pencil and draw along with me.`
}

/** A caption to post with the video: what it is, what the app does, and a few tags. */
export function postCaption(tutorial: Tutorial, place: VideoInput['place']): string {
  const { article, subject } = subjectOf(tutorial.title)
  const lines = tutorial.steps.filter((step) => step.strokes.length > 0).length
  const tags = ['#howtodraw', '#easydrawing', '#drawwithme', '#drawingtutorial', '#stepbystep', `#${tutorial.id.replace(/-/g, '')}`, '#papercoach']
  return [
    `Let’s draw ${article ? `${article} ` : ''}${subject}: ${lines} easy ${lines === 1 ? 'step' : 'steps'}, then color it in.`,
    place ? `Lesson ${place.number} of the ${place.pathTitle} path in Paper Coach.` : null,
    '',
    'Paper Coach shows one line at a time and waits while you draw it on real paper. Free on the App Store, link in bio.',
    '',
    tags.join(' '),
  ]
    .filter((line) => line !== null)
    .join('\n')
}

/** Moments worth looking at to check a render: the opening, a line being drawn, a colour going in, the ending. */
export function stillMoments(plan: VideoPlan, tutorial: Tutorial): { name: string; at: number }[] {
  const steps = plan.segments.filter((segment): segment is Extract<Segment, { kind: 'step' }> => segment.kind === 'step')
  const lineStep = steps.find((segment) => tutorial.steps[segment.index].strokes.length > 0)
  const colourStep = [...steps].reverse().find((segment) => (tutorial.steps[segment.index].fills ?? []).length > 0)
  const middle = (segment: Extract<Segment, { kind: 'step' }>) => segment.drawAt + stepSeconds(tutorial.steps[segment.index]) / 2
  const outro = plan.segments[plan.segments.length - 1]
  return [
    { name: 'opening', at: 0.2 },
    { name: 'opening-drawing', at: plan.hook.drawFrom + (plan.segments[0].end - plan.hook.drawFrom) / 2 },
    ...(lineStep ? [{ name: 'line', at: middle(lineStep) }] : []),
    ...(colourStep ? [{ name: 'colour', at: middle(colourStep) }] : []),
    { name: 'ending', at: plan.total - 0.5 },
  ].map((moment) => ({ ...moment, at: Math.min(Math.max(0, moment.at), outro.end - 0.05) }))
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)
}
