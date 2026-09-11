import { describe, expect, it } from 'vitest'

import { HISTORY_LIMIT, commit, createHistory, redo, undo } from './history'

describe('history', () => {
  it('undoes and redoes in order', () => {
    let history = createHistory('a')
    history = commit(history, 'b')
    history = commit(history, 'c')

    history = undo(history)
    expect(history.present).toBe('b')
    history = undo(history)
    expect(history.present).toBe('a')
    expect(undo(history)).toBe(history)

    history = redo(redo(history))
    expect(history.present).toBe('c')
    expect(redo(history)).toBe(history)
  })

  it('drops the redo branch on a new commit', () => {
    let history = commit(commit(createHistory(1), 2), 3)
    history = commit(undo(history), 9)
    expect(history.future).toEqual([])
    expect(history.past).toEqual([1, 2])
  })

  it('collapses consecutive commits with the same key into one undo step', () => {
    let history = createHistory('')
    history = commit(history, 'H', 'title')
    history = commit(history, 'Ho', 'title')
    history = commit(history, 'Hou', 'title')
    history = commit(history, 'Hou!', 'instruction')

    expect(undo(history).present).toBe('Hou')
    expect(undo(undo(history)).present).toBe('')
  })

  it('ignores a commit of the same value', () => {
    const history = createHistory('a')
    expect(commit(history, 'a')).toBe(history)
  })

  it('keeps a bounded past', () => {
    let history = createHistory(0)
    for (let i = 1; i <= HISTORY_LIMIT + 50; i += 1) history = commit(history, i)
    expect(history.past).toHaveLength(HISTORY_LIMIT)
  })
})
