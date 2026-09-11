import { useMemo } from 'react'

import { StrokeCanvas } from '../player/StrokeCanvas'
import { fillsOfStep, strokesOfStep } from '../player/TutorialPlayer'
import { resolveStyle, type Tutorial } from '../schema/types'

export interface FinishedDrawingProps {
  tutorial: Tutorial
  className?: string
}

/**
 * Every stroke and fill of a tutorial drawn whole: the lesson's final illustration.
 *
 * There is deliberately no separate final artwork (master plan §17). What the
 * Studio shows here is exactly the last frame the learner's player reaches.
 */
export function FinishedDrawing({ tutorial, className = 'st-thumb' }: FinishedDrawingProps) {
  const style = useMemo(() => resolveStyle(tutorial.style), [tutorial.style])
  const { strokes, fills } = useMemo(
    () => ({
      strokes: tutorial.steps.flatMap((_, stepIndex) => strokesOfStep(tutorial, stepIndex)),
      fills: tutorial.steps.flatMap((_, stepIndex) => fillsOfStep(tutorial, stepIndex)),
    }),
    [tutorial],
  )

  return (
    <StrokeCanvas
      className={className}
      canvas={tutorial.canvas}
      strokeColor={style.strokeColor}
      backgroundColor={style.backgroundColor}
      strokes={strokes}
      fills={fills}
      activeIndex={strokes.length + fills.length}
      activeProgress={1}
      showPencil={false}
      title={`${tutorial.title}, finished drawing`}
    />
  )
}
