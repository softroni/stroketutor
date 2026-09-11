import { useMemo } from 'react'

import { StrokeCanvas, type RenderStroke } from '../player/StrokeCanvas'
import { resolveStyle, type Tutorial } from '../schema/types'

export interface FinishedDrawingProps {
  tutorial: Tutorial
  className?: string
}

/**
 * Every stroke of a tutorial drawn whole: the lesson's final illustration.
 *
 * There is deliberately no separate final artwork (master plan §17). What the
 * Studio shows here is exactly the last frame the learner's player reaches.
 */
export function FinishedDrawing({ tutorial, className = 'st-thumb' }: FinishedDrawingProps) {
  const style = useMemo(() => resolveStyle(tutorial.style), [tutorial.style])
  const strokes = useMemo<RenderStroke[]>(
    () =>
      tutorial.steps.flatMap((step, stepIndex) =>
        step.strokes.map((stroke, strokeIndex) => ({
          key: `${stepIndex}:${strokeIndex}`,
          d: stroke.d,
          lineWidth: stroke.lineWidth,
        })),
      ),
    [tutorial],
  )

  return (
    <StrokeCanvas
      className={className}
      canvas={tutorial.canvas}
      strokeColor={style.strokeColor}
      backgroundColor={style.backgroundColor}
      strokes={strokes}
      activeIndex={strokes.length}
      activeProgress={1}
      showPencil={false}
      title={`${tutorial.title}, finished drawing`}
    />
  )
}
