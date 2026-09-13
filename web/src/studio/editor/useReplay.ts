import { useEffect, useRef, useState } from 'react'

export interface ReplayState {
  /** The run these values belong to. */
  runId: number | null
  strokeIndex: number
  progress: number
  done: boolean
}

/**
 * Plays strokes one after another the way the learner player does: progress is
 * a fraction of each stroke's duration, never of its length.
 *
 * `durations` is read when a run starts; pass a new `runId` to start again and
 * `null` to stop. `rate` multiplies the clock (2 is twice as fast); `Infinity`
 * skips the animation and lands on the final frame at once. It is read at each
 * stroke boundary, so changing it mid-run takes effect from the next stroke.
 */
export function useReplay(durations: readonly number[], runId: number | null, rate = 1): ReplayState {
  const [state, setState] = useState<ReplayState>({
    runId: null,
    strokeIndex: 0,
    progress: 0,
    done: false,
  })
  const rateRef = useRef(rate)
  rateRef.current = rate

  useEffect(() => {
    if (runId === null) return
    const clock = [...durations]
    const last = clock.length - 1
    if (clock.length === 0 || rateRef.current === Infinity) {
      setState({ runId, strokeIndex: Math.max(0, last), progress: 1, done: true })
      return
    }

    let frame = 0
    let cancelled = false
    let index = 0
    let startedAt: number | null = null
    let duration = Math.max(0, clock[0]) / rateRef.current

    const tick = (now: number) => {
      if (cancelled) return
      if (startedAt === null) startedAt = now
      if (rateRef.current === Infinity) {
        setState({ runId, strokeIndex: last, progress: 1, done: true })
        return
      }
      const progress = duration > 0 ? Math.min(1, (now - startedAt) / 1000 / duration) : 1

      if (progress < 1) {
        setState({ runId, strokeIndex: index, progress, done: false })
      } else if (index < last) {
        // Strictly sequential, as in playback: the next stroke starts only now.
        index += 1
        startedAt = now
        duration = Math.max(0, clock[index]) / rateRef.current
        setState({ runId, strokeIndex: index, progress: 0, done: false })
      } else {
        setState({ runId, strokeIndex: index, progress: 1, done: true })
        return
      }
      frame = requestAnimationFrame(tick)
    }

    setState({ runId, strokeIndex: 0, progress: 0, done: false })
    frame = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
    // Deliberately keyed on the run alone: editing a duration mid-replay must
    // not restart it. The next run picks the new value up.
  }, [runId])

  return state
}
