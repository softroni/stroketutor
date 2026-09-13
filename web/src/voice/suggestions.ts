import type { ScriptLine, VoiceInput } from './types'

/**
 * What the Voice page starts with: a few candidate voices for Lina and the
 * lines they all read, so the first visit is a bake-off rather than an empty
 * form. The workspace writes these once (`meta voice.seeded`); after that they
 * are the creator's to edit or delete, and a deleted one does not come back.
 *
 * They live beside the contract rather than in the server so the page can
 * offer "Reset to suggested" without asking for them.
 *
 * The brief (`docs/ios-design/src/v3/BRIEF.md`): Lina is an adult artist,
 * warm, unhurried and genuinely glad to teach. Every description says what she
 * is like, not what to say.
 */

/** A suggested voice: a `VoiceInput` with the id it is stored under. */
export interface SuggestedVoice extends VoiceInput {
  id: string
}

export const SUGGESTED_VOICES: SuggestedVoice[] = [
  {
    id: 'lina-bright',
    name: 'Lina, bright',
    tagline: 'Warm and genuinely excited to teach you',
    engine: 'qwen-design',
    instruct:
      'A warm, bright woman around thirty, an art teacher who is genuinely excited to show you how to draw. Friendly and encouraging, smiling as she speaks, clear diction, a little playful, never rushed.',
  },
  {
    id: 'lina-studio',
    name: 'Lina, unhurried',
    tagline: 'A quiet studio, a kind teacher at your shoulder',
    engine: 'qwen-design',
    instruct:
      'A warm woman in her late thirties with a low, unhurried voice, like a favourite teacher in a quiet studio. Kind and precise, quietly delighted when a line goes right.',
  },
  {
    id: 'lina-spark',
    name: 'Lina, spark',
    tagline: 'Upbeat, quick to encourage',
    engine: 'qwen-custom',
    speaker: 'Vivian',
    instruct:
      'Bright, upbeat and encouraging, with real enthusiasm, as if delighted to teach a friend to draw. Clear and warm, not rushed.',
  },
  {
    id: 'lina-serena',
    name: 'Lina, gentle',
    tagline: 'Soft, steady, smiling',
    engine: 'qwen-custom',
    speaker: 'Serena',
    instruct:
      'Warm, gentle and encouraging, unhurried, smiling as she speaks, with a little sparkle when something goes right.',
  },
  {
    id: 'house-chatterbox',
    name: 'House voice',
    tagline: 'Chatterbox Turbo, fast and steady, no styling',
    engine: 'chatterbox',
    instruct: '',
  },
]

/**
 * The audition script: one line from each place Lina is heard, so the voices
 * are compared on the same words. Changing a line never deletes a recording —
 * takes are keyed by their text, not by the line they came from.
 */
export const SUGGESTED_SCRIPT: ScriptLine[] = [
  {
    id: 'hello',
    label: 'Hello',
    text: "Hi, I'm Lina. I'll talk you through every stroke while you draw on paper. Ready? Let's start with something simple.",
  },
  {
    id: 'step',
    label: 'A step',
    text: 'Begin at the bottom left of the trunk, near the sand, and draw one long line curving up and slightly to the right, stopping just under the middle of the page.',
  },
  {
    id: 'wobble',
    label: 'Encouragement',
    text: "Don't worry if it wobbles. A wobbly line is just a hand learning something new.",
  },
  { id: 'done', label: 'Finished', text: "And that's the whole palm tree. Look at that. You drew it." },
]
