import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { catalogFiles, type Catalog } from '../catalog/types'
import { validateCatalog } from '../catalog/validate'

import {
  CatalogEditError,
  applyCurriculumPlan,
  assignLesson,
  createLevel,
  createPath,
  deleteLevel,
  deletePath,
  isEmptySummary,
  moveLevel,
  movePath,
  planLesson,
  reorderLessons,
  slugify,
  updateLevel,
  updatePath,
} from './pathOps'

const catalog = (): Catalog => ({
  levels: [],
  paths: [
    { id: 'houses', title: 'Houses', description: 'Front-facing first.', lessonIds: ['a', 'b'] },
    { id: 'trees', title: 'Trees', lessonIds: ['c'] },
  ],
  lessons: ['a', 'b', 'c', 'd'].map((id) => ({ id, status: 'draft' as const, objective: 'One idea.' })),
})

/** The result must still pass the catalog's own strict validation. */
function expectValid(result: Catalog, tutorialIds = new Set(['a', 'b', 'c', 'd'])) {
  const files = catalogFiles(result)
  const verdict = validateCatalog(files.paths, files.lessons, { tutorialIds })
  expect(verdict.ok, verdict.ok ? '' : JSON.stringify(verdict.issues)).toBe(true)
}

/** A curriculum with levels, for the operations that need some. */
const levelled = (): Catalog => ({
  ...catalog(),
  levels: [
    { id: 'starter', title: 'Starter', description: 'Flat shapes.' },
    { id: 'core', title: 'Core' },
  ],
  paths: [
    { id: 'houses', title: 'Houses', level: 'starter', lessonIds: ['a', 'b'] },
    { id: 'trees', title: 'Trees', lessonIds: ['c'] },
  ],
})

const ids = (result: Catalog) => result.paths.map((path) => path.id)
const lessonsOf = (result: Catalog, pathId: string) =>
  result.paths.find((path) => path.id === pathId)?.lessonIds

describe('createPath', () => {
  it('adds an empty path at the end, in paths.json field order', () => {
    const result = createPath(catalog(), 'streets', { title: ' Streets ', description: ' Corners. ' })
    expect(ids(result)).toEqual(['houses', 'trees', 'streets'])
    expect(result.paths[2]).toEqual({ id: 'streets', title: 'Streets', description: 'Corners.', lessonIds: [] })
    expect(Object.keys(result.paths[2])).toEqual(['id', 'title', 'description', 'lessonIds'])
    expectValid(result)
  })

  it('leaves out an empty description', () => {
    expect(createPath(catalog(), 'streets', { title: 'Streets', description: '  ' }).paths[2]).toEqual({
      id: 'streets',
      title: 'Streets',
      lessonIds: [],
    })
  })

  it('refuses a taken or malformed id and a blank title', () => {
    expect(() => createPath(catalog(), 'houses', { title: 'Again', description: '' })).toThrow(CatalogEditError)
    expect(() => createPath(catalog(), 'Big Trees', { title: 'Trees', description: '' })).toThrow(CatalogEditError)
    expect(() => createPath(catalog(), 'streets', { title: ' ', description: '' })).toThrow(CatalogEditError)
  })
})

describe('updatePath', () => {
  it('changes the words and keeps the id and lessons', () => {
    const result = updatePath(catalog(), 'houses', { title: 'Houses & Cottages', description: '' })
    expect(result.paths[0]).toEqual({ id: 'houses', title: 'Houses & Cottages', lessonIds: ['a', 'b'] })
    expectValid(result)
  })

  it('refuses a blank title and an unknown path', () => {
    expect(() => updatePath(catalog(), 'houses', { title: '', description: '' })).toThrow(CatalogEditError)
    expect(() => updatePath(catalog(), 'boats', { title: 'Boats', description: '' })).toThrow(CatalogEditError)
  })
})

describe('deletePath', () => {
  it('removes an empty path', () => {
    const emptied = assignLesson(catalog(), 'c', null)
    expect(ids(deletePath(emptied, 'trees'))).toEqual(['houses'])
  })

  it('refuses a path that still has lessons', () => {
    expect(() => deletePath(catalog(), 'trees')).toThrow(/still has 1 lesson/)
  })
})

describe('ordering', () => {
  it('moves paths and lessons', () => {
    expect(ids(movePath(catalog(), 1, 0))).toEqual(['trees', 'houses'])
    expect(lessonsOf(reorderLessons(catalog(), 'houses', 1, 0), 'houses')).toEqual(['b', 'a'])
  })
})

