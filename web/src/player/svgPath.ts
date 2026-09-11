/**
 * Parser for the absolute-only `M / L / C / Q / Z` subset of the SVG path
 * grammar.
 *
 * This is a deliberate port of the iOS app's `SVGPathParser.swift`: same
 * accepted grammar, same rejections, same character indices in errors. The
 * browser would happily render a malformed `d` and the iOS parser would refuse
 * it, so the web player validates explicitly rather than trusting the DOM —
 * otherwise a tutorial could look fine here and fail on the device.
 */

export interface Point {
  x: number
  y: number
}

export type PathSegment =
  | { kind: 'move'; to: Point }
  | { kind: 'line'; to: Point }
  /** `C x1 y1 x2 y2 x y` */
  | { kind: 'cubic'; control1: Point; control2: Point; end: Point }
  /** `Q x1 y1 x y` */
  | { kind: 'quad'; control: Point; end: Point }
  | { kind: 'close' }

export type PathErrorKind =
  | 'unexpectedCharacter'
  | 'relativeCommandUnsupported'
  | 'unsupportedCommand'
  | 'missingInitialMove'
  | 'invalidNumber'
  | 'truncatedCommand'
  | 'emptyPath'

/** Every error names the character index in the original `d` string. */
export class SVGPathError extends Error {
  readonly kind: PathErrorKind
  /** Character index in `d`, or -1 when the whole string is at fault. */
  readonly index: number

  constructor(kind: PathErrorKind, index: number, message: string) {
    super(message)
    this.name = 'SVGPathError'
    this.kind = kind
    this.index = index
  }
}

const SUPPORTED_COMMANDS = 'MLCQZ'

function arity(command: string): number {
  switch (command) {
    case 'M':
    case 'L':
      return 2
    case 'Q':
      return 4
    case 'C':
      return 6
    default:
      return 0
  }
}

const isDigit = (c: string) => c >= '0' && c <= '9'
const isWhitespace = (c: string) => /\s/.test(c)
const isLetter = (c: string) => /\p{L}/u.test(c)
const isSeparator = (c: string) => c === ',' || isWhitespace(c)
/** True if `c` could begin a number — used to spot repeated coordinate sets. */
const startsNumber = (c: string) => isDigit(c) || c === '-' || c === '+' || c === '.'

/**
 * Parses `d` into its segment list.
 *
 * Throws {@link SVGPathError} on anything outside the subset — including
 * lowercase (relative) commands, which are rejected rather than misrendered as
 * absolute ones. `z`/`Z` are the exception: they mean the same thing, so a
 * lowercase `z` is accepted.
 */
