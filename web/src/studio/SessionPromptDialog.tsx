import { useEffect, useRef, useState } from 'react'

/** The prompt for a path's authoring session, to read over and copy. */
export function SessionPromptDialog({ title, prompt, onClose }: { title: string; prompt: string; onClose: () => void }) {
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
      aria-labelledby="st-session-prompt-heading"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="st-dialog__form">
        <h2 id="st-session-prompt-heading" className="st-dialog__title">
          Session prompt for {title}
        </h2>
        <p className="st-field__hint">
          Paste this into a new Claude Code session. It first writes the picture prompts for you to run in ChatGPT and
          waits; attach the pictures to the same session and it builds the lessons. Anything you change here is copied
          too.
        </p>
        <textarea
          ref={text}
          className="st-field__input st-session-prompt"
          defaultValue={prompt}
          spellCheck={false}
          aria-label="Session prompt"
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
