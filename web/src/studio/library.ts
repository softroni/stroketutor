import type { Catalog } from '../catalog/types'
import { validateCatalog, type CatalogFile, type CatalogIssue } from '../catalog/validate'
import type { Sample } from '../samples'
import type { Tutorial } from '../schema/types'
import { parseTutorialJSON, type ValidationIssue } from '../schema/validate'

import type { LibrarySources, SourceFile } from './sources'

export interface TutorialEntry {
  /** File name without `.json`; always equal to `tutorial.id`. */
  id: string
  fileName: string
  tutorial: Tutorial
  /** The version on disk, which a save must name. Absent in the read-only bundle. */
  etag?: string
}

export interface BrokenTutorial {
  fileName: string
  issues: ValidationIssue[]
}

/** Everything the Studio reads from `shared/`, validated in one pass. */
export interface Library {
  tutorials: Map<string, TutorialEntry>
  /** Files in `shared/Tutorials` that failed validation. */
  broken: BrokenTutorial[]
  /** Null when the catalog files are invalid; `catalogIssues` says why. */
  catalog: Catalog | null
  catalogIssues: CatalogIssue[]
  catalogEtags: { paths?: string; lessons?: string }
  /** Every tutorial file as raw text, for Import & test. */
  samples: Sample[]
  /** True when the Studio server can save. */
  writable: boolean
  referenceUrl: (file: string) => string | undefined
}

export function buildLibrary(sources: LibrarySources): Library {
  const tutorials = new Map<string, TutorialEntry>()
  const broken: BrokenTutorial[] = []

  for (const source of sources.tutorials) {
    const id = source.fileName.replace(/\.json$/, '')
    const result = parseTutorialJSON(source.text)
    if (!result.ok) {
      broken.push({ fileName: source.fileName, issues: result.issues })
    } else if (result.tutorial.id !== id) {
      // The Studio finds and saves a tutorial by its id, so the two must agree.
      broken.push({
        fileName: source.fileName,
        issues: [
          {
            path: 'id',
            message: `Must match the file name ("${id}"). Lessons are found and saved by id.`,
            value: result.tutorial.id,
          },
        ],
      })
    } else {
      tutorials.set(id, { id, fileName: source.fileName, tutorial: result.tutorial, etag: source.etag })
    }
  }

  const references = new Map(sources.references.map((reference) => [reference.file, reference.url]))

  const paths = parseCatalogFile('paths.json', sources.paths)
  const lessons = parseCatalogFile('lessons.json', sources.lessons)
  let catalog: Catalog | null = null
  let catalogIssues: CatalogIssue[] = [...paths.issues, ...lessons.issues]

  if (catalogIssues.length === 0) {
    const result = validateCatalog(paths.data, lessons.data, {
      tutorialIds: new Set(tutorials.keys()),
      referenceFiles: new Set(references.keys()),
    })
    if (result.ok) catalog = result.catalog
    else catalogIssues = result.issues
  }

  return {
    tutorials,
    broken,
    catalog,
    catalogIssues,
    catalogEtags: { paths: sources.paths?.etag, lessons: sources.lessons?.etag },
    samples: sources.tutorials.map((source) => ({ fileName: source.fileName, source: source.text })),
    writable: sources.writable,
    referenceUrl: (file) => references.get(file),
  }
}

function parseCatalogFile(
  file: CatalogFile,
  source: SourceFile | null,
): { data: unknown; issues: CatalogIssue[] } {
  if (!source) {
    return { data: null, issues: [{ file, path: '(root)', message: `shared/Catalog/${file} is missing.` }] }
  }
  try {
    return { data: JSON.parse(source.text), issues: [] }
  } catch (error) {
    return {
      data: null,
      issues: [
        {
          file,
          path: '(root)',
          message: `This is not valid JSON. ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    }
  }
}
