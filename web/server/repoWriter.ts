import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  HISTORY_LAYERS,
  HISTORY_VERSION,
  type HistoryEntry,
  type HistoryRecord,
} from '../src/history/types'
import { formatJSON } from '../src/schema/formatJSON'
import type { Tutorial } from '../src/schema/types'
import { isSvgDocument, svgProblem } from '../src/svg/safety'

/**
 * The only code in the Studio that touches disk (master plan §25).
 *
 * Every read and write stays under `shared/`, in one of four folders, at a
 * file name the server derives from a validated id — the browser never
 * supplies a path. Documents are strictly validated before they are written,
 * written atomically, and never written over a file that changed on disk since
 * the Studio read it. History files are only ever added, never replaced.
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

/** `<time>-<kind>-<random>.json`: the time first, so names sort in the order things happened. */
const HISTORY_FILE_PATTERN = /^\d{8}T\d{9}Z-(generated|regenerated|saved)-[0-9a-f]{6}\.json$/

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
  const historyDir = inside(shared, 'History')

  const tutorialFile = (id: string) => inside(tutorialsDir, `${checkId(id)}.json`)
  const historyFolder = (lessonId: string) => inside(historyDir, checkId(lessonId))

  /** Every recorded version of a lesson, newest first. A file that cannot be read is skipped, never fatal. */
  async function readHistory(lessonId: string): Promise<HistoryEntry[]> {
    const folder = historyFolder(lessonId)
    let names: string[]
    try {
      names = (await readdir(folder)).filter((name) => HISTORY_FILE_PATTERN.test(name))
    } catch (error) {
      if (isMissing(error)) return []
      throw error
    }
    const entries = await Promise.all(
      names.map(async (name) => {
        try {
          const entry = JSON.parse(await readFile(inside(folder, name), 'utf8')) as HistoryEntry
          return isHistoryEntry(entry) && `${entry.id}.json` === name ? entry : null
        } catch {
          return null
        }
      }),
    )
    return entries
      .filter((entry): entry is HistoryEntry => entry !== null)
      .sort((a, b) => (a.id < b.id ? 1 : -1))
  }

  /** Adds one version after `newest`. The id starts with the time, so the order on disk is the order of events. */
  async function writeHistoryEntry(
    lessonId: string,
    record: HistoryRecord & { baseline?: boolean },
    newest: HistoryEntry | undefined,
  ): Promise<HistoryEntry> {
    const at = new Date(Math.max(Date.now(), newest ? Date.parse(newest.createdAt) + 1 : 0))
    const createdAt = at.toISOString()
    const id = `${createdAt.replace(/[-:.]/g, '')}-${record.kind}-${randomBytes(3).toString('hex')}`
    const { tutorial, ...about } = record
    const entry: HistoryEntry = { historyVersion: HISTORY_VERSION, id, lessonId, createdAt, ...about, tutorial }
    const folder = historyFolder(lessonId)
    await mkdir(folder, { recursive: true })
    await atomicWrite(inside(folder, `${id}.json`), formatJSON(entry))
    return entry
  }

  /**
   * The first time anything is recorded about a lesson that already had a
   * version on disk, that version goes in first, so there is always something
   * to go back to.
   */
  async function withBaseline(lessonId: string, onDisk: Stored, history: HistoryEntry[]): Promise<HistoryEntry[]> {
    if (history.length > 0) return history
    let tutorial: unknown
    try {
      tutorial = JSON.parse(onDisk.text)
    } catch {
      return history
    }
    if (!options.validateTutorial(tutorial).ok) return history
    return [await writeHistoryEntry(lessonId, { kind: 'saved', baseline: true, tutorial: tutorial as Tutorial }, undefined)]
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
      // A save that changes an existing lesson is kept in its history, and so,
      // the first time, is the version it replaces. A new lesson's candidates
      // are recorded by New lesson itself.
      const history = current && current.text !== text ? await withBaseline(id, current, await readHistory(id)) : null
      await atomicWrite(file, text)
      if (history) {
        const lastSaved = history.find((entry) => entry.kind === 'saved')
        if (!lastSaved || formatJSON(lastSaved.tutorial) !== text) {
          await writeHistoryEntry(id, { kind: 'saved', tutorial: data as Tutorial }, history[0])
        }
      }
      return { file: `shared/Tutorials/${id}.json`, etag: etagOf(text), created: current === null }
    },

    readHistory,

    /**
     * Records a generated or regenerated version. Writes only a new history
     * file; the lesson itself is untouched. Before the first regeneration of a
     * lesson, the lesson as it was is recorded too.
     */
    async appendHistory(lessonId: string, data: unknown): Promise<{ entry: HistoryEntry }> {
      const file = tutorialFile(lessonId)
      const record = readHistoryRecord(data, lessonId, options.validateTutorial)
      const onDisk = await readStored(file)
      if (!onDisk) throw new WriteRefused(404, `There is no lesson "${lessonId}" to keep history for.`)
      let history = await readHistory(lessonId)
      if (record.kind === 'regenerated') history = await withBaseline(lessonId, onDisk, history)
      return { entry: await writeHistoryEntry(lessonId, record, history[0]) }
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

/**
 * A version the Studio asks to record, checked like any document the writer
 * stores: the tutorial must be valid and be this lesson, and only the known
 * fields, of the right types, are kept. Saves record themselves.
 */
function readHistoryRecord(
  data: unknown,
  lessonId: string,
  validateTutorial: (data: unknown) => Verdict,
): HistoryRecord {
  const value = data as Record<string, unknown> | null
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new WriteRefused(400, 'A history entry must be a JSON object.')
  }
  if (value.kind !== 'generated' && value.kind !== 'regenerated') {
    throw new WriteRefused(400, 'Only generated and regenerated versions are recorded this way; saves record themselves.')
  }
  const verdict = validateTutorial(value.tutorial)
  if (!verdict.ok) {
    throw new WriteRefused(422, 'The version is not a valid tutorial, so it was not recorded.', verdict.issues)
  }
  const tutorial = value.tutorial as Tutorial
  if (tutorial.id !== lessonId) {
    throw new WriteRefused(422, `The version's id must be "${lessonId}" to be kept in its history.`)
  }

  const text = (key: keyof HistoryRecord) => {
    const field = value[key]
    return typeof field === 'string' && field.trim() ? { [key]: field.trim() } : {}
  }
  const notes = value.notes
  const analysis = value.analysis as Record<string, unknown> | null | undefined
  return {
    kind: value.kind,
    ...(HISTORY_LAYERS.includes(value.layer as never) ? { layer: value.layer } : {}),
    ...text('model'),
    ...text('promptVersion'),
    ...text('goal'),
    ...text('constraints'),
    ...text('note'),
    ...text('rationale'),
    ...(Array.isArray(notes) && notes.length > 0 && notes.every((note) => typeof note === 'string') ? { notes } : {}),
    ...(analysis && typeof analysis === 'object' && typeof analysis.drawingStrategy === 'string' ? { analysis } : {}),
    ...(typeof value.cost === 'number' && Number.isFinite(value.cost) ? { cost: value.cost } : {}),
    ...(value.kept === true ? { kept: true } : {}),
    tutorial,
  } as HistoryRecord
}

function isHistoryEntry(entry: HistoryEntry | null): boolean {
  return Boolean(
    entry &&
      typeof entry === 'object' &&
      typeof entry.id === 'string' &&
      typeof entry.createdAt === 'string' &&
      ['generated', 'regenerated', 'saved'].includes(entry.kind) &&
      entry.tutorial &&
      typeof entry.tutorial === 'object',
  )
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

// The SVG rules live in src/svg/safety.ts, shared with the browser's tracer.
export { svgProblem }

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === 'ENOENT'
}
