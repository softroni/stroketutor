import type { Stored } from '../server/repoWriter'
import { findLesson, type Catalog, type LearningPath, type Lesson, type LessonsFile, type PathsFile } from '../src/catalog/types'
import { parseTutorialJSON } from '../src/schema/validate'
import type { Tutorial } from '../src/schema/types'
import { toEditable, toTutorial, type EditableTutorial } from '../src/studio/editor/ops'

import type { Context } from './context'
import { CliError } from './output'

/**
 * Read-modify-write, the way the Studio does it: read the version with its
 * etag, change it with the same pure operations the editor uses, validate,
 * and write naming the version replaced. A save that lands on a version
 * changed meanwhile (the dev server, say) is refused by the workspace with a
 * 409, which the command reports as "run it again".
 */

export async function readLesson(ctx: Context, id: string): Promise<{ stored: Stored; tutorial: Tutorial }> {
  const store = await ctx.workspace()
  const stored = await store.readTutorial(id)
  if (!stored) throw new CliError(`There is no lesson "${id}".`)
  const parsed = parseTutorialJSON(stored.text)
  if (!parsed.ok) {
    throw new CliError(`The lesson "${id}" has validation problems; fix its JSON first (studio lessons export ${id}).`, parsed.issues)
  }
  return { stored, tutorial: parsed.tutorial }
}

export interface EditOutcome {
  before: Tutorial
  after: Tutorial
  etag: string
  changed: boolean
}

/** One edit of a lesson's tutorial, saved in the workspace like an editor save (a checkpoint by default). */
export async function editTutorial(
  ctx: Context,
  id: string,
  change: (doc: EditableTutorial) => EditableTutorial,
  { checkpoint = true } = {},
): Promise<EditOutcome> {
  const { stored, tutorial } = await readLesson(ctx, id)
  const after = toTutorial(change(toEditable(tutorial)))
  const verdict = ctx.validateTutorial(after)
  if (!verdict.ok) throw new CliError('The edit would leave the lesson invalid, so it was not saved.', verdict.issues)
  const store = await ctx.workspace()
  const result = await store.writeTutorial(id, after, { etag: stored.etag }, { checkpoint })
  return { before: tutorial, after, etag: result.etag, changed: result.etag !== stored.etag }
}

/**
 * Saves a tutorial built outside the editor (a plan applied to the lesson)
 * over the version read, validated first, like an editor save.
 */
export async function saveTutorial(ctx: Context, id: string, next: Tutorial, { checkpoint = true } = {}): Promise<EditOutcome> {
  const { stored, tutorial } = await readLesson(ctx, id)
  const verdict = ctx.validateTutorial(next)
  if (!verdict.ok) throw new CliError('The change would leave the lesson invalid, so it was not saved.', verdict.issues)
  const store = await ctx.workspace()
  const result = await store.writeTutorial(id, next, { etag: stored.etag }, { checkpoint })
  return { before: tutorial, after: next, etag: result.etag, changed: result.etag !== stored.etag }
}

/** Replaces the whole tutorial, for imports and for bringing back a version from History. */
export async function replaceTutorial(
  ctx: Context,
  id: string,
  tutorial: Tutorial,
  { checkpoint = true, create = false } = {},
): Promise<{ etag: string; created: boolean }> {
  const store = await ctx.workspace()
  const current = await store.readTutorial(id)
  if (create && current) throw new CliError(`A lesson called "${id}" already exists; choose another id.`)
  if (!create && !current) throw new CliError(`There is no lesson "${id}".`)
  return store.writeTutorial(id, tutorial, { etag: current?.etag ?? null }, { checkpoint })
}

export async function readCatalog(ctx: Context): Promise<{ catalog: Catalog; etags: { paths: string; lessons: string } }> {
  const store = await ctx.workspace()
  const current = await store.readCatalog()
  let paths: PathsFile
  let lessons: LessonsFile
  try {
    paths = JSON.parse(current.paths.text) as PathsFile
    lessons = JSON.parse(current.lessons.text) as LessonsFile
  } catch (error) {
    throw new CliError(`The working curriculum could not be read: ${String(error)}`)
  }
  return {
    catalog: { paths: paths.paths ?? [], lessons: lessons.lessons ?? [] },
    etags: { paths: current.paths.etag, lessons: current.lessons.etag },
  }
}

/** One change of the working curriculum, validated and saved over the version read. */
export async function editCatalog(ctx: Context, change: (catalog: Catalog) => Catalog): Promise<Catalog> {
  const { catalog, etags } = await readCatalog(ctx)
  const next = change(catalog)
  const store = await ctx.workspace()
  await store.writeCatalog(
    { catalogVersion: 1, paths: next.paths } satisfies PathsFile,
    { catalogVersion: 1, lessons: next.lessons } satisfies LessonsFile,
    { paths: { etag: etags.paths }, lessons: { etag: etags.lessons } },
  )
  return next
}

export function requireLesson(catalog: Catalog, id: string): Lesson {
  const lesson = findLesson(catalog, id)
  if (!lesson) throw new CliError(`"${id}" is not in the curriculum. Catalogue it first (studio lessons import, or studio lessons set).`)
  return lesson
}

export function requirePath(catalog: Catalog, id: string): LearningPath {
  const path = catalog.paths.find((candidate) => candidate.id === id)
  if (!path) throw new CliError(`There is no path "${id}".`)
  return path
}

/** Replaces one lesson's catalog entry. */
export function patchLesson(catalog: Catalog, id: string, change: (lesson: Lesson) => Lesson): Catalog {
  requireLesson(catalog, id)
  return { ...catalog, lessons: catalog.lessons.map((lesson) => (lesson.id === id ? change(lesson) : lesson)) }
}

/**
 * Puts a lesson into a path at a 1-based position (the end when omitted),
 * taking it out of whichever path held it.
 */
export function placeInPath(catalog: Catalog, lessonId: string, pathId: string, position?: number): Catalog {
  requirePath(catalog, pathId)
  return {
    ...catalog,
    paths: catalog.paths.map((path) => {
      const kept = path.lessonIds.filter((id) => id !== lessonId)
      if (path.id !== pathId) return kept.length === path.lessonIds.length ? path : { ...path, lessonIds: kept }
      const at = position === undefined ? kept.length : Math.min(Math.max(0, position - 1), kept.length)
      kept.splice(at, 0, lessonId)
      return { ...path, lessonIds: kept }
    }),
  }
}

/** A catalog entry built in the order `lessons.json` lists fields, with empty optionals left out. */
export function lessonRecord(fields: Lesson): Lesson {
  const { id, status, objective, complexity, notes, reference, generation } = fields
  return {
    id,
    status,
    objective,
    ...(complexity !== undefined ? { complexity } : {}),
    ...(notes ? { notes } : {}),
    ...(reference ? { reference } : {}),
    ...(generation ? { generation } : {}),
  }
}