describe('assignLesson', () => {
  it('moves a lesson to the end of another path', () => {
    const result = assignLesson(catalog(), 'a', 'trees')
    expect(lessonsOf(result, 'houses')).toEqual(['b'])
    expect(lessonsOf(result, 'trees')).toEqual(['c', 'a'])
    expectValid(result)
  })

  it('takes a lesson out of every path, and puts a path-less one in', () => {
    const out = assignLesson(catalog(), 'b', null)
    expect(lessonsOf(out, 'houses')).toEqual(['a'])
    const placed = assignLesson(out, 'd', 'houses')
    expect(lessonsOf(placed, 'houses')).toEqual(['a', 'd'])
    expectValid(placed)
  })

  it('refuses lessons and paths that do not exist', () => {
    expect(() => assignLesson(catalog(), 'cat-face', 'houses')).toThrow(/not in shared\/Catalog/)
    expect(() => assignLesson(catalog(), 'a', 'boats')).toThrow(CatalogEditError)
  })

  it('leaves untouched paths as the same objects, and never mutates its input', () => {
    const before = catalog()
    const snapshot = JSON.stringify(before)
    const result = assignLesson(before, 'a', 'houses')
    expect(result.paths[1]).toBe(before.paths[1])
    expect(JSON.stringify(before)).toBe(snapshot)
  })
})

describe('slugify', () => {
  it('turns a title into an id', () => {
    expect(slugify('Streets & Places')).toBe('streets-places')
    expect(slugify('  Café Fronts ')).toBe('cafe-fronts')
  })
})

describe('levels', () => {
  it('creates a level at the end, in paths.json field order', () => {
    const result = createLevel(catalog(), 'starter', { title: ' Starter ', description: ' Flat shapes. ' })
    expect(result.levels).toEqual([{ id: 'starter', title: 'Starter', description: 'Flat shapes.' }])
    expect(Object.keys(result.levels[0])).toEqual(['id', 'title', 'description'])
    expectValid(result)
  })

  it('leaves out an empty description, and refuses a taken or malformed id and a blank title', () => {
    expect(createLevel(catalog(), 'core', { title: 'Core', description: ' ' }).levels[0]).toEqual({
      id: 'core',
      title: 'Core',
    })
    expect(() => createLevel(levelled(), 'core', { title: 'Again', description: '' })).toThrow(CatalogEditError)
    expect(() => createLevel(catalog(), 'Big Level', { title: 'Big', description: '' })).toThrow(CatalogEditError)
    expect(() => createLevel(catalog(), 'core', { title: ' ', description: '' })).toThrow(/Give the level a title/)
  })

  it('renames and describes a level, keeping its id and its place', () => {
    const result = updateLevel(levelled(), 'starter', { title: 'First Steps', description: '' })
    expect(result.levels[0]).toEqual({ id: 'starter', title: 'First Steps' })
    expect(result.levels.map((level) => level.id)).toEqual(['starter', 'core'])
    expectValid(result)
  })

  it('moves a level, and refuses to delete one that still groups paths', () => {
    expect(moveLevel(levelled(), 1, 0).levels.map((level) => level.id)).toEqual(['core', 'starter'])
    expect(() => deleteLevel(levelled(), 'starter')).toThrow(/still groups 1 path/)
    expect(deleteLevel(levelled(), 'core').levels.map((level) => level.id)).toEqual(['starter'])
    expect(() => deleteLevel(levelled(), 'nope')).toThrow(/no level/)
  })

  it('puts a path in a level and takes it out again, and refuses a level that is not there', () => {
    const inCore = updatePath(levelled(), 'trees', { title: 'Trees', description: '', level: 'core' })
    expect(inCore.paths[1]).toEqual({ id: 'trees', title: 'Trees', level: 'core', lessonIds: ['c'] })
    expect(Object.keys(inCore.paths[1])).toEqual(['id', 'title', 'level', 'lessonIds'])
    const out = updatePath(inCore, 'trees', { title: 'Trees', description: '', level: null })
    expect(out.paths[1].level).toBeUndefined()
    // Leaving `level` out of the fields keeps the one the path has.
    expect(updatePath(inCore, 'trees', { title: 'Tall Trees', description: '' }).paths[1].level).toBe('core')
    expect(() => createPath(catalog(), 'boats', { title: 'Boats', description: '', level: 'core' })).toThrow(
      CatalogEditError,
    )
    expectValid(out)
  })
})

