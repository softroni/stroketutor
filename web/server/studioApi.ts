import type { ServerResponse } from 'node:http'

import type { Connect, Plugin, ViteDevServer } from 'vite'

import { GenerationFailed, generateCandidate, type GenerateDeps } from './generate'
import { generateFromTrace } from './generateFromTrace'
import { listVisionModels } from './models'
import { regenerate } from './regenerate'
import {
  MAX_REFERENCE_BYTES,
  REFERENCE_RESPONSE_HEADERS,
  WriteRefused,
  createRepoWriter,
  type Precondition,
  type RepoWriterOptions,
} from './repoWriter'

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
  /** From OPENROUTER_API_KEY. Kept in this process; never sent to the browser. */
  openRouterKey?: string
  /** From OPENROUTER_MODEL, used when the Studio names no model. */
  defaultModel?: string
}

/**
 * The Studio's local server (master plan §25): a few JSON endpoints under
 * `/api`, mounted on the Vite dev server and nowhere else. A production build
 * has no server, and the Studio falls back to its bundled, read-only copy.
 *
 * - `GET  /api/library`             every tutorial, both catalog files, photo list
 * - `GET  /api/tutorials/:id`       one tutorial as stored, with its etag
 * - `PUT  /api/tutorials/:id`       `{ tutorial, etag }` → validated, atomic write
 * - `GET  /api/catalog`             both catalog files with their etags
 * - `PUT  /api/catalog`             `{ paths, lessons, etags }`
 * - `GET  /api/references/:file`    a reference photo
 * - `PUT  /api/references/:lesson`  the photo's bytes, typed by Content-Type
 * - `GET  /api/settings`            whether an OpenRouter key is configured (never the key)
 * - `GET  /api/models`              models that take images and honour structured output
 * - `POST /api/generate`            one lesson candidate from a photo and a goal; writes nothing
 * - `POST /api/generate-from-trace` one lesson from a traced SVG: the model orders its lines and colours
 * - `POST /api/regenerate`          one layer of an existing lesson: drawing, order, steps or instructions; writes nothing
 */
export function studioApi(options: StudioApiOptions): Plugin {
  return {
    name: 'stroketutor-studio-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api', (req, res) => {
        handle(server, options, req, res).catch((error: unknown) => {
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
  req: Connect.IncomingMessage,
  res: ServerResponse,
) {
  const method = req.method ?? 'GET'
  const url = new URL(req.url ?? '/', 'http://studio.invalid')
  const parts = url.pathname.split('/').filter(Boolean).map(safeDecode)

  try {
    if (parts.some((part) => part === null)) throw new WriteRefused(400, 'The request path is malformed.')
    const [resource, name] = parts as string[]

    if (method !== 'GET' && (req.headers[STUDIO_HEADER] !== '1' || !sameOrigin(req))) {
      throw new WriteRefused(403, 'Writes are only accepted from the Studio itself.')
    }

    if (resource === 'settings' && parts.length === 1 && method === 'GET') {
      return send(res, 200, {
        keyConfigured: Boolean(options.openRouterKey),
        defaultModel: options.defaultModel ?? null,
      })
    }

    if (resource === 'models' && parts.length === 1 && method === 'GET') {
      return send(res, 200, { models: await listVisionModels() })
    }

    const checks = await validators(server)
    const writer = createRepoWriter({ sharedDir: options.sharedDir, ...checks })

    const generation: GenerateDeps = {
      apiKey: options.openRouterKey,
      defaultModel: options.defaultModel,
      library: () => writer.readLibrary(),
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
      return send(res, 200, await writer.readLibrary())
    }

    if (resource === 'tutorials' && parts.length === 2) {
      if (method === 'GET') {
        const stored = await writer.readTutorial(name)
        return stored ? send(res, 200, stored) : send(res, 404, { error: `There is no ${name}.json.` })
      }
      if (method === 'PUT') {
        const body = await readJSON(req, MAX_JSON_BYTES)
        return send(res, 200, await writer.writeTutorial(name, body.tutorial, preconditionOf(body.etag)))
      }
    }

    if (resource === 'catalog' && parts.length === 1) {
      if (method === 'GET') return send(res, 200, await writer.readCatalog())
      if (method === 'PUT') {
        const body = await readJSON(req, MAX_JSON_BYTES)
        const etags = (body.etags ?? {}) as Record<string, unknown>
        return send(
          res,
          200,
          await writer.writeCatalog(body.paths, body.lessons, {
            paths: preconditionOf(etags.paths),
            lessons: preconditionOf(etags.lessons),
          }),
        )
      }
    }

    if (resource === 'references' && parts.length === 2) {
      if (method === 'GET') {
        const photo = await writer.readReference(name)
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
        return send(res, 200, await writer.writeReference(name, type, bytes))
      }
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
