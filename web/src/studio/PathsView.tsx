import { useState } from 'react'

import { estimateLearnerSeconds, formatMinutes } from '../catalog/metrics'
import type { Catalog, LearningPath } from '../catalog/types'
import { totalStrokes } from '../schema/types'

import { FinishedDrawing } from './FinishedDrawing'
import { IssueList } from './IssueList'
import type { Library } from './library'
import { moveItem } from './moveItem'
import { routeHref } from './route'
import { StatusPill } from './StatusPill'

export interface PathsViewProps {
  library: Library
  catalog: Catalog | null
  selectedPathId: string | null
  /** True once the lesson order differs from what is on disk. */
  orderChanged: boolean
  onReorder: (pathId: string, lessonIds: string[]) => void
  onSaveOrder: () => Promise<void>
  onDiscardOrder: () => void
}

/**
 * The curriculum: every path, and the ordered lessons inside the selected one
 * (master plan §15).
 */
export function PathsView({
  library,
  catalog,
  selectedPathId,
  orderChanged,
  onReorder,
  onSaveOrder,
  onDiscardOrder,
}: PathsViewProps) {
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

  const selected = catalog.paths.find((path) => path.id === selectedPathId) ?? catalog.paths[0]
  const inAPath = new Set(catalog.paths.flatMap((path) => path.lessonIds))
  const outside = [...library.tutorials.values()].filter((entry) => !inAPath.has(entry.id))

  return (
    <div className="st-paths">
      <nav className="st-paths__list" aria-label="Paths">
        <h2 className="st-label">Paths</h2>
        <ul className="st-paths__items">
          {catalog.paths.map((path) => (
            <li key={path.id}>
              <a
                className="st-paths__link"
                href={routeHref({ name: 'paths', pathId: path.id })}
                aria-current={path.id === selected?.id ? 'page' : undefined}
              >
                {path.title}
                <span className="st-paths__count">{path.lessonIds.length}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="st-paths__detail">
        {selected ? (
          <PathDetail
            path={selected}
            catalog={catalog}
            library={library}
            orderChanged={orderChanged}
            onReorder={onReorder}
            onSaveOrder={onSaveOrder}
            onDiscardOrder={onDiscardOrder}
          />
        ) : (
          <p className="st-section-note">No paths yet. Add one to shared/Catalog/paths.json.</p>
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
                  <li key={entry.id}>
                    <a className="st-tile" href={routeHref({ name: 'lesson', lessonId: entry.id })}>
                      <span className="st-tile__thumb">
                        <FinishedDrawing tutorial={entry.tutorial} />
                      </span>
                      <span className="st-tile__title">{entry.tutorial.title}</span>
                      {lesson ? (
                        <StatusPill status={lesson.status} />
                      ) : (
                        <span className="st-pill">Not catalogued</span>
                      )}
                    </a>
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
  orderChanged,
  onReorder,
  onSaveOrder,
  onDiscardOrder,
}: {
  path: LearningPath
  catalog: Catalog
  library: Library
  orderChanged: boolean
  onReorder: (pathId: string, lessonIds: string[]) => void
  onSaveOrder: () => Promise<void>
  onDiscardOrder: () => void
}) {
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const saveOrder = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await onSaveOrder()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  // Validation guarantees every id resolves to a lesson and a tutorial.
  const rows = path.lessonIds.flatMap((id) => {
    const lesson = catalog.lessons.find((candidate) => candidate.id === id)
    const entry = library.tutorials.get(id)
    return lesson && entry ? [{ lesson, entry }] : []
  })
  const totalSeconds = rows.reduce((sum, row) => sum + estimateLearnerSeconds(row.entry.tutorial), 0)

  const move = (from: number, to: number) => {
    if (from !== to) onReorder(path.id, moveItem(path.lessonIds, from, to))
  }

  return (
    <>
      <header className="st-path-header">
        <h1>{path.title}</h1>
        {path.description ? <p>{path.description}</p> : null}
        <p className="st-path-header__meta">
          {rows.length} {rows.length === 1 ? 'lesson' : 'lessons'} · {formatMinutes(totalSeconds)}{' '}
          of drawing in total
        </p>
      </header>

      {orderChanged ? (
        <div className="st-notice st-notice--actions" role="status">
          {library.writable ? (
            <>
              <span>The lesson order has changed.</span>
              <button
                type="button"
                className="st-button st-button--primary st-button--compact"
                disabled={saving}
                onClick={() => void saveOrder()}
              >
                {saving ? 'Saving…' : 'Save order'}
              </button>
              <button type="button" className="st-button st-button--compact" disabled={saving} onClick={onDiscardOrder}>
                Discard
              </button>
            </>
          ) : (
            <span>The new order lasts for this session only: saving needs the Studio server.</span>
          )}
        </div>
      ) : null}
      {saveError ? (
        <p className="st-notice st-notice--error" role="alert">
          {saveError}
        </p>
      ) : null}

      <ol className="st-lessons">
        {rows.map(({ lesson, entry }, index) => {
          const { tutorial } = entry
          return (
            <li
              key={lesson.id}
              className={`st-lesson-row ${dropIndex === index ? 'is-drop-target' : ''}`}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('text/plain', String(index))
                event.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(event) => {
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
                  <StatusPill status={lesson.status} />
                </div>
                <p className="st-lesson-row__objective">{lesson.objective}</p>
                <p className="st-lesson-row__meta">
                  {formatMinutes(estimateLearnerSeconds(tutorial))} · {tutorial.steps.length} steps ·{' '}
                  {totalStrokes(tutorial)} strokes
                  {lesson.complexity ? ` · complexity ${lesson.complexity}/5` : ''}
                </p>
                {lesson.notes ? <p className="st-lesson-row__notes">{lesson.notes}</p> : null}
              </div>
              <div className="st-lesson-row__order">
                <button
                  type="button"
                  className="st-icon-button"
                  aria-label={`Move ${tutorial.title} earlier`}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="st-icon-button"
                  aria-label={`Move ${tutorial.title} later`}
                  disabled={index === rows.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  ↓
                </button>
              </div>
            </li>
          )
        })}
      </ol>
    </>
  )
}
