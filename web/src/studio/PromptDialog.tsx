import { useEffect, useRef, useState } from 'react'

/**
 * A prompt to read over and copy: a path's session prompt for Claude Code, or a
 * level's system prompt for the image model.
 */
export function PromptDialog({
  heading,
  hint,
  prompt,
  onClose,
}: {
  heading: string
  hint: string
  prompt: string
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const text = useRef<HTMLTextAreaElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => dialog?.close()
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text.current?.value ?? prompt)
    } catch {
      // No clipboard permission: leave the text selected, so ⌘C takes it.
      text.current?.select()
      return
    }
    setCopied(true)
  }

  return (
    <dialog
      ref={ref}
      className="st-dialog st-dialog--wide"
      aria-labelledby="st-prompt-heading"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="st-dialog__form">
        <h2 id="st-prompt-heading" className="st-dialog__title">
          {heading}
        </h2>
        <p className="st-field__hint">{hint} Anything you change here is copied too.</p>
        <textarea
          ref={text}
          className="st-field__input st-prompt-text"
          defaultValue={prompt}
          spellCheck={false}
          aria-label={heading}
          onChange={() => setCopied(false)}
        />
        <div className="st-dialog__actions">
          <button type="button" className="st-button" onClick={onClose}>
            Close
          </button>
          <button type="button" className="st-button st-button--primary" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
