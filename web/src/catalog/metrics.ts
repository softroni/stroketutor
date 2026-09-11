import { totalDuration, type Tutorial } from '../schema/types'

/**
 * How much slower than the animation a beginner copies a stroke onto paper.
 * A placeholder until real lessons are timed in M6.
 */
export const COPY_TIME_FACTOR = 2

/** Reading a step's instruction and tapping "I drew it". Also a placeholder. */
export const SECONDS_PER_STEP = 8

/**
 * Rough time a learner spends on a lesson, for the path view (§15) and the
 * five-minute target (§23).
 *
 * Only the animation time is actually known. The learner watches each stroke,
 * copies it at beginner speed, then reads and confirms each step.
 */
export function estimateLearnerSeconds(tutorial: Tutorial): number {
  const animation = totalDuration(tutorial)
  return animation * (1 + COPY_TIME_FACTOR) + tutorial.steps.length * SECONDS_PER_STEP
}

export function formatMinutes(seconds: number): string {
  if (seconds < 60) return 'under 1 min'
  return `about ${Math.round(seconds / 60)} min`
}
