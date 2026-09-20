import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { REFERENCE_TYPES, contentTypeOf } from '../../server/repoWriter'
import { estimateLearnerSeconds, formatMinutes } from '../../src/catalog/metrics'
import { findLesson, findPathOfLesson, type Lesson, type LessonStatus } from '../../src/catalog/types'
import { parseTutorialJSON } from '../../src/schema/validate'
import { stepDuration, type Tutorial } from '../../src/schema/types'
import { assignLesson, planLesson } from '../../src/studio/pathOps'
import { qualityWarnings, type QualityWarning } from '../../src/studio/quality'

import { parseIndex, parseNumber, stringValue } from '../args'
import { command, type Command } from '../command'
import type { Context } from '../context'
import { editCatalog, editTutorial, fillPlanned, lessonRecord, patchLesson, placeInPath, plannedPlaceholder, readCatalog, readLesson, replaceTutorial, requireLesson } from '../edit'
import { CliError, plural, table } from '../output'

const STATUSES: LessonStatus[] = ['draft', 'needs-review', 'approved']

/**
 * A planned lesson has no tutorial, so the commands that want one say what it
 * is instead of "there is no lesson".
 */
function refusePlanned(id: string, lesson: Lesson | undefined, what: string): never | void {
  if (lesson?.status !== 'planned') return
  throw new CliError(
    `"${id}" is a planned lesson: it holds a place in its path, but nothing has been drawn for it yet, so it cannot be ${what}. Generate its tutorial first (studio svg to-steps <file> --id ${id} …).`,
  )
}

/** The lesson as the Paths view lists it: its tutorial, its catalog entry, its place. */
async function describeLesson(ctx: Context, id: string) {
  const library = await ctx.library()
  const entry = library.tutorials.get(id)
  const broken = library.broken.find((candidate) => candidate.fileName === `${id}.json`)
  if (!entry && broken) throw new CliError(`The lesson "${id}" fails validation.`, broken.issues)
  if (!entry) {
    refusePlanned(id, library.catalog ? findLesson(library.catalog, id) : undefined, 'used here')
    throw new CliError(`There is no lesson "${id}".`)
  }
  const catalog = library.catalog
  const lesson = catalog ? findLesson(catalog, id) : undefined
  const pathOf = catalog ? findPathOfLesson(catalog, id) : undefined
  const position = pathOf ? pathOf.lessonIds.indexOf(id) : -1
  const previous = pathOf && position > 0 ? library.tutorials.get(pathOf.lessonIds[position - 1])?.tutorial : undefined
  return { library, entry, lesson, path: pathOf, position, previous, warnings: qualityWarnings(entry.tutorial, previous) }
}

function warningLines(warnings: QualityWarning[]): string[] {
  return warnings.length === 0 ? ['No quality warnings.'] : ['Quality warnings (they never block):', ...warnings.map((warning) => `  ${warning.path}: ${warning.message}`)]
}

function stepRows(tutorial: Tutorial): string[][] {
  return tutorial.steps.map((step, index) => [
    String(index + 1),
    step.id,
    step.title,
    String(step.strokes.length),
    String(step.fills?.length ?? 0),
    `${stepDuration(step).toFixed(1)}s`,
  ])
}

