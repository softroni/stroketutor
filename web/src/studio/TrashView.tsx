import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { deleteForever, emptyTrash, listTrash, restoreFromTrash, type TrashItem } from './api'
import { ConfirmDialog } from './ConfirmDialog'
import type { Library } from './library'
import { routeHref } from './route'

export interface TrashViewProps {
  library: Library
  onChanged: () => Promise<void>
}

/**
 * Deleted lessons and paths, kept in the workspace until the trash is
 * emptied. Restoring puts a lesson back where it was, as a draft: it is never
 * republished on its own.
 */
export function TrashView({ library, onChanged }: TrashViewProps) {
  const [items, setItems] = useState<TrashItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<ReactNode>(null)
  const [purging, setPurging] = useState<TrashItem | 'all' | null>(null)

  const load = useCallback(async () => {
    try {
      setItems((await listTrash()).items)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }, [])

  useEffect(() => {
    if (library.writable) void load()
  }, [library, load])

  if (!library.writable) {
    return (
      <div className="st-form-page">
        <h1 className="st-form-page__title">Trash</h1>
        <p className="st-notice">The trash needs the Studio server: run npm run dev.</p>
      </div>
    )
  }

  const restore = async (item: TrashItem) => {
    setError(null)
    setNotice(null)
    try {
      const restored = await restoreFromTrash(item.id)
      await onChanged()
      setNotice(
        <>
          Restored “{item.title}”
          {restored.kind === 'lesson' ? ' as a draft in the workspace. ' : '. '}
          <a
            href={
              restored.kind === 'lesson'
                ? routeHref({ name: 'lesson', lessonId: restored.itemId })
                : routeHref({ name: 'paths', pathId: restored.itemId })
            }
          >
            Open it
          </a>
        </>,
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }

  return (
    <div className="st-form-page st-form-page--wide st-trash">
      <div className="st-trash__head">
        <div>
          <h1 className="st-form-page__title">Trash</h1>
          <p className="st-field__hint">
            Deleted lessons and paths stay here, in your workspace, until you delete them for good. A restored
            lesson comes back as a draft; nothing is republished on its own.
          </p>
        </div>
        {items && items.length > 0 ? (
          <button type="button" className="st-button st-button--danger" onClick={() => setPurging('all')}>
            Empty trash…
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="st-notice st-notice--error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="st-notice st-notice--success" role="status">
          {notice}
        </p>
      ) : null}

      {items === null ? <p className="st-section-note">Reading the trash…</p> : null}
      {items?.length === 0 ? <p className="st-empty">The trash is empty.</p> : null}

      {items && items.length > 0 ? (
        <ul className="st-trash__list">
          {items.map((item) => (
            <li key={item.id} className="st-trash__row">
              <span className="st-pill">{item.kind === 'lesson' ? 'Lesson' : 'Path'}</span>
              <span className="st-trash__body">
                <strong>{item.title}</strong> <code>{item.itemId}</code>
                <span className="st-trash__detail">
                  Deleted {new Date(item.deletedAt).toLocaleString()} · {item.detail}
                </span>
              </span>
              <span className="st-trash__actions">
                <button type="button" className="st-button st-button--compact" onClick={() => void restore(item)}>
                  Restore
                </button>
                <button
                  type="button"
                  className="st-link-button st-link-button--danger"
                  onClick={() => setPurging(item)}
                >
                  Delete forever…
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {purging ? (
        <ConfirmDialog
          title={purging === 'all' ? 'Empty the trash?' : `Delete “${purging.title}” for good?`}
          confirmLabel={purging === 'all' ? 'Empty trash' : 'Delete forever'}
          busyLabel="Deleting…"
          tone="danger"
          typeToConfirm={purging === 'all' ? 'empty' : purging.itemId}
          onClose={() => setPurging(null)}
          onConfirm={async () => {
            if (purging === 'all') await emptyTrash()
            else await deleteForever(purging.id)
            await load()
            await onChanged()
          }}
        >
          <p>
            {purging === 'all'
              ? `All ${items?.length ?? 0} items are removed from the workspace, with the history of every lesson among them. This cannot be undone.`
              : purging.kind === 'lesson'
                ? 'The lesson, its photo and its whole history are removed from the workspace. This cannot be undone.'
                : 'The path is removed for good. Its lessons are not affected.'}
          </p>
        </ConfirmDialog>
      ) : null}
    </div>
  )
}
