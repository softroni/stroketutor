import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { summarise } from '../../server/generateFromTrace'
import type { TraceOptions } from '../../src/trace/traceSvg'

import { parseNumber, stringValue, type OptionSpecs, type Parsed } from '../args'
import { command, type Command } from '../command'
import { CliError, plural, table } from '../output'

/** The tracer's knobs as command-line options; the defaults are the tracer's own. */
export const TRACE_OPTIONS: OptionSpecs = {
  'max-strokes': { type: 'string', description: 'Lines to keep, longest first: 32 for fewer, 64 as New lesson traces, 96 for more.', placeholder: 'n' },
  'max-colours': { type: 'string', description: 'Colours to reduce the file to (default 8).', placeholder: 'n' },
  size: { type: 'string', description: 'The square canvas the drawing is fitted into (default 1000).', placeholder: 'units' },
  'min-stroke-length': { type: 'string', description: 'Lines shorter than this are texture and are left out (default 16).', placeholder: 'units' },
  'ink-max-channel': { type: 'string', description: 'A fill is ink when no colour channel is above this, 0–255 (default 56).', placeholder: 'n' },
  'max-outline-width': { type: 'string', description: 'Dark areas wider than this are coloured in, not drawn (default 26).', placeholder: 'units' },
  'max-bend': { type: 'string', description: 'A line carries on through a junction bending less than this, in degrees (default 55).', placeholder: 'deg' },
  'join-gap': { type: 'string', description: 'Line ends this close that continue the same way are joined (default 10).', placeholder: 'units' },
}

export function traceOptionsFrom(args: Parsed): TraceOptions {
  const number = (name: string) => (args.values[name] === undefined ? undefined : parseNumber(stringValue(args.values, name), `--${name}`))
  const options: TraceOptions = {
    maxStrokes: number('max-strokes'),
    maxColours: number('max-colours'),
    size: number('size'),
    minStrokeLength: number('min-stroke-length'),
    inkMaxChannel: number('ink-max-channel'),
    maxOutlineWidth: number('max-outline-width'),
    maxBend: number('max-bend'),
    joinGap: number('join-gap'),
  }
  return Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined)) as TraceOptions
}

export async function readSvg(file: string): Promise<string> {
  const text = await readFile(file, 'utf8').catch(() => {
    throw new CliError(`Could not read ${file}.`)
  })
  if (!/<svg[\s>]/i.test(text)) throw new CliError(`${file} is not an SVG.`)
  return text
}

const withExtension = (file: string, extension: string) => path.join(path.dirname(file), `${path.basename(file, path.extname(file))}${extension}`)

/**
 * The SVG tools of New lesson and Regenerate, on their own: what the Studio
 * traces from a file, the file rewritten as a plain drawing, and the picture
 * a model would be sent. All run the Studio's browser code in headless Chromium.
 */
