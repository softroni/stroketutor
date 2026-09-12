import type { Catalog, LearningPath, Lesson } from './types'

/**
 * Two places for content (a Studio departure from master plan §27, recorded in
 * the README):
 *
 * - the **workspace**, a local SQLite file outside git, where every draft,
 *   generation, edit and photo lives until it is ready;
 * - **published** content in `shared/`, which git tracks and the iOS app
 *   bundles. Only Publish writes there.
 *
 * The workspace holds the working curriculum: every path and lesson, drafts
 * included. `shared/Catalog` is its projection onto published lessons. These
 * functions are that projection, and the list of what publishing would change.
 * They are pure, so the server and the tests share them.
 */

/** Where a lesson's current version lives. */
export type LessonState = 'workspace' | 'published' | 'published-edited'

/** What changed in a published lesson since it was published. */
export type EditedPart = 'drawing' | 'details' | 'photo'

export interface PathOrder {
  id: string
  title: string
  lessonIds: string[]
}

export type PendingChange =
  /** In the workspace only. `ready` once approved. */
  | { kind: 'new'; lessonId: string; ready: boolean }
  /** Published, with changes in the workspace. */
  | { kind: 'edited'; lessonId: string; ready: boolean; parts: EditedPart[] }
  /** The published paths, their titles or their order differ from the working curriculum. */
  | { kind: 'curriculum'; before: PathOrder[]; after: PathOrder[] }

export interface PublishingState {
  /** Lessons whose tutorial is in `shared/Tutorials`. */
  publishedIds: string[]
  /** Published lessons with unpublished changes. */
  editedIds: string[]
  pending: PendingChange[]
  /** `shared/Catalog` changed since the Studio last read or wrote it (a git pull, a hand edit). */
  sharedChangedOutside: boolean
  trashCount: number
}

/**
 * `shared/Catalog` as it should be once `published` is the set of published
 * lessons: the working order and paths, keeping only published lessons, and
 * dropping a path left with none. A lesson keeps the entry it was published
 * with unless it is one being published now (`updating`).
 */
export function projectCatalog(
  working: Catalog,
  shared: Catalog | null,
  published: ReadonlySet<string>,
  updating: ReadonlySet<string> = new Set(),
): Catalog {
  const sharedLessons = new Map((shared?.lessons ?? []).map((lesson) => [lesson.id, lesson]))
  const lessons: Lesson[] = []
  for (const lesson of working.lessons) {
    if (!published.has(lesson.id)) continue
    lessons.push(updating.has(lesson.id) ? lesson : (sharedLessons.get(lesson.id) ?? lesson))
  }
  const listed = new Set(lessons.map((lesson) => lesson.id))
  // A published lesson the working curriculum no longer lists keeps its entry,
  // so a projection can never drop published content by accident.
  for (const lesson of shared?.lessons ?? []) {
    if (published.has(lesson.id) && !listed.has(lesson.id)) {
      lessons.push(lesson)
      listed.add(lesson.id)
    }
  }

  const paths: LearningPath[] = working.paths.flatMap((path) => {
    const lessonIds = path.lessonIds.filter((id) => listed.has(id))
    return lessonIds.length > 0 ? [{ ...path, lessonIds }] : []
  })
  return { paths, lessons }
}

export interface PendingInput {
  working: Catalog
  shared: Catalog | null
  published: ReadonlySet<string>
  /** Published lessons whose working tutorial differs from the published file. */
  drawingChanged: ReadonlySet<string>
  /** Lessons with a photo in the workspace that is not the published one. */
  photoChanged: ReadonlySet<string>
}

/** Everything that differs between the working curriculum and what is published. */
export function pendingChanges(input: PendingInput): PendingChange[] {
  const sharedLessons = new Map((input.shared?.lessons ?? []).map((lesson) => [lesson.id, lesson]))
  const changes: PendingChange[] = []

  for (const lesson of input.working.lessons) {
    const ready = lesson.status === 'approved'
    if (!input.published.has(lesson.id)) {
      changes.push({ kind: 'new', lessonId: lesson.id, ready })
      continue
    }
    const parts: EditedPart[] = []
    if (input.drawingChanged.has(lesson.id)) parts.push('drawing')
    const published = sharedLessons.get(lesson.id)
    if (!published || !sameJSON(published, lesson)) parts.push('details')
    if (input.photoChanged.has(lesson.id)) parts.push('photo')
    if (parts.length > 0) changes.push({ kind: 'edited', lessonId: lesson.id, ready, parts })
  }

  const before = (input.shared?.paths ?? []).map(pathOrder)
  const after = projectCatalog(input.working, input.shared, input.published).paths.map(pathOrder)
  if (!sameJSON(before, after)) changes.push({ kind: 'curriculum', before, after })
  return changes
}

/** How many changes Publish could take now: approved lessons, and the curriculum. */
export function readyCount(pending: readonly PendingChange[]): number {
  return pending.filter((change) => change.kind === 'curriculum' || change.ready).length
}

function pathOrder(path: LearningPath): PathOrder {
  return { id: path.id, title: path.title, lessonIds: [...path.lessonIds] }
}

/** Equal as JSON, whatever order the keys were written in. */
export function sameJSON(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b)
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}
