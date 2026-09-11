import lessonsSource from '@shared/Catalog/lessons.json?raw'
import pathsSource from '@shared/Catalog/paths.json?raw'

import { SAMPLES } from '../samples'

import type { LibrarySources } from './sources'

// Imported only when there is no Studio server, so these files never enter the
// dev server's module graph.
const referenceUrls = import.meta.glob<string>('@shared/Assets/References/*', {
  query: '?url',
  import: 'default',
  eager: true,
})

/** `shared/` as it was when the Studio was built. Nothing can be saved from here. */
export function bundledSources(): LibrarySources {
  return {
    tutorials: SAMPLES.map((sample) => ({ fileName: sample.fileName, text: sample.source })),
    paths: { text: pathsSource },
    lessons: { text: lessonsSource },
    references: Object.entries(referenceUrls).map(([path, url]) => ({
      file: path.slice(path.lastIndexOf('/') + 1),
      url,
    })),
    writable: false,
  }
}
