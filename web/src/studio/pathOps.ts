import type { Catalog, LearningPath } from '../catalog/types'

import { moveItem } from './moveItem'

/**
 * Curriculum edits for the Paths view (master plan §15, §28 item 1). Each
 * returns a new catalog and leaves its input untouched; the Studio saves the
 * result through the repository writer, which validates it again.
 *
 * Path ids never change once created: lessons and, later, the iOS app refer to
 * a path by id, so only its title and description are editable.
 */

/** A change that cannot be made, with a sentence the creator can act on. */
export class CatalogEditError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CatalogEditError'
  }
}

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export interface PathFields {
  title: string
  description: string
}

/** A lowercase, dash-separated id from a title: "Streets & Places" → "streets-places". */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function createPath(catalog: Catalog, id: string, fields: PathFields): Catalog {
  const title = requireTitle(fields.title)
  if (!ID_PATTERN.test(id)) {
    throw new CatalogEditError('The id must use lowercase letters, digits and single dashes.')
  }
  if (catalog.paths.some((path) => path.id === id)) {
    throw new CatalogEditError(`There is already a path with the id "${id}".`)
  }
  return { ...catalog, paths: [...catalog.paths, record(id, title, fields.description, [])] }
}

export function updatePath(catalog: Catalog, id: string, fields: PathFields): Catalog {
  const path = pathById(catalog, id)
  const title = requireTitle(fields.title)
  return replacePath(catalog, id, record(path.id, title, fields.description, path.lessonIds))
}

/** Only an empty path can go, so deleting one can never orphan a lesson by accident. */
export function deletePath(catalog: Catalog, id: string): Catalog {
  const path = pathById(catalog, id)
  if (path.lessonIds.length > 0) {
    const count = path.lessonIds.length
    throw new CatalogEditError(
      `"${path.title}" still has ${count} ${count === 1 ? 'lesson' : 'lessons'}. Move them to another path first.`,
    )
  }
  return { ...catalog, paths: catalog.paths.filter((candidate) => candidate.id !== id) }
}

/** Changes the order learners see the paths in. */
export function movePath(catalog: Catalog, from: number, to: number): Catalog {
  return { ...catalog, paths: moveItem(catalog.paths, from, to) }
}

/** Changes the unlock order of the lessons inside one path. */
export function reorderLessons(catalog: Catalog, pathId: string, from: number, to: number): Catalog {
  const path = pathById(catalog, pathId)
  return replacePath(catalog, pathId, { ...path, lessonIds: moveItem(path.lessonIds, from, to) })
}

/**
 * Puts a lesson at the end of a path, taking it out of whichever path held it;
 * `null` leaves it in no path. The lesson itself is untouched.
 */
export function assignLesson(catalog: Catalog, lessonId: string, pathId: string | null): Catalog {
  if (!catalog.lessons.some((lesson) => lesson.id === lessonId)) {
    throw new CatalogEditError(
      `"${lessonId}" is not in shared/Catalog/lessons.json, so it cannot be placed in a path.`,
    )
  }
  if (pathId !== null) pathById(catalog, pathId)

  return {
    ...catalog,
    paths: catalog.paths.map((path) => {
      const kept = path.lessonIds.filter((id) => id !== lessonId)
      const lessonIds = path.id === pathId ? [...kept, lessonId] : kept
      return lessonIds.length === path.lessonIds.length &&
        lessonIds.every((id, index) => id === path.lessonIds[index])
        ? path
        : { ...path, lessonIds }
    }),
  }
}

function requireTitle(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) throw new CatalogEditError('Give the path a title.')
  return trimmed
}

function pathById(catalog: Catalog, id: string): LearningPath {
  const path = catalog.paths.find((candidate) => candidate.id === id)
  if (!path) throw new CatalogEditError(`There is no path "${id}".`)
  return path
}

function replacePath(catalog: Catalog, id: string, next: LearningPath): Catalog {
  return { ...catalog, paths: catalog.paths.map((path) => (path.id === id ? next : path)) }
}

/**
 * Built field by field in the order `paths.json` uses, with an empty
 * description left out rather than saved as "".
 */
function record(id: string, title: string, description: string, lessonIds: string[]): LearningPath {
  const trimmed = description.trim()
  return trimmed ? { id, title, description: trimmed, lessonIds } : { id, title, lessonIds }
}
