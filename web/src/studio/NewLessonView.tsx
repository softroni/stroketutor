import { useEffect, useMemo, useState, type FormEvent } from 'react'

import type { Analysis, Lesson } from '../catalog/types'
import { totalStrokes, type Tutorial } from '../schema/types'
import { validateTutorial, type ValidationIssue } from '../schema/validate'

import { traceSvg, type TracedDrawing } from '../trace/traceSvg'

import {
  ApiError,
  generateFromTrace,
  generateLesson,
  saveCatalog,
  saveTutorial,
  uploadReference,
  type GenerateResult,
} from './api'
import { FinishedDrawing } from './FinishedDrawing'
import { IssueList } from './IssueList'
import type { Library } from './library'
import { slugify } from './pathOps'
import { qualityWarnings } from './quality'
import { ModelPicker } from './ModelPicker'
import { REFERENCE_TYPES, REFERENCE_TYPES_LABEL, imageForModel } from './referenceImage'
import { storedModel } from './settings'
import './editor/editor.css'

export interface NewLessonViewProps {
  library: Library
  initialPathId: string | null
  /** Called once a kept draft is on disk, to re-read shared/ and open it. */
  onCreated: (lessonId: string) => Promise<void>
}

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** An SVG reference is traced in the browser as soon as it is chosen. */
type TraceState =
  | { status: 'none' }
  | { status: 'tracing' }
  | { status: 'done'; drawing: TracedDrawing }
  | { status: 'failed'; message: string }

type Outcome =
  | { kind: 'idle' }
  | { kind: 'generating'; startedAt: number }
  | { kind: 'failed'; message: string }
  | { kind: 'rejected'; result: GenerateResult }
  | { kind: 'candidate'; result: GenerateResult; tutorial: Tutorial }

/**
 * A new lesson from a real-world photo (master plan §16, Appendix B). One
 * primary action runs the whole generation; nothing is written until the
 * creator keeps the result, and a failure never clears what they typed.
 */
