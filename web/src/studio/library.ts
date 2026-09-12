import type { LessonState, PublishingState } from '../catalog/publishing'
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
  /** The version stored, which a save must name. Absent in the read-only bundle. */
  etag?: string
  /** In the workspace only, published, or published with changes not yet published. */
  state: LessonState
}

export interface BrokenTutorial {
  fileName: string
  issues: ValidationIssue[]
}

/** The working library (the workspace laid over `shared/`), validated in one pass. */
export interface Library {
  tutorials: Map<string, TutorialEntry>
  /** Lessons that failed validation. */
  broken: BrokenTutorial[]
  /** The working curriculum. Null when it is invalid; `catalogIssues` says why. */
  catalog: Catalog | null
  catalogIssues: CatalogIssue[]
  catalogEtags: { paths?: string; lessons?: string }
  /** Every tutorial file as raw text, for Import & test. */
  samples: Sample[]
  /** True when the Studio server can save. */
  writable: boolean
  /** What is published, and what publishing would change. */
  publishing: PublishingState
  referenceUrl: (file: string) => string | undefined
}

export function buildLibrary(sources: LibrarySources): Library {
  const tutorials = new Map<string, TutorialEntry>()
  const broken: BrokenTutorial[] = []
  // The read-only bundle is shared/ itself: everything in it is published.
  const publishing: PublishingState = sources.publishing ?? {
    publishedIds: sources.tutorials.map((source) => source.fileName.replace(/\.json$/, '')),
    editedIds: [],
    pending: [],
    sharedChangedOutside: false,
    trashCount: 0,
  }
  const published = new Set(publishing.publishedIds)
  const edited = new Set(publishing.editedIds)
  const stateOf = (id: string): LessonState =>
    published.has(id) ? (edited.has(id) ? 'published-edited' : 'published') : 'workspace'

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
      tutorials.set(id, {
        id,
        fileName: source.fileName,
        tutorial: result.tutorial,
        etag: source.etag,
        state: stateOf(id),
      })
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
    publishing,
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
