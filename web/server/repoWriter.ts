import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { formatJSON } from '../src/schema/formatJSON'

/**
 * The only code in the Studio that touches disk (master plan §25).
 *
 * Every read and write stays under `shared/`, in one of three folders, at a
 * file name the server derives from a validated id — the browser never
 * supplies a path. Documents are strictly validated before they are written,
 * written atomically, and never written over a file that changed on disk since
 * the Studio read it.
 */

export const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Same rule as `reference.file` in `catalog.schema.json`. */
export const REFERENCE_FILE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*\.(jpg|jpeg|png|webp|svg)$/

export type ImageExtension = 'jpg' | 'png' | 'webp' | 'svg'

/** Pixel formats, which are also the ones a model can be sent (see `generate.ts`). */
export const RASTER_TYPES: Record<string, Exclude<ImageExtension, 'svg'>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export const REFERENCE_TYPES: Record<string, ImageExtension> = {
  ...RASTER_TYPES,
  'image/svg+xml': 'svg',
}

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  svg: 'image/svg+xml',
}

/**
 * Served with every reference image. An SVG opened on its own is a document
 * on the Studio's origin, where the write endpoints live; `sandbox` gives it
 * an opaque origin and `default-src 'none'` stops it running or fetching
 * anything, whatever got past `svgProblem`.
 */
export const REFERENCE_RESPONSE_HEADERS = {
  'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
  'X-Content-Type-Options': 'nosniff',
}

export const MAX_REFERENCE_BYTES = 8 * 1024 * 1024

export interface Issue {
  path: string
  message: string
  value?: unknown
}

export type Verdict = { ok: true } | { ok: false; issues: Issue[] }

export interface CatalogContext {
  tutorialIds: ReadonlySet<string>
  referenceFiles?: ReadonlySet<string>
}

export interface RepoWriterOptions {
  /** The repository's `shared/` directory. Nothing outside it is ever touched. */
  sharedDir: string
  /** The same strict validators the Studio runs, injected so both sides agree. */
  validateTutorial: (data: unknown) => Verdict
  validateCatalog: (paths: unknown, lessons: unknown, context: CatalogContext) => Verdict
}

/** A refused request: an HTTP status, a sentence, and any validation issues. */
export class WriteRefused extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues: Issue[] = [],
  ) {
    super(message)
    this.name = 'WriteRefused'
  }
}

/**
 * What the client believes is on disk: the `etag` of the version it read, or
 * `null` when it believes there is no file yet.
 */
export type Precondition = { etag: string | null } | undefined

export interface Stored {
  text: string
  etag: string
}

/** Everything the Studio reads at start-up, straight from disk. */
export interface LibrarySnapshot {
  tutorials: (Stored & { fileName: string })[]
  paths: Stored | null
  lessons: Stored | null
  references: { file: string; url: string }[]
}

export function etagOf(content: string | Uint8Array): string {
  return createHash('sha256').update(content).digest('hex')
}

export type RepoWriter = ReturnType<typeof createRepoWriter>

