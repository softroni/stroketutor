import { describe, expect, it } from 'vitest'

import { formatDay, formatDuration, plural } from './format'

describe('formatDuration', () => {
  it('reads like a player', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(7040)).toBe('0:07')
    expect(formatDuration(59_600)).toBe('1:00')
    expect(formatDuration(64_000)).toBe('1:04')
  })

  it('never shows nonsense for a missing or broken length', () => {
    expect(formatDuration(Number.NaN)).toBe('0:00')
    expect(formatDuration(-5)).toBe('0:00')
  })
})

describe('formatDay', () => {
  it('writes the month in letters', () => {
    expect(formatDay('2026-09-13T10:04:00.000Z')).toBe('13 Sep 2026')
  })

  it('hands back anything it cannot read', () => {
    expect(formatDay('not a date')).toBe('not a date')
  })
})

describe('plural', () => {
  it('counts files and steps', () => {
    expect(plural(1, 'file')).toBe('1 file')
    expect(plural(16, 'file')).toBe('16 files')
    expect(plural(0, 'step')).toBe('0 steps')
  })
})
