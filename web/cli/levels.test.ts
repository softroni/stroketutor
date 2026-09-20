import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Catalog } from '../src/catalog/types'
import type { Tutorial } from '../src/schema/types'

import { openTestStudio, type TestStudio } from './testing'

/** The real curriculum plan, which the creator applies to the real workspace. */
const PLAN = fileURLToPath(new URL('../../docs/curriculum/plan.json', import.meta.url))

let t: TestStudio

beforeEach(async () => {
  t = await openTestStudio()
})

afterEach(async () => {
  await t.close()
})

/** The newest catalog entry, which is where a planned lesson lands. */
const lastLesson = (current: Catalog) => current.lessons[current.lessons.length - 1]

async function catalog(): Promise<Catalog> {
  const { paths, lessons } = await t.workspace.readCatalog()
  const file = JSON.parse(paths.text)
  return { levels: file.levels ?? [], paths: file.paths, lessons: JSON.parse(lessons.text).lessons }
}

describe('levels', () => {
  it('creates, renames, describes, reorders and deletes levels', async () => {
    expect((await t.studio('levels create starter --title Starter --description Flat')).code).toBe(0)
    expect((await t.studio(['levels', 'create', '--title', 'Core Skills'])).stdout).toContain('(core-skills)')
    expect((await t.studio('levels rename starter Beginnings')).code).toBe(0)
    expect((await t.studio(['levels', 'describe', 'starter', ''])).stdout).toContain('Removed the description')
    expect((await t.studio('levels move starter --to 2')).stdout).toContain('now level 2 of 2')
    expect((await t.studio('levels move starter --up')).stdout).toContain('now level 1 of 2')

    const { levels } = await catalog()
    expect(levels).toEqual([{ id: 'starter', title: 'Beginnings' }, { id: 'core-skills', title: 'Core Skills' }])
    expect((await t.studio('levels list')).stdout).toContain('Beginnings')

    expect((await t.studio('levels delete core-skills')).code).toBe(0)
    expect((await catalog()).levels.map((level) => level.id)).toEqual(['starter'])
  })

  it('refuses a duplicate level id, and deleting one that still groups paths', async () => {
    await t.studio('levels create starter --title Starter')
    const duplicate = await t.studio('levels create starter --title Again')
    expect(duplicate.code).toBe(1)
    expect(duplicate.stderr).toContain('already a level')

    await t.studio('paths level trees starter')
    const refused = await t.studio('levels delete starter')
    expect(refused.code).toBe(1)
    expect(refused.stderr).toContain('still groups 1 path')
  })

  it('groups a path under a level, shows it, and takes it out again', async () => {
    await t.studio('levels create starter --title Starter')
    expect((await t.studio('paths level trees starter')).stdout).toContain('now in the level "starter"')
    expect((await catalog()).paths[0]).toEqual({ id: 'trees', title: 'Trees', level: 'starter', lessonIds: ['palm-tree-4'] })
    expect((await t.studio('paths list')).stdout).toContain('starter')
    expect((await t.studio('paths show trees')).stdout).toContain('Level: Starter (starter)')
    expect((await t.studio('paths level trees --none')).stdout).toContain('in no level')
    expect((await catalog()).paths[0].level).toBeUndefined()

    const created = await t.studio('paths create boats --title Boats --level starter')
    expect(created.stdout).toContain('in the level "starter"')
    const missing = await t.studio('paths create ships --title Ships --level nope')
    expect(missing.code).toBe(1)
    expect(missing.stderr).toContain('no level "nope"')
  })
})

