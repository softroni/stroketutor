import { parseArgs, type ParseArgsConfig } from 'node:util'

/**
 * Command-line parsing on top of `node:util`'s `parseArgs`: no dependency,
 * and the same option syntax everywhere (`--flag`, `--name value`,
 * `--name=value`, `-h`).
 *
 * A command names its positionals and options; the global options below are
 * accepted by every command, before or after it.
 */

/** A request that cannot be understood; the usage is printed and the exit code is 2. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UsageError'
  }
}

export interface OptionSpec {
  type: 'string' | 'boolean'
  short?: string
  /** For `--help`. */
  description: string
  /** Shown as `--name <value>`; defaults to the option's name. */
  placeholder?: string
  /** May be given more than once; the value is then an array. */
  multiple?: boolean
}

export type OptionSpecs = Record<string, OptionSpec>

/** Options every command takes. */
export const GLOBAL_OPTIONS = {
  workspace: { type: 'string', description: 'The workspace SQLite file (default: STUDIO_WORKSPACE or ../.studio/workspace.sqlite).', placeholder: 'file' },
  shared: { type: 'string', description: 'The shared/ directory (default: ../shared).', placeholder: 'dir' },
  json: { type: 'boolean', description: 'Print the result as JSON, for scripts.' },
  yes: { type: 'boolean', short: 'y', description: 'Skip confirmations of destructive changes.' },
  quiet: { type: 'boolean', short: 'q', description: 'Print only results and errors.' },
  model: { type: 'string', description: 'The OpenRouter model to generate with (default: OPENROUTER_MODEL).', placeholder: 'id' },
  help: { type: 'boolean', short: 'h', description: 'Show this help.' },
} as const satisfies OptionSpecs

export type GlobalFlags = {
  workspace?: string
  shared?: string
  json: boolean
  yes: boolean
  quiet: boolean
  model?: string
  help: boolean
}

export interface Positional {
  name: string
  /** `false` for `[name]`, `true` for `<name>`. */
  required: boolean
  /** Takes every remaining positional. */
  rest?: boolean
}

export interface Parsed {
  positionals: string[]
  values: Record<string, string | boolean | string[] | undefined>
  flags: GlobalFlags
}

/** `<id>` is required, `[title]` optional, `<lessonId...>` takes the rest. */
export function positional(spec: string): Positional {
  const match = spec.match(/^([<[])([a-zA-Z-]+)(\.\.\.)?[>\]]$/)
  if (!match) throw new Error(`Bad positional spec: ${spec}`)
  return { name: match[2], required: match[1] === '<', rest: Boolean(match[3]) }
}

/** Parses `argv` for one command. Throws `UsageError` with a sentence the creator can act on. */
export function parseCommandArgs(argv: string[], positionals: Positional[], options: OptionSpecs): Parsed {
  const config: ParseArgsConfig = {
    args: argv,
    allowPositionals: true,
    strict: true,
    options: Object.fromEntries(
      Object.entries({ ...(GLOBAL_OPTIONS as OptionSpecs), ...options }).map(([name, spec]) => [
        name,
        { type: spec.type, ...(spec.short ? { short: spec.short } : {}), ...(spec.multiple ? { multiple: true } : {}) },
      ]),
    ),
  }
  let result: ReturnType<typeof parseArgs>
  try {
    result = parseArgs(config)
  } catch (error) {
    throw new UsageError(friendly(error))
  }
  const values = result.values as Parsed['values']
  const flags: GlobalFlags = {
    workspace: values.workspace as string | undefined,
    shared: values.shared as string | undefined,
    json: Boolean(values.json),
    yes: Boolean(values.yes),
    quiet: Boolean(values.quiet),
    model: values.model as string | undefined,
    help: Boolean(values.help),
  }
  if (flags.help) return { positionals: result.positionals, values, flags }

  const given = result.positionals
  const required = positionals.filter((p) => p.required).length
  const rest = positionals.some((p) => p.rest)
  if (given.length < required) {
    const missing = positionals[given.length]
    throw new UsageError(`Missing ${describe(missing)}.`)
  }
  if (!rest && given.length > positionals.length) {
    throw new UsageError(`Unexpected argument "${given[positionals.length]}".`)
  }
  return { positionals: given, values, flags }
}

function describe(positional: Positional): string {
  return positional.rest ? `<${positional.name}...>` : `<${positional.name}>`
}

/** `parseArgs` errors name the problem; strip the Node error code noise. */
function friendly(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/^.*?: /, '').replace(/\. To specify a positional.*$/s, '.')
}

/** The usage line for `--help`: positionals as written, then each option. */
export function usageOf(name: string, positionals: Positional[], options: OptionSpecs, summary: string): string {
  const shape = positionals.map((p) => (p.required ? `<${p.name}${p.rest ? '...' : ''}>` : `[${p.name}${p.rest ? '...' : ''}]`))
  const lines = [`Usage: studio ${[name, ...shape].join(' ')}`, '', summary]
  const rows = Object.entries(options).map(([option, spec]) => {
    const flag = `--${option}${spec.type === 'string' ? ` <${spec.placeholder ?? option}>` : ''}`
    return [spec.short ? `-${spec.short}, ${flag}` : `    ${flag}`, spec.description]
  })
  if (rows.length > 0) {
    lines.push('', 'Options:')
    const width = Math.max(...rows.map(([flag]) => flag.length))
    for (const [flag, description] of rows) lines.push(`  ${flag.padEnd(width)}  ${description}`)
  }
  return lines.join('\n')
}

/** A 1-based whole number from the command line. */
export function parseIndex(value: string | undefined, what: string): number {
  const n = Number(value)
  if (value === undefined || !Number.isInteger(n) || n < 1) throw new UsageError(`${what} must be a whole number from 1.`)
  return n
}

export function parseNumber(value: string | undefined, what: string): number {
  const n = Number(value)
  if (value === undefined || value.trim() === '' || !Number.isFinite(n)) throw new UsageError(`${what} must be a number.`)
  return n
}

export function stringValue(values: Parsed['values'], name: string): string | undefined {
  const value = values[name]
  return typeof value === 'string' ? value : undefined
}

export function stringValues(values: Parsed['values'], name: string): string[] {
  const value = values[name]
  return Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
}
