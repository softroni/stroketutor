import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Catalog, Lesson } from '../src/catalog/types'
import { validateCatalog } from '../src/catalog/validate'
import { formatJSON } from '../src/schema/formatJSON'
import { validateTutorial } from '../src/schema/validate'
import { FIXTURE_SHARED } from '../test/fixture'

import { WriteRefused, createRepoWriter, type RepoWriter } from './repoWriter'
import { openWorkspace, type Workspace } from './workspaceStore'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])

let root: string
let shared: string
let writer: RepoWriter
let workspace: Workspace

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'stroketutor-workspace-'))
  shared = path.join(root, 'shared')
  for (const folder of ['Tutorials', 'Catalog', 'Assets']) {
    await cp(path.join(FIXTURE_SHARED, folder), path.join(shared, folder), { recursive: true })
  }
  writer = createRepoWriter({ sharedDir: shared, validateTutorial, validateCatalog })
  workspace = await openWorkspace({ file: ':memory:', writer, validateTutorial, validateCatalog })
})

afterEach(async () => {
  workspace.close()
  await rm(root, { recursive: true, force: true })
})

const inShared = (file: string) => existsSync(path.join(shared, file))
const readShared = async (file: string) => JSON.parse(await readFile(path.join(shared, file), 'utf8'))

async function refusal(action: () => Promise<unknown>): Promise<WriteRefused> {
  try {
    await action()
  } catch (error) {
    if (error instanceof WriteRefused) return error
    throw error
  }
  throw new Error('Expected a refusal.')
}

async function workingCatalog(): Promise<Catalog> {
  const current = await workspace.readCatalog()
  return { paths: JSON.parse(current.paths.text).paths, lessons: JSON.parse(current.lessons.text).lessons }
}

async function editCatalog(change: (catalog: Catalog) => Catalog) {
  const current = await workspace.readCatalog()
  const next = change(await workingCatalog())
  await workspace.writeCatalog(
    { catalogVersion: 1, paths: next.paths },
    { catalogVersion: 1, lessons: next.lessons },
    { paths: { etag: current.paths.etag }, lessons: { etag: current.lessons.etag } },
  )
}

/** A second house, in the workspace only, at the end of the Houses path. */
async function addDraftHouse(fields: Partial<Lesson> = {}) {
  const house = JSON.parse((await workspace.readTutorial('simple-house'))!.text)
  await workspace.writeTutorial('house-two', { ...house, id: 'house-two', title: 'House Two' }, { etag: null })
  await editCatalog((catalog) => ({
    lessons: [...catalog.lessons, { id: 'house-two', status: 'draft', objective: 'A second house', ...fields }],
    paths: catalog.paths.map((candidate) =>
      candidate.id === 'houses' ? { ...candidate, lessonIds: [...candidate.lessonIds, 'house-two'] } : candidate,
    ),
  }))
}

