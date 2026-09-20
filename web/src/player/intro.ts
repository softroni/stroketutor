import type { Tutorial } from '../schema/types'

import { stepDurations } from './usePlayback'

/** What the intro shows at one moment. */
export type IntroFrame =
  /** The finished drawing, whole: this is what we are going to make. */
  | { stage: 'goal' }
  /** The drawing coming together: `stepIndex` is being drawn, `itemIndex` and `progress` say how far through it. */
  | { stage: 'build'; stepIndex: number; itemIndex: number; progress: number }
  /** The finished drawing again, waiting for "I'm ready". */
  | { stage: 'rest' }

/** How long the intro runs when nothing is spoken over it: a little longer for a lesson with more steps. */
export function introSeconds(tutorial: Tutorial): number {
  return Math.min(14, Math.max(8, 5 + tutorial.steps.length * 0.6))
}

/**
 * The intro's timeline, `elapsed` seconds into `total`: a look at the finished
 * drawing, then every step drawn quickly in order, then the whole drawing
 * again. A step's share of the build is its share of the lesson's animation
 * time, so the quick version has the rhythm of the real one, and a lesson's
 * spoken intro can set `total` to its own length and never be out of step.
 */
export function introFrame(tutorial: Tutorial, elapsed: number, total: number): IntroFrame {
  const goal = Math.min(2.5, total * 0.22)
  const rest = Math.min(1.5, total * 0.12)
  if (elapsed < goal) return { stage: 'goal' }
  const build = total - goal - rest
  const steps = tutorial.steps.map((step) => stepDurations(step))
  const whole = steps.flat().reduce((sum, duration) => sum + duration, 0)
  if (elapsed >= total - rest || build <= 0 || whole <= 0) return { stage: 'rest' }

  let at = ((elapsed - goal) / build) * whole
  for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    for (let itemIndex = 0; itemIndex < steps[stepIndex].length; itemIndex += 1) {
      const duration = steps[stepIndex][itemIndex]
      if (at < duration) return { stage: 'build', stepIndex, itemIndex, progress: duration > 0 ? at / duration : 1 }
      at -= duration
    }
  }
  return { stage: 'rest' }
}
