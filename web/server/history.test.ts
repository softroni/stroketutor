import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { validateCatalog } from '../src/catalog/validate'
import { validateTutorial } from '../src/schema/validate'

import { WriteRefused, createRepoWriter, type RepoWriter } from './repoWriter'

const realShared = fileURLToPath(new URL('../../shared/', import.meta.url))

let root: string
let shared: string
let writer: RepoWriter

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'stroketutor-history-'))
  shared = path.join(root, 'shared')
  await cp(path.join(realShared, 'Tutorials'), path.join(shared, 'Tutorials'), { recursive: true })
  await cp(path.join(realShared, 'Catalog'), path.join(shared, 'Catalog'), { recursive: true })
  writer = createRepoWriter({ sharedDir: shared, validateTutorial, validateCatalog })
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

type Doc = Record<string, unknown> & { id: string; steps: unknown[] }

async function house() {
  const stored = await writer.readTutorial('simple-house')
  if (!stored) throw new Error('fixture missing')
  return { stored, data: JSON.parse(stored.text) as Doc }
}

const reversed = (data: Doc): Doc => ({ ...data, steps: [...data.steps].reverse() })
const historyFolder = () => path.join(shared, 'History', 'simple-house')

async function refusal(action: () => Promise<unknown>): Promise<WriteRefused> {
  try {
    await action()
  } catch (error) {
    if (error instanceof WriteRefused) return error
    throw error
  }
  throw new Error('Expected a refusal.')
}

describe('lesson history', () => {
  it('records a regeneration after the lesson as it was, and leaves the lesson alone', async () => {
    const { stored, data } = await house()
    const { entry } = await writer.appendHistory('simple-house', {
      kind: 'regenerated',
      layer: 'order',
      model: 'vendor/model',
      promptVersion: 'regenerate-order-v1',
      note: '  Start at the roof.  ',
      cost: 0.004,
      unknownField: 'dropped',
      tutorial: reversed(data),
    })
    expect(entry).toMatchObject({ historyVersion: 1, lessonId: 'simple-house', kind: 'regenerated', layer: 'order', note: 'Start at the roof.' })
    expect(entry).not.toHaveProperty('unknownField')
    expect(await readdir(historyFolder())).toContain(`${entry.id}.json`)

    const entries = await writer.readHistory('simple-house')
    expect(entries.map((item) => [item.kind, item.baseline ?? false])).toEqual([
      ['regenerated', false],
      ['saved', true],
    ])
    expect(entries[1].tutorial).toEqual(data)
    expect(entries[0].tutorial).toEqual(reversed(data))
    expect(await readFile(path.join(shared, 'Tutorials/simple-house.json'), 'utf8')).toBe(stored.text)
  })

  it('records each save, first keeping the version it replaces', async () => {
    const { stored, data } = await house()
    const first = await writer.writeTutorial('simple-house', reversed(data), { etag: stored.etag })
    let entries = await writer.readHistory('simple-house')
    expect(entries.map((item) => [item.kind, item.baseline ?? false])).toEqual([
      ['saved', false],
      ['saved', true],
    ])
    expect(entries[0].tutorial).toEqual(reversed(data))
    expect(entries[1].tutorial).toEqual(data)

    await writer.writeTutorial('simple-house', data, { etag: first.etag })
    entries = await writer.readHistory('simple-house')
    expect(entries).toHaveLength(3)
    expect(entries[0].tutorial).toEqual(data)
  })

  it('records nothing for a save that changes nothing, or for a new lesson', async () => {
    const { stored, data } = await house()
    await writer.writeTutorial('simple-house', data, { etag: stored.etag })
    await writer.writeTutorial('new-house', { ...data, id: 'new-house' }, { etag: null })
    expect(await writer.readHistory('simple-house')).toEqual([])
    expect(await writer.readHistory('new-house')).toEqual([])
  })

  it('records generated candidates as they are, newest first, skipping unreadable files', async () => {
    const { data } = await house()
    await writer.appendHistory('simple-house', { kind: 'generated', model: 'vendor/a', tutorial: data })
    await writer.appendHistory('simple-house', { kind: 'generated', model: 'vendor/b', kept: true, tutorial: reversed(data) })
    await writeFile(path.join(historyFolder(), 'notes.txt'), 'not a version')
    await writeFile(path.join(historyFolder(), '20260101T000000000Z-saved-abcdef.json'), '{ not json')

    const entries = await writer.readHistory('simple-house')
    expect(entries.map((item) => [item.model, item.kept ?? false])).toEqual([
      ['vendor/b', true],
      ['vendor/a', false],
    ])
  })

  it('refuses what cannot be a version of the lesson, before writing anything', async () => {
    const { data } = await house()
    const cases: [string, unknown, number][] = [
      ['simple-house', 'a string', 400],
      ['simple-house', { kind: 'saved', tutorial: data }, 400],
      ['simple-house', { kind: 'regenerated', tutorial: { ...data, steps: [] } }, 422],
      ['simple-house', { kind: 'regenerated', tutorial: { ...data, id: 'other-house' } }, 422],
      ['no-such-lesson', { kind: 'regenerated', tutorial: { ...data, id: 'no-such-lesson' } }, 404],
      ['../escape', { kind: 'regenerated', tutorial: data }, 400],
    ]
    for (const [lessonId, body, status] of cases) {
      expect((await refusal(() => writer.appendHistory(lessonId, body))).status).toBe(status)
    }
    await expect(readdir(path.join(shared, 'History'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect((await refusal(() => writer.readHistory('../escape'))).status).toBe(400)
  })

  it('reads an empty history for a lesson with no folder yet', async () => {
    await mkdir(path.join(shared, 'History'), { recursive: true })
    expect(await writer.readHistory('simple-house')).toEqual([])
  })
})
