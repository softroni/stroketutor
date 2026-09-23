import type { ServerResponse } from 'node:http'

import type { Connect, Plugin, ViteDevServer } from 'vite'

import { GenerationFailed, generateCandidate, type GenerateDeps } from './generate'
import { generateFromTrace } from './generateFromTrace'
import { listVisionModels } from './models'
import { regenerate } from './regenerate'
import { gitIn, releaseLesson } from './release'
import {
  MAX_REFERENCE_BYTES,
  REFERENCE_RESPONSE_HEADERS,
  WriteRefused,
  createRepoWriter,
  type Precondition,
  type RepoWriter,
  type RepoWriterOptions,
} from './repoWriter'
import {
  adoptKeptReferences,
  adoptPublishedVoice,
  appLines,
  applySpokenLines,
  castVoice,
  createVoice,
  deletePublishedAppLines,
  deletePublishedVoice,
  deleteVoice,
  freezeVoice,
  lessonNarration,
  narrateAppLine,
  narrateStep,
  publishAppLines,
  publishVoice,
  readTakeAudio,
  say,
  setAppLine,
  setNarrationLine,
  setScript,
  unfreezeVoice,
  updateVoice,
  voiceState,
  writeSpokenLines,
  type VoiceDeps,
} from './voice'
import { openWorkspace, type Workspace } from './workspaceStore'

/**
 * Every writing or spending request must carry this header. A page on another
 * origin cannot add it without a CORS preflight, which Vite's dev server
 * refuses for foreign origins, so a stray website cannot write into the
 * repository or spend OpenRouter credits.
 */
export const STUDIO_HEADER = 'x-stroketutor-studio'

const MAX_JSON_BYTES = 2 * 1024 * 1024
/** A generation request carries the photo as base64, a third larger than the file. */
const MAX_GENERATE_BYTES = Math.ceil((MAX_REFERENCE_BYTES * 4) / 3) + 64 * 1024

/** SVG generation also carries the traced drawing: a few hundred path strings at most. */
const MAX_TRACE_GENERATE_BYTES = MAX_GENERATE_BYTES + 4 * 1024 * 1024

/** Regenerating a layer carries the lesson, a picture of it and the reference, or a fresh trace. */
const MAX_REGENERATE_BYTES = MAX_TRACE_GENERATE_BYTES + MAX_GENERATE_BYTES + MAX_JSON_BYTES

export interface StudioApiOptions {
  sharedDir: string
  /** The workspace's SQLite file, outside git. */
  workspaceFile: string
  /** Where the workspace's daily copies go. */
  backupDir?: string
  /** From OPENROUTER_API_KEY. Kept in this process; never sent to the browser. */
  openRouterKey?: string
  /** From OPENROUTER_MODEL, used when the Studio names no model. */
  defaultModel?: string
  /** The creator's own speech server, from STUDIO_TTS_URL. */
  ttsUrl?: string
  /** Its MCP endpoint, from STUDIO_TTS_MCP_URL, where references are uploaded and health is read. */
  ttsMcpUrl?: string
}

/** Where Lina's voice is made when nothing says otherwise: the creator's Mac, on their tailnet. */
export const DEFAULT_TTS_URL = 'https://m4-1.tail958ea4.ts.net'
export const DEFAULT_TTS_MCP_URL = 'https://m4-1.tail958ea4.ts.net:8443/mcp'

