import { createInterface } from 'node:readline/promises'

import type { Issue } from '../server/repoWriter'
import { stepDuration, type Tutorial } from '../src/schema/types'

import { UsageError } from './args'

/** Where a command's text goes. Tests capture it; the terminal is the default. */
export interface IO {
  write(text: string): void
  writeError(text: string): void
  /** Whether a person is at the keyboard, so a confirmation can be typed. */
  isTTY: boolean
  /** Asks one question and returns the answer. Only used when `isTTY`. */
  ask?(question: string): Promise<string>
}

export const terminalIO: IO = {
  write: (text) => process.stdout.write(text),
  writeError: (text) => process.stderr.write(text),
  isTTY: Boolean(process.stdin.isTTY && process.stdout.isTTY),
  async ask(question) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    try {
      return await rl.question(question)
    } finally {
      rl.close()
    }
  },
}

/** A refusal with a sentence the creator can act on; the exit code is 1. */
export class CliError extends Error {
  issues: Issue[]
  constructor(message: string, issues: Issue[] = []) {
    super(message)
    this.name = 'CliError'
    this.issues = issues
  }
}

/**
 * Every command reports through one of these. A result is either printed for
 * a person (tables, sentences) or, with `--json`, as one JSON document, so a
 * script can read it without parsing prose. Notes and warnings go to stderr
 * in JSON mode, so stdout stays a single document.
 */
export class Reporter {
  constructor(
    private io: IO,
    readonly json: boolean,
    readonly quiet: boolean,
  ) {}

  /** The command's result: `render` says how it reads for a person. */
  result(data: unknown, render: (data: never) => string | string[]): void {
    if (this.json) {
      this.io.write(`${JSON.stringify(data, null, 2)}\n`)
      return
    }
    const text = render(data as never)
    const lines = Array.isArray(text) ? text : [text]
    if (lines.length > 0) this.io.write(`${lines.join('\n')}\n`)
  }

  /** A sentence about what happened; skipped with `--quiet`, and moved to stderr with `--json`. */
  note(text: string): void {
    if (this.quiet) return
    if (this.json) this.io.writeError(`${text}\n`)
    else this.io.write(`${text}\n`)
  }

  warn(text: string): void {
    this.io.writeError(`${text}\n`)
  }

  error(message: string, issues: Issue[] = []): void {
    if (this.json) {
      this.io.write(`${JSON.stringify({ error: message, ...(issues.length > 0 ? { issues } : {}) }, null, 2)}\n`)
      return
    }
    this.io.writeError(`${message}\n`)
    for (const issue of issues) this.io.writeError(`  ${formatIssue(issue)}\n`)
  }

  /**
   * A destructive change asks for the same thing the Studio's dialogs ask
   * for: typing the id. `--yes` answers for a script; without a terminal and
   * without `--yes`, nothing is changed.
   */
  async confirm(question: string, expected: string, yes: boolean): Promise<void> {
    if (yes) return
    if (!this.io.isTTY || !this.io.ask) {
      throw new CliError(`${question} Pass --yes to confirm.`)
    }
    const answer = await this.io.ask(`${question}\nType "${expected}" to confirm: `)
    if (answer.trim() !== expected) throw new CliError('Not confirmed; nothing was changed.')
  }
}

export function formatIssue(issue: Issue): string {
  const value = issue.value === undefined ? '' : ` (${JSON.stringify(issue.value)})`
  return `${issue.path}: ${issue.message}${value}`
}

/** Columns lined up with two spaces between them; an empty header row is allowed. */
export function table(rows: string[][], header?: string[]): string[] {
  const all = header ? [header, ...rows] : rows
  if (all.length === 0) return []
  const widths = all[0].map((_, column) => Math.max(...all.map((row) => (row[column] ?? '').length)))
  const line = (row: string[]) =>
    row.map((cell, column) => (column === row.length - 1 ? cell : (cell ?? '').padEnd(widths[column]))).join('  ').trimEnd()
  const lines = all.map(line)
  if (header) lines.splice(1, 0, widths.map((width) => '-'.repeat(width)).join('  '))
  return lines
}

/** The steps of a lesson in one table: number, id, title, how many strokes and fills, seconds of animation. */
export function stepTable(tutorial: Tutorial): string[] {
  return table(
    tutorial.steps.map((step, index) => [String(index + 1), step.id, step.title, String(step.strokes.length), String(step.fills?.length ?? 0), `${stepDuration(step).toFixed(1)}s`]),
    ['#', 'id', 'title', 'strokes', 'fills', 'animation'],
  )
}

/** The `git add` line the Studio shows after publishing. */
export function gitAddLine(files: string[]): string {
  return files.length === 0 ? 'Nothing in shared/ changed.' : `git add -- ${files.join(' ')}`
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}

export { UsageError }