describe('planLesson', () => {
  it('holds a place in a path, in lessons.json field order', () => {
    const result = planLesson(catalog(), 'houses', { id: 'sun', title: ' Sun ', objective: ' Circle and rays ' }, 2)
    expect(result.paths[0].lessonIds).toEqual(['a', 'sun', 'b'])
    const planned = result.lessons[result.lessons.length - 1]
    expect(planned).toEqual({ id: 'sun', title: 'Sun', status: 'planned', objective: 'Circle and rays' })
    expect(Object.keys(planned)).toEqual(['id', 'title', 'status', 'objective'])
    // A planned lesson has no tutorial, and the catalog is still valid without one.
    expectValid(result)
  })

  it('appends without a position, and refuses a taken id, a bad id, no title and no objective', () => {
    expect(planLesson(catalog(), 'trees', { id: 'sun', title: 'Sun', objective: 'Rays' }).paths[1].lessonIds).toEqual([
      'c',
      'sun',
    ])
    expect(() => planLesson(catalog(), 'trees', { id: 'a', title: 'A', objective: 'Again' })).toThrow(/already a lesson/)
    expect(() => planLesson(catalog(), 'trees', { id: 'Sun', title: 'Sun', objective: 'Rays' })).toThrow(CatalogEditError)
    expect(() => planLesson(catalog(), 'trees', { id: 'sun', title: ' ', objective: 'Rays' })).toThrow(/title/)
    expect(() => planLesson(catalog(), 'trees', { id: 'sun', title: 'Sun', objective: ' ' })).toThrow(/objective/)
    expect(() => planLesson(catalog(), 'boats', { id: 'sun', title: 'Sun', objective: 'Rays' })).toThrow(/no path/)
  })
})

