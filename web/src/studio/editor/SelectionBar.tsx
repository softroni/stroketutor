import type { RefObject } from 'react'

import type { Stroke } from '../../schema/types'

import type { EditableTutorial } from './ops'

export interface SelectionBarProps {
  doc: EditableTutorial
  /** The selected strokes' uids, in drawing order. */
  selected: string[]
  /** `key` coalesces consecutive edits of one field into a single undo step. */
  onUpdateStrokes: (patch: Partial<Pick<Stroke, 'duration' | 'lineWidth'>>, key: string) => void
  onGroup: () => void
  onMoveTo: (stepId: string) => void
  onDelete: () => void
  onReplay: () => void
  onClear: () => void
  /** Focused by the M shortcut. */
  moveRef: RefObject<HTMLSelectElement>
}

/**
 * What can be done with the selected strokes, floating over the drawing where
 * they were picked, so there is nothing to scroll to (master plan §18: group,
 * move to a step, retime, delete, replay).
 */
export function SelectionBar({
  doc,
  selected,
  onUpdateStrokes,
  onGroup,
  onMoveTo,
  onDelete,
  onReplay,
  onClear,
  moveRef,
}: SelectionBarProps) {
  const chosen = new Set(selected)
  const strokes = doc.steps.flatMap((step) => step.strokes.filter((stroke) => chosen.has(stroke.uid)))
  const key = selected.join(',')

  return (
    <div className="st-selection-bar" role="toolbar" aria-label="Selected strokes">
      <span className="st-selection-bar__count">
        {strokes.length} {strokes.length === 1 ? 'stroke' : 'strokes'}
      </span>
      <button type="button" className="st-button st-button--compact" onClick={onGroup} title="Group into a new step (G)">
        Group
      </button>
      <select
        ref={moveRef}
        className="st-field__input"
        value=""
        aria-label="Move the selection to a step (M)"
        onChange={(event) => {
          if (event.target.value) onMoveTo(event.target.value)
        }}
      >
        <option value="">Move to step…</option>
        {doc.steps.map((step, index) => (
          <option key={step.id} value={step.id}>
            {index + 1}. {step.title}
          </option>
        ))}
      </select>
      <NumberField
        label="Seconds"
        step={0.1}
        values={strokes.map((stroke) => stroke.duration)}
        onChange={(duration) => onUpdateStrokes({ duration }, `duration:${key}`)}
      />
      <NumberField
        label="Width"
        step={1}
        values={strokes.map((stroke) => stroke.lineWidth)}
        onChange={(lineWidth) => onUpdateStrokes({ lineWidth }, `lineWidth:${key}`)}
      />
      <button type="button" className="st-button st-button--compact" onClick={onReplay}>
        ▶ Replay
      </button>
      <button type="button" className="st-button st-button--compact st-button--danger" onClick={onDelete} title="Delete (⌫)">
        Delete
      </button>
      <button type="button" className="st-link-button" onClick={onClear} title="Clear the selection (Esc)">
        Clear
      </button>
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
    <label className="st-selection-bar__number">
      {label}
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
