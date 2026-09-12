import { useState, type FormEvent } from 'react'

import { estimateLearnerSeconds, formatMinutes } from '../catalog/metrics'
import type { Catalog, LearningPath } from '../catalog/types'
import { totalStrokes } from '../schema/types'

import { removePath } from './api'
import { ConfirmDialog } from './ConfirmDialog'
import { FinishedDrawing } from './FinishedDrawing'
import { IssueList } from './IssueList'
import { LessonActions } from './LessonActions'
import type { Library } from './library'
import {
  assignLesson,
  createPath,
  movePath,
  reorderLessons,
  slugify,
  updatePath,
  type PathFields,
} from './pathOps'
import { routeHref } from './route'
import { LifecycleBadge } from './StatusPill'

export interface PathsViewProps {
  library: Library
  selectedPathId: string | null
  /** Applies one change to the working curriculum and saves it straight away. */
  onEdit: (change: (catalog: Catalog) => Catalog) => Promise<void>
  /** Re-reads the library after a change made through the server. */
  onReload: () => Promise<void>
}

/** Runs one curriculum change; resolves to whether it was saved. */
type Run = (change: (catalog: Catalog) => Catalog) => Promise<boolean>

/**
 * The curriculum (master plan §15): every path, the ordered lessons inside
 * the selected one, and the controls to reshape both. Every change is saved
 * as soon as it is made, so there is never an unsaved curriculum to lose.
 */
