import { useState } from 'react'

import { findLesson, findPathOfLesson } from '../catalog/types'

import { deleteLesson, duplicateLesson, publishLessons, unpublishLesson } from './api'
import { ApprovalChecklist, QualityWarnings } from './ApprovalDialog'
import { ConfirmDialog } from './ConfirmDialog'
import type { Library } from './library'
import { Menu, type MenuEntry } from './Menu'
import { qualityWarnings } from './quality'
import { routeHref } from './route'

type Dialog = 'publish' | 'unpublish' | 'delete'

export interface LessonActionsProps {
  library: Library
  lessonId: string
  /** Re-reads the library after a change. */
  onChanged: () => Promise<void>
  /** Offer Publish in the menu. The workspace has its own button instead. */
  withPublish?: boolean
  /** Offer Open, for lists. */
  withOpen?: boolean
  /** The open editor has unsaved edits; these actions use the saved version. */
  unsaved?: boolean
  /** Called once the lesson is deleted, before the library is re-read. */
  onDeleted?: () => void
  extraEntries?: MenuEntry[]
}

/**
 * What can be done to a whole lesson, from a "⋯" menu: duplicate it, publish
 * or unpublish it, delete it. Everything that touches `shared/` or removes
 * something asks first, and says exactly what will happen.
 */
export function LessonActions({
  library,
  lessonId,
  onChanged,
  withPublish = true,
  withOpen = false,
  unsaved = false,
  onDeleted,
  extraEntries = [],
}: LessonActionsProps) {
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const entry = library.tutorials.get(lessonId)
  if (!entry || !library.writable) return null

  const lesson = library.catalog ? findLesson(library.catalog, lessonId) : undefined
  const path = library.catalog ? findPathOfLesson(library.catalog, lessonId) : undefined
  const title = entry.tutorial.title
  const published = entry.state !== 'workspace'

  const duplicate = async () => {
    setError(null)
    try {
      const { lessonId: copy } = await duplicateLesson(lessonId)
      await onChanged()
      window.location.hash = routeHref({ name: 'lesson', lessonId: copy })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }

  const entries: MenuEntry[] = [
    ...(withOpen
      ? [{ label: 'Open', onSelect: () => (window.location.hash = routeHref({ name: 'lesson', lessonId })) }]
      : []),
    { label: unsaved ? 'Duplicate the saved version' : 'Duplicate as draft', onSelect: () => void duplicate() },
    ...(withPublish && lesson && entry.state !== 'published'
      ? [{ label: published ? 'Publish changes…' : 'Publish…', onSelect: () => setDialog('publish') }]
      : []),
    ...(published ? [{ label: 'Unpublish…', onSelect: () => setDialog('unpublish') }] : []),
    ...extraEntries,
    'separator',
    { label: 'Delete…', danger: true, onSelect: () => setDialog('delete') },
  ]

  const position = path ? path.lessonIds.indexOf(lessonId) : -1
  const previous = path && position > 0 ? library.tutorials.get(path.lessonIds[position - 1])?.tutorial : undefined

  return (
    <>
      <Menu label={`Actions for ${title}`} entries={entries} />
      {error ? (
        <p className="st-notice st-notice--error st-actions__error" role="alert">
          {error}
        </p>
      ) : null}

      {dialog === 'publish' ? (
        <ConfirmDialog
          title={`Publish “${title}”?`}
          confirmLabel="Approve & publish"
          busyLabel="Publishing…"
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await publishLessons([lessonId])
            await onChanged()
          }}
        >
          <p>
            Writes <code>shared/Tutorials/{lessonId}.json</code>
            {lesson?.reference ? ' and its photo' : ''}, and brings <code>shared/Catalog</code> in line with the
            curriculum. That is what git tracks and the app ships. Publishing marks the lesson approved; commit
            the files yourself afterwards.
          </p>
          <QualityWarnings warnings={qualityWarnings(entry.tutorial, previous)} />
          <ApprovalChecklist open={false} />
        </ConfirmDialog>
      ) : null}

      {dialog === 'unpublish' ? (
        <ConfirmDialog
          title={`Unpublish “${title}”?`}
          confirmLabel="Unpublish"
          busyLabel="Unpublishing…"
          tone="danger"
          typeToConfirm={lessonId}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await unpublishLesson(lessonId)
            await onChanged()
          }}
        >
          <p>
            Removes <code>shared/Tutorials/{lessonId}.json</code>
            {lesson?.reference ? ' and its photo' : ''} from <code>shared/</code> and takes it out of the published
            curriculum, so the app no longer ships it. It stays in your workspace as a lesson you can keep editing
            and publish again.
          </p>
        </ConfirmDialog>
      ) : null}

      {dialog === 'delete' ? (
        <ConfirmDialog
          title={`Delete “${title}”?`}
          confirmLabel={published ? 'Unpublish & delete' : 'Delete'}
          busyLabel="Deleting…"
          tone="danger"
          typeToConfirm={published ? lessonId : undefined}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await deleteLesson(lessonId)
            onDeleted?.()
            await onChanged()
          }}
        >
          <p>
            The lesson goes to the Trash{path ? `, leaving the “${path.title}” path` : ''}. Its photo and its
            history go with it, and it can be restored from the Trash until the Trash is emptied.
          </p>
          {published ? (
            <p className="st-notice">
              It is published. Deleting also removes it from <code>shared/</code>, so the app will no longer ship
              it. Commit that change with git.
            </p>
          ) : null}
        </ConfirmDialog>
      ) : null}
    </>
  )
}
