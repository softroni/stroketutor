/**
 * A copy of `items` with the element at `from` moved to index `to`, shifting
 * the ones in between. Out-of-range indices return an unchanged copy.
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items]
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return next
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
