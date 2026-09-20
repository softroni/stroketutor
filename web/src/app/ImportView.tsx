import { useCallback, useState } from 'react'

import { catalogFiles } from '../catalog/types'
import { TutorialPlayer } from '../player/TutorialPlayer'
import type { Sample } from '../samples'
import type { Tutorial } from '../schema/types'
import { parseTutorialJSON, type ValidationIssue } from '../schema/validate'
import { saveCatalog, saveTutorial } from '../studio/api'
import { ConfirmDialog } from '../studio/ConfirmDialog'
import type { Library } from '../studio/library'
import { slugify } from '../studio/pathOps'

import { DebugPanel } from './DebugPanel'
import { TutorialSource } from './TutorialSource'
import './app.css'

const DEFAULT_SAMPLE = 'sun.json'
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

interface Loaded {
  tutorial: Tutorial
  label: string
  /** Bumped on every successful load so the player remounts with fresh state. */
  generation: number
}

export interface ImportViewProps {
  /** Every lesson in the working library, as raw text. */
  samples: Sample[]
  /** With the Studio server, a loaded tutorial can be kept as a workspace draft. */
  library?: Library
  /** Called once a draft is kept, to re-read the library and open it. */
  onCreated?: (lessonId: string) => Promise<void>
}

/**
 * Load any tutorial JSON — a sample, picked, dropped or pasted — then validate
 * and play it. Nothing is saved unless it is kept as a workspace draft, which
 * brings a hand-made or generated document into the authoring pipeline without
 * touching `shared/`.
 */
export function ImportView({ samples, library, onCreated }: ImportViewProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(() => {
    const first = samples.find((sample) => sample.fileName === DEFAULT_SAMPLE) ?? samples[0]
    const result = first ? parseTutorialJSON(first.source) : null
    return first && result?.ok ? { tutorial: result.tutorial, label: first.fileName, generation: 0 } : null
  })
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null)
  const [failedLabel, setFailedLabel] = useState<string | null>(null)
  const [debugOpen, setDebugOpen] = useState(false)
  const [keeping, setKeeping] = useState(false)

  const handleLoadText = useCallback((text: string, label: string) => {
    const result = parseTutorialJSON(text)
    if (!result.ok) {
      // The previous document stays on the canvas: a blank canvas with no
      // explanation is the one outcome that helps nobody.
      setIssues(result.issues)
      setFailedLabel(label)
      return
    }
    setIssues(null)
    setFailedLabel(null)
    setLoaded((previous) => ({
      tutorial: result.tutorial,
      label,
      generation: (previous?.generation ?? 0) + 1,
    }))
  }, [])

  const canKeep = Boolean(loaded && library?.writable && library.catalog && onCreated)

  return (
    <div className="st-import">
      <div className="st-import__bar">
        <div>
          <h1 className="st-import__title">Import &amp; test</h1>
          <p className="st-import__note">
            Load any tutorial JSON to validate it and play it. Nothing is saved unless you keep it as a draft.
          </p>
        </div>
        <div className="st-import__actions">
          {canKeep ? (
            <button type="button" className="st-button" onClick={() => setKeeping(true)}>
              Save as workspace draft…
            </button>
          ) : null}
          <button
            type="button"
            className={`st-button ${debugOpen ? 'st-button--on' : ''}`}
            onClick={() => setDebugOpen((open) => !open)}
            aria-pressed={debugOpen}
            disabled={!loaded}
          >
            {debugOpen ? 'Hide debug' : 'Show debug'}
          </button>
        </div>
      </div>

      <div className={`st-app__main ${debugOpen && loaded ? 'is-debugging' : ''}`}>
        <TutorialSource
          samples={samples}
          onLoadText={handleLoadText}
          activeLabel={loaded?.label ?? 'nothing yet'}
          issues={issues}
          failedLabel={failedLabel}
        />

        <div className="st-app__stage">
          {loaded ? (
            <TutorialPlayer key={loaded.generation} tutorial={loaded.tutorial} />
          ) : (
            <p className="st-import__note">Load a tutorial to play it here.</p>
          )}
        </div>

        {debugOpen && loaded ? (
          <DebugPanel tutorial={loaded.tutorial} onClose={() => setDebugOpen(false)} />
        ) : null}
      </div>

      {keeping && loaded && library && onCreated ? (
        <SaveDraftDialog
          library={library}
          tutorial={loaded.tutorial}
          onCreated={onCreated}
          onClose={() => setKeeping(false)}
        />
      ) : null}
    </div>
  )
}

/** A lesson id not yet used by any lesson: `house`, then `house-2`, `house-3`… */
function freeId(base: string, library: Library): string {
  const start = ID_PATTERN.test(base) ? base : 'imported-lesson'
  let id = start
  for (let n = 2; isTaken(id, library); n += 1) id = `${start}-${n}`
  return id
}