describe('applyCurriculumPlan', () => {
  const plan = {
    levels: [
      { id: 'starter', title: 'Starter', description: 'Flat shapes.' },
      { id: 'core', title: 'Core' },
    ],
    paths: [
      {
        id: 'sky',
        title: 'Sky',
        level: 'starter',
        description: 'Sun first.',
        lessons: [
          { id: 'sun', title: 'Sun', objective: 'Circle and rays' },
          { id: 'cloud', title: 'Cloud', objective: 'Four bumps' },
        ],
      },
      { id: 'houses', title: 'Homes', level: 'core', lessons: [{ id: 'b' }, { id: 'a' }] },
    ],
  }

  it('creates levels and paths, plans the new lessons and places the existing ones', () => {
    const { catalog: result, summary } = applyCurriculumPlan(catalog(), plan, new Set(['a', 'b', 'c', 'd']))
    expect(result.levels.map((level) => level.id)).toEqual(['starter', 'core'])
    expect(result.paths.map((path) => path.id)).toEqual(['sky', 'houses', 'trees'])
    expect(result.paths[0]).toEqual({
      id: 'sky',
      title: 'Sky',
      description: 'Sun first.',
      level: 'starter',
      lessonIds: ['sun', 'cloud'],
    })
    // The plan reorders the lessons it names and renames the path it found,
    // keeping the description it says nothing about.
    expect(result.paths[1]).toEqual({
      id: 'houses',
      title: 'Homes',
      description: 'Front-facing first.',
      level: 'core',
      lessonIds: ['b', 'a'],
    })
    expect(result.lessons.filter((lesson) => lesson.status === 'planned').map((lesson) => lesson.id)).toEqual([
      'sun',
      'cloud',
    ])
    expect(summary.levelsCreated).toEqual(['starter', 'core'])
    expect(summary.pathsCreated).toEqual(['sky'])
    expect(summary.pathsUpdated).toEqual(['houses'])
    expect(summary.lessonsPlanned).toEqual(['sun', 'cloud'])
    expectValid(result)
  })

  it('changes nothing the second time', () => {
    const once = applyCurriculumPlan(catalog(), plan, new Set(['a', 'b', 'c', 'd'])).catalog
    const twice = applyCurriculumPlan(once, plan, new Set(['a', 'b', 'c', 'd']))
    expect(twice.catalog).toEqual(once)
    expect(isEmptySummary(twice.summary)).toBe(true)
  })

  it('takes a lesson out of the path it was in, and leaves one the plan does not name at the end', () => {
    const moved = {
      levels: plan.levels,
      paths: [{ id: 'trees', title: 'Trees', lessons: [{ id: 'a' }] }],
    }
    const { catalog: result, summary } = applyCurriculumPlan(catalog(), moved, new Set(['a', 'b', 'c', 'd']))
    expect(result.paths.map((path) => [path.id, path.lessonIds])).toEqual([
      ['trees', ['a', 'c']],
      ['houses', ['b']],
    ])
    expect(summary.lessonsMoved).toEqual(['a'])
    expectValid(result)
  })

  it('rewords a planned lesson but never touches a real one', () => {
    const planned = planLesson(catalog(), 'houses', { id: 'sun', title: 'Sun', objective: 'Old words' })
    const reworded = {
      paths: [
        {
          id: 'houses',
          title: 'Houses',
          lessons: [
            { id: 'sun', title: 'The Sun', objective: 'New words' },
            { id: 'a', title: 'Ignored', objective: 'Ignored too' },
          ],
        },
      ],
    }
    const { catalog: result, summary } = applyCurriculumPlan(planned, reworded, new Set(['a', 'b', 'c', 'd']))
    expect(result.lessons.find((lesson) => lesson.id === 'sun')).toEqual({
      id: 'sun',
      title: 'The Sun',
      status: 'planned',
      objective: 'New words',
    })
    expect(result.lessons.find((lesson) => lesson.id === 'a')).toEqual({ id: 'a', status: 'draft', objective: 'One idea.' })
    expect(summary.lessonsUpdated).toEqual(['sun'])
    expectValid(result)
  })

  it('catalogues a lesson that already has a tutorial as a draft, not as a placeholder', () => {
    const withTutorial = {
      paths: [{ id: 'trees', title: 'Trees', lessons: [{ id: 'd', title: 'Drawn', objective: 'Already drawn' }] }],
    }
    const uncatalogued: Catalog = { ...catalog(), lessons: catalog().lessons.filter((lesson) => lesson.id !== 'd') }
    const { catalog: result } = applyCurriculumPlan(uncatalogued, withTutorial, new Set(['a', 'b', 'c', 'd']))
    expect(result.lessons.find((lesson) => lesson.id === 'd')).toEqual({
      id: 'd',
      status: 'draft',
      objective: 'Already drawn',
    })
    expectValid(result)
  })

  it('refuses a plan that is malformed, names an unknown level, or repeats an id', () => {
    const bad = (plan: unknown) => () => applyCurriculumPlan(catalog(), plan)
    expect(bad(null)).toThrow(/must be a JSON object/)
    expect(bad({ levels: [] })).toThrow(/needs a "paths" array/)
    expect(bad({ paths: [{ id: 'Sky', title: 'Sky', lessons: [] }] })).toThrow(/is not an id/)
    expect(bad({ paths: [{ id: 'sky', lessons: [] }] })).toThrow(/give it a title/)
    expect(bad({ paths: [{ id: 'sky', title: 'Sky', lessons: [] }, { id: 'sky', title: 'Again', lessons: [] }] })).toThrow(
      /listed twice/,
    )
    expect(bad({ paths: [{ id: 'sky', title: 'Sky', level: 'nope', lessons: [] }] })).toThrow(/no level "nope"/)
    expect(
      bad({
        paths: [
          { id: 'sky', title: 'Sky', lessons: [{ id: 'sun', title: 'Sun', objective: 'Rays' }] },
          { id: 'sea', title: 'Sea', lessons: [{ id: 'sun', title: 'Sun', objective: 'Rays' }] },
        ],
      }),
    ).toThrow(/listed twice/)
    expect(bad({ paths: [{ id: 'sky', title: 'Sky', lessons: [{ id: 'sun', title: 'Sun' }] }] })).toThrow(/objective/)
    expect(bad({ paths: [{ id: 'sky', title: 'Sky', lessons: [{ id: 'nope' }] }] })).toThrow(/without a title/)
  })

  it('applies the real curriculum plan to the fixture catalog, and again with no change', () => {
    const plan = JSON.parse(readFileSync(new URL('../../../docs/curriculum/plan.json', import.meta.url), 'utf8'))
    const start: Catalog = {
      levels: [],
      paths: [
        { id: 'trees', title: 'Trees', lessonIds: ['palm-tree-4'] },
        { id: 'cars', title: 'Cars', lessonIds: ['classic-red-car'] },
      ],
      lessons: [
        { id: 'palm-tree-4', status: 'approved', objective: 'A palm tree' },
        { id: 'classic-red-car', status: 'approved', objective: 'A car' },
      ],
    }
    const tutorials = new Set(['palm-tree-4', 'classic-red-car'])
    const once = applyCurriculumPlan(start, plan, tutorials)
    expect(once.catalog.levels.map((level) => level.id)).toEqual(['starter', 'core', 'advanced'])
    expect(once.catalog.lessons.filter((lesson) => lesson.status === 'planned')).toHaveLength(130)
    // The two drawn lessons keep their entries and move to the paths the plan gives them.
    expect(once.catalog.paths.find((path) => path.id === 'plants')?.lessonIds).toContain('palm-tree-4')
    expect(once.catalog.paths.find((path) => path.id === 'wheels')?.lessonIds).toContain('classic-red-car')
    expect(once.catalog.paths.find((path) => path.id === 'trees')?.lessonIds).toEqual([])
    expectValid(once.catalog, tutorials)

    const twice = applyCurriculumPlan(once.catalog, plan, tutorials)
    expect(twice.catalog).toEqual(once.catalog)
    expect(isEmptySummary(twice.summary)).toBe(true)
  })
})
