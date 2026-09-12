import { randomBytes } from 'node:crypto'
import { mkdir, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import type { DatabaseSync } from 'node:sqlite'

import { pendingChanges, projectCatalog, sameJSON, type PublishingState } from '../src/catalog/publishing'
import type { Catalog, Lesson, LessonsFile, PathsFile } from '../src/catalog/types'
import {
  HISTORY_KINDS,
  HISTORY_LAYERS,
  HISTORY_VERSION,
  type HistoryEntry,
  type HistoryRecord,
} from '../src/history/types'
import { formatJSON } from '../src/schema/formatJSON'
import type { Tutorial } from '../src/schema/types'

import {
  WriteRefused,
  checkId,
  checkPrecondition,
  checkReference,
  checkTutorial,
  etagOf,
  type CatalogContext,
  type LibrarySnapshot,
  type Precondition,
  type RepoWriter,
  type Stored,
  type Verdict,
} from './repoWriter'

/**
 * The Studio's local workspace: a SQLite file outside git (`.studio/`) where
 * all authoring happens. It holds the working curriculum (every path and
 * lesson, drafts included), working copies of lessons, photos not yet
 * published, every recorded version, and the trash.
 *
 * It is an overlay on `shared/`, not a copy of it. A published lesson nobody
 * has touched is read straight from `shared/`. Editing it adds a working copy
 * here. Publish writes working copies into `shared/` through the repository
 * writer and drops them from here, and `shared/Catalog` is rewritten as the
 * projection of the working curriculum onto published lessons
 * (`src/catalog/publishing.ts`).
 */

export interface WorkingLibrary extends LibrarySnapshot {
  publishing: PublishingState
}

export interface WorkspaceOptions {
  /** The SQLite file, or `:memory:`. */
  file: string
  writer: RepoWriter
  validateTutorial: (data: unknown) => Verdict
  validateCatalog: (paths: unknown, lessons: unknown, context: CatalogContext) => Verdict
  /** Where the daily copies go. Omit for no backups. */
  backupDir?: string
  /** How many daily copies to keep. */
  keepBackups?: number
}

export interface TrashItem {
  id: string
  kind: 'lesson' | 'path'
  /** The lesson or path id. */
  itemId: string
  title: string
  deletedAt: string
  detail: string
}

export type Workspace = Awaited<ReturnType<typeof openWorkspace>>

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS catalog (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    paths TEXT NOT NULL,
    lessons TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS drafts (
    lesson_id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    base_etag TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reference_files (
    file TEXT PRIMARY KEY,
    lesson_id TEXT NOT NULL,
    content_type TEXT NOT NULL,
    etag TEXT NOT NULL,
    bytes BLOB NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS history (
    id TEXT PRIMARY KEY,
    lesson_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    entry TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS history_by_lesson ON history (lesson_id, id);
  CREATE TABLE IF NOT EXISTS trash (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    item_id TEXT NOT NULL,
    title TEXT NOT NULL,
    deleted_at TEXT NOT NULL,
    payload TEXT NOT NULL
  );
`

interface DraftRow {
  lesson_id: string
  text: string
  base_etag: string | null
  updated_at: string
}

interface ReferenceRow {
  file: string
  lesson_id: string
  content_type: string
  etag: string
  bytes: Uint8Array
}

interface TrashRow {
  id: string
  kind: 'lesson' | 'path'
  item_id: string
  title: string
  deleted_at: string
  payload: string
}

interface LessonTrash {
  lesson?: Lesson
  tutorialText: string
  pathId: string | null
  position: number
  references: { file: string; contentType: string; base64: string }[]
}

interface PathTrash {
  path: { id: string; title: string; description?: string; lessonIds: string[] }
  index: number
  lessonsTrashed: boolean
}

type Param = null | number | string | Uint8Array

/** `node:sqlite` works in Node 22.13+, and warns that it is experimental; that warning is noise here. */
async function loadSqlite(): Promise<typeof import('node:sqlite')> {
  const original = process.emitWarning
  process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
    const text = warning instanceof Error ? warning.message : String(warning)
    if (text.includes('SQLite')) return
    return (original as (...args: unknown[]) => void).call(process, warning, ...rest)
  }) as typeof process.emitWarning
  try {
    return await import('node:sqlite')
  } finally {
    process.emitWarning = original
  }
}

export async function openWorkspace(options: WorkspaceOptions) {
  const { DatabaseSync } = await loadSqlite()
  if (options.file !== ':memory:') await mkdir(path.dirname(options.file), { recursive: true })
  const db: DatabaseSync = new DatabaseSync(options.file)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec(SCHEMA)

  const { writer, validateTutorial, validateCatalog } = options

  const one = <T>(sql: string, ...params: Param[]) => db.prepare(sql).get(...params) as T | undefined
  const all = <T>(sql: string, ...params: Param[]) => db.prepare(sql).all(...params) as T[]
  const run = (sql: string, ...params: Param[]) => db.prepare(sql).run(...params)

  /** Runs `change` as one transaction: all of it lands, or none of it. */
  function transaction<T>(change: () => T): T {
    db.exec('BEGIN IMMEDIATE')
    try {
      const result = change()
      db.exec('COMMIT')
      return result
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }

  const getMeta = (key: string) => one<{ value: string }>('SELECT value FROM meta WHERE key = ?', key)?.value
  const setMeta = (key: string, value: string) =>
    run('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value)

  const now = () => new Date().toISOString()
  const draftRow = (id: string) => one<DraftRow>('SELECT * FROM drafts WHERE lesson_id = ?', id)
  const referenceRow = (file: string) => one<ReferenceRow>('SELECT * FROM reference_files WHERE file = ?', file)

  function putDraft(id: string, text: string, baseEtag: string | null) {
    run(
      `INSERT INTO drafts (lesson_id, text, base_etag, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(lesson_id) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at`,
      id,
      text,
      baseEtag,
      now(),
    )
  }

  function putReference(file: string, lessonId: string, contentType: string, bytes: Uint8Array) {
    run(
      `INSERT INTO reference_files (file, lesson_id, content_type, etag, bytes, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(file) DO UPDATE SET lesson_id = excluded.lesson_id, content_type = excluded.content_type,
         etag = excluded.etag, bytes = excluded.bytes, updated_at = excluded.updated_at`,
      file,
      lessonId,
      contentType,
      etagOf(bytes),
      bytes,
      now(),
    )
  }

  // ---------- The working curriculum ----------

  function workingCatalogStored(): { paths: Stored; lessons: Stored } {
    const row = one<{ paths: string; lessons: string }>('SELECT paths, lessons FROM catalog WHERE id = 1')
    if (!row) throw new Error('The workspace has no catalog; it was not seeded.')
    return { paths: stored(row.paths), lessons: stored(row.lessons) }
  }

  function workingCatalog(): Catalog {
    const { paths, lessons } = workingCatalogStored()
    const catalog = parseCatalog(paths, lessons)
    if (!catalog) throw new WriteRefused(422, 'The working curriculum could not be read.')
    return catalog
  }

  function storeCatalog(catalog: Catalog) {
    run(
      'UPDATE catalog SET paths = ?, lessons = ? WHERE id = 1',
      formatJSON({ catalogVersion: 1, paths: catalog.paths } satisfies PathsFile),
      formatJSON({ catalogVersion: 1, lessons: catalog.lessons } satisfies LessonsFile),
    )
  }

  /** What `shared/Catalog` was when the Studio last read or wrote it. */
  function rememberShared(shared: { paths: Stored | null; lessons: Stored | null }) {
    setMeta('sharedPaths', shared.paths?.etag ?? '')
    setMeta('sharedLessons', shared.lessons?.etag ?? '')
  }

  function sharedChangedOutside(shared: { paths: Stored | null; lessons: Stored | null }): boolean {
    return (
      getMeta('sharedPaths') !== (shared.paths?.etag ?? '') ||
      getMeta('sharedLessons') !== (shared.lessons?.etag ?? '')
    )
  }

  /** The first time the Studio opens, the working curriculum starts as the published one. */
  async function seed() {
    if (getMeta('schema')) return
    const shared = await writer.readCatalog()
    transaction(() => {
      run(
        'INSERT OR REPLACE INTO catalog (id, paths, lessons) VALUES (1, ?, ?)',
        shared.paths?.text ?? formatJSON({ catalogVersion: 1, paths: [] }),
        shared.lessons?.text ?? formatJSON({ catalogVersion: 1, lessons: [] }),
      )
      rememberShared(shared)
      setMeta('schema', '1')
    })
  }

  // ---------- The working library: shared/ with the workspace laid over it ----------

  async function readLibrary(): Promise<WorkingLibrary> {
    const shared = await writer.readLibrary()
    const drafts = all<DraftRow>('SELECT * FROM drafts')
    const references = all<Omit<ReferenceRow, 'bytes'>>('SELECT file, lesson_id, content_type, etag FROM reference_files')

    const tutorials = new Map(shared.tutorials.map((tutorial) => [tutorial.fileName, tutorial]))
    for (const draft of drafts) {
      const fileName = `${draft.lesson_id}.json`
      tutorials.set(fileName, { fileName, ...stored(draft.text) })
    }
    const photos = new Map(shared.references.map((reference) => [reference.file, reference]))
    for (const reference of references) {
      photos.set(reference.file, {
        file: reference.file,
        url: `/api/references/${reference.file}?v=${reference.etag.slice(0, 12)}`,
      })
    }

    const catalog = workingCatalogStored()
    return {
      tutorials: [...tutorials.values()].sort((a, b) => a.fileName.localeCompare(b.fileName)),
      paths: catalog.paths,
      lessons: catalog.lessons,
      references: [...photos.values()].sort((a, b) => a.file.localeCompare(b.file)),
      publishing: publishingState(shared, drafts, references),
    }
  }

  function publishingState(
    shared: LibrarySnapshot,
    drafts: DraftRow[],
    references: Omit<ReferenceRow, 'bytes'>[],
  ): PublishingState {
    const published = new Set(shared.tutorials.map((tutorial) => tutorial.fileName.replace(/\.json$/, '')))
    const sharedText = new Map(shared.tutorials.map((tutorial) => [tutorial.fileName.replace(/\.json$/, ''), tutorial.text]))
    const drawingChanged = new Set(
      drafts
        .filter((draft) => published.has(draft.lesson_id) && !sameText(sharedText.get(draft.lesson_id), draft.text))
        .map((draft) => draft.lesson_id),
    )
    const working = parseCatalog(workingCatalogStored().paths, workingCatalogStored().lessons)
    const workspacePhotos = new Set(references.map((reference) => reference.file))
    const photoChanged = new Set(
      (working?.lessons ?? [])
        .filter((lesson) => lesson.reference && workspacePhotos.has(lesson.reference.file))
        .map((lesson) => lesson.id),
    )
    const pending = working
      ? pendingChanges({
          working,
          shared: parseCatalog(shared.paths, shared.lessons),
          published,
          drawingChanged,
          photoChanged,
        })
      : []
    return {
      publishedIds: [...published].sort(),
      editedIds: pending.flatMap((change) => (change.kind === 'edited' ? [change.lessonId] : [])),
      pending,
      sharedChangedOutside: sharedChangedOutside(shared),
      trashCount: one<{ count: number }>('SELECT COUNT(*) AS count FROM trash')?.count ?? 0,
    }
  }

  async function workingIds() {
    const library = await readLibrary()
    return {
      tutorials: new Set(library.tutorials.map((tutorial) => tutorial.fileName.replace(/\.json$/, ''))),
      references: new Set(library.references.map((reference) => reference.file)),
    }
  }

  async function readTutorial(id: string): Promise<Stored | null> {
    checkId(id)
    const draft = draftRow(id)
    return draft ? stored(draft.text) : writer.readTutorial(id)
  }

  // ---------- History ----------

  function readHistory(lessonId: string): HistoryEntry[] {
    checkId(lessonId)
    return all<{ entry: string }>('SELECT entry FROM history WHERE lesson_id = ? ORDER BY id DESC', lessonId).flatMap(
      (row) => {
        try {
          const entry = JSON.parse(row.entry) as HistoryEntry
          return isHistoryEntry(entry) ? [entry] : []
        } catch {
          return []
        }
      },
    )
  }

  /** Adds one version after `newest`. The id starts with the time, so ids sort in the order things happened. */
  function writeHistoryEntry(
    lessonId: string,
    record: HistoryRecord & { baseline?: boolean },
    newest: HistoryEntry | undefined,
  ): HistoryEntry {
    const at = new Date(Math.max(Date.now(), newest ? Date.parse(newest.createdAt) + 1 : 0))
    const createdAt = at.toISOString()
    const id = `${createdAt.replace(/[-:.]/g, '')}-${record.kind}-${randomBytes(3).toString('hex')}`
    const { tutorial, ...about } = record
    const entry: HistoryEntry = { historyVersion: HISTORY_VERSION, id, lessonId, createdAt, ...about, tutorial }
    run('INSERT INTO history (id, lesson_id, created_at, entry) VALUES (?, ?, ?, ?)', id, lessonId, createdAt, JSON.stringify(entry))
    return entry
  }

  /**
   * The first time anything is recorded about a lesson that already had a
   * version, that version goes in first, so there is always something to go
   * back to.
   */
  function withBaseline(lessonId: string, current: Stored, history: HistoryEntry[]): HistoryEntry[] {
    if (history.length > 0) return history
    let tutorial: unknown
    try {
      tutorial = JSON.parse(current.text)
    } catch {
      return history
    }
    if (!validateTutorial(tutorial).ok) return history
    return [writeHistoryEntry(lessonId, { kind: 'saved', baseline: true, tutorial: tutorial as Tutorial }, undefined)]
  }

  // ---------- Trash ----------

  function trashId(): string {
    return `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
  }

  function isLive(id: string, working: Catalog, tutorials: ReadonlySet<string>): boolean {
    return tutorials.has(id) || working.lessons.some((lesson) => lesson.id === id)
  }

  const workspace = {
    readLibrary,
    readTutorial,

    /** Saves a lesson in the workspace. `shared/` is untouched until the lesson is published. */
    async writeTutorial(id: string, data: unknown, precondition: Precondition) {
      checkTutorial(id, data, validateTutorial)
      const draft = draftRow(id)
      const shared = await writer.readTutorial(id)
      const current = draft ? stored(draft.text) : shared
      checkPrecondition(`The lesson “${id}”`, current, precondition)
      const text = formatJSON(data)
      const result = { file: `workspace/${id}`, etag: etagOf(text), created: current === null }
      if (current?.text === text) return result

      transaction(() => {
        // A save that changes a lesson is kept in its history, and so, the
        // first time, is the version it replaces.
        if (current) {
          const history = withBaseline(id, current, readHistory(id))
          const lastSaved = history.find((entry) => entry.kind === 'saved' || entry.kind === 'published')
          if (!lastSaved || formatJSON(lastSaved.tutorial) !== text) {
            writeHistoryEntry(id, { kind: 'saved', tutorial: data as Tutorial }, history[0])
          }
        }
        // Back to exactly the published version: no working copy is needed.
        if (shared && sameText(shared.text, text)) run('DELETE FROM drafts WHERE lesson_id = ?', id)
        else putDraft(id, text, draft ? draft.base_etag : (shared?.etag ?? null))
      })
      return result
    },

    readHistory: async (lessonId: string) => readHistory(lessonId),

    /**
     * Records a generated or regenerated version. Before the first
     * regeneration of a lesson, the lesson as it was is recorded too.
     */
    async appendHistory(lessonId: string, data: unknown): Promise<{ entry: HistoryEntry }> {
      checkId(lessonId)
      const record = readHistoryRecord(data, lessonId, validateTutorial)
      const current = await readTutorial(lessonId)
      if (!current) throw new WriteRefused(404, `There is no lesson "${lessonId}" to keep history for.`)
      return transaction(() => {
        let history = readHistory(lessonId)
        if (record.kind === 'regenerated') history = withBaseline(lessonId, current, history)
        return { entry: writeHistoryEntry(lessonId, record, history[0]) }
      })
    },

    readCatalog: async () => workingCatalogStored(),

    /** Saves the working curriculum. Nothing reaches `shared/Catalog` until Publish. */
    async writeCatalog(paths: unknown, lessons: unknown, precondition: { paths?: Precondition; lessons?: Precondition } = {}) {
      const ids = await workingIds()
      const verdict = validateCatalog(paths, lessons, { tutorialIds: ids.tutorials, referenceFiles: ids.references })
      if (!verdict.ok) {
        throw new WriteRefused(422, 'The curriculum is not valid, so it was not saved.', verdict.issues)
      }
      const current = workingCatalogStored()
      checkPrecondition('The curriculum’s paths', current.paths, precondition.paths)
      checkPrecondition('The curriculum’s lessons', current.lessons, precondition.lessons)
      const pathsText = formatJSON(paths)
      const lessonsText = formatJSON(lessons)
      run('UPDATE catalog SET paths = ?, lessons = ? WHERE id = 1', pathsText, lessonsText)
      return { paths: { etag: etagOf(pathsText) }, lessons: { etag: etagOf(lessonsText) } }
    },

    /** A photo from the workspace, or else the published one. */
    async readReference(file: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
      const row = referenceRow(file)
      return row ? { bytes: row.bytes, contentType: row.content_type } : writer.readReference(file)
    },

    /** Stores a photo in the workspace as `<lessonId>.<ext>`, replacing the lesson's earlier workspace photo. */
    async writeReference(lessonId: string, contentType: string, bytes: Uint8Array) {
      const { file, contentType: type } = checkReference(lessonId, contentType, bytes)
      transaction(() => {
        run('DELETE FROM reference_files WHERE lesson_id = ?', lessonId)
        putReference(file, lessonId, type, bytes)
      })
      return { file }
    },

    /**
     * Writes lessons, and the curriculum as it now stands, into `shared/`.
     * Publishing approves: each lesson's status becomes approved. Photos go
     * first, then tutorials, then the catalog, so a failure part-way never
     * leaves the catalog pointing at a file that is not there. Run again, it
     * picks up where it stopped.
     */
    async publish(lessonIds: string[]): Promise<{ files: string[] }> {
      const ids = [...new Set(lessonIds.map(checkId))]
      const shared = await writer.readLibrary()
      if (sharedChangedOutside(shared)) {
        throw new WriteRefused(409, 'shared/Catalog changed outside the Studio. Adopt it before publishing.')
      }
      const working = workingCatalog()
      const sharedCatalog = parseCatalog(shared.paths, shared.lessons)
      const sharedTutorials = new Map(shared.tutorials.map((tutorial) => [tutorial.fileName.replace(/\.json$/, ''), tutorial]))
      const sharedPhotos = new Set(shared.references.map((reference) => reference.file))

      // Everything is checked before anything is written.
      const plans = ids.map((id) => {
        const lesson = working.lessons.find((candidate) => candidate.id === id)
        if (!lesson) {
          throw new WriteRefused(404, `"${id}" is not in the curriculum, so there is nothing to publish it with.`)
        }
        const draft = draftRow(id)
        const published = sharedTutorials.get(id)
        if (!draft && !published) throw new WriteRefused(404, `There is no lesson "${id}".`)
        const tutorial = draft ? (JSON.parse(draft.text) as Tutorial) : null
        if (tutorial) checkTutorial(id, tutorial, validateTutorial)
        const photo = lesson.reference ? referenceRow(lesson.reference.file) : undefined
        if (lesson.reference && !photo && !sharedPhotos.has(lesson.reference.file)) {
          throw new WriteRefused(422, `The photo ${lesson.reference.file} for "${id}" is missing.`)
        }
        return { id, lesson: { ...lesson, status: 'approved' as const }, draft, tutorial, published, photo }
      })

      const files: string[] = []
      for (const plan of plans) {
        if (!plan.photo) continue
        await writer.writeReference(plan.id, plan.photo.content_type, plan.photo.bytes)
        files.push(`shared/Assets/References/${plan.photo.file}`)
      }
      for (const plan of plans) {
        if (!plan.draft || !plan.tutorial) continue
        if (plan.published && sameText(plan.published.text, plan.draft.text)) continue
        await writer.writeTutorial(plan.id, plan.tutorial, { etag: plan.draft.base_etag })
        files.push(`shared/Tutorials/${plan.id}.json`)
      }

      const approved = new Map(plans.map((plan) => [plan.id, plan.lesson]))
      const nextWorking: Catalog = {
        paths: working.paths,
        lessons: working.lessons.map((lesson) => approved.get(lesson.id) ?? lesson),
      }
      const projected = projectCatalog(nextWorking, sharedCatalog, new Set([...sharedTutorials.keys(), ...ids]), new Set(ids))
      const pathsFile: PathsFile = { catalogVersion: 1, paths: projected.paths }
      const lessonsFile: LessonsFile = { catalogVersion: 1, lessons: projected.lessons }
      const pathsChanged = !sharedCatalog || !sameText(shared.paths?.text, formatJSON(pathsFile))
      const lessonsChanged = !sharedCatalog || !sameText(shared.lessons?.text, formatJSON(lessonsFile))
      if (pathsChanged || lessonsChanged) {
        await writer.writeCatalog(pathsFile, lessonsFile, {
          paths: { etag: shared.paths?.etag ?? null },
          lessons: { etag: shared.lessons?.etag ?? null },
        })
        if (pathsChanged) files.push('shared/Catalog/paths.json')
        if (lessonsChanged) files.push('shared/Catalog/lessons.json')
      }

      // A lesson whose photo was replaced by one of another type leaves the old file behind.
      for (const plan of plans) {
        const previous = sharedCatalog?.lessons.find((lesson) => lesson.id === plan.id)?.reference?.file
        if (!previous || previous === plan.lesson.reference?.file) continue
        if (projected.lessons.some((lesson) => lesson.reference?.file === previous)) continue
        await writer.deleteReference(previous)
        files.push(`shared/Assets/References/${previous}`)
      }

      const after = await writer.readCatalog()
      transaction(() => {
        for (const plan of plans) {
          run('DELETE FROM drafts WHERE lesson_id = ?', plan.id)
          run('DELETE FROM reference_files WHERE lesson_id = ?', plan.id)
          const tutorial = plan.tutorial ?? (JSON.parse(plan.published!.text) as Tutorial)
          writeHistoryEntry(plan.id, { kind: 'published', tutorial }, readHistory(plan.id)[0])
        }
        storeCatalog(nextWorking)
        rememberShared(after)
      })
      return { files }
    },

    /**
     * Takes a lesson out of `shared/`, keeping it in the workspace. The
     * workspace copy is written and read back before anything in `shared/` is
     * removed.
     */
    async unpublish(id: string): Promise<{ files: string[] }> {
      checkId(id)
      const shared = await writer.readLibrary()
      if (sharedChangedOutside(shared)) {
        throw new WriteRefused(409, 'shared/Catalog changed outside the Studio. Adopt it before unpublishing.')
      }
      const published = shared.tutorials.find((tutorial) => tutorial.fileName === `${id}.json`)
      if (!published) throw new WriteRefused(409, `"${id}" is not published.`)
      const sharedCatalog = parseCatalog(shared.paths, shared.lessons)
      const entry = sharedCatalog?.lessons.find((lesson) => lesson.id === id)
      const photo = entry?.reference?.file
      const photoBytes = photo ? await writer.readReference(photo) : null
      const draft = draftRow(id)

      transaction(() => {
        if (draft) run('UPDATE drafts SET base_etag = NULL WHERE lesson_id = ?', id)
        else putDraft(id, published.text, null)
        if (photo && photoBytes && !referenceRow(photo)) putReference(photo, id, photoBytes.contentType, photoBytes.bytes)
      })
      const copy = draftRow(id)
      if (!copy || (!draft && copy.text !== published.text) || (photo && photoBytes && !referenceRow(photo))) {
        throw new WriteRefused(500, `The workspace copy of "${id}" could not be verified, so nothing was removed from shared/.`)
      }

      const files: string[] = []
      const listed = Boolean(entry) || Boolean(sharedCatalog?.paths.some((path) => path.lessonIds.includes(id)))
      if (sharedCatalog && listed) {
        // A path this removal empties goes too, as the projection would drop it;
        // a path that was empty already is left as it is.
        const paths = sharedCatalog.paths.flatMap((path) => {
          if (!path.lessonIds.includes(id)) return [path]
          const lessonIds = path.lessonIds.filter((lessonId) => lessonId !== id)
          return lessonIds.length > 0 ? [{ ...path, lessonIds }] : []
        })
        const lessons = sharedCatalog.lessons.filter((lesson) => lesson.id !== id)
        await writer.writeCatalog(
          { catalogVersion: 1, paths },
          { catalogVersion: 1, lessons },
          { paths: { etag: shared.paths?.etag ?? null }, lessons: { etag: shared.lessons?.etag ?? null } },
        )
        files.push('shared/Catalog/paths.json', 'shared/Catalog/lessons.json')
      }
      await writer.deleteTutorial(id, { etag: published.etag })
      files.push(`shared/Tutorials/${id}.json`)
      const stillUsed = sharedCatalog?.lessons.some((lesson) => lesson.id !== id && lesson.reference?.file === photo)
      if (photo && !stillUsed) {
        await writer.deleteReference(photo)
        files.push(`shared/Assets/References/${photo}`)
      }
      rememberShared(await writer.readCatalog())
      return { files }
    },

    /** A copy of a lesson as a new draft, right after it in its path. History is not copied. */
    async duplicate(id: string): Promise<{ lessonId: string }> {
      const current = await readTutorial(id)
      if (!current) throw new WriteRefused(404, `There is no lesson "${id}".`)
      const working = workingCatalog()
      const ids = await workingIds()
      let copyId = `${id}-copy`
      for (let n = 2; isLive(copyId, working, ids.tutorials); n += 1) copyId = `${id}-copy-${n}`

      const source = JSON.parse(current.text) as Tutorial
      const tutorial: Tutorial = { ...source, id: copyId, title: `${source.title} (copy)` }
      checkTutorial(copyId, tutorial, validateTutorial)
      const lesson = working.lessons.find((candidate) => candidate.id === id)
      const photo = lesson?.reference ? await workspace.readReference(lesson.reference.file) : null
      const photoFile = lesson?.reference && photo ? `${copyId}${lesson.reference.file.slice(lesson.reference.file.lastIndexOf('.'))}` : null

      transaction(() => {
        putDraft(copyId, formatJSON(tutorial), null)
        if (photo && photoFile) putReference(photoFile, copyId, photo.contentType, photo.bytes)
        if (lesson) {
          const { reference, ...rest } = lesson
          const copy: Lesson = {
            ...rest,
            id: copyId,
            status: 'draft',
            ...(reference && photoFile ? { reference: { ...reference, file: photoFile } } : {}),
          }
          storeCatalog({
            lessons: [...working.lessons, copy],
            paths: working.paths.map((path) => {
              const at = path.lessonIds.indexOf(id)
              if (at < 0) return path
              const lessonIds = [...path.lessonIds]
              lessonIds.splice(at + 1, 0, copyId)
              return { ...path, lessonIds }
            }),
          })
        }
      })
      return { lessonId: copyId }
    },

    /**
     * Moves a lesson to the trash: its working copy, its photo, its catalog
     * entry and its place in a path. A published lesson is unpublished first.
     * Its history stays until the trash is emptied.
     */
    async deleteLesson(id: string): Promise<{ files: string[] }> {
      checkId(id)
      const published = await writer.readTutorial(id)
      const { files } = published ? await workspace.unpublish(id) : { files: [] as string[] }
      const draft = draftRow(id)
      if (!draft) throw new WriteRefused(404, `There is no lesson "${id}".`)
      const working = workingCatalog()
      const lesson = working.lessons.find((candidate) => candidate.id === id)
      const path = working.paths.find((candidate) => candidate.lessonIds.includes(id))
      const photos = all<ReferenceRow>('SELECT * FROM reference_files WHERE lesson_id = ?', id)
      const payload: LessonTrash = {
        ...(lesson ? { lesson } : {}),
        tutorialText: draft.text,
        pathId: path?.id ?? null,
        position: path ? path.lessonIds.indexOf(id) : 0,
        references: photos.map((photo) => ({
          file: photo.file,
          contentType: photo.content_type,
          base64: Buffer.from(photo.bytes).toString('base64'),
        })),
      }
      const title = (JSON.parse(draft.text) as Tutorial).title
      transaction(() => {
        run(
          'INSERT INTO trash (id, kind, item_id, title, deleted_at, payload) VALUES (?, ?, ?, ?, ?, ?)',
          trashId(),
          'lesson',
          id,
          title,
          now(),
          JSON.stringify(payload),
        )
        run('DELETE FROM drafts WHERE lesson_id = ?', id)
        run('DELETE FROM reference_files WHERE lesson_id = ?', id)
        storeCatalog({
          paths: working.paths.map((candidate) =>
            candidate.lessonIds.includes(id)
              ? { ...candidate, lessonIds: candidate.lessonIds.filter((lessonId) => lessonId !== id) }
              : candidate,
          ),
          lessons: working.lessons.filter((candidate) => candidate.id !== id),
        })
      })
      return { files }
    },

    /** Moves a path to the trash. Its lessons become unfiled, or go to the trash too. */
    async deletePath(id: string, lessons: 'unfile' | 'trash'): Promise<{ files: string[] }> {
      checkId(id)
      const before = workingCatalog()
      const index = before.paths.findIndex((path) => path.id === id)
      if (index < 0) throw new WriteRefused(404, `There is no path "${id}".`)
      const path = before.paths[index]
      const files: string[] = []
      if (lessons === 'trash') {
        for (const lessonId of path.lessonIds) files.push(...(await workspace.deleteLesson(lessonId)).files)
      }
      const working = workingCatalog()
      const payload: PathTrash = { path, index, lessonsTrashed: lessons === 'trash' }
      transaction(() => {
        run(
          'INSERT INTO trash (id, kind, item_id, title, deleted_at, payload) VALUES (?, ?, ?, ?, ?, ?)',
          trashId(),
          'path',
          id,
          path.title,
          now(),
          JSON.stringify(payload),
        )
        storeCatalog({ ...working, paths: working.paths.filter((candidate) => candidate.id !== id) })
      })
      return { files: [...new Set(files)] }
    },

    listTrash(): TrashItem[] {
      return all<TrashRow>('SELECT * FROM trash ORDER BY deleted_at DESC, id DESC').map((row) => {
        const payload = JSON.parse(row.payload) as LessonTrash | PathTrash
        let detail: string
        if (row.kind === 'path') {
          const count = (payload as PathTrash).path.lessonIds.length
          detail = `${count} ${count === 1 ? 'lesson' : 'lessons'}${(payload as PathTrash).lessonsTrashed ? ', also in the trash' : ''}`
        } else {
          const pathId = (payload as LessonTrash).pathId
          detail = pathId ? `was in the “${pathId}” path` : 'was not in a path'
        }
        return { id: row.id, kind: row.kind, itemId: row.item_id, title: row.title, deletedAt: row.deleted_at, detail }
      })
    },

    /** Puts a trashed lesson or path back where it was, as a draft. */
    async restore(id: string): Promise<{ kind: 'lesson' | 'path'; itemId: string }> {
      const row = one<TrashRow>('SELECT * FROM trash WHERE id = ?', id)
      if (!row) throw new WriteRefused(404, 'That item is no longer in the trash.')
      const working = workingCatalog()

      if (row.kind === 'lesson') {
        const payload = JSON.parse(row.payload) as LessonTrash
        const ids = await workingIds()
        if (isLive(row.item_id, working, ids.tutorials)) {
          throw new WriteRefused(409, `A lesson called "${row.item_id}" exists again. Delete or rename it first.`)
        }
        transaction(() => {
          putDraft(row.item_id, payload.tutorialText, null)
          for (const photo of payload.references) {
            putReference(photo.file, row.item_id, photo.contentType, new Uint8Array(Buffer.from(photo.base64, 'base64')))
          }
          storeCatalog({
            lessons: payload.lesson ? [...working.lessons, payload.lesson] : working.lessons,
            paths: working.paths.map((path) => {
              if (!payload.lesson || path.id !== payload.pathId) return path
              const lessonIds = [...path.lessonIds]
              lessonIds.splice(Math.min(payload.position, lessonIds.length), 0, row.item_id)
              return { ...path, lessonIds }
            }),
          })
          run('DELETE FROM trash WHERE id = ?', id)
        })
        return { kind: 'lesson', itemId: row.item_id }
      }

      const payload = JSON.parse(row.payload) as PathTrash
      if (working.paths.some((path) => path.id === row.item_id)) {
        throw new WriteRefused(409, `A path called "${row.item_id}" exists again.`)
      }
      const filed = new Set(working.paths.flatMap((path) => path.lessonIds))
      const lessonIds = payload.path.lessonIds.filter(
        (lessonId) => !filed.has(lessonId) && working.lessons.some((lesson) => lesson.id === lessonId),
      )
      const paths = [...working.paths]
      paths.splice(Math.min(payload.index, paths.length), 0, { ...payload.path, lessonIds })
      transaction(() => {
        storeCatalog({ ...working, paths })
        run('DELETE FROM trash WHERE id = ?', id)
      })
      return { kind: 'path', itemId: row.item_id }
    },

    /** Deletes a trashed item for good, with the history of a lesson nobody uses the id of any more. */
    async purge(id: string) {
      const row = one<TrashRow>('SELECT * FROM trash WHERE id = ?', id)
      if (!row) throw new WriteRefused(404, 'That item is no longer in the trash.')
      const working = workingCatalog()
      const ids = await workingIds()
      transaction(() => {
        run('DELETE FROM trash WHERE id = ?', id)
        if (row.kind === 'lesson' && !isLive(row.item_id, working, ids.tutorials)) {
          const again = one<{ id: string }>('SELECT id FROM trash WHERE kind = ? AND item_id = ?', 'lesson', row.item_id)
          if (!again) run('DELETE FROM history WHERE lesson_id = ?', row.item_id)
        }
      })
    },

    async emptyTrash() {
      for (const item of workspace.listTrash()) await workspace.purge(item.id)
    },

    /**
     * Takes `shared/Catalog` as it now is (after a git pull or a hand edit):
     * published lessons and paths follow it, and workspace-only lessons keep
     * their places.
     */
    async adoptShared() {
      const shared = await writer.readLibrary()
      const sharedCatalog = parseCatalog(shared.paths, shared.lessons)
      if (!sharedCatalog) throw new WriteRefused(422, 'shared/Catalog cannot be read, so it cannot be adopted.')
      const working = workingCatalog()
      const published = new Set(shared.tutorials.map((tutorial) => tutorial.fileName.replace(/\.json$/, '')))
      const listed = new Set(sharedCatalog.lessons.map((lesson) => lesson.id))
      const workspaceOnly = working.lessons.filter((lesson) => !published.has(lesson.id) && !listed.has(lesson.id))
      const keep = new Set(workspaceOnly.map((lesson) => lesson.id))

      const paths = sharedCatalog.paths.map((path) => ({ ...path, lessonIds: [...path.lessonIds] }))
      for (const path of working.paths) {
        let target = paths.find((candidate) => candidate.id === path.id)
        if (!target && (path.lessonIds.length === 0 || path.lessonIds.some((id) => keep.has(id)))) {
          target = { ...path, lessonIds: [] }
          paths.push(target)
        }
        path.lessonIds.forEach((lessonId, index) => {
          if (target && keep.has(lessonId)) target.lessonIds.splice(Math.min(index, target.lessonIds.length), 0, lessonId)
        })
      }
      transaction(() => {
        storeCatalog({ paths, lessons: [...sharedCatalog.lessons, ...workspaceOnly] })
        rememberShared(shared)
      })
    },

    /**
     * Copies the workspace to `<backupDir>/workspace-<date>.sqlite` once a day,
     * keeping the newest few. The workspace is not in git; this is its safety net.
     */
    async backup(today = new Date()): Promise<string | null> {
      if (!options.backupDir || options.file === ':memory:') return null
      const dir = options.backupDir
      await mkdir(dir, { recursive: true })
      const name = `workspace-${today.toISOString().slice(0, 10)}.sqlite`
      const pattern = /^workspace-\d{4}-\d{2}-\d{2}\.sqlite$/
      const existing = (await readdir(dir)).filter((file) => pattern.test(file))
      if (!existing.includes(name)) {
        db.exec(`VACUUM INTO '${path.join(dir, name).split("'").join("''")}'`)
        existing.push(name)
      }
      existing.sort()
      const keep = options.keepBackups ?? 7
      for (const old of existing.slice(0, Math.max(0, existing.length - keep))) {
        await rm(path.join(dir, old), { force: true })
      }
      return path.join(dir, name)
    },

    close() {
      db.close()
    },
  }

  await seed()
  return workspace
}

/**
 * A version the Studio asks to record, checked like any document the
 * workspace stores: the tutorial must be valid and be this lesson, and only the
 * known fields, of the right types, are kept. Saves and publishes record
 * themselves.
 */
function readHistoryRecord(data: unknown, lessonId: string, validateTutorial: (data: unknown) => Verdict): HistoryRecord {
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
      HISTORY_KINDS.includes(entry.kind) &&
      entry.tutorial &&
      typeof entry.tutorial === 'object',
  )
}

function stored(text: string): Stored {
  return { text, etag: etagOf(text) }
}

/** Two tutorial or catalog texts that say the same thing, however they are formatted. */
function sameText(a: string | undefined, b: string | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  if (a === b) return true
  try {
    return sameJSON(JSON.parse(a), JSON.parse(b))
  } catch {
    return false
  }
}

function parseCatalog(paths: Stored | null, lessons: Stored | null): Catalog | null {
  if (!paths || !lessons) return null
  try {
    const pathsFile = JSON.parse(paths.text) as Partial<PathsFile>
    const lessonsFile = JSON.parse(lessons.text) as Partial<LessonsFile>
    if (!Array.isArray(pathsFile.paths) || !Array.isArray(lessonsFile.lessons)) return null
    return { paths: pathsFile.paths, lessons: lessonsFile.lessons }
  } catch {
    return null
  }
}
