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

export type LessonStatus = 'planned' | 'draft' | 'needs-review' | 'approved'

/**
 * A band of the curriculum: Starter, Core, Advanced. Levels group the paths in
 * the learner's path list and recommend an order; they never lock anything, so
 * a curriculum without levels is one flat list of paths.
 */
export interface Level {
  id: string
  /** A name, not a number: "Starter", not "Level 1". */
  title: string
  description?: string
}

/** The real-world photo a lesson simplifies. */
export interface LessonReference {
  /** Bare file name inside `shared/Assets/References/`. */
  file: string
  /** Where the photo came from. */
  source: string
  /** The terms it may be used under. */
  license: string
}

/** What the generator saw in the reference photo (§22). Creator-facing only. */
export interface Analysis {
  mainForms: string[]
  importantDetails: string[]
  detailsRemoved: string[]
  drawingStrategy: string
}

/** How a lesson was first generated, kept for comparing prompts and models later. */
export interface LessonGeneration {
  model: string
  promptVersion: string
  /** ISO 8601 timestamp. */
  createdAt: string
  goal: string
  constraints?: string
  analysis: Analysis
}

export interface Lesson {
  /** Also the tutorial's id and file name: `shared/Tutorials/<id>.json`. */
  id: string
  /**
   * The lesson's name while it is planned, and only then: once a tutorial
   * exists the tutorial's title is the name, and this is dropped.
   */
  title?: string
  status: LessonStatus
  /** One line: the single new idea this lesson teaches. */
  objective: string
  /** 1 (first lesson of a path) to 5. */
  complexity?: number
  /** For the creator only; never shown to learners. */
  notes?: string
  reference?: LessonReference
  generation?: LessonGeneration
}

export interface LearningPath {
  id: string
  title: string
  description?: string
  /** The id of the level this path belongs to. A path without one is listed last. */
  level?: string
  /** Lessons in unlock order. */
  lessonIds: string[]
}

/** `shared/Catalog/paths.json` */
export interface PathsFile {
  catalogVersion: 1
  /** Easiest first. Left out entirely when the curriculum has no levels. */
  levels?: Level[]
  paths: LearningPath[]
}

/** `shared/Catalog/lessons.json` */
export interface LessonsFile {
  catalogVersion: 1
  lessons: Lesson[]
}

/** Both catalog files, validated and cross-checked against each other. */
export interface Catalog {
  /** Always an array here, `[]` when `paths.json` names no levels. */
  levels: Level[]
  paths: LearningPath[]
  lessons: Lesson[]
}

/**
 * The two files as they are written, in the field order `paths.json` and
 * `lessons.json` use. Every place that saves the curriculum goes through this,
 * so a save can never drop the levels — and a curriculum with none writes
 * exactly the file it used to, byte for byte.
 */
export function catalogFiles(catalog: Catalog): { paths: PathsFile; lessons: LessonsFile } {
  return {
    paths: {
      catalogVersion: 1,
      ...(catalog.levels.length > 0 ? { levels: catalog.levels } : {}),
      paths: catalog.paths,
    },
    lessons: { catalogVersion: 1, lessons: catalog.lessons },
  }
}

export function findLevel(catalog: Catalog, levelId: string): Level | undefined {
  return catalog.levels.find((level) => level.id === levelId)
}

/** Whether a lesson is only a placeholder: a catalog entry with no tutorial behind it yet. */
export function isPlanned(lesson: Lesson | undefined): boolean {
  return lesson?.status === 'planned'
}

export function findLesson(catalog: Catalog, lessonId: string): Lesson | undefined {
  return catalog.lessons.find((lesson) => lesson.id === lessonId)
}

/** The path a lesson belongs to. A lesson is in at most one. */
export function findPathOfLesson(catalog: Catalog, lessonId: string): LearningPath | undefined {
  return catalog.paths.find((path) => path.lessonIds.includes(lessonId))
}