/**
 * Whether an id is spoken for. A planned lesson with nothing drawn for it is
 * not: importing a tutorial under its id fills the place it was holding.
 */
function isTaken(id: string, library: Library): boolean {
  if (library.tutorials.has(id)) return true
  const lesson = library.catalog?.lessons.find((candidate) => candidate.id === id)
  return Boolean(lesson) && lesson?.status !== 'planned'
}

function plannedLesson(id: string, library: Library) {
  if (library.tutorials.has(id)) return undefined
  const lesson = library.catalog?.lessons.find((candidate) => candidate.id === id)
  return lesson?.status === 'planned' ? lesson : undefined
}

/**
 * Keeps the loaded tutorial as a draft in the workspace: its own id, a place
 * in a path, and the one-line objective every lesson needs. It then opens in
 * the lesson workspace like any other draft.
 */
function SaveDraftDialog({
  library,
  tutorial,
  onCreated,
  onClose,
}: {
  library: Library
  tutorial: Tutorial
  onCreated: (lessonId: string) => Promise<void>
  onClose: () => void
}) {
  const catalog = library.catalog
  const [title, setTitle] = useState(tutorial.title)
  const [lessonId, setLessonId] = useState(() => freeId(slugify(tutorial.id || tutorial.title), library))
  const [pathId, setPathId] = useState(catalog?.paths[0]?.id ?? '')
  const [objective, setObjective] = useState('')

  const planned = plannedLesson(lessonId, library)
  const taken = isTaken(lessonId, library)
  const problem = !catalog
    ? 'The curriculum could not be read, so the draft has nowhere to go.'
    : !title.trim()
      ? 'Give the lesson a title.'
      : !ID_PATTERN.test(lessonId)
        ? 'The id must use lowercase letters, digits and single dashes.'
        : taken
          ? `“${lessonId}” is already a lesson; choose another id.`
          : !objective.trim()
            ? 'Write the one-line objective.'
            : null

  return (
    <ConfirmDialog
      title="Save as a workspace draft"
      confirmLabel="Save draft and open it"
      busyLabel="Saving…"
      confirmDisabled={problem !== null}
      focusField
      onClose={onClose}
      onConfirm={async () => {
        if (!catalog) return
        await saveTutorial(lessonId, { ...tutorial, id: lessonId, title: title.trim() }, null)
        const entry = { id: lessonId, status: 'draft' as const, objective: objective.trim() }
        // Filling a placeholder keeps the place it held; anything else joins a path at the end.
        const files = catalogFiles({
          ...catalog,
          paths: planned
            ? catalog.paths
            : catalog.paths.map((path) =>
                path.id === pathId ? { ...path, lessonIds: [...path.lessonIds, lessonId] } : path,
              ),
          lessons: planned
            ? catalog.lessons.map((lesson) => (lesson.id === lessonId ? entry : lesson))
            : [...catalog.lessons, entry],
        })
        await saveCatalog(files.paths, files.lessons, {
          paths: library.catalogEtags.paths ?? null,
          lessons: library.catalogEtags.lessons ?? null,
        })
        await onCreated(lessonId)
      }}
    >
      <p>
        It goes into your workspace as a draft, outside git, and opens in the lesson workspace. Nothing reaches
        shared/ until you publish it.
      </p>
      {planned ? (
        <p className="st-notice" role="status">
          “{lessonId}” is a planned lesson. Saving fills it and keeps its place in its path.
        </p>
      ) : null}
      <label className="st-field">
        <span className="st-field__label">Title</span>
        <input className="st-field__input" value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="st-field">
        <span className="st-field__label">Id (also its name in shared/ once published)</span>
        <input className="st-field__input" value={lessonId} onChange={(event) => setLessonId(event.target.value)} />
      </label>
      {planned ? null : (
        <label className="st-field">
          <span className="st-field__label">Path</span>
          <select className="st-field__input" value={pathId} onChange={(event) => setPathId(event.target.value)}>
            {(catalog?.paths ?? []).map((path) => (
              <option key={path.id} value={path.id}>
                {path.title}, at the end
              </option>
            ))}
            <option value="">No path yet</option>
          </select>
        </label>
      )}
      <label className="st-field">
        <span className="st-field__label">Objective (one line, shown in the path)</span>
        <input
          className="st-field__input"
          value={objective}
          placeholder="e.g. See a palm as a curve, a crown and a few fronds"
          onChange={(event) => setObjective(event.target.value)}
        />
      </label>
      {problem ? <p className="st-field__hint">{problem}</p> : null}
    </ConfirmDialog>
  )
}
