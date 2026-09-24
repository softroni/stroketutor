import { useEffect, useMemo, useRef, useState } from 'react'

import { DebugPanel } from '../app/DebugPanel'
import { estimateLearnerSeconds, formatMinutes } from '../catalog/metrics'
import { catalogFiles, findLesson, findPathOfLesson, type Catalog, type Lesson, type LearningPath } from '../catalog/types'
import { describeEntry } from '../history/types'
import { TutorialPlayer } from '../player/TutorialPlayer'
import { totalDuration, totalStrokes, type Tutorial } from '../schema/types'
import { validateTutorial, type ValidationIssue } from '../schema/validate'

import { ApiError, releaseLesson, saveCatalog, saveTutorial, uploadReference } from './api'
import { ApprovalChecklist, QualityWarnings } from './ApprovalDialog'
import { ConfirmDialog } from './ConfirmDialog'
import { Drawer } from './Drawer'
import { EditCanvas, REPLAY_SPEEDS, replaySpeedLabel, type Replay, type ReplaySpeed } from './editor/EditCanvas'
import { commit, createHistory, redo, undo } from './editor/history'
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
import { SelectionBar } from './editor/SelectionBar'
import { StepEditor } from './editor/StepEditor'
import { HistoryPanel } from './HistoryPanel'
import { IssueList } from './IssueList'
import { LessonActions } from './LessonActions'
import type { Library, TutorialEntry } from './library'
import type { MenuEntry } from './Menu'
import { AnalysisPanel } from './NewLessonView'
import { qualityWarnings } from './quality'
import { ReferencePanel } from './ReferencePanel'
import { RegeneratePanel } from './RegeneratePanel'
import { routeHref } from './route'
import { ShortcutSheet } from './ShortcutSheet'
import { LifecycleBadge } from './StatusPill'
import { Toasts, useToasts } from './Toasts'
import { usePreviewVoice } from './voice/PreviewVoice'

export interface LessonWorkspaceProps {
  library: Library
  catalog: Catalog | null
  lessonId: string
  /** Called after anything is written, so the Studio re-reads the library. */
  onSaved: () => Promise<void>
}

/**
 * The primary Studio surface (master plan §17): the real-world reference, the
 * drawing and the teaching structure side by side, each in a full-height pane
 * of its own, so both the simplification and the teaching order can be judged
 * and corrected without scrolling or leaving the page.
 */