describe('planned lessons', () => {
  const plan = ['lessons', 'plan', 'sun', '--title', 'Sun', '--objective', 'Circle and rays', '--path', 'trees']

  it('plans a lesson, lists it, shows it and counts it apart in status', async () => {
    expect((await t.studio([...plan, '--position', '1'])).stdout).toContain('as lesson 1 in "trees"')
    expect((await catalog()).paths[0].lessonIds).toEqual(['sun', 'palm-tree-4'])
    expect(lastLesson(await catalog())).toEqual({
      id: 'sun',
      title: 'Sun',
      status: 'planned',
      objective: 'Circle and rays',
    })

    const listed = await t.json<{ lessons: { id: string; status: string; state: string; steps: number | null }[] }>(
      'lessons list --status planned',
    )
    expect(listed.lessons).toEqual([
      expect.objectContaining({ id: 'sun', status: 'planned', state: 'planned', steps: null }),
    ])
    expect((await t.studio('lessons list --status planned')).stdout).toContain('planned  planned  trees #1  -')

    const shown = await t.studio('lessons show sun')
    expect(shown.stdout).toContain('Sun (sun), planned')
    expect(shown.stdout).toContain('Path: Trees (trees), lesson 1 of 2')
    expect(shown.stdout).toContain('No tutorial yet.')

    const status = await t.studio('status')
    expect(status.stdout).toContain('5 lessons: 1 planned,')
    expect(status.stdout).not.toContain('sun: new')
  })

  it('refuses a planned lesson to every command that needs a drawing', async () => {
    await t.studio(plan)
    for (const command of ['lessons duplicate sun', 'lessons unpublish sun --yes', 'steps list sun', 'history list sun']) {
      const outcome = await t.studio(command)
      expect(outcome.code, command).toBe(1)
      expect(outcome.stderr, command).toContain('planned lesson')
    }
    const published = await t.studio('publish lessons sun')
    expect(published.code).toBe(1)
    expect(published.stderr).toContain('nothing has been drawn for it yet')
  })

  it('rewords a planned lesson, deletes it to the trash and restores it in its place', async () => {
    await t.studio(plan)
    expect((await t.studio(['lessons', 'set', 'sun', '--title', 'The Sun', '--objective', 'Eight rays'])).code).toBe(0)
    expect(lastLesson(await catalog())).toEqual({
      id: 'sun',
      title: 'The Sun',
      status: 'planned',
      objective: 'Eight rays',
    })
    const refused = await t.studio('lessons set sun --status approved')
    expect(refused.code).toBe(1)

    expect((await t.studio('lessons delete sun')).stdout).toContain('planned lesson sun to the trash')
    expect((await catalog()).paths[0].lessonIds).toEqual(['palm-tree-4'])
    const trash = await t.json<{ items: { itemId: string; title: string }[] }>('trash list')
    expect(trash.items).toEqual([expect.objectContaining({ itemId: 'sun', title: 'The Sun' })])
    expect((await t.studio('trash restore sun')).stdout).toContain('Restored the lesson sun')
    expect((await catalog()).paths[0].lessonIds).toEqual(['palm-tree-4', 'sun'])
  })

  it('trashes a path with its planned lessons, and restores it whole', async () => {
    await t.studio(plan)
    expect((await t.studio('paths delete trees --lessons trash --yes')).code).toBe(0)
    const trash = await t.json<{ items: { itemId: string }[] }>('trash list')
    expect(trash.items.map((item) => item.itemId).sort()).toEqual(['palm-tree-4', 'sun', 'trees'])
  })

  it('fills a planned lesson from an imported tutorial, in the place it was holding', async () => {
    await t.studio([...plan, '--position', '1'])
    const file = path.join(t.root, 'sun.json')
    await t.studio(`lessons export simple-house --out ${file}`)
    const source = JSON.parse(await readFile(file, 'utf8')) as Tutorial
    await writeFile(file, JSON.stringify({ ...source, id: 'sun', title: 'Sun' }))

    // The planned entry supplies the objective and the path, so neither is passed.
    const filled = await t.studio(`lessons import ${file} --id sun`)
    expect(filled.code).toBe(0)
    expect(filled.stdout).toContain('Filled the planned lesson sun')
    const after = await catalog()
    expect(after.paths[0].lessonIds).toEqual(['sun', 'palm-tree-4'])
    expect(after.lessons.find((lesson) => lesson.id === 'sun')).toEqual({
      id: 'sun',
      status: 'draft',
      objective: 'Circle and rays',
    })
    const shown = await t.json<{ state: string }>('lessons show sun')
    expect(shown.state).toBe('workspace')
  })

  it('refuses to fill a planned lesson into a path other than its own', async () => {
    await t.studio(plan)
    const file = path.join(t.root, 'sun.json')
    await t.studio(`lessons export simple-house --out ${file}`)
    const outcome = await t.studio(`lessons import ${file} --id sun --path houses`)
    expect(outcome.code).toBe(1)
    expect(outcome.stderr).toContain('planned in "trees"')
  })
})

