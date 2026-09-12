import { positional, type OptionSpecs, type Parsed, type Positional } from './args'
import type { Context } from './context'

/** One command: `studio <name> <positionals> [options]`. */
export interface Command {
  /** One to three words: `status`, `paths create`, `lessons reference set`. */
  name: string
  summary: string
  positionals: Positional[]
  options: OptionSpecs
  run(ctx: Context, args: Parsed): Promise<void>
}

/** A little sugar so each command reads as a table entry. */
export function command(
  name: string,
  summary: string,
  positionals: string[],
  options: OptionSpecs,
  run: Command['run'],
): Command {
  return { name, summary, positionals: positionals.map(positional), options, run }
}
