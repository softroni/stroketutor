import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { GenerateDeps } from '../server/generate'
import { createRepoWriter } from '../server/repoWriter'
import type { TtsDeps } from '../server/tts'
import { openWorkspace, type Workspace } from '../server/workspaceStore'
import { validateCatalog } from '../src/catalog/validate'
import { validateTutorial } from '../src/schema/validate'
import type { TracedDrawing } from '../src/trace/traceSvg'
import { FIXTURE_SHARED } from '../test/fixture'

import type { BrowserBridge } from './bridge'
import { run } from './main'
import type { IO } from './output'

/**
 * A Studio for tests: a scratch copy of the frozen `shared/` in
 * `test/fixtures/` and an in-memory workspace, the same fixture the server
 * tests use, with every command run in-process and its output captured.
 */
export interface TestStudio {
  root: string
  shared: string
  workspace: Workspace
  /** Runs one command line. `argv` is split on spaces unless given as an array. */
  studio(argv: string | string[], extra?: { yes?: boolean; io?: Partial<IO> }): Promise<Outcome>
  /** Runs with `--json` and parses stdout. */
  json<T = Record<string, unknown>>(argv: string | string[]): Promise<T>
  close(): Promise<void>
}

export interface Outcome {
  code: number
  stdout: string
  stderr: string
}

export async function openTestStudio(
  options: { generation?: Partial<GenerateDeps>; browser?: BrowserBridge; tts?: Partial<TtsDeps> } = {},
): Promise<TestStudio> {
  const root = await mkdtemp(path.join(tmpdir(), 'stroketutor-cli-'))
  const shared = path.join(root, 'shared')
  for (const folder of ['Tutorials', 'Catalog', 'Assets']) {
    await cp(path.join(FIXTURE_SHARED, folder), path.join(shared, folder), { recursive: true })
  }
  const writer = createRepoWriter({ sharedDir: shared, validateTutorial, validateCatalog })
  const workspace = await openWorkspace({ file: ':memory:', writer, validateTutorial, validateCatalog })

  const studio = async (argv: string | string[], extra: { yes?: boolean; io?: Partial<IO> } = {}): Promise<Outcome> => {
    const args = Array.isArray(argv) ? argv : argv.split(' ').filter(Boolean)
    let stdout = ''
    let stderr = ''
    const io: IO = {
      write: (text) => {
        stdout += text
      },
      writeError: (text) => {
        stderr += text
      },
      isTTY: false,
      ...extra.io,
    }
    const code = await run([...args, ...(extra.yes ? ['--yes'] : [])], {
      env: { OPENROUTER_API_KEY: options.generation?.apiKey, OPENROUTER_MODEL: options.generation?.defaultModel },
      webDir: fileURLToPath(new URL('../', import.meta.url)),
      sharedDir: shared,
      workspace,
      generation: options.generation,
      tts: options.tts,
      browser: options.browser,
      io,
    })
    return { code, stdout, stderr }
  }

  return {
    root,
    shared,
    workspace,
    studio,
    async json<T>(argv: string | string[]) {
      const args = Array.isArray(argv) ? argv : argv.split(' ').filter(Boolean)
      const outcome = await studio([...args, '--json'])
      try {
        return JSON.parse(outcome.stdout) as T
      } catch {
        throw new Error(`Not JSON (exit ${outcome.code}): ${outcome.stdout}\n${outcome.stderr}`)
      }
    },
    async close() {
      workspace.close()
      await rm(root, { recursive: true, force: true })
    },
  }
}

/** The first bytes of a PNG, enough for `sniffImage` and for a test to recognise. */
export const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])

const line = (id: string, d: string) => ({ id, d, lineWidth: 6, color: undefined, length: 200, box: [100, 100, 300, 300] as [number, number, number, number], closed: false, origin: 'outline' as const })

/** A traced square: three lines and two colours, as `generateFromTrace.test.ts` uses. */
export const squareTrace = (): TracedDrawing => ({
  canvas: { width: 1000, height: 1000 },
  strokes: [line('s1', 'M 100 100 L 300 100'), line('s2', 'M 100 100 L 100 300'), line('s3', 'M 300 100 L 300 300')],
  fills: [
    { id: 'f1', d: 'M 100 100 L 300 100 L 300 300 L 100 300 Z', color: '#E8C872', area: 40000, box: [100, 100, 300, 300] },
    { id: 'f2', d: 'M 150 150 L 250 150 L 250 250 L 150 250 Z', color: '#1F3A5F', area: 10000, box: [150, 150, 250, 250] },
  ],
  notes: ['Traced for the test.'],
  outlineCoverage: 1,
})

export interface FakeBrowser extends BrowserBridge {
  /** How many SVGs were traced. */
  traced: number
  /** The SVG text of every picture rendered, in order. */
  rendered: string[]
  /** The longest edge asked for with each picture, in order. */
  sizes: number[]
}

/** A browser that traces every SVG to the square and renders every picture to the tiny PNG, recording what it was given. */
export function fakeBrowser(): FakeBrowser {
  const bridge: FakeBrowser = {
    traced: 0,
    rendered: [],
    sizes: [],
    async trace() {
      bridge.traced += 1
      return squareTrace()
    },
    async renderPng(svgText, longestEdge) {
      bridge.rendered.push(svgText)
      bridge.sizes.push(longestEdge)
      return PNG_BYTES.toString('base64')
    },
    async drawingPng() {
      return PNG_BYTES.toString('base64')
    },
    async optimize() {
      throw new Error('not in these tests')
    },
    async fromImage() {
      throw new Error('not in these tests')
    },
    async close() {},
  }
  return bridge
}