export function NewLessonView({ library, initialPathId, onCreated }: NewLessonViewProps) {
  const catalog = library.catalog
  const [pathId, setPathId] = useState<string>(initialPathId ?? catalog?.paths[0]?.id ?? '')
  const path = catalog?.paths.find((candidate) => candidate.id === pathId)
  const [position, setPosition] = useState<number>(path?.lessonIds.length ?? 0)
  const [title, setTitle] = useState('')
  const [lessonId, setLessonId] = useState('')
  const [idEdited, setIdEdited] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [source, setSource] = useState('')
  const [license, setLicense] = useState('')
  const [objective, setObjective] = useState('')
  const [goal, setGoal] = useState('')
  const [constraints, setConstraints] = useState('')
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' })
  const [keeping, setKeeping] = useState(false)
  const [keepError, setKeepError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [model, setModel] = useState(storedModel)

  useEffect(() => {
    if (outcome.kind !== 'generating') return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [outcome.kind])

  // "Code traces, model teaches": an SVG becomes exact lines and colours here,
  // and generation only orders them. If tracing fails, the picture is used instead.
  const [trace, setTrace] = useState<TraceState>({ status: 'none' })
  useEffect(() => {
    if (!file || file.type !== 'image/svg+xml') {
      setTrace({ status: 'none' })
      return
    }
    let cancelled = false
    setTrace({ status: 'tracing' })
    file
      .text()
      .then((text) => traceSvg(text))
      .then(
        (drawing) => {
          if (!cancelled) setTrace({ status: 'done', drawing })
        },
        (error: unknown) => {
          if (!cancelled) setTrace({ status: 'failed', message: error instanceof Error ? error.message : String(error) })
        },
      )
    return () => {
      cancelled = true
    }
  }, [file])

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  const taken = library.tutorials.has(lessonId) || Boolean(catalog?.lessons.some((lesson) => lesson.id === lessonId))
  const problems: string[] = []
  if (!library.writable) problems.push('Generation needs the Studio server: run npm run dev.')
  if (!catalog) problems.push('The catalog could not be read, so a new lesson has nowhere to go.')
  if (!title.trim()) problems.push('Give the lesson a title.')
  if (!ID_PATTERN.test(lessonId)) problems.push('The id must use lowercase letters, digits and single dashes.')
  else if (taken) problems.push(`"${lessonId}" is already a lesson. Choose another id; nothing is ever replaced.`)
  if (!file) problems.push('Add the reference photo.')
  else if (!REFERENCE_TYPES.includes(file.type)) problems.push(`The photo must be ${REFERENCE_TYPES_LABEL}.`)
  if (trace.status === 'tracing') problems.push('Wait for the SVG to finish tracing.')
  if (!source.trim() || !license.trim()) problems.push('Record where the photo came from and its licence.')
  if (!objective.trim()) problems.push('Write the one-line objective.')
  if (!goal.trim()) problems.push('Describe the learning goal.')

  const previousTutorial = useMemo(() => {
    const id = path && position > 0 ? path.lessonIds[position - 1] : undefined
    return id ? library.tutorials.get(id)?.tutorial : undefined
  }, [path, position, library])

  const generate = async (event?: FormEvent) => {
    event?.preventDefault()
    if (problems.length > 0 || !file) return
    setOutcome({ kind: 'generating', startedAt: Date.now() })
    setKeepError(null)
    try {
      const request = {
        model,
        lessonId,
        title: title.trim(),
        pathId: path?.id ?? null,
        position,
        goal: goal.trim(),
        constraints: constraints.trim(),
        image: await imageForModel(file),
      }
      const result =
        trace.status === 'done'
          ? await generateFromTrace({ ...request, trace: trace.drawing })
          : await generateLesson(request)
      // The server has validated already; the browser checks again with the
      // same code before anything can enter the editor (§22).
      const verdict = result.issues.length === 0 ? validateTutorial(result.tutorial) : null
      setOutcome(
        verdict?.ok
          ? { kind: 'candidate', result, tutorial: verdict.tutorial }
          : { kind: 'rejected', result: verdict && !verdict.ok ? { ...result, issues: verdict.issues } : result },
      )
    } catch (error) {
      setOutcome({ kind: 'failed', message: error instanceof Error ? error.message : String(error) })
    }
  }

  /** Writes the kept draft: tutorial (create-only), photo, then its place in the catalog. */
  const keep = async () => {
    if (outcome.kind !== 'candidate' || !catalog || !file) return
    setKeeping(true)
    setKeepError(null)
    try {
      await saveTutorial(lessonId, outcome.tutorial, null)
      const { file: photo } = await uploadReference(lessonId, file)
      const lesson: Lesson = {
        id: lessonId,
        status: 'draft',
        objective: objective.trim(),
        reference: { file: photo, source: source.trim(), license: license.trim() },
        generation: {
          model: outcome.result.model,
          promptVersion: outcome.result.promptVersion,
          createdAt: new Date().toISOString(),
          goal: goal.trim(),
          ...(constraints.trim() ? { constraints: constraints.trim() } : {}),
          analysis: outcome.result.analysis,
        },
      }
      const paths = catalog.paths.map((candidate) => {
        if (candidate.id !== path?.id) return candidate
        const lessonIds = [...candidate.lessonIds]
        lessonIds.splice(Math.min(position, lessonIds.length), 0, lessonId)
        return { ...candidate, lessonIds }
      })
      await saveCatalog(
        { catalogVersion: 1, paths },
        { catalogVersion: 1, lessons: [...catalog.lessons, lesson] },
        { paths: library.catalogEtags.paths ?? null, lessons: library.catalogEtags.lessons ?? null },
      )
      await onCreated(lessonId)
    } catch (error) {
      setKeepError(
        error instanceof ApiError
          ? `${error.message} Anything already written stays on disk; the Paths view lists it.`
          : String(error),
      )
    } finally {
      setKeeping(false)
    }
  }

  const busy = outcome.kind === 'generating' || keeping

  return (
    <div className="st-form-page st-form-page--wide">
      <h1 className="st-form-page__title">New lesson</h1>
      <p className="st-field__hint">
        Upload a real-world photo, say what the lesson should teach, and generate a first draft. You
        review and reshape it in the Lesson Workspace; nothing is saved until you keep it.
      </p>

      <form className="st-new-lesson" onSubmit={generate}>
        <section className="st-panel">
          <h2 className="st-label">Place in the curriculum</h2>
          <label className="st-field">
            <span className="st-field__label">Path</span>
            <select
              className="st-field__input"
              value={pathId}
              onChange={(event) => {
                const next = catalog?.paths.find((candidate) => candidate.id === event.target.value)
                setPathId(event.target.value)
                // A different path starts the new lesson at its end.
                setPosition(next?.lessonIds.length ?? 0)
              }}
            >
              {(catalog?.paths ?? []).map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.title}
                </option>
              ))}
              <option value="">No path yet</option>
            </select>
          </label>
          {path ? (
            <label className="st-field">
              <span className="st-field__label">Position</span>
              <select
                className="st-field__input"
                value={position}
                onChange={(event) => setPosition(Number(event.target.value))}
              >
                {path.lessonIds.map((id, index) => (
                  <option key={id} value={index}>
                    Lesson {index + 1}, before “{library.tutorials.get(id)?.tutorial.title ?? id}”
                  </option>
                ))}
                <option value={path.lessonIds.length}>Lesson {path.lessonIds.length + 1}, at the end</option>
              </select>
            </label>
          ) : null}
          <label className="st-field">
            <span className="st-field__label">Title</span>
            <input
              className="st-field__input"
              value={title}
              placeholder="e.g. Small Cottage"
              onChange={(event) => {
                setTitle(event.target.value)
                if (!idEdited) setLessonId(slugify(event.target.value))
              }}
            />
          </label>
          <label className="st-field">
            <span className="st-field__label">Id (also the file name)</span>
            <input
              className="st-field__input"
              value={lessonId}
              onChange={(event) => {
                setIdEdited(true)
                setLessonId(event.target.value)
              }}
            />
          </label>
          <label className="st-field">
            <span className="st-field__label">Objective (one line, shown in the path)</span>
            <input
              className="st-field__input"
              value={objective}
              placeholder="e.g. Add character with a chimney and a few selective details"
              onChange={(event) => setObjective(event.target.value)}
            />
          </label>
        </section>

        <section className="st-panel">
          <h2 className="st-label">Reference photo</h2>
          {preview ? <img className="st-reference-form__preview" src={preview} alt="" /> : null}
          <label className="st-field">
            <span className="st-field__label">Photo ({REFERENCE_TYPES_LABEL}, up to 8 MB)</span>
            <input
              className="st-field__input"
              type="file"
              accept={REFERENCE_TYPES.join(',')}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          {trace.status === 'tracing' ? (
            <p className="st-field__hint" role="status">
              Tracing the SVG…
            </p>
          ) : null}
          {trace.status === 'failed' ? (
            <p className="st-notice st-notice--error">
              {trace.message} Generation will work from the picture instead.
            </p>
          ) : null}
          {trace.status === 'done' ? <TracePreview drawing={trace.drawing} /> : null}
          <label className="st-field">
            <span className="st-field__label">Source</span>
            <input
              className="st-field__input"
              value={source}
              placeholder="A URL, or “own photo”"
              onChange={(event) => setSource(event.target.value)}
            />
          </label>
          <label className="st-field">
            <span className="st-field__label">Licence</span>
            <input
              className="st-field__input"
              value={license}
              placeholder="e.g. CC0, Unsplash License, own photo"
              onChange={(event) => setLicense(event.target.value)}
            />
          </label>
        </section>

        <section className="st-panel st-new-lesson__wide">
          <h2 className="st-label">What to teach</h2>
          <label className="st-field">
            <span className="st-field__label">Learning goal</span>
            <textarea
              className="st-field__input st-field__input--long"
              value={goal}
              placeholder="e.g. Introduce a visible side wall and shallow perspective while staying beginner-friendly."
              onChange={(event) => setGoal(event.target.value)}
            />
          </label>
          <label className="st-field">
            <span className="st-field__label">Constraints (optional)</span>
            <textarea
              className="st-field__input"
              value={constraints}
              placeholder="e.g. Under five minutes. Ignore the garden. Keep the chimney and the two main windows."
              onChange={(event) => setConstraints(event.target.value)}
            />
          </label>
          <div className="st-new-lesson__actions">
            <button
              type="submit"
              className="st-button st-button--primary"
              disabled={problems.length > 0 || busy}
            >
              {outcome.kind === 'generating' ? 'Generating…' : 'Generate tutorial'}
            </button>
          </div>
          <ModelPicker model={model} onChange={setModel} disabled={busy} />
          {problems.length > 0 && outcome.kind === 'idle' ? (
            <ul className="st-new-lesson__todo">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}
        </section>
      </form>

      {outcome.kind === 'generating' ? (
        <p className="st-notice" role="status">
          Generating with the photo and your goal… {Math.round((now - outcome.startedAt) / 1000)}s. A detailed
          lesson can take a minute or two.
        </p>
      ) : null}
      {outcome.kind === 'failed' ? (
        <p className="st-notice st-notice--error" role="alert">
          {outcome.message} Your inputs are unchanged.
        </p>
      ) : null}
      {outcome.kind === 'rejected' ? (
        <>
          <IssueList
            heading="The generated lesson breaks the tutorial contract, so it was not kept"
            note="Nothing was saved. Generate again, perhaps with another model or a tighter goal."
            issues={outcome.result.issues}
          />
          <AnalysisPanel analysis={outcome.result.analysis} />
        </>
      ) : null}
      {outcome.kind === 'candidate' ? (
        <CandidatePanel
          result={outcome.result}
          tutorial={outcome.tutorial}
          previous={previousTutorial}
          keeping={keeping}
          keepError={keepError}
          onKeep={() => void keep()}
          onRegenerate={() => void generate()}
          onDiscard={() => setOutcome({ kind: 'idle' })}
        />
      ) : null}
    </div>
  )
}