export function PathsView({ library, selectedPathId, onEdit, onReload }: PathsViewProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const catalog = library.catalog
  if (!catalog) {
    return (
      <div className="st-paths st-paths--single">
        <IssueList
          heading="The curriculum catalog could not be loaded"
          note="Fix shared/Catalog/paths.json or lessons.json. Tutorials still open from Import & test."
          issues={library.catalogIssues.map((issue) => ({
            path: `${issue.file} › ${issue.path}`,
            message: issue.message,
            value: issue.value,
          }))}
        />
      </div>
    )
  }

  const run: Run = async (change) => {
    setBusy(true)
    setError(null)
    try {
      await onEdit(change)
      return true
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
      return false
    } finally {
      setBusy(false)
    }
  }

  const editable = library.writable && !busy
  const selected = catalog.paths.find((path) => path.id === selectedPathId) ?? catalog.paths[0]
  const inAPath = new Set(catalog.paths.flatMap((path) => path.lessonIds))
  const outside = [...library.tutorials.values()].filter((entry) => !inAPath.has(entry.id))

  return (
    <div className="st-paths">
      <nav className="st-paths__list" aria-label="Paths">
        <h2 className="st-label">Paths</h2>
        {catalog.paths.length > 0 ? (
          <ul className="st-paths__items">
            {catalog.paths.map((path, index) => (
              <li key={path.id} className="st-paths__row">
                <a
                  className="st-paths__link"
                  href={routeHref({ name: 'paths', pathId: path.id })}
                  aria-current={path.id === selected?.id ? 'page' : undefined}
                >
                  {path.title}
                  <span className="st-paths__count">{path.lessonIds.length}</span>
                </a>
                {library.writable ? (
                  <span className="st-paths__order">
                    <button
                      type="button"
                      className="st-mini-button"
                      aria-label={`Move the ${path.title} path up`}
                      disabled={!editable || index === 0}
                      onClick={() => void run((current) => movePath(current, index, index - 1))}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="st-mini-button"
                      aria-label={`Move the ${path.title} path down`}
                      disabled={!editable || index === catalog.paths.length - 1}
                      onClick={() => void run((current) => movePath(current, index, index + 1))}
                    >
                      ↓
                    </button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="st-section-note">No paths yet.</p>
        )}

        {!library.writable ? (
          <p className="st-section-note">Read-only copy: changing paths needs the Studio server (npm run dev).</p>
        ) : creating ? (
          <PathForm
            withId
            submitLabel="Create path"
            busy={busy}
            onCancel={() => setCreating(false)}
            onSubmit={async (fields, id) => {
              if (await run((current) => createPath(current, id, fields))) {
                setCreating(false)
                window.location.hash = routeHref({ name: 'paths', pathId: id })
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="st-button st-button--compact"
            disabled={busy}
            onClick={() => setCreating(true)}
          >
            + New path
          </button>
        )}
        {library.writable ? (
          <a className="st-paths__extra" href={routeHref({ name: 'trash' })}>
            Trash <span className="st-paths__count">{library.publishing.trashCount}</span>
          </a>
        ) : null}
      </nav>

      <div className="st-paths__detail">
        {error ? (
          <p className="st-notice st-notice--error" role="alert">
            {error}
          </p>
        ) : null}

        {selected ? (
          <PathDetail
            key={selected.id}
            path={selected}
            catalog={catalog}
            library={library}
            editable={editable}
            busy={busy}
            run={run}
            onReload={onReload}
          />
        ) : (
          <p className="st-section-note">
            {library.writable
              ? 'No paths yet. Create the first one with “+ New path”.'
              : 'No paths yet.'}
          </p>
        )}

        {outside.length > 0 ? (
          <section>
            <h2 className="st-section-heading">Not in a path</h2>
            <p className="st-section-note">
              These tutorials play, but no path lists them, so a learner would never reach them.
            </p>
            <ul className="st-tile-grid">
              {outside.map((entry) => {
                const lesson = catalog.lessons.find((candidate) => candidate.id === entry.id)
                return (
                  <li key={entry.id} className="st-tile">
                    <a className="st-tile__link" href={routeHref({ name: 'lesson', lessonId: entry.id })}>
                      <span className="st-tile__thumb">
                        <FinishedDrawing tutorial={entry.tutorial} />
                      </span>
                      <span className="st-tile__title">{entry.tutorial.title}</span>
                    </a>
                    {lesson ? (
                      <LifecycleBadge status={lesson.status} state={entry.state} />
                    ) : (
                      <span
                        className="st-pill"
                        title="Only lessons in shared/Catalog/lessons.json can be placed in a path."
                      >
                        Not catalogued
                      </span>
                    )}
                    {lesson && selected && library.writable ? (
                      <button
                        type="button"
                        className="st-link-button"
                        disabled={!editable}
                        onClick={() => void run((current) => assignLesson(current, lesson.id, selected.id))}
                      >
                        Add to {selected.title}
                      </button>
                    ) : null}
                    <LessonActions library={library} lessonId={entry.id} onChanged={onReload} withOpen />
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}

        {library.broken.map((file) => (
          <IssueList
            key={file.fileName}
            heading={`shared/Tutorials/${file.fileName} is invalid`}
            note="It is left out of the Studio until it validates."
            issues={file.issues}
          />
        ))}
      </div>
    </div>
  )
}

function PathDetail({
  path,
  catalog,
  library,
  editable,
  busy,
  run,
  onReload,
}: {
  path: LearningPath
  catalog: Catalog
  library: Library
  editable: boolean
  busy: boolean
  run: Run
  onReload: () => Promise<void>
}) {
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [lessonsGo, setLessonsGo] = useState<'unfile' | 'trash'>('unfile')

  // Validation guarantees every id resolves to a lesson and a tutorial.
  const rows = path.lessonIds.flatMap((id) => {
    const lesson = catalog.lessons.find((candidate) => candidate.id === id)
    const entry = library.tutorials.get(id)
    return lesson && entry ? [{ lesson, entry }] : []
  })
  const totalSeconds = rows.reduce((sum, row) => sum + estimateLearnerSeconds(row.entry.tutorial), 0)
  const publishedCount = rows.filter((row) => row.entry.state !== 'workspace').length
  const otherPaths = catalog.paths.filter((candidate) => candidate.id !== path.id)

  const move = (from: number, to: number) => {
    if (from !== to) void run((current) => reorderLessons(current, path.id, from, to))
  }

  return (
    <>
      <header className="st-path-header">
        {editing ? (
          <PathForm
            initial={{ title: path.title, description: path.description ?? '' }}
            submitLabel="Save"
            busy={busy}
            onCancel={() => setEditing(false)}
            onSubmit={async (fields) => {
              if (await run((current) => updatePath(current, path.id, fields))) setEditing(false)
            }}
          />
        ) : (
          <>
            <h1>{path.title}</h1>
            {path.description ? <p>{path.description}</p> : null}
          </>
        )}
        <p className="st-path-header__meta">
          {rows.length} {rows.length === 1 ? 'lesson' : 'lessons'} · {formatMinutes(totalSeconds)}{' '}
          of drawing in total · id <code>{path.id}</code>
        </p>
        {library.writable && !editing ? (
          <div className="st-path-header__actions">
            <a href={routeHref({ name: 'new', pathId: path.id })}>New lesson in this path</a>
            <button type="button" className="st-link-button" disabled={!editable} onClick={() => setEditing(true)}>
              Edit title and description
            </button>
            <button
              type="button"
              className="st-link-button st-link-button--danger"
              disabled={!editable}
              onClick={() => {
                setLessonsGo('unfile')
                setDeleting(true)
              }}
            >
              Delete path…
            </button>
          </div>
        ) : null}
      </header>

      {deleting ? (
        <ConfirmDialog
          title={`Delete the “${path.title}” path?`}
          confirmLabel="Delete path"
          busyLabel="Deleting…"
          tone="danger"
          typeToConfirm={lessonsGo === 'trash' && publishedCount > 0 ? path.id : undefined}
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await removePath(path.id, lessonsGo)
            window.location.hash = routeHref({ name: 'paths', pathId: null })
            await onReload()
          }}
        >
          <p>The path goes to the Trash, where it can be restored.</p>
          {rows.length > 0 ? (
            <fieldset className="st-choice">
              <legend>
                Its {rows.length} {rows.length === 1 ? 'lesson' : 'lessons'}
              </legend>
              <label>
                <input type="radio" checked={lessonsGo === 'unfile'} onChange={() => setLessonsGo('unfile')} />
                <span>
                  Keep them, under “Not in a path”.
                  {publishedCount > 0 ? ' Published lessons stay published; the app loses the path when you next publish.' : ''}
                </span>
              </label>
              <label>
                <input type="radio" checked={lessonsGo === 'trash'} onChange={() => setLessonsGo('trash')} />
                <span>
                  Move them to the Trash too.
                  {publishedCount > 0
                    ? ` ${publishedCount} ${publishedCount === 1 ? 'is' : 'are'} published and will be removed from shared/ now.`
                    : ''}
                </span>
              </label>
            </fieldset>
          ) : null}
        </ConfirmDialog>
      ) : null}

      {rows.length === 0 ? (
        <p className="st-section-note">
          No lessons yet. Generate one with “New lesson in this path”, or add one from “Not in a path” below.
        </p>
      ) : null}

      <ol className="st-lessons">
        {rows.map(({ lesson, entry }, index) => {
          const { tutorial } = entry
          return (
            <li
              key={lesson.id}
              className={`st-lesson-row ${dropIndex === index ? 'is-drop-target' : ''}`}
              draggable={editable}
              onDragStart={(event) => {
                event.dataTransfer.setData('text/plain', String(index))
                event.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(event) => {
                if (!editable) return
                event.preventDefault()
                setDropIndex(index)
              }}
              onDragLeave={() => setDropIndex((current) => (current === index ? null : current))}
              onDrop={(event) => {
                event.preventDefault()
                setDropIndex(null)
                const from = Number(event.dataTransfer.getData('text/plain'))
                if (Number.isInteger(from)) move(from, index)
              }}
              onDragEnd={() => setDropIndex(null)}
            >
              <span className="st-lesson-row__number">{String(index + 1).padStart(2, '0')}</span>
              <span className="st-lesson-row__thumb">
                <FinishedDrawing tutorial={tutorial} />
              </span>
              <div className="st-lesson-row__body">
                <div className="st-lesson-row__head">
                  <a
                    className="st-lesson-row__title"
                    href={routeHref({ name: 'lesson', lessonId: lesson.id })}
                  >
                    {tutorial.title}
                  </a>
                  <LifecycleBadge status={lesson.status} state={entry.state} />
                </div>
                <p className="st-lesson-row__objective">{lesson.objective}</p>
                <p className="st-lesson-row__meta">
                  {formatMinutes(estimateLearnerSeconds(tutorial))} · {tutorial.steps.length} steps ·{' '}
                  {totalStrokes(tutorial)} strokes
                  {lesson.complexity ? ` · complexity ${lesson.complexity}/5` : ''}
                </p>
                {lesson.notes ? <p className="st-lesson-row__notes">{lesson.notes}</p> : null}
              </div>
              {library.writable ? (
                <div className="st-lesson-row__order">
                  <span className="st-lesson-row__arrows">
                    <button
                      type="button"
                      className="st-icon-button"
                      aria-label={`Move ${tutorial.title} earlier`}
                      disabled={!editable || index === 0}
                      onClick={() => move(index, index - 1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="st-icon-button"
                      aria-label={`Move ${tutorial.title} later`}
                      disabled={!editable || index === rows.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      ↓
                    </button>
                    <LessonActions library={library} lessonId={lesson.id} onChanged={onReload} />
                  </span>
                  <select
                    className="st-field__input st-lesson-row__move"
                    value=""
                    aria-label={`Move ${tutorial.title} to another path`}
                    disabled={!editable}
                    onChange={(event) => {
                      const target = event.target.value
                      if (!target) return
                      void run((current) => assignLesson(current, lesson.id, target === '-' ? null : target))
                    }}
                  >
                    <option value="">Move to…</option>
                    {otherPaths.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.title}
                      </option>
                    ))}
                    <option value="-">No path</option>
                  </select>
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
    </>
  )
}

/** Title, optional description and — for a new path only — the id. */
function PathForm({
  initial,
  withId = false,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  initial?: PathFields
  withId?: boolean
  submitLabel: string
  busy: boolean
  onSubmit: (fields: PathFields, id: string) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [id, setId] = useState('')
  const [idEdited, setIdEdited] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({ title, description }, id)
  }

  return (
    <form className="st-path-form" onSubmit={submit}>
      <label className="st-field">
        <span className="st-field__label">Title</span>
        <input
          className="st-field__input"
          value={title}
          autoFocus
          placeholder="e.g. Trees"
          onChange={(event) => {
            setTitle(event.target.value)
            if (!idEdited) setId(slugify(event.target.value))
          }}
        />
      </label>
      {withId ? (
        <label className="st-field">
          <span className="st-field__label">Id</span>
          <input
            className="st-field__input"
            value={id}
            onChange={(event) => {
              setIdEdited(true)
              setId(event.target.value)
            }}
          />
          <span className="st-field__hint">Fixed once created: lessons and the app refer to the path by it.</span>
        </label>
      ) : null}
      <label className="st-field">
        <span className="st-field__label">Description (optional)</span>
        <textarea
          className="st-field__input"
          value={description}
          placeholder="How the path progresses, e.g. trunk and canopy first, then species character."
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <div className="st-path-form__actions">
        <button
          type="submit"
          className="st-button st-button--primary st-button--compact"
          disabled={busy || !title.trim() || (withId && !id)}
        >
          {busy ? 'Saving…' : submitLabel}
        </button>
        <button type="button" className="st-button st-button--compact" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
