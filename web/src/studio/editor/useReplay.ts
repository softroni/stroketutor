import { useEffect, useState } from 'react'

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
 * `null` to stop.
 */
export function useReplay(durations: readonly number[], runId: number | null): ReplayState {
  const [state, setState] = useState<ReplayState>({
    runId: null,
    strokeIndex: 0,
    progress: 0,
    done: false,
  })

  useEffect(() => {
    if (runId === null) return
    const clock = [...durations]
    if (clock.length === 0) {
      setState({ runId, strokeIndex: 0, progress: 1, done: true })
      return
    }

    let frame = 0
    let cancelled = false
    let index = 0
    let startedAt: number | null = null

    const tick = (now: number) => {
      if (cancelled) return
      if (startedAt === null) startedAt = now
      const duration = Math.max(0, clock[index])
      const progress = duration > 0 ? Math.min(1, (now - startedAt) / 1000 / duration) : 1

      if (progress < 1) {
        setState({ runId, strokeIndex: index, progress, done: false })
      } else if (index + 1 < clock.length) {
        // Strictly sequential, as in playback: the next stroke starts only now.
        index += 1
        startedAt = now
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
