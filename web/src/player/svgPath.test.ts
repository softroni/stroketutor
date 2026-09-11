import { describe, expect, it } from 'vitest'

import { formatPath, parsePath, SVGPathError, type PathSegment } from './svgPath'

/** Narrows a thrown value to SVGPathError so tests can assert on kind/index. */
function expectError(d: string): SVGPathError {
  try {
    parsePath(d)
  } catch (error) {
    if (error instanceof SVGPathError) return error
    throw error
  }
  throw new Error(`Expected parsePath(${JSON.stringify(d)}) to throw, but it succeeded.`)
}

describe('parsePath — supported commands', () => {
  it('parses a moveto', () => {
    expect(parsePath('M 10 20')).toEqual<PathSegment[]>([{ kind: 'move', to: { x: 10, y: 20 } }])
  })

  it('parses a lineto', () => {
    expect(parsePath('M 0 0 L 10 20')).toEqual<PathSegment[]>([
      { kind: 'move', to: { x: 0, y: 0 } },
      { kind: 'line', to: { x: 10, y: 20 } },
    ])
  })

  it('parses a cubic', () => {
    expect(parsePath('M 0 0 C 1 2 3 4 5 6')).toEqual<PathSegment[]>([
      { kind: 'move', to: { x: 0, y: 0 } },
      {
        kind: 'cubic',
        control1: { x: 1, y: 2 },
        control2: { x: 3, y: 4 },
        end: { x: 5, y: 6 },
      },
    ])
  })

  it('parses a quadratic', () => {
    expect(parsePath('M 0 0 Q 1 2 3 4')).toEqual<PathSegment[]>([
      { kind: 'move', to: { x: 0, y: 0 } },
      { kind: 'quad', control: { x: 1, y: 2 }, end: { x: 3, y: 4 } },
    ])
  })

  it('parses a closepath, upper or lower case', () => {
    const expected: PathSegment[] = [
      { kind: 'move', to: { x: 0, y: 0 } },
      { kind: 'line', to: { x: 10, y: 0 } },
      { kind: 'close' },
    ]
    expect(parsePath('M 0 0 L 10 0 Z')).toEqual(expected)
    expect(parsePath('M 0 0 L 10 0 z')).toEqual(expected)
  })

  it('parses every command in one path', () => {
    const segments = parsePath('M 0 0 L 10 10 C 20 20 30 30 40 40 Q 50 50 60 60 Z')
    expect(segments.map((s) => s.kind)).toEqual(['move', 'line', 'cubic', 'quad', 'close'])
  })
})

describe('parsePath — separators and repeated coordinate sets', () => {
  it('accepts commas as separators', () => {
    expect(parsePath('M10,20L30,40')).toEqual<PathSegment[]>([
      { kind: 'move', to: { x: 10, y: 20 } },
      { kind: 'line', to: { x: 30, y: 40 } },
    ])
  })

  it('accepts mixed commas, spaces and newlines, and leading whitespace', () => {
    expect(parsePath('  M 10, 20\n  L\t30 ,40  ')).toEqual<PathSegment[]>([
      { kind: 'move', to: { x: 10, y: 20 } },
      { kind: 'line', to: { x: 30, y: 40 } },
    ])
  })

  it('treats repeated pairs after L as separate line segments', () => {
    expect(parsePath('M 0 0 L 10 10 20 20')).toEqual<PathSegment[]>([
      { kind: 'move', to: { x: 0, y: 0 } },
      { kind: 'line', to: { x: 10, y: 10 } },
      { kind: 'line', to: { x: 20, y: 20 } },
    ])
  })

  it('treats extra pairs after M as implicit linetos', () => {
    expect(parsePath('M 10 10 20 20 30 30')).toEqual<PathSegment[]>([
      { kind: 'move', to: { x: 10, y: 10 } },
      { kind: 'line', to: { x: 20, y: 20 } },
      { kind: 'line', to: { x: 30, y: 30 } },
    ])
  })

  it('treats repeated coordinate sets after C as separate curves', () => {
    const segments = parsePath('M 0 0 C 1 1 2 2 3 3 4 4 5 5 6 6')
    expect(segments.map((s) => s.kind)).toEqual(['move', 'cubic', 'cubic'])
  })

  it('reads negative, decimal and exponent numbers', () => {
    expect(parsePath('M -10.5 +20 L .5 1e2')).toEqual<PathSegment[]>([
      { kind: 'move', to: { x: -10.5, y: 20 } },
      { kind: 'line', to: { x: 0.5, y: 100 } },
    ])
  })

  it('splits numbers that run together with a minus sign', () => {
    expect(parsePath('M 0 0 L 10-10')).toEqual<PathSegment[]>([
      { kind: 'move', to: { x: 0, y: 0 } },
      { kind: 'line', to: { x: 10, y: -10 } },
    ])
  })
})

