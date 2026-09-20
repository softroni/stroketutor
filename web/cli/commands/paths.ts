import { estimateLearnerSeconds, formatMinutes } from '../../src/catalog/metrics'
import { findLesson, findLevel } from '../../src/catalog/types'
import {
  assignLesson,
  createLevel,
  createPath,
  deleteLevel,
  moveLevel,
  movePath,
  reorderLessons,
  slugify,
  updateLevel,
  updatePath,
} from '../../src/studio/pathOps'

import { parseIndex, stringValue } from '../args'
import { command, type Command } from '../command'
import { editCatalog, readCatalog, requirePath } from '../edit'
import { CliError, plural, table } from '../output'

/** The Paths view: the curriculum's shape. Every change is saved in the workspace at once. */
export const curriculumCommands: Command[] = [
  command('paths list', 'Every path in the working curriculum, in order.', [], {}, async (ctx) => {
    const { catalog } = await readCatalog(ctx)
    ctx.out.result({ levels: catalog.levels, paths: catalog.paths }, () =>
      catalog.paths.length === 0
        ? ['No paths yet. `studio paths create --title "…"` makes one.']
        : table(
            catalog.paths.map((path, index) => [String(index + 1), path.id, path.title, path.level ?? '', plural(path.lessonIds.length, 'lesson'), path.description ?? '']),
            ['#', 'id', 'title', 'level', 'lessons', 'description'],
          ),
    )
  }),

  command('paths show', 'One path and its lessons in unlock order.', ['<id>'], {}, async (ctx, args) => {
    const library = await ctx.library()
    const catalog = library.catalog ?? (await readCatalog(ctx)).catalog
    const path = requirePath(catalog, args.positionals[0])
    const level = path.level ? findLevel(catalog, path.level) : undefined
    const lessons = path.lessonIds.map((id) => {
      const entry = library.tutorials.get(id)
      const lesson = findLesson(catalog, id)
      const planned = lesson?.status === 'planned' && !entry
      return {
        id,
        title: entry?.tutorial.title ?? lesson?.title ?? '(missing)',
        status: lesson?.status ?? 'uncatalogued',
        state: planned ? 'planned' : (entry?.state ?? 'missing'),
        objective: lesson?.objective ?? '',
        steps: entry?.tutorial.steps.length ?? 0,
        minutes: entry ? formatMinutes(estimateLearnerSeconds(entry.tutorial)) : '',
      }
    })
    ctx.out.result({ path, level: level ?? null, lessons }, () => [
      `${path.title} (${path.id})`,
      ...(path.description ? [path.description] : []),
      `Level: ${level ? `${level.title} (${level.id})` : 'none'}`,
      '',
      ...(lessons.length === 0
        ? ['No lessons in this path.']
        : table(
            lessons.map((lesson, index) => [String(index + 1), lesson.id, lesson.title, lesson.status, lesson.state, lesson.steps === 0 ? '-' : String(lesson.steps), lesson.minutes, lesson.objective]),
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
      level: { type: 'string', description: 'The level to group the path under.', placeholder: 'id' },
    },
    async (ctx, args) => {
      const title = stringValue(args.values, 'title')
      if (!title) throw new CliError('Give the path a title: --title "…".')
      const id = args.positionals[0] ?? slugify(title)
      if (!id) throw new CliError('The title makes no id; pass one: studio paths create <id> --title "…".')
      const description = stringValue(args.values, 'description') ?? ''
      const level = stringValue(args.values, 'level') ?? null
      const catalog = await editCatalog(ctx, (current) => createPath(current, id, { title, description, level }))
      ctx.out.result({ path: requirePath(catalog, id) }, () => `Created the path "${title}" (${id}), number ${catalog.paths.length}${level ? ` in the level "${level}"` : ''}.`)
    },
  ),

  command(
    'paths level',
    'Group a path under a level, or take it out of every level.',
    ['<id>', '[levelId]'],
    { none: { type: 'boolean', description: 'List the path after the levels instead of under one.' } },
    async (ctx, args) => {
      const [id, levelId] = args.positionals
      if (!levelId && !args.values.none) throw new CliError('Say which level: studio paths level <id> <levelId>, or --none.')
      if (levelId && args.values.none) throw new CliError('Pass a level id or --none, not both.')
      const level = args.values.none ? null : levelId
      const catalog = await editCatalog(ctx, (current) => {
        const path = requirePath(current, id)
        return updatePath(current, id, { title: path.title, description: path.description ?? '', level })
      })
      ctx.out.result({ path: requirePath(catalog, id) }, () =>
        level ? `"${id}" is now in the level "${level}".` : `"${id}" is in no level; it is listed after the levels.`,
      )
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

/**
 * Levels: the bands the path list is grouped into, easiest first. A level only
 * groups and recommends; nothing is ever locked behind one.
 */
export const levelCommands: Command[] = [
  command('levels list', 'Every level, easiest first, with how many paths it groups.', [], {}, async (ctx) => {
    const { catalog } = await readCatalog(ctx)
    const counts = catalog.levels.map((level) => catalog.paths.filter((path) => path.level === level.id).length)
    const loose = catalog.paths.filter((path) => !path.level).length
    ctx.out.result({ levels: catalog.levels, counts, pathsWithoutLevel: loose }, () => [
      ...(catalog.levels.length === 0
        ? ['No levels yet: the curriculum is one flat list of paths. `studio levels create --title "…"` makes one.']
        : table(
            catalog.levels.map((level, index) => [String(index + 1), level.id, level.title, plural(counts[index], 'path'), level.description ?? '']),
            ['#', 'id', 'title', 'paths', 'description'],
          )),
      ...(loose > 0 ? [`${plural(loose, 'path')} in no level; they are listed after the levels.`] : []),
    ])
  }),

  command(
    'levels create',
    'A new level at the end. The id is fixed once created.',
    ['[id]'],
    {
      title: { type: 'string', description: 'A name, not a number: "Starter", not "Level 1".' },
      description: { type: 'string', description: 'One line on what the paths of this level teach.' },
    },
    async (ctx, args) => {
      const title = stringValue(args.values, 'title')
      if (!title) throw new CliError('Give the level a title: --title "…".')
      const id = args.positionals[0] ?? slugify(title)
      if (!id) throw new CliError('The title makes no id; pass one: studio levels create <id> --title "…".')
      const description = stringValue(args.values, 'description') ?? ''
      const catalog = await editCatalog(ctx, (current) => createLevel(current, id, { title, description }))
      ctx.out.result({ level: requireLevel(catalog, id) }, () => `Created the level "${title}" (${id}), number ${catalog.levels.length}.`)
    },
  ),

  command('levels rename', 'A new title for a level.', ['<id>', '<title>'], {}, async (ctx, args) => {
    const [id, title] = args.positionals
    const catalog = await editCatalog(ctx, (current) =>
      updateLevel(current, id, { title, description: requireLevel(current, id).description ?? '' }),
    )
    ctx.out.result({ level: requireLevel(catalog, id) }, () => `Renamed "${id}" to "${title.trim()}".`)
  }),

  command('levels describe', 'A new description for a level; an empty text removes it.', ['<id>', '<description>'], {}, async (ctx, args) => {
    const [id, description] = args.positionals
    const catalog = await editCatalog(ctx, (current) => updateLevel(current, id, { title: requireLevel(current, id).title, description }))
    ctx.out.result({ level: requireLevel(catalog, id) }, () => (description.trim() ? `Described "${id}".` : `Removed the description of "${id}".`))
  }),

  command(
    'levels move',
    'Change where a level comes in the curriculum.',
    ['<id>'],
    {
      to: { type: 'string', description: 'Its new place, counting from 1.', placeholder: 'n' },
      up: { type: 'boolean', description: 'One place earlier.' },
      down: { type: 'boolean', description: 'One place later.' },
    },
    async (ctx, args) => {
      const id = args.positionals[0]
      const catalog = await editCatalog(ctx, (current) => {
        const from = current.levels.findIndex((level) => level.id === id)
        if (from < 0) throw new CliError(`There is no level "${id}".`)
        return moveLevel(current, from, target(args.values, from, current.levels.length, 'The level'))
      })
      const at = catalog.levels.findIndex((level) => level.id === id) + 1
      ctx.out.result({ id, position: at }, () => `"${id}" is now level ${at} of ${catalog.levels.length}.`)
    },
  ),

  command('levels delete', 'Remove a level. Only one with no path under it can go.', ['<id>'], {}, async (ctx, args) => {
    const id = args.positionals[0]
    const { catalog: before } = await readCatalog(ctx)
    const level = requireLevel(before, id)
    await editCatalog(ctx, (current) => deleteLevel(current, id))
    ctx.out.result({ id }, () => `Deleted the level "${level.title}" (${id}).`)
  }),
]

function requireLevel(catalog: { levels: { id: string; title: string; description?: string }[] }, id: string) {
  const level = catalog.levels.find((candidate) => candidate.id === id)
  if (!level) throw new CliError(`There is no level "${id}".`)
  return level
}

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
