import { useCallback, useEffect, useRef, useState } from 'react'

import { SAMPLES } from '../samples'
import type { ValidationIssue } from '../schema/validate'

export interface TutorialSourceProps {
  /** Hands raw JSON text up to the app, which owns parsing and validation. */
  onLoadText: (text: string, label: string) => void
  /** Label of the document currently on the canvas. */
  activeLabel: string
  /** Problems with the most recent attempt, if it failed. */
  issues: ValidationIssue[] | null
  /** Label of the attempt that failed. */
  failedLabel: string | null
}

/**
 * The four ways a tutorial gets into the player: bundled samples, a file
 * picker, a drop onto the window, and a paste box.
 *
 * Every one of them ends in the same call with raw text, so a pasted document
 * is validated exactly like a bundled one.
 */
export function TutorialSource({
  onLoadText,
  activeLabel,
  issues,
  failedLabel,
}: TutorialSourceProps) {
  const [pasted, setPasted] = useState('')
  const [dropping, setDropping] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)

  const readFile = useCallback(
    async (file: File) => {
      const text = await file.text()
      onLoadText(text, file.name)
    },
    [onLoadText],
  )

  // Drop anywhere on the window, not just on a target the author has to find.
  useEffect(() => {
    const depth = { count: 0 }

    const onDragEnter = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return
      event.preventDefault()
      depth.count += 1
      setDropping(true)
    }
    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    }
    const onDragLeave = () => {
      depth.count = Math.max(0, depth.count - 1)
      if (depth.count === 0) setDropping(false)
    }
    const onDrop = (event: DragEvent) => {
      const file = event.dataTransfer?.files?.[0]
      if (!file) return
      event.preventDefault()
      depth.count = 0
      setDropping(false)
      void readFile(file)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [readFile])

  return (
    <aside className="st-source">
      <h2 className="st-source__heading">Tutorial</h2>
      <p className="st-source__active" title={activeLabel}>
        Loaded: <strong>{activeLabel}</strong>
      </p>

      <div className="st-source__group">
        <h3 className="st-source__label">Bundled samples</h3>
        <div className="st-source__row">
          {SAMPLES.map((sample) => (
            <button
              key={sample.fileName}
              type="button"
              className="st-button"
              onClick={() => onLoadText(sample.source, sample.fileName)}
            >
              {sample.fileName.replace(/\.json$/, '')}
            </button>
          ))}
        </div>
      </div>

      <div className="st-source__group">
        <h3 className="st-source__label">Open a file</h3>
        <div className="st-source__row">
          <button type="button" className="st-button" onClick={() => fileInput.current?.click()}>
            Choose .json…
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void readFile(file)
              // Reset so re-picking the same file fires change again.
              event.target.value = ''
            }}
          />
        </div>
        <p className="st-source__hint">…or drop a .json file anywhere on this window.</p>
      </div>

      <div className="st-source__group st-source__group--grow">
        <h3 className="st-source__label">Paste JSON</h3>
        <textarea
          className="st-source__textarea"
          value={pasted}
          spellCheck={false}
          placeholder={'{\n  "schemaVersion": 1,\n  …\n}'}
          onChange={(event) => setPasted(event.target.value)}
        />
        <div className="st-source__row">
          <button
            type="button"
            className="st-button st-button--primary"
            onClick={() => onLoadText(pasted, 'pasted JSON')}
            disabled={pasted.trim().length === 0}
          >
            Load
          </button>
          <button
            type="button"
            className="st-button"
            onClick={() => setPasted('')}
            disabled={pasted.length === 0}
          >
            Clear
          </button>
        </div>
      </div>

      {issues && issues.length > 0 ? (
        <div className="st-errors" role="alert">
          <h3 className="st-errors__heading">
            Could not load {failedLabel ?? 'that document'}
          </h3>
          <p className="st-errors__note">
            The canvas still shows the last document that loaded cleanly.
          </p>
          <ul className="st-errors__list">
            {issues.map((issue, index) => (
              <li key={`${issue.path}-${index}`} className="st-errors__item">
                <code className="st-errors__path">{issue.path}</code>
                <span className="st-errors__message">{issue.message}</span>
                {issue.value !== undefined ? (
                  <code className="st-errors__value">{preview(issue.value)}</code>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dropping ? (
        <div className="st-dropzone">
          <span>Drop a .json tutorial to load it</span>
        </div>
      ) : null}
    </aside>
  )
}

/** Renders an offending value compactly, without flooding the panel. */
function preview(value: unknown): string {
  let text: string
  try {
    text = typeof value === 'string' ? JSON.stringify(value) : JSON.stringify(value)
  } catch {
    text = String(value)
  }
  if (text === undefined) return 'undefined'
  return text.length > 160 ? `${text.slice(0, 157)}…` : text
}
