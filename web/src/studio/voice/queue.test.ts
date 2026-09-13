import { describe, expect, it } from 'vitest'

import { createSequentialQueue, type QueueState } from './queue'

/** A promise whose settling this test controls, standing in for a slow request. */
function deferred() {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Lets every already-settled promise run its callbacks. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('createSequentialQueue', () => {
  it('runs one task at a time, in order', async () => {
    const started: string[] = []
    const gates = { a: deferred(), b: deferred(), c: deferred() }
    const queue = createSequentialQueue()
    const task = (id: keyof typeof gates) => () => {
      started.push(id)
      return gates[id].promise
    }

    const all = Promise.all([queue.add('a', task('a')), queue.add('b', task('b')), queue.add('c', task('c'))])
    await settle()
    expect(started).toEqual(['a'])
    expect(queue.state()).toMatchObject({ running: 'a', waiting: ['b', 'c'], done: 0, total: 3 })

    gates.a.resolve()
    await settle()
    expect(started).toEqual(['a', 'b'])
    expect(queue.state()).toMatchObject({ running: 'b', waiting: ['c'], done: 1, total: 3 })

    gates.b.resolve()
    gates.c.resolve()
    await all
    await settle()
    expect(started).toEqual(['a', 'b', 'c'])
    // The burst is over, so the count starts again from nothing.
    expect(queue.state()).toEqual({ running: null, waiting: [], done: 0, total: 0 })
  })

  it('collapses a repeated id onto the task already asked for', async () => {
    let runs = 0
    const gate = deferred()
    const queue = createSequentialQueue()
    const run = () => {
      runs += 1
      return gate.promise
    }

    const first = queue.add('line', run)
    const second = queue.add('line', run)
    expect(second).toBe(first)
    expect(queue.has('line')).toBe(true)
    expect(queue.state().total).toBe(1)

    gate.resolve()
    await first
    await settle()
    expect(runs).toBe(1)
    expect(queue.has('line')).toBe(false)
  })

  it('keeps going after a task fails, and reports the failure to its caller', async () => {
    const gates = { a: deferred(), b: deferred() }
    const queue = createSequentialQueue()
    const failing = queue.add('a', () => gates.a.promise)
    const after = queue.add('b', () => gates.b.promise)

    gates.a.reject(new Error('the voice server answered 500'))
    await expect(failing).rejects.toThrow('the voice server answered 500')
    await settle()
    expect(queue.state()).toMatchObject({ running: 'b', done: 1, total: 2 })

    gates.b.resolve()
    await after
  })

  it('survives a task that throws before it returns a promise', async () => {
    const queue = createSequentialQueue()
    const thrown = queue.add('a', () => {
      throw new Error('nope')
    })
    await expect(thrown).rejects.toThrow('nope')
    const ran = queue.add('b', () => Promise.resolve())
    await expect(ran).resolves.toBeUndefined()
  })

  it('stop drops what has not started and leaves the running task alone', async () => {
    const gate = deferred()
    const queue = createSequentialQueue()
    const running = queue.add('a', () => gate.promise)
    const dropped = queue.add('b', () => Promise.resolve())
    await settle()

    queue.stop()
    await expect(dropped).rejects.toThrow('Stopped.')
    expect(queue.has('b')).toBe(false)
    expect(queue.state()).toMatchObject({ running: 'a', waiting: [], total: 1 })

    gate.resolve()
    await running
  })

  it('tells a listener about every change', async () => {
    const seen: QueueState[] = []
    const queue = createSequentialQueue((state) => seen.push(state))
    await queue.add('a', () => Promise.resolve())
    await settle()
    expect(seen[0]).toMatchObject({ running: 'a', total: 1 })
    expect(seen[seen.length - 1]).toEqual({ running: null, waiting: [], done: 0, total: 0 })
  })
})
