import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv'

import schema from '@shared/tutorial.schema.json'

import { SVGPathError, parsePath } from '../player/svgPath'

import { SUPPORTED_SCHEMA_VERSION, type Tutorial } from './types'

/**
 * One thing wrong with a document, addressed the way an author reads it.
 *
 * `path` is dotted/bracketed JSON notation — `steps[2].strokes[0].d` — not the
 * JSON Pointer Ajv reports, because the author is looking at the file, not at a
 * pointer spec.
 */
export interface ValidationIssue {
  path: string
  message: string
  /** The offending value, when one exists at that path. */
  value?: unknown
}

export type ValidationResult =
  | { ok: true; tutorial: Tutorial }
  | { ok: false; issues: ValidationIssue[] }

const ROOT_PATH = '(root)'

/**
 * `player/svgPath` is imported here on purpose: the schema can say a `d` is a
 * non-empty string, but only the parser can say whether it is a path both
 * players will draw the same way. Validation is where that has to happen —
 * after this passes, `Tutorial` is safe to hand to the renderer.
 */
const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true })
let compiled: ValidateFunction | null = null

function validator(): ValidateFunction {
  if (!compiled) compiled = ajv.compile(schema)
  return compiled
}

/** `/steps/2/strokes/0/d` -> `steps[2].strokes[0].d` */
export function toAuthorPath(instancePath: string, extra?: string): string {
  const tokens = instancePath.split('/').filter(Boolean).map(unescapePointer)
  if (extra) tokens.push(extra)
  if (tokens.length === 0) return ROOT_PATH
  return tokens.reduce((acc, token, i) => {
    if (/^\d+$/.test(token)) return `${acc}[${token}]`
    return i === 0 ? token : `${acc}.${token}`
  }, '')
}

function unescapePointer(token: string): string {
  return token.replace(/~1/g, '/').replace(/~0/g, '~')
}

/** Walks the raw document to fetch whatever sits at a JSON Pointer. */
export function valueAt(root: unknown, instancePath: string): unknown {
  const tokens = instancePath.split('/').filter(Boolean).map(unescapePointer)
  let current: unknown = root
  for (const token of tokens) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[token]
  }
  return current
}

/** Turns one Ajv error into something an author can act on. */
function describe(error: ErrorObject, root: unknown): ValidationIssue {
  const params = error.params as Record<string, unknown>

  if (error.keyword === 'required') {
    const missing = String(params.missingProperty)
    return {
      path: toAuthorPath(error.instancePath, missing),
      message: `Required property "${missing}" is missing.`,
      value: undefined,
    }
  }

  if (error.keyword === 'additionalProperties') {
    const extra = String(params.additionalProperty)
    return {
      path: toAuthorPath(error.instancePath, extra),
      message: `Unknown property "${extra}". It is not part of schemaVersion ${SUPPORTED_SCHEMA_VERSION}.`,
      value: valueAt(root, `${error.instancePath}/${extra}`),
    }
  }

  const path = toAuthorPath(error.instancePath)
  const value = valueAt(root, error.instancePath)

  switch (error.keyword) {
    case 'type':
      return { path, message: `Must be ${String(params.type)}.`, value }
    case 'const':
      return { path, message: `Must be ${JSON.stringify(params.allowedValue)}.`, value }
    case 'minItems':
      return { path, message: `Needs at least ${String(params.limit)} item(s).`, value }
    case 'minLength':
      return { path, message: `Must not be empty.`, value }
    case 'exclusiveMinimum':
      return { path, message: `Must be greater than ${String(params.limit)}.`, value }
    case 'maximum':
      return { path, message: `Must be at most ${String(params.limit)}.`, value }
    case 'pattern':
      return {
        path,
        message: `Must be a hex colour such as "#2B2B2B" or "#FFF".`,
        value,
      }
    default:
      return { path, message: error.message ?? 'Is not valid.', value }
  }
}

/**
 * Checks every `d` with the same parser the renderer uses, so a path that would
 * misrender — or that the stricter iOS parser would reject — is caught at load
 * time rather than drawn wrongly.
 */
function validatePaths(tutorial: Tutorial): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  tutorial.steps.forEach((step, stepIndex) => {
    step.strokes.forEach((stroke, strokeIndex) => {
      try {
        parsePath(stroke.d)
      } catch (error) {
        const message =
          error instanceof SVGPathError
            ? error.message
            : `Could not be parsed: ${String(error)}`
        issues.push({
          path: `steps[${stepIndex}].strokes[${strokeIndex}].d`,
          message,
          value: stroke.d,
        })
      }
    })
  })
  return issues
}

/**
 * Validates an already-parsed value against the schema, then against the path
 * grammar. Returns every problem at once — authors fixing generated JSON would
 * rather see ten errors than run ten times.
 */
export function validateTutorial(data: unknown): ValidationResult {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return {
      ok: false,
      issues: [
        {
          path: ROOT_PATH,
          message: 'A tutorial must be a JSON object.',
          value: data,
        },
      ],
    }
  }

  // Checked before the schema so a v2 file gets a sentence about versions
  // instead of a const-mismatch on an unfamiliar field.
  const version = (data as Record<string, unknown>).schemaVersion
  if (version !== undefined && version !== SUPPORTED_SCHEMA_VERSION) {
    return {
      ok: false,
      issues: [
        {
          path: 'schemaVersion',
          message: `Unsupported schemaVersion ${JSON.stringify(
            version,
          )}. This player only understands schemaVersion ${SUPPORTED_SCHEMA_VERSION}.`,
          value: version,
        },
      ],
    }
  }

  const validate = validator()
  if (!validate(data)) {
    const errors = validate.errors ?? []
    const issues = errors.map((error) => describe(error, data))
    return { ok: false, issues: dedupe(issues) }
  }

  const tutorial = data as Tutorial
  const pathIssues = validatePaths(tutorial)
  if (pathIssues.length > 0) return { ok: false, issues: pathIssues }

  return { ok: true, tutorial }
}

/** Parses JSON text and validates it, reporting syntax errors the same way. */
export function parseTutorialJSON(text: string): ValidationResult {
  if (text.trim().length === 0) {
    return {
      ok: false,
      issues: [{ path: ROOT_PATH, message: 'There is nothing to load — the JSON is empty.' }],
    }
  }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (error) {
    return {
      ok: false,
      issues: [
        {
          path: ROOT_PATH,
          message: `This is not valid JSON. ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    }
  }
  return validateTutorial(data)
}

/** Ajv can report the same spot twice (e.g. type plus const). Keep the first. */
function dedupe(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>()
  return issues.filter((issue) => {
    const key = `${issue.path}::${issue.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