export function createRepoWriter(options: RepoWriterOptions) {
  const shared = path.resolve(options.sharedDir)
  const tutorialsDir = inside(shared, 'Tutorials')
  const catalogDir = inside(shared, 'Catalog')
  const referencesDir = inside(shared, 'Assets', 'References')
  const pathsFile = inside(catalogDir, 'paths.json')
  const lessonsFile = inside(catalogDir, 'lessons.json')

  const tutorialFile = (id: string) => inside(tutorialsDir, `${checkId(id)}.json`)

  async function tutorialFileNames(): Promise<string[]> {
    return (await readdir(tutorialsDir)).filter((name) => name.endsWith('.json')).sort()
  }

  async function referenceFiles(): Promise<string[]> {
    try {
      return (await readdir(referencesDir)).filter((name) => REFERENCE_FILE_PATTERN.test(name)).sort()
    } catch (error) {
      if (isMissing(error)) return []
      throw error
    }
  }

  async function readCatalog() {
    return { paths: await readStored(pathsFile), lessons: await readStored(lessonsFile) }
  }

  return {
    async readLibrary(): Promise<LibrarySnapshot> {
      const tutorials = await Promise.all(
        (await tutorialFileNames()).map(async (fileName) => {
          const stored = await readStored(inside(tutorialsDir, fileName))
          return { fileName, text: stored?.text ?? '', etag: stored?.etag ?? '' }
        }),
      )
      const references = await Promise.all(
        (await referenceFiles()).map(async (file) => {
          // The version in the URL makes a replaced photo show up immediately.
          const version = etagOf(await readFile(inside(referencesDir, file))).slice(0, 12)
          return { file, url: `/api/references/${file}?v=${version}` }
        }),
      )
      return { tutorials, ...(await readCatalog()), references }
    },

    async readTutorial(id: string): Promise<Stored | null> {
      return readStored(tutorialFile(id))
    },

    async writeTutorial(id: string, data: unknown, precondition: Precondition) {
      const file = tutorialFile(id)
      const verdict = options.validateTutorial(data)
      if (!verdict.ok) {
        throw new WriteRefused(422, 'The tutorial is not valid, so it was not saved.', verdict.issues)
      }
      const documentId = (data as { id?: unknown }).id
      if (documentId !== id) {
        throw new WriteRefused(422, `The tutorial's id must be "${id}" to be saved as ${id}.json.`, [
          { path: 'id', message: `Must be "${id}".`, value: documentId },
        ])
      }

      const current = await readStored(file)
      checkPrecondition(`shared/Tutorials/${id}.json`, current, precondition)
      const text = formatJSON(data)
      await atomicWrite(file, text)
      return { file: `shared/Tutorials/${id}.json`, etag: etagOf(text), created: current === null }
    },

    readCatalog,

    async writeCatalog(
      paths: unknown,
      lessons: unknown,
      precondition: { paths?: Precondition; lessons?: Precondition } = {},
    ) {
      const verdict = options.validateCatalog(paths, lessons, {
        tutorialIds: new Set((await tutorialFileNames()).map((name) => name.slice(0, -5))),
        referenceFiles: new Set(await referenceFiles()),
      })
      if (!verdict.ok) {
        throw new WriteRefused(422, 'The catalog is not valid, so it was not saved.', verdict.issues)
      }

      // Both preconditions are checked before either file is written.
      const current = await readCatalog()
      checkPrecondition('shared/Catalog/paths.json', current.paths, precondition.paths)
      checkPrecondition('shared/Catalog/lessons.json', current.lessons, precondition.lessons)

      const pathsText = formatJSON(paths)
      const lessonsText = formatJSON(lessons)
      await atomicWrite(pathsFile, pathsText)
      await atomicWrite(lessonsFile, lessonsText)
      return { paths: { etag: etagOf(pathsText) }, lessons: { etag: etagOf(lessonsText) } }
    },

    async readReference(file: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
      if (!REFERENCE_FILE_PATTERN.test(file)) {
        throw new WriteRefused(400, `"${file}" is not a reference photo name.`)
      }
      try {
        const bytes = await readFile(inside(referencesDir, file))
        return { bytes, contentType: CONTENT_TYPES[file.slice(file.lastIndexOf('.') + 1)] }
      } catch (error) {
        if (isMissing(error)) return null
        throw error
      }
    },

    /**
     * Stores a reference photo as `<lessonId>.<ext>`. The declared type must
     * match the file's own signature, so a renamed file cannot slip through.
     */
    async writeReference(lessonId: string, contentType: string, bytes: Uint8Array) {
      checkId(lessonId)
      const extension = REFERENCE_TYPES[contentType.split(';')[0].trim().toLowerCase()]
      if (!extension) {
        throw new WriteRefused(415, 'Reference images must be JPEG, PNG, WebP or SVG.')
      }
      if (bytes.byteLength > MAX_REFERENCE_BYTES) {
        throw new WriteRefused(
          413,
          `Reference images must be ${MAX_REFERENCE_BYTES / 1024 / 1024} MB or smaller.`,
        )
      }
      if (sniffImage(bytes) !== extension) {
        throw new WriteRefused(415, `The file's contents are not a ${extension.toUpperCase()} image.`)
      }
      if (extension === 'svg') {
        const problem = svgProblem(new TextDecoder().decode(bytes))
        if (problem) throw new WriteRefused(422, `This SVG was not saved: ${problem}`)
      }

      const name = `${lessonId}.${extension}`
      await mkdir(referencesDir, { recursive: true })
      await atomicWrite(inside(referencesDir, name), bytes)
      return { file: name }
    },
  }
}

function checkId(id: string): string {
  if (!ID_PATTERN.test(id)) {
    throw new WriteRefused(
      400,
      `"${id}" is not a valid id: use lowercase letters, digits and single dashes.`,
    )
  }
  return id
}

/** Resolves a path and refuses anything that would land outside `root`. */
function inside(root: string, ...segments: string[]): string {
  const resolved = path.resolve(root, ...segments)
  const relative = path.relative(root, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new WriteRefused(400, 'Refusing to touch a path outside shared/.')
  }
  return resolved
}

