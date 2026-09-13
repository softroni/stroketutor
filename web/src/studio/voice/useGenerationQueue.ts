import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { createSequentialQueue, IDLE_QUEUE, type QueueState, type SequentialQueue } from './queue'

export interface GenerationQueue {
  state: QueueState
  /** Queues one piece of speech. The same id asked for twice joins the first request. */
  run(id: string, task: () => Promise<void>): Promise<void>
  /** True while this id is being made or is waiting its turn. */
  isBusy(id: string): boolean
  /** True only for the one being made right now. */
  isRunning(id: string): boolean
  /** True while this id is waiting for its turn: queued, but nothing is happening to it yet. */
  isQueued(id: string): boolean
  /** True while anything at all is being made. */
  busy: boolean
  /** "2 of 5" while several are in flight, else null: one at a time needs no counter. */
  progress: string | null
  /** Drops everything not yet started. */
  stop(): void
}

/**
 * React's view of the page's one generation queue. Every "Make", "another
 * take" and "Narrate" goes through it, so the speech server is asked for one
 * line at a time and the page can say what it is waiting for.
 */
export function useGenerationQueue(): GenerationQueue {
  const [state, setState] = useState<QueueState>(IDLE_QUEUE)
  const queue = useRef<SequentialQueue | null>(null)
  queue.current ??= createSequentialQueue(setState)

  // Whatever is still queued when the page goes away should not keep running.
  useEffect(() => {
    const current = queue.current
    return () => current?.stop()
  }, [])

  const run = useCallback((id: string, task: () => Promise<void>) => queue.current!.add(id, task), [])
  const isRunning = useCallback((id: string) => state.running === id, [state])
  const isQueued = useCallback((id: string) => state.waiting.includes(id), [state])
  const isBusy = useCallback((id: string) => state.running === id || state.waiting.includes(id), [state])
  const stop = useCallback(() => queue.current!.stop(), [])

  return useMemo(
    () => ({
      state,
      run,
      isBusy,
      isRunning,
      isQueued,
      busy: state.running !== null,
      progress: state.total > 1 ? `${Math.min(state.done + 1, state.total)} of ${state.total}` : null,
      stop,
    }),
    [isBusy, isQueued, isRunning, run, state, stop],
  )
}
