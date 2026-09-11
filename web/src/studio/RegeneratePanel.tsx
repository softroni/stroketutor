import { useEffect, useState } from 'react'

import type { LearningPath, Lesson } from '../catalog/types'
import { totalFills, totalStrokes, type Tutorial } from '../schema/types'
import { validateTutorial } from '../schema/validate'
import { traceSvg, type TracedDrawing } from '../trace/traceSvg'

import { regenerateLayer, type RegenerateLayer, type RegenerateRequest, type RegenerateResult } from './api'
import { drawingImage } from './drawingImage'
import { FinishedDrawing } from './FinishedDrawing'
import { IssueList } from './IssueList'
import type { Library } from './library'
import { ModelPicker } from './ModelPicker'
import { AnalysisPanel } from './NewLessonView'
import { imageForModel } from './referenceImage'
import { storedModel } from './settings'

/** Cheapest first: most weak lessons need their words or grouping fixed, not a new drawing. */
const LAYERS: { layer: RegenerateLayer; label: string; keeps: string }[] = [
  {
    layer: 'instructions',
    label: 'Instructions',
    keeps: 'Keeps the drawing, the steps and their order. Rewrites every title and instruction.',
  },
  {
    layer: 'steps',
    label: 'Steps',
    keeps: 'Keeps every line and colour. Regroups them into new steps, with new words.',
  },
  {
    layer: 'order',
    label: 'Order',
    keeps: 'Keeps the steps and their words. Changes the order, and which end a line starts from.',
  },
  {
    layer: 'drawing',
    label: 'Drawing',
    keeps: 'Starts again from the reference: a new drawing, steps and words. The slowest.',
  },
]

/** Line budgets for re-tracing an SVG reference; 64 is what New lesson traces with. */
const DETAIL_LEVELS = [
  { maxStrokes: 32, label: 'Fewer lines (32)' },
  { maxStrokes: 64, label: 'As first traced (64)' },
  { maxStrokes: 96, label: 'More lines (96)' },
]

type Outcome =
  | { kind: 'idle' }
  | { kind: 'running'; startedAt: number }
  | { kind: 'failed'; message: string }
  | { kind: 'rejected'; result: RegenerateResult }
  | { kind: 'candidate'; result: RegenerateResult; tutorial: Tutorial; basis: Tutorial | null; seconds: number }

export interface RegeneratePanelProps {
  library: Library
  lessonId: string
  title: string
  lesson: Lesson | undefined
  path: LearningPath | undefined
  /** Zero-based place of the lesson in its path. */
  position: number
  /** The lesson as edited so far, or null while it has validation problems. */
  current: Tutorial | null
  /** Puts the regenerated version into the editor, where Undo can take it back. */
  onUse: (tutorial: Tutorial, result: RegenerateResult) => void
  onClose: () => void
}

/**
 * Regenerates one layer of the lesson (master plan §24) and shows it beside
 * the current version. Nothing is written: using a version puts it in the
 * editor like any other edit, to be saved or undone.
 */
