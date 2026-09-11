import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { validateCatalog } from '../src/catalog/validate'
import { validateTutorial } from '../src/schema/validate'

import { MAX_REFERENCE_BYTES, WriteRefused, createRepoWriter, etagOf, type RepoWriter } from './repoWriter'

const realShared = fileURLToPath(new URL('../../shared/', import.meta.url))

let root: string
let shared: string
let writer: RepoWriter

beforeEach(async () => {
  // A scratch copy of the real shared/, with a sibling file the writer must never reach.
  root = await mkdtemp(path.join(tmpdir(), 'stroketutor-writer-'))
  shared = path.join(root, 'shared')
  await cp(path.join(realShared, 'Tutorials'), path.join(shared, 'Tutorials'), { recursive: true })
  await cp(path.join(realShared, 'Catalog'), path.join(shared, 'Catalog'), { recursive: true })
  await writeFile(path.join(root, 'outside.json'), 'untouched')
  writer = createRepoWriter({ sharedDir: shared, validateTutorial, validateCatalog })
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

/** Runs `action` and returns the refusal it must produce. */
async function refusal(action: () => Promise<unknown>): Promise<WriteRefused> {
  try {
    await action()
  } catch (error) {
    if (error instanceof WriteRefused) return error
    throw error
  }
  throw new Error('Expected the write to be refused.')
}

const readShared = (file: string) => readFile(path.join(shared, file), 'utf8')

async function house() {
  const stored = await writer.readTutorial('simple-house')
  if (!stored) throw new Error('fixture missing')
  return { stored, data: JSON.parse(stored.text) as Record<string, unknown> & { steps: unknown[] } }
}

describe('tutorials', () => {
  it('rewrites an unchanged lesson byte for byte', async () => {
    const { stored, data } = await house()
    const result = await writer.writeTutorial('simple-house', data, { etag: stored.etag })
    expect(await readShared('Tutorials/simple-house.json')).toBe(stored.text)
    expect(result).toMatchObject({ file: 'shared/Tutorials/simple-house.json', etag: stored.etag, created: false })
  })

  it('saves an edit and leaves no temporary files behind', async () => {
    const { stored, data } = await house()
    const edited = { ...data, steps: [...data.steps].reverse() }
    await writer.writeTutorial('simple-house', edited, { etag: stored.etag })
    expect(JSON.parse(await readShared('Tutorials/simple-house.json'))).toEqual(edited)
    expect((await readdir(path.join(shared, 'Tutorials'))).sort()).toEqual([
      'cat-face.json',
      'simple-house.json',
    ])
  })

  it('creates a new lesson only when asked to create', async () => {
    const { data } = await house()
    const copy = { ...data, id: 'house-copy' }
    await writer.writeTutorial('house-copy', copy, { etag: null })
    expect(JSON.parse(await readShared('Tutorials/house-copy.json'))).toEqual(copy)
    expect((await refusal(() => writer.writeTutorial('house-copy', copy, { etag: null }))).status).toBe(409)
  })

  it('refuses ids that could escape the folder', async () => {
    const { data } = await house()
    for (const id of ['../outside', '..', 'a/b', 'Simple-House', '', 'a--b']) {
      expect((await refusal(() => writer.writeTutorial(id, { ...data, id }, { etag: null }))).status).toBe(400)
    }
    expect(await readFile(path.join(root, 'outside.json'), 'utf8')).toBe('untouched')
  })

  it('refuses an invalid tutorial and reports where', async () => {
    const { stored, data } = await house()
    const broken = { ...data, steps: [] }
    const refused = await refusal(() => writer.writeTutorial('simple-house', broken, { etag: stored.etag }))
    expect(refused.status).toBe(422)
    expect(refused.issues.map((issue) => issue.path)).toContain('steps')
    expect(await readShared('Tutorials/simple-house.json')).toBe(stored.text)
  })

  it('refuses a document whose id does not match the file it would become', async () => {
    const { stored, data } = await house()
    const refused = await refusal(() =>
      writer.writeTutorial('simple-house', { ...data, id: 'other' }, { etag: stored.etag }),
    )
    expect(refused.status).toBe(422)
  })

  it('never writes over a file that changed on disk', async () => {
    const { data } = await house()
    expect((await refusal(() => writer.writeTutorial('simple-house', data, { etag: etagOf('stale') }))).status).toBe(409)
    expect((await refusal(() => writer.writeTutorial('simple-house', data, undefined))).status).toBe(428)
  })
})

describe('catalog', () => {
  async function catalog() {
    const stored = await writer.readCatalog()
    if (!stored.paths || !stored.lessons) throw new Error('fixture missing')
    return {
      stored,
      paths: JSON.parse(stored.paths.text) as { catalogVersion: 1; paths: { lessonIds: string[] }[] },
      lessons: JSON.parse(stored.lessons.text) as unknown,
    }
  }

  it('rewrites an unchanged catalog byte for byte', async () => {
    const { stored, paths, lessons } = await catalog()
    await writer.writeCatalog(paths, lessons, {
      paths: { etag: stored.paths!.etag },
      lessons: { etag: stored.lessons!.etag },
    })
    expect(await readShared('Catalog/paths.json')).toBe(stored.paths!.text)
    expect(await readShared('Catalog/lessons.json')).toBe(stored.lessons!.text)
  })

  it('refuses a catalog that points at a lesson with no tutorial', async () => {
    const { stored, paths, lessons } = await catalog()
    const dangling = { ...paths, paths: [{ ...paths.paths[0], lessonIds: ['simple-house', 'nowhere'] }] }
    const refused = await refusal(() =>
      writer.writeCatalog(dangling, lessons, {
        paths: { etag: stored.paths!.etag },
        lessons: { etag: stored.lessons!.etag },
      }),
    )
    expect(refused.status).toBe(422)
    expect(await readShared('Catalog/paths.json')).toBe(stored.paths!.text)
  })

  it('writes neither file when either one is stale', async () => {
    const { stored, paths, lessons } = await catalog()
    const refused = await refusal(() =>
      writer.writeCatalog(paths, lessons, {
        paths: { etag: stored.paths!.etag },
        lessons: { etag: etagOf('stale') },
      }),
    )
    expect(refused.status).toBe(409)
  })
})

describe('reference photos', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])

  it('stores a photo under a name derived from the lesson id', async () => {
    expect(await writer.writeReference('simple-house', 'image/png', png)).toEqual({ file: 'simple-house.png' })
    const stored = await readFile(path.join(shared, 'Assets', 'References', 'simple-house.png'))
    expect(new Uint8Array(stored)).toEqual(png)
  })

  it('refuses a file whose contents do not match its declared type', async () => {
    const text = new TextEncoder().encode('not an image at all')
    expect((await refusal(() => writer.writeReference('simple-house', 'image/png', text))).status).toBe(415)
    expect((await refusal(() => writer.writeReference('simple-house', 'image/gif', png))).status).toBe(415)
  })

  it('refuses oversized photos and unsafe lesson ids', async () => {
    const huge = new Uint8Array(MAX_REFERENCE_BYTES + 1)
    huge.set(png)
    expect((await refusal(() => writer.writeReference('simple-house', 'image/png', huge))).status).toBe(413)
    expect((await refusal(() => writer.writeReference('../outside', 'image/png', png))).status).toBe(400)
  })
})
