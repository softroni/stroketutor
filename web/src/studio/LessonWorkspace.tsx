import { useEffect, useMemo, useState } from 'react'

import { DebugPanel } from '../app/DebugPanel'
import { estimateLearnerSeconds, formatMinutes } from '../catalog/metrics'
import { findLesson, findPathOfLesson, type Catalog, type Lesson, type LearningPath } from '../catalog/types'
import { TutorialPlayer } from '../player/TutorialPlayer'
import { totalDuration, totalStrokes } from '../schema/types'
import { validateTutorial } from '../schema/validate'

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
import { routeHref } from './route'
import { StatusPill } from './StatusPill'

export interface LessonWorkspaceProps {
  library: Library
  catalog: Catalog | null
  lessonId: string
}

/**
 * The primary Studio surface (master plan §17): the real-world reference, the
 * drawing and the teaching structure side by side, so both the simplification
 * and the teaching order can be judged and corrected without leaving the page.
 */
export function LessonWorkspace({ library, catalog, lessonId }: LessonWorkspaceProps) {
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
    />
  )
}

type Mode = 'edit' | 'preview'
type BottomPanel = 'inspector' | 'advanced'

function LessonEditor({
  library,
  entry,
  lesson,
  path,
}: {
  library: Library
  entry: TutorialEntry
  lesson: Lesson | undefined
  path: LearningPath | undefined
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

  const doc = history.present
  const tutorial = useMemo(() => toTutorial(doc), [doc])
  const validation = useMemo(() => validateTutorial(tutorial), [tutorial])
  const changed = useMemo(
    () => JSON.stringify(tutorial) !== JSON.stringify(original),
    [tutorial, original],
  )
  const activeStepIndex = Math.min(activeStep, doc.steps.length - 1)

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

  // Edits live only in this page until the repository writer can save them.
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

  const reference = lesson?.reference
  const referenceUrl = reference ? library.referenceUrl(reference.file) : undefined

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
            <button
              type="button"
              aria-pressed={mode === 'edit'}
              onClick={() => setMode('edit')}
            >
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
      </div>

      {changed ? (
        <p className="st-notice" role="status">
          Edited in this session only. Saving to shared/Tutorials comes with the repository writer;
          leaving this lesson discards the edits.
        </p>
      ) : null}
      {editError ? (
        <p className="st-notice st-notice--error" role="alert">
          {editError}
        </p>
      ) : null}
      {!validation.ok ? (
        <IssueList
          heading="A player would refuse this lesson"
          note="Previewing needs a valid tutorial, and so will saving."
          issues={validation.issues}
        />
      ) : null}

      <div className="st-workspace__grid">
        <section className="st-panel" aria-labelledby="st-reference-heading">
          <h2 id="st-reference-heading" className="st-label">
            Reference
          </h2>
          {reference && referenceUrl ? (
            <figure className="st-reference">
              <img src={referenceUrl} alt={`Reference photo for ${tutorial.title}`} />
              <figcaption>
                {reference.source} · {reference.license}
              </figcaption>
            </figure>
          ) : (
            <div className="st-panel__empty">
              No reference photo yet. Uploading one comes with the repository writer.
            </div>
          )}
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
        ) : (
          <div role="tabpanel">
            <DebugPanel tutorial={tutorial} onClose={() => setPanel('inspector')} />
          </div>
        )}
      </section>
    </div>
  )
}
