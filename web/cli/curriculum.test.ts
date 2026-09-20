import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Catalog } from '../src/catalog/types'
import type { Tutorial } from '../src/schema/types'

import { openTestStudio, type TestStudio } from './testing'

let t: TestStudio

beforeEach(async () => {
  t = await openTestStudio()
})

afterEach(async () => {
  await t.close()
})

async function catalog(): Promise<Catalog> {
  const { paths, lessons } = await t.workspace.readCatalog()
  const file = JSON.parse(paths.text)
  return { levels: file.levels ?? [], paths: file.paths, lessons: JSON.parse(lessons.text).lessons }
}

describe('the command line', () => {
  it('prints an overview with no command, and refuses an unknown one', async () => {
    const help = await t.studio('')
    expect(help.code).toBe(0)
    expect(help.stdout).toContain('paths create')
    expect(help.stdout).toContain('lessons approve')

    const unknown = await t.studio('paths explode')
    expect(unknown.code).toBe(2)
    expect(unknown.stderr).toContain('Unknown command "paths explode"')
  })

  it('reports a missing argument with the command’s usage, exit code 2', async () => {
    const outcome = await t.studio('paths rename trees')
    expect(outcome.code).toBe(2)
    expect(outcome.stderr).toContain('Missing <title>')
    expect(outcome.stderr).toContain('Usage: studio paths rename <id> <title>')
  })

  it('describes one command with --help', async () => {
    const outcome = await t.studio('lessons set --help')
    expect(outcome.code).toBe(0)
    expect(outcome.stdout).toContain('--objective')
    expect(outcome.stdout).toContain('--complexity <n>')
  })

  it('answers --json with one document, errors included', async () => {
    const status = await t.json<{ paths: number; lessons: number }>('status')
    expect(status.paths).toBe(3)
    expect(status.lessons).toBe(4)

    const missing = await t.studio('lessons show nope --json')
    expect(missing.code).toBe(1)
    expect(JSON.parse(missing.stdout)).toEqual({ error: 'There is no lesson "nope".' })
  })

  it('takes global options before or after the command', async () => {
    const before = await t.studio('--json paths list')
    const after = await t.studio('paths list --json')
    expect(before.stdout).toBe(after.stdout)
  })
})

describe('paths', () => {
  it('creates, renames, describes, reorders and lists paths', async () => {
    expect((await t.studio('paths create animals --title Animals --description Faces')).code).toBe(0)
    expect((await t.studio(['paths', 'create', '--title', 'Sea Life'])).stdout).toContain('(sea-life)')
    expect((await t.studio('paths rename animals Beasts')).code).toBe(0)
    expect((await t.studio(['paths', 'describe', 'animals', ''])).stdout).toContain('Removed the description')
    expect((await t.studio('paths move animals --to 1')).stdout).toContain('now path 1 of 5')
    expect((await t.studio('paths move animals --down')).stdout).toContain('now path 2 of 5')

    const { paths } = await catalog()
    expect(paths.map((p) => p.id)).toEqual(['trees', 'animals', 'houses', 'cars', 'sea-life'])
    expect(paths[1]).toEqual({ id: 'animals', title: 'Beasts', lessonIds: [] })

    const listed = await t.studio('paths list')
    expect(listed.stdout).toContain('Beasts')
  })

  it('refuses a duplicate or malformed path id with exit code 1', async () => {
    const duplicate = await t.studio('paths create trees --title Again')
    expect(duplicate.code).toBe(1)
    expect(duplicate.stderr).toContain('already a path')
    const bad = await t.studio('paths create Bad_Id --title Bad')
    expect(bad.code).toBe(1)
  })

  it('adds a catalogued lesson to a path, reorders it and takes it out', async () => {
    await t.studio('lessons set cat-face --objective Whiskers')
    expect((await t.studio('paths add trees cat-face')).code).toBe(0)
    expect((await catalog()).paths[0].lessonIds).toEqual(['palm-tree-4', 'cat-face'])
    expect((await t.studio('paths reorder trees cat-face --earlier')).stdout).toContain('lesson 1 of 2')
    expect((await t.studio('paths reorder trees cat-face --to 2')).stdout).toContain('lesson 2 of 2')
    expect((await t.studio('lessons move cat-face --path houses --position 1')).code).toBe(0)
    expect((await catalog()).paths.map((p) => p.lessonIds)).toEqual([['palm-tree-4'], ['cat-face', 'simple-house'], ['classic-red-car']])
    expect((await t.studio('lessons move cat-face --unfiled')).code).toBe(0)
    expect((await catalog()).paths.map((p) => p.lessonIds)).toEqual([['palm-tree-4'], ['simple-house'], ['classic-red-car']])
  })

  it('refuses to add a lesson that is not catalogued', async () => {
    const outcome = await t.studio('paths add trees cat-face')
    expect(outcome.code).toBe(1)
    expect(outcome.stderr).toContain('not in shared/Catalog/lessons.json')
  })

  it('deletes a path to the trash, unfiling its lessons, and restores it', async () => {
    expect((await t.studio('paths delete houses')).code).toBe(0)
    expect((await catalog()).paths.map((p) => p.id)).toEqual(['trees', 'cars'])
    const unfiled = await t.json<{ lessons: { id: string }[] }>('lessons list --unfiled')
    expect(unfiled.lessons.map((l) => l.id)).toEqual(['cat-face', 'simple-house'])
    expect((await t.studio('trash restore houses')).stdout).toContain('Restored the path houses')
    expect((await catalog()).paths.map((p) => p.lessonIds)).toEqual([['palm-tree-4'], ['simple-house'], ['classic-red-car']])
  })

  it('needs --yes to trash a path with its published lessons off a terminal', async () => {
    const refused = await t.studio('paths delete houses --lessons trash')
    expect(refused.code).toBe(1)
    expect(refused.stderr).toContain('Pass --yes')
    expect((await catalog()).paths).toHaveLength(3)

    const done = await t.studio('paths delete houses --lessons trash --yes')
    expect(done.code).toBe(0)
    expect(done.stdout).toContain('git add -- shared/')
    const trash = await t.json<{ items: { itemId: string }[] }>('trash list')
    expect(trash.items.map((i) => i.itemId).sort()).toEqual(['houses', 'simple-house'])
  })
})