describe('the working library', () => {
  it('starts as shared/, with nothing to publish', async () => {
    const library = await workspace.readLibrary()
    const sharedLibrary = await writer.readLibrary()
    expect(library.tutorials.map((file) => file.fileName)).toEqual(sharedLibrary.tutorials.map((file) => file.fileName))
    expect(library.paths?.text).toBe(sharedLibrary.paths?.text)
    expect(library.publishing).toMatchObject({ editedIds: [], sharedChangedOutside: false, trashCount: 0 })
    expect(library.publishing.publishedIds).toEqual(expect.arrayContaining(['simple-house', 'cat-face']))
    expect(library.publishing.pending.filter((change) => change.kind === 'edited')).toEqual([])
  })

  it('keeps an edit to a published lesson in the workspace, and drops it when it matches shared/ again', async () => {
    const before = await readFile(path.join(shared, 'Tutorials/simple-house.json'), 'utf8')
    const stored = (await workspace.readTutorial('simple-house'))!
    const house = JSON.parse(stored.text)
    const saved = await workspace.writeTutorial('simple-house', { ...house, steps: [...house.steps].reverse() }, { etag: stored.etag })

    expect(await readFile(path.join(shared, 'Tutorials/simple-house.json'), 'utf8')).toBe(before)
    let library = await workspace.readLibrary()
    expect(library.publishing.editedIds).toEqual(['simple-house'])
    expect(library.publishing.pending).toContainEqual({ kind: 'edited', lessonId: 'simple-house', ready: false, parts: ['drawing'] })

    await workspace.writeTutorial('simple-house', house, { etag: saved.etag })
    library = await workspace.readLibrary()
    expect(library.publishing.editedIds).toEqual([])
    expect((await workspace.readTutorial('simple-house'))?.text).toBe(before)
  })

  it('refuses a stale save, as the file writer does', async () => {
    const stored = (await workspace.readTutorial('simple-house'))!
    const house = JSON.parse(stored.text)
    await workspace.writeTutorial('simple-house', { ...house, title: 'One' }, { etag: stored.etag })
    expect((await refusal(() => workspace.writeTutorial('simple-house', { ...house, title: 'Two' }, { etag: stored.etag }))).status).toBe(409)
  })

  it('keeps a new lesson, its photo and its place in the curriculum out of shared/', async () => {
    await addDraftHouse()
    // The photo has to exist before the catalog can point at it.
    await workspace.writeReference('house-two', 'image/png', PNG)
    await editCatalog((catalog) => ({
      ...catalog,
      lessons: catalog.lessons.map((lesson) =>
        lesson.id === 'house-two' ? { ...lesson, reference: { file: 'house-two.png', source: 'own photo', license: 'own photo' } } : lesson,
      ),
    }))

    expect(inShared('Tutorials/house-two.json')).toBe(false)
    expect(inShared('Assets/References/house-two.png')).toBe(false)
    expect((await readShared('Catalog/lessons.json')).lessons.map((lesson: Lesson) => lesson.id)).not.toContain('house-two')

    const library = await workspace.readLibrary()
    expect(library.tutorials.map((file) => file.fileName)).toContain('house-two.json')
    expect(library.references.map((reference) => reference.file)).toContain('house-two.png')
    expect(library.publishing.pending).toContainEqual({ kind: 'new', lessonId: 'house-two', ready: false })
    expect((await workspace.readReference('house-two.png'))?.contentType).toBe('image/png')
  })
})

describe('publishing', () => {
  it('writes the lesson, its photo and the curriculum into shared/, approving it', async () => {
    await addDraftHouse()
    await workspace.writeReference('house-two', 'image/png', PNG)
    await editCatalog((catalog) => ({
      ...catalog,
      lessons: catalog.lessons.map((lesson) =>
        lesson.id === 'house-two' ? { ...lesson, reference: { file: 'house-two.png', source: 'own photo', license: 'CC0' } } : lesson,
      ),
    }))

    const { files } = await workspace.publish(['house-two'])
    expect(files).toEqual([
      'shared/Assets/References/house-two.png',
      'shared/Tutorials/house-two.json',
      'shared/Catalog/paths.json',
      'shared/Catalog/lessons.json',
    ])
    expect((await readShared('Tutorials/house-two.json')).title).toBe('House Two')
    const paths = (await readShared('Catalog/paths.json')).paths
    expect(paths.find((candidate: { id: string }) => candidate.id === 'houses').lessonIds).toEqual(['simple-house', 'house-two'])
    const lessons = (await readShared('Catalog/lessons.json')).lessons as Lesson[]
    expect(lessons.find((lesson) => lesson.id === 'house-two')?.status).toBe('approved')

    const library = await workspace.readLibrary()
    expect(library.publishing.pending.filter((change) => change.kind !== 'curriculum' && change.lessonId === 'house-two')).toEqual([])
    expect(library.publishing.publishedIds).toContain('house-two')
    expect((await workspace.readHistory('house-two'))[0].kind).toBe('published')
  })

  it('publishes a new order on its own, touching only paths.json', async () => {
    // Trees and Houses each have a published lesson, so swapping them changes what the app sees.
    await editCatalog((catalog) => ({ ...catalog, paths: [...catalog.paths].reverse() }))
    expect((await workspace.readLibrary()).publishing.pending.some((change) => change.kind === 'curriculum')).toBe(true)
    expect((await workspace.publish([])).files).toEqual(['shared/Catalog/paths.json'])
    expect((await workspace.readLibrary()).publishing.pending.some((change) => change.kind === 'curriculum')).toBe(false)
  })

  it('refuses while shared/Catalog has changed outside the Studio, until it is adopted', async () => {
    const paths = await readShared('Catalog/paths.json')
    paths.paths.reverse()
    await writeFile(path.join(shared, 'Catalog/paths.json'), formatJSON(paths))

    expect((await workspace.readLibrary()).publishing.sharedChangedOutside).toBe(true)
    expect((await refusal(() => workspace.publish([]))).status).toBe(409)

    await addDraftHouse()
    await workspace.adoptShared()
    const library = await workspace.readLibrary()
    expect(library.publishing.sharedChangedOutside).toBe(false)
    expect((await workingCatalog()).paths.map((candidate) => candidate.id)).toEqual(paths.paths.map((candidate: { id: string }) => candidate.id))
    // The workspace-only lesson keeps its place.
    expect((await workingCatalog()).paths.find((candidate) => candidate.id === 'houses')?.lessonIds).toEqual(['simple-house', 'house-two'])
  })

  it('refuses to publish over a lesson that changed in shared/ since it was edited', async () => {
    const stored = (await workspace.readTutorial('simple-house'))!
    const house = JSON.parse(stored.text)
    await workspace.writeTutorial('simple-house', { ...house, title: 'Edited in the Studio' }, { etag: stored.etag })
    await writeFile(path.join(shared, 'Tutorials/simple-house.json'), formatJSON({ ...house, title: 'Edited by hand' }))
    expect((await refusal(() => workspace.publish(['simple-house']))).status).toBe(409)
    expect((await readShared('Tutorials/simple-house.json')).title).toBe('Edited by hand')
  })
})

