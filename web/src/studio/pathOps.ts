import type { Catalog, LearningPath, Lesson, Level } from '../catalog/types'

import { moveItem } from './moveItem'

/**
 * Curriculum edits for the Paths view (master plan §15, §28 item 1). Each
 * returns a new catalog and leaves its input untouched; the Studio saves the
 * result through the repository writer, which validates it again.
 *
 * Path ids never change once created: lessons and, later, the iOS app refer to
 * a path by id, so only its title and description are editable. The same holds
 * for a level's id.
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
  /** The level this path sits under; `null` for none. */
  level?: string | null
}

export interface LevelFields {
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
  const title = requireTitle(fields.title, 'path')
  if (!ID_PATTERN.test(id)) {
    throw new CatalogEditError('The id must use lowercase letters, digits and single dashes.')
  }
  if (catalog.paths.some((path) => path.id === id)) {
    throw new CatalogEditError(`There is already a path with the id "${id}".`)
  }
  const level = checkLevel(catalog, fields.level ?? null)
  return { ...catalog, paths: [...catalog.paths, record(id, title, fields.description, level, [])] }
}

export function updatePath(catalog: Catalog, id: string, fields: PathFields): Catalog {
  const path = pathById(catalog, id)
  const title = requireTitle(fields.title, 'path')
  // `level` left out means "leave it as it is"; `null` takes the path out of its level.
  const level = fields.level === undefined ? (path.level ?? null) : checkLevel(catalog, fields.level)
  return replacePath(catalog, id, record(path.id, title, fields.description, level, path.lessonIds))
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

// ---------- Levels ----------

export function createLevel(catalog: Catalog, id: string, fields: LevelFields): Catalog {
  const title = requireTitle(fields.title, 'level')
  if (!ID_PATTERN.test(id)) {
    throw new CatalogEditError('The id must use lowercase letters, digits and single dashes.')
  }
  if (catalog.levels.some((level) => level.id === id)) {
    throw new CatalogEditError(`There is already a level with the id "${id}".`)
  }
  return { ...catalog, levels: [...catalog.levels, levelRecord(id, title, fields.description)] }
}

export function updateLevel(catalog: Catalog, id: string, fields: LevelFields): Catalog {
  levelById(catalog, id)
  const title = requireTitle(fields.title, 'level')
  return {
    ...catalog,
    levels: catalog.levels.map((level) =>
      level.id === id ? levelRecord(id, title, fields.description) : level,
    ),
  }
}

/** Only a level nothing sits under can go, so deleting one can never orphan a path. */
export function deleteLevel(catalog: Catalog, id: string): Catalog {
  const level = levelById(catalog, id)
  const count = catalog.paths.filter((path) => path.level === id).length
  if (count > 0) {
    throw new CatalogEditError(
      `"${level.title}" still groups ${count} ${count === 1 ? 'path' : 'paths'}. Move them to another level first.`,
    )
  }
  return { ...catalog, levels: catalog.levels.filter((candidate) => candidate.id !== id) }
}

/** Changes the order the levels are recommended in, easiest first. */
export function moveLevel(catalog: Catalog, from: number, to: number): Catalog {
  return { ...catalog, levels: moveItem(catalog.levels, from, to) }
}

// ---------- Planned lessons ----------

export interface PlannedLessonFields {
  id: string
  title: string
  objective: string
}

/**
 * Holds a place in a path for a lesson nobody has drawn yet: a catalog entry
 * with a name and an objective and nothing else. Generating a lesson with the
 * same id later fills it, keeping this place.
 */
export function planLesson(
  catalog: Catalog,
  pathId: string,
  fields: PlannedLessonFields,
  position?: number,
): Catalog {
  const path = pathById(catalog, pathId)
  if (!ID_PATTERN.test(fields.id)) {
    throw new CatalogEditError('The id must use lowercase letters, digits and single dashes.')
  }
  if (catalog.lessons.some((lesson) => lesson.id === fields.id)) {
    throw new CatalogEditError(`There is already a lesson with the id "${fields.id}".`)
  }
  const title = requireTitle(fields.title, 'lesson')
  const objective = fields.objective.trim()
  if (!objective) throw new CatalogEditError('Write the one-line objective the planned lesson teaches.')

  const lessonIds = [...path.lessonIds]
  const at = position === undefined ? lessonIds.length : Math.min(Math.max(0, position - 1), lessonIds.length)
  lessonIds.splice(at, 0, fields.id)
  return {
    ...catalog,
    paths: catalog.paths.map((candidate) => (candidate.id === pathId ? { ...candidate, lessonIds } : candidate)),
    lessons: [...catalog.lessons, plannedRecord(fields.id, title, objective)],
  }
}

// ---------- A whole curriculum from a plan file ----------

/** A lesson in a plan: a new one to place, or just an id of one that already exists. */
export type PlannedLesson = { id: string; title?: string; objective?: string }

export interface CurriculumPlan {
  levels?: { id: string; title: string; description?: string }[]
  paths: {
    id: string
    title: string
    level?: string
    description?: string
    lessons: PlannedLesson[]
  }[]
}

/** What `applyCurriculumPlan` did, so a command can say it in a sentence. */
export interface CurriculumPlanSummary {
  levelsCreated: string[]
  levelsUpdated: string[]
  pathsCreated: string[]
  pathsUpdated: string[]
  /** Placeholders that did not exist before. */
  lessonsPlanned: string[]
  /** Planned lessons whose title or objective the plan changed. */
  lessonsUpdated: string[]
  /** Lessons the plan took out of one path and put in another. */
  lessonsMoved: string[]
}

export function isEmptySummary(summary: CurriculumPlanSummary): boolean {
  return Object.values(summary).every((list) => list.length === 0)
}

/**
 * Lays a whole curriculum plan over the working catalog, and is safe to run
 * again: the second run finds everything where it put it and changes nothing.
 *
 * Levels and paths in the plan come first, in the plan's order; anything the
 * plan does not mention keeps its own order after them, because a plan
 * describes a curriculum rather than replacing one. A lesson the plan names
 * with a title and an objective is created as a placeholder when it is new,
 * updated when it is still a placeholder, and left alone when it is a real
 * lesson — a plan never touches drawn work. `tutorialIds` says which ids
 * already have a tutorial, so a new entry for one of those is catalogued as a
 * draft rather than as a placeholder.
 */
export function applyCurriculumPlan(
  catalog: Catalog,
  plan: unknown,
  tutorialIds: ReadonlySet<string> = new Set(),
): { catalog: Catalog; summary: CurriculumPlanSummary } {
  const checked = checkPlan(plan, catalog)
  const summary: CurriculumPlanSummary = {
    levelsCreated: [],
    levelsUpdated: [],
    pathsCreated: [],
    pathsUpdated: [],
    lessonsPlanned: [],
    lessonsUpdated: [],
    lessonsMoved: [],
  }

  const levels: Level[] = []
  for (const planned of checked.levels ?? []) {
    const existing = catalog.levels.find((level) => level.id === planned.id)
    const next = levelRecord(planned.id, planned.title.trim(), planned.description ?? '')
    if (!existing) summary.levelsCreated.push(planned.id)
    else if (JSON.stringify(existing) !== JSON.stringify(next)) summary.levelsUpdated.push(planned.id)
    levels.push(next)
  }
  const namedLevels = new Set(levels.map((level) => level.id))
  for (const level of catalog.levels) if (!namedLevels.has(level.id)) levels.push(level)

  const lessons = [...catalog.lessons]
  const lessonAt = (id: string) => lessons.findIndex((lesson) => lesson.id === id)
  const pathOfLesson = new Map<string, string>()
  for (const path of catalog.paths) for (const id of path.lessonIds) pathOfLesson.set(id, path.id)
  // Every lesson the plan places anywhere, so no other path may keep it.
  const claimed = new Set(checked.paths.flatMap((path) => path.lessons.map((lesson) => lesson.id)))

  const named = new Set(checked.paths.map((path) => path.id))
  const paths: LearningPath[] = []

  for (const planned of checked.paths) {
    const existing = catalog.paths.find((path) => path.id === planned.id)
    const lessonIds: string[] = []
    for (const lesson of planned.lessons) {
      const at = lessonAt(lesson.id)
      if (at < 0) {
        if (lesson.title === undefined) {
          throw new CatalogEditError(
            `The plan places "${lesson.id}" in "${planned.id}" without a title, so it must be a lesson that already exists — and there is none.`,
          )
        }
        lessons.push(
          tutorialIds.has(lesson.id)
            ? draftRecord(lesson.id, lesson.objective ?? '')
            : plannedRecord(lesson.id, lesson.title.trim(), (lesson.objective ?? '').trim()),
        )
        summary.lessonsPlanned.push(lesson.id)
      } else {
        // A real lesson is left exactly as it is; only a placeholder takes new words.
        if (lessons[at].status === 'planned' && lesson.title !== undefined) {
          const next = plannedRecord(lesson.id, lesson.title.trim(), (lesson.objective ?? '').trim())
          if (JSON.stringify(lessons[at]) !== JSON.stringify(next)) {
            lessons[at] = next
            summary.lessonsUpdated.push(lesson.id)
          }
        }
        if (pathOfLesson.get(lesson.id) !== planned.id) summary.lessonsMoved.push(lesson.id)
      }
      lessonIds.push(lesson.id)
    }
    // Lessons already filed here that the plan does not mention are not
    // dropped; they wait at the end for the creator to place them.
    for (const id of existing?.lessonIds ?? []) if (!claimed.has(id)) lessonIds.push(id)

    const next = pathRecord(planned, existing, lessonIds)
    if (!existing) summary.pathsCreated.push(planned.id)
    else if (!sameWords(existing, next)) summary.pathsUpdated.push(planned.id)
    paths.push(next)
  }

  for (const path of catalog.paths) {
    if (named.has(path.id)) continue
    const lessonIds = path.lessonIds.filter((id) => !claimed.has(id))
    paths.push(lessonIds.length === path.lessonIds.length ? path : { ...path, lessonIds })
  }

  return { catalog: { levels, paths, lessons }, summary }
}

/** A path as the plan asks for it, keeping whatever the plan does not mention. */
function pathRecord(
  planned: CurriculumPlan['paths'][number],
  existing: LearningPath | undefined,
  lessonIds: string[],
): LearningPath {
  const description = planned.description ?? existing?.description ?? ''
  const level = planned.level ?? existing?.level ?? null
  return record(planned.id, planned.title.trim(), description, level, lessonIds)
}

/** Two paths that say the same thing about themselves, whatever lessons they hold. */
function sameWords(a: LearningPath, b: LearningPath): boolean {
  return (
    a.title === b.title &&
    (a.description ?? '') === (b.description ?? '') &&
    (a.level ?? null) === (b.level ?? null) &&
    a.lessonIds.length === b.lessonIds.length &&
    a.lessonIds.every((id, index) => id === b.lessonIds[index])
  )
}

/**
 * The plan file, checked in full before anything is built, so a typo is a
 * sentence rather than half an applied curriculum.
 */
function checkPlan(plan: unknown, catalog: Catalog): CurriculumPlan {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new CatalogEditError('A curriculum plan must be a JSON object with "paths" (and optionally "levels").')
  }
  const raw = plan as Record<string, unknown>
  if (raw.levels !== undefined && !Array.isArray(raw.levels)) throw new CatalogEditError('"levels" must be an array.')
  if (!Array.isArray(raw.paths)) throw new CatalogEditError('A curriculum plan needs a "paths" array.')

  const levelIds = new Set<string>()
  const levels = (raw.levels as Record<string, unknown>[] | undefined)?.map((value, index) => {
    const where = `levels[${index}]`
    const id = planId(value, where)
    if (levelIds.has(id)) throw new CatalogEditError(`${where}: the level "${id}" is listed twice.`)
    levelIds.add(id)
    const description = planText(value, 'description', where)
    return { id, title: planTitle(value, where), ...(description !== undefined ? { description } : {}) }
  })
  for (const level of catalog.levels) levelIds.add(level.id)

  const pathIds = new Set<string>()
  const lessonIds = new Set<string>()
  const paths = (raw.paths as Record<string, unknown>[]).map((value, index) => {
    const where = `paths[${index}]`
    const id = planId(value, where)
    if (pathIds.has(id)) throw new CatalogEditError(`${where}: the path "${id}" is listed twice.`)
    pathIds.add(id)
    const level = value.level
    if (level !== undefined) {
      if (typeof level !== 'string' || !levelIds.has(level)) {
        throw new CatalogEditError(
          `${where}.level: there is no level "${String(level)}" in the plan or in the curriculum.`,
        )
      }
    }
    if (!Array.isArray(value.lessons)) throw new CatalogEditError(`${where}: "lessons" must be an array.`)
    const lessons = (value.lessons as Record<string, unknown>[]).map((lesson, lessonIndex) => {
      const at = `${where}.lessons[${lessonIndex}]`
      const lessonId = planId(lesson, at)
      if (lessonIds.has(lessonId)) throw new CatalogEditError(`${at}: the lesson "${lessonId}" is listed twice.`)
      lessonIds.add(lessonId)
      if (lesson.title === undefined) {
        if (lesson.objective !== undefined) {
          throw new CatalogEditError(`${at}: a lesson given with an objective needs a title too.`)
        }
        return { id: lessonId }
      }
      const title = planTitle(lesson, at)
      const objective = planText(lesson, 'objective', at)
      if (!objective?.trim()) throw new CatalogEditError(`${at}: give the new lesson a one-line objective.`)
      return { id: lessonId, title, objective }
    })
    const description = planText(value, 'description', where)
    return {
      id,
      title: planTitle(value, where),
      ...(typeof level === 'string' ? { level } : {}),
      ...(description !== undefined ? { description } : {}),
      lessons,
    }
  })

  return { ...(levels ? { levels } : {}), paths }
}

