import { estimateLearnerSeconds, formatMinutes } from '../catalog/metrics'
import { parsePath, type Point } from '../player/svgPath'
import { totalStrokes, type Tutorial } from '../schema/types'

import { NEW_STEP_INSTRUCTION, NEW_STEP_TITLE } from './editor/ops'

export type QualityCode =
  | 'long-lesson'
  | 'many-strokes'
  | 'tiny-strokes'
  | 'crowded-step'
  | 'placeholder-text'
  | 'complexity-jump'

export interface QualityWarning {
  code: QualityCode
  /** `(lesson)` for the whole lesson, otherwise a JSON path such as `steps[2].title`. */
  path: string
  message: string
}

/** The core promise: a finished drawing in about five minutes (§7). */
export const LESSON_TARGET_SECONDS = 5 * 60
/** Beyond this, a lesson is usually traced detail rather than drawing. */
export const MAX_STROKES = 40
/** More than this in one step is a lot to hold in mind at once. */
export const MAX_STROKES_PER_STEP = 6
/** A stroke shorter than this share of the canvas diagonal counts as tiny. */
export const TINY_STROKE_FRACTION = 0.02
/** Tiny strokes are flagged once there are at least this many… */
export const TINY_STROKE_MIN_COUNT = 3
/** …and they make up more than this share of the lesson. */
export const TINY_STROKE_SHARE = 0.25
/** How much bigger than the previous lesson in the path counts as a jump. */
export const COMPLEXITY_JUMP = 2

const LESSON = '(lesson)'

/**
 * Checks on top of strict validation (master plan §23): signs that a lesson is
 * drifting from "a few confident lines, finished in five minutes". They inform
 * approval and never block it — only the schema and the path grammar reject.
 *
 * `previous` is the lesson before this one in its path, when there is one.
 */
export function qualityWarnings(tutorial: Tutorial, previous?: Tutorial): QualityWarning[] {
  const warnings: QualityWarning[] = []
  const seconds = estimateLearnerSeconds(tutorial)
  const strokes = totalStrokes(tutorial)

  if (seconds > LESSON_TARGET_SECONDS) {
    warnings.push({
      code: 'long-lesson',
      path: LESSON,
      message: `Estimated at ${formatMinutes(seconds)} for a learner. Lessons aim for five minutes or less.`,
    })
  }

  if (strokes > MAX_STROKES) {
    warnings.push({
      code: 'many-strokes',
      path: LESSON,
      message: `${strokes} strokes. A count this high usually means traced detail rather than a drawable sketch.`,
    })
  }

  const { width, height } = tutorial.canvas
  const tinyLength = Math.hypot(width, height) * TINY_STROKE_FRACTION
  const tiny = tutorial.steps
    .flatMap((step) => step.strokes)
    .filter((stroke) => strokeLength(stroke.d) < tinyLength).length
  if (tiny >= TINY_STROKE_MIN_COUNT && tiny / strokes > TINY_STROKE_SHARE) {
    warnings.push({
      code: 'tiny-strokes',
      path: LESSON,
      message: `${tiny} of ${strokes} strokes are tiny. They are often texture or tracing artefacts a beginner does not need.`,
    })
  }

  tutorial.steps.forEach((step, index) => {
    if (step.strokes.length > MAX_STROKES_PER_STEP) {
      warnings.push({
        code: 'crowded-step',
        path: `steps[${index}]`,
        message: `"${step.title}" asks for ${step.strokes.length} strokes at once. Consider splitting it.`,
      })
    }
    if (step.title === NEW_STEP_TITLE || step.title.endsWith('(continued)')) {
      warnings.push({
        code: 'placeholder-text',
        path: `steps[${index}].title`,
        message: `Step ${index + 1} still has a placeholder title.`,
      })
    }
    if (step.instruction === NEW_STEP_INSTRUCTION) {
      warnings.push({
        code: 'placeholder-text',
        path: `steps[${index}].instruction`,
        message: `Step ${index + 1} still has a placeholder instruction.`,
      })
    }
  })

  if (previous) {
    // The previous lesson is already validated, so its paths parse.
    const secondsRatio = seconds / Math.max(1, estimateLearnerSeconds(previous))
    const strokeRatio = strokes / Math.max(1, totalStrokes(previous))
    const ratio = Math.max(secondsRatio, strokeRatio)
    if (ratio >= COMPLEXITY_JUMP) {
      warnings.push({
        code: 'complexity-jump',
        path: LESSON,
        message: `About ${ratio.toFixed(1)}× the previous lesson ("${previous.title}"). A path should rise gradually.`,
      })
    }
  }

  return warnings
}

/** Chords per curve when measuring; plenty for telling a tiny stroke from a real one. */
const CURVE_CHORDS = 24

/**
 * Length of a path from its geometry alone. `measurePathLength` asks the
 * browser and returns 0 without a DOM, but these checks also run in tests and
 * could run on the server, so lines are measured exactly and curves as short
 * chords. Only called on validated paths, which always parse.
 */
export function strokeLength(d: string): number {
  let length = 0
  let current: Point = { x: 0, y: 0 }
  let subpathStart = current

  for (const segment of parsePath(d)) {
    const from = current
    switch (segment.kind) {
      case 'move':
        current = subpathStart = segment.to
        break
      case 'line':
        length += distance(from, segment.to)
        current = segment.to
        break
      case 'close':
        length += distance(from, subpathStart)
        current = subpathStart
        break
      case 'quad':
        length += chordLength((t) => {
          const u = 1 - t
          return mix([from, segment.control, segment.end], [u * u, 2 * u * t, t * t])
        })
        current = segment.end
        break
      case 'cubic':
        length += chordLength((t) => {
          const u = 1 - t
          return mix(
            [from, segment.control1, segment.control2, segment.end],
            [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t],
          )
        })
        current = segment.end
        break
    }
  }
  return length
}

function chordLength(pointAt: (t: number) => Point): number {
  let total = 0
  let previous = pointAt(0)
  for (let i = 1; i <= CURVE_CHORDS; i += 1) {
    const next = pointAt(i / CURVE_CHORDS)
    total += distance(previous, next)
    previous = next
  }
  return total
}

function mix(points: Point[], weights: number[]): Point {
  return points.reduce(
    (sum, point, index) => ({ x: sum.x + point.x * weights[index], y: sum.y + point.y * weights[index] }),
    { x: 0, y: 0 },
  )
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}
