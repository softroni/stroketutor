import type { StepNarration } from '../../voice/types'

import { plural } from './format'

/**
 * What the narration table adds up to. The toolbar, the publish button and the
 * one-line status all read from this, so they can never disagree about how much
 * of a lesson is recorded.
 */
export interface NarrationSummary {
  total: number
  /** Recorded with the cast voice, from the words as they now stand. */
  ready: number
  /** Never recorded. */
  missing: number
  /** Recorded, but the words have been rewritten since. */
  textChanged: number
  /** Recorded by a voice that is no longer cast as Lina. */
  voiceChanged: number
  /** Everything that would have to be made before the lesson can be published. */
  needsWork: number
}

export function summariseSteps(steps: readonly StepNarration[]): NarrationSummary {
  const count = (stale: StepNarration['stale']) => steps.filter((step) => step.stale === stale).length
  const missing = count('missing')
  const textChanged = count('text-changed')
  const voiceChanged = count('voice-changed')
  return {
    total: steps.length,
    ready: count(null),
    missing,
    textChanged,
    voiceChanged,
    needsWork: missing + textChanged + voiceChanged,
  }
}

/** The steps "Narrate what's missing" would make, in the order they are spoken. */
export function stepsNeedingWork(steps: readonly StepNarration[]): string[] {
  return steps.filter((step) => step.stale !== null).map((step) => step.stepId)
}

/** The chip beside a step: what it says, and which colour it wears. */
export function describeStale(stale: StepNarration['stale']): { label: string; tone: 'ready' | 'todo' | 'changed' } {
  switch (stale) {
    case null:
      return { label: 'Ready', tone: 'ready' }
    case 'missing':
      return { label: 'Not yet', tone: 'todo' }
    case 'text-changed':
      return { label: 'Words changed', tone: 'changed' }
    case 'voice-changed':
      return { label: 'Voice changed', tone: 'changed' }
  }
}

/** The line under the table: where this lesson's narration stands, in a sentence. */
export function narrationHeadline(summary: NarrationSummary): string {
  if (summary.total === 0) return 'This lesson has no steps to narrate.'
  if (summary.needsWork === 0) return `All ${plural(summary.total, 'step')} recorded in the cast voice.`
  const parts: string[] = []
  if (summary.missing > 0) parts.push(`${summary.missing} not made yet`)
  if (summary.textChanged > 0) parts.push(`${summary.textChanged} with words changed`)
  if (summary.voiceChanged > 0) parts.push(`${summary.voiceChanged} in an older voice`)
  return `${summary.ready} of ${plural(summary.total, 'step')} ready · ${parts.join(', ')}.`
}

/**
 * Why "Publish voice" is off, or null when it is ready. The button says nothing
 * on its own; this sentence sits beside it, because a disabled button with no
 * reason is the most annoying thing a tool can do.
 */
export function publishBlocker(input: {
  summary: NarrationSummary
  /** True when the lesson itself is in `shared/`: audio can only ship beside a published lesson. */
  lessonPublished: boolean
  castVoiceId: string | null
}): string | null {
  if (!input.castVoiceId) return 'Cast a voice as Lina first.'
  if (input.summary.total === 0) return 'This lesson has no steps.'
  if (!input.lessonPublished) return 'Publish the lesson itself first, on the Publish page.'
  if (input.summary.needsWork > 0) {
    return `${plural(input.summary.needsWork, 'step')} still to make. Publishing takes the whole lesson at once.`
  }
  return null
}
