import { useEffect, useRef } from 'react'

const SHORTCUTS: [string, string][] = [
  ['↑ / ↓  or  K / J', 'Previous / next step'],
  ['Enter', 'Fold or unfold the active step'],
  ['Space', 'Replay the step'],
  ['⇧ Space', 'Replay the lesson'],
  ['− / +', 'Slower / faster replay, up to instant'],
  ['C', 'Colour by step on or off'],
  ['L', 'Lines only: hide the colour fills'],
  ['R', 'Reference photo underneath on or off'],
  ['P', 'Edit / Preview as learner'],
  ['Click, ⇧-click', 'Select strokes, add to the selection'],
  ['G', 'Group the selection into a new step'],
  ['M', 'Move the selection to a step'],
  ['⌫', 'Delete the selection'],
  ['Esc', 'Close the drawer, leave the replay, clear the selection'],
  ['[', 'Show or hide the reference'],
  ['⌘Z / ⇧⌘Z', 'Undo / redo'],
  ['⌘S', 'Keep this version in History'],
  ['?', 'This list'],
]

/** Every keyboard shortcut of the lesson workspace. */
export function ShortcutSheet({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => dialog?.close()
  }, [])

  return (
    <dialog
      ref={ref}
      className="st-dialog"
      aria-labelledby="st-shortcuts-heading"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="st-dialog__form">
        <h2 id="st-shortcuts-heading" className="st-dialog__title">
          Keyboard shortcuts
        </h2>
        <dl className="st-shortcuts">
          {SHORTCUTS.map(([keys, action]) => (
            <div key={keys} className="st-shortcuts__row">
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{action}</dd>
            </div>
          ))}
        </dl>
        <p className="st-field__hint">Edits save themselves into your workspace a moment after you stop.</p>
        <div className="st-dialog__actions">
          <button type="button" className="st-button st-button--primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </dialog>
  )
}
