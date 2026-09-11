import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { validateCatalog, type CatalogContext, type CatalogResult } from './validate'

const sharedDir = fileURLToPath(new URL('../../../shared/', import.meta.url))
const readCatalog = (name: string): unknown =>
  JSON.parse(readFileSync(`${sharedDir}Catalog/${name}`, 'utf8'))

const pathsFile = (...paths: unknown[]) => ({ catalogVersion: 1, paths })
const lessonsFile = (...lessons: unknown[]) => ({ catalogVersion: 1, lessons })
const lesson = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  status: 'draft',
  objective: 'Practise one idea.',
  ...extra,
})
const path = (id: string, lessonIds: string[]) => ({ id, title: id, lessonIds })

const context: CatalogContext = { tutorialIds: new Set(['a', 'b', 'c']) }

/** `file path` for every issue, so a failing assertion shows what was found. */
const locations = (result: CatalogResult) =>
  result.ok ? [] : result.issues.map((issue) => `${issue.file} ${issue.path}`)

describe('shipped catalog', () => {
  it('validates against the schema and the tutorials on disk', () => {
    const tutorialIds = new Set(
      readdirSync(`${sharedDir}Tutorials`)
        .filter((name) => name.endsWith('.json'))
        .map((name) => name.replace(/\.json$/, '')),
    )
    const result = validateCatalog(readCatalog('paths.json'), readCatalog('lessons.json'), {
      tutorialIds,
    })
    expect(locations(result)).toEqual([])
  })
})

describe('validateCatalog', () => {
  it('accepts a path whose lessons all exist', () => {
    const result = validateCatalog(
      pathsFile(path('houses', ['a', 'b'])),
      lessonsFile(lesson('a'), lesson('b', { complexity: 2 })),
      context,
    )
    expect(result.ok).toBe(true)
  })

  it('rejects a path lesson that is not in lessons.json', () => {
    const result = validateCatalog(
      pathsFile(path('houses', ['a', 'z'])),
      lessonsFile(lesson('a')),
      context,
    )
    expect(locations(result)).toEqual(['paths.json paths[0].lessonIds[1]'])
  })

  it('rejects duplicate path ids', () => {
    const result = validateCatalog(
      pathsFile(path('houses', []), path('houses', [])),
      lessonsFile(),
      context,
    )
    expect(locations(result)).toEqual(['paths.json paths[1].id'])
  })

  it('rejects duplicate lesson ids', () => {
    const result = validateCatalog(pathsFile(), lessonsFile(lesson('a'), lesson('a')), context)
    expect(locations(result)).toEqual(['lessons.json lessons[1].id'])
  })

  it('rejects a lesson listed in two paths', () => {
    const result = validateCatalog(
      pathsFile(path('houses', ['a']), path('trees', ['a'])),
      lessonsFile(lesson('a')),
      context,
    )
    expect(locations(result)).toEqual(['paths.json paths[1].lessonIds[0]'])
  })

  it('rejects a lesson with no tutorial behind it', () => {
    const result = validateCatalog(pathsFile(), lessonsFile(lesson('missing')), context)
    expect(locations(result)).toEqual(['lessons.json lessons[0].id'])
  })

  it('rejects unknown properties as likely typos', () => {
    const result = validateCatalog(
      pathsFile(),
      lessonsFile(lesson('a', { staus: 'approved' })),
      context,
    )
    expect(locations(result)).toEqual(['lessons.json lessons[0].staus'])
  })

  it('rejects an unknown status', () => {
    const result = validateCatalog(
      pathsFile(),
      lessonsFile(lesson('a', { status: 'published' })),
      context,
    )
    expect(locations(result)).toEqual(['lessons.json lessons[0].status'])
  })

  it('rejects ids that are not lowercase slugs', () => {
    const result = validateCatalog(pathsFile(path('Houses', [])), lessonsFile(), context)
    expect(locations(result)).toEqual(['paths.json paths[0].id'])
  })

  it('rejects reference file names that could leave the references folder', () => {
    const result = validateCatalog(
      pathsFile(),
      lessonsFile(
        lesson('a', { reference: { file: '../secret.jpg', source: 'mine', license: 'CC0' } }),
      ),
      context,
    )
    expect(locations(result)).toEqual(['lessons.json lessons[0].reference.file'])
  })

  it('rejects a reference photo that is not on disk, when the folder is known', () => {
    const result = validateCatalog(
      pathsFile(),
      lessonsFile(
        lesson('a', { reference: { file: 'cottage.jpg', source: 'mine', license: 'CC0' } }),
      ),
      { ...context, referenceFiles: new Set(['other.jpg']) },
    )
    expect(locations(result)).toEqual(['lessons.json lessons[0].reference.file'])
  })

  it('accepts a generation record and rejects a malformed one', () => {
    const generation = {
      model: 'vendor/model',
      promptVersion: 'lesson-v1',
      createdAt: '2026-09-11T05:00:00Z',
      goal: 'Introduce a side wall.',
      analysis: { mainForms: ['box'], importantDetails: [], detailsRemoved: ['trees'], drawingStrategy: 'Wall first.' },
    }
    expect(validateCatalog(pathsFile(), lessonsFile(lesson('a', { generation })), context).ok).toBe(true)

    const broken = { ...generation, analysis: { ...generation.analysis, mood: 'calm' } }
    expect(locations(validateCatalog(pathsFile(), lessonsFile(lesson('a', { generation: broken })), context))).toEqual([
      'lessons.json lessons[0].generation.analysis.mood',
    ])
  })

  it('rejects an unsupported catalogVersion by name', () => {
    const result = validateCatalog({ catalogVersion: 2, paths: [] }, lessonsFile(), context)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].message).toContain('Unsupported catalogVersion 2')
  })
})
