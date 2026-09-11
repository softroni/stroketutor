import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv'

import schema from '@shared/catalog.schema.json'

import { toAuthorPath, valueAt } from '../schema/validate'

import { SUPPORTED_CATALOG_VERSION, type Catalog, type LessonsFile, type PathsFile } from './types'

export type CatalogFile = 'paths.json' | 'lessons.json'

/** One thing wrong with the catalog, addressed by file and JSON path. */
export interface CatalogIssue {
  file: CatalogFile
  path: string
  message: string
  value?: unknown
}

export type CatalogResult = { ok: true; catalog: Catalog } | { ok: false; issues: CatalogIssue[] }

/** What the catalog is checked against beyond its own two files. */
export interface CatalogContext {
  /** Ids of the valid tutorials in `shared/Tutorials`. Every lesson must be one. */
  tutorialIds: ReadonlySet<string>
  /** File names in `shared/Assets/References`. Omit to skip the existence check. */
  referenceFiles?: ReadonlySet<string>
}

const ajv = new Ajv({ allErrors: true, strict: false })
ajv.addSchema(schema)
const validators = new Map<CatalogFile, ValidateFunction>()

function validatorFor(file: CatalogFile): ValidateFunction {
  let validate = validators.get(file)
  if (!validate) {
    const definition = file === 'paths.json' ? 'pathsFile' : 'lessonsFile'
    validate = ajv.compile({ $ref: `${schema.$id}#/definitions/${definition}` })
    validators.set(file, validate)
  }
  return validate
}

/**
 * Validates both catalog files against the schema, then against each other and
 * the tutorials on disk.
 *
 * Strict in the same spirit as tutorial validation: an unknown property is a
 * likely typo, and a lesson pointing at a tutorial that does not exist would
 * strand a learner on a locked path, so both are errors rather than warnings.
 */
export function validateCatalog(
  paths: unknown,
  lessons: unknown,
  context: CatalogContext,
): CatalogResult {
  const schemaIssues = [...checkFile('paths.json', paths), ...checkFile('lessons.json', lessons)]
  if (schemaIssues.length > 0) return { ok: false, issues: schemaIssues }

  const pathsFile = paths as PathsFile
  const lessonsFile = lessons as LessonsFile
  const crossIssues = crossCheck(pathsFile, lessonsFile, context)
  if (crossIssues.length > 0) return { ok: false, issues: crossIssues }

  return { ok: true, catalog: { paths: pathsFile.paths, lessons: lessonsFile.lessons } }
}

function checkFile(file: CatalogFile, data: unknown): CatalogIssue[] {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return [{ file, path: '(root)', message: `${file} must be a JSON object.`, value: data }]
  }

  const version = (data as Record<string, unknown>).catalogVersion
  if (version !== undefined && version !== SUPPORTED_CATALOG_VERSION) {
    return [
      {
        file,
        path: 'catalogVersion',
        message: `Unsupported catalogVersion ${JSON.stringify(
          version,
        )}. The Studio only understands catalogVersion ${SUPPORTED_CATALOG_VERSION}.`,
        value: version,
      },
    ]
  }

  const validate = validatorFor(file)
  if (validate(data)) return []
  return dedupe((validate.errors ?? []).map((error) => describe(file, error, data)))
}

