import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { buildLibrary } from './library'
import type { LibrarySources } from './sources'

const sharedDir = fileURLToPath(new URL('../../../shared/', import.meta.url))
const read = (file: string) => readFileSync(`${sharedDir}${file}`, 'utf8')

/** `shared/` as the Studio server would serve it. */
function fromDisk(): LibrarySources {
  return {
    tutorials: readdirSync(`${sharedDir}Tutorials`)
      .filter((name) => name.endsWith('.json'))
      .map((fileName) => ({ fileName, text: read(`Tutorials/${fileName}`), etag: `etag-${fileName}` })),
    paths: { text: read('Catalog/paths.json'), etag: 'etag-paths' },
    lessons: { text: read('Catalog/lessons.json'), etag: 'etag-lessons' },
    references: [],
    writable: true,
  }
}

describe('buildLibrary', () => {
  it('builds the shipped library with no problems', () => {
    const library = buildLibrary(fromDisk())
    expect([...library.tutorials.keys()].sort()).toEqual(['cat-face', 'simple-house'])
    expect(library.broken).toEqual([])
    expect(library.catalogIssues).toEqual([])
    expect(library.catalog?.paths.map((path) => path.id)).toEqual(['houses'])
    expect(library.tutorials.get('simple-house')?.etag).toBe('etag-simple-house.json')
    expect(library.catalogEtags).toEqual({ paths: 'etag-paths', lessons: 'etag-lessons' })
  })

  it('refuses a tutorial whose id does not match its file name', () => {
    const sources = fromDisk()
    sources.tutorials.push({ fileName: 'copy.json', text: read('Tutorials/cat-face.json') })
    const library = buildLibrary(sources)
    expect(library.tutorials.has('copy')).toBe(false)
    expect(library.broken.map((file) => [file.fileName, file.issues[0].path])).toEqual([
      ['copy.json', 'id'],
    ])
  })

  it('keeps invalid tutorials out and says why', () => {
    const sources = fromDisk()
    sources.tutorials.push({ fileName: 'bad.json', text: '{ "schemaVersion": 1 }' })
    expect(buildLibrary(sources).broken.map((file) => file.fileName)).toEqual(['bad.json'])
  })

  it('reports a catalog that cannot be read instead of throwing', () => {
    const sources = fromDisk()
    sources.lessons = { text: '{ not json' }
    const library = buildLibrary(sources)
    expect(library.catalog).toBeNull()
    expect(library.catalogIssues[0]).toMatchObject({ file: 'lessons.json', path: '(root)' })
  })

  it('offers every file, valid or not, to Import & test', () => {
    const sources = fromDisk()
    sources.tutorials.push({ fileName: 'bad.json', text: '{}' })
    expect(buildLibrary(sources).samples.map((sample) => sample.fileName)).toContain('bad.json')
  })
})
