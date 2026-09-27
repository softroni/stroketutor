import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { neighbour, plainTitle } from '../src/studio/screenshots'

import { listScreenshots, readScreenshot } from './screenshots'

describe('the Screenshots page', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'studio-screenshots-'))
    mkdirSync(path.join(dir, 'out', 'iphone'), { recursive: true })
    writeFileSync(
      path.join(dir, 'shots.js'),
      `export const DEVICES = { iphone: { width: 1320, height: 2868 }, ipad: { width: 2064, height: 2752 } }
       export const SHOTS = [
         { id: 'learn', title: 'Learn to draw<br><em>step by step</em>' },
         { id: 'paths', title: 'Draw what<br><em>you love</em>' },
       ]`,
    )
    for (const name of ['02-paths.png', '01-learn.png', 'notes.txt', '1-bad.png']) {
      writeFileSync(path.join(dir, 'out', 'iphone', name), 'png')
    }
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('lists each device in listing order, with plain headlines and addresses that change with the file', async () => {
    const list = await listScreenshots(dir)
    const iphone = list.sets.find((set) => set.device === 'iphone')!
    expect(iphone.shots.map((shot) => [shot.number, shot.id, shot.title])).toEqual([
      ['01', 'learn', 'Learn to draw step by step'],
      ['02', 'paths', 'Draw what you love'],
    ])
    expect(iphone.shots[0].url).toMatch(/^\/api\/screenshots\/iphone\/01-learn\.png\?v=\d+$/)
    expect([iphone.width, iphone.height]).toEqual([1320, 2868])
    expect(list.sets.find((set) => set.device === 'ipad')!.shots).toEqual([])
    expect(list.updated).toBeGreaterThan(0)
  })

  it('still lists the files when shots.js cannot be read', async () => {
    writeFileSync(path.join(dir, 'shots.js'), 'this is not javascript (')
    const list = await listScreenshots(dir)
    expect(list.sets[0].shots.map((shot) => shot.title)).toEqual(['learn', 'paths'])
  })

  it('serves only screenshots', async () => {
    expect(await readScreenshot(dir, 'iphone', '01-learn.png')).not.toBeNull()
    expect(await readScreenshot(dir, 'iphone', '../shots.js')).toBeNull()
    expect(await readScreenshot(dir, 'watch', '01-learn.png')).toBeNull()
    expect(await readScreenshot(dir, 'iphone', 'notes.txt')).toBeNull()
  })

  it('steps round the set in both directions', () => {
    const shots = ['a', 'b', 'c'].map((id, i) => ({ number: `0${i + 1}`, id, title: id, url: '', updated: 0 }))
    expect(neighbour(shots, 'c', 1)?.id).toBe('a')
    expect(neighbour(shots, 'a', -1)?.id).toBe('c')
    expect(neighbour([], 'a', 1)).toBeNull()
    expect(plainTitle('Keep every<br/><em>drawing</em>')).toBe('Keep every drawing')
  })
})
