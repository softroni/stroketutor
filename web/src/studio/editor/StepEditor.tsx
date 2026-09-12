import { useEffect, useRef, useState } from 'react'

import { cssColor, stepDuration, type Step } from '../../schema/types'

import { stepColor } from './EditCanvas'
import type { EditableTutorial } from './ops'
import './editor.css'

export interface StepEditorProps {
  doc: EditableTutorial
  selection: ReadonlySet<string>
  activeStepIndex: number
  onActivateStep: (stepIndex: number) => void
  /** `additive` is a shift/⌘/ctrl click, which toggles instead of replacing. */
  onPickStroke: (uid: string, additive: boolean) => void
  onReorderSteps: (from: number, to: number) => void
  onReorderStroke: (stepIndex: number, from: number, to: number) => void
  onSplit: (stepIndex: number, atStrokeIndex: number) => void
  onMergeWithNext: (stepIndex: number) => void
  onReplay: (uids: string[]) => void
  /** `key` coalesces consecutive edits of one field into a single undo step. */
  onUpdateStep: (stepIndex: number, patch: Partial<Pick<Step, 'title' | 'instruction'>>, key: string) => void
}

const STEP_DRAG_TYPE = 'application/x-stroketutor-step'

/**
 * The teaching structure, editable (§18). Every step is one compact line with
 * its instruction underneath; the active step opens in place, with its title,
 * instruction and strokes, so words are edited next to the drawing they
 * describe. Every control is a button, so the whole structure can be edited
 * from the keyboard; dragging a step is a shortcut, not the only way.
 */
