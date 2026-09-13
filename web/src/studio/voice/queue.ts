/**
 * One request at a time, in the order they were asked for.
 *
 * The text-to-speech server serialises generation anyway, so firing several
 * requests at once only makes them all slow and hides which one is running.
 * The page puts every "make this line" through this queue instead, which gives
 * it something honest to show: what is being made now, and how many are behind
 * it ("2 of 5").
 *
 * A burst is a run of work with no idle moment in between. `done` and `total`
 * count the current burst and reset once the queue empties, so the progress
 * text does not keep growing over an afternoon of casting.
 */

export interface QueueState {
  /** The task being run now, by id, or null while the queue is idle. */
  running: string | null
  /** Tasks waiting their turn, in order, by id. */
  waiting: string[]
  /** Finished (or failed) in the current burst. */
  done: number
  /** Everything in the current burst: finished, running and waiting. */
  total: number
}

export interface SequentialQueue {
  /**
   * Adds a task, unless one with the same id is already running or waiting, in
   * which case the existing task's promise is returned instead: asking twice
   * for the same line does not make it twice.
   */
  add(id: string, run: () => Promise<void>): Promise<void>
  /** True while `id` is running or waiting. */
  has(id: string): boolean
  /** Drops everything not yet started. The running task is left to finish. */
  stop(): void
  state(): QueueState
}

/** What a queue with nothing in it reports, handy as a component's first state. */
export const IDLE_QUEUE: QueueState = { running: null, waiting: [], done: 0, total: 0 }

export function createSequentialQueue(onChange: (state: QueueState) => void = () => {}): SequentialQueue {
  interface Entry {
    id: string
    run: () => Promise<void>
    resolve: () => void
    reject: (error: unknown) => void
  }

  let waiting: Entry[] = []
  let running: Entry | null = null
  let done = 0
  let total = 0
  const promises = new Map<string, Promise<void>>()

  const state = (): QueueState => ({
    running: running?.id ?? null,
    waiting: waiting.map((entry) => entry.id),
    done,
    total,
  })

  const announce = () => onChange(state())

  const pump = () => {
    if (running) return
    const next = waiting.shift()
    if (!next) {
      // The burst is over: the next one starts its count from zero.
      done = 0
      total = 0
      announce()
      return
    }
    running = next
    announce()
    let task: Promise<void>
    try {
      task = next.run()
    } catch (error) {
      task = Promise.reject(error)
    }
    void task.then(next.resolve, next.reject).finally(() => {
      promises.delete(next.id)
      running = null
      done += 1
      pump()
    })
  }

  return {
    add(id, run) {
      const existing = promises.get(id)
      if (existing) return existing
      const promise = new Promise<void>((resolve, reject) => {
        waiting.push({ id, run, resolve, reject })
      })
      promises.set(id, promise)
      total += 1
      // The caller decides what a failure means; a caller that ignores the
      // promise should not raise an unhandled rejection.
      promise.catch(() => {})
      pump()
      return promise
    },
    has(id) {
      return promises.has(id)
    },
    stop() {
      const dropped = waiting
      waiting = []
      total -= dropped.length
      for (const entry of dropped) {
        promises.delete(entry.id)
        entry.reject(new Error('Stopped.'))
      }
      if (!running) {
        done = 0
        total = 0
      }
      announce()
    },
    state,
  }
}
