import { GLOBAL_OPTIONS, flagOf, shapeOf, type OptionSpecs } from './args'
import type { Command } from './command'

/**
 * The command line as data, for the Studio's Docs page (#/docs): every command in `studio --help`'s
 * order, with the usage, summary and options its own `--help` prints. `reference.test.ts` keeps
 * `src/studio/studioCli.json` equal to it, so the page never lists a command that has changed.
 */
export interface CommandLineReference {
  /** The options every command takes. */
  global: OptionReference[]
  commands: CommandReference[]
}

export interface CommandReference {
  /** One to three words: `status`, `lessons reference set`. */
  name: string
  /** The name and its positionals as `--help` writes them: `lessons video <id>`. */
  usage: string
  summary: string
  options: OptionReference[]
}

export interface OptionReference {
  /** As `--help` writes it: `-y, --yes`, `--out <file>`. */
  flag: string
  description: string
}

export function describeCommandLine(commands: Command[]): CommandLineReference {
  return {
    global: optionsOf(GLOBAL_OPTIONS),
    commands: commands.map((command) => ({
      name: command.name,
      usage: [command.name, ...shapeOf(command.positionals)].join(' '),
      summary: command.summary,
      options: optionsOf(command.options),
    })),
  }
}

function optionsOf(options: OptionSpecs): OptionReference[] {
  return Object.entries(options).map(([name, spec]) => ({
    flag: spec.short ? `-${spec.short}, ${flagOf(name, spec)}` : flagOf(name, spec),
    description: spec.description,
  }))
}
