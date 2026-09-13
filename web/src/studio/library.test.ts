import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { FIXTURE_SHARED } from '../../test/fixture'

import { buildLibrary } from './library'
import type { LibrarySources } from './sources'

/** A `shared/` folder as the Studio server would serve it. */
function fromDisk(sharedDir: string): LibrarySources {
  const read = (file: string) => readFileSync(`${sharedDir}${file}`, 'utf8')
  return {
    tutorials: readdirSync(`${sharedDir}Tutorials`)
      .filter((name) => name.endsWith('.json'))
      .map((fileName) => ({ fileName, text: read(`Tutorials/${fileName}`), etag: `etag-${fileName}` })),
    paths: { text: read('Catalog/paths.json'), etag: 'etag-paths' },
    lessons: { text: read('Catalog/lessons.json'), etag: 'etag-lessons' },
    references: existsSync(`${sharedDir}Assets/References`)
      ? readdirSync(`${sharedDir}Assets/References`).map((file) => ({ file, url: `/api/references/${file}` }))
      : [],
    writable: true,
  }
}

/** The frozen fixture: a catalog that does not move, for the behaviour of `buildLibrary` itself. */
const fromFixture = () => fromDisk(FIXTURE_SHARED)

describe('buildLibrary', () => {
  // The one test about the content the app actually ships. The creator adds, retires and redraws
  // lessons, so it asserts only what must hold for any catalog they publish — never a lesson, a
  // path or a step count, which would make a curriculum edit look like a broken build.
  it('builds the shipped library with no problems', () => {
    const shippedDir = fileURLToPath(new URL('../../../shared/', import.meta.url))
    const library = buildLibrary(fromDisk(shippedDir))

    expect(library.broken).toEqual([])
    expect(library.catalogIssues).toEqual([])
    expect(library.catalog?.paths.length).toBeGreaterThan(0)
    // Every lesson in a path is in the catalog, and every catalogued lesson has a tutorial to play.
    const catalogued = library.catalog?.lessons.map((lesson) => lesson.id) ?? []
    for (const path of library.catalog?.paths ?? []) {
      expect(catalogued).toEqual(expect.arrayContaining(path.lessonIds))
    }
    for (const id of catalogued) {
      expect(library.tutorials.get(id)?.etag).toBe(`etag-${id}.json`)
    }
    expect(library.catalogEtags).toEqual({ paths: 'etag-paths', lessons: 'etag-lessons' })
  })

  it('refuses a tutorial whose id does not match its file name', () => {
    const sources = fromFixture()
    sources.tutorials.push({ fileName: 'copy.json', text: readFileSync(`${FIXTURE_SHARED}Tutorials/cat-face.json`, 'utf8') })
    const library = buildLibrary(sources)
    expect(library.tutorials.has('copy')).toBe(false)
    expect(library.broken.map((file) => [file.fileName, file.issues[0].path])).toEqual([
      ['copy.json', 'id'],
    ])
  })

  it('keeps invalid tutorials out and says why', () => {
    const sources = fromFixture()
    sources.tutorials.push({ fileName: 'bad.json', text: '{ "schemaVersion": 1 }' })
    expect(buildLibrary(sources).broken.map((file) => file.fileName)).toEqual(['bad.json'])
  })

  it('reports a catalog that cannot be read instead of throwing', () => {
    const sources = fromFixture()
    sources.lessons = { text: '{ not json' }
    const library = buildLibrary(sources)
    expect(library.catalog).toBeNull()
    expect(library.catalogIssues[0]).toMatchObject({ file: 'lessons.json', path: '(root)' })
  })

  it('offers every file, valid or not, to Import & test', () => {
    const sources = fromFixture()
    sources.tutorials.push({ fileName: 'bad.json', text: '{}' })
    expect(buildLibrary(sources).samples.map((sample) => sample.fileName)).toContain('bad.json')
  })
})