describe('lessons', () => {
  it('lists and shows lessons with their state, and filters', async () => {
    const all = await t.json<{ lessons: { id: string; state: string; status: string | null }[] }>('lessons list')
    expect(all.lessons.map((l) => [l.id, l.state, l.status])).toEqual([
      ['cat-face', 'published', null],
      ['classic-red-car', 'published', 'approved'],
      ['palm-tree-4', 'published', 'approved'],
      ['simple-house', 'published', 'needs-review'],
    ])
    const approved = await t.json<{ lessons: { id: string }[] }>('lessons list --status approved')
    expect(approved.lessons.map((l) => l.id)).toEqual(['classic-red-car', 'palm-tree-4'])
    const inPath = await t.json<{ lessons: { id: string }[] }>('lessons list --path houses')
    expect(inPath.lessons.map((l) => l.id)).toEqual(['simple-house'])

    const shown = await t.studio('lessons show simple-house')
    expect(shown.stdout).toContain('Simple House (simple-house)')
    expect(shown.stdout).toContain('Path: Houses (houses), lesson 1 of 1')
    expect(shown.stdout).toContain('windows')
  })

  it('duplicates a lesson as a draft and lists it after the original', async () => {
    const outcome = await t.studio('lessons duplicate simple-house')
    expect(outcome.stdout).toContain('simple-house-copy')
    expect((await catalog()).paths[1].lessonIds).toEqual(['simple-house', 'simple-house-copy'])
    const copy = await t.json<{ state: string; lesson: { status: string } }>('lessons show simple-house-copy')
    expect(copy.state).toBe('workspace')
    expect(copy.lesson.status).toBe('draft')
  })

  it('sets details in the catalog and the title in the tutorial', async () => {
    const outcome = await t.studio(['lessons', 'set', 'simple-house', '--status', 'approved', '--complexity', '2', '--notes', '', '--title', 'A House'])
    expect(outcome.code).toBe(0)
    const lesson = (await catalog()).lessons.find((l) => l.id === 'simple-house')
    expect(lesson).toEqual({
      id: 'simple-house',
      status: 'approved',
      objective: 'See a house as a box with a triangle on top, then place the door, windows and chimney.',
      complexity: 2,
    })
    const stored = await t.workspace.readTutorial('simple-house')
    expect((JSON.parse(stored!.text) as Tutorial).title).toBe('A House')
    const shown = await t.json<{ state: string }>('lessons show simple-house')
    expect(shown.state).toBe('published-edited')
  })

  it('catalogues an uncatalogued lesson when given an objective, and refuses without one', async () => {
    const refused = await t.studio('lessons set cat-face --status approved')
    expect(refused.code).toBe(1)
    expect(refused.stderr).toContain('not in the curriculum yet')
    expect((await t.studio('lessons set cat-face --objective Whiskers')).code).toBe(0)
    expect((await catalog()).lessons.map((l) => l.id)).toContain('cat-face')
  })

  it('refuses a bad status or a bad complexity', async () => {
    expect((await t.studio('lessons set simple-house --status done')).code).toBe(1)
    const bad = await t.studio('lessons set simple-house --complexity 9')
    expect(bad.code).toBe(1)
    expect(bad.stderr).toContain('not valid')
  })

  it('exports, then imports as a new draft in a path', async () => {
    const file = path.join(t.root, 'house.json')
    expect((await t.studio(`lessons export simple-house --out ${file}`)).code).toBe(0)
    expect(await readFile(file, 'utf8')).toBe((await t.workspace.readTutorial('simple-house'))!.text)

    const imported = await t.studio(`lessons import ${file} --id house-two --objective Again --title Two --path houses --position 1`)
    expect(imported.code).toBe(0)
    expect((await catalog()).paths[1].lessonIds).toEqual(['house-two', 'simple-house'])
    const stored = JSON.parse((await t.workspace.readTutorial('house-two'))!.text) as Tutorial
    expect(stored.id).toBe('house-two')
    expect(stored.title).toBe('Two')

    const again = await t.studio(`lessons import ${file} --id house-two --objective Again`)
    expect(again.code).toBe(1)
    expect(again.stderr).toContain('already exists')
  })

  it('refuses to import an invalid document, naming the problem', async () => {
    const file = path.join(t.root, 'bad.json')
    await writeFile(file, JSON.stringify({ schemaVersion: 1, id: 'bad', title: 'Bad', canvas: { width: 10, height: 10 }, steps: [] }))
    const outcome = await t.studio(`lessons import ${file} --objective Bad`)
    expect(outcome.code).toBe(1)
    expect(outcome.stderr).toContain('steps')
  })

  it('validates lessons and files', async () => {
    expect((await t.studio('lessons validate simple-house')).stdout).toContain('is valid')
    const file = path.join(t.root, 'bad.json')
    await writeFile(file, '{"schemaVersion": 3}')
    const bad = await t.studio(`lessons validate ${file}`)
    expect(bad.code).toBe(1)
    expect(bad.stderr).toContain('schemaVersion')
  })

  it('approves after showing quality warnings, and can refuse on warnings', async () => {
    await t.studio('lessons duplicate simple-house')
    await t.studio(['steps', 'set', 'simple-house-copy', '1', '--title', 'New step'])
    const refused = await t.studio('lessons approve simple-house-copy --fail-on-warnings')
    expect(refused.code).toBe(1)
    expect(refused.stderr).toContain('placeholder title')
    const approved = await t.studio('lessons approve simple-house-copy')
    expect(approved.code).toBe(0)
    expect(approved.stdout).toContain('placeholder title')
    expect((await catalog()).lessons.find((l) => l.id === 'simple-house-copy')?.status).toBe('approved')
  })

  it('stores a reference image and records its source and licence', async () => {
    const file = path.join(t.root, 'photo.png')
    await writeFile(file, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))
    const outcome = await t.studio(`lessons reference set simple-house ${file} --source me --license CC0`)
    expect(outcome.code).toBe(0)
    expect((await catalog()).lessons[0].reference).toEqual({ file: 'simple-house.png', source: 'me', license: 'CC0' })
    const out = path.join(t.root, 'back.png')
    expect((await t.studio(`lessons reference export simple-house --out ${out}`)).code).toBe(0)
    expect((await readFile(out)).byteLength).toBe(12)
  })

  it('deletes a workspace draft without asking and a published lesson only with --yes', async () => {
    await t.studio('lessons duplicate simple-house')
    expect((await t.studio('lessons delete simple-house-copy')).code).toBe(0)
    const refused = await t.studio('lessons delete simple-house')
    expect(refused.code).toBe(1)
    expect(refused.stderr).toContain('published')
    expect(await t.workspace.readTutorial('simple-house')).not.toBeNull()
    const done = await t.studio('lessons delete simple-house --yes')
    expect(done.code).toBe(0)
    expect(done.stdout).toContain('shared/Tutorials/simple-house.json')
    expect(await t.workspace.readTutorial('simple-house')).toBeNull()
  })

  it('unpublishes with --yes and keeps the lesson editable', async () => {
    const done = await t.studio('lessons unpublish palm-tree-4 --yes')
    expect(done.code).toBe(0)
    expect(done.stdout).toContain('shared/Assets/References/palm-tree-4.svg')
    const shown = await t.json<{ state: string; lesson: { reference: { file: string } } }>('lessons show palm-tree-4')
    expect(shown.state).toBe('workspace')
    expect(shown.lesson.reference.file).toBe('palm-tree-4.svg')
  })
})