export const svgCommands: Command[] = [
  command(
    'svg trace',
    'Trace an SVG into the lines and colours a lesson would be built from.',
    ['<file>'],
    {
      out: { type: 'string', description: 'Write the trace as JSON here (for `svg to-steps --trace`).', placeholder: 'file' },
      summary: { type: 'boolean', description: 'Print what a model is told about the trace: each line and colour with its id, box and size, never path data.' },
      ...TRACE_OPTIONS,
    },
    async (ctx, args) => {
      const file = args.positionals[0]
      const text = await readSvg(file)
      const browser = await ctx.browser()
      const trace = await browser.trace(text, traceOptionsFrom(args))
      const out = stringValue(args.values, 'out')
      if (out) await writeFile(out, `${JSON.stringify(trace, null, 2)}\n`)
      if (args.values.summary) {
        const summary = summarise(trace)
        const n = (value: number) => String(Math.round(value))
        const box = (b: [number, number, number, number]) => `${n(b[0])} ${n(b[1])} ${n(b[2])} ${n(b[3])}`
        const colourOf = new Map(trace.strokes.map((stroke) => [stroke.id, stroke.color ?? '']))
        ctx.out.result({ ...summary, notes: trace.notes, outlineCoverage: trace.outlineCoverage }, () => [
          `${plural(summary.strokes.length, 'line')} and ${plural(summary.fills.length, 'colour')} on a ${summary.canvas.width}×${summary.canvas.height} canvas (origin top left, y down).`,
          '',
          ...table(
            summary.strokes.map((stroke) => [stroke.id, box(stroke.box), n(stroke.length), stroke.closed ? 'closed' : 'open', colourOf.get(stroke.id) ?? '']),
            ['line', 'box', 'length', 'shape', 'colour'],
          ),
          ...(summary.fills.length > 0 ? ['', ...table(summary.fills.map((fill) => [fill.id, fill.color, n(fill.area), box(fill.box)]), ['colour', 'value', 'area', 'box'])] : []),
          ...(out ? ['', `Wrote ${out}.`] : []),
        ])
        return
      }
      ctx.out.result(trace, () => [
        `${plural(trace.strokes.length, 'line')} and ${plural(trace.fills.length, 'colour')} on a ${trace.canvas.width}×${trace.canvas.height} canvas; the lines follow ${Math.round(trace.outlineCoverage * 100)}% of the file's outlines.`,
        ...trace.notes.map((note) => `  ${note}`),
        ...(out ? [`Wrote ${out}.`] : ['Pass --out <file> to keep the trace, or --json to print it.']),
      ])
    },
  ),

  command(
    'svg optimize',
    'Rewrite an SVG as a plain drawing: one path per shape, absolute M/L/C/Q/Z, transforms applied, fitted to the canvas.',
    ['<file>'],
    {
      out: { type: 'string', description: 'Where to write the result (default: <file>.optimized.svg).', placeholder: 'file' },
      simplify: { type: 'boolean', description: 'Also simplify each path, drop specks and smooth the curves that remain.' },
      epsilon: { type: 'string', description: 'With --simplify: how far, in canvas units, a simplified path may stray (default 1.2).', placeholder: 'units' },
      decimals: { type: 'string', description: 'Decimal places kept in coordinates (default 1).', placeholder: 'n' },
      'min-size': { type: 'string', description: 'With --simplify: shapes smaller than this in both directions are specks (default 4).', placeholder: 'units' },
      size: { type: 'string', description: 'The square canvas the drawing is fitted into (default 1000).', placeholder: 'units' },
    },
    async (ctx, args) => {
      const file = args.positionals[0]
      const text = await readSvg(file)
      const number = (name: string) => (args.values[name] === undefined ? undefined : parseNumber(stringValue(args.values, name), `--${name}`))
      const browser = await ctx.browser()
      const result = await browser.optimize(text, {
        size: number('size'),
        decimals: number('decimals'),
        simplify: args.values.simplify ? (number('epsilon') ?? 1.2) : undefined,
        minSize: number('min-size'),
      })
      const out = stringValue(args.values, 'out') ?? withExtension(file, '.optimized.svg')
      await writeFile(out, result.svg)
      ctx.out.result({ file: out, kept: result.kept, dropped: result.dropped, notes: result.notes, bytes: { before: Buffer.byteLength(text), after: Buffer.byteLength(result.svg) } }, () => [
        `Wrote ${out}: ${plural(result.kept, 'path')} kept, ${result.dropped} left out; ${Buffer.byteLength(text)} → ${Buffer.byteLength(result.svg)} bytes.`,
        ...result.notes.map((note) => `  ${note}`),
      ])
    },
  ),

  command(
    'svg render',
    'Render an SVG to a PNG on white paper, as a model would be sent it.',
    ['<file>'],
    {
      out: { type: 'string', description: 'Where to write the PNG (default: <file>.png).', placeholder: 'file' },
      size: { type: 'string', description: 'Pixels on the longer side (default 1536, what the Studio sends to a model).', placeholder: 'px' },
    },
    async (ctx, args) => {
      const file = args.positionals[0]
      const text = await readSvg(file)
      const size = args.values.size === undefined ? 1536 : parseNumber(stringValue(args.values, 'size'), '--size')
      const browser = await ctx.browser()
      const base64 = await browser.renderPng(text, size)
      const bytes = Buffer.from(base64, 'base64')
      const out = stringValue(args.values, 'out') ?? withExtension(file, '.png')
      await writeFile(out, bytes)
      ctx.out.result({ file: out, bytes: bytes.byteLength }, () => `Wrote ${out} (${bytes.byteLength} bytes).`)
    },
  ),
]
