import lessonsSource from '@shared/Catalog/lessons.json?raw'
import pathsSource from '@shared/Catalog/paths.json?raw'

import type { Catalog } from '../catalog/types'
import { validateCatalog, type CatalogFile, type CatalogIssue } from '../catalog/validate'
import { SAMPLES } from '../samples'
import type { Tutorial } from '../schema/types'
import { parseTutorialJSON, type ValidationIssue } from '../schema/validate'

// Served by Vite as URLs. The folder may not exist yet, in which case this is empty.
const referenceUrls = import.meta.glob<string>('@shared/Assets/References/*', {
  query: '?url',
  import: 'default',
  eager: true,
})

export interface TutorialEntry {
  /** File name without `.json`; always equal to `tutorial.id`. */
  id: string
  fileName: string
  tutorial: Tutorial
}

export interface BrokenTutorial {
  fileName: string
  issues: ValidationIssue[]
}

/** Everything the Studio reads from `shared/`, validated once at start-up. */
export interface Library {
  tutorials: Map<string, TutorialEntry>
  /** Files in `shared/Tutorials` that failed validation. */
  broken: BrokenTutorial[]
  /** Null when the catalog files are invalid; `catalogIssues` says why. */
  catalog: Catalog | null
  catalogIssues: CatalogIssue[]
  referenceUrl: (file: string) => string | undefined
}

const fileNameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1)

export function loadLibrary(): Library {
  const tutorials = new Map<string, TutorialEntry>()
  const broken: BrokenTutorial[] = []

  for (const sample of SAMPLES) {
    const id = sample.fileName.replace(/\.json$/, '')
    const result = parseTutorialJSON(sample.source)
    if (!result.ok) {
      broken.push({ fileName: sample.fileName, issues: result.issues })
    } else if (result.tutorial.id !== id) {
      // The Studio finds and saves a tutorial by its id, so the two must agree.
      broken.push({
        fileName: sample.fileName,
        issues: [
          {
            path: 'id',
            message: `Must match the file name ("${id}"). Lessons are found and saved by id.`,
            value: result.tutorial.id,
          },
        ],
      })
    } else {
      tutorials.set(id, { id, fileName: sample.fileName, tutorial: result.tutorial })
    }
  }

  const references = new Map(
    Object.entries(referenceUrls).map(([path, url]) => [fileNameOf(path), url]),
  )

  const paths = parseCatalogFile('paths.json', pathsSource)
  const lessons = parseCatalogFile('lessons.json', lessonsSource)
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
    referenceUrl: (file) => references.get(file),
  }
}

function parseCatalogFile(
  file: CatalogFile,
  source: string,
): { data: unknown; issues: CatalogIssue[] } {
  try {
    return { data: JSON.parse(source), issues: [] }
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