describe('parsePath — multiple subpaths', () => {
  it('parses two subpaths in one d string', () => {
    const segments = parsePath('M 0 0 L 10 10 M 20 20 L 30 30')
    expect(segments).toEqual<PathSegment[]>([
      { kind: 'move', to: { x: 0, y: 0 } },
      { kind: 'line', to: { x: 10, y: 10 } },
      { kind: 'move', to: { x: 20, y: 20 } },
      { kind: 'line', to: { x: 30, y: 30 } },
    ])
  })

  it('parses the three-whisker stroke from the cat-face sample', () => {
    const segments = parsePath('M 240 600 L 60 555 M 248 640 L 45 640 M 272 680 L 70 725')
    expect(segments.map((s) => s.kind)).toEqual([
      'move',
      'line',
      'move',
      'line',
      'move',
      'line',
    ])
  })

  it('parses closed subpaths followed by more drawing', () => {
    const segments = parsePath('M 0 0 L 10 0 L 10 10 Z M 20 20 L 30 20 Z')
    expect(segments.map((s) => s.kind)).toEqual([
      'move',
      'line',
      'line',
      'close',
      'move',
      'line',
      'close',
    ])
  })
})

describe('parsePath — malformed input', () => {
  it('rejects a relative command rather than misrendering it', () => {
    const error = expectError('M 0 0 l 10 10')
    expect(error.kind).toBe('relativeCommandUnsupported')
    expect(error.index).toBe(6)
    expect(error.message).toContain("Relative command 'l' at position 6")
  })

  it('rejects a command outside the supported subset', () => {
    const error = expectError('M 0 0 A 5 5 0 0 1 10 10')
    expect(error.kind).toBe('unsupportedCommand')
    expect(error.index).toBe(6)
    expect(error.message).toContain('Only M, L, C, Q and Z are allowed')
  })

  it('rejects a path that does not begin with a moveto', () => {
    const error = expectError('L 10 10')
    expect(error.kind).toBe('missingInitialMove')
    expect(error.index).toBe(0)
  })

  it('rejects a truncated coordinate list and says how many it found', () => {
    const error = expectError('M 0 0 C 1 2 3 4')
    expect(error.kind).toBe('truncatedCommand')
    expect(error.index).toBe(6)
    expect(error.message).toContain('needs 6 numbers but only 4 followed it')
  })

  it('rejects a stray character where a command was expected', () => {
    const error = expectError('M 0 0 L 10 10 % 3')
    expect(error.kind).toBe('unexpectedCharacter')
    expect(error.index).toBe(14)
    expect(error.message).toContain("Unexpected character '%' at position 14")
  })

  it('rejects a lone moveto with a missing y coordinate', () => {
    const error = expectError('M 10')
    expect(error.kind).toBe('truncatedCommand')
    expect(error.message).toContain('needs 2 numbers but only 1 followed it')
  })

  it('rejects a number it cannot read', () => {
    const error = expectError('M 0 0 L . 10')
    expect(error.kind).toBe('invalidNumber')
    expect(error.index).toBe(8)
  })

  it('rejects an empty path', () => {
    expect(expectError('').kind).toBe('emptyPath')
    expect(expectError('   ').kind).toBe('emptyPath')
  })
})

describe('formatPath', () => {
  it('round-trips a path through parse and format', () => {
    const d = 'M 500 240 C 655 240 780 365 780 520 Q 700 700 500 800 Z'
    expect(formatPath(parsePath(d))).toBe(d)
  })
})
