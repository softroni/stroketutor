import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'

import { estimateLearnerSeconds, formatMinutes } from '../catalog/metrics'
import { readyCount } from '../catalog/publishing'
import type { Catalog, LearningPath, Lesson } from '../catalog/types'
import { totalStrokes } from '../schema/types'

import { removePath } from './api'
import { ConfirmDialog } from './ConfirmDialog'
import { FinishedDrawing } from './FinishedDrawing'
import { IssueList } from './IssueList'
import { LessonActions } from './LessonActions'
import type { Library, TutorialEntry } from './library'
import { Menu, type MenuEntry } from './Menu'
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
  /** The path to show. Null shows the one last visited, or the first. */
  selectedPathId: string | null
  /** Show the lessons no path lists, instead of a path. */
  unfiled?: boolean
  /** Applies one change to the working curriculum and saves it straight away. */
  onEdit: (change: (catalog: Catalog) => Catalog) => Promise<void>
  /** Re-reads the library after a change made through the server. */
  onReload: () => Promise<void>
}

/** Runs one curriculum change; resolves to whether it was saved. */
type Run = (change: (catalog: Catalog) => Catalog) => Promise<boolean>

type Filter = 'all' | 'draft' | 'needs-review' | 'approved' | 'published' | 'edited'
type Density = 'list' | 'grid'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'needs-review', label: 'Needs review' },
  { id: 'approved', label: 'Approved' },
  { id: 'published', label: 'Published' },
  { id: 'edited', label: 'Edited' },
]

/** One tutorial, with its place in the curriculum when it has one. */
interface Row {
  entry: TutorialEntry
  lesson?: Lesson
  path?: LearningPath
}

function matches(row: Row, filter: Filter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'published':
      return row.entry.state === 'published'
    case 'edited':
      return row.entry.state === 'published-edited'
    default:
      // Authoring statuses describe lessons still in the workspace.
      return row.entry.state === 'workspace' && row.lesson?.status === filter
  }
}

const UI_KEY = 'stroketutor.studio.paths'

interface ViewPrefs {
  filter: Filter
  density: Density
  lastPathId: string | null
}

/** The filter, layout and last path, remembered in this browser only. */
function readPrefs(): ViewPrefs {
  try {
    const stored = JSON.parse(localStorage.getItem(UI_KEY) ?? '{}') as Partial<ViewPrefs>
    return {
      filter: FILTERS.some((filter) => filter.id === stored.filter) ? (stored.filter as Filter) : 'all',
      density: stored.density === 'grid' ? 'grid' : 'list',
      lastPathId: typeof stored.lastPathId === 'string' ? stored.lastPathId : null,
    }
  } catch {
    return { filter: 'all', density: 'list', lastPathId: null }
  }
}

function writePrefs(prefs: ViewPrefs) {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(prefs))
  } catch {
    // Storage can be unavailable (a private window); the defaults still work.
  }
}

const PATH_DRAG = 'application/x-stroketutor-path'
const LESSON_DRAG = 'application/x-stroketutor-lesson'

/**
 * The curriculum (master plan §15): every path, the lessons of the selected
 * one, and the controls to reshape both. Every change is saved as soon as it
 * is made, so there is never an unsaved curriculum to lose. Search and the
 * status chips find a lesson anywhere without opening path after path.
 */
