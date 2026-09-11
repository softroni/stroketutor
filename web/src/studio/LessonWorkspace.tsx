import { useEffect, useMemo, useState } from 'react'

import { DebugPanel } from '../app/DebugPanel'
import { estimateLearnerSeconds, formatMinutes } from '../catalog/metrics'
import { findLesson, findPathOfLesson, type Catalog, type Lesson, type LearningPath } from '../catalog/types'
import { TutorialPlayer } from '../player/TutorialPlayer'
import { totalDuration, totalStrokes } from '../schema/types'
import { parseTutorialJSON, validateTutorial, type ValidationIssue } from '../schema/validate'

import { ApiError, readTutorial, saveCatalog, saveTutorial, uploadReference } from './api'
import { ApprovalDialog } from './ApprovalDialog'
import { EditCanvas, type Replay } from './editor/EditCanvas'
import { commit, createHistory, redo, undo } from './editor/history'
import { Inspector } from './editor/Inspector'
import {
  EditError,
  deleteStrokes,
  groupIntoNewStep,
  locateStroke,
  mergeWithNext,
  moveStrokes,
  reorderSteps,
  reorderStrokes,
  splitStep,
  strokeUids,
  toEditable,
  toTutorial,
  updateStep,
  updateStrokes,
  type EditableTutorial,
} from './editor/ops'
import { StepEditor } from './editor/StepEditor'
import { IssueList } from './IssueList'
import type { Library, TutorialEntry } from './library'
import { AnalysisPanel } from './NewLessonView'
import { qualityWarnings } from './quality'
import { ReferencePanel } from './ReferencePanel'
import { routeHref } from './route'
import { StatusPill } from './StatusPill'

export interface LessonWorkspaceProps {
  library: Library
  /** The catalog as shown, which may hold an unsaved lesson order. */
  catalog: Catalog | null
  lessonId: string
  /** Called after anything is written, so the Studio re-reads shared/. */
  onSaved: () => Promise<void>
}

/**
 * The primary Studio surface (master plan §17): the real-world reference, the
 * drawing and the teaching structure side by side, so both the simplification
 * and the teaching order can be judged, corrected and saved without leaving
 * the page.
 */
export function LessonWorkspace({ library, catalog, lessonId, onSaved }: LessonWorkspaceProps) {
  const entry = library.tutorials.get(lessonId)
  if (!entry) {
    return (
      <div className="st-empty">
        <h1>No tutorial called “{lessonId}”</h1>
        <p>
          The Studio looks for <code>shared/Tutorials/{lessonId}.json</code>. It may be missing or
          invalid.
        </p>
        <a className="st-button" href={routeHref({ name: 'paths', pathId: null })}>
          Back to paths
        </a>
      </div>
    )
  }

  return (
    <LessonEditor
      library={library}
      entry={entry}
      lesson={catalog ? findLesson(catalog, lessonId) : undefined}
      path={catalog ? findPathOfLesson(catalog, lessonId) : undefined}
      onSaved={onSaved}
    />
  )
}

type Mode = 'edit' | 'preview'
type BottomPanel = 'inspector' | 'generation' | 'advanced'

interface SaveReport {
  file: string
  /** The file read back from disk matches what was previewed. */
  identical: boolean
  approved: boolean
  steps: number
  strokes: number
}

interface SaveFailure {
  message: string
  issues: ValidationIssue[]
}

