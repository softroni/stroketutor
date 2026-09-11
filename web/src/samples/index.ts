import { parseTutorialJSON } from '../schema/validate'
import type { Tutorial } from '../schema/types'

// Imported as raw text, not as parsed JSON, so the bundled samples travel the
// exact same code path as a pasted or dropped file. If a golden file ever drifts
// out of schema, it fails here loudly instead of being trusted implicitly.
//
// These are the same files the iOS app bundles -- not copies of them.
import catFaceSource from '@shared/Tutorials/cat-face.json?raw'
import simpleHouseSource from '@shared/Tutorials/simple-house.json?raw'

export interface Sample {
  /** File name, shown in the source list and used as the loaded document label. */
  fileName: string
  source: string
}

export const SAMPLES: Sample[] = [
  { fileName: 'simple-house.json', source: simpleHouseSource },
  { fileName: 'cat-face.json', source: catFaceSource },
]

/**
 * Parses a bundled sample.
 *
 * These are golden files shared byte-for-byte with the iOS app, so a failure
 * here is a bug in the player or in the schema, not in the content — hence the
 * throw rather than a UI error path.
 */
export function loadSample(fileName: string): Tutorial {
  const sample = SAMPLES.find((candidate) => candidate.fileName === fileName)
  if (!sample) throw new Error(`No bundled sample named ${fileName}`)

  const result = parseTutorialJSON(sample.source)
  if (!result.ok) {
    const detail = result.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')
    throw new Error(`Bundled sample ${fileName} is invalid: ${detail}`)
  }
  return result.tutorial
}

export const DEFAULT_SAMPLE = 'simple-house.json'
