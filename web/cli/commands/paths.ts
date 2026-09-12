import { estimateLearnerSeconds, formatMinutes } from '../../src/catalog/metrics'
import { findLesson } from '../../src/catalog/types'
import { assignLesson, createPath, movePath, reorderLessons, slugify, updatePath } from '../../src/studio/pathOps'

import { parseIndex, stringValue } from '../args'
import { command, type Command } from '../command'
import { editCatalog, readCatalog, requirePath } from '../edit'
import { CliError, plural, table } from '../output'

/** The Paths view: the curriculum's shape. Every change is saved in the workspace at once. */
export const curriculumCommands: Command[] = [
  command('paths list', 'Every path in the working curriculum, in order.', [], {}, async (ctx) => {
    const { catalog } = await readCatalog(ctx)
    ctx.out.result({ paths: catalog.paths }, () =>
      catalog.paths.length === 0
        ? ['No paths yet. `studio paths create --title "…"` makes one.']
        : table(
            catalog.paths.map((path, index) => [String(index + 1), path.id, path.title, plural(path.lessonIds.length, 'lesson'), path.description ?? '']),
            ['#', 'id', 'title', 'lessons', 'description'],
          ),
    )
  }),

  command('paths show', 'One path and its lessons in unlock order.', ['<id>'], {}, async (ctx, args) => {
    const library = await ctx.library()
    const catalog = library.catalog ?? (await readCatalog(ctx)).catalog
    const path = requirePath(catalog, args.positionals[0])
    const lessons = path.lessonIds.map((id) => {
      const entry = library.tutorials.get(id)
      const lesson = findLesson(catalog, id)
      return {
        id,
        title: entry?.tutorial.title ?? '(missing)',
        status: lesson?.status ?? 'uncatalogued',
        state: entry?.state ?? 'missing',
        objective: lesson?.objective ?? '',
        steps: entry?.tutorial.steps.length ?? 0,
        minutes: entry ? formatMinutes(estimateLearnerSeconds(entry.tutorial)) : '',
      }
    })
    ctx.out.result({ path, lessons }, () => [
      `${path.title} (${path.id})`,
      ...(path.description ? [path.description] : []),
      '',
      ...(lessons.length === 0
        ? ['No lessons in this path.']
        : table(
            lessons.map((lesson, index) => [String(index + 1), lesson.id, lesson.title, lesson.status, lesson.state, String(lesson.steps), lesson.minutes, lesson.objective]),
            ['#', 'id', 'title', 'status', 'state', 'steps', 'time', 'objective'],
          )),
    ])
  }),

  command(
    'paths create',
    'A new path at the end of the curriculum. The id is fixed once created.',
    ['[id]'],
    {
      title: { type: 'string', description: 'The title learners see.' },
      description: { type: 'string', description: 'What the path teaches, in a sentence or two.' },
    },
    async (ctx, args) => {
      const title = stringValue(args.values, 'title')
      if (!title) throw new CliError('Give the path a title: --title "…".')
      const id = args.positionals[0] ?? slugify(title)
      if (!id) throw new CliError('The title makes no id; pass one: studio paths create <id> --title "…".')
      const description = stringValue(args.values, 'description') ?? ''
      const catalog = await editCatalog(ctx, (current) => createPath(current, id, { title, description }))
      ctx.out.result({ path: requirePath(catalog, id) }, () => `Created the path "${title}" (${id}), number ${catalog.paths.length}.`)
    },
  ),

  command('paths rename', 'A new title for a path.', ['<id>', '<title>'], {}, async (ctx, args) => {
    const [id, title] = args.positionals
    const catalog = await editCatalog(ctx, (current) => {
      const path = requirePath(current, id)
      return updatePath(current, id, { title, description: path.description ?? '' })
    })
    ctx.out.result({ path: requirePath(catalog, id) }, () => `Renamed "${id}" to "${title.trim()}".`)
  }),

  command('paths describe', 'A new description for a path; an empty text removes it.', ['<id>', '<description>'], {}, async (ctx, args) => {
    const [id, description] = args.positionals
    const catalog = await editCatalog(ctx, (current) => updatePath(current, id, { title: requirePath(current, id).title, description }))
    ctx.out.result({ path: requirePath(catalog, id) }, () => (description.trim() ? `Described "${id}".` : `Removed the description of "${id}".`))
  }),

  command(
    'paths move',
    'Change where a path comes in the curriculum.',
    ['<id>'],
    {
      to: { type: 'string', description: 'Its new place, counting from 1.', placeholder: 'n' },
      up: { type: 'boolean', description: 'One place earlier.' },
      down: { type: 'boolean', description: 'One place later.' },
    },
    async (ctx, args) => {
      const id = args.positionals[0]
      const catalog = await editCatalog(ctx, (current) => {
        const from = current.paths.findIndex((path) => path.id === id)
        if (from < 0) throw new CliError(`There is no path "${id}".`)
        return movePath(current, from, target(args.values, from, current.paths.length, 'The path'))
      })
      const at = catalog.paths.findIndex((path) => path.id === id) + 1
      ctx.out.result({ id, position: at }, () => `"${id}" is now path ${at} of ${catalog.paths.length}.`)
    },
  ),

  command(
    'paths reorder',
    'Change where a lesson comes in its path.',
    ['<id>', '<lessonId>'],
    {
      to: { type: 'string', description: 'Its new place in the path, counting from 1.', placeholder: 'n' },
      earlier: { type: 'boolean', description: 'One place earlier.' },
      later: { type: 'boolean', description: 'One place later.' },
    },
    async (ctx, args) => {
      const [id, lessonId] = args.positionals
      const catalog = await editCatalog(ctx, (current) => {
        const path = requirePath(current, id)
        const from = path.lessonIds.indexOf(lessonId)
        if (from < 0) throw new CliError(`"${lessonId}" is not in the path "${id}".`)
        return reorderLessons(current, id, from, target({ ...args.values, up: args.values.earlier, down: args.values.later }, from, path.lessonIds.length, 'The lesson'))
      })
      const path = requirePath(catalog, id)
      const at = path.lessonIds.indexOf(lessonId) + 1
      ctx.out.result({ id, lessonId, position: at }, () => `"${lessonId}" is now lesson ${at} of ${path.lessonIds.length} in "${id}".`)
    },
  ),

  command('paths add', 'Put catalogued lessons at the end of a path, taking each out of the path it was in.', ['<id>', '<lessonId...>'], {}, async (ctx, args) => {
    const [id, ...lessonIds] = args.positionals
    const catalog = await editCatalog(ctx, (current) => lessonIds.reduce((next, lessonId) => assignLesson(next, lessonId, id), current))
    ctx.out.result({ path: requirePath(catalog, id) }, () => `Added ${lessonIds.join(', ')} to "${id}" (${plural(requirePath(catalog, id).lessonIds.length, 'lesson')} now).`)
  }),

  command(
    'paths delete',
    'Move a path to the trash. Its lessons stay, in no path, unless --lessons trash.',
    ['<id>'],
    { lessons: { type: 'string', description: '`unfile` (the default) keeps the lessons outside every path; `trash` deletes them too.', placeholder: 'unfile|trash' } },
    async (ctx, args) => {
      const id = args.positionals[0]
      const mode = stringValue(args.values, 'lessons') ?? 'unfile'
      if (mode !== 'unfile' && mode !== 'trash') throw new CliError('--lessons must be unfile or trash.')
      const { catalog } = await readCatalog(ctx)
      const path = requirePath(catalog, id)
      if (mode === 'trash' && path.lessonIds.length > 0) {
        const library = await ctx.library()
        const published = path.lessonIds.filter((lessonId) => library.tutorials.get(lessonId)?.state !== 'workspace')
        await ctx.out.confirm(
          `This moves the path "${path.title}" and its ${plural(path.lessonIds.length, 'lesson')} to the trash${published.length > 0 ? `, unpublishing ${published.join(', ')} from shared/` : ''}.`,
          id,
          ctx.flags.yes,
        )
      }
      const store = await ctx.workspace()
      const { files } = await store.deletePath(id, mode)
      ctx.out.result({ id, lessons: mode, files }, () => [
        `Moved the path "${path.title}" to the trash${mode === 'trash' ? ' with its lessons' : path.lessonIds.length > 0 ? `; its ${plural(path.lessonIds.length, 'lesson')} are in no path now` : ''}.`,
        ...(files.length > 0 ? [`Changed in shared/: git add -- ${files.join(' ')}`] : []),
      ])
    },
  ),
]

/** The zero-based target of a move from `--to`, `--up` or `--down`. */
function target(values: Record<string, unknown>, from: number, count: number, what: string): number {
  if (values.up) return Math.max(0, from - 1)
  if (values.down) return Math.min(count - 1, from + 1)
  const to = values.to
  if (typeof to !== 'string') throw new CliError(`Say where it goes: --to <n>, --up/--earlier or --down/--later.`)
  const index = parseIndex(to, `${what}'s place`)
  if (index > count) throw new CliError(`${what}'s place must be between 1 and ${count}.`)
  return index - 1
}
