/** Small formatters the Voice page uses, kept apart from the components so they can be tested. */

/**
 * A take's length as a player shows it: `0:07`, `1:04`. Rounded to the nearest
 * second, because a take is a recording of a sentence, not a stopwatch.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00'
  const seconds = Math.round(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * `13 Sep 2026`: short enough for a chip, unambiguous about the month. The
 * month names are written out rather than left to `toLocaleDateString`, which
 * spells September differently from one Node or browser version to the next.
 */
export function formatDay(iso: string): string {
  const when = new Date(iso)
  if (Number.isNaN(when.getTime())) return iso
  return `${when.getDate()} ${MONTHS[when.getMonth()]} ${when.getFullYear()}`
}

/** `13 Sep 2026 at 14:20`, for the line under a published lesson. */
export function formatDayAndTime(iso: string): string {
  const when = new Date(iso)
  if (Number.isNaN(when.getTime())) return iso
  const time = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`
  return `${formatDay(iso)} at ${time}`
}

/** "1 file" / "16 files": the Studio writes these counts in several places. */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}
