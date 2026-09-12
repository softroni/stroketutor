import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'

export interface ConfirmDialogProps {
  title: string
  children?: ReactNode
  confirmLabel: string
  busyLabel?: string
  tone?: 'primary' | 'danger'
  /** Text the creator must type first, for what is hard to undo. */
  typeToConfirm?: string
  /** Resolves when done; a thrown error is shown in the dialog, which stays open. */
  onConfirm: () => Promise<void> | void
  onClose: () => void
}

/**
 * The one confirmation for every destructive or publishing action: a modal
 * `<dialog>` that says exactly what will happen, keeps focus inside, closes
 * on Escape, and shows a failure instead of swallowing it.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busyLabel = 'Working…',
  tone = 'primary',
  typeToConfirm,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const headingId = useId()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    // showModal() focuses the first focusable element, whatever React's
    // autoFocus asked for, so focus is placed here: the field to type in,
    // else Cancel for what destroys something, else the action itself.
    ;(inputRef.current ?? (tone === 'danger' ? cancelRef.current : confirmRef.current))?.focus()
    return () => dialog?.close()
    // Focus is placed once, when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ready = !typeToConfirm || typed.trim() === typeToConfirm

  const confirm = async (event: FormEvent) => {
    event.preventDefault()
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={ref}
      className="st-dialog"
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <form className="st-dialog__form" onSubmit={confirm}>
        <h2 id={headingId} className="st-dialog__title">
          {title}
        </h2>
        {children ? <div className="st-dialog__body">{children}</div> : null}
        {typeToConfirm ? (
          <label className="st-field">
            <span className="st-field__label">
              Type <code>{typeToConfirm}</code> to confirm
            </span>
            <input
              ref={inputRef}
              className="st-field__input"
              value={typed}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setTyped(event.target.value)}
            />
          </label>
        ) : null}
        {error ? (
          <p className="st-notice st-notice--error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="st-dialog__actions">
          <button ref={cancelRef} type="button" className="st-button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="submit"
            className={`st-button ${tone === 'danger' ? 'st-button--danger-solid' : 'st-button--primary'}`}
            disabled={!ready || busy}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  )
}