function LessonEditor({
  library,
  entry,
  lesson,
  path,
  onSaved,
}: {
  library: Library
  entry: TutorialEntry
  lesson: Lesson | undefined
  path: LearningPath | undefined
  onSaved: () => Promise<void>
}) {
  const original = entry.tutorial
  const [history, setHistory] = useState(() => createHistory(toEditable(original)))
  const [selection, setSelection] = useState<ReadonlySet<string>>(() => new Set())
  const [activeStep, setActiveStep] = useState(0)
  const [mode, setMode] = useState<Mode>('edit')
  const [colorBySteps, setColorBySteps] = useState(true)
  const [replay, setReplay] = useState<Replay | null>(null)
  const [panel, setPanel] = useState<BottomPanel>('inspector')
  const [editError, setEditError] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveReport, setSaveReport] = useState<SaveReport | null>(null)
  const [saveFailure, setSaveFailure] = useState<SaveFailure | null>(null)

  const doc = history.present
  const tutorial = useMemo(() => toTutorial(doc), [doc])
  const validation = useMemo(() => validateTutorial(tutorial), [tutorial])
  // Compared with the file as last read from disk, so a save clears it.
  const changed = useMemo(
    () => JSON.stringify(tutorial) !== JSON.stringify(original),
    [tutorial, original],
  )
  const activeStepIndex = Math.min(activeStep, doc.steps.length - 1)

  const previous = useMemo(() => {
    const index = path ? path.lessonIds.indexOf(entry.id) : -1
    return path && index > 0 ? library.tutorials.get(path.lessonIds[index - 1])?.tutorial : undefined
  }, [path, entry.id, library])
  const warnings = useMemo(
    () => (validation.ok ? qualityWarnings(validation.tutorial, previous) : []),
    [validation, previous],
  )

  // Undo can bring back a document where part of the selection no longer exists.
  const liveSelection = useMemo<ReadonlySet<string>>(() => {
    const alive = new Set(strokeUids(doc))
    return new Set([...selection].filter((uid) => alive.has(uid)))
  }, [doc, selection])
  const selectedInOrder = strokeUids(doc).filter((uid) => liveSelection.has(uid))

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Text fields keep their own undo.
      const target = event.target as HTMLElement | null
      if (target && (target.closest('input, textarea, select') || target.isContentEditable)) return

      if (event.key === 'Escape') {
        setSelection(new Set())
        return
      }
      if (!(event.metaKey || event.ctrlKey)) return
      const key = event.key.toLowerCase()
      if (key === 'z') {
        event.preventDefault()
        setHistory((current) => (event.shiftKey ? redo(current) : undo(current)))
      } else if (key === 'y') {
        event.preventDefault()
        setHistory((current) => redo(current))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Unsaved edits live only in this page; a reload or close asks first.
  useEffect(() => {
    if (!changed) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [changed])

  /** Runs one editing operation; a refusal is shown, never thrown at the creator. */
  const apply = (
    operation: (current: EditableTutorial) => EditableTutorial,
    key: string | null = null,
  ): EditableTutorial | null => {
    let next: EditableTutorial
    try {
      next = operation(history.present)
    } catch (error) {
      if (error instanceof EditError) {
        setEditError(error.message)
        return null
      }
      throw error
    }
    setEditError(null)
    setHistory(commit(history, next, key))
    return next
  }

  const focusStepOf = (next: EditableTutorial | null, uid: string | undefined) => {
    const where = next && uid ? locateStroke(next, uid) : null
    if (where) setActiveStep(where.stepIndex)
  }

  const pickStroke = (uid: string | null, additive: boolean) => {
    if (uid === null) {
      if (!additive) setSelection(new Set())
      return
    }
    setSelection((current) => {
      if (additive) {
        const next = new Set(current)
        if (next.has(uid)) next.delete(uid)
        else next.add(uid)
        return next
      }
      return current.size === 1 && current.has(uid) ? new Set() : new Set([uid])
    })
    focusStepOf(doc, uid)
  }

  const playReplay = (uids: string[]) => {
    if (uids.length === 0) return
    setMode('edit')
    setReplay((current) => ({ uids, runId: (current?.runId ?? 0) + 1 }))
  }

  /**
   * Rewrites the catalog as it is on disk with this one lesson changed. An
   * unsaved lesson order on the Paths view is deliberately not swept along.
   */
  const saveLessonMeta = async (change: (current: Lesson) => Lesson) => {
    const disk = library.catalog
    if (!disk || !lesson) throw new ApiError(0, 'This lesson is not in shared/Catalog/lessons.json.')
    await saveCatalog(
      { catalogVersion: 1, paths: disk.paths },
      {
        catalogVersion: 1,
        lessons: disk.lessons.map((candidate) => (candidate.id === lesson.id ? change(candidate) : candidate)),
      },
      { paths: library.catalogEtags.paths ?? null, lessons: library.catalogEtags.lessons ?? null },
    )
  }

  /** Validate → write → (approve) → read back from disk and compare (§27). */
  const save = async (approve: boolean) => {
    if (!validation.ok) return
    const saved = validation.tutorial
    setSaving(true)
    setSaveFailure(null)
    setSaveReport(null)
    let wrote = false
    try {
      const written = await saveTutorial(entry.id, saved, entry.etag ?? null)
      wrote = true
      const approved = approve && lesson !== undefined && lesson.status !== 'approved'
      if (approved) await saveLessonMeta((current) => ({ ...current, status: 'approved' }))

      // The proof that what was previewed is what is on disk: read it back.
      const stored = await readTutorial(entry.id)
      const reread = parseTutorialJSON(stored.text)
      setSaveReport({
        file: written.file,
        identical: reread.ok && JSON.stringify(reread.tutorial) === JSON.stringify(saved),
        approved,
        steps: saved.steps.length,
        strokes: totalStrokes(saved),
      })
      setApproving(false)
    } catch (error) {
      setSaveFailure(
        error instanceof ApiError
          ? { message: error.message, issues: error.issues }
          : { message: String(error), issues: [] },
      )
    } finally {
      // Re-read shared/ whenever something was written, even if a later step
      // failed, so the next save names the right version.
      if (wrote) await onSaved()
      setSaving(false)
    }
  }

  const addReference = async (file: File, source: string, license: string) => {
    const stored = await uploadReference(entry.id, file)
    await saveLessonMeta((current) => ({ ...current, reference: { file: stored.file, source, license } }))
    await onSaved()
  }

  const reference = lesson?.reference
  const referenceUrl = reference ? library.referenceUrl(reference.file) : undefined
  const uploadBlockedBecause = !library.writable
    ? 'Adding one needs the Studio server (npm run dev).'
    : !lesson
      ? 'Photos are recorded in shared/Catalog/lessons.json, so add this lesson there first.'
      : null
  const canApprove = validation.ok && lesson !== undefined && (changed || lesson.status !== 'approved')

  return (
    <div className="st-workspace">
      <header className="st-workspace__bar">
        <nav className="st-crumbs" aria-label="Breadcrumb">
          <a href={routeHref({ name: 'paths', pathId: path?.id ?? null })}>
            {path?.title ?? 'Not in a path'}
          </a>
          <span className="st-crumbs__sep" aria-hidden="true">
            /
          </span>
          <span aria-current="page">{tutorial.title}</span>
        </nav>
        <div className="st-workspace__actions">
          {lesson ? <StatusPill status={lesson.status} /> : <span className="st-pill">Not catalogued</span>}
          <div className="st-segmented" role="group" aria-label="Mode">
            <button type="button" aria-pressed={mode === 'edit'} onClick={() => setMode('edit')}>
              Edit
            </button>
            <button
              type="button"
              aria-pressed={mode === 'preview'}
              disabled={!validation.ok}
              title={validation.ok ? undefined : 'Fix the validation problems first.'}
              onClick={() => {
                setReplay(null)
                setMode('preview')
              }}
            >
              Preview as learner
            </button>
          </div>
        </div>
      </header>

      {lesson ? <p className="st-workspace__objective">{lesson.objective}</p> : null}

      <div className="st-toolbar" role="toolbar" aria-label="Editing">
        <button
          type="button"
          className="st-button"
          disabled={history.past.length === 0}
          onClick={() => setHistory(undo(history))}
          title="Undo (⌘Z)"
        >
          ↶ Undo
        </button>
        <button
          type="button"
          className="st-button"
          disabled={history.future.length === 0}
          onClick={() => setHistory(redo(history))}
          title="Redo (⇧⌘Z)"
        >
          ↷ Redo
        </button>
        <button type="button" className="st-button" onClick={() => playReplay(strokeUids(doc))}>
          ▶ Replay lesson
        </button>
        <label className="st-check">
          <input
            type="checkbox"
            checked={colorBySteps}
            onChange={(event) => setColorBySteps(event.target.checked)}
          />
          Colour by step
        </label>
        <span className="st-toolbar__spacer" />
        {validation.ok ? (
          <span className="st-valid">Valid v1 tutorial</span>
        ) : (
          <span className="st-invalid">
            {validation.issues.length} {validation.issues.length === 1 ? 'problem' : 'problems'}
          </span>
        )}
        {changed ? (
          <button
            type="button"
            className="st-link-button"
            onClick={() => {
              setSelection(new Set())
              apply(() => toEditable(original))
            }}
          >
            Revert to saved
          </button>
        ) : null}
        {library.writable ? (
          <>
            <button
              type="button"
              className="st-button"
              disabled={!changed || !validation.ok || saving}
              onClick={() => void save(false)}
            >
              {saving && !approving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className={`st-button ${approving ? 'st-button--on' : ''}`}
              aria-expanded={approving}
              disabled={!canApprove || saving}
              title={lesson ? undefined : 'Only catalogued lessons can be approved.'}
              onClick={() => setApproving((open) => !open)}
            >
              Approve…
            </button>
          </>
        ) : null}
      </div>

      {approving ? (
        <ApprovalDialog
          warnings={warnings}
          busy={saving}
          onConfirm={() => void save(true)}
          onCancel={() => setApproving(false)}
        />
      ) : null}

      {changed ? (
        <p className="st-notice" role="status">
          {library.writable
            ? `Unsaved changes. Save writes shared/Tutorials/${entry.fileName}; leaving this lesson discards them.`
            : 'Edited in this session only: this is a read-only copy. Run npm run dev to save.'}
        </p>
      ) : null}
      {saveReport && !changed ? (
        saveReport.identical ? (
          <p className="st-notice st-notice--success" role="status">
            Saved {saveReport.file} and read it back from disk: {saveReport.steps} steps and{' '}
            {saveReport.strokes} strokes, identical to the preview.
            {saveReport.approved ? ' Marked approved in shared/Catalog/lessons.json.' : ''}
          </p>
        ) : (
          <p className="st-notice st-notice--error" role="alert">
            Saved {saveReport.file}, but the file read back from disk differs from the preview.
            Reload the Studio and check the file before approving.
          </p>
        )
      ) : null}
      {saveFailure ? (
        saveFailure.issues.length > 0 ? (
          <IssueList heading={saveFailure.message} issues={saveFailure.issues} />
        ) : (
          <p className="st-notice st-notice--error" role="alert">
            {saveFailure.message}
          </p>
        )
      ) : null}
      {editError ? (
        <p className="st-notice st-notice--error" role="alert">
          {editError}
        </p>
      ) : null}
      {!validation.ok ? (
        <IssueList
          heading="A player would refuse this lesson"
          note="Previewing needs a valid tutorial, and so does saving."
          issues={validation.issues}
        />
      ) : null}

      <div className="st-workspace__grid">
        <section className="st-panel" aria-labelledby="st-reference-heading">
          <h2 id="st-reference-heading" className="st-label">
            Reference
          </h2>
          <ReferencePanel
            title={tutorial.title}
            reference={reference}
            url={referenceUrl}
            uploadBlockedBecause={uploadBlockedBecause}
            onUpload={addReference}
          />
        </section>

        <section className="st-panel" aria-labelledby="st-drawing-heading">
          <h2 id="st-drawing-heading" className="st-label">
            {mode === 'preview' ? 'Learner preview' : 'Drawing'}
          </h2>
          {mode === 'preview' && validation.ok ? (
            // The real player, not an imitation (§19): whatever the learner
            // would see, the creator sees here — edits included.
            <TutorialPlayer tutorial={validation.tutorial} />
          ) : (
            <>
              <div
                className="st-workspace__canvas"
                style={{ aspectRatio: `${doc.canvas.width} / ${doc.canvas.height}` }}
              >
                <EditCanvas
                  doc={doc}
                  selection={liveSelection}
                  colorBySteps={colorBySteps}
                  replay={replay}
                  onSelect={pickStroke}
                />
              </div>
              <p className="st-workspace__meta">
                {formatMinutes(estimateLearnerSeconds(tutorial))} for a learner ·{' '}
                {tutorial.steps.length} steps · {totalStrokes(tutorial)} strokes ·{' '}
                {totalDuration(tutorial).toFixed(1)}s of animation
              </p>
            </>
          )}
        </section>

        <section className="st-panel" aria-labelledby="st-steps-heading">
          <h2 id="st-steps-heading" className="st-label">
            Steps
          </h2>
          <StepEditor
            doc={doc}
            selection={liveSelection}
            activeStepIndex={activeStepIndex}
            onActivateStep={setActiveStep}
            onPickStroke={pickStroke}
            onReorderSteps={(from, to) => {
              if (apply((current) => reorderSteps(current, from, to)) && activeStepIndex === from) {
                setActiveStep(to)
              }
            }}
            onReorderStroke={(stepIndex, from, to) =>
              apply((current) => reorderStrokes(current, stepIndex, from, to))
            }
            onSplit={(stepIndex, at) => {
              if (apply((current) => splitStep(current, stepIndex, at))) setActiveStep(stepIndex + 1)
            }}
            onMergeWithNext={(stepIndex) => {
              if (apply((current) => mergeWithNext(current, stepIndex))) setActiveStep(stepIndex)
            }}
            onReplay={playReplay}
          />
        </section>
      </div>

      <section className="st-panel st-workspace__bottom">
        <div className="st-tabs" role="tablist" aria-label="Details">
          <button
            type="button"
            role="tab"
            className="st-tab"
            aria-selected={panel === 'inspector'}
            onClick={() => setPanel('inspector')}
          >
            Inspector
          </button>
          {lesson?.generation ? (
            <button
              type="button"
              role="tab"
              className="st-tab"
              aria-selected={panel === 'generation'}
              onClick={() => setPanel('generation')}
            >
              Generation
            </button>
          ) : null}
          <button
            type="button"
            role="tab"
            className="st-tab"
            aria-selected={panel === 'advanced'}
            onClick={() => setPanel('advanced')}
          >
            Advanced
          </button>
        </div>
        {panel === 'inspector' ? (
          <div role="tabpanel">
            <Inspector
              doc={doc}
              selection={liveSelection}
              activeStepIndex={activeStepIndex}
              onUpdateStep={(stepIndex, patch, key) =>
                apply((current) => updateStep(current, stepIndex, patch), key)
              }
              onUpdateStrokes={(patch, key) =>
                apply((current) => updateStrokes(current, liveSelection, patch), key)
              }
              onGroup={() =>
                focusStepOf(
                  apply((current) => groupIntoNewStep(current, liveSelection)),
                  selectedInOrder[0],
                )
              }
              onMoveTo={(stepId) =>
                focusStepOf(
                  apply((current) => moveStrokes(current, liveSelection, stepId)),
                  selectedInOrder[0],
                )
              }
              onDelete={() => {
                if (apply((current) => deleteStrokes(current, liveSelection))) setSelection(new Set())
              }}
              onReplaySelection={() => playReplay(selectedInOrder)}
              onClearSelection={() => setSelection(new Set())}
            />
          </div>
        ) : panel === 'generation' && lesson?.generation ? (
          <div role="tabpanel" className="st-generation">
            <p className="st-field__hint">
              Generated {new Date(lesson.generation.createdAt).toLocaleString()} by{' '}
              <code>{lesson.generation.model}</code> with prompt {lesson.generation.promptVersion}.
            </p>
            <p>
              <strong>Goal:</strong> {lesson.generation.goal}
              {lesson.generation.constraints ? (
                <>
                  <br />
                  <strong>Constraints:</strong> {lesson.generation.constraints}
                </>
              ) : null}
            </p>
            <AnalysisPanel analysis={lesson.generation.analysis} />
          </div>
        ) : (
          <div role="tabpanel">
            <DebugPanel tutorial={tutorial} onClose={() => setPanel('inspector')} />
          </div>
        )}
      </section>
    </div>
  )
}