describe('history', () => {
  it('lists versions, shows one and brings it back', async () => {
    await t.studio(['lessons', 'set', 'simple-house', '--title', 'First'])
    await t.studio(['lessons', 'set', 'simple-house', '--title', 'Second'])
    const listed = await t.json<{ entries: { id: string; kind: string; baseline?: boolean }[] }>('history list simple-house')
    expect(listed.entries.map((e) => e.kind)).toEqual(['saved', 'saved', 'saved'])
    expect(listed.entries[2].baseline).toBe(true)

    const shown = await t.studio('history show simple-house 3')
    expect(shown.stdout).toContain('before any recorded change')

    expect((await t.studio('history use simple-house 3')).code).toBe(0)
    const stored = JSON.parse((await t.workspace.readTutorial('simple-house'))!.text) as Tutorial
    expect(stored.title).toBe('Simple House')
    const file = path.join(t.root, 'v.json')
    expect((await t.studio(`history show simple-house ${listed.entries[1].id.slice(0, 20)} --out ${file}`)).code).toBe(0)
    expect((JSON.parse(await readFile(file, 'utf8')) as Tutorial).title).toBe('First')
  })
})

describe('publishing', () => {
  it('lists pending changes, publishes a lesson and prints the git add line', async () => {
    await t.studio('lessons duplicate simple-house')
    const pending = await t.json<{ pending: { kind: string; lessonId?: string; ready?: boolean }[] }>('publish pending')
    expect(pending.pending).toContainEqual({ kind: 'new', lessonId: 'simple-house-copy', ready: false })

    const published = await t.studio('publish lessons simple-house-copy')
    expect(published.code).toBe(0)
    expect(published.stdout).toContain('git add -- shared/Tutorials/simple-house-copy.json shared/Catalog/paths.json shared/Catalog/lessons.json')
    const written = JSON.parse(await readFile(path.join(t.shared, 'Tutorials', 'simple-house-copy.json'), 'utf8')) as Tutorial
    expect(written.id).toBe('simple-house-copy')
    const sharedCatalog = JSON.parse(await readFile(path.join(t.shared, 'Catalog', 'lessons.json'), 'utf8')) as { lessons: { id: string; status: string }[] }
    expect(sharedCatalog.lessons.find((l) => l.id === 'simple-house-copy')?.status).toBe('approved')
  })

  it('publishes everything ready with `publish all`, and the curriculum alone', async () => {
    await t.studio('paths move houses --to 1')
    const nothing = await t.studio('publish all')
    expect(nothing.stdout).toContain('Published the curriculum')
    const paths = JSON.parse(await readFile(path.join(t.shared, 'Catalog', 'paths.json'), 'utf8')) as { paths: { id: string }[] }
    expect(paths.paths.map((p) => p.id)).toEqual(['houses', 'trees', 'cars'])

    await t.studio('lessons duplicate simple-house')
    await t.studio('lessons approve simple-house-copy')
    const all = await t.json<{ lessonIds: string[]; files: string[] }>('publish all')
    expect(all.lessonIds).toEqual(['simple-house-copy'])
    expect((await t.json<{ pending: unknown[] }>('publish pending')).pending).toEqual([])
  })

  it('refuses to publish while shared/Catalog changed outside, until adopted', async () => {
    const file = path.join(t.shared, 'Catalog', 'paths.json')
    await writeFile(file, (await readFile(file, 'utf8')).replace('"Trees"', '"Tall Trees"'))
    const refused = await t.studio('publish curriculum')
    expect(refused.code).toBe(1)
    expect(refused.stderr).toContain('Adopt it')
    expect((await t.studio('adopt-shared')).code).toBe(0)
    expect((await catalog()).paths[0].title).toBe('Tall Trees')
  })
})