export function RegeneratePanel({
  library,
  lessonId,
  title,
  lesson,
  path,
  position,
  current,
  onUse,
  onClose,
}: RegeneratePanelProps) {
  const [layer, setLayer] = useState<RegenerateLayer>('instructions')
  const [note, setNote] = useState('')
  const [goal, setGoal] = useState(lesson?.generation?.goal ?? lesson?.objective ?? '')
  const [constraints, setConstraints] = useState(lesson?.generation?.constraints ?? '')
  const [maxStrokes, setMaxStrokes] = useState(64)
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' })
  const [now, setNow] = useState(Date.now())
  const [model, setModel] = useState(storedModel)

  useEffect(() => {
    if (outcome.kind !== 'running') return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [outcome.kind])

  const reference = lesson?.reference
  const referenceUrl = reference ? library.referenceUrl(reference.file) : undefined
  const svgReference = Boolean(reference?.file.toLowerCase().endsWith('.svg'))

  const problems: string[] = []
  if (layer === 'drawing') {
    if (!referenceUrl) problems.push('A new drawing starts from the reference, and this lesson has none yet.')
    if (!goal.trim()) problems.push('Describe the learning goal.')
  } else if (!current) {
    problems.push('Fix the lesson’s validation problems first: the model is shown the lesson as it is.')
  }

  const run = async () => {
    if (problems.length > 0) return
    const basis = current
    const startedAt = Date.now()
    setOutcome({ kind: 'running', startedAt })
    setNow(startedAt)
    try {
      const referenceBlob = referenceUrl ? await fetchReference(referenceUrl) : null
      const common = {
        model,
        lessonId,
        pathId: path?.id ?? null,
        position,
        goal: goal.trim(),
        constraints: constraints.trim(),
        note: note.trim(),
      }
      let request: RegenerateRequest
      if (layer === 'drawing') {
        if (!referenceBlob) throw new Error('The reference could not be read.')
        // As in New lesson: an SVG is traced into exact lines, and if tracing
        // fails the picture is used instead.
        const trace: TracedDrawing | undefined = svgReference
          ? await referenceBlob.text().then((text) => traceSvg(text, { maxStrokes }), () => undefined).catch(() => undefined)
          : undefined
        request = { ...common, layer, title, image: await imageForModel(referenceBlob), ...(trace ? { trace } : {}) }
      } else {
        if (!basis) throw new Error('The lesson has validation problems.')
        request = {
          ...common,
          layer,
          tutorial: basis,
          drawing: await drawingImage(basis),
          ...(referenceBlob ? { reference: await imageForModel(referenceBlob) } : {}),
        }
      }

      const result = await regenerateLayer(request)
      // The server has validated already; the browser checks again with the
      // same code before anything can enter the editor.
      const verdict = result.issues.length === 0 ? validateTutorial(result.tutorial) : null
      setOutcome(
        verdict?.ok
          ? {
              kind: 'candidate',
              result,
              tutorial: verdict.tutorial,
              basis,
              seconds: Math.round((Date.now() - startedAt) / 1000),
            }
          : { kind: 'rejected', result: verdict && !verdict.ok ? { ...result, issues: verdict.issues } : result },
      )
    } catch (error) {
      setOutcome({ kind: 'failed', message: error instanceof Error ? error.message : String(error) })
    }
  }

  const running = outcome.kind === 'running'
  const chosen = LAYERS.find((entry) => entry.layer === layer)

  return (
    <section className="st-regenerate" aria-labelledby="st-regenerate-heading">
      <div className="st-regenerate__head">
        <h2 id="st-regenerate-heading" className="st-approval__heading">
          Regenerate one layer
        </h2>
        <button type="button" className="st-link-button" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="st-regenerate__layers" role="group" aria-label="Layer to regenerate">
        {LAYERS.map((entry) => (
          <button
            key={entry.layer}
            type="button"
            className="st-regenerate__layer"
            aria-pressed={layer === entry.layer}
            disabled={running}
            onClick={() => setLayer(entry.layer)}
          >
            <strong>{entry.label}</strong>
            <span>{entry.keeps}</span>
          </button>
        ))}
      </div>

      {layer === 'drawing' ? (
        <div className="st-regenerate__fields">
          <label className="st-field">
            <span className="st-field__label">Learning goal</span>
            <textarea
              className="st-field__input"
              value={goal}
              disabled={running}
              onChange={(event) => setGoal(event.target.value)}
            />
          </label>
          <label className="st-field">
            <span className="st-field__label">Constraints (optional)</span>
            <textarea
              className="st-field__input"
              value={constraints}
              disabled={running}
              onChange={(event) => setConstraints(event.target.value)}
            />
          </label>
          {svgReference ? (
            <label className="st-field">
              <span className="st-field__label">Detail when tracing the SVG again</span>
              <select
                className="st-field__input"
                value={maxStrokes}
                disabled={running}
                onChange={(event) => setMaxStrokes(Number(event.target.value))}
              >
                {DETAIL_LEVELS.map((level) => (
                  <option key={level.maxStrokes} value={level.maxStrokes}>
                    {level.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      <label className="st-field">
        <span className="st-field__label">What should be different? (optional)</span>
        <textarea
          className="st-field__input"
          value={note}
          disabled={running}
          placeholder="e.g. Sound less like a children’s book. Say where each line starts."
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      <div className="st-new-lesson__actions">
        <button
          type="button"
          className="st-button st-button--primary"
          disabled={problems.length > 0 || running}
          onClick={() => void run()}
        >
          {running ? 'Regenerating…' : `Regenerate ${chosen?.label.toLowerCase()}`}
        </button>
      </div>
      <ModelPicker model={model} onChange={setModel} disabled={running} />
      {problems.length > 0 && !running ? (
        <ul className="st-new-lesson__todo">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}

      {outcome.kind === 'running' ? (
        <p className="st-notice" role="status">
          Regenerating the {layer}… {Math.round((now - outcome.startedAt) / 1000)}s.
          {layer === 'drawing' ? ' A new drawing can take a minute or two.' : ''} You can keep editing meanwhile.
        </p>
      ) : null}
      {outcome.kind === 'failed' ? (
        <p className="st-notice st-notice--error" role="alert">
          {outcome.message} The lesson is unchanged.
        </p>
      ) : null}
      {outcome.kind === 'rejected' ? (
        <IssueList
          heading="The regenerated lesson breaks the tutorial contract, so it cannot be used"
          note="The lesson is unchanged. Try again, perhaps with another model or a clearer note."
          issues={outcome.result.issues}
        />
      ) : null}
      {outcome.kind === 'candidate' ? (
        <Comparison
          outcome={outcome}
          current={current}
          onUse={() => onUse(outcome.tutorial, outcome.result)}
          onRetry={() => void run()}
          onDiscard={() => setOutcome({ kind: 'idle' })}
        />
      ) : null}
    </section>
  )
}

function Comparison({
  outcome,
  current,
  onUse,
  onRetry,
  onDiscard,
}: {
  outcome: Extract<Outcome, { kind: 'candidate' }>
  current: Tutorial | null
  onUse: () => void
  onRetry: () => void
  onDiscard: () => void
}) {
  const { result, tutorial, basis, seconds } = outcome
  const changedSteps = tutorial.steps.filter(
    (step, index) => JSON.stringify(step) !== JSON.stringify(basis?.steps[index]),
  ).length
  // Edits made while the model was working are in `current` but not in `basis`.
  const editedMeanwhile = current !== basis

  return (
    <div className="st-candidate">
      <p className="st-field__hint">
        {changedSteps} of {tutorial.steps.length} steps differ from the version sent · <code>{result.model}</code>{' '}
        with prompt {result.promptVersion} · {seconds}s
        {result.usage?.cost !== undefined ? ` · about $${result.usage.cost.toFixed(3)}` : ''}
      </p>
      {result.rationale ? <p className="st-regenerate__rationale">{result.rationale}</p> : null}
      {result.notes.length > 0 ? (
        <ul className="st-new-lesson__todo">
          {result.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      {editedMeanwhile ? (
        <p className="st-notice">
          You edited the lesson while this ran. Using the regenerated version replaces those edits too; Undo brings
          them back.
        </p>
      ) : null}
      <div className="st-candidate__grid">
        {basis ? <Version heading="Current" tutorial={basis} /> : <p className="st-field__hint">No current version to compare.</p>}
        <Version heading="Regenerated" tutorial={tutorial} against={basis ?? undefined} />
      </div>
      {result.analysis ? <AnalysisPanel analysis={result.analysis} /> : null}
      <div className="st-new-lesson__actions">
        <button type="button" className="st-button st-button--primary" onClick={onUse}>
          Use the regenerated version
        </button>
        <button type="button" className="st-button" onClick={onRetry}>
          Try again
        </button>
        <button type="button" className="st-link-button" onClick={onDiscard}>
          Discard
        </button>
      </div>
    </div>
  )
}

/** One version of the lesson: its finished drawing and its steps, marking those that differ from `against`. */
function Version({ heading, tutorial, against }: { heading: string; tutorial: Tutorial; against?: Tutorial }) {
  const fills = totalFills(tutorial)
  return (
    <div className="st-candidate__side">
      <h3 className="st-label">{heading}</h3>
      <div
        className="st-candidate__drawing"
        style={{ aspectRatio: `${tutorial.canvas.width} / ${tutorial.canvas.height}` }}
      >
        <FinishedDrawing tutorial={tutorial} className="st-canvas" />
      </div>
      <p className="st-field__hint">
        {tutorial.steps.length} steps · {totalStrokes(tutorial)} lines{fills > 0 ? ` · ${fills} colours` : ''}
      </p>
      <ol className="st-candidate__steps">
        {tutorial.steps.map((step, index) => (
          <li key={`${step.id}-${index}`}>
            <strong>{step.title}</strong>
            {against && JSON.stringify(step) !== JSON.stringify(against.steps[index]) ? (
              <span className="st-changed">changed</span>
            ) : null}{' '}
            — {step.instruction}{' '}
            <span className="st-regenerate__count">
              ({step.strokes.length} {step.strokes.length === 1 ? 'line' : 'lines'}
              {step.fills?.length ? `, ${step.fills.length} ${step.fills.length === 1 ? 'colour' : 'colours'}` : ''})
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

async function fetchReference(url: string): Promise<Blob> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('The lesson’s reference could not be read from shared/Assets/References.')
  return response.blob()
}