export function PathsView({ library, selectedPathId, unfiled = false, onEdit, onReload }: PathsViewProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [prefs, setPrefs] = useState(readPrefs)
  const [query, setQuery] = useState('')
  const [pathDrop, setPathDrop] = useState<number | null>(null)
  const search = useRef<HTMLInputElement>(null)

  const updatePrefs = (patch: Partial<ViewPrefs>) =>
    setPrefs((current) => {
      const next = { ...current, ...patch }
      writePrefs(next)
      return next
    })

  const catalog = library.catalog
  const selected =
    catalog && !unfiled
      ? (catalog.paths.find((path) => path.id === selectedPathId) ??
        catalog.paths.find((path) => path.id === prefs.lastPathId) ??
        catalog.paths[0])
      : undefined

  useEffect(() => {
    if (selected && selected.id !== prefs.lastPathId) updatePrefs({ lastPathId: selected.id })
    // Only a change of path is remembered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  // "/" jumps to search, as in most tools with a list to filter.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.key !== '/' || event.metaKey || event.ctrlKey) return
      if (target?.closest('input, textarea, select, [contenteditable="true"], dialog')) return
      event.preventDefault()
      search.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!catalog) {
    return (
      <div className="st-paths st-paths--single">
        <IssueList
          heading="The curriculum could not be loaded"
          note="Its paths or lessons are not valid. Tutorials still open from Import & test."
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
  const lessons = new Map(catalog.lessons.map((lesson) => [lesson.id, lesson]))
  const pathOf = new Map<string, LearningPath>()
  for (const path of catalog.paths) for (const id of path.lessonIds) pathOf.set(id, path)
  const rowOf = (entry: TutorialEntry): Row => ({ entry, lesson: lessons.get(entry.id), path: pathOf.get(entry.id) })
  const everyRow = [...library.tutorials.values()].map(rowOf)
  const outside = everyRow.filter((row) => !row.path)

  const needle = query.trim().toLowerCase()
  const searching = needle.length > 0
  const found = searching
    ? everyRow.filter((row) =>
        [row.entry.tutorial.title, row.entry.id, row.lesson?.objective ?? ''].some((text) =>
          text.toLowerCase().includes(needle),
        ),
      )
    : []
  const selectedRows = selected
    ? selected.lessonIds.flatMap((id) => {
        const entry = library.tutorials.get(id)
        return entry ? [rowOf(entry)] : []
      })
    : []
  const scope = searching ? found : unfiled ? outside : selectedRows

  const inApp = (path: LearningPath) =>
    path.lessonIds.filter((id) => {
      const state = library.tutorials.get(id)?.state
      return state !== undefined && state !== 'workspace'
    }).length

  /** Move to another path, or out of every path. */
  const moveEntries = (row: Row): MenuEntry[] => {
    const lesson = row.lesson
    if (!lesson || !library.writable) return []
    const entries: MenuEntry[] = catalog.paths
      .filter((path) => path.id !== row.path?.id)
      .map((path) => ({
        label: `${row.path ? 'Move' : 'Add'} to ${path.title}`,
        disabled: !editable,
        onSelect: () => void run((current) => assignLesson(current, lesson.id, path.id)),
      }))
    if (row.path) {
      entries.push({
        label: 'Take out of the path',
        disabled: !editable,
        onSelect: () => void run((current) => assignLesson(current, lesson.id, null)),
      })
    }
    return entries
  }

  const readyToPublish = readyCount(library.publishing.pending)

  return (
    <div className="st-paths">
      <nav className="st-paths__list" aria-label="Paths">
        <h2 className="st-label">Paths</h2>
        {catalog.paths.length > 0 ? (
          <ul className="st-paths__items">
            {catalog.paths.map((path, index) => {
              const published = inApp(path)
              return (
                <li
                  key={path.id}
                  className={`st-paths__row ${pathDrop === index ? 'is-drop-target' : ''}`}
                  draggable={editable}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(PATH_DRAG, String(index))
                    event.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragOver={(event) => {
                    if (!editable || !event.dataTransfer.types.includes(PATH_DRAG)) return
                    event.preventDefault()
                    setPathDrop(index)
                  }}
                  onDragLeave={() => setPathDrop((current) => (current === index ? null : current))}
                  onDrop={(event) => {
                    setPathDrop(null)
                    const from = Number(event.dataTransfer.getData(PATH_DRAG))
                    if (!Number.isInteger(from) || from === index) return
                    event.preventDefault()
                    void run((current) => movePath(current, from, index))
                  }}
                  onDragEnd={() => setPathDrop(null)}
                >
                  <a
                    className="st-paths__link"
                    href={routeHref({ name: 'paths', pathId: path.id })}
                    aria-current={!searching && path.id === selected?.id ? 'page' : undefined}
                    onClick={() => setQuery('')}
                  >
                    <span className="st-paths__name">{path.title}</span>
                    <span
                      className={`st-paths__count ${published === 0 ? 'is-none' : ''}`}
                      title={
                        published === 0
                          ? 'Not in the app yet: no lesson in this path is published.'
                          : `${published} of ${path.lessonIds.length} lessons published`
                      }
                    >
                      {published}/{path.lessonIds.length}
                    </span>
                  </a>
                </li>
              )
            })}
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

        <hr className="st-paths__rule" />
        <a
          className="st-paths__extra"
          href={routeHref({ name: 'unfiled' })}
          aria-current={unfiled && !searching ? 'page' : undefined}
          onClick={() => setQuery('')}
        >
          Not in a path <span className="st-paths__count">{outside.length}</span>
        </a>
        {library.writable ? (
          <>
            <a className="st-paths__extra" href={routeHref({ name: 'publish' })}>
              Publish <span className="st-paths__count">{readyToPublish}</span>
            </a>
            <a className="st-paths__extra" href={routeHref({ name: 'trash' })}>
              Trash <span className="st-paths__count">{library.publishing.trashCount}</span>
            </a>
          </>
        ) : null}
      </nav>

      <div className="st-paths__detail">
        <div className="st-paths-toolbar">
          <input
            ref={search}
            type="search"
            className="st-field__input st-paths-toolbar__search"
            placeholder="Search every lesson   /"
            aria-label="Search every lesson by title, id or objective"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setQuery('')
                event.currentTarget.blur()
              }
            }}
          />
          <div className="st-chips" role="group" aria-label="Show">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className="st-chip"
                aria-pressed={prefs.filter === filter.id}
                onClick={() => updatePrefs({ filter: filter.id })}
              >
                {filter.label}
                <span className="st-chip__count">{scope.filter((row) => matches(row, filter.id)).length}</span>
              </button>
            ))}
          </div>
          <div className="st-segmented" role="group" aria-label="Layout">
            <button type="button" aria-pressed={prefs.density === 'list'} onClick={() => updatePrefs({ density: 'list' })}>
              List
            </button>
            <button type="button" aria-pressed={prefs.density === 'grid'} onClick={() => updatePrefs({ density: 'grid' })}>
              Grid
            </button>
          </div>
        </div>

        {error ? (
          <p className="st-notice st-notice--error" role="alert">
            {error}
          </p>
        ) : null}

        {searching ? (
          <section aria-label="Search results">
            <header className="st-path-header">
              <h1>Lessons matching “{query.trim()}”</h1>
              <p className="st-path-header__meta">
                {found.length} {found.length === 1 ? 'lesson' : 'lessons'} in every path · Esc clears
              </p>
            </header>
            <LessonList
              rows={found.filter((row) => matches(row, prefs.filter))}
              hidden={found.length - found.filter((row) => matches(row, prefs.filter)).length}
              density={prefs.density}
              library={library}
              onReload={onReload}
              showPath
              entriesFor={moveEntries}
              onShowAll={() => updatePrefs({ filter: 'all' })}
              empty={`No lesson matches “${query.trim()}”.`}
            />
          </section>
        ) : unfiled ? (
          <section aria-label="Not in a path">
            <header className="st-path-header">
              <h1>Not in a path</h1>
              <p>These play, but no path lists them, so a learner would never reach them. Add one to a path from its ⋯ menu.</p>
            </header>
            <LessonList
              rows={outside.filter((row) => matches(row, prefs.filter))}
              hidden={outside.length - outside.filter((row) => matches(row, prefs.filter)).length}
              density={prefs.density}
              library={library}
              onReload={onReload}
              entriesFor={moveEntries}
              onShowAll={() => updatePrefs({ filter: 'all' })}
              empty="Every lesson is in a path."
            />
          </section>
        ) : selected ? (
          <PathDetail
            key={selected.id}
            path={selected}
            index={catalog.paths.indexOf(selected)}
            pathCount={catalog.paths.length}
            rows={selectedRows}
            published={inApp(selected)}
            filter={prefs.filter}
            density={prefs.density}
            library={library}
            editable={editable}
            busy={busy}
            run={run}
            onReload={onReload}
            moveEntries={moveEntries}
            onShowAll={() => updatePrefs({ filter: 'all' })}
          />
        ) : (
          <p className="st-section-note">
            {library.writable ? 'No paths yet. Create the first one with “+ New path”.' : 'No paths yet.'}
          </p>
        )}

        {library.broken.map((file) => (
          <IssueList
            key={file.fileName}
            heading={`${file.fileName} is invalid`}
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
  index,
  pathCount,
  rows,
  published,
  filter,
  density,
  library,
  editable,
  busy,
  run,
  onReload,
  moveEntries,
  onShowAll,
}: {
  path: LearningPath
  index: number
  pathCount: number
  rows: Row[]
  published: number
  filter: Filter
  density: Density
  library: Library
  editable: boolean
  busy: boolean
  run: Run
  onReload: () => Promise<void>
  moveEntries: (row: Row) => MenuEntry[]
  onShowAll: () => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [lessonsGo, setLessonsGo] = useState<'unfile' | 'trash'>('unfile')

  const totalSeconds = rows.reduce((sum, row) => sum + estimateLearnerSeconds(row.entry.tutorial), 0)
  const visible = rows.filter((row) => matches(row, filter))
  // Reordering by drag only makes sense when every lesson of the path is shown.
  const reorderable = editable && filter === 'all' && density === 'list'

  const move = async (from: number, to: number) => {
    if (from === to || to < 0 || to >= rows.length) return
    const id = rows[from].entry.id
    if (await run((current) => reorderLessons(current, path.id, from, to))) {
      document.querySelector<HTMLElement>(`[data-lesson-link="${id}"]`)?.focus()
    }
  }

  const pathEntries: MenuEntry[] = [
    { label: 'Rename', disabled: !editable, onSelect: () => setRenaming(true) },
    { label: 'Edit description…', disabled: !editable, onSelect: () => setEditing(true) },
    {
      label: 'Move path up',
      disabled: !editable || index === 0,
      onSelect: () => void run((current) => movePath(current, index, index - 1)),
    },
    {
      label: 'Move path down',
      disabled: !editable || index === pathCount - 1,
      onSelect: () => void run((current) => movePath(current, index, index + 1)),
    },
    'separator',
    {
      label: 'Delete path…',
      danger: true,
      disabled: !editable,
      onSelect: () => {
        setLessonsGo('unfile')
        setDeleting(true)
      },
    },
  ]

  return (
    <section aria-labelledby="st-path-title">
      <header className="st-path-header">
        <div className="st-path-header__top">
          {renaming ? (
            <RenameField
              title={path.title}
              busy={busy}
              onCancel={() => setRenaming(false)}
              onSave={async (title) => {
                if (title === path.title) return setRenaming(false)
                if (await run((current) => updatePath(current, path.id, { title, description: path.description ?? '' }))) {
                  setRenaming(false)
                }
              }}
            />
          ) : (
            <h1 id="st-path-title">
              {library.writable ? (
                <button
                  type="button"
                  className="st-path-header__title"
                  title="Rename"
                  disabled={!editable}
                  onClick={() => setRenaming(true)}
                >
                  {path.title}
                </button>
              ) : (
                path.title
              )}
            </h1>
          )}
          {library.writable ? (
            <div className="st-path-header__actions">
              <a className="st-button st-button--compact" href={routeHref({ name: 'new', pathId: path.id })}>
                + New lesson
              </a>
              <Menu label={`Actions for the ${path.title} path`} entries={pathEntries} />
            </div>
          ) : null}
        </div>
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
        ) : path.description ? (
          <p>{path.description}</p>
        ) : null}
        <p className="st-path-header__meta">
          {rows.length} {rows.length === 1 ? 'lesson' : 'lessons'} · {published} in the app ·{' '}
          {formatMinutes(totalSeconds)} of drawing in total · id <code>{path.id}</code>
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="st-section-note">
          No lessons yet. Start one with “+ New lesson”, or add one from “Not in a path”.
        </p>
      ) : (
        <LessonList
          rows={visible}
          hidden={rows.length - visible.length}
          numbers={visible.map((row) => rows.indexOf(row) + 1)}
          density={density}
          library={library}
          onReload={onReload}
          onShowAll={onShowAll}
          empty="No lesson in this path matches the filter."
          reorder={
            reorderable
              ? { onMove: (from, to) => void move(from, to), indexOf: (row) => rows.indexOf(row) }
              : undefined
          }
          onKeyMove={
            editable
              ? (row, direction) => {
                  const from = rows.indexOf(row)
                  void move(from, from + direction)
                }
              : undefined
          }
          entriesFor={(row) => {
            const at = rows.indexOf(row)
            return [
              {
                label: 'Move earlier',
                disabled: !editable || at === 0,
                onSelect: () => void move(at, at - 1),
              },
              {
                label: 'Move later',
                disabled: !editable || at === rows.length - 1,
                onSelect: () => void move(at, at + 1),
              },
              ...moveEntries(row),
            ]
          }}
        />
      )}

      {deleting ? (
        <ConfirmDialog
          title={`Delete the “${path.title}” path?`}
          confirmLabel="Delete path"
          busyLabel="Deleting…"
          tone="danger"
          typeToConfirm={lessonsGo === 'trash' && published > 0 ? path.id : undefined}
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
                  {published > 0 ? ' Published lessons stay published; the app loses the path when you next publish.' : ''}
                </span>
              </label>
              <label>
                <input type="radio" checked={lessonsGo === 'trash'} onChange={() => setLessonsGo('trash')} />
                <span>
                  Move them to the Trash too.
                  {published > 0
                    ? ` ${published} ${published === 1 ? 'is' : 'are'} published and will be removed from shared/ now.`
                    : ''}
                </span>
              </label>
            </fieldset>
          ) : null}
        </ConfirmDialog>
      ) : null}
    </section>
  )
}

