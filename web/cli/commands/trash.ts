import type { TrashItem } from '../../server/workspaceStore'

import { command, type Command } from '../command'
import type { Context } from '../context'
import { CliError, plural, table } from '../output'

/** A trash item by its trash id, or by the lesson or path id it holds when that is unique. */
async function findItem(ctx: Context, key: string): Promise<TrashItem> {
  const store = await ctx.workspace()
  const items = store.listTrash()
  const byId = items.find((item) => item.id === key)
  if (byId) return byId
  const byItem = items.filter((item) => item.itemId === key)
  if (byItem.length === 1) return byItem[0]
  throw new CliError(byItem.length === 0 ? `Nothing in the trash is called "${key}".` : `"${key}" is in the trash ${byItem.length} times; use the trash id from studio trash list.`)
}

/** The Trash: deleted lessons and paths until they are deleted for good. */
export const trashCommands: Command[] = [
  command('trash list', 'What is in the trash.', [], {}, async (ctx) => {
    const store = await ctx.workspace()
    const items = store.listTrash()
    ctx.out.result({ items }, () =>
      items.length === 0
        ? ['The trash is empty.']
        : table(items.map((item) => [item.id, item.kind, item.itemId, item.title, item.deletedAt, item.detail]), ['trash id', 'kind', 'id', 'title', 'deleted', 'detail']),
    )
  }),

  command('trash restore', 'Put a trashed lesson or path back where it was, as a draft.', ['<id>'], {}, async (ctx, args) => {
    const item = await findItem(ctx, args.positionals[0])
    const store = await ctx.workspace()
    const result = await store.restore(item.id)
    ctx.out.result(result, () => `Restored the ${result.kind} ${result.itemId}.`)
  }),

  command('trash purge', 'Delete a trashed item for good, with the history of a lesson nothing else uses.', ['<id>'], {}, async (ctx, args) => {
    const item = await findItem(ctx, args.positionals[0])
    await ctx.out.confirm(`This deletes the ${item.kind} "${item.title}" (${item.itemId}) for good.`, item.itemId, ctx.flags.yes)
    const store = await ctx.workspace()
    await store.purge(item.id)
    ctx.out.result({ id: item.id, itemId: item.itemId, kind: item.kind }, () => `Deleted the ${item.kind} ${item.itemId} for good.`)
  }),

  command('trash empty', 'Delete everything in the trash for good.', [], {}, async (ctx) => {
    const store = await ctx.workspace()
    const items = store.listTrash()
    if (items.length === 0) {
      ctx.out.result({ purged: 0 }, () => 'The trash is already empty.')
      return
    }
    await ctx.out.confirm(`This deletes ${plural(items.length, 'item')} for good.`, 'empty', ctx.flags.yes)
    await store.emptyTrash()
    ctx.out.result({ purged: items.length }, () => `Emptied the trash: ${plural(items.length, 'item')} deleted for good.`)
  }),
]
