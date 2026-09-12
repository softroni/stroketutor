import { writeFile } from 'node:fs/promises'

import type { HistoryEntry } from '../../src/history/types'
import { describeEntry } from '../../src/history/types'
import { formatJSON } from '../../src/schema/formatJSON'

import { stringValue } from '../args'
import { command, type Command } from '../command'
import type { Context } from '../context'
import { replaceTutorial } from '../edit'
import { CliError, table } from '../output'

/** An entry by its id, a unique prefix of it, or its number in `history list` (1 = newest). */
async function findEntry(ctx: Context, lessonId: string, key: string): Promise<HistoryEntry> {
  const store = await ctx.workspace()
  const entries = await store.readHistory(lessonId)
  if (entries.length === 0) throw new CliError(`${lessonId} has no recorded versions.`)
  if (/^\d+$/.test(key)) {
    const entry = entries[Number(key) - 1]
    if (!entry) throw new CliError(`${lessonId} has ${entries.length} recorded versions; there is no number ${key}.`)
    return entry
  }
  const matches = entries.filter((entry) => entry.id === key || entry.id.startsWith(key))
  if (matches.length === 1) return matches[0]
  throw new CliError(matches.length === 0 ? `No version of ${lessonId} is called ${key}.` : `"${key}" matches ${matches.length} versions; give more of the id.`)
}

/** History (master plan §24): every version a lesson has had, never overwritten. */
export const historyCommands: Command[] = [
  command('history list', 'Every recorded version of a lesson, newest first.', ['<id>'], {}, async (ctx, args) => {
    const store = await ctx.workspace()
    const entries = await store.readHistory(args.positionals[0])
    ctx.out.result({ entries: entries.map(({ tutorial, ...about }) => ({ ...about, steps: tutorial.steps.length })) }, () =>
      entries.length === 0
        ? [`${args.positionals[0]} has no recorded versions yet.`]
        : table(
            entries.map((entry, index) => [
              String(index + 1),
              entry.id,
              describeEntry(entry),
              entry.model ?? '',
              entry.createdAt,
              String(entry.tutorial.steps.length),
              entry.note ?? '',
            ]),
            ['#', 'id', 'what', 'model', 'when', 'steps', 'note'],
          ),
    )
  }),

  command('history show', 'One recorded version: its record, and its tutorial with --out.', ['<id>', '<entry>'], { out: { type: 'string', description: 'Write the version’s tutorial JSON to this file.', placeholder: 'file' } }, async (ctx, args) => {
    const entry = await findEntry(ctx, args.positionals[0], args.positionals[1])
    const out = stringValue(args.values, 'out')
    if (out) await writeFile(out, formatJSON(entry.tutorial))
    ctx.out.result(entry, () => {
      const { tutorial, ...about } = entry
      const lines = [`${describeEntry(entry)} (${entry.id}) on ${entry.createdAt}`]
      for (const [key, value] of Object.entries(about)) {
        if (['id', 'createdAt', 'historyVersion', 'lessonId', 'kind'].includes(key) || value === undefined) continue
        lines.push(`${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
      }
      lines.push(`steps: ${tutorial.steps.map((step) => step.title).join(' · ')}`)
      if (out) lines.push(`Wrote ${out}.`)
      return lines
    })
  }),

  command('history use', 'Bring a recorded version back as the lesson (kept in History like ⌘S).', ['<id>', '<entry>'], {}, async (ctx, args) => {
    const [id, key] = args.positionals
    const entry = await findEntry(ctx, id, key)
    const result = await replaceTutorial(ctx, id, { ...entry.tutorial, id }, { checkpoint: true })
    ctx.out.result({ id, entry: entry.id, etag: result.etag }, () => `${id} is now the version "${describeEntry(entry)}" of ${entry.createdAt}.`)
  }),
]