function planId(value: Record<string, unknown>, where: string): string {
  const id = value.id
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    throw new CatalogEditError(
      `${where}.id: "${String(id)}" is not an id. Use lowercase letters, digits and single dashes.`,
    )
  }
  return id
}

function planTitle(value: Record<string, unknown>, where: string): string {
  const title = value.title
  if (typeof title !== 'string' || !title.trim()) throw new CatalogEditError(`${where}.title: give it a title.`)
  return title
}

/** An optional text field of a plan, absent rather than empty when it is not given. */
function planText(value: Record<string, unknown>, key: string, where: string): string | undefined {
  const text = value[key]
  if (text === undefined) return undefined
  if (typeof text !== 'string') throw new CatalogEditError(`${where}.${key} must be text.`)
  return text
}

function requireTitle(title: string, what: 'path' | 'level' | 'lesson'): string {
  const trimmed = title.trim()
  if (!trimmed) throw new CatalogEditError(`Give the ${what} a title.`)
  return trimmed
}

function pathById(catalog: Catalog, id: string): LearningPath {
  const path = catalog.paths.find((candidate) => candidate.id === id)
  if (!path) throw new CatalogEditError(`There is no path "${id}".`)
  return path
}

function levelById(catalog: Catalog, id: string): Level {
  const level = catalog.levels.find((candidate) => candidate.id === id)
  if (!level) throw new CatalogEditError(`There is no level "${id}".`)
  return level
}

/** A level id that exists, or null. */
function checkLevel(catalog: Catalog, level: string | null): string | null {
  if (level === null || level === '') return null
  levelById(catalog, level)
  return level
}

function replacePath(catalog: Catalog, id: string, next: LearningPath): Catalog {
  return { ...catalog, paths: catalog.paths.map((path) => (path.id === id ? next : path)) }
}

/**
 * Built field by field in the order `paths.json` uses, with an empty
 * description or no level left out rather than saved as "".
 */
function record(
  id: string,
  title: string,
  description: string,
  level: string | null,
  lessonIds: string[],
): LearningPath {
  const trimmed = description.trim()
  return {
    id,
    title,
    ...(trimmed ? { description: trimmed } : {}),
    ...(level ? { level } : {}),
    lessonIds,
  }
}

function levelRecord(id: string, title: string, description: string): Level {
  const trimmed = description.trim()
  return trimmed ? { id, title, description: trimmed } : { id, title }
}

/** A placeholder, in the field order `lessons.json` uses. */
function plannedRecord(id: string, title: string, objective: string): Lesson {
  return { id, title, status: 'planned', objective }
}

function draftRecord(id: string, objective: string): Lesson {
  return { id, status: 'draft', objective: objective.trim() }
}
