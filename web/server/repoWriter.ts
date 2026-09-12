import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { formatJSON } from '../src/schema/formatJSON'
import { isSvgDocument, svgProblem } from '../src/svg/safety'

/**
 * The only code in the Studio that touches `shared/` (master plan §25).
 *
 * `shared/` holds published content only: what git tracks and the iOS app
 * bundles. Work in progress lives in the local workspace (`workspaceStore.ts`),
 * which calls this writer when a lesson is published or unpublished.
 *
 * Every read and write stays under `shared/`, in one of three folders, at a
 * file name the server derives from a validated id: the browser never
 * supplies a path. Documents are strictly validated before they are written,
 * written atomically, and never written over (or deleted from under) a file
 * that changed on disk since the Studio read it.
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
 * What the client believes is stored: the `etag` of the version it read, or
 * `null` when it believes there is nothing yet.
 */
export type Precondition = { etag: string | null } | undefined

export interface Stored {
  text: string
  etag: string
}

/** Everything the Studio reads at start-up. */
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
  const referenceFile = (file: string) => {
    if (!REFERENCE_FILE_PATTERN.test(file)) {
      throw new WriteRefused(400, `"${file}" is not a reference photo name.`)
    }
    return inside(referencesDir, file)
  }

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
      checkTutorial(id, data, options.validateTutorial)
      const current = await readStored(file)
      checkPrecondition(`shared/Tutorials/${id}.json`, current, precondition)
      const text = formatJSON(data)
      await atomicWrite(file, text)
      return { file: `shared/Tutorials/${id}.json`, etag: etagOf(text), created: current === null }
    },

    /** Removes a published tutorial, but only the version the caller read. */
    async deleteTutorial(id: string, precondition: { etag: string }) {
      const file = tutorialFile(id)
      const current = await readStored(file)
      checkPrecondition(`shared/Tutorials/${id}.json`, current, precondition)
      await rm(file)
      return { file: `shared/Tutorials/${id}.json` }
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
      try {
        const bytes = await readFile(referenceFile(file))
        return { bytes, contentType: contentTypeOf(file) }
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
      const { file } = checkReference(lessonId, contentType, bytes)
      await mkdir(referencesDir, { recursive: true })
      await atomicWrite(inside(referencesDir, file), bytes)
      return { file }
    },

    /** Removes a published photo. Missing already is fine. */
    async deleteReference(file: string) {
      await rm(referenceFile(file), { force: true })
      return { file: `shared/Assets/References/${file}` }
    },
  }
}

/** A tutorial fit to be stored as `<id>.json`: strictly valid, and carrying that id. */
export function checkTutorial(id: string, data: unknown, validateTutorial: (data: unknown) => Verdict) {
  checkId(id)
  const verdict = validateTutorial(data)
  if (!verdict.ok) {
    throw new WriteRefused(422, 'The tutorial is not valid, so it was not saved.', verdict.issues)
  }
  const documentId = (data as { id?: unknown }).id
  if (documentId !== id) {
    throw new WriteRefused(422, `The tutorial's id must be "${id}" to be saved as ${id}.json.`, [
      { path: 'id', message: `Must be "${id}".`, value: documentId },
    ])
  }
}

/**
 * The checks every stored reference image passes, wherever it is stored:
 * a known type, a size limit, a signature that matches the declared type, and
 * no active content in an SVG. Returns the file name, `<lessonId>.<ext>`.
 */
export function checkReference(lessonId: string, contentType: string, bytes: Uint8Array) {
  checkId(lessonId)
  const type = contentType.split(';')[0].trim().toLowerCase()
  const extension = REFERENCE_TYPES[type]
  if (!extension) {
    throw new WriteRefused(415, 'Reference images must be JPEG, PNG, WebP or SVG.')
  }
  if (bytes.byteLength > MAX_REFERENCE_BYTES) {
    throw new WriteRefused(413, `Reference images must be ${MAX_REFERENCE_BYTES / 1024 / 1024} MB or smaller.`)
  }
  if (sniffImage(bytes) !== extension) {
    throw new WriteRefused(415, `The file's contents are not a ${extension.toUpperCase()} image.`)
  }
  if (extension === 'svg') {
    const problem = svgProblem(new TextDecoder().decode(bytes))
    if (problem) throw new WriteRefused(422, `This SVG was not saved: ${problem}`)
  }
  return { file: `${lessonId}.${extension}`, contentType: CONTENT_TYPES[extension] }
}

export function contentTypeOf(file: string): string {
  return CONTENT_TYPES[file.slice(file.lastIndexOf('.') + 1)] ?? 'application/octet-stream'
}

export function checkId(id: string): string {
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

export function checkPrecondition(label: string, current: Stored | null, precondition: Precondition) {
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
      `${label} changed since the Studio read it. Reload to pick up those changes before saving.`,
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

// The SVG rules live in src/svg/safety.ts, shared with the browser's tracer.
export { svgProblem }

export function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === 'ENOENT'
}
