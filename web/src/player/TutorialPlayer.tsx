import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { cssColor, resolveStyle, type Tutorial } from '../schema/types'

import { INTRO_ID, OUTRO_ID } from '../voice/bookends'

import { introFrame, introSeconds } from './intro'
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
  /**
   * Told what is on screen, for a host that speaks the lesson: a step's id,
   * `lesson-intro` while the intro plays and `lesson-outro` once the drawing
   * is finished (the ids `voice/bookends.ts` records them under). `run`
   * changes when the same thing is shown again from its start.
   */
  onStep?: (stepId: string, run: number) => void
  /** Start straight at step 1, without the look at what is going to be drawn. */
  skipIntro?: boolean
  /** What Lina says around the lesson, when the host has it: shown as she says it, and the intro runs for as long as she speaks. */
  lina?: { intro?: { text: string; seconds?: number }; outro?: { text: string } }
  /** Shown in the instruction card under the hint, such as the host's voice controls. */
  cardExtra?: ReactNode
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
export function TutorialPlayer({ tutorial, fill = false, onStep, cardExtra, skipIntro = false, lina }: TutorialPlayerProps) {
  const playback = usePlayback(tutorial)
  const { state, currentStep, currentStepIndex, stepCount } = playback
  const style = useMemo(() => resolveStyle(tutorial.style), [tutorial.style])

  const finished = state.phase === 'finished'
  const awaiting = state.phase === 'awaitingUser'

  // ---------- the intro: what we are going to draw, and how it comes together ----------
  const [intro, setIntro] = useState<{ run: number; elapsed: number } | null>(skipIntro ? null : { run: 0, elapsed: 0 })
  const introRun = intro?.run ?? null
  const introTotal = Math.max(4, lina?.intro?.seconds ?? introSeconds(tutorial))
  // A different lesson starts with its own intro; an edit to this one does not start it again.
  const lessonId = useRef(tutorial.id)
  useEffect(() => {
    if (lessonId.current === tutorial.id) return
    lessonId.current = tutorial.id
    setIntro(skipIntro ? null : { run: 0, elapsed: 0 })
  }, [tutorial.id, skipIntro])
  useEffect(() => {
    if (introRun === null) return
    const started = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      const elapsed = (now - started) / 1000
      setIntro((current) => (current && current.run === introRun ? { run: introRun, elapsed } : current))
      if (elapsed < introTotal) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [introRun, introTotal])
  const { restart } = playback
  const ready = useCallback(() => {
    setIntro(null)
    restart()
  }, [restart])
  const watchIntroAgain = () => setIntro((current) => ({ run: (current?.run ?? 0) + 1, elapsed: 0 }))
  const frame = intro ? introFrame(tutorial, intro.elapsed, introTotal) : null

  const shownStepId = intro ? INTRO_ID : finished ? OUTRO_ID : currentStep.id
  const shownRun = intro ? intro.run : state.runId
  const shownRunOfStep = intro || finished ? shownRun : 0
  useEffect(() => onStep?.(shownStepId, shownRunOfStep), [onStep, shownStepId, shownRunOfStep])

  // While drawing, the finished picture stays beside the step dots: tap it for a longer look over the paper.
  const [peek, setPeek] = useState(false)
  useEffect(() => setPeek(false), [currentStepIndex, finished])
  const whole = useMemo(() => upTo(tutorial, stepCount), [tutorial, stepCount])
  const goalPicture = (
    <StrokeCanvas
      canvas={tutorial.canvas}
      strokeColor={style.strokeColor}
      backgroundColor={style.backgroundColor}
      strokes={whole.strokes}
      fills={whole.fills}
      activeIndex={whole.strokes.length + whole.fills.length}
      activeProgress={1}
      title={`${tutorial.title}, finished`}
    />
  )

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
            {frame
              ? frame.stage === 'build'
                ? `Coming up · ${tutorial.steps[frame.stepIndex].title}`
                : 'Here is what we are going to draw'
              : finished
                ? 'All steps finished'
                : `Step ${currentStepIndex + 1} of ${stepCount} · ${currentStep.title}`}
          </p>
        </div>
        <div className="st-player__aside">
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
          {!frame && !finished ? (
            // Beside the paper, never on it: the corner of the paper is where part of the drawing is.
            <button
              type="button"
              className="st-goal"
              style={{ ['--ratio' as string]: String(tutorial.canvas.width / tutorial.canvas.height) }}
              onClick={() => setPeek((open) => !open)}
              aria-pressed={peek}
              title={peek ? 'Back to the step' : 'See what we are drawing'}
            >
              {goalPicture}
            </button>
          ) : null}
        </div>
      </header>

      <div className="st-player__stage">
        <div
          className="st-canvas-frame"
          style={{ ['--ratio' as string]: String(tutorial.canvas.width / tutorial.canvas.height) }}
        >
          {frame ? (
            <StrokeCanvas
              className="st-canvas"
              canvas={tutorial.canvas}
              strokeColor={style.strokeColor}
              backgroundColor={style.backgroundColor}
              completed={frame.stage === 'build' ? upTo(tutorial, frame.stepIndex).strokes : []}
              completedFills={frame.stage === 'build' ? upTo(tutorial, frame.stepIndex).fills : []}
              strokes={frame.stage === 'build' ? strokesOfStep(tutorial, frame.stepIndex) : whole.strokes}
              fills={frame.stage === 'build' ? fillsOfStep(tutorial, frame.stepIndex) : whole.fills}
              activeIndex={frame.stage === 'build' ? frame.itemIndex : whole.strokes.length + whole.fills.length}
              activeProgress={frame.stage === 'build' ? frame.progress : 1}
              title={`${tutorial.title}: what we are going to draw`}
            />
          ) : (
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
          )}
          {peek && !frame && !finished ? (
            <button type="button" className="st-goal-peek" onClick={() => setPeek(false)} title="Back to the step">
              {goalPicture}
            </button>
          ) : null}
        </div>
      </div>

      <div className={`st-card ${awaiting || finished ? 'st-card--active' : ''}`} aria-live="polite">
        <p className="st-card__instruction">
          {frame
            ? (lina?.intro?.text ?? `We are going to draw ${tutorial.title}. Watch how it comes together, then it is your turn.`)
            : finished
              ? (lina?.outro?.text ?? 'That is the whole drawing. Nicely done!')
              : currentStep.instruction}
        </p>
        {frame ? <p className="st-card__hint">Just watch for now. Tap “I’m ready” whenever you like.</p> : finished ? null : <p className="st-card__hint">{hint}</p>}
        {cardExtra}
      </div>

      {frame ? (
        <div className="st-controls" role="toolbar" aria-label="Lesson controls">
          <button type="button" className="st-button" onClick={watchIntroAgain} title="Watch it come together again">
            ↻ Watch again
          </button>
          <button type="button" className="st-button st-button--primary" onClick={ready}>
            I’m ready
          </button>
        </div>
      ) : (
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
      )}
    </section>
  )
}
