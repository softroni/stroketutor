import type { Take, Voice } from '../../voice/types'

/**
 * The cache key of a recording, computed the same way the Studio server does:
 * `sha256` of the voice's settings together with the words.
 *
 * The page needs it to answer one question honestly — "is this line already
 * recorded for this voice?" — because matching on the words alone would keep
 * showing a recording made before the description was rewritten or the voice
 * was frozen. If the two ever drift apart the page simply shows "Make" for a
 * line that is in fact cached, and the server hands the cached take straight
 * back: a wasted click, never a wrong recording.
 */
export function takeKeySource(
  voice: Pick<Voice, 'engine' | 'instruct' | 'speaker' | 'frozen'>,
  text: string,
): string {
  return JSON.stringify({
    engine: voice.engine,
    instruct: voice.instruct,
    speaker: voice.speaker,
    frozen: voice.frozen?.referenceName ?? null,
    text,
  })
}

export async function takeHash(
  voice: Pick<Voice, 'engine' | 'instruct' | 'speaker' | 'frozen'>,
  text: string,
): Promise<string> {
  const bytes = new TextEncoder().encode(takeKeySource(voice, text))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Where a take is remembered: one voice saying one thing one way. */
export const takeSlot = (voiceId: string, textHash: string) => `${voiceId} ${textHash}`

/**
 * The generation queue's name for one piece of speech. Every place that asks
 * for a line and every place that asks whether one is being made must agree on
 * it, so it is written once, here.
 */
export const speechKey = (voiceId: string, text: string) => `say ${voiceId} ${text}`

/**
 * The newest take for each (voice, settings, words), from the flat list the
 * server sends. `takes` arrives newest first, so the first one seen wins.
 */
export function indexTakes(takes: readonly Take[]): Map<string, Take> {
  const bySlot = new Map<string, Take>()
  for (const take of takes) {
    const slot = takeSlot(take.voiceId, take.textHash)
    if (!bySlot.has(slot)) bySlot.set(slot, take)
  }
  return bySlot
}

/** Every take a voice has ready right now, newest first: what the freeze chooser offers. */
export function takesOfVoice(takes: readonly Take[], voiceId: string): Take[] {
  return takes.filter((take) => take.voiceId === voiceId)
}
