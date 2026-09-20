import { describe, expect, it } from 'vitest'

import { pendingChanges, projectCatalog, readyCount, sameJSON } from './publishing'
import type { Catalog, Lesson, LessonStatus } from './types'

const lesson = (id: string, status: LessonStatus, objective = `Draw ${id}`): Lesson => ({ id, status, objective })

const working: Catalog = {
  levels: [],
  paths: [
    { id: 'houses', title: 'Houses', lessonIds: ['a', 'b', 'c'] },
    { id: 'trees', title: 'Trees', lessonIds: ['d'] },
  ],
  lessons: [lesson('a', 'approved'), lesson('b', 'draft'), lesson('c', 'approved'), lesson('d', 'draft')],
}

describe('projectCatalog', () => {
  it('keeps published lessons in working order and drops a path left empty', () => {
    const projected = projectCatalog(working, null, new Set(['a', 'c']))
    expect(projected.paths).toEqual([{ id: 'houses', title: 'Houses', lessonIds: ['a', 'c'] }])
    expect(projected.lessons.map((entry) => entry.id)).toEqual(['a', 'c'])
  })

  it('keeps the published entry of a lesson unless it is being published now', () => {
    const shared: Catalog = { levels: [], paths: [], lessons: [lesson('a', 'needs-review', 'Old words')] }
    expect(projectCatalog(working, shared, new Set(['a'])).lessons[0]).toEqual(lesson('a', 'needs-review', 'Old words'))
    expect(projectCatalog(working, shared, new Set(['a']), new Set(['a'])).lessons[0]).toEqual(lesson('a', 'approved'))
  })

  it('never drops a published lesson the working curriculum no longer lists', () => {
    const shared: Catalog = { levels: [], paths: [], lessons: [lesson('gone', 'approved')] }
    expect(projectCatalog(working, shared, new Set(['gone'])).lessons.map((entry) => entry.id)).toEqual(['gone'])
  })
})

describe('pendingChanges', () => {
  const shared = projectCatalog(working, null, new Set(['a', 'c']))
  const input = {
    working,
    shared,
    published: new Set(['a', 'c']),
    drawingChanged: new Set<string>(),
    photoChanged: new Set<string>(),
  }

  it('lists workspace-only lessons as new, ready once approved', () => {
    expect(pendingChanges(input)).toEqual([
      { kind: 'new', lessonId: 'b', ready: false },
      { kind: 'new', lessonId: 'd', ready: false },
    ])
  })

  it('says what changed in a published lesson', () => {
    const edited: Catalog = { ...working, lessons: working.lessons.map((entry) => (entry.id === 'c' ? { ...entry, objective: 'New words' } : entry)) }
    const changes = pendingChanges({ ...input, working: edited, drawingChanged: new Set(['a']), photoChanged: new Set(['c']) })
    expect(changes.filter((change) => change.kind === 'edited')).toEqual([
      { kind: 'edited', lessonId: 'a', ready: true, parts: ['drawing'] },
      { kind: 'edited', lessonId: 'c', ready: true, parts: ['details', 'photo'] },
    ])
  })

  it('notices a new order or title in the published paths', () => {
    const reordered: Catalog = { ...working, paths: [{ ...working.paths[0], title: 'Homes', lessonIds: ['c', 'b', 'a'] }, working.paths[1]] }
    const change = pendingChanges({ ...input, working: reordered }).find((candidate) => candidate.kind === 'curriculum')
    expect(change).toEqual({
      kind: 'curriculum',
      before: [{ id: 'houses', title: 'Houses', lessonIds: ['a', 'c'] }],
      after: [{ id: 'houses', title: 'Homes', lessonIds: ['c', 'a'] }],
      levelsBefore: [],
      levelsAfter: [],
    })
    expect(readyCount(pendingChanges({ ...input, working: reordered }))).toBe(1)
  })
})

describe('levels and planned lessons', () => {
  const levelled: Catalog = {
    levels: [
      { id: 'starter', title: 'Starter' },
      { id: 'core', title: 'Core' },
    ],
    paths: [
      { id: 'houses', title: 'Houses', level: 'starter', lessonIds: ['a', 'b', 'c'] },
      { id: 'trees', title: 'Trees', level: 'core', lessonIds: ['d'] },
    ],
    lessons: working.lessons,
  }

  it('carries the level on a projected path and drops a level left with no path', () => {
    const projected = projectCatalog(levelled, null, new Set(['a', 'c']))
    expect(projected.paths).toEqual([{ id: 'houses', title: 'Houses', level: 'starter', lessonIds: ['a', 'c'] }])
    expect(projected.levels).toEqual([{ id: 'starter', title: 'Starter' }])
  })

  it('leaves planned lessons out of what publishing would change', () => {
    const planned: Catalog = {
      ...working,
      paths: [{ ...working.paths[0], lessonIds: ['a', 'b', 'c', 'sun'] }, working.paths[1]],
      lessons: [...working.lessons, { id: 'sun', title: 'Sun', status: 'planned', objective: 'Rays' }],
    }
    const shared = projectCatalog(working, null, new Set(['a', 'c']))
    const changes = pendingChanges({
      working: planned,
      shared,
      published: new Set(['a', 'c']),
      drawingChanged: new Set<string>(),
      photoChanged: new Set<string>(),
    })
    expect(changes.map((change) => (change.kind === 'curriculum' ? 'curriculum' : change.lessonId))).toEqual(['b', 'd'])
  })

  it('notices a level that changed even when the paths did not', () => {
    const shared = projectCatalog(levelled, null, new Set(['a', 'c']))
    const renamed: Catalog = { ...levelled, levels: [{ id: 'starter', title: 'First Steps' }, levelled.levels[1]] }
    const change = pendingChanges({
      working: renamed,
      shared,
      published: new Set(['a', 'c']),
      drawingChanged: new Set<string>(),
      photoChanged: new Set<string>(),
    }).find((candidate) => candidate.kind === 'curriculum')
    expect(change && change.kind === 'curriculum' && change.levelsAfter).toEqual([{ id: 'starter', title: 'First Steps' }])
  })
})

describe('sameJSON', () => {
  it('ignores key order and undefined fields, not values', () => {
    expect(sameJSON({ a: 1, b: [1, { c: 2, d: 3 }] }, { b: [1, { d: 3, c: 2 }], a: 1, e: undefined })).toBe(true)
    expect(sameJSON({ a: [1, 2] }, { a: [2, 1] })).toBe(false)
  })
})