/**
 * Lessons as compact rows or as a grid of drawings. Every row has one ⋯ menu;
 * in a path shown in full, rows also reorder by drag or with ⌥↑ / ⌥↓.
 */
function LessonList({
  rows,
  hidden,
  numbers,
  density,
  library,
  onReload,
  showPath = false,
  entriesFor,
  reorder,
  onKeyMove,
  onShowAll,
  empty,
}: {
  rows: Row[]
  /** How many the status filter hides. */
  hidden: number
  /** Each row's place in its path, when that matters. */
  numbers?: number[]
  density: Density
  library: Library
  onReload: () => Promise<void>
  showPath?: boolean
  entriesFor: (row: Row) => MenuEntry[]
  reorder?: { onMove: (from: number, to: number) => void; indexOf: (row: Row) => number }
  onKeyMove?: (row: Row, direction: -1 | 1) => void
  onShowAll: () => void
  empty: string
}) {
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  if (rows.length === 0) {
    return (
      <p className="st-section-note">
        {hidden > 0 ? (
          <>
            {hidden} {hidden === 1 ? 'lesson is' : 'lessons are'} hidden by the filter.{' '}
            <button type="button" className="st-link-button" onClick={onShowAll}>
              Show all
            </button>
          </>
        ) : (
          empty
        )}
      </p>
    )
  }

  const onTitleKeyDown = (row: Row) => (event: ReactKeyboardEvent<HTMLAnchorElement>) => {
    if (!onKeyMove || !event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
    event.preventDefault()
    onKeyMove(row, event.key === 'ArrowUp' ? -1 : 1)
  }

  const meta = (row: Row) => {
    const { tutorial } = row.entry
    return (
      <>
        {formatMinutes(estimateLearnerSeconds(tutorial))} · {tutorial.steps.length} steps · {totalStrokes(tutorial)} strokes
        {row.lesson?.complexity ? ` · complexity ${row.lesson.complexity}/5` : ''}
        {showPath ? ` · ${row.path ? row.path.title : 'not in a path'}` : ''}
      </>
    )
  }

  if (density === 'grid') {
    return (
      <ul className="st-lesson-grid">
        {rows.map((row, position) => (
          <li key={row.entry.id} className="st-lesson-tile">
            <a
              className="st-lesson-tile__link"
              href={routeHref({ name: 'lesson', lessonId: row.entry.id })}
              data-lesson-link={row.entry.id}
              onKeyDown={onTitleKeyDown(row)}
            >
              <span className="st-lesson-tile__thumb">
                <FinishedDrawing tutorial={row.entry.tutorial} />
              </span>
              <span className="st-lesson-tile__title">
                {numbers ? <span className="st-lesson-tile__number">{String(numbers[position]).padStart(2, '0')}</span> : null}
                {row.entry.tutorial.title}
              </span>
            </a>
            <span className="st-lesson-tile__foot">
              <LifecycleBadge status={row.lesson?.status} state={row.entry.state} />
              <LessonActions library={library} lessonId={row.entry.id} onChanged={onReload} extraEntries={entriesFor(row)} withOpen />
            </span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ol className="st-lessons">
      {rows.map((row, position) => {
        const index = reorder ? reorder.indexOf(row) : position
        return (
          <li
            key={row.entry.id}
            className={`st-lesson-row ${reorder ? 'is-reorderable' : ''} ${dropIndex === index ? 'is-drop-target' : ''}`}
            draggable={Boolean(reorder)}
            onDragStart={(event) => {
              event.dataTransfer.setData(LESSON_DRAG, String(index))
              event.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={(event) => {
              if (!reorder || !event.dataTransfer.types.includes(LESSON_DRAG)) return
              event.preventDefault()
              setDropIndex(index)
            }}
            onDragLeave={() => setDropIndex((current) => (current === index ? null : current))}
            onDrop={(event) => {
              setDropIndex(null)
              const from = Number(event.dataTransfer.getData(LESSON_DRAG))
              if (!reorder || !Number.isInteger(from)) return
              event.preventDefault()
              reorder.onMove(from, index)
            }}
            onDragEnd={() => setDropIndex(null)}
          >
            <span className="st-lesson-row__handle" aria-hidden="true">
              {reorder ? '⋮⋮' : ''}
            </span>
            <span className="st-lesson-row__number">
              {numbers ? String(numbers[position]).padStart(2, '0') : ''}
            </span>
            <span className="st-lesson-row__thumb">
              <FinishedDrawing tutorial={row.entry.tutorial} />
            </span>
            <div className="st-lesson-row__body">
              <div className="st-lesson-row__head">
                <a
                  className="st-lesson-row__title"
                  href={routeHref({ name: 'lesson', lessonId: row.entry.id })}
                  data-lesson-link={row.entry.id}
                  onKeyDown={onTitleKeyDown(row)}
                  title={onKeyMove ? '⌥↑ / ⌥↓ moves it in the path' : undefined}
                >
                  {row.entry.tutorial.title}
                </a>
                <LifecycleBadge status={row.lesson?.status} state={row.entry.state} />
              </div>
              {row.lesson?.objective ? <p className="st-lesson-row__objective">{row.lesson.objective}</p> : null}
              <p className="st-lesson-row__meta">
                {meta(row)}
                {row.lesson?.notes ? (
                  <span className="st-lesson-row__note" title={row.lesson.notes}>
                    {' '}
                    · note: {row.lesson.notes}
                  </span>
                ) : null}
              </p>
            </div>
            <LessonActions library={library} lessonId={row.entry.id} onChanged={onReload} extraEntries={entriesFor(row)} withOpen />
          </li>
        )
      })}
    </ol>
  )
}

/** The path's title, edited where it is shown. Enter or leaving the field saves; Escape cancels. */
function RenameField({
  title,
  busy,
  onSave,
  onCancel,
}: {
  title: string
  busy: boolean
  onSave: (title: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(title)
  const done = useRef(false)
  const finish = (save: boolean) => {
    if (done.current) return
    done.current = true
    if (save && value.trim()) onSave(value.trim())
    else onCancel()
  }
  return (
    <form
      className="st-path-header__rename"
      onSubmit={(event) => {
        event.preventDefault()
        finish(true)
      }}
    >
      <input
        className="st-field__input"
        value={value}
        autoFocus
        disabled={busy}
        aria-label="Path title"
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => finish(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') finish(false)
        }}
      />
    </form>
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
