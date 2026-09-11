/** Longest line, indentation and key included, that a short value may be inlined on. */
const INLINE_LIMIT = 80

/**
 * Serialises a document the way the hand-written files in `shared/` are laid
 * out, so a Studio save of an unchanged lesson produces no diff: two-space
 * indentation, a trailing newline, and short objects of numbers or arrays of
 * scalars kept on one line — `"canvas": { "width": 1000, "height": 1000 }`,
 * `"lessonIds": ["simple-house"]`. Everything else is expanded, one property
 * per line, so review diffs stay line-oriented.
 */
export function formatJSON(value: unknown): string {
  return `${render(value, '', 0)}\n`
}

function render(value: unknown, indent: string, keyWidth: number): string {
  const fits = (inline: string) => indent.length + keyWidth + inline.length <= INLINE_LIMIT
  const inner = `${indent}  `

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    if (value.every(isScalar)) {
      const inline = `[${value.map((item) => JSON.stringify(item)).join(', ')}]`
      if (fits(inline)) return inline
    }
    const items = value.map((item) => `${inner}${render(item, inner, 0)}`)
    return `[\n${items.join(',\n')}\n${indent}]`
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, entry]) => entry !== undefined)
    if (entries.length === 0) return '{}'
    if (entries.every(([, entry]) => typeof entry === 'number')) {
      const inline = `{ ${entries
        .map(([key, entry]) => `${JSON.stringify(key)}: ${JSON.stringify(entry)}`)
        .join(', ')} }`
      if (fits(inline)) return inline
    }
    const lines = entries.map(([key, entry]) => {
      const prefix = `${JSON.stringify(key)}: `
      return `${inner}${prefix}${render(entry, inner, prefix.length)}`
    })
    return `{\n${lines.join(',\n')}\n${indent}}`
  }

  return JSON.stringify(value)
}

function isScalar(value: unknown): boolean {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value)
}