function CandidatePanel({
  result,
  tutorial,
  previous,
  keeping,
  keepError,
  onKeep,
  onRegenerate,
  onDiscard,
}: {
  result: GenerateResult
  tutorial: Tutorial
  previous: Tutorial | undefined
  keeping: boolean
  keepError: string | null
  onKeep: () => void
  onRegenerate: () => void
  onDiscard: () => void
}) {
  const warnings = qualityWarnings(tutorial, previous)
  return (
    <section className="st-candidate" aria-labelledby="st-candidate-heading">
      <h2 id="st-candidate-heading" className="st-section-heading">
        Draft: {tutorial.title}
      </h2>
      <p className="st-field__hint">
        {tutorial.steps.length} steps · {totalStrokes(tutorial)} strokes · by <code>{result.model}</code> with
        prompt {result.promptVersion}
        {result.usage?.cost !== undefined ? ` · about $${result.usage.cost.toFixed(3)}` : ''}
      </p>
      {result.notes && result.notes.length > 0 ? (
        <ul className="st-new-lesson__todo">
          {result.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      <div className="st-candidate__grid">
        <div className="st-candidate__drawing">
          <FinishedDrawing tutorial={tutorial} className="st-canvas" />
        </div>
        <div className="st-candidate__side">
          <ol className="st-candidate__steps">
            {tutorial.steps.map((step) => (
              <li key={step.id}>
                <strong>{step.title}</strong> — {step.instruction}
              </li>
            ))}
          </ol>
          {warnings.length > 0 ? (
            <IssueListWarnings warnings={warnings.map((warning) => ({ path: warning.path, message: warning.message }))} />
          ) : (
            <p className="st-valid">Valid, and no quality warnings.</p>
          )}
        </div>
      </div>
      <AnalysisPanel analysis={result.analysis} />
      {keepError ? (
        <p className="st-notice st-notice--error" role="alert">
          {keepError}
        </p>
      ) : null}
      <div className="st-new-lesson__actions">
        <button type="button" className="st-button st-button--primary" disabled={keeping} onClick={onKeep}>
          {keeping ? 'Saving…' : 'Keep as draft'}
        </button>
        <button type="button" className="st-button" disabled={keeping} onClick={onRegenerate}>
          Generate again
        </button>
        <button type="button" className="st-link-button" disabled={keeping} onClick={onDiscard}>
          Discard
        </button>
      </div>
    </section>
  )
}

function IssueListWarnings({ warnings }: { warnings: ValidationIssue[] }) {
  return (
    <div className="st-approval">
      <p className="st-approval__note">Worth a look before keeping:</p>
      <ul className="st-approval__warnings">
        {warnings.map((warning, index) => (
          <li key={`${warning.path}-${index}`}>
            <code>{warning.path}</code> {warning.message}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The traced lines and colours, drawn whole, with what tracing simplified. */
function TracePreview({ drawing }: { drawing: TracedDrawing }) {
  const tutorial = useMemo<Tutorial>(
    () => ({
      schemaVersion: 2,
      id: 'trace-preview',
      title: 'Traced drawing',
      canvas: drawing.canvas,
      steps: [
        {
          id: 'traced',
          title: 'Traced drawing',
          instruction: 'Traced drawing',
          strokes: drawing.strokes.map((stroke) => ({
            d: stroke.d,
            duration: 1,
            lineWidth: stroke.lineWidth,
            ...(stroke.color ? { color: stroke.color } : {}),
          })),
          fills: drawing.fills.map((fill) => ({ d: fill.d, color: fill.color, duration: 1, fillRule: 'evenodd' as const })),
        },
      ],
    }),
    [drawing],
  )
  return (
    <div className="st-trace-preview">
      <p className="st-field__hint">
        Traced from the SVG: {drawing.strokes.length} lines and {drawing.fills.length} colours. The lesson keeps
        exactly these; the model only orders them into steps and writes the instructions.
      </p>
      <FinishedDrawing tutorial={tutorial} className="st-reference-form__preview" />
      {drawing.notes.length > 0 ? (
        <ul className="st-new-lesson__todo">
          {drawing.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** What the model saw in the photo and chose to leave out (§22). */
export function AnalysisPanel({ analysis }: { analysis: Analysis }) {
  return (
    <div className="st-analysis">
      <h3 className="st-label">How the photo was simplified</h3>
      <dl>
        <dt>Main forms</dt>
        <dd>{analysis.mainForms.join(' · ') || '—'}</dd>
        <dt>Details kept</dt>
        <dd>{analysis.importantDetails.join(' · ') || '—'}</dd>
        <dt>Left out</dt>
        <dd>{analysis.detailsRemoved.join(' · ') || '—'}</dd>
        <dt>Strategy</dt>
        <dd>{analysis.drawingStrategy || '—'}</dd>
      </dl>
    </div>
  )
}