export function parsePath(d: string): PathSegment[] {
  const chars = Array.from(d)
  let index = 0
  const segments: PathSegment[] = []
  let sawMove = false

  const isAtEnd = () => index >= chars.length

  const skipSeparators = () => {
    while (index < chars.length && isSeparator(chars[index])) index += 1
  }

  const peekStartsNumber = () => !isAtEnd() && startsNumber(chars[index])

  const readNumber = (): number => {
    const start = index
    if (index < chars.length && (chars[index] === '-' || chars[index] === '+')) index += 1

    let sawDigit = false
    while (index < chars.length && isDigit(chars[index])) {
      index += 1
      sawDigit = true
    }
    if (index < chars.length && chars[index] === '.') {
      index += 1
      while (index < chars.length && isDigit(chars[index])) {
        index += 1
        sawDigit = true
      }
    }
    // Scientific notation, e.g. "1.5e-3", as emitted by some exporters.
    if (sawDigit && index < chars.length && (chars[index] === 'e' || chars[index] === 'E')) {
      const exponentStart = index
      index += 1
      if (index < chars.length && (chars[index] === '-' || chars[index] === '+')) index += 1
      let sawExponentDigit = false
      while (index < chars.length && isDigit(chars[index])) {
        index += 1
        sawExponentDigit = true
      }
      if (!sawExponentDigit) index = exponentStart
    }

    const text = chars.slice(start, index).join('')
    const value = Number(text)
    if (!sawDigit || !Number.isFinite(value)) {
      throw new SVGPathError(
        'invalidNumber',
        start,
        `Could not read a number from "${text || (chars[start] ?? ' ')}" at position ${start}.`,
      )
    }
    return value
  }

  const readNumbers = (count: number, command: string, commandIndex: number): number[] => {
    const numbers: number[] = []
    for (let i = 0; i < count; i += 1) {
      skipSeparators()
      if (isAtEnd() || !peekStartsNumber()) {
        throw new SVGPathError(
          'truncatedCommand',
          commandIndex,
          `Command '${command}' at position ${commandIndex} needs ${count} numbers but only ${numbers.length} followed it.`,
        )
      }
      numbers.push(readNumber())
    }
    return numbers
  }

  const point = (numbers: number[], offset: number): Point => ({
    x: numbers[offset],
    y: numbers[offset + 1],
  })

  skipSeparators()
  while (!isAtEnd()) {
    const command = chars[index]
    if (!isLetter(command)) {
      throw new SVGPathError(
        'unexpectedCharacter',
        index,
        `Unexpected character '${command}' at position ${index}: expected a command letter (M, L, C, Q or Z).`,
      )
    }
    const commandIndex = index
    index += 1

    const normalized = command.toUpperCase()
    // 'z' and 'Z' are identical in meaning, so that is the one letter allowed
    // to be lowercase. Everything else lowercase is relative.
    if (normalized !== 'Z' && command !== normalized) {
      throw new SVGPathError(
        'relativeCommandUnsupported',
        commandIndex,
        `Relative command '${command}' at position ${commandIndex} is not supported. Re-export this path using absolute commands (uppercase).`,
      )
    }
    if (!SUPPORTED_COMMANDS.includes(normalized)) {
      throw new SVGPathError(
        'unsupportedCommand',
        commandIndex,
        `Command '${command}' at position ${commandIndex} is outside the supported subset. Only M, L, C, Q and Z are allowed.`,
      )
    }
    if (!sawMove && normalized !== 'M') {
      throw new SVGPathError(
        'missingInitialMove',
        commandIndex,
        `Path must begin with a moveto command (M) at position ${commandIndex}.`,
      )
    }

    if (normalized === 'Z') {
      segments.push({ kind: 'close' })
      skipSeparators()
      continue
    }

    const count = arity(normalized)
    let repetition = 0
    // One command letter may be followed by several coordinate sets:
    // "L 10 10 20 20" is two line segments.
    do {
      const numbers = readNumbers(count, command, commandIndex)
      switch (normalized) {
        case 'M':
          // Per the SVG grammar, coordinate pairs after the first in a moveto
          // are implicit linetos.
          segments.push(
            repetition === 0
              ? { kind: 'move', to: point(numbers, 0) }
              : { kind: 'line', to: point(numbers, 0) },
          )
          sawMove = true
          break
        case 'L':
          segments.push({ kind: 'line', to: point(numbers, 0) })
          break
        case 'C':
          segments.push({
            kind: 'cubic',
            control1: point(numbers, 0),
            control2: point(numbers, 2),
            end: point(numbers, 4),
          })
          break
        case 'Q':
          segments.push({ kind: 'quad', control: point(numbers, 0), end: point(numbers, 2) })
          break
        default:
          throw new SVGPathError(
            'unsupportedCommand',
            commandIndex,
            `Command '${command}' at position ${commandIndex} is outside the supported subset. Only M, L, C, Q and Z are allowed.`,
          )
      }
      repetition += 1
      skipSeparators()
    } while (peekStartsNumber())
  }

  if (segments.length === 0) {
    throw new SVGPathError('emptyPath', -1, 'The path string is empty.')
  }
  return segments
}

/** Re-emits segments as a `d` string. Handy for debugging round-trips. */
export function formatPath(segments: PathSegment[]): string {
  const n = (value: number) => String(Number(value.toFixed(4)))
  return segments
    .map((segment) => {
      switch (segment.kind) {
        case 'move':
          return `M ${n(segment.to.x)} ${n(segment.to.y)}`
        case 'line':
          return `L ${n(segment.to.x)} ${n(segment.to.y)}`
        case 'cubic':
          return `C ${n(segment.control1.x)} ${n(segment.control1.y)} ${n(segment.control2.x)} ${n(segment.control2.y)} ${n(segment.end.x)} ${n(segment.end.y)}`
        case 'quad':
          return `Q ${n(segment.control.x)} ${n(segment.control.y)} ${n(segment.end.x)} ${n(segment.end.y)}`
        case 'close':
          return 'Z'
      }
    })
    .join(' ')
}

let measuringPath: SVGPathElement | null = null

/**
 * Length of `d` in canvas units, measured by the browser.
 *
 * Uses a detached `<svg>`, so it needs no layout and can be called before the
 * stroke is on screen. Returns 0 outside a DOM.
 */
export function measurePathLength(d: string): number {
  if (typeof document === 'undefined') return 0
  if (!measuringPath) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    measuringPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    svg.appendChild(measuringPath)
  }
  measuringPath.setAttribute('d', d)
  return measuringPath.getTotalLength()
}
