import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { REFERENCE_TYPES, contentTypeOf } from '../../server/repoWriter'
import { estimateLearnerSeconds, formatMinutes } from '../../src/catalog/metrics'
import { findLesson, findPathOfLesson, type Lesson, type LessonStatus } from '../../src/catalog/types'
import { parseTutorialJSON } from '../../src/schema/validate'
import { stepDuration, type Tutorial } from '../../src/schema/types'
import { assignLesson } from '../../src/studio/pathOps'
import { qualityWarnings, type QualityWarning } from '../../src/studio/quality'

import { parseIndex, parseNumber, stringValue } from '../args'
import { command, type Command } from '../command'
import type { Context } from '../context'
import { editCatalog, editTutorial, lessonRecord, patchLesson, placeInPath, readCatalog, readLesson, replaceTutorial, requireLesson } from '../edit'
import { CliError, plural, table } from '../output'

const STATUSES: LessonStatus[] = ['draft', 'needs-review', 'approved']

/** The lesson as the Paths view lists it: its tutorial, its catalog entry, its place. */
async function describeLesson(ctx: Context, id: string) {
  const library = await ctx.library()
  const entry = library.tutorials.get(id)
  const broken = library.broken.find((candidate) => candidate.fileName === `${id}.json`)
  if (!entry && broken) throw new CliError(`The lesson "${id}" fails validation.`, broken.issues)
  if (!entry) throw new CliError(`There is no lesson "${id}".`)
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
      status: { type: 'string', description: 'Only draft, needs-review or approved.' },
      state: { type: 'string', description: 'Only workspace, published or published-edited.', placeholder: 'state' },
    },
    async (ctx, args) => {
      const library = await ctx.library()
      const catalog = library.catalog
      const pathFilter = stringValue(args.values, 'path')
      const statusFilter = stringValue(args.values, 'status')
      const stateFilter = stringValue(args.values, 'state')
      const ids = pathFilter
        ? (catalog?.paths.find((candidate) => candidate.id === pathFilter)?.lessonIds ?? (() => { throw new CliError(`There is no path "${pathFilter}".`) })())
        : [...library.tutorials.keys()].sort()
      const rows = ids.flatMap((id) => {
        const entry = library.tutorials.get(id)
        if (!entry) return []
        const lesson = catalog ? findLesson(catalog, id) : undefined
        const pathOf = catalog ? findPathOfLesson(catalog, id) : undefined
        if (args.values.unfiled && pathOf) return []
        if (statusFilter && lesson?.status !== statusFilter) return []
        if (stateFilter && entry.state !== stateFilter) return []
        return [
          {
            id,
            title: entry.tutorial.title,
            status: lesson?.status ?? null,
            state: entry.state,
            path: pathOf?.id ?? null,
            position: pathOf ? pathOf.lessonIds.indexOf(id) + 1 : null,
            steps: entry.tutorial.steps.length,
            seconds: estimateLearnerSeconds(entry.tutorial),
            objective: lesson?.objective ?? '',
          },
        ]
      })
      ctx.out.result({ lessons: rows, broken: library.broken }, () => [
        ...(rows.length === 0
          ? ['No lessons match.']
          : table(
              rows.map((row) => [row.id, row.title, row.status ?? 'not catalogued', row.state, row.path ? `${row.path} #${row.position}` : '', String(row.steps), formatMinutes(row.seconds)]),
              ['id', 'title', 'status', 'state', 'path', 'steps', 'time'],
            )),
        ...library.broken.map((broken) => `Broken: ${broken.fileName} fails validation (studio lessons validate ${broken.fileName.replace(/\.json$/, '')}).`),
      ])
    },
  ),

  command('lessons show', 'One lesson: its details, its steps and its quality warnings.', ['<id>'], {}, async (ctx, args) => {
    const { entry, lesson, path: pathOf, position, warnings } = await describeLesson(ctx, args.positionals[0])
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
      const objective = stringValue(args.values, 'objective')?.trim()
      if (!objective) throw new CliError('Write the one-line objective: --objective "…".')
      const title = stringValue(args.values, 'title')?.trim() || parsed.tutorial.title
      const pathId = stringValue(args.values, 'path')
      const position = args.values.position === undefined ? undefined : parseIndex(stringValue(args.values, 'position'), 'The position')
      const tutorial: Tutorial = { ...parsed.tutorial, id, title }
      await replaceTutorial(ctx, id, tutorial, { create: true })
      await editCatalog(ctx, (current) => {
        if (findLesson(current, id)) throw new CliError(`"${id}" is already catalogued.`)
        const withEntry = { ...current, lessons: [...current.lessons, lessonRecord({ id, status: 'draft', objective })] }
        return pathId ? placeInPath(withEntry, id, pathId, position) : withEntry
      })
      ctx.out.result({ id, path: pathId ?? null }, () => `Imported "${title}" as the draft ${id}${pathId ? ` in "${pathId}"` : ''}.`)
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