/**
 * The Studio's local server (master plan §25): a few JSON endpoints under
 * `/api`, mounted on the Vite dev server and nowhere else. A production build
 * has no server, and the Studio falls back to its bundled, read-only copy.
 *
 * Authoring reads and writes the workspace (`workspaceStore.ts`); only
 * publishing and unpublishing write `shared/`.
 *
 * - `GET  /api/library`                   the working library, and what publishing would change
 * - `GET  /api/tutorials/:id`             one lesson as it stands, with its etag
 * - `PUT  /api/tutorials/:id`             `{ tutorial, etag }` → validated, saved in the workspace
 * - `GET  /api/catalog`                   the working curriculum with its etags
 * - `PUT  /api/catalog`                   `{ paths, lessons, etags }`
 * - `GET  /api/references/:file`          a reference photo, from the workspace or shared/
 * - `PUT  /api/references/:lesson`        the photo's bytes, typed by Content-Type, into the workspace
 * - `GET|POST /api/history/:lesson`       every recorded version of a lesson / record a generated one
 * - `POST /api/publish`                   `{ lessonIds }` → writes them, and the curriculum, into shared/
 * - `POST /api/release/:lesson`           the lesson page's Publish: the lesson, its voice, a commit, and a push to main
 * - `POST /api/unpublish/:lesson`         takes a lesson out of shared/, keeping it in the workspace
 * - `POST /api/lessons/:lesson/duplicate` a copy as a new draft
 * - `DELETE /api/lessons/:lesson`         to the trash (unpublished first)
 * - `DELETE /api/paths/:path?lessons=unfile|trash`
 * - `GET /api/trash` · `POST /api/trash/:id/restore` · `DELETE /api/trash/:id` · `DELETE /api/trash`
 * - `POST /api/adopt-shared`              take shared/Catalog as it now is
 * - `GET  /api/settings`                  whether an OpenRouter key is configured (never the key), and the voice server's address
 * - `GET  /api/models`                    models that take images and honour structured output
 * - `POST /api/generate`                  one lesson candidate from a photo and a goal; writes nothing
 * - `POST /api/generate-from-trace`       one lesson from a traced SVG: the model orders its lines and colours
 * - `POST /api/regenerate`                one layer of an existing lesson; writes nothing
 *
 * Casting Lina and narrating lessons in her voice (`server/voice.ts`):
 *
 * - `GET  /api/voice`                     the candidates, the script, every take, and the speech server probed live
 * - `PUT  /api/voice/script`              `{ lines }` → the audition script
 * - `POST /api/voice/voices`              a candidate from `{ name, engine, speaker?, instruct?, tagline? }`
 * - `PUT|DELETE /api/voice/voices/:id`    change one, or remove it with its takes (`?force=1` when a lesson uses it)
 * - `POST /api/voice/cast`                `{ voiceId }` → the voice cast as Lina
 * - `POST /api/voice/voices/:id/say`      `{ text, another? }` → one take, reused unless `another`
 * - `GET  /api/voice/takes/:id`           a take's audio (WAV)
 * - `POST /api/voice/voices/:id/freeze`   `{ takeId }` → uploads it as a reference, so the voice stops varying
 * - `POST /api/voice/voices/:id/unfreeze` lets it vary again
 * - `GET  /api/voice/lessons/:lesson`     a lesson's steps, their recordings and what has gone stale
 * - `PUT  /api/voice/lessons/:lesson/lines/:step`  `{ text }` → a spoken line instead of the instruction
 * - `PUT  /api/voice/lessons/:lesson/lines`        `{ lines }` → every spoken line at once, from a plan
 * - `POST /api/voice/lessons/:lesson/lines/generate` `{ model?, note?, overwrite? }` → a model writes them
 * - `POST /api/voice/lessons/:lesson/narrate`      `{ stepId, another? }` → records one step
 * - `POST /api/voice/lessons/:lesson/publish`      the AAC files and the manifest into shared/Assets/Voice/
 * - `DELETE /api/voice/lessons/:lesson/published`  takes them out again
 * - `GET  /api/voice/app`                 Lina's own lines (onboarding, the eight completions, the paths welcome) and their recordings
 * - `PUT  /api/voice/app/lines/:id`       `{ text }` → the words of one app line; the id is fixed
 * - `POST /api/voice/app/narrate`         `{ id, another? }` → records one app line
 * - `POST /api/voice/app/publish`         the AAC files and the manifest into shared/Assets/Voice/app/
 * - `DELETE /api/voice/app/published`     takes them out again
 */
