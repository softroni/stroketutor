import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { GenerateDeps } from '../server/generate'
import { createRepoWriter } from '../server/repoWriter'
import { openWorkspace, type Workspace } from '../server/workspaceStore'
import { validateCatalog } from '../src/catalog/validate'
import { validateTutorial } from '../src/schema/validate'

import type { BrowserBridge } from './bridge'
import { run } from './main'
import type { IO } from './output'

/**
 * A Studio for tests: a scratch copy of the real `shared/` and an in-memory
 * workspace, the same fixture the server tests use, with every command run
 * in-process and its output captured.
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

const realShared = fileURLToPath(new URL('../../shared/', import.meta.url))

export async function openTestStudio(options: { generation?: Partial<GenerateDeps>; browser?: BrowserBridge } = {}): Promise<TestStudio> {
  const root = await mkdtemp(path.join(tmpdir(), 'stroketutor-cli-'))
  const shared = path.join(root, 'shared')
  for (const folder of ['Tutorials', 'Catalog', 'Assets']) {
    await cp(path.join(realShared, folder), path.join(shared, folder), { recursive: true })
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
