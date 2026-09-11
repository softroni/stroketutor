import { totalFills, totalStrokes, type Tutorial } from '../schema/types'

import { FinishedDrawing } from './FinishedDrawing'

/** Whether step `index` differs from the step in the same place of `against`. */
function stepDiffers(tutorial: Tutorial, against: Tutorial, index: number): boolean {
  return JSON.stringify(tutorial.steps[index]) !== JSON.stringify(against.steps[index])
}

/** How many steps of `tutorial` differ from the step in the same place of `against`. */
export function changedSteps(tutorial: Tutorial, against: Tutorial | undefined): number {
  if (!against) return tutorial.steps.length
  return tutorial.steps.filter((_, index) => stepDiffers(tutorial, against, index)).length
}

/**
 * One version of a lesson: its finished drawing and its steps, marking those
 * that differ from `against`. Two side by side make a comparison.
 */
export function Version({ heading, tutorial, against }: { heading: string; tutorial: Tutorial; against?: Tutorial }) {
  const fills = totalFills(tutorial)
  return (
    <div className="st-candidate__side">
      <h3 className="st-label">{heading}</h3>
      <div
        className="st-candidate__drawing"
        style={{ aspectRatio: `${tutorial.canvas.width} / ${tutorial.canvas.height}` }}
      >
        <FinishedDrawing tutorial={tutorial} className="st-canvas" />
      </div>
      <p className="st-field__hint">
        {tutorial.steps.length} steps · {totalStrokes(tutorial)} lines{fills > 0 ? ` · ${fills} colours` : ''}
      </p>
      <ol className="st-candidate__steps">
        {tutorial.steps.map((step, index) => (
          <li key={`${step.id}-${index}`}>
            <strong>{step.title}</strong>
            {against && stepDiffers(tutorial, against, index) ? <span className="st-changed">changed</span> : null}{' '}
            — {step.instruction}{' '}
            <span className="st-regenerate__count">
              ({step.strokes.length} {step.strokes.length === 1 ? 'line' : 'lines'}
              {step.fills?.length ? `, ${step.fills.length} ${step.fills.length === 1 ? 'colour' : 'colours'}` : ''})
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
