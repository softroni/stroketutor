import { useMemo } from 'react'

import { cssColor, resolveStyle, type Tutorial } from '../schema/types'

import { StrokeCanvas, type RenderFill, type RenderStroke } from './StrokeCanvas'
import { SPEEDS, speedLabel, usePlayback } from './usePlayback'
import './player.css'

export interface TutorialPlayerProps {
  tutorial: Tutorial
  /**
   * Fit the whole player to its container's height, shrinking the paper so
   * the instruction and controls never scroll out of view. The container must
   * have a definite height; without one the player flows at its natural size.
   */
  fill?: boolean
}

/** Stable identity for a stroke across the whole document. */
const strokeKey = (stepIndex: number, strokeIndex: number) => `${stepIndex}:${strokeIndex}`

export function strokesOfStep(tutorial: Tutorial, stepIndex: number): RenderStroke[] {
  return tutorial.steps[stepIndex].strokes.map((stroke, strokeIndex) => ({
    key: strokeKey(stepIndex, strokeIndex),
    d: stroke.d,
    lineWidth: stroke.lineWidth,
    ...(stroke.color !== undefined ? { color: cssColor(stroke.color) } : {}),
  }))
}

/** A step's fills (v2), ready for the canvas. */
export function fillsOfStep(tutorial: Tutorial, stepIndex: number): RenderFill[] {
  return (tutorial.steps[stepIndex].fills ?? []).map((fill, fillIndex) => ({
    key: `${stepIndex}:f${fillIndex}`,
    d: fill.d,
    color: cssColor(fill.color),
    fillRule: fill.fillRule,
  }))
}

/** Every stroke and fill of the steps before `end`, in drawing order. */
function upTo(tutorial: Tutorial, end: number) {
  const strokes: RenderStroke[] = []
  const fills: RenderFill[] = []
  for (let stepIndex = 0; stepIndex < end; stepIndex += 1) {
    strokes.push(...strokesOfStep(tutorial, stepIndex))
    fills.push(...fillsOfStep(tutorial, stepIndex))
  }
  return { strokes, fills }
}

/**
 * The complete player: canvas, instruction card and transport controls.
 *
 * Takes a validated `Tutorial` and nothing else. It owns its playback state, so
 * an editor can drop it in, hand it a document, and get identical behaviour to
 * this app without wiring anything up.
 */
export function TutorialPlayer({ tutorial, fill = false }: TutorialPlayerProps) {
  const playback = usePlayback(tutorial)
  const { state, currentStep, currentStepIndex, stepCount } = playback
  const style = useMemo(() => resolveStyle(tutorial.style), [tutorial.style])

  const finished = state.phase === 'finished'
  const awaiting = state.phase === 'awaitingUser'

  // Everything drawn in earlier steps stays on the paper, faded, while the
  // current step draws over it.
  const completed = useMemo(
    () => (finished ? { strokes: [], fills: [] } : upTo(tutorial, currentStepIndex)),
    [tutorial, currentStepIndex, finished],
  )

  // On the last screen the drawing is shown whole, at full strength.
  const active = useMemo(
    () =>
      finished
        ? upTo(tutorial, stepCount)
        : { strokes: strokesOfStep(tutorial, currentStepIndex), fills: fillsOfStep(tutorial, currentStepIndex) },
    [tutorial, currentStepIndex, stepCount, finished],
  )

  const everything = active.strokes.length + active.fills.length
  const activeIndex = finished || awaiting ? everything : playback.strokeIndex
  const activeProgress = finished || awaiting ? 1 : playback.strokeProgress
  const painting = !finished && !awaiting && playback.strokeIndex >= currentStep.strokes.length

  let hint = 'Watch the stroke, then copy it onto your paper.'
  if (awaiting) hint = 'Your turn. Draw it on your paper, then tap “I drew it!”.'
  else if (painting) hint = 'Watch where the colour goes, then colour it in on your paper.'

  return (
    <section className={`st-player ${fill ? 'st-player--fill' : ''}`}>
      <header className="st-player__header">
        <div className="st-player__heading">
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

      <div className="st-player__stage">
        <div
          className="st-canvas-frame"
          style={{ ['--ratio' as string]: String(tutorial.canvas.width / tutorial.canvas.height) }}
        >
          <StrokeCanvas
          className="st-canvas"
          canvas={tutorial.canvas}
          strokeColor={style.strokeColor}
          backgroundColor={style.backgroundColor}
          completed={completed.strokes}
          completedFills={completed.fills}
          strokes={active.strokes}
          fills={active.fills}
          activeIndex={activeIndex}
          activeProgress={activeProgress}
          showPencil={state.phase === 'drawing'}
            title={`${tutorial.title} — ${finished ? 'complete' : currentStep.title}`}
          />
        </div>
      </div>

      <div className={`st-card ${awaiting || finished ? 'st-card--active' : ''}`} aria-live="polite">
        <p className="st-card__instruction">
          {finished ? 'That is the whole drawing. Nicely done!' : currentStep.instruction}
        </p>
        {finished ? null : <p className="st-card__hint">{hint}</p>}
      </div>

      <div className="st-controls" role="toolbar" aria-label="Lesson controls">
        <button
          type="button"
          className="st-button"
          onClick={playback.previous}
          disabled={!playback.canGoPrevious}
          title="Go back a step"
        >
          ‹ Back
        </button>
        <button type="button" className="st-button" onClick={playback.replayStep} title="Watch this step again">
          ↻ Replay step
        </button>
        <span className="st-speeds" role="group" aria-label="Playback speed">
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              aria-pressed={playback.speed === speed}
              title={speed === 'instant' ? 'Skip the animation and show each step at once' : `Play at ${speed}× speed`}
              onClick={() => playback.setSpeed(speed)}
            >
              {speedLabel(speed)}
            </button>
          ))}
        </span>
        {finished ? (
          <button type="button" className="st-button st-button--primary" onClick={playback.restart}>
            Start over
          </button>
        ) : (
          // Always available: a learner who has already drawn it, or wants to
          // skip ahead, need not wait for the animation to end.
          <button type="button" className="st-button st-button--primary" onClick={playback.next}>
            I drew it!
          </button>
        )}
      </div>
    </section>
  )
}