describe('trash', () => {
  it('lists, restores, purges with confirmation and empties', async () => {
    await t.studio('lessons duplicate simple-house')
    await t.studio('lessons delete simple-house-copy')
    const listed = await t.json<{ items: { id: string; itemId: string }[] }>('trash list')
    expect(listed.items.map((i) => i.itemId)).toEqual(['simple-house-copy'])

    const refused = await t.studio('trash purge simple-house-copy')
    expect(refused.code).toBe(1)
    expect((await t.studio(`trash purge ${listed.items[0].id} --yes`)).stdout).toContain('for good')
    expect((await t.json<{ items: unknown[] }>('trash list')).items).toEqual([])

    await t.studio('lessons duplicate simple-house')
    await t.studio('lessons delete simple-house-copy')
    expect((await t.studio('trash empty')).code).toBe(1)
    expect((await t.studio('trash empty --yes')).stdout).toContain('1 item deleted')
  })

  it('takes a typed confirmation at a terminal', async () => {
    await t.studio('lessons duplicate simple-house')
    await t.studio('lessons delete simple-house-copy')
    const wrong = await t.studio('trash empty', { io: { isTTY: true, ask: async () => 'no' } })
    expect(wrong.code).toBe(1)
    expect(wrong.stderr).toContain('Not confirmed')
    const right = await t.studio('trash empty', { io: { isTTY: true, ask: async () => 'empty' } })
    expect(right.code).toBe(0)
  })
})
