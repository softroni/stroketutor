import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { Step, Tutorial } from '../schema/types'

export const SPEEDS = [0.5, 1, 1.5] as const
export type Speed = (typeof SPEEDS)[number]

/**
 * `idle -> drawing(step) -> awaitingUser(step) -> drawing(next) -> ... -> finished`
 *
 * `runId` makes every transition a distinct object even when phase and step are
 * unchanged, so "Watch again" from `awaitingUser(2)` to `drawing(2)` restarts
 * the animation instead of being swallowed as a no-op re-render.
 */
export type PlaybackState =
  | { phase: 'idle'; runId: number }
  | { phase: 'drawing'; stepIndex: number; runId: number }
  | { phase: 'awaitingUser'; stepIndex: number; runId: number }
  | { phase: 'finished'; runId: number }

export interface Playback {
  state: PlaybackState
  /** The step being drawn, waited on, or last completed. */
  currentStep: Step
  currentStepIndex: number
  stepCount: number
  speed: Speed
  /** Index of the stroke currently being drawn within `currentStep`. */
  strokeIndex: number
  /** 0..1 through that stroke. */
  strokeProgress: number
  next: () => void
  previous: () => void
  replayStep: () => void
  restart: () => void
  setSpeed: (speed: Speed) => void
  /** Cycles 0.5x -> 1x -> 1.5x -> 0.5x. */
  cycleSpeed: () => void
  canGoPrevious: boolean
  canGoNext: boolean
}

/**
 * Drives stroke animation with `requestAnimationFrame` and an explicit progress
 * value.
 *
 * Progress is a fraction of the stroke's *duration*, never of its length — two
 * strokes with the same duration take the same time regardless of how long the
 * path is, which is what the iOS player does and what makes timing parity
 * checkable. Turning that fraction into a dash offset is the canvas's job.
 */
export function usePlayback(tutorial: Tutorial): Playback {
  const stepCount = tutorial.steps.length

  const [state, setState] = useState<PlaybackState>({
    phase: 'drawing',
    stepIndex: 0,
    runId: 0,
  })
  const [cursor, setCursor] = useState({ strokeIndex: 0, progress: 0 })
  const [speed, setSpeedState] = useState<Speed>(1)

  // Read inside the rAF loop at each stroke boundary, so changing speed takes
  // effect on the next stroke without retiming the one in flight.
  const speedRef = useRef<Speed>(speed)

  const setSpeed = useCallback((value: Speed) => {
    speedRef.current = value
    setSpeedState(value)
  }, [])

  const cycleSpeed = useCallback(() => {
    const index = SPEEDS.indexOf(speedRef.current)
    setSpeed(SPEEDS[(index + 1) % SPEEDS.length])
  }, [setSpeed])

  const transition = useCallback((make: (runId: number) => PlaybackState) => {
    setState((previous) => make(previous.runId + 1))
  }, [])

  // Loading a different tutorial rewinds to the top. Compared by identity, and
  // skipped on mount so the first step starts exactly once.
  const loadedTutorial = useRef(tutorial)
  useEffect(() => {
    if (loadedTutorial.current === tutorial) return
    loadedTutorial.current = tutorial
    setCursor({ strokeIndex: 0, progress: 0 })
    transition((runId) => ({ phase: 'drawing', stepIndex: 0, runId }))
  }, [tutorial, transition])

  const currentStepIndex = useMemo(() => {
    switch (state.phase) {
      case 'idle':
        return 0
      case 'finished':
        return Math.max(0, stepCount - 1)
      default:
        return Math.min(state.stepIndex, Math.max(0, stepCount - 1))
    }
  }, [state, stepCount])

  useEffect(() => {
    if (state.phase !== 'drawing') return

    const strokes = tutorial.steps[state.stepIndex]?.strokes ?? []
    if (strokes.length === 0) {
      setState((previous) => ({
        phase: 'awaitingUser',
        stepIndex: state.stepIndex,
        runId: previous.runId,
      }))
      return
    }

    let frame = 0
    let cancelled = false
    let index = 0
    let startedAt = 0
    let duration = 0

    const beginStroke = (strokeIndex: number, now: number) => {
      index = strokeIndex
      startedAt = now
      duration = Math.max(0, strokes[strokeIndex].duration) / speedRef.current
      setCursor({ strokeIndex, progress: 0 })
    }

    const tick = (now: number) => {
      if (cancelled) return
      const elapsed = (now - startedAt) / 1000
      const progress = duration > 0 ? Math.min(1, elapsed / duration) : 1
      setCursor({ strokeIndex: index, progress })

      if (progress >= 1) {
        if (index + 1 < strokes.length) {
          // Strictly sequential: the next stroke starts only now.
          beginStroke(index + 1, now)
        } else {
          setState((previous) => ({
            phase: 'awaitingUser',
            stepIndex: state.stepIndex,
            runId: previous.runId,
          }))
          return
        }
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame((now) => {
      if (cancelled) return
      beginStroke(0, now)
      frame = requestAnimationFrame(tick)
    })

    // Runs on unmount and before every state change, so no loop outlives the
    // state that started it.
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [state, tutorial])

  const next = useCallback(() => {
    if (state.phase === 'finished') return
    const target = currentStepIndex + 1
    if (target >= stepCount) {
      transition((runId) => ({ phase: 'finished', runId }))
    } else {
      setCursor({ strokeIndex: 0, progress: 0 })
      transition((runId) => ({ phase: 'drawing', stepIndex: target, runId }))
    }
  }, [state.phase, currentStepIndex, stepCount, transition])

  const previous = useCallback(() => {
    const target = state.phase === 'finished' ? stepCount - 1 : currentStepIndex - 1
    if (target < 0) return
    setCursor({ strokeIndex: 0, progress: 0 })
    transition((runId) => ({ phase: 'drawing', stepIndex: target, runId }))
  }, [state.phase, currentStepIndex, stepCount, transition])

  const replayStep = useCallback(() => {
    setCursor({ strokeIndex: 0, progress: 0 })
    transition((runId) => ({ phase: 'drawing', stepIndex: currentStepIndex, runId }))
  }, [currentStepIndex, transition])

  const restart = useCallback(() => {
    setCursor({ strokeIndex: 0, progress: 0 })
    transition((runId) => ({ phase: 'drawing', stepIndex: 0, runId }))
  }, [transition])

  return {
    state,
    currentStep: tutorial.steps[currentStepIndex],
    currentStepIndex,
    stepCount,
    speed,
    strokeIndex: cursor.strokeIndex,
    strokeProgress: cursor.progress,
    next,
    previous,
    replayStep,
    restart,
    setSpeed,
    cycleSpeed,
    canGoPrevious: state.phase === 'finished' ? stepCount > 0 : currentStepIndex > 0,
    canGoNext: state.phase !== 'finished',
  }
}
