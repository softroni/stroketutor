import { readFile } from 'node:fs/promises'

import { applyCurriculumPlan, isEmptySummary, type CurriculumPlanSummary } from '../../src/studio/pathOps'

import { command, type Command } from '../command'
import { editCatalog, readCatalog } from '../edit'
import { CliError, plural } from '../output'

/**
 * A whole curriculum from one file: the levels, the paths and, in each path,
 * the lessons in teaching order. Lessons that do not exist yet become planned
 * lessons — places held until their tutorials are generated, one at a time.
 *
 * Applying is safe to repeat: a second run finds everything where the first
 * put it and reports no changes.
 */
export const curriculumPlanCommands: Command[] = [
  command(
    'curriculum apply',
    'Lay a curriculum plan over the working curriculum: levels, paths, and planned lessons in order.',
    ['<file>'],
    { 'dry-run': { type: 'boolean', description: 'Say what applying would change, and stop.' } },
    async (ctx, args) => {
      const file = args.positionals[0]
      const text = await readFile(file, 'utf8').catch(() => {
        throw new CliError(`Could not read ${file}.`)
      })
      let plan: unknown
      try {
        plan = JSON.parse(text)
      } catch (error) {
        throw new CliError(`${file} is not valid JSON. ${error instanceof Error ? error.message : String(error)}`)
      }

      const { catalog } = await readCatalog(ctx)
      const library = await ctx.library()
      const tutorialIds = new Set(library.tutorials.keys())
      const { summary } = applyCurriculumPlan(catalog, plan, tutorialIds)

      if (args.values['dry-run']) {
        ctx.out.result({ file, dryRun: true, summary }, () => [
          ...summaryLines(summary),
          'Nothing was changed (--dry-run).',
        ])
        return
      }

      const next = await editCatalog(ctx, (current) => applyCurriculumPlan(current, plan, tutorialIds).catalog)
      const planned = next.lessons.filter((lesson) => lesson.status === 'planned').length
      ctx.out.result({ file, summary, levels: next.levels.length, paths: next.paths.length, planned }, () => [
        ...summaryLines(summary),
        `The curriculum now has ${plural(next.levels.length, 'level')}, ${plural(next.paths.length, 'path')} and ${plural(planned, 'planned lesson')}.`,
      ])
    },
  ),
]

function summaryLines(summary: CurriculumPlanSummary): string[] {
  if (isEmptySummary(summary)) return ['The plan is already applied: nothing would change.']
  const counted: [string, string[]][] = [
    ['levels created', summary.levelsCreated],
    ['levels changed', summary.levelsUpdated],
    ['paths created', summary.pathsCreated],
    ['paths changed', summary.pathsUpdated],
    ['lessons planned', summary.lessonsPlanned],
    ['planned lessons reworded', summary.lessonsUpdated],
    ['lessons moved to another path', summary.lessonsMoved],
  ]
  return counted.flatMap(([what, ids]) =>
    ids.length === 0 ? [] : [`${ids.length} ${what}: ${ids.length > 8 ? `${ids.slice(0, 8).join(', ')}, …` : ids.join(', ')}`],
  )
}
