/**
 * TypeScript mirror of `shared/catalog.schema.json`.
 *
 * The catalog says where a lesson lives in the curriculum; the tutorial says how
 * it plays. They are separate files on purpose (master plan §26), so curriculum
 * edits can never disturb the playback contract the iOS player depends on.
 * `validate.ts` is the only place allowed to mint a `Catalog`.
 */

/** The only `catalogVersion` the Studio understands. */
export const SUPPORTED_CATALOG_VERSION = 1

export type LessonStatus = 'draft' | 'needs-review' | 'approved'

/** The real-world photo a lesson simplifies. */
export interface LessonReference {
  /** Bare file name inside `shared/Assets/References/`. */
  file: string
  /** Where the photo came from. */
  source: string
  /** The terms it may be used under. */
  license: string
}

export interface Lesson {
  /** Also the tutorial's id and file name: `shared/Tutorials/<id>.json`. */
  id: string
  status: LessonStatus
  /** One line: the single new idea this lesson teaches. */
  objective: string
  /** 1 (first lesson of a path) to 5. */
  complexity?: number
  /** For the creator only; never shown to learners. */
  notes?: string
  reference?: LessonReference
}

export interface LearningPath {
  id: string
  title: string
  description?: string
  /** Lessons in unlock order. */
  lessonIds: string[]
}

/** `shared/Catalog/paths.json` */
export interface PathsFile {
  catalogVersion: 1
  paths: LearningPath[]
}

/** `shared/Catalog/lessons.json` */
export interface LessonsFile {
  catalogVersion: 1
  lessons: Lesson[]
}

/** Both catalog files, validated and cross-checked against each other. */
export interface Catalog {
  paths: LearningPath[]
  lessons: Lesson[]
}

export function findLesson(catalog: Catalog, lessonId: string): Lesson | undefined {
  return catalog.lessons.find((lesson) => lesson.id === lessonId)
}

/** The path a lesson belongs to. A lesson is in at most one. */
export function findPathOfLesson(catalog: Catalog, lessonId: string): LearningPath | undefined {
  return catalog.paths.find((path) => path.lessonIds.includes(lessonId))
}
