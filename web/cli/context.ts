import path from 'node:path'

import type { ViteDevServer } from 'vite'

import type { GenerateDeps } from '../server/generate'
import { createRepoWriter, type RepoWriter } from '../server/repoWriter'
import { DEFAULT_TTS_MCP_URL, DEFAULT_TTS_URL } from '../server/studioApi'
import type { TtsDeps } from '../server/tts'
import type { VoiceDeps } from '../server/voice'
import { openWorkspace, type Workspace } from '../server/workspaceStore'
import { validateCatalog } from '../src/catalog/validate'
import { validateTutorial } from '../src/schema/validate'
import { buildLibrary, type Library } from '../src/studio/library'

import type { GlobalFlags } from './args'
import type { BrowserBridge } from './bridge'
import { Reporter, terminalIO, type IO } from './output'

/** What `studio.mjs` (or a test) hands to `run`. */
export interface RunOptions {
  /** `web/.env.local` and the process environment, as Vite reads them. */
  env: Record<string, string | undefined>
  webDir: string
  sharedDir: string
  /** The Vite instance the command line runs under; the browser bridge serves the tracer through it. */
  vite?: ViteDevServer
  /** Tests: an open workspace to use instead of the file. */
  workspace?: Workspace
  /** Tests: a fake model (`fetch`) or key. */
  generation?: Partial<GenerateDeps>
  /** Tests: a fake speech server, and a converter that needs no afconvert. */
  tts?: Partial<TtsDeps>
  /** Tests: a fake browser. */
  browser?: BrowserBridge
  io?: IO
}

/**
 * Everything a command needs: the workspace (opened on first use, so
 * `svg optimize` never touches it), the validators, the generation
 * dependencies the Studio server would assemble, the browser bridge, and
 * where output goes.
 */
export interface Context {
  flags: GlobalFlags
  out: Reporter
  env: RunOptions['env']
  sharedDir: string
  workspaceFile: string
  backupDir: string | undefined
  validateTutorial: typeof validateTutorial
  validateCatalog: typeof validateCatalog
  workspace(): Promise<Workspace>
  /** The working library, validated as the Studio validates it at start-up. */
  library(): Promise<Library>
  generation(): Promise<GenerateDeps>
  /** Everything `server/voice.ts` needs: the workspace, `shared/` and the speech server. */
  voice(): Promise<VoiceDeps>
  browser(): Promise<BrowserBridge>
  close(): Promise<void>
}

export function createContext(flags: GlobalFlags, options: RunOptions): Context {
  const io = options.io ?? terminalIO
  const out = new Reporter(io, flags.json, flags.quiet)
  const sharedDir = path.resolve(flags.shared ?? options.sharedDir)
  const studioDir = path.resolve(options.webDir, '..', '.studio')
  const workspaceFile = path.resolve(flags.workspace ?? options.env.STUDIO_WORKSPACE ?? path.join(studioDir, 'workspace.sqlite'))
  const backupDir = options.workspace ? undefined : path.join(studioDir, 'backups')

  let opening: Promise<Workspace> | null = options.workspace ? Promise.resolve(options.workspace) : null
  let ownsWorkspace = false
  let bridge: Promise<BrowserBridge> | null = options.browser ? Promise.resolve(options.browser) : null
  // The one writer the workspace publishes through, which voice commands publish through too.
  const writer: RepoWriter = createRepoWriter({ sharedDir, validateTutorial, validateCatalog })

  const workspace = () => {
    opening ??= (async () => {
      const opened = await openWorkspace({ file: workspaceFile, writer, validateTutorial, validateCatalog, backupDir })
      ownsWorkspace = true
      // The same daily safety net the Studio server keeps; a failure is worth a line, not a stop.
      await opened.backup().catch((error: unknown) => out.warn(`The daily workspace backup failed: ${String(error)}`))
      return opened
    })()
    return opening
  }

  const generation = async (): Promise<GenerateDeps> => {
    const store = await workspace()
    return {
      apiKey: options.env.OPENROUTER_API_KEY || undefined,
      defaultModel: flags.model || options.env.OPENROUTER_MODEL || undefined,
      library: () => store.readLibrary(),
      validateTutorial,
      ...options.generation,
    }
  }

  return {
    flags,
    out,
    env: options.env,
    sharedDir,
    workspaceFile,
    backupDir,
    validateTutorial,
    validateCatalog,
    workspace,
    async library() {
      const store = await workspace()
      return buildLibrary({ ...(await store.readLibrary()), writable: true })
    },
    generation,
    async voice() {
      // Writing spoken lines is a generation, so the voice deps carry the same
      // key and model choice every other generation command uses.
      return {
        workspace: await workspace(),
        writer,
        tts: {
          url: options.env.STUDIO_TTS_URL || DEFAULT_TTS_URL,
          mcpUrl: options.env.STUDIO_TTS_MCP_URL || DEFAULT_TTS_MCP_URL,
          ...options.tts,
        },
        generation: await generation(),
      }
    },
    browser() {
      bridge ??= import('./browser').then(({ openBrowser }) => openBrowser(options.vite))
      return bridge
    },
    async close() {
      if (bridge) await (await bridge).close().catch(() => undefined)
      if (opening && ownsWorkspace) (await opening).close()
    },
  }
}
