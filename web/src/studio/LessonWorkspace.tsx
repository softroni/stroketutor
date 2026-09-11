import { useState } from 'react'

import { DebugPanel } from '../app/DebugPanel'
import { estimateLearnerSeconds, formatMinutes } from '../catalog/metrics'
import { findLesson, findPathOfLesson, type Catalog } from '../catalog/types'
import { TutorialPlayer } from '../player/TutorialPlayer'
import { totalDuration, totalStrokes } from '../schema/types'

import { FinishedDrawing } from './FinishedDrawing'
import type { Library } from './library'
import { routeHref } from './route'
import { StatusPill } from './StatusPill'

export interface LessonWorkspaceProps {
  library: Library
  catalog: Catalog | null
  lessonId: string
}

type BottomPanel = 'instruction' | 'advanced'

/**
 * The primary Studio surface (master plan §17): the real-world reference, the
 * drawing and the teaching structure side by side, so both the simplification
 * and the teaching order can be judged without leaving the page.
 */
export function LessonWorkspace({ library, catalog, lessonId }: LessonWorkspaceProps) {
  const [previewing, setPreviewing] = useState(false)
  const [selectedStep, setSelectedStep] = useState(0)
  const [panel, setPanel] = useState<BottomPanel>('instruction')

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

  const { tutorial } = entry
  const lesson = catalog ? findLesson(catalog, lessonId) : undefined
  const path = catalog ? findPathOfLesson(catalog, lessonId) : undefined
  const reference = lesson?.reference
  const referenceUrl = reference ? library.referenceUrl(reference.file) : undefined
  const stepIndex = Math.min(selectedStep, tutorial.steps.length - 1)
  const step = tutorial.steps[stepIndex]

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
          <button
            type="button"
            className={`st-button ${previewing ? 'st-button--on' : ''}`}
            aria-pressed={previewing}
            onClick={() => setPreviewing((on) => !on)}
          >
            {previewing ? 'Back to drawing' : 'Preview as learner'}
          </button>
        </div>
      </header>

      {lesson ? <p className="st-workspace__objective">{lesson.objective}</p> : null}

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
            {previewing ? 'Learner preview' : 'Drawing'}
          </h2>
          {previewing ? (
            // The real player, not an imitation (§19): whatever the learner
            // would see, the creator sees here.
            <TutorialPlayer tutorial={tutorial} />
          ) : (
            <>
              <div
                className="st-workspace__canvas"
                style={{ aspectRatio: `${tutorial.canvas.width} / ${tutorial.canvas.height}` }}
              >
                <FinishedDrawing tutorial={tutorial} className="st-canvas" />
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
          <ol className="st-steps">
            {tutorial.steps.map((candidate, index) => {
              const seconds = candidate.strokes.reduce((sum, stroke) => sum + stroke.duration, 0)
              return (
                <li key={candidate.id}>
                  <button
                    type="button"
                    className={`st-steps__item ${index === stepIndex ? 'is-selected' : ''}`}
                    aria-pressed={index === stepIndex}
                    onClick={() => {
                      setSelectedStep(index)
                      setPanel('instruction')
                    }}
                  >
                    <span className="st-steps__number">{index + 1}</span>
                    <span className="st-steps__title">{candidate.title}</span>
                    <span className="st-steps__meta">
                      {candidate.strokes.length} {candidate.strokes.length === 1 ? 'stroke' : 'strokes'} ·{' '}
                      {seconds.toFixed(1)}s
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </section>
      </div>

      <section className="st-panel st-workspace__bottom">
        <div className="st-tabs" role="tablist" aria-label="Details">
          <button
            type="button"
            role="tab"
            className="st-tab"
            aria-selected={panel === 'instruction'}
            onClick={() => setPanel('instruction')}
          >
            Instruction
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
        {panel === 'instruction' ? (
          <div className="st-instruction" role="tabpanel">
            <h3>
              {stepIndex + 1}. {step.title}
            </h3>
            <p>{step.instruction}</p>
          </div>
        ) : (
          <div role="tabpanel">
            <DebugPanel tutorial={tutorial} onClose={() => setPanel('instruction')} />
          </div>
        )}
      </section>
    </div>
  )
}
