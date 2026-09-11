import { useCallback, useMemo } from 'react'

import { resolveStyle, type Tutorial } from '../schema/types'

import { StrokeCanvas, type RenderStroke } from './StrokeCanvas'
import { usePlayback } from './usePlayback'
import './player.css'

export interface TutorialPlayerProps {
  tutorial: Tutorial
}

/** Stable identity for a stroke across the whole document. */
const strokeKey = (stepIndex: number, strokeIndex: number) => `${stepIndex}:${strokeIndex}`

function strokesOfStep(tutorial: Tutorial, stepIndex: number): RenderStroke[] {
  return tutorial.steps[stepIndex].strokes.map((stroke, strokeIndex) => ({
    key: strokeKey(stepIndex, strokeIndex),
    d: stroke.d,
    lineWidth: stroke.lineWidth,
  }))
}

/**
 * The complete player: canvas, instruction card and transport controls.
 *
 * Takes a validated `Tutorial` and nothing else. It owns its playback state, so
 * an editor can drop it in, hand it a document, and get identical behaviour to
 * this app without wiring anything up.
 */
export function TutorialPlayer({ tutorial }: TutorialPlayerProps) {
  const playback = usePlayback(tutorial)
  const { state, currentStep, currentStepIndex, stepCount } = playback
  const style = useMemo(() => resolveStyle(tutorial.style), [tutorial.style])

  const finished = state.phase === 'finished'
  const awaiting = state.phase === 'awaitingUser'

  // Everything drawn in earlier steps stays on the paper, faded, while the
  // current step draws over it.
  const completed = useMemo(() => {
    if (finished) return []
    const out: RenderStroke[] = []
    for (let stepIndex = 0; stepIndex < currentStepIndex; stepIndex += 1) {
      out.push(...strokesOfStep(tutorial, stepIndex))
    }
    return out
  }, [tutorial, currentStepIndex, finished])

  // On the last screen the drawing is shown whole, at full strength.
  const active = useMemo(() => {
    if (finished) {
      const out: RenderStroke[] = []
      for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
        out.push(...strokesOfStep(tutorial, stepIndex))
      }
      return out
    }
    return strokesOfStep(tutorial, currentStepIndex)
  }, [tutorial, currentStepIndex, stepCount, finished])

  const activeIndex = finished || awaiting ? active.length : playback.strokeIndex
  const activeProgress = finished || awaiting ? 1 : playback.strokeProgress

  const handleSpeed = useCallback(() => playback.cycleSpeed(), [playback])

  return (
    <section className="st-player">
      <header className="st-player__header">
        <div>
          <h1 className="st-player__title">{tutorial.title}</h1>
          <p className="st-player__step-title">
            {finished ? 'All steps finished' : `Step ${currentStepIndex + 1} of ${stepCount} · ${currentStep.title}`}
          </p>
        </div>
        <ol className="st-dots" aria-label="Step progress">
          {tutorial.steps.map((step, index) => {
            const done = finished || index < currentStepIndex
            const current = !finished && index === currentStepIndex
            return (
              <li
                key={step.id}
                className={`st-dot ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`}
                title={`${index + 1}. ${step.title}`}
                aria-current={current ? 'step' : undefined}
              />
            )
          })}
        </ol>
      </header>

      <div
        className="st-canvas-frame"
        style={{ aspectRatio: `${tutorial.canvas.width} / ${tutorial.canvas.height}` }}
      >
        <StrokeCanvas
          className="st-canvas"
          canvas={tutorial.canvas}
          strokeColor={style.strokeColor}
          backgroundColor={style.backgroundColor}
          completed={completed}
          strokes={active}
          activeIndex={activeIndex}
          activeProgress={activeProgress}
          showPencil={state.phase === 'drawing'}
          title={`${tutorial.title} — ${finished ? 'complete' : currentStep.title}`}
        />
      </div>

      {finished ? (
        <div className="st-card st-card--active">
          <p className="st-card__instruction">
            That is the whole drawing. Nicely done!
          </p>
          <div className="st-card__actions">
            <button type="button" className="st-button st-button--primary" onClick={playback.restart}>
              Start over
            </button>
          </div>
        </div>
      ) : (
        <div className={`st-card ${awaiting ? 'st-card--active' : ''}`}>
          <p className="st-card__instruction">{currentStep.instruction}</p>
          {awaiting ? (
            <div className="st-card__actions">
              <button
                type="button"
                className="st-button st-button--primary"
                onClick={playback.next}
              >
                I drew it!
              </button>
              <button
                type="button"
                className="st-button st-button--secondary"
                onClick={playback.replayStep}
              >
                Watch again
              </button>
            </div>
          ) : (
            <p className="st-card__hint">Watch the stroke, then copy it onto your paper.</p>
          )}
        </div>
      )}

      <div className="st-controls">
        <button
          type="button"
          className="st-button"
          onClick={playback.previous}
          disabled={!playback.canGoPrevious}
        >
          ‹ Previous step
        </button>
        <button type="button" className="st-button" onClick={playback.replayStep}>
          ↻ Replay step
        </button>
        <button
          type="button"
          className="st-button st-button--speed"
          onClick={handleSpeed}
          title="Cycle playback speed"
        >
          {playback.speed}× speed
        </button>
      </div>
    </section>
  )
}