export function StepEditor({
  doc,
  selection,
  activeStepIndex,
  onActivateStep,
  onPickStroke,
  onReorderSteps,
  onReorderStroke,
  onSplit,
  onMergeWithNext,
  onReplay,
  onUpdateStep,
}: StepEditorProps) {
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const activeRef = useRef<HTMLLIElement>(null)
  const lastStep = doc.steps.length - 1

  // Picking a stroke on the drawing opens its step here; keep it in view.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeStepIndex])

  return (
    <ol className="st-step-editor">
      {doc.steps.map((step, stepIndex) => {
        const seconds = stepDuration(step)
        const fills = step.fills ?? []
        const active = stepIndex === activeStepIndex
        const selectedHere = step.strokes.filter((stroke) => selection.has(stroke.uid)).length
        return (
          <li
            key={step.id}
            ref={active ? activeRef : undefined}
            className={`st-step-card ${active ? 'is-active' : ''} ${dropIndex === stepIndex ? 'is-drop-target' : ''}`}
            draggable={!active}
            onDragStart={(event) => {
              event.dataTransfer.setData(STEP_DRAG_TYPE, String(stepIndex))
              event.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes(STEP_DRAG_TYPE)) return
              event.preventDefault()
              setDropIndex(stepIndex)
            }}
            onDragLeave={() => setDropIndex((current) => (current === stepIndex ? null : current))}
            onDrop={(event) => {
              setDropIndex(null)
              const from = Number(event.dataTransfer.getData(STEP_DRAG_TYPE))
              if (!Number.isInteger(from)) return
              event.preventDefault()
              onReorderSteps(from, stepIndex)
            }}
            onDragEnd={() => setDropIndex(null)}
          >
            <div className="st-step-card__head">
              <span className="st-step-card__swatch" style={{ background: stepColor(stepIndex) }} aria-hidden="true" />
              <button
                type="button"
                className="st-step-card__title"
                aria-expanded={active}
                onClick={() => onActivateStep(stepIndex)}
              >
                <span className="st-step-card__number">{stepIndex + 1}</span>
                <span className="st-step-card__name">{step.title}</span>
              </button>
              <span className="st-step-card__meta">
                {selectedHere > 0 ? <span className="st-step-card__selected">{selectedHere} selected · </span> : null}
                {step.strokes.length}
                {fills.length > 0 ? ` + ${fills.length}` : ''} · {seconds.toFixed(1)}s
              </span>
            </div>

            {!active ? (
              <p className="st-step-card__preview" onClick={() => onActivateStep(stepIndex)}>
                {step.instruction}
              </p>
            ) : (
              <div className="st-step-card__body">
                <label className="st-field">
                  <span className="st-field__label">Title</span>
                  <input
                    className="st-field__input"
                    value={step.title}
                    onChange={(event) => onUpdateStep(stepIndex, { title: event.target.value }, `title:${step.id}`)}
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

                <ul className="st-step-card__strokes">
                  {step.strokes.map((stroke, strokeIndex) => {
                    const selected = selection.has(stroke.uid)
                    return (
                      <li key={stroke.uid} className="st-stroke-row">
                        {strokeIndex > 0 ? (
                          <button
                            type="button"
                            className="st-stroke-row__split"
                            onClick={() => onSplit(stepIndex, strokeIndex)}
                            aria-label={`split here: start a new step at stroke ${strokeIndex + 1}`}
                          >
                            split here
                          </button>
                        ) : null}
                        <div className="st-stroke-row__line">
                          <button
                            type="button"
                            className={`st-stroke-row__pick ${selected ? 'is-selected' : ''}`}
                            aria-pressed={selected}
                            onClick={(event) =>
                              onPickStroke(stroke.uid, event.shiftKey || event.metaKey || event.ctrlKey)
                            }
                          >
                            Stroke {strokeIndex + 1}
                            <span className="st-stroke-row__meta">
                              {stroke.duration}s · width {stroke.lineWidth}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="st-mini-button"
                            aria-label={`Replay stroke ${strokeIndex + 1} of ${step.title}`}
                            onClick={() => onReplay([stroke.uid])}
                          >
                            ▶
                          </button>
                          <button
                            type="button"
                            className="st-mini-button"
                            aria-label={`Draw stroke ${strokeIndex + 1} earlier`}
                            disabled={strokeIndex === 0}
                            onClick={() => onReorderStroke(stepIndex, strokeIndex, strokeIndex - 1)}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="st-mini-button"
                            aria-label={`Draw stroke ${strokeIndex + 1} later`}
                            disabled={strokeIndex === step.strokes.length - 1}
                            onClick={() => onReorderStroke(stepIndex, strokeIndex, strokeIndex + 1)}
                          >
                            ↓
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>

                {fills.length > 0 ? (
                  <p className="st-stroke-row__meta st-step-card__fills">
                    {step.strokes.length > 0 ? 'Then colours' : 'Colours'} {fills.length}{' '}
                    {fills.length === 1 ? 'shape' : 'shapes'}
                    {fills.map((fill, fillIndex) => (
                      <span
                        key={fillIndex}
                        className="st-step-card__fill"
                        aria-hidden="true"
                        style={{ background: cssColor(fill.color) }}
                      />
                    ))}
                  </p>
                ) : null}

                <div className="st-step-card__actions">
                  <button
                    type="button"
                    className="st-link-button"
                    onClick={() => onReplay(step.strokes.map((stroke) => stroke.uid))}
                  >
                    ▶ Replay step
                  </button>
                  <button
                    type="button"
                    className="st-link-button"
                    disabled={stepIndex === lastStep}
                    onClick={() => onMergeWithNext(stepIndex)}
                  >
                    Merge with next
                  </button>
                  <span className="st-step-card__order">
                    <button
                      type="button"
                      className="st-mini-button"
                      aria-label={`Move step ${stepIndex + 1} earlier`}
                      disabled={stepIndex === 0}
                      onClick={() => onReorderSteps(stepIndex, stepIndex - 1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="st-mini-button"
                      aria-label={`Move step ${stepIndex + 1} later`}
                      disabled={stepIndex === lastStep}
                      onClick={() => onReorderSteps(stepIndex, stepIndex + 1)}
                    >
                      ↓
                    </button>
                  </span>
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
