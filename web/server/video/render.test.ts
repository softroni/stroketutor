import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { latestVideo, openingOfVideo, videoFile } from './render'

describe('the videos’ files', () => {
  let videosDir: string

  beforeEach(() => {
    videosDir = mkdtempSync(path.join(tmpdir(), 'studio-videos-'))
  })

  afterEach(() => rmSync(videosDir, { recursive: true, force: true }))

  it('keep the names the classic opening always had, and give the hook its own', () => {
    const name = (options: Parameters<typeof videoFile>[2]) => path.basename(videoFile('rocket', { videosDir }, options))
    expect(name(undefined)).toBe('rocket.mp4')
    expect(name({ opening: 'classic' })).toBe('rocket.mp4')
    expect(name({ speed: true })).toBe('rocket-speed.mp4')
    expect(name({ opening: 'hook' })).toBe('rocket-hook.mp4')
    expect(name({ speed: true, opening: 'hook' })).toBe('rocket-speed-hook.mp4')
    expect(path.dirname(videoFile('rocket', { videosDir }, { opening: 'hook' }))).toBe(videosDir)
  })

  it('say which opening a video has, so one is never posted as the other', () => {
    for (const speed of [false, true]) {
      for (const opening of ['classic', 'hook'] as const) expect(openingOfVideo(videoFile('pine-tree', { videosDir }, { speed, opening }), 'pine-tree')).toBe(opening)
    }
    // Any other name says nothing, nor does another lesson's video.
    expect(openingOfVideo('/tmp/clip.mp4', 'pine-tree')).toBeNull()
    expect(openingOfVideo('/tmp/pine-tree-test.mp4', 'pine-tree')).toBeNull()
    expect(openingOfVideo(videoFile('pine', { videosDir }, { opening: 'hook' }), 'pine-tree')).toBeNull()
    expect(openingOfVideo(videoFile('pine-tree', { videosDir }), 'pine')).toBeNull()
  })

  it('find the lesson’s last whole video, of either opening', async () => {
    expect(await latestVideo('donut', { videosDir })).toBeNull()
    const made = (file: string, at: number) => {
      writeFileSync(file, 'video')
      utimesSync(file, at, at)
    }
    made(videoFile('donut', { videosDir }), 1_000_000)
    expect(await latestVideo('donut', { videosDir })).toMatchObject({ file: videoFile('donut', { videosDir }), opening: 'classic', bytes: 5 })
    made(videoFile('donut', { videosDir }, { opening: 'hook' }), 2_000_000)
    // A speed draw is not the lesson's video.
    made(videoFile('donut', { videosDir }, { speed: true }), 3_000_000)
    expect(await latestVideo('donut', { videosDir })).toMatchObject({ file: videoFile('donut', { videosDir }, { opening: 'hook' }), opening: 'hook' })
  })
})
