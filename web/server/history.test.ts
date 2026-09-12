import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { validateCatalog } from '../src/catalog/validate'
import { validateTutorial } from '../src/schema/validate'

import { WriteRefused, createRepoWriter } from './repoWriter'
import { openWorkspace, type Workspace } from './workspaceStore'

const realShared = fileURLToPath(new URL('../../shared/', import.meta.url))

let root: string
let shared: string
let workspace: Workspace

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'stroketutor-history-'))
  shared = path.join(root, 'shared')
  await cp(path.join(realShared, 'Tutorials'), path.join(shared, 'Tutorials'), { recursive: true })
  await cp(path.join(realShared, 'Catalog'), path.join(shared, 'Catalog'), { recursive: true })
  const writer = createRepoWriter({ sharedDir: shared, validateTutorial, validateCatalog })
  workspace = await openWorkspace({ file: ':memory:', writer, validateTutorial, validateCatalog })
})

afterEach(async () => {
  workspace.close()
  await rm(root, { recursive: true, force: true })
})

type Doc = Record<string, unknown> & { id: string; steps: unknown[] }

async function house() {
  const stored = await workspace.readTutorial('simple-house')
  if (!stored) throw new Error('fixture missing')
  return { stored, data: JSON.parse(stored.text) as Doc }
}

const reversed = (data: Doc): Doc => ({ ...data, steps: [...data.steps].reverse() })
const publishedHouse = () => readFile(path.join(shared, 'Tutorials/simple-house.json'), 'utf8')

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
    const { entry } = await workspace.appendHistory('simple-house', {
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

    const entries = await workspace.readHistory('simple-house')
    expect(entries.map((item) => [item.kind, item.baseline ?? false])).toEqual([
      ['regenerated', false],
      ['saved', true],
    ])
    expect(entries[1].tutorial).toEqual(data)
    expect(entries[0].tutorial).toEqual(reversed(data))
    expect((await workspace.readTutorial('simple-house'))?.text).toBe(stored.text)
  })

  it('records each save, first keeping the version it replaces, and never touches shared/', async () => {
    const { stored, data } = await house()
    const first = await workspace.writeTutorial('simple-house', reversed(data), { etag: stored.etag })
    let entries = await workspace.readHistory('simple-house')
    expect(entries.map((item) => [item.kind, item.baseline ?? false])).toEqual([
      ['saved', false],
      ['saved', true],
    ])
    expect(entries[0].tutorial).toEqual(reversed(data))
    expect(entries[1].tutorial).toEqual(data)
    expect(await publishedHouse()).toBe(stored.text)

    await workspace.writeTutorial('simple-house', data, { etag: first.etag })
    entries = await workspace.readHistory('simple-house')
    expect(entries).toHaveLength(3)
    expect(entries[0].tutorial).toEqual(data)
    expect(await publishedHouse()).toBe(stored.text)
  })

  it('records nothing for a save that changes nothing, or for a new lesson', async () => {
    const { stored, data } = await house()
    await workspace.writeTutorial('simple-house', data, { etag: stored.etag })
    await workspace.writeTutorial('new-house', { ...data, id: 'new-house' }, { etag: null })
    expect(await workspace.readHistory('simple-house')).toEqual([])
    expect(await workspace.readHistory('new-house')).toEqual([])
  })

  it('records generated candidates as they are, newest first', async () => {
    const { data } = await house()
    await workspace.appendHistory('simple-house', { kind: 'generated', model: 'vendor/a', tutorial: data })
    await workspace.appendHistory('simple-house', { kind: 'generated', model: 'vendor/b', kept: true, tutorial: reversed(data) })
    const entries = await workspace.readHistory('simple-house')
    expect(entries.map((item) => [item.model, item.kept ?? false])).toEqual([
      ['vendor/b', true],
      ['vendor/a', false],
    ])
  })

  it('refuses what cannot be a version of the lesson, before recording anything', async () => {
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
      expect((await refusal(() => workspace.appendHistory(lessonId, body))).status).toBe(status)
    }
    expect(await workspace.readHistory('simple-house')).toEqual([])
    expect((await refusal(() => workspace.readHistory('../escape'))).status).toBe(400)
  })
})
