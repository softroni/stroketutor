import { useEffect, useRef, useState } from 'react'

import type { ScriptLine } from '../../voice/types'
import { moveItem } from '../moveItem'

import { newLineId, SUGGESTED_SCRIPT } from './script'

/**
 * The lines every voice reads. Four is enough: a greeting, a long instruction,
 * a word of comfort and the finish, which between them ask a voice everything
 * the app will ask of it.
 *
 * Editing a line never destroys a recording — takes are remembered by their
 * words — so the creator can rewrite freely and the old takes simply stop being
 * offered.
 */
export function ScriptEditor({
  script,
  onSave,
}: {
  script: ScriptLine[]
  onSave(lines: ScriptLine[]): Promise<void>
}) {
  const [lines, setLines] = useState(script)
  const [error, setError] = useState<string | null>(null)
  const saved = useRef(script)

  // The server is the truth: adopt what it last returned, unless the creator
  // is mid-edit on something it has not seen yet.
  useEffect(() => {
    saved.current = script
    setLines((current) => (sameScript(current, script) ? current : script))
  }, [script])

  const save = async (next: ScriptLine[]) => {
    setLines(next)
    if (sameScript(next, saved.current)) return
    setError(null)
    try {
      await onSave(next)
      saved.current = next
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }

  const edit = (index: number, part: Partial<ScriptLine>) =>
    setLines(lines.map((line, at) => (at === index ? { ...line, ...part } : line)))

  return (
    <section className="st-panel st-script">
      <header className="st-script__head">
        <h2 className="st-label">The audition script</h2>
        <button
          type="button"
          className="st-link-button"
          onClick={() => void save(SUGGESTED_SCRIPT.map((line) => ({ ...line })))}
        >
          Reset to suggested
        </button>
      </header>
      <p className="st-field__hint">
        Every voice reads these, so they can be told apart. Saved when you leave a field.
      </p>

      {error ? (
        <p className="st-notice st-notice--error" role="alert">
          {error}
        </p>
      ) : null}

      {lines.length === 0 ? (
        <p className="st-panel__note">No lines yet. Add one and every card will offer it.</p>
      ) : null}

      <ol className="st-script__lines">
        {lines.map((line, index) => (
          <li key={line.id} className="st-script__line">
            <input
              className="st-field__input st-script__label"
              value={line.label}
              aria-label={`Label of line ${index + 1}`}
              onChange={(event) => edit(index, { label: event.target.value })}
              onBlur={() => void save(lines)}
            />
            <textarea
              className="st-field__input st-script__text"
              value={line.text}
              rows={2}
              aria-label={`Words of line ${index + 1}`}
              onChange={(event) => edit(index, { text: event.target.value })}
              onBlur={() => void save(lines)}
            />
            <span className="st-script__buttons">
              <button
                type="button"
                className="st-icon-button"
                aria-label={`Move ${line.label} up`}
                disabled={index === 0}
                onClick={() => void save(moveItem(lines, index, index - 1))}
              >
                ↑
              </button>
              <button
                type="button"
                className="st-icon-button"
                aria-label={`Move ${line.label} down`}
                disabled={index === lines.length - 1}
                onClick={() => void save(moveItem(lines, index, index + 1))}
              >
                ↓
              </button>
              <button
                type="button"
                className="st-icon-button"
                aria-label={`Remove ${line.label}`}
                onClick={() => void save(lines.filter((_, at) => at !== index))}
              >
                ✕
              </button>
            </span>
          </li>
        ))}
      </ol>

      <div>
        <button
          type="button"
          className="st-button st-button--compact"
          onClick={() =>
            void save([...lines, { id: newLineId(lines), label: `Line ${lines.length + 1}`, text: '' }])
          }
        >
          Add a line
        </button>
      </div>
    </section>
  )
}

function sameScript(a: readonly ScriptLine[], b: readonly ScriptLine[]): boolean {
  return a.length === b.length && a.every((line, index) => {
    const other = b[index]
    return line.id === other.id && line.label === other.label && line.text === other.text
  })
}
