import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { formatJSON } from './formatJSON'

const sharedDir = fileURLToPath(new URL('../../../shared/', import.meta.url))

describe('formatJSON', () => {
  // The whole point: saving an unchanged file must not produce a diff.
  for (const file of [
    'Tutorials/sun.json',
    'Tutorials/cloud.json',
    'Catalog/paths.json',
    'Catalog/lessons.json',
  ]) {
    it(`reproduces shared/${file} byte for byte`, () => {
      const text = readFileSync(`${sharedDir}${file}`, 'utf8')
      expect(formatJSON(JSON.parse(text))).toBe(text)
    })
  }

  it('inlines short number objects and scalar arrays, and expands the rest', () => {
    expect(
      formatJSON({ canvas: { width: 10, height: 20 }, ids: ['a', 'b'], style: { color: '#FFFFFF' } }),
    ).toBe(
      [
        '{',
        '  "canvas": { "width": 10, "height": 20 },',
        '  "ids": ["a", "b"],',
        '  "style": {',
        '    "color": "#FFFFFF"',
        '  }',
        '}',
        '',
      ].join('\n'),
    )
  })

  it('expands anything that would run past the line limit', () => {
    const ids = Array.from({ length: 12 }, (_, index) => `lesson-number-${index}`)
    const text = formatJSON({ ids })
    // `{`, `"ids": [`, one line per id, `]`, `}`, and the empty string after the final newline.
    expect(text.split('\n')).toHaveLength(ids.length + 5)
  })

  it('drops undefined properties, like JSON.stringify', () => {
    expect(formatJSON({ a: 1, b: undefined })).toBe('{ "a": 1 }\n')
  })
})