function describe(file: CatalogFile, error: ErrorObject, root: unknown): CatalogIssue {
  const params = error.params as Record<string, unknown>

  if (error.keyword === 'required') {
    const missing = String(params.missingProperty)
    return {
      file,
      path: toAuthorPath(error.instancePath, missing),
      message: `Required property "${missing}" is missing.`,
    }
  }

  if (error.keyword === 'additionalProperties') {
    const extra = String(params.additionalProperty)
    return {
      file,
      path: toAuthorPath(error.instancePath, extra),
      message: `Unknown property "${extra}". It is not part of catalogVersion ${SUPPORTED_CATALOG_VERSION}.`,
      value: valueAt(root, `${error.instancePath}/${extra}`),
    }
  }

  const path = toAuthorPath(error.instancePath)
  const value = valueAt(root, error.instancePath)

  switch (error.keyword) {
    case 'type':
      return { file, path, message: `Must be ${String(params.type)}.`, value }
    case 'const':
      return { file, path, message: `Must be ${JSON.stringify(params.allowedValue)}.`, value }
    case 'enum':
      return {
        file,
        path,
        message: `Must be one of ${(params.allowedValues as unknown[])
          .map((allowed) => JSON.stringify(allowed))
          .join(', ')}.`,
        value,
      }
    case 'minLength':
      return { file, path, message: 'Must not be empty.', value }
    case 'minimum':
      return { file, path, message: `Must be at least ${String(params.limit)}.`, value }
    case 'maximum':
      return { file, path, message: `Must be at most ${String(params.limit)}.`, value }
    case 'pattern':
      return {
        file,
        path,
        message: path.endsWith('.file')
          ? 'Must be a plain file name such as "house-cottage-01.jpg": lowercase letters, digits and dashes, ending in .jpg, .jpeg, .png, .webp or .svg.'
          : 'Must be a lowercase id such as "simple-house": letters, digits and single dashes.',
        value,
      }
    default:
      return { file, path, message: error.message ?? 'Is not valid.', value }
  }
}

/** The rules a schema cannot express: uniqueness and references between files. */
function crossCheck(paths: PathsFile, lessons: LessonsFile, context: CatalogContext): CatalogIssue[] {
  const issues: CatalogIssue[] = []

  const lessonIds = new Set<string>()
  lessons.lessons.forEach((lesson, index) => {
    const at = `lessons[${index}]`
    if (lessonIds.has(lesson.id)) {
      issues.push({
        file: 'lessons.json',
        path: `${at}.id`,
        message: `Lesson id "${lesson.id}" is listed more than once.`,
        value: lesson.id,
      })
    }
    lessonIds.add(lesson.id)

    if (!context.tutorialIds.has(lesson.id)) {
      issues.push({
        file: 'lessons.json',
        path: `${at}.id`,
        message: `No valid tutorial at shared/Tutorials/${lesson.id}.json.`,
        value: lesson.id,
      })
    }

    const reference = lesson.reference
    if (reference && context.referenceFiles && !context.referenceFiles.has(reference.file)) {
      issues.push({
        file: 'lessons.json',
        path: `${at}.reference.file`,
        message: `No photo at shared/Assets/References/${reference.file}.`,
        value: reference.file,
      })
    }
  })

  const pathIds = new Set<string>()
  const owner = new Map<string, string>()
  paths.paths.forEach((path, pathIndex) => {
    if (pathIds.has(path.id)) {
      issues.push({
        file: 'paths.json',
        path: `paths[${pathIndex}].id`,
        message: `Path id "${path.id}" is listed more than once.`,
        value: path.id,
      })
    }
    pathIds.add(path.id)

    path.lessonIds.forEach((lessonId, lessonIndex) => {
      const at = `paths[${pathIndex}].lessonIds[${lessonIndex}]`
      if (!lessonIds.has(lessonId)) {
        issues.push({
          file: 'paths.json',
          path: at,
          message: `No lesson "${lessonId}" in lessons.json.`,
          value: lessonId,
        })
      }
      const previous = owner.get(lessonId)
      if (previous === undefined) {
        owner.set(lessonId, path.id)
      } else {
        issues.push({
          file: 'paths.json',
          path: at,
          message:
            previous === path.id
              ? `Lesson "${lessonId}" appears twice in this path.`
              : `Lesson "${lessonId}" is already in path "${previous}". A lesson belongs to one path.`,
          value: lessonId,
        })
      }
    })
  })

  return issues
}

function dedupe(issues: CatalogIssue[]): CatalogIssue[] {
  const seen = new Set<string>()
  return issues.filter((issue) => {
    const key = `${issue.file}::${issue.path}::${issue.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
