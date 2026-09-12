import { useEffect, useMemo, useState } from 'react'

import { describeEntry, type HistoryEntry } from '../history/types'
import type { Tutorial } from '../schema/types'
import { validateTutorial } from '../schema/validate'

import { listHistory } from './api'
import { IssueList } from './IssueList'
import { Version } from './Version'

export interface HistoryPanelProps {
  lessonId: string
  /** The lesson as edited so far, or null while it has validation problems. */
  current: Tutorial | null
  /** Changes whenever a version may have been recorded, to read the history again. */
  refreshKey: number
  /** Puts a recorded version into the editor, where Undo can take it back. */
  onUse: (tutorial: Tutorial, entry: HistoryEntry) => void
}

const EDITOR = 'editor'

/**
 * Every recorded version of the lesson (master plan §24, "compare
 * generations"): pick one to see it beside the editor's version or beside
 * another recorded one, and bring it back if it was better.
 */
export function HistoryPanel({ lessonId, current, refreshKey, onUse }: HistoryPanelProps) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [baseId, setBaseId] = useState<string>(EDITOR)

  useEffect(() => {
    let cancelled = false
    setError(null)
    listHistory(lessonId).then(
      (result) => {
        if (!cancelled) setEntries(result.entries)
      },
      (caught: Error) => {
        if (!cancelled) setError(caught.message)
      },
    )
    return () => {
      cancelled = true
    }
  }, [lessonId, refreshKey])

  const selected = entries?.find((entry) => entry.id === selectedId) ?? entries?.[0]
  const baseEntry = baseId !== selected?.id ? entries?.find((entry) => entry.id === baseId) : undefined
  // Recorded files are read back as they are, so they are validated before
  // they are drawn or used: the schema may have moved on since.
  const verdict = useMemo(() => (selected ? validateTutorial(selected.tutorial) : null), [selected])
  const baseVerdict = useMemo(() => (baseEntry ? validateTutorial(baseEntry.tutorial) : null), [baseEntry])
  const base = baseEntry ? (baseVerdict?.ok ? baseVerdict.tutorial : null) : current

  if (error) {
    return (
      <p className="st-notice st-notice--error" role="alert">
        {error}
      </p>
    )
  }
  if (!entries) return <p className="st-field__hint">Reading the lesson's history…</p>
  if (entries.length === 0 || !selected) {
    return (
      <p className="st-field__hint">
        No versions recorded yet. Generations, regenerations, saves and publishes of this lesson are kept here, in
        your workspace, so a good version is never lost.
      </p>
    )
  }

  const when = (entry: HistoryEntry) => new Date(entry.createdAt).toLocaleString()

  return (
    <div className="st-history">
      <ol className="st-history__list" aria-label="Versions, newest first">
        {entries.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              className={`st-history__item ${entry.id === selected.id ? 'is-selected' : ''}`}
              aria-pressed={entry.id === selected.id}
              onClick={() => setSelectedId(entry.id)}
            >
              <strong>{describeEntry(entry)}</strong>
              <span className="st-history__meta">{when(entry)}</span>
              <span className="st-history__meta">{details(entry)}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="st-history__compare">
        <label className="st-field">
          <span className="st-field__label">Compare with</span>
          <select
            className="st-field__input"
            value={baseEntry ? baseEntry.id : EDITOR}
            onChange={(event) => setBaseId(event.target.value)}
          >
            <option value={EDITOR}>The version in the editor</option>
            {entries
              .filter((entry) => entry.id !== selected.id)
              .map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {describeEntry(entry)} · {when(entry)}
                </option>
              ))}
          </select>
        </label>
        {selected.note ? (
          <p className="st-history__about">
            <strong>Asked for:</strong> {selected.note}
          </p>
        ) : null}
        {selected.rationale ? <p className="st-regenerate__rationale">{selected.rationale}</p> : null}
        {selected.notes && selected.notes.length > 0 ? (
          <ul className="st-new-lesson__todo">
            {selected.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
        {verdict && !verdict.ok ? (
          <IssueList heading="This version no longer passes validation, so it cannot be used" issues={verdict.issues} />
        ) : null}
        <div className="st-candidate__grid">
          {base ? (
            <Version heading={baseEntry ? describeEntry(baseEntry) : 'In the editor'} tutorial={base} />
          ) : (
            <p className="st-field__hint">
              {baseEntry
                ? 'That version no longer passes validation, so it cannot be shown.'
                : 'The editor’s version has validation problems, so it cannot be shown.'}
            </p>
          )}
          {verdict?.ok ? (
            <Version heading={describeEntry(selected)} tutorial={verdict.tutorial} against={base ?? undefined} />
          ) : null}
        </div>
        <div className="st-new-lesson__actions">
          <button
            type="button"
            className="st-button st-button--primary"
            disabled={!verdict?.ok}
            onClick={() => {
              if (verdict?.ok) onUse(verdict.tutorial, selected)
            }}
          >
            Use this version
          </button>
          <span className="st-field__hint">It goes into the editor like any edit, and saves itself; Undo takes it back.</span>
        </div>
      </div>
    </div>
  )
}

/** Model, prompt, cost and size, whichever the entry has. */
function details(entry: HistoryEntry): string {
  const steps = Array.isArray(entry.tutorial.steps) ? entry.tutorial.steps.length : 0
  return [
    entry.model,
    entry.promptVersion,
    entry.cost !== undefined ? `$${entry.cost.toFixed(3)}` : '',
    `${steps} ${steps === 1 ? 'step' : 'steps'}`,
  ]
    .filter(Boolean)
    .join(' · ')
}
