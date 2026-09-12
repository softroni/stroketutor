import { useState } from 'react'

import type { EditedPart, PathOrder, PendingChange } from '../catalog/publishing'
import { findLesson } from '../catalog/types'

import { publishLessons } from './api'
import { ApprovalChecklist } from './ApprovalDialog'
import { ConfirmDialog } from './ConfirmDialog'
import { FinishedDrawing } from './FinishedDrawing'
import type { Library } from './library'
import { routeHref } from './route'
import { LifecycleBadge } from './StatusPill'

type LessonChange = Exclude<PendingChange, { kind: 'curriculum' }>
type CurriculumChange = Extract<PendingChange, { kind: 'curriculum' }>

const PARTS: Record<EditedPart, string> = {
  drawing: 'drawing and steps',
  details: 'objective, status or notes',
  photo: 'reference photo',
}

export interface PublishViewProps {
  library: Library
  onPublished: () => Promise<void>
  onAdopt: () => Promise<void>
}

/**
 * Everything in the workspace that is not yet in `shared/`, and the one place
 * to publish it. What is listed is computed afresh from the workspace and
 * `shared/`, never queued, so it cannot drift from what is on disk.
 */
export function PublishView({ library, onPublished, onAdopt }: PublishViewProps) {
  const pending = library.publishing.pending
  const lessons = pending.filter((change): change is LessonChange => change.kind !== 'curriculum')
  const curriculum = pending.find((change): change is CurriculumChange => change.kind === 'curriculum')
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(lessons.filter((change) => change.ready).map((change) => change.lessonId)),
  )
  const [confirming, setConfirming] = useState(false)
  const [written, setWritten] = useState<string[] | null>(null)

  if (!library.writable) {
    return (
      <div className="st-form-page">
        <h1 className="st-form-page__title">Publish</h1>
        <p className="st-notice">Publishing needs the Studio server: run npm run dev.</p>
      </div>
    )
  }

  const chosen = lessons.filter((change) => selected.has(change.lessonId))
  const titleOf = (id: string) => library.tutorials.get(id)?.tutorial.title ?? id
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const ready = lessons.filter((change) => change.ready)
  const inProgress = lessons.filter((change) => !change.ready)
  const count = chosen.length
  const publishLabel =
    count > 0
      ? `Publish ${count} ${count === 1 ? 'lesson' : 'lessons'}${curriculum ? ' and the curriculum' : ''}…`
      : 'Publish the curriculum…'

  const row = (change: LessonChange) => {
    const entry = library.tutorials.get(change.lessonId)
    const lesson = library.catalog ? findLesson(library.catalog, change.lessonId) : undefined
    return (
      <li key={change.lessonId} className="st-publish-row">
        <input
          type="checkbox"
          checked={selected.has(change.lessonId)}
          onChange={() => toggle(change.lessonId)}
          aria-label={`Publish ${titleOf(change.lessonId)}`}
        />
        <span className="st-publish-row__thumb">{entry ? <FinishedDrawing tutorial={entry.tutorial} /> : null}</span>
        <span className="st-publish-row__body">
          <span className="st-publish-row__head">
            <a href={routeHref({ name: 'lesson', lessonId: change.lessonId })}>{titleOf(change.lessonId)}</a>
            {entry ? <LifecycleBadge status={lesson?.status} state={entry.state} /> : null}
          </span>
          <span className="st-publish-row__what">
            {change.kind === 'new'
              ? 'New: not in the app yet.'
              : `Changed since it was published: ${change.parts.map((part) => PARTS[part]).join(', ')}.`}
          </span>
        </span>
      </li>
    )
  }

  return (
    <div className="st-form-page st-form-page--wide st-publish">
      <h1 className="st-form-page__title">Publish</h1>
      <p className="st-field__hint">
        Your workspace is private and outside git. Publishing writes lessons into <code>shared/</code>, which git
        tracks and the iOS app bundles. The Studio never commits: review the diff, then commit it yourself.
      </p>

      {library.publishing.sharedChangedOutside ? (
        <p className="st-notice st-notice--error" role="alert">
          <code>shared/Catalog</code> changed outside the Studio. Adopt it before publishing.{' '}
          <button type="button" className="st-link-button" onClick={() => void onAdopt()}>
            Adopt shared/
          </button>
        </p>
      ) : null}

      {written ? (
        <div className="st-notice st-notice--success" role="status">
          <p className="st-publish__done">
            Published. {written.length} {written.length === 1 ? 'file' : 'files'} in <code>shared/</code> changed.
            Commit them with git:
          </p>
          <pre className="st-publish__command">git add -- {written.join(' ')}</pre>
        </div>
      ) : null}

      {pending.length === 0 ? (
        <p className="st-empty">Nothing to publish: everything in the workspace is published.</p>
      ) : null}

      {ready.length > 0 ? (
        <section className="st-panel">
          <h2 className="st-label">Approved, ready to publish</h2>
          <ul className="st-publish-list">{ready.map(row)}</ul>
        </section>
      ) : null}

      {curriculum ? (
        <section className="st-panel">
          <h2 className="st-label">Curriculum</h2>
          <p className="st-section-note">
            The published paths, their titles and their order, as the app will see them. Only published lessons
            appear, and a path with none is left out. Curriculum changes are published together with anything else.
          </p>
          <div className="st-publish-compare">
            <div>
              <h3 className="st-publish-compare__heading">Published now</h3>
              <PathList paths={curriculum.before} titleOf={titleOf} />
            </div>
            <div>
              <h3 className="st-publish-compare__heading">After publishing</h3>
              <PathList paths={curriculum.after} titleOf={titleOf} />
            </div>
          </div>
        </section>
      ) : null}

      {inProgress.length > 0 ? (
        <section className="st-panel">
          <h2 className="st-label">Still in progress</h2>
          <p className="st-section-note">
            Not approved yet. Tick one to approve and publish it anyway, or open it to finish it first.
          </p>
          <ul className="st-publish-list">{inProgress.map(row)}</ul>
        </section>
      ) : null}

      {count > 0 || curriculum ? (
        <div className="st-publish__actions">
          <button
            type="button"
            className="st-button st-button--primary"
            disabled={library.publishing.sharedChangedOutside}
            onClick={() => setConfirming(true)}
          >
            {publishLabel}
          </button>
        </div>
      ) : null}

      {confirming ? (
        <ConfirmDialog
          title={count > 0 ? `Publish ${count} ${count === 1 ? 'lesson' : 'lessons'}?` : 'Publish the curriculum?'}
          confirmLabel="Approve & publish"
          busyLabel="Publishing…"
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            const { files } = await publishLessons(chosen.map((change) => change.lessonId))
            setWritten(files)
            setSelected(new Set())
            await onPublished()
          }}
        >
          {count > 0 ? (
            <>
              <p>These are written into <code>shared/</code> and marked approved:</p>
              <ul className="st-dialog__list">
                {chosen.map((change) => (
                  <li key={change.lessonId}>
                    {titleOf(change.lessonId)} <code>shared/Tutorials/{change.lessonId}.json</code>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <p>
            <code>shared/Catalog</code> is brought in line with the curriculum. Commit the changed files yourself
            afterwards.
          </p>
          {count > 0 ? <ApprovalChecklist open={false} /> : null}
        </ConfirmDialog>
      ) : null}
    </div>
  )
}

function PathList({ paths, titleOf }: { paths: PathOrder[]; titleOf: (id: string) => string }) {
  if (paths.length === 0) return <p className="st-section-note">No paths.</p>
  return (
    <ol className="st-publish-paths">
      {paths.map((path) => (
        <li key={path.id}>
          <strong>{path.title}</strong>
          <ol>
            {path.lessonIds.map((id) => (
              <li key={id}>{titleOf(id)}</li>
            ))}
          </ol>
        </li>
      ))}
    </ol>
  )
}