export function studioApi(options: StudioApiOptions): Plugin {
  let opening: Promise<{ workspace: Workspace; writer: RepoWriter }> | null = null
  const studioFor = (server: ViteDevServer) => {
    opening ??= (async () => {
      const checks = await validators(server)
      const writer = createRepoWriter({ sharedDir: options.sharedDir, ...checks })
      const workspace = await openWorkspace({
        file: options.workspaceFile,
        backupDir: options.backupDir,
        writer,
        ...checks,
      })
      await workspace.backup().catch((error: unknown) => {
        server.config.logger.warn(`[studio] the daily workspace backup failed: ${String(error)}`)
      })
      server.httpServer?.once('close', () => workspace.close())
      return { workspace, writer }
    })()
    opening.catch(() => {
      opening = null
    })
    return opening
  }

  return {
    name: 'stroketutor-studio-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api', (req, res) => {
        handle(server, options, studioFor, req, res).catch((error: unknown) => {
          server.config.logger.error(
            `[studio api] ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
          )
          if (!res.headersSent) {
            send(res, 500, { error: 'The Studio server hit an unexpected error. See the dev server log.' })
          }
        })
      })
    },
  }
}

async function validators(server: ViteDevServer) {
  // Loaded through Vite so the validators resolve `@shared/…` exactly as they
  // do in the browser: the server checks documents with the Studio's own
  // code, not a copy of it.
  const [schema, catalog] = await Promise.all([
    server.ssrLoadModule('/src/schema/validate.ts'),
    server.ssrLoadModule('/src/catalog/validate.ts'),
  ])
  return {
    validateTutorial: schema.validateTutorial as RepoWriterOptions['validateTutorial'],
    validateCatalog: catalog.validateCatalog as RepoWriterOptions['validateCatalog'],
  }
}

async function handle(
  server: ViteDevServer,
  options: StudioApiOptions,
  studioFor: (server: ViteDevServer) => Promise<{ workspace: Workspace; writer: RepoWriter }>,
  req: Connect.IncomingMessage,
  res: ServerResponse,
) {
  const method = req.method ?? 'GET'
  const url = new URL(req.url ?? '/', 'http://studio.invalid')
  const parts = url.pathname.split('/').filter(Boolean).map(safeDecode)

  try {
    if (parts.some((part) => part === null)) throw new WriteRefused(400, 'The request path is malformed.')
    const segments = parts as string[]
    const [resource, name, action] = segments

    if (method !== 'GET' && (req.headers[STUDIO_HEADER] !== '1' || !sameOrigin(req))) {
      throw new WriteRefused(403, 'Writes are only accepted from the Studio itself.')
    }

    if (resource === 'settings' && parts.length === 1 && method === 'GET') {
      return send(res, 200, {
        keyConfigured: Boolean(options.openRouterKey),
        defaultModel: options.defaultModel ?? null,
        ttsUrl: options.ttsUrl ?? DEFAULT_TTS_URL,
      })
    }

    if (resource === 'models' && parts.length === 1 && method === 'GET') {
      return send(res, 200, { models: await listVisionModels() })
    }

    const { workspace, writer } = await studioFor(server)
    const checks = await validators(server)

    const generation: GenerateDeps = {
      apiKey: options.openRouterKey,
      defaultModel: options.defaultModel,
      // Drafts count: a new lesson's context and id checks see the whole working curriculum.
      library: () => workspace.readLibrary(),
      validateTutorial: checks.validateTutorial,
    }

    if (resource === 'generate' && parts.length === 1 && method === 'POST') {
      const body = await readJSON(req, MAX_GENERATE_BYTES)
      return send(res, 200, await generateCandidate(body, generation))
    }

    if (resource === 'generate-from-trace' && parts.length === 1 && method === 'POST') {
      const body = await readJSON(req, MAX_TRACE_GENERATE_BYTES)
      return send(res, 200, await generateFromTrace(body, generation))
    }

    if (resource === 'regenerate' && parts.length === 1 && method === 'POST') {
      const body = await readJSON(req, MAX_REGENERATE_BYTES)
      return send(res, 200, await regenerate(body, generation))
    }

    if (resource === 'library' && parts.length === 1 && method === 'GET') {
      return send(res, 200, await workspace.readLibrary())
    }

    if (resource === 'tutorials' && parts.length === 2) {
      if (method === 'GET') {
        const stored = await workspace.readTutorial(name)
        return stored ? send(res, 200, stored) : send(res, 404, { error: `There is no lesson ${name}.` })
      }
      if (method === 'PUT') {
        const body = await readJSON(req, MAX_JSON_BYTES)
        return send(
          res,
          200,
          await workspace.writeTutorial(name, body.tutorial, preconditionOf(body.etag), {
            checkpoint: body.checkpoint !== false,
          }),
        )
      }
    }

    if (resource === 'history' && parts.length === 2) {
      if (method === 'GET') return send(res, 200, { entries: await workspace.readHistory(name) })
      if (method === 'POST') {
        const body = await readJSON(req, MAX_JSON_BYTES)
        return send(res, 200, await workspace.appendHistory(name, body))
      }
    }

    if (resource === 'catalog' && parts.length === 1) {
      if (method === 'GET') return send(res, 200, await workspace.readCatalog())
      if (method === 'PUT') {
        const body = await readJSON(req, MAX_JSON_BYTES)
        const etags = (body.etags ?? {}) as Record<string, unknown>
        return send(
          res,
          200,
          await workspace.writeCatalog(body.paths, body.lessons, {
            paths: preconditionOf(etags.paths),
            lessons: preconditionOf(etags.lessons),
          }),
        )
      }
    }

    if (resource === 'references' && parts.length === 2) {
      if (method === 'GET') {
        const photo = await workspace.readReference(name)
        if (!photo) return send(res, 404, { error: `There is no reference photo ${name}.` })
        res.writeHead(200, {
          'Content-Type': photo.contentType,
          'Cache-Control': 'no-cache',
          ...REFERENCE_RESPONSE_HEADERS,
        })
        return res.end(photo.bytes)
      }
      if (method === 'PUT') {
        const bytes = await readBody(req, MAX_REFERENCE_BYTES + 1)
        const type = String(req.headers['content-type'] ?? '')
        return send(res, 200, await workspace.writeReference(name, type, bytes))
      }
    }

    if (resource === 'publish' && parts.length === 1 && method === 'POST') {
      const body = await readJSON(req, MAX_JSON_BYTES)
      const lessonIds = body.lessonIds
      if (!Array.isArray(lessonIds) || !lessonIds.every((id) => typeof id === 'string')) {
        throw new WriteRefused(400, '`lessonIds` must be a list of lesson ids.')
      }
      return send(res, 200, await workspace.publish(lessonIds))
    }

    if (resource === 'unpublish' && parts.length === 2 && method === 'POST') {
      return send(res, 200, await workspace.unpublish(name))
    }

    if (resource === 'lessons' && parts.length === 3 && action === 'duplicate' && method === 'POST') {
      return send(res, 200, await workspace.duplicate(name))
    }

    if (resource === 'lessons' && parts.length === 2 && method === 'DELETE') {
      return send(res, 200, await workspace.deleteLesson(name))
    }

    if (resource === 'paths' && parts.length === 2 && method === 'DELETE') {
      const lessons = url.searchParams.get('lessons')
      if (lessons !== 'unfile' && lessons !== 'trash') {
        throw new WriteRefused(400, 'Say what happens to the path’s lessons: ?lessons=unfile or ?lessons=trash.')
      }
      return send(res, 200, await workspace.deletePath(name, lessons))
    }

    if (resource === 'trash') {
      if (parts.length === 1 && method === 'GET') return send(res, 200, { items: workspace.listTrash() })
      if (parts.length === 1 && method === 'DELETE') {
        await workspace.emptyTrash()
        return send(res, 200, { items: [] })
      }
      if (parts.length === 3 && action === 'restore' && method === 'POST') {
        return send(res, 200, await workspace.restore(name))
      }
      if (parts.length === 2 && method === 'DELETE') {
        await workspace.purge(name)
        return send(res, 200, { items: workspace.listTrash() })
      }
    }

    if (resource === 'adopt-shared' && parts.length === 1 && method === 'POST') {
      await workspace.adoptShared()
      return send(res, 200, { ok: true })
    }

    if (resource === 'release' && parts.length === 2 && method === 'POST') {
      const voice: VoiceDeps = {
        workspace,
        writer,
        tts: { url: options.ttsUrl ?? DEFAULT_TTS_URL, mcpUrl: options.ttsMcpUrl ?? DEFAULT_TTS_MCP_URL },
        generation,
      }
      await adoptKeptReferences(voice)
      await adoptPublishedVoice(voice)
      // Released files are named from the repository's root (`shared/…`), so git runs there.
      const root = await gitIn(options.sharedDir)(['rev-parse', '--show-toplevel']).then(
        (out) => out.trim(),
        () => null,
      )
      return send(res, 200, await releaseLesson(name, voice, root ? gitIn(root) : null))
    }

    if (resource === 'voice') {
      const voice: VoiceDeps = {
        workspace,
        writer,
        tts: { url: options.ttsUrl ?? DEFAULT_TTS_URL, mcpUrl: options.ttsMcpUrl ?? DEFAULT_TTS_MCP_URL },
        // Writing spoken lines is a generation like any other, and the key
        // stays in this process exactly as it does for the lesson prompts.
        generation,
      }
      // A freeze lives in shared/, so a clone or a pull is all it takes to change
      // which recording Lina is cloned from; every request looks before it acts.
      await adoptKeptReferences(voice)
      await adoptPublishedVoice(voice)
      const handled = await handleVoice(segments.slice(1), method, url, req, res, voice)
      if (handled) return
    }

    return send(res, 404, { error: `There is no Studio endpoint ${method} /api${url.pathname}.` })
  } catch (error) {
    if (error instanceof WriteRefused) {
      return send(res, error.status, { error: error.message, issues: error.issues })
    }
    if (error instanceof GenerationFailed) {
      return send(res, error.status, { error: error.message, detail: error.detail })
    }
    throw error
  }
}

/**
 * Everything under `/api/voice`, kept apart because these paths go four and
 * five segments deep and would drown the table above. `parts` is the path after
 * `voice`. Returns false when nothing matched, so the caller can answer 404 in
 * the one place it always does.
 */
async function handleVoice(
  parts: string[],
  method: string,
  url: URL,
  req: Connect.IncomingMessage,
  res: ServerResponse,
  deps: VoiceDeps,
): Promise<boolean> {
  const [group, name, action, second] = parts

  if (parts.length === 0 && method === 'GET') {
    send(res, 200, await voiceState(deps))
    return true
  }

  if (group === 'script' && parts.length === 1 && method === 'PUT') {
    const body = await readJSON(req, MAX_JSON_BYTES)
    send(res, 200, setScript(body.lines, deps))
    return true
  }

  if (group === 'cast' && parts.length === 1 && method === 'POST') {
    const body = await readJSON(req, MAX_JSON_BYTES)
    send(res, 200, castVoice(body.voiceId ?? null, deps))
    return true
  }

  if (group === 'voices') {
    if (parts.length === 1 && method === 'POST') {
      send(res, 200, createVoice(await readJSON(req, MAX_JSON_BYTES), deps))
      return true
    }
    if (parts.length === 2 && method === 'PUT') {
      send(res, 200, updateVoice(name, await readJSON(req, MAX_JSON_BYTES), deps))
      return true
    }
    if (parts.length === 2 && method === 'DELETE') {
      send(res, 200, await deleteVoice(name, { force: url.searchParams.get('force') === '1' }, deps))
      return true
    }
    if (parts.length === 3 && action === 'say' && method === 'POST') {
      const body = await readJSON(req, MAX_JSON_BYTES)
      send(res, 200, await say(name, body.text, { another: body.another === true }, deps))
      return true
    }
    if (parts.length === 3 && action === 'freeze' && method === 'POST') {
      const body = await readJSON(req, MAX_JSON_BYTES)
      send(res, 200, await freezeVoice(name, body.takeId, deps))
      return true
    }
    if (parts.length === 3 && action === 'unfreeze' && method === 'POST') {
      send(res, 200, await unfreezeVoice(name, deps))
      return true
    }
  }

  // `app` is Lina's own lines: fixed ids, no lesson behind them, so they sit
  // beside `lessons` rather than under it.
  if (group === 'app') {
    if (parts.length === 1 && method === 'GET') {
      send(res, 200, await appLines(deps))
      return true
    }
    if (parts.length === 3 && name === 'lines' && method === 'PUT') {
      const body = await readJSON(req, MAX_JSON_BYTES)
      send(res, 200, await setAppLine(action, body.text, deps))
      return true
    }
    if (parts.length === 2 && name === 'narrate' && method === 'POST') {
      const body = await readJSON(req, MAX_JSON_BYTES)
      send(res, 200, await narrateAppLine(body.id, { another: body.another === true }, deps))
      return true
    }
    if (parts.length === 2 && name === 'publish' && method === 'POST') {
      send(res, 200, await publishAppLines(deps))
      return true
    }
    if (parts.length === 2 && name === 'published' && method === 'DELETE') {
      send(res, 200, await deletePublishedAppLines(deps))
      return true
    }
  }

  if (group === 'takes' && parts.length === 2 && method === 'GET') {
    const audio = readTakeAudio(name, deps)
    if (!audio) {
      send(res, 404, { error: `There is no take ${name}.` })
      return true
    }
    // A take never changes: its id is minted when it is recorded, so it can be
    // cached until the browser forgets it.
    res.writeHead(200, {
      'Content-Type': audio.contentType,
      'Content-Length': String(audio.bytes.byteLength),
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    })
    res.end(audio.bytes)
    return true
  }

  if (group === 'lessons' && name) {
    if (parts.length === 2 && method === 'GET') {
      send(res, 200, await lessonNarration(name, deps))
      return true
    }
    if (parts.length === 4 && action === 'lines' && second === 'generate' && method === 'POST') {
      const body = await readJSON(req, MAX_JSON_BYTES)
      send(res, 200, await writeSpokenLines(name, body, deps))
      return true
    }
    if (parts.length === 4 && action === 'lines' && method === 'PUT') {
      const body = await readJSON(req, MAX_JSON_BYTES)
      send(res, 200, await setNarrationLine(name, second, body.text ?? null, deps))
      return true
    }
    if (parts.length === 3 && action === 'lines' && method === 'PUT') {
      const body = await readJSON(req, MAX_JSON_BYTES)
      send(res, 200, await applySpokenLines(name, body, deps))
      return true
    }
    if (parts.length === 3 && action === 'narrate' && method === 'POST') {
      send(res, 200, await narrateStep(name, await readJSON(req, MAX_JSON_BYTES), deps))
      return true
    }
    if (parts.length === 3 && action === 'publish' && method === 'POST') {
      send(res, 200, await publishVoice(name, deps))
      return true
    }
    if (parts.length === 3 && action === 'published' && method === 'DELETE') {
      send(res, 200, await deletePublishedVoice(name, deps))
      return true
    }
  }

  return false
}

function preconditionOf(value: unknown): Precondition {
  if (typeof value === 'string') return { etag: value }
  if (value === null) return { etag: null }
  return undefined
}

/** Browsers send `Origin` on cross-origin and on non-GET requests; it must be us. */
function sameOrigin(req: Connect.IncomingMessage): boolean {
  const origin = req.headers.origin
  if (!origin) return true
  try {
    return new URL(origin).host === req.headers.host
  } catch {
    return false
  }
}

async function readBody(req: Connect.IncomingMessage, limit: number): Promise<Uint8Array> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.byteLength
    if (size > limit) throw new WriteRefused(413, 'The request is too large.')
    chunks.push(buffer)
  }
  return new Uint8Array(Buffer.concat(chunks))
}

async function readJSON(req: Connect.IncomingMessage, limit: number): Promise<Record<string, unknown>> {
  const text = new TextDecoder().decode(await readBody(req, limit))
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw new WriteRefused(400, 'The request body is not valid JSON.')
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new WriteRefused(400, 'The request body must be a JSON object.')
  }
  return body as Record<string, unknown>
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

function safeDecode(part: string): string | null {
  try {
    return decodeURIComponent(part)
  } catch {
    return null
  }
}
