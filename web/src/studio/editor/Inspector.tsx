import type { Step, Stroke } from '../../schema/types'

import type { EditableTutorial } from './ops'
import './editor.css'

export interface InspectorProps {
  doc: EditableTutorial
  selection: ReadonlySet<string>
  activeStepIndex: number
  /** `key` coalesces consecutive edits of one field into a single undo step. */
  onUpdateStep: (
    stepIndex: number,
    patch: Partial<Pick<Step, 'title' | 'instruction'>>,
    key: string,
  ) => void
  onUpdateStrokes: (patch: Partial<Pick<Stroke, 'duration' | 'lineWidth'>>, key: string) => void
  onGroup: () => void
  onMoveTo: (stepId: string) => void
  onDelete: () => void
  onReplaySelection: () => void
  onClearSelection: () => void
}

/**
 * The words of the active step, and what can be done with the selected strokes.
 * Values are applied as typed; strict validation reports anything a player
 * would refuse, so there is no separate "apply" step to forget.
 */
export function Inspector({
  doc,
  selection,
  activeStepIndex,
  onUpdateStep,
  onUpdateStrokes,
  onGroup,
  onMoveTo,
  onDelete,
  onReplaySelection,
  onClearSelection,
}: InspectorProps) {
  const step = doc.steps[Math.min(activeStepIndex, doc.steps.length - 1)]
  const stepIndex = doc.steps.indexOf(step)
  const selected = doc.steps.flatMap((candidate) =>
    candidate.strokes.filter((stroke) => selection.has(stroke.uid)),
  )
  const selectionKey = selected.map((stroke) => stroke.uid).join(',')

  return (
    <div className="st-inspector-panel">
      <section className="st-inspector-panel__column" aria-labelledby="st-step-fields">
        <h3 id="st-step-fields" className="st-label">
          Step {stepIndex + 1}
        </h3>
        <label className="st-field">
          <span className="st-field__label">Title</span>
          <input
            className="st-field__input"
            value={step.title}
            onChange={(event) =>
              onUpdateStep(stepIndex, { title: event.target.value }, `title:${step.id}`)
            }
          />
        </label>
        <label className="st-field">
          <span className="st-field__label">Instruction</span>
          <textarea
            className="st-field__input st-field__input--long"
            value={step.instruction}
            onChange={(event) =>
              onUpdateStep(stepIndex, { instruction: event.target.value }, `instruction:${step.id}`)
            }
          />
          <span className="st-field__hint">
            Concise, calm and observational. Say what to notice, not just what to draw.
          </span>
        </label>
      </section>

      <section className="st-inspector-panel__column" aria-labelledby="st-selection-fields">
        <h3 id="st-selection-fields" className="st-label">
          {selected.length === 0
            ? 'Selection'
            : `${selected.length} ${selected.length === 1 ? 'stroke' : 'strokes'} selected`}
        </h3>
        {selected.length === 0 ? (
          <p className="st-field__hint">
            Click strokes on the drawing or in the step list to select them. Shift-click adds to the
            selection.
          </p>
        ) : (
          <>
            <div className="st-inspector-panel__numbers">
              <NumberField
                label="Duration (s)"
                step={0.1}
                values={selected.map((stroke) => stroke.duration)}
                onChange={(duration) => onUpdateStrokes({ duration }, `duration:${selectionKey}`)}
              />
              <NumberField
                label="Line width"
                step={1}
                values={selected.map((stroke) => stroke.lineWidth)}
                onChange={(lineWidth) => onUpdateStrokes({ lineWidth }, `lineWidth:${selectionKey}`)}
              />
            </div>
            <div className="st-inspector-panel__actions">
              <button type="button" className="st-button" onClick={onGroup}>
                Group into new step
              </button>
              <select
                className="st-field__input st-field__select"
                value=""
                aria-label="Move the selection to a step"
                onChange={(event) => {
                  if (event.target.value) onMoveTo(event.target.value)
                }}
              >
                <option value="">Move to step…</option>
                {doc.steps.map((candidate, index) => (
                  <option key={candidate.id} value={candidate.id}>
                    {index + 1}. {candidate.title}
                  </option>
                ))}
              </select>
              <button type="button" className="st-button" onClick={onReplaySelection}>
                ▶ Replay
              </button>
              <button type="button" className="st-button st-button--danger" onClick={onDelete}>
                Delete
              </button>
              <button type="button" className="st-link-button" onClick={onClearSelection}>
                Clear selection
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

/** One number for many strokes: shows the shared value, or blank when they differ. */
function NumberField({
  label,
  step,
  values,
  onChange,
}: {
  label: string
  step: number
  values: number[]
  onChange: (value: number) => void
}) {
  const shared = values.every((value) => value === values[0]) ? values[0] : null
  return (
    <label className="st-field">
      <span className="st-field__label">{label}</span>
      <input
        className="st-field__input"
        type="number"
        step={step}
        value={shared ?? ''}
        placeholder={shared === null ? 'mixed' : undefined}
        onChange={(event) => {
          const value = event.target.valueAsNumber
          if (Number.isFinite(value)) onChange(value)
        }}
      />
    </label>
  )
}