describe('unpublishing, deleting and the trash', () => {
  it('unpublishes a lesson and keeps it, with its photo, in the workspace', async () => {
    const photo = (await workingCatalog()).lessons.find((lesson) => lesson.id === 'palm-tree-4')?.reference?.file
    expect(photo).toBe('palm-tree-4.svg')
    const { files } = await workspace.unpublish('palm-tree-4')
    expect(files).toEqual([
      'shared/Catalog/paths.json',
      'shared/Catalog/lessons.json',
      'shared/Tutorials/palm-tree-4.json',
      'shared/Assets/References/palm-tree-4.svg',
    ])
    expect(inShared('Tutorials/palm-tree-4.json')).toBe(false)
    expect(inShared('Assets/References/palm-tree-4.svg')).toBe(false)
    expect((await readShared('Catalog/lessons.json')).lessons.map((lesson: Lesson) => lesson.id)).not.toContain('palm-tree-4')

    const library = await workspace.readLibrary()
    expect(library.publishing.publishedIds).not.toContain('palm-tree-4')
    expect(library.tutorials.map((file) => file.fileName)).toContain('palm-tree-4.json')
    expect(library.publishing.pending).toContainEqual({ kind: 'new', lessonId: 'palm-tree-4', ready: true })
    expect((await workspace.readReference('palm-tree-4.svg'))?.contentType).toBe('image/svg+xml')

    // And it can go back.
    await workspace.publish(['palm-tree-4'])
    expect(inShared('Tutorials/palm-tree-4.json')).toBe(true)
    expect(inShared('Assets/References/palm-tree-4.svg')).toBe(true)
  })

  it('leaves a path that was already empty alone when unpublishing', async () => {
    const paths = await readShared('Catalog/paths.json')
    paths.paths.push({ id: 'someday', title: 'Someday', lessonIds: [] })
    await writeFile(path.join(shared, 'Catalog/paths.json'), formatJSON(paths))
    await workspace.adoptShared()

    await workspace.unpublish('palm-tree-4')
    const after = (await readShared('Catalog/paths.json')).paths as { id: string; lessonIds: string[] }[]
    expect(after.find((candidate) => candidate.id === 'someday')).toEqual({ id: 'someday', title: 'Someday', lessonIds: [] })
    // Trees is dropped if palm-tree-4 was its only published lesson; either way it no longer lists it.
    expect(after.find((candidate) => candidate.id === 'trees')?.lessonIds ?? []).not.toContain('palm-tree-4')
  })

  it('deletes a published lesson to the trash and restores it to its place', async () => {
    const trees = (await workingCatalog()).paths.find((candidate) => candidate.id === 'trees')!
    const position = trees.lessonIds.indexOf('palm-tree-4')

    await workspace.deleteLesson('palm-tree-4')
    expect(inShared('Tutorials/palm-tree-4.json')).toBe(false)
    expect((await workspace.readTutorial('palm-tree-4'))).toBeNull()
    expect((await workingCatalog()).lessons.map((lesson) => lesson.id)).not.toContain('palm-tree-4')
    const [item] = workspace.listTrash()
    expect(item).toMatchObject({ kind: 'lesson', itemId: 'palm-tree-4', title: 'Palm Tree 4' })

    await workspace.restore(item.id)
    expect(workspace.listTrash()).toEqual([])
    expect((await workingCatalog()).paths.find((candidate) => candidate.id === 'trees')?.lessonIds.indexOf('palm-tree-4')).toBe(position)
    expect((await workspace.readReference('palm-tree-4.svg'))?.bytes.byteLength).toBeGreaterThan(0)
    expect((await workspace.readLibrary()).publishing.publishedIds).not.toContain('palm-tree-4')
  })

  it('forgets a lesson’s history only when it is deleted for good', async () => {
    await addDraftHouse()
    const stored = (await workspace.readTutorial('house-two'))!
    await workspace.writeTutorial('house-two', { ...JSON.parse(stored.text), title: 'House 2' }, { etag: stored.etag })
    expect(await workspace.readHistory('house-two')).toHaveLength(2)

    await workspace.deleteLesson('house-two')
    expect(await workspace.readHistory('house-two')).toHaveLength(2)
    await workspace.purge(workspace.listTrash()[0].id)
    expect(await workspace.readHistory('house-two')).toEqual([])
    expect((await workspace.readLibrary()).publishing.trashCount).toBe(0)
  })

  it('refuses to restore over a lesson that took the id since', async () => {
    await addDraftHouse()
    await workspace.deleteLesson('house-two')
    await addDraftHouse()
    expect((await refusal(() => workspace.restore(workspace.listTrash()[0].id))).status).toBe(409)
  })

  it('deletes a path, leaving its lessons unfiled, and restores it with them', async () => {
    await addDraftHouse()
    await workspace.deletePath('houses', 'unfile')
    const catalog = await workingCatalog()
    expect(catalog.paths.map((candidate) => candidate.id)).not.toContain('houses')
    expect(catalog.lessons.map((lesson) => lesson.id)).toEqual(expect.arrayContaining(['simple-house', 'house-two']))
    // Still published, until the curriculum is published.
    expect(inShared('Tutorials/simple-house.json')).toBe(true)

    await workspace.restore(workspace.listTrash()[0].id)
    expect((await workingCatalog()).paths.find((candidate) => candidate.id === 'houses')?.lessonIds).toEqual(['simple-house', 'house-two'])
  })

  it('deletes a path together with its lessons', async () => {
    await addDraftHouse()
    const { files } = await workspace.deletePath('houses', 'trash')
    expect(files).toContain('shared/Tutorials/simple-house.json')
    expect(inShared('Tutorials/simple-house.json')).toBe(false)
    expect(workspace.listTrash().map((item) => item.kind).sort()).toEqual(['lesson', 'lesson', 'path'])
  })

  it('empties the trash', async () => {
    await addDraftHouse()
    await workspace.deleteLesson('house-two')
    await workspace.emptyTrash()
    expect(workspace.listTrash()).toEqual([])
  })
})

