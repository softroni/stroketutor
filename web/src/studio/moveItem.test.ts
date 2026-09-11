import { describe, expect, it } from 'vitest'

import { moveItem } from './moveItem'

describe('moveItem', () => {
  const items = ['a', 'b', 'c', 'd']

  it('moves an item down, shifting the ones it passes up', () => {
    expect(moveItem(items, 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves an item up', () => {
    expect(moveItem(items, 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('leaves the input untouched and ignores out-of-range moves', () => {
    expect(moveItem(items, 1, 9)).toEqual(items)
    expect(moveItem(items, -1, 0)).toEqual(items)
    expect(items).toEqual(['a', 'b', 'c', 'd'])
  })
})
