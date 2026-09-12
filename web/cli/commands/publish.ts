import { readyCount, type PendingChange } from '../../src/catalog/publishing'

import { command, type Command } from '../command'
import type { Context } from '../context'
import { gitAddLine, plural } from '../output'

function pendingLines(pending: PendingChange[]): string[] {
  if (pending.length === 0) return ['Nothing to publish: shared/ matches the workspace.']
  const lines = [`${plural(pending.length, 'change')} to publish, ${readyCount(pending)} ready:`]
  for (const change of pending) {
    if (change.kind === 'curriculum') {
      lines.push('  the curriculum:')
      lines.push(`    before: ${change.before.map((path) => `${path.id} [${path.lessonIds.join(', ')}]`).join('; ') || '(empty)'}`)
      lines.push(`    after:  ${change.after.map((path) => `${path.id} [${path.lessonIds.join(', ')}]`).join('; ') || '(empty)'}`)
    } else if (change.kind === 'new') {
      lines.push(`  ${change.lessonId}: new lesson${change.ready ? ' (approved, ready)' : ' (not approved yet; publishing approves it)'}`)
    } else {
      lines.push(`  ${change.lessonId}: ${change.parts.join(', ')} changed${change.ready ? ' (approved, ready)' : ' (not approved yet; publishing approves it)'}`)
    }
  }
  return lines
}

async function publish(ctx: Context, lessonIds: string[], what: string) {
  const store = await ctx.workspace()
  const { files } = await store.publish(lessonIds)
  ctx.out.result({ lessonIds, files }, () => [`Published ${what}.`, gitAddLine(files)])
}

/** The Publish view: what publishing would change, and publishing it. Only these commands write shared/. */
export const publishCommands: Command[] = [
  command('publish pending', 'What publishing would change in shared/.', [], {}, async (ctx) => {
    const library = await ctx.library()
    const pending = library.publishing.pending
    ctx.out.result({ pending, ready: readyCount(pending), sharedChangedOutside: library.publishing.sharedChangedOutside }, () => [
      ...pendingLines(pending),
      ...(library.publishing.sharedChangedOutside ? ['shared/Catalog changed outside the Studio: run `studio adopt-shared` first.'] : []),
    ])
  }),

  command('publish lessons', 'Write these lessons, and the curriculum as it stands, into shared/. Publishing approves them.', ['<id...>'], {}, async (ctx, args) => {
    await publish(ctx, args.positionals, args.positionals.join(', '))
  }),

  command('publish curriculum', 'Write the curriculum alone into shared/Catalog: paths, titles and order of published lessons.', [], {}, async (ctx) => {
    await publish(ctx, [], 'the curriculum')
  }),

  command('publish all', 'Publish every approved lesson with changes, and the curriculum.', [], {}, async (ctx) => {
    const library = await ctx.library()
    const ready = library.publishing.pending.flatMap((change) => (change.kind !== 'curriculum' && change.ready ? [change.lessonId] : []))
    const curriculum = library.publishing.pending.some((change) => change.kind === 'curriculum')
    if (ready.length === 0 && !curriculum) {
      ctx.out.result({ lessonIds: [], files: [] }, () => 'Nothing is ready to publish: approve lessons first (studio lessons approve <id>).')
      return
    }
    await publish(ctx, ready, ready.length > 0 ? `${ready.join(', ')} and the curriculum` : 'the curriculum')
  }),
]