describe('duplicating', () => {
  it('copies a lesson as a draft right after it, with its photo', async () => {
    const { lessonId } = await workspace.duplicate('palm-tree-4')
    expect(lessonId).toBe('palm-tree-4-copy')
    const catalog = await workingCatalog()
    const trees = catalog.paths.find((candidate) => candidate.id === 'trees')!.lessonIds
    expect(trees[trees.indexOf('palm-tree-4') + 1]).toBe('palm-tree-4-copy')
    expect(catalog.lessons.find((lesson) => lesson.id === lessonId)).toMatchObject({
      status: 'draft',
      reference: { file: 'palm-tree-4-copy.svg' },
    })
    expect(JSON.parse((await workspace.readTutorial(lessonId))!.text).title).toBe('Palm Tree 4 (copy)')
    expect(await workspace.readReference('palm-tree-4-copy.svg')).not.toBeNull()
    expect((await workspace.duplicate('palm-tree-4')).lessonId).toBe('palm-tree-4-copy-2')
    expect(inShared('Tutorials/palm-tree-4-copy.json')).toBe(false)
  })
})

describe('backups', () => {
  it('keeps one copy a day, and only the newest seven', async () => {
    const file = path.join(root, 'studio', 'workspace.sqlite')
    const backupDir = path.join(root, 'studio', 'backups')
    const onDisk = await openWorkspace({ file, backupDir, writer, validateTutorial, validateCatalog })
    try {
      for (let day = 1; day <= 9; day += 1) {
        await onDisk.backup(new Date(Date.UTC(2026, 8, day)))
        await onDisk.backup(new Date(Date.UTC(2026, 8, day, 18)))
      }
      const names = (await readdir(backupDir)).sort()
      expect(names).toHaveLength(7)
      expect(names[0]).toBe('workspace-2026-09-03.sqlite')
      expect(names[6]).toBe('workspace-2026-09-09.sqlite')
    } finally {
      onDisk.close()
    }
  })
})
