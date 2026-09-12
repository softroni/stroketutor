import { listVisionModels } from '../../server/models'
import { readyCount } from '../../src/catalog/publishing'

import { command, type Command } from '../command'
import { plural, table } from '../output'

/** Commands about the whole Studio: where things are, what is pending, what can generate. */
export const statusCommands: Command[] = [
  command('status', 'The working library: paths, lessons, what publishing would change.', [], {}, async (ctx) => {
    const library = await ctx.library()
    const store = await ctx.workspace()
    const trash = store.listTrash()
    const catalog = library.catalog
    const states = { workspace: 0, published: 0, 'published-edited': 0 }
    for (const entry of library.tutorials.values()) states[entry.state] += 1
    const unfiled = catalog
      ? catalog.lessons.filter((lesson) => !catalog.paths.some((path) => path.lessonIds.includes(lesson.id))).length
      : 0
    const uncatalogued = catalog ? [...library.tutorials.keys()].filter((id) => !catalog.lessons.some((lesson) => lesson.id === id)) : []
    const data = {
      workspace: ctx.workspaceFile,
      shared: ctx.sharedDir,
      paths: catalog?.paths.length ?? 0,
      lessons: library.tutorials.size,
      states,
      unfiled,
      uncatalogued,
      broken: library.broken.map((broken) => broken.fileName),
      catalogIssues: library.catalogIssues,
      pending: library.publishing.pending,
      ready: readyCount(library.publishing.pending),
      sharedChangedOutside: library.publishing.sharedChangedOutside,
      trash: trash.length,
      keyConfigured: Boolean(ctx.env.OPENROUTER_API_KEY),
      defaultModel: ctx.flags.model || ctx.env.OPENROUTER_MODEL || null,
    }
    ctx.out.result(data, () => {
      const lines = [
        `Workspace: ${data.workspace}`,
        `Published: ${data.shared}`,
        '',
        `${plural(data.paths, 'path')}, ${plural(data.lessons, 'lesson')}: ${states.workspace} in the workspace, ${states.published} published, ${states['published-edited']} published with edits.`,
      ]
      if (unfiled > 0) lines.push(`${plural(unfiled, 'lesson')} in no path.`)
      if (uncatalogued.length > 0) lines.push(`Not in the curriculum: ${uncatalogued.join(', ')}.`)
      if (library.broken.length > 0) lines.push(`Broken (fail validation): ${data.broken.join(', ')}.`)
      for (const issue of library.catalogIssues) lines.push(`Curriculum problem in ${issue.file} at ${issue.path}: ${issue.message}`)
      lines.push('')
      if (data.pending.length === 0) lines.push('Nothing to publish.')
      else {
        lines.push(`To publish (${data.ready} ready):`)
        for (const change of data.pending) {
          if (change.kind === 'curriculum') lines.push('  the curriculum (paths, titles or order changed)')
          else if (change.kind === 'new') lines.push(`  ${change.lessonId}: new${change.ready ? ', approved' : ', not yet approved'}`)
          else lines.push(`  ${change.lessonId}: ${change.parts.join(', ')} changed${change.ready ? '' : ', not yet approved'}`)
        }
      }
      if (data.sharedChangedOutside) lines.push('shared/Catalog changed outside the Studio: run `studio adopt-shared` before publishing.')
      if (trash.length > 0) lines.push(`${plural(trash.length, 'item')} in the trash.`)
      lines.push('', data.keyConfigured ? `OpenRouter key configured; model: ${data.defaultModel ?? 'none (pass --model)'}.` : 'No OpenRouter key: generation is unavailable (add OPENROUTER_API_KEY to web/.env.local).')
      return lines
    })
  }),

  command('settings', 'Where the command line reads and writes, and whether generation is possible.', [], {}, async (ctx) => {
    let chromium: string | null = null
    try {
      const playwright = await import('playwright')
      const executable = playwright.chromium.executablePath()
      const { existsSync } = await import('node:fs')
      chromium = existsSync(executable) ? executable : null
    } catch {
      chromium = null
    }
    const data = {
      workspace: ctx.workspaceFile,
      shared: ctx.sharedDir,
      backups: ctx.backupDir ?? null,
      keyConfigured: Boolean(ctx.env.OPENROUTER_API_KEY),
      defaultModel: ctx.flags.model || ctx.env.OPENROUTER_MODEL || null,
      chromium,
    }
    ctx.out.result(data, () => [
      `Workspace:  ${data.workspace}`,
      `shared/:    ${data.shared}`,
      `Backups:    ${data.backups ?? 'none'}`,
      `OpenRouter: ${data.keyConfigured ? 'key configured' : 'no key (add OPENROUTER_API_KEY to web/.env.local)'}`,
      `Model:      ${data.defaultModel ?? 'none (set OPENROUTER_MODEL or pass --model)'}`,
      `Chromium:   ${data.chromium ?? 'not installed (run `npx playwright install chromium` once for svg and generate commands)'}`,
    ])
  }),

  command('models', 'The OpenRouter models that take images and honour structured output.', [], {}, async (ctx) => {
    const models = await listVisionModels()
    ctx.out.result({ models }, () =>
      models.length === 0
        ? ['No models could be listed (is the network available?).']
        : table(
            models.map((model) => [
              model.id,
              model.name,
              model.contextLength === null ? '' : String(model.contextLength),
              model.promptPerMillion === null ? '' : `$${model.promptPerMillion.toFixed(2)}`,
              model.completionPerMillion === null ? '' : `$${model.completionPerMillion.toFixed(2)}`,
            ]),
            ['id', 'name', 'context', 'prompt/M', 'completion/M'],
          ),
    )
  }),

  command('adopt-shared', 'Take shared/Catalog as it now is, after a git pull or a hand edit.', [], {}, async (ctx) => {
    const store = await ctx.workspace()
    await store.adoptShared()
    ctx.out.result({ ok: true }, () => 'Adopted: published lessons and paths now follow shared/; workspace-only lessons kept their places.')
  }),
]