function checkPrecondition(label: string, current: Stored | null, precondition: Precondition) {
  if (precondition === undefined) {
    if (current !== null) {
      throw new WriteRefused(
        428,
        `${label} already exists; the request must say which version it replaces.`,
      )
    }
    return
  }
  if (precondition.etag === null && current !== null) {
    throw new WriteRefused(409, `${label} already exists. Reload the Studio before saving over it.`)
  }
  if (precondition.etag !== null && current === null) {
    throw new WriteRefused(409, `${label} was deleted since the Studio read it.`)
  }
  if (precondition.etag !== null && current !== null && precondition.etag !== current.etag) {
    throw new WriteRefused(
      409,
      `${label} changed on disk since the Studio read it. Reload to pick up those changes before saving.`,
    )
  }
}

async function readStored(file: string): Promise<Stored | null> {
  try {
    const text = await readFile(file, 'utf8')
    return { text, etag: etagOf(text) }
  } catch (error) {
    if (isMissing(error)) return null
    throw error
  }
}

/**
 * Writes beside the target, then renames over it: a crash leaves either the
 * old file or the new one, never half of each.
 */
async function atomicWrite(target: string, content: string | Uint8Array) {
  const temporary = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${randomBytes(6).toString('hex')}.tmp`,
  )
  try {
    await writeFile(temporary, content, { flag: 'wx' })
    await rename(temporary, target)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
}

/** The image type a file's own signature declares, whatever it claims to be. */
export function sniffImage(bytes: Uint8Array): ImageExtension | null {
  const starts = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte)
  if (starts(0xff, 0xd8, 0xff)) return 'jpg'
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'png'
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to))
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp'
  if (isSvgDocument(bytes)) return 'svg'
  return null
}

/**
 * SVG has no magic number: it is UTF-8 text whose first element is `<svg>`,
 * after an optional byte-order mark, XML declaration, comments and a DOCTYPE.
 * A DOCTYPE with an internal subset is recognised here so that `svgProblem`
 * can refuse it with a reason: entity declarations are never needed for a
 * drawing, and are how XML bombs are built.
 */
function isSvgDocument(bytes: Uint8Array): boolean {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, 4096))
  } catch {
    // A multi-byte character cut at 4096 bytes is not a reason to refuse.
    if (bytes.length <= 4096) return false
    text = new TextDecoder().decode(bytes.subarray(0, 4096))
  }
  const prolog = /^\uFEFF?\s*(<\?xml[^>]*\?>\s*)?((<!--[\s\S]*?-->|<!DOCTYPE\s+svg[^[>]*(\[[\s\S]*?\]\s*)?>)\s*)*<svg[\s>/]/i
  return prolog.test(text)
}

/**
 * Why an SVG may not be kept as a reference, or null. A reference is a
 * picture to look at; anything that runs code or pulls in other files is
 * refused with a reason the creator can act on. (Displayed through `<img>`,
 * none of it would run anyway, and `REFERENCE_RESPONSE_HEADERS` covers the
 * file opened on its own.)
 */
export function svgProblem(text: string): string | null {
  if (/<!ENTITY/i.test(text) || /<!DOCTYPE[^>]*\[/i.test(text)) {
    return 'it declares XML entities. Export it again without a DOCTYPE.'
  }
  if (/<script[\s>/]/i.test(text)) return 'it contains a script. Remove the <script> element.'
  if (/<foreignObject[\s>/]/i.test(text)) return 'it embeds HTML through <foreignObject>.'
  if (/<(iframe|embed|object)[\s>/]/i.test(text)) return 'it embeds another document.'
  const handler = /\son[a-z]+\s*=/i.exec(text)
  if (handler) return `it has an event-handler attribute (${handler[0].trim().replace(/=$/, '')}).`
  if (/javascript:/i.test(text)) return 'it contains a javascript: link.'
  if (/@import/i.test(text)) return 'its CSS imports another file.'
  for (const match of text.matchAll(/\b(?:xlink:)?href\s*=\s*(["'])([\s\S]*?)\1/gi)) {
    const target = match[2].trim()
    if (!target.startsWith('#') && !/^data:image\/(png|jpeg|webp|gif);/i.test(target)) {
      return `it links to another file (${target.slice(0, 60)}), which would not load. Embed the image instead.`
    }
  }
  for (const match of text.matchAll(/url\(\s*(["']?)([^)"']*)\1\s*\)/gi)) {
    const target = match[2].trim()
    if (!target.startsWith('#') && !/^data:image\//i.test(target)) {
      return `its CSS loads another file (${target.slice(0, 60)}), which would not load.`
    }
  }
  return null
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === 'ENOENT'
}