/** The Lesson Workspace and each lesson's ⋯ menu, minus the drawing itself (see `steps` and `strokes`). */
export const lessonCommands: Command[] = [
  command(
    'lessons list',
    'Every lesson in the working library, with its status and where it sits.',
    [],
    {
      path: { type: 'string', description: 'Only the lessons of this path, in unlock order.', placeholder: 'id' },
      unfiled: { type: 'boolean', description: 'Only lessons in no path.' },
      status: { type: 'string', description: 'Only planned, draft, needs-review or approved.' },
      state: { type: 'string', description: 'Only planned, workspace, published or published-edited.', placeholder: 'state' },
    },
    async (ctx, args) => {
      const library = await ctx.library()
      const catalog = library.catalog
      const pathFilter = stringValue(args.values, 'path')
      const statusFilter = stringValue(args.values, 'status')
      const stateFilter = stringValue(args.values, 'state')
      // Planned lessons have no tutorial, so the list is the catalog's lessons
      // as well as the library's, not the library's alone.
      const planned = (catalog?.lessons ?? []).flatMap((lesson) =>
        lesson.status === 'planned' && !library.tutorials.has(lesson.id) ? [lesson.id] : [],
      )
      const ids = pathFilter
        ? (catalog?.paths.find((candidate) => candidate.id === pathFilter)?.lessonIds ?? (() => { throw new CliError(`There is no path "${pathFilter}".`) })())
        : [...new Set([...library.tutorials.keys(), ...planned])].sort()
      const rows = ids.flatMap((id) => {
        const entry = library.tutorials.get(id)
        const lesson = catalog ? findLesson(catalog, id) : undefined
        const isPlanned = !entry && lesson?.status === 'planned'
        if (!entry && !isPlanned) return []
        const pathOf = catalog ? findPathOfLesson(catalog, id) : undefined
        const state = isPlanned ? 'planned' : entry!.state
        if (args.values.unfiled && pathOf) return []
        if (statusFilter && lesson?.status !== statusFilter) return []
        if (stateFilter && state !== stateFilter) return []
        return [
          {
            id,
            title: entry?.tutorial.title ?? lesson?.title ?? id,
            status: lesson?.status ?? null,
            state,
            path: pathOf?.id ?? null,
            position: pathOf ? pathOf.lessonIds.indexOf(id) + 1 : null,
            steps: entry ? entry.tutorial.steps.length : null,
            seconds: entry ? estimateLearnerSeconds(entry.tutorial) : null,
            objective: lesson?.objective ?? '',
          },
        ]
      })
      ctx.out.result({ lessons: rows, broken: library.broken }, () => [
        ...(rows.length === 0
          ? ['No lessons match.']
          : table(
              rows.map((row) => [row.id, row.title, row.status ?? 'not catalogued', row.state, row.path ? `${row.path} #${row.position}` : '', row.steps === null ? '-' : String(row.steps), row.seconds === null ? '-' : formatMinutes(row.seconds)]),
              ['id', 'title', 'status', 'state', 'path', 'steps', 'time'],
            )),
        ...library.broken.map((broken) => `Broken: ${broken.fileName} fails validation (studio lessons validate ${broken.fileName.replace(/\.json$/, '')}).`),
      ])
    },
  ),

  command('lessons show', 'One lesson: its details, its steps and its quality warnings.', ['<id>'], {}, async (ctx, args) => {
    const id = args.positionals[0]
    const library = await ctx.library()
    const catalog = library.catalog
    const plannedEntry = catalog && !library.tutorials.has(id) ? findLesson(catalog, id) : undefined
    if (plannedEntry?.status === 'planned') {
      const pathOf = catalog ? findPathOfLesson(catalog, id) : undefined
      const position = pathOf ? pathOf.lessonIds.indexOf(id) + 1 : null
      ctx.out.result({ id, state: 'planned', lesson: plannedEntry, path: pathOf?.id ?? null, position, tutorial: null, warnings: [] }, () => [
        `${plannedEntry.title} (${id}), planned`,
        pathOf ? `Path: ${pathOf.title} (${pathOf.id}), lesson ${position} of ${pathOf.lessonIds.length}` : 'Path: none',
        `Objective: ${plannedEntry.objective}`,
        '',
        `No tutorial yet. Generate one with \`studio svg to-steps <file.svg> --id ${id} --source "…" --license "…" --plan <plan.json>\`, or fill it from a file with \`studio lessons import <file.json> --id ${id}\`.`,
      ])
      return
    }
    const { entry, lesson, path: pathOf, position, warnings } = await describeLesson(ctx, id)
    const tutorial = entry.tutorial
    const data = { id: entry.id, state: entry.state, etag: entry.etag, lesson: lesson ?? null, path: pathOf?.id ?? null, position: position >= 0 ? position + 1 : null, tutorial, warnings }
    ctx.out.result(data, () => [
      `${tutorial.title} (${entry.id}), schema v${tutorial.schemaVersion}, ${tutorial.canvas.width}×${tutorial.canvas.height}`,
      `State: ${entry.state}${lesson ? `; status: ${lesson.status}` : '; not in the curriculum'}`,
      pathOf ? `Path: ${pathOf.title} (${pathOf.id}), lesson ${position + 1} of ${pathOf.lessonIds.length}` : 'Path: none',
      ...(lesson ? [`Objective: ${lesson.objective}`] : []),
      ...(lesson?.complexity !== undefined ? [`Complexity: ${lesson.complexity}`] : []),
      ...(lesson?.notes ? [`Notes: ${lesson.notes}`] : []),
      ...(lesson?.reference ? [`Reference: ${lesson.reference.file} (${lesson.reference.source}, ${lesson.reference.license})`] : []),
      ...(lesson?.generation ? [`Generated by ${lesson.generation.model} (${lesson.generation.promptVersion}) on ${lesson.generation.createdAt}: ${lesson.generation.goal}`] : []),
      `Estimated learner time: ${formatMinutes(estimateLearnerSeconds(tutorial))}`,
      '',
      ...table(stepRows(tutorial), ['#', 'id', 'title', 'strokes', 'fills', 'animation']),
      '',
      ...warningLines(warnings),
    ])
  }),

  command('lessons export', 'The lesson’s tutorial JSON, as stored.', ['<id>'], { out: { type: 'string', description: 'Write to this file instead of stdout.', placeholder: 'file' } }, async (ctx, args) => {
    const { stored, tutorial } = await readLesson(ctx, args.positionals[0])
    const out = stringValue(args.values, 'out')
    if (out) {
      await writeFile(out, stored.text)
      ctx.out.result({ file: out }, () => `Wrote ${out}.`)
    } else {
      ctx.out.result(tutorial, () => stored.text.trimEnd())
    }
  }),

  command(
    'lessons import',
    'A tutorial JSON file becomes a workspace draft (Import & test’s "Save as workspace draft").',
    ['<file>'],
    {
      id: { type: 'string', description: 'The lesson id; also its file name once published. Defaults to the document’s id.' },
      title: { type: 'string', description: 'A title, replacing the document’s.' },
      objective: { type: 'string', description: 'The one-line objective shown in the path.' },
      path: { type: 'string', description: 'The path to put it in.', placeholder: 'id' },
      position: { type: 'string', description: 'Its place in that path, counting from 1 (the end by default).', placeholder: 'n' },
    },
    async (ctx, args) => {
      const text = await readFile(args.positionals[0], 'utf8').catch(() => {
        throw new CliError(`Could not read ${args.positionals[0]}.`)
      })
      const parsed = parseTutorialJSON(text)
      if (!parsed.ok) throw new CliError('The file is not a valid tutorial, so it was not imported.', parsed.issues)
      const id = stringValue(args.values, 'id') ?? parsed.tutorial.id
      const library = await ctx.library()
      const { catalog } = await readCatalog(ctx)
      // A planned lesson with nothing drawn for it is a place waiting to be
      // filled: the import takes its place, its objective and its path.
      const placeholder = plannedPlaceholder(catalog, id, new Set(library.tutorials.keys()))
      const objective = stringValue(args.values, 'objective')?.trim() ?? placeholder?.objective
      if (!objective) throw new CliError('Write the one-line objective: --objective "…".')
      const title = stringValue(args.values, 'title')?.trim() || parsed.tutorial.title
      const pathId = stringValue(args.values, 'path')
      const plannedPath = placeholder ? findPathOfLesson(catalog, id)?.id : undefined
      if (placeholder && pathId && plannedPath && pathId !== plannedPath) {
        throw new CliError(`"${id}" is planned in "${plannedPath}", and filling it keeps that place. Drop --path, or move the lesson afterwards.`)
      }
      const position = args.values.position === undefined ? undefined : parseIndex(stringValue(args.values, 'position'), 'The position')
      const tutorial: Tutorial = { ...parsed.tutorial, id, title }
      await replaceTutorial(ctx, id, tutorial, { create: true })
      await editCatalog(ctx, (current) => {
        if (placeholder) return fillPlanned(current, { id, status: 'draft', objective })
        if (findLesson(current, id)) throw new CliError(`"${id}" is already catalogued.`)
        const withEntry = { ...current, lessons: [...current.lessons, lessonRecord({ id, status: 'draft', objective })] }
        return pathId ? placeInPath(withEntry, id, pathId, position) : withEntry
      })
      const where = placeholder ? (plannedPath ?? null) : (pathId ?? null)
      ctx.out.result({ id, path: where, filled: Boolean(placeholder) }, () =>
        placeholder
          ? `Filled the planned lesson ${id} with "${title}"; it is a draft now, in the place it was holding${where ? ` in "${where}"` : ''}.`
          : `Imported "${title}" as the draft ${id}${where ? ` in "${where}"` : ''}.`,
      )
    },
  ),

  command(
    'lessons plan',
    'Hold a place in a path for a lesson nobody has drawn yet: a name, an objective, and nothing else.',
    ['<id>'],
    {
      title: { type: 'string', description: 'The name the planned lesson goes by until its tutorial exists.' },
      objective: { type: 'string', description: 'The one-line objective shown in the path.' },
      path: { type: 'string', description: 'The path it holds a place in.', placeholder: 'id' },
      position: { type: 'string', description: 'Its place in that path, counting from 1 (the end by default).', placeholder: 'n' },
    },
    async (ctx, args) => {
      const id = args.positionals[0]
      const title = stringValue(args.values, 'title')?.trim()
      const objective = stringValue(args.values, 'objective')?.trim()
      const pathId = stringValue(args.values, 'path')
      if (!title || !objective || !pathId) {
        throw new CliError('A planned lesson needs all three: --title "…", --objective "…" and --path <id>.')
      }
      const position = args.values.position === undefined ? undefined : parseIndex(stringValue(args.values, 'position'), 'The position')
      const catalog = await editCatalog(ctx, (current) => planLesson(current, pathId, { id, title, objective }, position))
      const at = catalog.paths.find((path) => path.id === pathId)!.lessonIds.indexOf(id) + 1
      ctx.out.result({ id, path: pathId, position: at, lesson: findLesson(catalog, id) }, () =>
        `Planned "${title}" (${id}) as lesson ${at} in "${pathId}". Generate it with \`studio svg to-steps <file.svg> --id ${id} --source "…" --license "…"\`.`,
      )
    },
  ),

  command(
    'lessons set',
    'Change a lesson’s details: objective, status, complexity, notes, title.',
    ['<id>'],
    {
      objective: { type: 'string', description: 'The one-line objective. Also catalogues a lesson that is not in the curriculum yet.' },
      status: { type: 'string', description: 'draft, needs-review or approved.' },
      complexity: { type: 'string', description: '1 (a path’s first lesson) to 5.', placeholder: 'n' },
      notes: { type: 'string', description: 'Notes for the creator; "" removes them.' },
      title: { type: 'string', description: 'The lesson’s title (in the tutorial itself).' },
    },
    async (ctx, args) => {
      const id = args.positionals[0]
      const objective = stringValue(args.values, 'objective')
      const status = stringValue(args.values, 'status')
      const complexity = args.values.complexity === undefined ? undefined : parseNumber(stringValue(args.values, 'complexity'), 'Complexity')
      const notes = stringValue(args.values, 'notes')
      const title = stringValue(args.values, 'title')
      if ([objective, status, complexity, notes, title].every((value) => value === undefined)) {
        throw new CliError('Say what to change: --objective, --status, --complexity, --notes or --title.')
      }
      if (status !== undefined && !STATUSES.includes(status as LessonStatus)) throw new CliError('--status must be draft, needs-review or approved.')
      const { catalog: before } = await readCatalog(ctx)
      // A planned lesson takes its title and objective here too, but it has no
      // tutorial to read, so it never goes through `readLesson`.
      const planned = findLesson(before, id)?.status === 'planned'
      if (planned) {
        if (status !== undefined) throw new CliError(`"${id}" is a planned lesson; generating its tutorial is what makes it a draft. Use \`studio lessons plan\` fields instead.`)
        const catalog = await editCatalog(ctx, (current) =>
          patchLesson(current, id, (lesson) =>
            lessonRecord({
              ...lesson,
              ...(title !== undefined ? { title: title.trim() } : {}),
              ...(objective !== undefined ? { objective: objective.trim() } : {}),
              ...(complexity !== undefined ? { complexity } : {}),
              ...(notes !== undefined ? { notes: notes.trim() } : {}),
            }),
          ),
        )
        ctx.out.result({ id, lesson: findLesson(catalog, id) ?? null, title: title?.trim() ?? null }, () => `Updated the planned lesson ${id}.`)
        return
      }
      await readLesson(ctx, id)
      if (title !== undefined) {
        if (!title.trim()) throw new CliError('The title cannot be empty.')
        await editTutorial(ctx, id, (doc) => ({ ...doc, title: title.trim() }))
      }
      let entry: Lesson | undefined
      if ([objective, status, complexity, notes].some((value) => value !== undefined)) {
        const catalog = await editCatalog(ctx, (current) => {
          const apply = (lesson: Lesson): Lesson =>
            lessonRecord({
              ...lesson,
              ...(objective !== undefined ? { objective: objective.trim() } : {}),
              ...(status !== undefined ? { status: status as LessonStatus } : {}),
              ...(complexity !== undefined ? { complexity } : {}),
              ...(notes !== undefined ? { notes: notes.trim() } : {}),
            })
          if (findLesson(current, id)) return patchLesson(current, id, apply)
          if (objective === undefined) throw new CliError(`"${id}" is not in the curriculum yet; give it an objective to catalogue it: --objective "…".`)
          return { ...current, lessons: [...current.lessons, apply({ id, status: 'draft', objective: '' })] }
        })
        entry = findLesson(catalog, id)
      }
      ctx.out.result({ id, lesson: entry ?? null, title: title?.trim() ?? null }, () => `Updated ${id}.`)
    },
  ),

  command(
    'lessons move',
    'Put a lesson in a path, or take it out of every path.',
    ['<id>'],
    {
      path: { type: 'string', description: 'The path to move it to.', placeholder: 'id' },
      position: { type: 'string', description: 'Its place in that path, counting from 1 (the end by default).', placeholder: 'n' },
      unfiled: { type: 'boolean', description: 'Take it out of every path.' },
    },
    async (ctx, args) => {
      const id = args.positionals[0]
      const pathId = stringValue(args.values, 'path')
      const position = args.values.position === undefined ? undefined : parseIndex(stringValue(args.values, 'position'), 'The position')
      if (!pathId && !args.values.unfiled) throw new CliError('Say where: --path <id> or --unfiled.')
      await editCatalog(ctx, (current) => {
        requireLesson(current, id)
        return pathId ? placeInPath(current, id, pathId, position) : assignLesson(current, id, null)
      })
      ctx.out.result({ id, path: pathId ?? null, position: position ?? null }, () => (pathId ? `Moved ${id} to "${pathId}"${position ? ` at ${position}` : ''}.` : `${id} is in no path now.`))
    },
  ),

  command('lessons duplicate', 'A copy of a lesson as a new draft, right after it in its path.', ['<id>'], {}, async (ctx, args) => {
    const store = await ctx.workspace()
    const { lessonId } = await store.duplicate(args.positionals[0])
    ctx.out.result({ lessonId }, () => `Duplicated ${args.positionals[0]} as the draft ${lessonId}.`)
  }),

  command('lessons delete', 'Move a lesson to the trash. A published lesson is unpublished first.', ['<id>'], {}, async (ctx, args) => {
    const id = args.positionals[0]
    const { catalog } = await readCatalog(ctx)
    if (findLesson(catalog, id)?.status === 'planned') {
      const store = await ctx.workspace()
      await store.deleteLesson(id)
      ctx.out.result({ id, files: [] as string[] }, () => `Moved the planned lesson ${id} to the trash (studio trash restore brings it back).`)
      return
    }
    const { entry } = await describeLesson(ctx, id)
    if (entry.state !== 'workspace') {
      await ctx.out.confirm(`"${id}" is published. Deleting it removes it from shared/ and moves it to the trash.`, id, ctx.flags.yes)
    }
    const store = await ctx.workspace()
    const { files } = await store.deleteLesson(id)
    ctx.out.result({ id, files }, () => [`Moved ${id} to the trash (studio trash restore brings it back).`, ...(files.length > 0 ? [`Changed in shared/: git add -- ${files.join(' ')}`] : [])])
  }),

  command('lessons unpublish', 'Take a lesson out of shared/, keeping it in the workspace.', ['<id>'], {}, async (ctx, args) => {
    const id = args.positionals[0]
    refusePlanned(id, findLesson((await readCatalog(ctx)).catalog, id), 'unpublished')
    await ctx.out.confirm(`Unpublishing "${id}" removes it from shared/; it stays editable in the workspace.`, id, ctx.flags.yes)
    const store = await ctx.workspace()
    const { files } = await store.unpublish(id)
    ctx.out.result({ id, files }, () => [`Unpublished ${id}.`, `Changed in shared/: git add -- ${files.join(' ')}`])
  }),

  command(
    'lessons approve',
    'Mark a lesson approved, after its quality warnings.',
    ['<id>'],
    { 'fail-on-warnings': { type: 'boolean', description: 'Refuse to approve while there are quality warnings.' } },
    async (ctx, args) => {
      const id = args.positionals[0]
      const { lesson, warnings } = await describeLesson(ctx, id)
      if (!lesson) throw new CliError(`"${id}" is not in the curriculum; catalogue it first (studio lessons set ${id} --objective "…").`)
      if (args.values['fail-on-warnings'] && warnings.length > 0) throw new CliError(`Not approved: ${plural(warnings.length, 'quality warning')}.\n${warnings.map((w) => `  ${w.path}: ${w.message}`).join('\n')}`)
      if (lesson.status !== 'approved') await editCatalog(ctx, (current) => patchLesson(current, id, (entry) => ({ ...entry, status: 'approved' })))
      ctx.out.result({ id, status: 'approved', warnings }, () => [...warningLines(warnings), `Approved ${id}: it is ready to publish.`])
    },
  ),

  command('lessons validate', 'Check a lesson, or a tutorial JSON file, strictly.', ['<id-or-file>'], {}, async (ctx, args) => {
    const target = args.positionals[0]
    const fromFile = target.endsWith('.json') || target.includes('/')
    let verdict
    if (fromFile) {
      const text = await readFile(target, 'utf8').catch(() => {
        throw new CliError(`Could not read ${target}.`)
      })
      verdict = parseTutorialJSON(text)
    } else {
      const store = await ctx.workspace()
      const stored = await store.readTutorial(target)
      if (!stored) throw new CliError(`There is no lesson "${target}".`)
      verdict = parseTutorialJSON(stored.text)
    }
    if (!verdict.ok) throw new CliError(`${target} is not valid: ${plural(verdict.issues.length, 'problem')}.`, verdict.issues)
    ctx.out.result({ ok: true, id: verdict.tutorial.id, steps: verdict.tutorial.steps.length }, () => `${target} is valid: "${verdict.tutorial.title}", ${plural(verdict.tutorial.steps.length, 'step')}.`)
  }),

  command('lessons quality', 'The quality warnings the Studio shows before approval.', ['<id>'], {}, async (ctx, args) => {
    const { warnings } = await describeLesson(ctx, args.positionals[0])
    ctx.out.result({ warnings }, () => warningLines(warnings))
  }),

  command(
    'lessons reference set',
    'Store a reference image (JPEG, PNG, WebP or SVG) with a lesson, recording its source and licence.',
    ['<id>', '<file>'],
    {
      source: { type: 'string', description: 'Where the image came from.' },
      license: { type: 'string', description: 'The terms it may be used under.' },
    },
    async (ctx, args) => {
      const [id, file] = args.positionals
      const source = stringValue(args.values, 'source')?.trim()
      const license = stringValue(args.values, 'license')?.trim()
      if (!source || !license) throw new CliError('Record where the image came from and its licence: --source "…" --license "…".')
      const bytes = await readFile(file).catch(() => {
        throw new CliError(`Could not read ${file}.`)
      })
      const contentType = contentTypeOf(file.toLowerCase())
      if (!REFERENCE_TYPES[contentType]) throw new CliError('Reference images must be JPEG, PNG, WebP or SVG, named with that extension.')
      await readLesson(ctx, id)
      const store = await ctx.workspace()
      const stored = await store.writeReference(id, contentType, new Uint8Array(bytes))
      await editCatalog(ctx, (current) => {
        const reference = { file: stored.file, source, license }
        return findLesson(current, id)
          ? patchLesson(current, id, (lesson) => lessonRecord({ ...lesson, reference }))
          : { ...current, lessons: [...current.lessons, lessonRecord({ id, status: 'draft', objective: '', reference })] }
      })
      ctx.out.result({ id, file: stored.file }, () => `Stored ${stored.file} as the reference of ${id}.`)
    },
  ),

  command('lessons reference export', 'Write a lesson’s reference image to a file.', ['<id>'], { out: { type: 'string', description: 'The file to write (default: the reference’s own name).', placeholder: 'file' } }, async (ctx, args) => {
    const id = args.positionals[0]
    const { catalog } = await readCatalog(ctx)
    const lesson = requireLesson(catalog, id)
    if (!lesson.reference) throw new CliError(`${id} has no reference image.`)
    const store = await ctx.workspace()
    const reference = await store.readReference(lesson.reference.file)
    if (!reference) throw new CliError(`The reference ${lesson.reference.file} is missing.`)
    const out = stringValue(args.values, 'out') ?? path.basename(lesson.reference.file)
    await writeFile(out, reference.bytes)
    ctx.out.result({ id, file: out, contentType: reference.contentType }, () => `Wrote ${out} (${reference.contentType}, ${reference.bytes.byteLength} bytes).`)
  }),
]
