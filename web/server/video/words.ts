import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

/**
 * When Lina says each word of a recording, so the video's captions can show a
 * few words at a time and light up the one she is saying.
 *
 * The words shown are always the script's, as written. Whisper (openai-whisper,
 * `brew install openai-whisper`) only says when they were heard: its words are
 * lined up with the script's, and any it heard differently ("4" for "four", a
 * hyphen split in two) take their share of the time between their neighbours.
 * A recording is heard once and remembered by its take id, since a take never
 * changes. Without Whisper the times are estimated from the words' lengths, and
 * the video is still made.
 */

/** One word of the script, `start` and `end` in seconds from the start of its recording. */
export interface TimedWord {
  text: string
  start: number
  end: number
}

/** A word as Whisper heard it. */
export interface HeardWord {
  word: string
  start: number
  end: number
}

/** Small and quick, and good enough for timing words whose text is already known. */
export const WHISPER_MODEL = 'base.en'

/** The script's words, split at spaces, with a lone dash or ellipsis kept on the word before it. */
export function scriptWords(text: string): string[] {
  const words: string[] = []
  for (const token of text.trim().split(/\s+/).filter(Boolean)) {
    if (normalise(token) === '' && words.length > 0) words[words.length - 1] += ` ${token}`
    else words.push(token)
  }
  return words
}

/**
 * The script's words timed by Whisper's: the longest run of words both agree
 * on keeps Whisper's times, and every other script word shares the gap it sits
 * in by length. Null when nothing lines up, so the caller can estimate instead.
 */
export function alignWords(text: string, heard: HeardWord[], durationS: number): TimedWord[] | null {
  const words = scriptWords(text)
  const a = words.map(normalise)
  const b = heard.map((word) => normalise(word.word))
  // Longest common subsequence, filled from the end so the walk below goes forwards.
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] !== '' && a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const match = new Array<HeardWord | null>(words.length).fill(null)
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] !== '' && a[i] === b[j]) {
      match[i] = heard[j]
      i += 1
      j += 1
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      i += 1
    } else {
      j += 1
    }
  }
  if (!match.some(Boolean)) return null

  const timed: TimedWord[] = words.map((word, index) => ({
    text: word,
    start: match[index]?.start ?? Number.NaN,
    end: match[index]?.end ?? Number.NaN,
  }))
  // Each run of unmatched words fills the time between the matched words around it.
  for (let i = 0; i < timed.length; ) {
    if (!Number.isNaN(timed[i].start)) {
      i += 1
      continue
    }
    let j = i
    while (j < timed.length && Number.isNaN(timed[j].start)) j += 1
    const from = i > 0 ? timed[i - 1].end : 0
    const to = j < timed.length ? timed[j].start : Math.max(from, Math.min(durationS, (heard[heard.length - 1]?.end ?? durationS) + 0.3))
    spread(timed.slice(i, j), from, to)
    i = j
  }
  return timed
}

/**
 * Times for a recording nobody has listened to: its length shared out by each
 * word's letters, with a breath after a comma and a longer one after a sentence.
 */
export function estimateWords(text: string, durationS: number): TimedWord[] {
  const words = scriptWords(text)
  const weights = words.map((word) => letters(word))
  const pauses = words.map((word, index) => (index === words.length - 1 ? 0 : /[.!?]["'’”)\]]*$/.test(word) ? 6 : /[,;:—–]$/.test(word) ? 3 : 0))
  const total = weights.reduce((sum, weight, index) => sum + weight + pauses[index], 0) || 1
  const unit = durationS / total
  let at = 0
  return words.map((word, index) => {
    const start = at
    const end = start + weights[index] * unit
    at = end + pauses[index] * unit
    return { text: word, start, end }
  })
}

function spread(words: TimedWord[], from: number, to: number) {
  const total = words.reduce((sum, word) => sum + letters(word.text), 0) || 1
  let at = from
  for (const word of words) {
    word.start = at
    at += ((to - from) * letters(word.text)) / total
    word.end = at
  }
}

const letters = (word: string) => Math.max(2, normalise(word).length)

/** Lower case, curly apostrophes straightened, and nothing but letters, digits and apostrophes. */
function normalise(word: string): string {
  return word
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9']/g, '')
    .replace(/^'+|'+$/g, '')
}

// ---------- Listening ----------

export interface Recording {
  /** The take's id, which never changes, so what was heard in it is remembered by it. */
  takeId: string
  /** The recording as a file Whisper can read; its name without the extension must be unique. */
  file: string
}

/**
 * What Whisper heard in each recording, by take id: from the cache in
 * `cacheDir`, and for the rest from one Whisper run over all of them, which is
 * then cached. A recording Whisper couldn't hear (not installed, or it failed)
 * is left out, and `problem` says why.
 */
export async function hearRecordings(
  recordings: Recording[],
  { cacheDir, work, whisper = process.env.STUDIO_WHISPER || 'whisper' }: { cacheDir: string; work: string; whisper?: string },
): Promise<{ heard: Map<string, HeardWord[]>; problem: string | null }> {
  const heard = new Map<string, HeardWord[]>()
  const cacheFile = (takeId: string) => path.join(cacheDir, `${takeId.replace(/[^\w.-]/g, '_')}.json`)
  const unheard: Recording[] = []
  for (const recording of recordings) {
    const cached = await readFile(cacheFile(recording.takeId), 'utf8').then(
      (text) => JSON.parse(text) as { model: string; words: HeardWord[] },
      () => null,
    )
    if (cached?.model === WHISPER_MODEL) heard.set(recording.takeId, cached.words)
    else unheard.push(recording)
  }
  if (unheard.length === 0) return { heard, problem: null }

  const out = path.join(work, 'whisper')
  await mkdir(out, { recursive: true })
  try {
    await promisify(execFile)(
      whisper,
      [
        ...unheard.map((recording) => recording.file),
        '--model', WHISPER_MODEL, '--language', 'en', '--word_timestamps', 'True',
        '--output_format', 'json', '--output_dir', out, '--fp16', 'False', '--verbose', 'False',
      ],
      { maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60 * 1000 },
    )
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stderr?: string }
    const problem =
      failure.code === 'ENOENT'
        ? 'Whisper isn’t installed (brew install openai-whisper), so the captions’ word timing is estimated.'
        : `Whisper couldn’t listen to Lina’s recordings, so the captions’ word timing is estimated: ${(failure.stderr || failure.message).trim().split('\n').pop()}`
    return { heard, problem }
  }

  await mkdir(cacheDir, { recursive: true })
  let missed = 0
  for (const recording of unheard) {
    const result = await readFile(path.join(out, `${path.parse(recording.file).name}.json`), 'utf8').then(
      (text) => JSON.parse(text) as { segments?: { words?: HeardWord[] }[] },
      () => null,
    )
    if (!result) {
      missed += 1
      continue
    }
    const words = (result.segments ?? []).flatMap((segment) => segment.words ?? []).map(({ word, start, end }) => ({ word: word.trim(), start, end }))
    heard.set(recording.takeId, words)
    await writeFile(cacheFile(recording.takeId), `${JSON.stringify({ model: WHISPER_MODEL, words })}\n`)
  }
  return { heard, problem: missed > 0 ? `Whisper gave nothing for ${missed} of Lina’s recordings; their word timing is estimated.` : null }
}
