import { GenerationFailed } from '../server/openrouter'
import { WriteRefused } from '../server/repoWriter'
import { EditError } from '../src/studio/editor/ops'
import { CatalogEditError } from '../src/studio/pathOps'

import { GLOBAL_OPTIONS, UsageError, parseCommandArgs, usageOf, type GlobalFlags, type OptionSpecs } from './args'
import type { Command } from './command'
import { curriculumPlanCommands } from './commands/curriculum'
import { curriculumCommands, levelCommands } from './commands/paths'
import { historyCommands } from './commands/history'
import { lessonCommands } from './commands/lessons'
import { publishCommands } from './commands/publish'
import { statusCommands } from './commands/status'
import { stepCommands } from './commands/steps'
import { svgCommands } from './commands/svg'
import { generateCommands } from './commands/generate'
import { planCommands } from './commands/plan'
import { previewCommands } from './commands/preview'
import { trashCommands } from './commands/trash'
import { voiceCommands } from './commands/voice'
import { createContext, type RunOptions } from './context'
import { CliError, Reporter, terminalIO } from './output'

/**
 * `studio <command> …`: the Studio's every action from the terminal, on the
 * same workspace the Studio uses (web/README.md, "The command line").
 *
 * Exit codes: 0 done; 1 refused (a validation problem, a missing lesson, a
 * model's failure) with the reason on stderr, or in the JSON with `--json`;
 * 2 the command line could not be understood.
 */
export const COMMANDS: Command[] = [
  ...statusCommands,
  ...levelCommands,
  ...curriculumCommands,
  ...curriculumPlanCommands,
  ...lessonCommands,
  ...stepCommands,
  ...historyCommands,
  ...publishCommands,
  ...trashCommands,
  ...svgCommands,
  ...generateCommands,
  ...planCommands,
  ...previewCommands,
  ...voiceCommands,
]

export async function run(argv: string[], options: RunOptions): Promise<number> {
  const io = options.io ?? terminalIO
  const found = findCommand(argv)
  if (!found) {
    const wantsJson = argv.includes('--json')
    const wantsHelp = argv.length === 0 || argv.includes('--help') || argv.includes('-h') || argv[0] === 'help'
    const text = overview()
    if (wantsHelp) {
      io.write(`${text}\n`)
      return 0
    }
    const words = argv.filter((arg) => !arg.startsWith('-')).slice(0, 2).join(' ')
    new Reporter(io, wantsJson, false).error(`Unknown command "${words}".`)
    io.writeError(`${text}\n`)
    return 2
  }

  const { command, rest } = found
  let parsed
  try {
    parsed = parseCommandArgs(rest, command.positionals, command.options)
  } catch (error) {
    if (error instanceof UsageError) {
      io.writeError(`${error.message}\n\n${usageOf(command.name, command.positionals, command.options, command.summary)}\n`)
      return 2
    }
    throw error
  }
  if (parsed.flags.help) {
    io.write(`${usageOf(command.name, command.positionals, command.options, command.summary)}\n`)
    return 0
  }

  const ctx = createContext(parsed.flags as GlobalFlags, { ...options, io })
  try {
    await command.run(ctx, parsed)
    return 0
  } catch (error) {
    return report(ctx.out, error, command)
  } finally {
    await ctx.close()
  }
}

function report(out: Reporter, error: unknown, command: Command): number {
  if (error instanceof UsageError) {
    out.error(`${error.message}\n\n${usageOf(command.name, command.positionals, command.options, command.summary)}`)
    return 2
  }
  if (error instanceof WriteRefused) {
    const hint = error.status === 409 ? ' Run the command again to work on the latest version.' : ''
    out.error(`${error.message}${hint}`, error.issues)
    return 1
  }
  if (error instanceof GenerationFailed) {
    out.error(error.detail ? `${error.message} ${error.detail}` : error.message)
    return 1
  }
  if (error instanceof CliError) {
    out.error(error.message, error.issues)
    return 1
  }
  if (error instanceof EditError || error instanceof CatalogEditError) {
    out.error(error.message)
    return 1
  }
  out.error(error instanceof Error ? (error.stack ?? error.message) : String(error))
  return 1
}

/**
 * The command is the first one, two or three words of `argv` that are not
 * options, longest name first, so `lessons reference set` wins over `lessons`.
 */
function findCommand(argv: string[]): { command: Command; rest: string[] } | null {
  const words: { value: string; index: number }[] = []
  for (let index = 0; index < argv.length && words.length < 3; index += 1) {
    const arg = argv[index]
    if (arg.startsWith('-')) {
      // A global option with a separate value (`--workspace file`) is not a command word.
      const name = arg.replace(/^--?/, '').split('=')[0]
      const spec = Object.entries(GLOBAL_OPTIONS as OptionSpecs).find(([key, option]) => key === name || option.short === name)?.[1]
      if (spec?.type === 'string' && !arg.includes('=')) index += 1
      continue
    }
    words.push({ value: arg, index })
  }
  for (let length = Math.min(3, words.length); length >= 1; length -= 1) {
    const name = words.slice(0, length).map((word) => word.value).join(' ')
    const command = COMMANDS.find((candidate) => candidate.name === name)
    if (command) {
      const used = new Set(words.slice(0, length).map((word) => word.index))
      return { command, rest: argv.filter((_, index) => !used.has(index)) }
    }
  }
  return null
}

function overview(): string {
  const groups = new Map<string, Command[]>()
  for (const command of COMMANDS) {
    const group = command.name.split(' ')[0]
    groups.set(group, [...(groups.get(group) ?? []), command])
  }
  const width = Math.max(...COMMANDS.map((command) => command.name.length))
  const lines = ['Usage: studio <command> [options]', '', 'The Paper Coach Studio from the terminal. `studio <command> --help` describes one command.', '']
  for (const [group, commands] of groups) {
    if (group !== commands[0].name) lines.push(`${group}:`)
    for (const command of commands) lines.push(`  ${command.name.padEnd(width)}  ${command.summary}`)
  }
  lines.push('', 'Global options:')
  for (const [name, spec] of Object.entries(GLOBAL_OPTIONS as OptionSpecs)) {
    const flag = `--${name}${spec.type === 'string' ? ` <${spec.placeholder ?? name}>` : ''}`
    lines.push(`  ${(spec.short ? `-${spec.short}, ` : '    ') + flag.padEnd(22)}  ${spec.description}`)
  }
  return lines.filter((line, index, all) => !(line === '' && all[index - 1] === '')).join('\n')
}