describe('curriculum apply', () => {
  it('lays the real plan over the curriculum, and changes nothing the second time', async () => {
    const dry = await t.studio(`curriculum apply ${PLAN} --dry-run`)
    expect(dry.stdout).toContain('130 lessons planned')
    expect(dry.stdout).toContain('Nothing was changed')
    expect((await catalog()).levels).toEqual([])

    const applied = await t.studio(`curriculum apply ${PLAN}`)
    expect(applied.code).toBe(0)
    expect(applied.stdout).toContain('3 levels created: starter, core, advanced')
    const after = await catalog()
    expect(after.levels.map((level) => level.id)).toEqual(['starter', 'core', 'advanced'])
    expect(after.lessons.filter((lesson) => lesson.status === 'planned')).toHaveLength(130)
    // The fixture's two drawn lessons move to the paths the plan gives them.
    expect(after.paths.find((p) => p.id === 'plants')?.lessonIds).toContain('palm-tree-4')
    expect(after.paths.find((p) => p.id === 'wheels')?.lessonIds).toContain('classic-red-car')

    const status = await t.studio('status')
    expect(status.stdout).toContain('134 lessons: 130 planned,')
    expect(status.stdout).toContain('3 levels group the paths')
    // 130 places held are not 130 things waiting to be published.
    expect(status.stdout).toContain('To publish (1 ready):')

    const again = await t.studio(`curriculum apply ${PLAN}`)
    expect(again.stdout).toContain('already applied')
  })

  it('publishes levels into shared/Catalog, and never a planned lesson', async () => {
    await t.studio(`curriculum apply ${PLAN}`)
    expect((await t.studio('publish curriculum')).code).toBe(0)
    const written = JSON.parse(await readFile(path.join(t.shared, 'Catalog', 'paths.json'), 'utf8')) as {
      levels?: { id: string }[]
      paths: { id: string; level?: string; lessonIds: string[] }[]
    }
    // Only the level that still has a published path under it is written.
    expect(written.levels?.map((level) => level.id)).toEqual(['core'])
    expect(written.paths.map((p) => [p.id, p.level])).toEqual([
      ['plants', 'core'],
      ['wheels', 'core'],
      ['houses', undefined],
    ])
    const lessons = JSON.parse(await readFile(path.join(t.shared, 'Catalog', 'lessons.json'), 'utf8')) as {
      lessons: { id: string; status: string }[]
    }
    expect(lessons.lessons.some((lesson) => lesson.status === 'planned')).toBe(false)
  })

  it('refuses a plan that is not JSON, and one that is not a curriculum', async () => {
    const file = path.join(t.root, 'plan.json')
    await writeFile(file, '{ oops')
    expect((await t.studio(`curriculum apply ${file}`)).stderr).toContain('not valid JSON')
    await writeFile(file, JSON.stringify({ paths: [{ id: 'Sky', title: 'Sky', lessons: [] }] }))
    expect((await t.studio(`curriculum apply ${file}`)).stderr).toContain('is not an id')
    expect((await t.studio('curriculum apply nowhere.json')).stderr).toContain('Could not read')
  })
})