export function LessonWorkspace({ library, catalog, lessonId, onSaved }: LessonWorkspaceProps) {
  const entry = library.tutorials.get(lessonId)
  if (!entry) {
    // A planned lesson is in the curriculum but has nothing to edit yet, so it
    // is sent to the one screen that can do something about that.
    const planned = catalog ? findLesson(catalog, lessonId) : undefined
    if (planned?.status === 'planned') {
      return (
        <div className="st-empty">
          <h1>“{planned.title}” is still only planned</h1>
          <p>
            It holds a place in its path — {planned.objective} — but nothing has been drawn for it yet.
          </p>
          <a
            className="st-button st-button--primary"
            href={routeHref({ name: 'new', pathId: null, lessonId })}
          >
            Generate this lesson
          </a>
        </div>
      )
    }
    return (
      <div className="st-empty">
        <h1>No lesson called “{lessonId}”</h1>
        <p>It may have been deleted (look in the Trash), or it does not validate.</p>
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
type DrawerTab = 'regenerate' | 'history' | 'generation' | 'debug'
type Dialog = 'approve' | 'publish' | 'shortcuts'

type SaveState =
  | { kind: 'saved' }
  | { kind: 'saving' }
  | { kind: 'failed'; message: string; issues: ValidationIssue[] }

const PREFS_KEY = 'papercoach.studio.workspace'

interface WorkspacePrefs {
  rail: boolean
  overlay: boolean
  colorBySteps: boolean
  /** Paint the colour fills. Off, the drawing is lines only. */
  fills: boolean
  speed: ReplaySpeed
}

const DEFAULT_PREFS: WorkspacePrefs = { rail: true, overlay: false, colorBySteps: true, fills: true, speed: 1 }

/** Layout choices, remembered in this browser only. */
function readPrefs(): WorkspacePrefs {
  try {
    const stored = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<WorkspacePrefs>
    return {
      rail: stored.rail !== false,
      overlay: stored.overlay === true,
      colorBySteps: stored.colorBySteps !== false,
      fills: stored.fills !== false,
      speed: REPLAY_SPEEDS.includes(stored.speed as ReplaySpeed) ? (stored.speed as ReplaySpeed) : 1,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

function writePrefs(prefs: WorkspacePrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Storage can be unavailable (a private window); the defaults still work.
  }
}

/** How long typing must pause before the lesson saves itself. */
const AUTOSAVE_MS = 800

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
  const [history, setHistory] = useState(() => createHistory(toEditable(entry.tutorial)))
  const [selection, setSelection] = useState<ReadonlySet<string>>(() => new Set())
  const [activeStep, setActiveStep] = useState(0)
  /** Whether the active step is open in the steps pane; it can be folded to see the list. */
  const [stepOpen, setStepOpen] = useState(true)
  const [mode, setMode] = useState<Mode>('edit')
  const [prefs, setPrefs] = useState(readPrefs)
  const [replay, setReplay] = useState<Replay | null>(null)
  const [drawer, setDrawer] = useState<DrawerTab | null>(null)
  /** Regenerate stays mounted once opened, so a run in progress survives closing the drawer. */
  const [regenerateOpened, setRegenerateOpened] = useState(false)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [issuesOpen, setIssuesOpen] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'saved' })
  const voice = usePreviewVoice(entry.id, saveState.kind === 'saved')
  /** Bumped whenever a version may have been recorded, so the History tab reads it again. */
  const [historyKey, setHistoryKey] = useState(0)
  const [toasts, toast, dismissToast] = useToasts()
  const moveRef = useRef<HTMLSelectElement>(null)

  const updatePrefs = (patch: Partial<WorkspacePrefs>) =>
    setPrefs((current) => {
      const next = { ...current, ...patch }
      writePrefs(next)
      return next
    })

  const doc = history.present
  const tutorial = useMemo(() => toTutorial(doc), [doc])
  const validation = useMemo(() => validateTutorial(tutorial), [tutorial])
  const text = useMemo(() => JSON.stringify(tutorial), [tutorial])
  const activeStepIndex = Math.min(activeStep, doc.steps.length - 1)

  /**
   * Makes a step the active one and opens it, so its words are next to the
   * drawing. A replay is a view of one moment, so moving to a step leaves it.
   */
  const activateStep = (stepIndex: number) => {
    setActiveStep(stepIndex)
    setStepOpen(true)
    setReplay(null)
  }

  // ---------- Autosave ----------
  // What the workspace holds, and the version a save must name to replace it.
  // Only this editor's own saves move them, so a library re-read can never
  // hand a save a stale version.
  const savedText = useRef(JSON.stringify(entry.tutorial))
  const [savedVersion, setSavedVersion] = useState(savedText.current)
  const etag = useRef<string | null>(entry.etag ?? null)
  const queue = useRef<Promise<boolean>>(Promise.resolve(true))
  const dirty = text !== savedVersion

  /**
   * Saves the lesson as it is now into the workspace, one save at a time. A
   * checkpoint also keeps the version in History; an autosave does not.
   */
  const persist = (checkpoint: boolean, verdict = validation, snapshot = text): Promise<boolean> => {
    if (!library.writable || !verdict.ok) return Promise.resolve(false)
    const run = queue.current.then(async () => {
      if (!checkpoint && snapshot === savedText.current) return true
      setSaveState({ kind: 'saving' })
      try {
        const written = await saveTutorial(entry.id, verdict.tutorial, etag.current, { checkpoint })
        etag.current = written.etag
        savedText.current = snapshot
        setSavedVersion(snapshot)
        setSaveState({ kind: 'saved' })
        if (checkpoint) setHistoryKey((key) => key + 1)
        void onSaved()
        return true
      } catch (error) {
        setSaveState({
          kind: 'failed',
          message: error instanceof Error ? error.message : String(error),
          issues: error instanceof ApiError ? error.issues : [],
        })
        return false
      }
    })
    queue.current = run
    return run
  }

  /** Makes sure the latest edit is saved before something reads the saved version. */
  const flush = () => (dirty ? persist(false) : queue.current)

  useEffect(() => {
    if (!dirty || !validation.ok || !library.writable) return
    const timer = window.setTimeout(() => void persist(false, validation, text), AUTOSAVE_MS)
    return () => window.clearTimeout(timer)
    // The timer restarts on every edit; persist is read fresh when it fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, dirty, validation.ok])

  // Leaving the lesson inside the autosave pause still saves the last edit.
  const latest = useRef({ dirty, validation, text })
  latest.current = { dirty, validation, text }
  useEffect(
    () => () => {
      const last = latest.current
      if (last.dirty && last.validation.ok && library.writable) {
        void saveTutorial(entry.id, last.validation.tutorial, etag.current, { checkpoint: false }).then(
          () => onSaved(),
          () => undefined,
        )
      }
    },
    // Runs once, when the lesson closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Closing the tab during a save, or with edits that cannot be saved, asks first.
  useEffect(() => {
    if (!dirty && saveState.kind !== 'saving') return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty, saveState.kind])

  // ---------- Editing ----------

  const position = path ? Math.max(0, path.lessonIds.indexOf(entry.id)) : 0
  const previous = useMemo(
    () => (path && position > 0 ? library.tutorials.get(path.lessonIds[position - 1])?.tutorial : undefined),
    [path, position, library],
  )
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
        toast(error.message, 'error')
        return null
      }
      throw error
    }
    setHistory(commit(history, next, key))
    return next
  }

  const focusStepOf = (next: EditableTutorial | null, uid: string | undefined) => {
    const where = next && uid ? locateStroke(next, uid) : null
    if (where) activateStep(where.stepIndex)
  }

  const pickStroke = (uid: string | null, additive: boolean) => {
    setReplay(null)
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

  const playReplay = (uids: string[], label: string, wholeSteps: number[] = []) => {
    if (uids.length === 0 && wholeSteps.length === 0) return
    setMode('edit')
    setSelection(new Set())
    setReplay((current) => ({ uids, wholeSteps, label, runId: (current?.runId ?? 0) + 1 }))
  }
  const replayStep = (stepIndex = activeStepIndex) =>
    playReplay(doc.steps[stepIndex]?.strokes.map((stroke) => stroke.uid) ?? [], `step ${stepIndex + 1}`, [stepIndex])
  const replayLesson = () =>
    playReplay(
      strokeUids(doc),
      'the lesson',
      doc.steps.map((_, stepIndex) => stepIndex),
    )
  const replayAgain = () => {
    if (replay) playReplay(replay.uids, replay.label, replay.wholeSteps)
  }

  const group = () => {
    if (liveSelection.size === 0) return
    focusStepOf(
      apply((current) => groupIntoNewStep(current, liveSelection)),
      selectedInOrder[0],
    )
  }
  const removeSelection = () => {
    if (liveSelection.size === 0) return
    if (apply((current) => deleteStrokes(current, liveSelection))) setSelection(new Set())
  }

  /** Puts a whole other version in the editor as one undoable edit. */
  const putInEditor = (next: Tutorial, message: string) => {
    setSelection(new Set())
    setReplay(null)
    setMode('edit')
    activateStep(0)
    setDrawer(null)
    apply(() => toEditable(next))
    toast(`${message} Undo (⌘Z) brings back the previous version.`)
  }

  // ---------- The lesson's catalog entry ----------

  /** Rewrites the working curriculum with this one lesson changed. */
  const saveLessonMeta = async (change: (current: Lesson) => Lesson) => {
    const current = library.catalog
    if (!current || !lesson) throw new ApiError(0, 'This lesson is not in the curriculum.')
    const files = catalogFiles({
      ...current,
      lessons: current.lessons.map((candidate) => (candidate.id === lesson.id ? change(candidate) : candidate)),
    })
    await saveCatalog(files.paths, files.lessons, {
      paths: library.catalogEtags.paths ?? null,
      lessons: library.catalogEtags.lessons ?? null,
    })
  }

  const editDetails = async (change: (current: Lesson) => Lesson) => {
    try {
      await saveLessonMeta(change)
      await onSaved()
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const addReference = async (file: File, source: string, license: string) => {
    const stored = await uploadReference(entry.id, file)
    await saveLessonMeta((current) => ({ ...current, reference: { file: stored.file, source, license } }))
    await onSaved()
  }

  const updateReferenceDetails = async (source: string, license: string) => {
    await saveLessonMeta((current) =>
      current.reference ? { ...current, reference: { ...current.reference, source, license } } : current,
    )
    await onSaved()
  }

  const checkpoint = async () => {
    if (!validation.ok) {
      toast('This version has problems, so it cannot be kept yet.', 'error')
      return
    }
    if (await persist(true)) toast('Kept this version in History.')
  }

  const approve = async () => {
    if (!(await flush())) throw new Error('The lesson could not be saved, so it was not approved.')
    if (lesson && lesson.status !== 'approved') await saveLessonMeta((current) => ({ ...current, status: 'approved' }))
    await onSaved()
    toast('Approved: it is ready to publish.')
  }

  const publish = async () => {
    if (!(await flush())) throw new Error('The lesson could not be saved, so it was not published.')
    const released = await releaseLesson(entry.id)
    setHistoryKey((key) => key + 1)
    voice.reload()
    await onSaved()
    const { files, git } = released
    const notes = [released.voice.note, git.note].filter(Boolean)
    toast(
      <>
        Published{released.voice.published ? ' with Lina’s voice' : ''}
        {released.voice.recorded > 0 ? ` (${released.voice.recorded} recorded just now)` : ''}: {files.length}{' '}
        {files.length === 1 ? 'file' : 'files'} in shared/.{' '}
        {git.pushed ? (
          <>
            Committed and pushed to main as <code>{git.commit}</code>: “{git.subject}”.
          </>
        ) : git.committed ? (
          <>
            Committed as <code>{git.commit}</code>, not pushed.
          </>
        ) : null}
        {notes.map((note) => (
          <span key={note} className="st-toast__note">
            {' '}
            {note}
          </span>
        ))}
        {!git.committed && files.length > 0 ? <code className="st-toast__command">git add -- {files.join(' ')}</code> : null}
      </>,
      notes.length > 0 ? 'error' : 'success',
      { sticky: true },
    )
  }

  const openDrawer = (tab: DrawerTab) => {
    if (tab === 'regenerate') setRegenerateOpened(true)
    setDrawer(tab)
  }

  const reference = lesson?.reference
  const referenceUrl = reference ? library.referenceUrl(reference.file) : undefined

  // ---------- Keyboard ----------

  const onKey = useRef<(event: KeyboardEvent) => void>(() => undefined)
  onKey.current = (event: KeyboardEvent) => {
    const command = event.metaKey || event.ctrlKey
    const key = event.key.toLowerCase()
    // ⌘S works everywhere, even while typing an instruction.
    if (command && key === 's') {
      event.preventDefault()
      void checkpoint()
      return
    }
    if (document.querySelector('dialog[open]')) return
    const target = event.target instanceof HTMLElement ? event.target : null
    // Text fields keep their own keys, and their own undo. A checkbox does not type.
    if (target && (target.closest('textarea, select, input:not([type="checkbox"])') || target.isContentEditable)) return

    if (command) {
      if (key === 'z') {
        event.preventDefault()
        setHistory((current) => (event.shiftKey ? redo(current) : undo(current)))
      } else if (key === 'y') {
        event.preventDefault()
        setHistory((current) => redo(current))
      }
      return
    }
    if (event.altKey) return

    const stepCount = doc.steps.length
    switch (event.key) {
      case 'Escape':
        if (drawer) setDrawer(null)
        else if (replay) setReplay(null)
        else setSelection(new Set())
        return
      case 'ArrowUp':
      case 'k':
        event.preventDefault()
        activateStep(Math.max(0, activeStepIndex - 1))
        return
      case 'ArrowDown':
      case 'j':
        event.preventDefault()
        activateStep(Math.min(stepCount - 1, activeStepIndex + 1))
        return
      case ' ':
        event.preventDefault()
        if (event.shiftKey) replayLesson()
        else replayStep()
        return
      case 'Enter':
        if (!(target && target.closest('button, a'))) setStepOpen((open) => !open)
        return
      case 'l':
        updatePrefs({ fills: !prefs.fills })
        return
      case 'c':
        updatePrefs({ colorBySteps: !prefs.colorBySteps })
        return
      case 'r':
        if (referenceUrl) updatePrefs({ overlay: !prefs.overlay })
        return
      case '-':
      case '=':
      case '+': {
        const at = REPLAY_SPEEDS.indexOf(prefs.speed)
        const next = REPLAY_SPEEDS[Math.max(0, Math.min(REPLAY_SPEEDS.length - 1, at + (event.key === '-' ? -1 : 1)))]
        updatePrefs({ speed: next })
        return
      }
      case 'p':
        if (validation.ok) {
          setReplay(null)
          setMode((current) => (current === 'edit' ? 'preview' : 'edit'))
        }
        return
      case 'g':
        group()
        return
      case 'm':
        if (liveSelection.size > 0) {
          event.preventDefault()
          moveRef.current?.focus()
        }
        return
      case 'Backspace':
      case 'Delete':
        if (liveSelection.size > 0) {
          event.preventDefault()
          removeSelection()
        }
        return
      case '[':
        updatePrefs({ rail: !prefs.rail })
        return
      case '?':
        setDialog('shortcuts')
        return
    }
  }

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey.current(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  // ---------- What the header says ----------
  const uploadBlockedBecause = !library.writable
    ? 'Adding one needs the Studio server (npm run dev).'
    : !lesson
      ? 'Photos are recorded with the lesson in the curriculum, so add it there first.'
      : null
  const publishBlockedBecause = !lesson
    ? 'Only lessons in the curriculum can be published.'
    : !validation.ok
      ? 'Fix the validation problems first.'
      : entry.state === 'published' && !dirty && !voice.unpublished
        ? 'Published, and nothing has changed since: the lesson and Lina’s voice are both in shared/.'
        : null
  const problems = validation.ok ? [] : validation.issues

  const saveStatus = !library.writable ? (
    <span className="st-save-status">Read-only copy</span>
  ) : !validation.ok ? (
    <button type="button" className="st-save-status st-save-status--problem" onClick={() => setIssuesOpen((open) => !open)}>
      {problems.length} {problems.length === 1 ? 'problem' : 'problems'}: not saved
    </button>
  ) : saveState.kind === 'failed' ? (
    <button type="button" className="st-save-status st-save-status--problem" onClick={() => setIssuesOpen((open) => !open)}>
      Not saved
    </button>
  ) : saveState.kind === 'saving' || dirty ? (
    <span className="st-save-status">Saving…</span>
  ) : (
    <span className="st-save-status" title="Edits save themselves into your workspace. ⌘S keeps a version in History.">
      ✓ Saved
    </span>
  )

  const menuEntries: MenuEntry[] = [
    { label: 'Keep this version in History (⌘S)', disabled: !validation.ok, onSelect: () => void checkpoint() },
    { label: 'History', onSelect: () => openDrawer('history') },
    ...(lesson?.generation ? [{ label: 'How it was generated', onSelect: () => openDrawer('generation') }] : []),
    { label: 'Debug', onSelect: () => openDrawer('debug') },
    { label: 'Keyboard shortcuts (?)', onSelect: () => setDialog('shortcuts') },
  ]

  const drawerTabs: { id: DrawerTab; label: string; shown: boolean }[] = [
    { id: 'regenerate', label: 'Regenerate', shown: library.writable },
    { id: 'history', label: 'History', shown: library.writable },
    { id: 'generation', label: 'Generation', shown: Boolean(lesson?.generation) },
    { id: 'debug', label: 'Debug', shown: true },
  ]

  const steps = doc.steps.length

  return (
    <div className="st-workspace">
      <header className="st-workspace__bar">
        <nav className="st-crumbs" aria-label="Breadcrumb">
          <a href={path ? routeHref({ name: 'paths', pathId: path.id }) : routeHref({ name: 'unfiled' })}>
            {path?.title ?? 'Not in a path'}
          </a>
          <span className="st-crumbs__sep" aria-hidden="true">
            /
          </span>
          <span aria-current="page">{tutorial.title}</span>
        </nav>
        <LifecycleBadge status={lesson?.status} state={entry.state} />
        {saveStatus}
        <span className="st-workspace__spacer" />
        <button
          type="button"
          className="st-icon-button"
          disabled={history.past.length === 0}
          onClick={() => setHistory(undo(history))}
          aria-label="Undo (⌘Z)"
          title="Undo (⌘Z)"
        >
          ↶
        </button>
        <button
          type="button"
          className="st-icon-button"
          disabled={history.future.length === 0}
          onClick={() => setHistory(redo(history))}
          aria-label="Redo (⇧⌘Z)"
          title="Redo (⇧⌘Z)"
        >
          ↷
        </button>
        <div className="st-segmented" role="group" aria-label="Mode">
          <button type="button" aria-pressed={mode === 'edit'} onClick={() => setMode('edit')}>
            Edit
          </button>
          <button
            type="button"
            aria-pressed={mode === 'preview'}
            disabled={!validation.ok}
            title={validation.ok ? 'Preview as the learner will see it (P)' : 'Fix the validation problems first.'}
            onClick={() => {
              setReplay(null)
              setMode('preview')
            }}
          >
            Preview
          </button>
        </div>
        {library.writable ? (
          <>
            <button type="button" className="st-button st-button--compact" onClick={() => openDrawer('regenerate')}>
              Regenerate…
            </button>
            <button
              type="button"
              className="st-button st-button--compact"
              disabled={!validation.ok || !lesson || (lesson.status === 'approved' && !dirty)}
              title={lesson ? undefined : 'Only lessons in the curriculum can be approved.'}
              onClick={() => setDialog('approve')}
            >
              Approve…
            </button>
            <button
              type="button"
              className="st-button st-button--primary st-button--compact"
              disabled={publishBlockedBecause !== null}
              title={publishBlockedBecause ?? 'Approve this version, publish it with Lina’s voice, commit and push.'}
              onClick={() => setDialog('publish')}
            >
              Publish…
            </button>
          </>
        ) : null}
        <LessonActions
          library={library}
          lessonId={entry.id}
          onChanged={onSaved}
          withPublish={false}
          unsaved={dirty}
          extraEntries={menuEntries}
          onDeleted={() => {
            window.location.hash = routeHref({ name: 'paths', pathId: path?.id ?? null })
          }}
        />

        {issuesOpen && (problems.length > 0 || saveState.kind === 'failed') ? (
          <div className="st-popover" role="dialog" aria-label="Why the lesson is not saved">
            {problems.length > 0 ? (
              <IssueList
                heading="A player would refuse this lesson"
                note="It saves itself again as soon as these are fixed. Undo (⌘Z) steps back."
                issues={problems}
              />
            ) : saveState.kind === 'failed' ? (
              saveState.issues.length > 0 ? (
                <IssueList heading={saveState.message} issues={saveState.issues} />
              ) : (
                <p className="st-notice st-notice--error">{saveState.message}</p>
              )
            ) : null}
            <button type="button" className="st-link-button" onClick={() => setIssuesOpen(false)}>
              Close
            </button>
          </div>
        ) : null}
      </header>

      <div className={`st-workspace__panes ${prefs.rail ? '' : 'is-rail-closed'}`}>
        {prefs.rail ? (
          <aside className="st-rail" aria-label="Reference and lesson details">
            <div className="st-rail__head">
              <h2 className="st-label">Reference</h2>
              <button
                type="button"
                className="st-mini-button"
                aria-label="Hide the reference ([)"
                title="Hide the reference ([)"
                onClick={() => updatePrefs({ rail: false })}
              >
                «
              </button>
            </div>
            <ReferencePanel
              title={tutorial.title}
              reference={reference}
              url={referenceUrl}
              uploadBlockedBecause={uploadBlockedBecause}
              onUpload={addReference}
              onUpdateDetails={updateReferenceDetails}
            />
            <h2 className="st-label">Lesson</h2>
            {lesson ? (
              <LessonDetails
                key={lesson.id}
                lesson={lesson}
                path={path}
                position={position}
                editable={library.writable}
                onChange={editDetails}
              />
            ) : (
              <p className="st-field__hint">Not in the curriculum, so it has no objective or notes.</p>
            )}
          </aside>
        ) : (
          <aside className="st-rail is-closed" aria-label="Reference and lesson details">
            <button
              type="button"
              className="st-mini-button"
              aria-label="Show the reference ([)"
              title="Show the reference ([)"
              onClick={() => updatePrefs({ rail: true })}
            >
              »
            </button>
          </aside>
        )}

        <section className="st-stage-pane" aria-label={mode === 'preview' ? 'Learner preview' : 'Drawing'}>
          <div className="st-stage">
            {mode === 'preview' && validation.ok ? (
              // The real player, not an imitation (§19): whatever the learner
              // would see, the creator sees here — edits included.
              <div className="st-stage__player">
                <TutorialPlayer tutorial={validation.tutorial} fill onStep={voice.onStep} cardExtra={voice.controls} lina={voice.lina} />
              </div>
            ) : (
              <div className="st-stage__fit">
                <div
                  className="st-stage__paper"
                  style={{ ['--ratio' as string]: String(doc.canvas.width / doc.canvas.height) }}
                >
                  <EditCanvas
                    doc={doc}
                    selection={liveSelection}
                    colorBySteps={prefs.colorBySteps}
                    showFills={prefs.fills}
                    replay={replay}
                    speed={prefs.speed}
                    onSelect={pickStroke}
                    onStopReplay={() => setReplay(null)}
                    onReplayAgain={replayAgain}
                  />
                  {prefs.overlay && referenceUrl ? (
                    <img className="st-stage__overlay" src={referenceUrl} alt="" />
                  ) : null}
                </div>
              </div>
            )}
            {mode === 'edit' && selectedInOrder.length > 0 ? (
              <SelectionBar
                doc={doc}
                selected={selectedInOrder}
                moveRef={moveRef}
                onUpdateStrokes={(patch, key) => apply((current) => updateStrokes(current, liveSelection, patch), key)}
                onGroup={group}
                onMoveTo={(stepId) =>
                  focusStepOf(
                    apply((current) => moveStrokes(current, liveSelection, stepId)),
                    selectedInOrder[0],
                  )
                }
                onDelete={removeSelection}
                onReplay={() =>
                  playReplay(selectedInOrder, selectedInOrder.length === 1 ? 'the stroke' : `${selectedInOrder.length} strokes`)
                }
                onClear={() => setSelection(new Set())}
              />
            ) : null}
          </div>
          {mode === 'edit' ? (
            <div className="st-transport" role="toolbar" aria-label="Playback">
              <span className="st-transport__steps">
                <button
                  type="button"
                  className="st-mini-button"
                  aria-label="Previous step (↑)"
                  disabled={activeStepIndex === 0}
                  onClick={() => activateStep(activeStepIndex - 1)}
                >
                  ‹
                </button>
                Step {activeStepIndex + 1} of {steps}
                <button
                  type="button"
                  className="st-mini-button"
                  aria-label="Next step (↓)"
                  disabled={activeStepIndex === steps - 1}
                  onClick={() => activateStep(activeStepIndex + 1)}
                >
                  ›
                </button>
              </span>
              <span className="st-transport__group">
                <button type="button" className="st-button st-button--compact" onClick={() => replayStep()} title="Replay the step (Space)">
                  ▶ Step
                </button>
                <button type="button" className="st-button st-button--compact" onClick={replayLesson} title="Replay the lesson (⇧Space)">
                  ▶ Lesson
                </button>
                <span className="st-segmented st-segmented--tiny" role="group" aria-label="Replay speed">
                  {REPLAY_SPEEDS.map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      aria-pressed={prefs.speed === speed}
                      title={
                        speed === 'instant'
                          ? 'Skip the animation: show the drawing as it stands after the step (− / +)'
                          : `Replay at ${speed}× the learner's speed (− / +)`
                      }
                      onClick={() => updatePrefs({ speed })}
                    >
                      {replaySpeedLabel(speed)}
                    </button>
                  ))}
                </span>
              </span>
              <span className="st-transport__group">
                <label className="st-check" title="One colour per step, so the teaching order is visible (C)">
                  <input
                    type="checkbox"
                    checked={prefs.colorBySteps}
                    onChange={(event) => updatePrefs({ colorBySteps: event.target.checked })}
                  />
                  Colour by step
                </label>
                <label className="st-check" title="Hide the colour fills, so only the lines show (L)">
                  <input
                    type="checkbox"
                    checked={!prefs.fills}
                    onChange={(event) => updatePrefs({ fills: !event.target.checked })}
                  />
                  Lines only
                </label>
                {referenceUrl ? (
                  <label className="st-check" title="Show the reference photo faintly beneath the drawing (R)">
                    <input
                      type="checkbox"
                      checked={prefs.overlay}
                      onChange={(event) => updatePrefs({ overlay: event.target.checked })}
                    />
                    Reference underneath
                  </label>
                ) : null}
              </span>
              <span className="st-transport__meta">
                {formatMinutes(estimateLearnerSeconds(tutorial))} for a learner · {totalStrokes(tutorial)} strokes ·{' '}
                {totalDuration(tutorial).toFixed(1)}s of animation
              </span>
            </div>
          ) : null}
        </section>

        <section className="st-steps-pane" aria-labelledby="st-steps-heading">
          <div className="st-steps-pane__head">
            <h2 id="st-steps-heading" className="st-label">
              Steps
            </h2>
            <span className="st-steps-pane__count">
              {steps} steps · ? for shortcuts
            </span>
          </div>
          {voice.bookend('intro')}
          <StepEditor
            doc={doc}
            stepVoice={voice.stepVoice}
            selection={liveSelection}
            activeStepIndex={activeStepIndex}
            activeOpen={stepOpen}
            onActivateStep={(stepIndex) => {
              if (stepIndex === activeStepIndex) setStepOpen((open) => !open)
              else activateStep(stepIndex)
            }}
            onPickStroke={pickStroke}
            onReorderSteps={(from, to) => {
              if (apply((current) => reorderSteps(current, from, to)) && activeStepIndex === from) {
                activateStep(to)
              }
            }}
            onReorderStroke={(stepIndex, from, to) => apply((current) => reorderStrokes(current, stepIndex, from, to))}
            onSplit={(stepIndex, at) => {
              if (apply((current) => splitStep(current, stepIndex, at))) activateStep(stepIndex + 1)
            }}
            onMergeWithNext={(stepIndex) => {
              if (apply((current) => mergeWithNext(current, stepIndex))) activateStep(stepIndex)
            }}
            onReplayStep={(stepIndex) => {
              setActiveStep(stepIndex)
              replayStep(stepIndex)
            }}
            onReplayStroke={(uid, stepIndex, strokeIndex) => playReplay([uid], `stroke ${strokeIndex + 1} of step ${stepIndex + 1}`)}
            onUpdateStep={(stepIndex, patch, key) => apply((current) => updateStep(current, stepIndex, patch), key)}
          />
          {voice.bookend('outro')}
        </section>

        <Drawer
          open={drawer !== null}
          label="Lesson tools"
          onClose={() => setDrawer(null)}
          header={
            <div className="st-tabs" role="tablist" aria-label="Lesson tools">
              {drawerTabs
                .filter((tab) => tab.shown)
                .map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    className="st-tab"
                    aria-selected={drawer === tab.id}
                    onClick={() => openDrawer(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
            </div>
          }
        >
          {library.writable && regenerateOpened ? (
            <div hidden={drawer !== 'regenerate'}>
              <RegeneratePanel
                library={library}
                lessonId={entry.id}
                title={tutorial.title}
                lesson={lesson}
                path={path}
                position={position}
                current={validation.ok ? validation.tutorial : null}
                onUse={(next, result) => {
                  const plural = result.layer === 'steps' || result.layer === 'instructions'
                  putInEditor(next, `The new ${result.layer} from ${result.model} ${plural ? 'are' : 'is'} in the editor.`)
                }}
                onRecorded={() => setHistoryKey((key) => key + 1)}
                onClose={() => setDrawer(null)}
              />
            </div>
          ) : null}
          {drawer === 'history' && library.writable ? (
            <HistoryPanel
              lessonId={entry.id}
              current={validation.ok ? validation.tutorial : null}
              refreshKey={historyKey}
              onUse={(next, item) =>
                putInEditor(
                  next,
                  `The version “${describeEntry(item)}” from ${new Date(item.createdAt).toLocaleString()} is in the editor.`,
                )
              }
            />
          ) : null}
          {drawer === 'generation' && lesson?.generation ? (
            <div className="st-generation">
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
          ) : null}
          {drawer === 'debug' ? <DebugPanel tutorial={tutorial} onClose={() => setDrawer(null)} /> : null}
        </Drawer>
      </div>

      {dialog === 'approve' ? (
        <ConfirmDialog
          title="Approve this lesson?"
          confirmLabel="Approve"
          busyLabel="Approving…"
          onClose={() => setDialog(null)}
          onConfirm={approve}
        >
          <p>Marks the saved version approved, ready to publish. Nothing reaches shared/ until you publish.</p>
          <QualityWarnings warnings={warnings} />
          <ApprovalChecklist />
        </ConfirmDialog>
      ) : null}
      {dialog === 'publish' ? (
        <ConfirmDialog
          title={entry.state === 'published-edited' ? 'Approve and publish these changes?' : 'Approve and publish this lesson?'}
          confirmLabel="Approve & publish"
          busyLabel="Publishing…"
          onClose={() => setDialog(null)}
          onConfirm={publish}
        >
          <p>
            Writes <code>shared/Tutorials/{entry.fileName}</code>
            {reference ? ' and its photo' : ''}, and brings <code>shared/Catalog</code> in line with the curriculum.
            Anything Lina has not recorded yet is recorded, and her voice goes into <code>shared/Assets/Voice/</code>.
            Those files are then committed, under a message that says what changed, and pushed to <code>main</code>.
          </p>
          <QualityWarnings warnings={warnings} />
          <ApprovalChecklist open={false} />
        </ConfirmDialog>
      ) : null}
      {dialog === 'shortcuts' ? <ShortcutSheet onClose={() => setDialog(null)} /> : null}

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

/**
 * The lesson's own details, edited where they are read. Each field saves when
 * it loses focus, into the working curriculum.
 */
function LessonDetails({
  lesson,
  path,
  position,
  editable,
  onChange,
}: {
  lesson: Lesson
  path: LearningPath | undefined
  position: number
  editable: boolean
  onChange: (change: (current: Lesson) => Lesson) => Promise<void>
}) {
  const [objective, setObjective] = useState(lesson.objective)
  const [notes, setNotes] = useState(lesson.notes ?? '')

  return (
    <div className="st-lesson-details">
      <p className="st-field__hint">
        {path ? (
          <>
            Lesson {position + 1} of {path.lessonIds.length} in{' '}
            <a href={routeHref({ name: 'paths', pathId: path.id })}>{path.title}</a>
          </>
        ) : (
          'Not in a path'
        )}{' '}
        · id <code>{lesson.id}</code>
      </p>
      <label className="st-field">
        <span className="st-field__label">Objective</span>
        <textarea
          className="st-field__input"
          rows={2}
          value={objective}
          disabled={!editable}
          onChange={(event) => setObjective(event.target.value)}
          onBlur={() => {
            const next = objective.trim()
            if (next && next !== lesson.objective) void onChange((current) => ({ ...current, objective: next }))
            else setObjective(lesson.objective)
          }}
        />
      </label>
      <label className="st-field">
        <span className="st-field__label">Complexity</span>
        <select
          className="st-field__input"
          value={lesson.complexity ?? ''}
          disabled={!editable}
          onChange={(event) => {
            const value = event.target.value ? Number(event.target.value) : undefined
            void onChange(({ complexity: _drop, ...rest }) => (value ? { ...rest, complexity: value } : rest))
          }}
        >
          <option value="">Not set</option>
          {[1, 2, 3, 4, 5].map((level) => (
            <option key={level} value={level}>
              {level} of 5
            </option>
          ))}
        </select>
      </label>
      <label className="st-field">
        <span className="st-field__label">Notes (for you only)</span>
        <textarea
          className="st-field__input"
          rows={3}
          value={notes}
          disabled={!editable}
          placeholder="What to fix before approving, where it came from…"
          onChange={(event) => setNotes(event.target.value)}
          onBlur={() => {
            const next = notes.trim()
            if (next === (lesson.notes ?? '')) return
            void onChange(({ notes: _drop, ...rest }) => (next ? { ...rest, notes: next } : rest))
          }}
        />
      </label>
    </div>
  )
}
