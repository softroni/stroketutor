import type { LearningPath } from './types'

/**
 * The path colors: the app's own palette (`PathTint` in
 * PaperCoach/Design/PathTint.swift), with the same names, values and order. A
 * path names one in `paths.json` (`color`). The app paints the path's cards and
 * screens with it and a lesson video's backdrop is its deep shade, so the color
 * of a video is the color of its path in the app.
 */
export const PATH_COLORS = ['sky', 'peach', 'pink', 'butter', 'leaf', 'lavender', 'aqua', 'indigo', 'orchid', 'sand'] as const

export type PathColor = (typeof PATH_COLORS)[number]

export interface PathSwatch {
  label: string
  /** The app's card and hero fill. */
  soft: string
  /** The pressed edge under a card. */
  edge: string
  /** Bars, counts and chips in the app; the backdrop of a lesson video. */
  deep: string
}

export const PATH_SWATCHES: Record<PathColor, PathSwatch> = {
  sky: { label: 'Sky', soft: '#E3F1FD', edge: '#C3DDF6', deep: '#2F6BE8' },
  peach: { label: 'Peach', soft: '#FFEBDD', edge: '#F7CDB1', deep: '#D8572D' },
  pink: { label: 'Pink', soft: '#FDE6EE', edge: '#F4C5D5', deep: '#D6456F' },
  butter: { label: 'Butter', soft: '#FFF3C9', edge: '#F1DC8E', deep: '#A87414' },
  leaf: { label: 'Leaf', soft: '#E4F4DA', edge: '#C4E4B0', deep: '#4F8A1F' },
  lavender: { label: 'Lavender', soft: '#EEE8FD', edge: '#D6CAF6', deep: '#7A4FD6' },
  aqua: { label: 'Aqua', soft: '#DDF4F4', edge: '#B5E1E1', deep: '#178A8A' },
  indigo: { label: 'Indigo', soft: '#E6E9FC', edge: '#C8CEF3', deep: '#4052C8' },
  orchid: { label: 'Orchid', soft: '#F9E4F7', edge: '#EDC4E9', deep: '#A93CA0' },
  sand: { label: 'Sand', soft: '#F6EEDF', edge: '#E4D3B5', deep: '#8A5A33' },
}

export function isPathColor(value: unknown): value is PathColor {
  return typeof value === 'string' && (PATH_COLORS as readonly string[]).includes(value)
}

/**
 * The color a path wears: the one it names, else the palette's by its place in
 * `paths`, wrapping, as the app does for a path that names none.
 */
export function colorOfPath(paths: readonly LearningPath[], pathId: string): PathColor {
  const index = paths.findIndex((path) => path.id === pathId)
  const named = paths[index]?.color
  return named ?? PATH_COLORS[Math.max(index, 0) % PATH_COLORS.length]
}

/** The color a new path starts with: the first no other path wears, else the next in the palette by count. */
export function unusedPathColor(paths: readonly LearningPath[]): PathColor {
  const worn = new Set(paths.map((path) => colorOfPath(paths, path.id)))
  return PATH_COLORS.find((color) => !worn.has(color)) ?? PATH_COLORS[paths.length % PATH_COLORS.length]
}
