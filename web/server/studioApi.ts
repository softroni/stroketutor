import type { ServerResponse } from 'node:http'

import type { Connect, Plugin, ViteDevServer } from 'vite'

import {
  MAX_REFERENCE_BYTES,
  WriteRefused,
  createRepoWriter,
  type Precondition,
  type RepoWriterOptions,
} from './repoWriter'

/**
 * Every writing request must carry this header. A page on another origin
 * cannot add it without a CORS preflight, which Vite's dev server refuses for
 * foreign origins, so a stray website cannot write into the repository.
 */
export const STUDIO_HEADER = 'x-stroketutor-studio'

const MAX_JSON_BYTES = 2 * 1024 * 1024

/**
 * The Studio's local server (master plan §25): a few JSON endpoints under
 * `/api`, mounted on the Vite dev server and nowhere else. A production build
 * has no writer, and the Studio falls back to its bundled, read-only copy.
 *
 * - `GET  /api/library`             every tutorial, both catalog files, photo list
 * - `GET  /api/tutorials/:id`       one tutorial as stored, with its etag
 * - `PUT  /api/tutorials/:id`       `{ tutorial, etag }` → validated, atomic write
 * - `GET  /api/catalog`             both catalog files with their etags
 * - `PUT  /api/catalog`             `{ paths, lessons, etags }`
 * - `GET  /api/references/:file`    a reference photo
 * - `PUT  /api/references/:lesson`  the photo's bytes, typed by Content-Type
 */
export function studioApi(options: { sharedDir: string }): Plugin {
  return {
    name: 'stroketutor-studio-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api', (req, res) => {
        handle(server, options.sharedDir, req, res).catch((error: unknown) => {
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

async function writerFor(server: ViteDevServer, sharedDir: string) {
  // Loaded through Vite so the validators resolve `@shared/…` exactly as they
  // do in the browser: the server checks documents with the Studio's own
  // code, not a copy of it.
  const [schema, catalog] = await Promise.all([
    server.ssrLoadModule('/src/schema/validate.ts'),
    server.ssrLoadModule('/src/catalog/validate.ts'),
  ])
  return createRepoWriter({
    sharedDir,
    validateTutorial: schema.validateTutorial as RepoWriterOptions['validateTutorial'],
    validateCatalog: catalog.validateCatalog as RepoWriterOptions['validateCatalog'],
  })
}

async function handle(
  server: ViteDevServer,
  sharedDir: string,
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

    const writer = await writerFor(server, sharedDir)

    if (resource === 'library' && parts.length === 1 && method === 'GET') {
      return send(res, 200, await writer.readLibrary())
    }

    if (resource === 'tutorials' && parts.length === 2) {
      if (method === 'GET') {
        const stored = await writer.readTutorial(name)
        return stored ? send(res, 200, stored) : send(res, 404, { error: `There is no ${name}.json.` })
      }
      if (method === 'PUT') {
        const body = await readJSON(req)
        return send(res, 200, await writer.writeTutorial(name, body.tutorial, preconditionOf(body.etag)))
      }
    }

    if (resource === 'catalog' && parts.length === 1) {
      if (method === 'GET') return send(res, 200, await writer.readCatalog())
      if (method === 'PUT') {
        const body = await readJSON(req)
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
        res.writeHead(200, { 'Content-Type': photo.contentType, 'Cache-Control': 'no-cache' })
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

async function readJSON(req: Connect.IncomingMessage): Promise<Record<string, unknown>> {
  const text = new TextDecoder().decode(await readBody(req, MAX_JSON_BYTES))
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
