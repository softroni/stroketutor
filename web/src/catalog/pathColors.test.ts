import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import schema from '@shared/catalog.schema.json'

import { colorOfPath, PATH_COLORS, PATH_SWATCHES, unusedPathColor } from './pathColors'
import type { LearningPath } from './types'

const path = (id: string, color?: LearningPath['color']): LearningPath => ({ id, title: id, ...(color ? { color } : {}), lessonIds: [] })

describe('colorOfPath', () => {
  it('is the color a path names, else the palette by its place, wrapping', () => {
    const paths = [path('a'), path('b', 'sand'), ...PATH_COLORS.map((_, index) => path(`x${index}`))]
    expect(colorOfPath(paths, 'a')).toBe('sky')
    expect(colorOfPath(paths, 'b')).toBe('sand')
    expect(colorOfPath(paths, 'x0')).toBe('pink')
    expect(colorOfPath(paths, 'x9')).toBe('peach')
  })
})

describe('unusedPathColor', () => {
  it('is the first color no path wears, else the next by count', () => {
    expect(unusedPathColor([])).toBe('sky')
    expect(unusedPathColor([path('a', 'sky'), path('b')])).toBe('pink')
    const full = PATH_COLORS.map((color, index) => path(`p${index}`, color))
    expect(unusedPathColor([...full, path('extra', 'sky')])).toBe('peach')
  })
})

/** The Studio, the schema and the app must name the same ten colors with the same values. */
describe('the palette the app draws with', () => {
  const swift = readFileSync(new URL('../../../PaperCoach/Design/PathTint.swift', import.meta.url), 'utf8')
  const entries = [...swift.matchAll(/\("(\w+)", PathTint\(soft: "(#\w{6})", edge: "(#\w{6})", deep: "(#\w{6})"\)\)/g)]

  it('matches PathTint.swift, in order', () => {
    expect(entries.map(([, name, soft, edge, deep]) => ({ name, soft, edge, deep }))).toEqual(
      PATH_COLORS.map((name) => ({ name, soft: PATH_SWATCHES[name].soft, edge: PATH_SWATCHES[name].edge, deep: PATH_SWATCHES[name].deep })),
    )
  })

  it('is the list the catalog schema allows', () => {
    expect(schema.definitions.path.properties.color.enum).toEqual([...PATH_COLORS])
  })
})
