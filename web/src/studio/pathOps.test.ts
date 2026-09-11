import { describe, expect, it } from 'vitest'

import type { Catalog } from '../catalog/types'
import { validateCatalog } from '../catalog/validate'

import {
  CatalogEditError,
  assignLesson,
  createPath,
  deletePath,
  movePath,
  reorderLessons,
  slugify,
  updatePath,
} from './pathOps'

const catalog = (): Catalog => ({
  paths: [
    { id: 'houses', title: 'Houses', description: 'Front-facing first.', lessonIds: ['a', 'b'] },
    { id: 'trees', title: 'Trees', lessonIds: ['c'] },
  ],
  lessons: ['a', 'b', 'c', 'd'].map((id) => ({ id, status: 'draft' as const, objective: 'One idea.' })),
})

/** The result must still pass the catalog's own strict validation. */
function expectValid(result: Catalog) {
  const verdict = validateCatalog(
    { catalogVersion: 1, paths: result.paths },
    { catalogVersion: 1, lessons: result.lessons },
    { tutorialIds: new Set(['a', 'b', 'c', 'd']) },
  )
  expect(verdict.ok, verdict.ok ? '' : JSON.stringify(verdict.issues)).toBe(true)
}

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
