import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { drawingSvg } from '../../src/studio/drawingImage'
import { lessonSheetSvg, parseIdList, sheetGrid, traceSvg, type PreviewTrace } from '../../src/studio/preview'

import { parseIndex, parseNumber, stringValue, type OptionSpecs, type Parsed } from '../args'
import { command, type Command } from '../command'
import type { Context } from '../context'
import { readLesson } from '../edit'
import { CliError } from '../output'
import { TRACE_OPTIONS, readSvg, traceOptionsFrom, withExtension } from './svg'

/** Longest edge of a preview PNG, as `svg render` renders for a model. */
const PREVIEW_EDGE = 1536

const PICTURE_OPTIONS: OptionSpecs = {
  out: { type: 'string', description: 'Where to write the picture.', placeholder: 'file' },
  'no-labels': { type: 'boolean', description: 'Leave the ids off.' },
  size: { type: 'string', description: `Pixels on the longer side of the PNG (default ${PREVIEW_EDGE}; a sheet's own size for --sheet, so its panels stay legible).`, placeholder: 'px' },
  svg: { type: 'boolean', description: 'Write the picture as SVG text instead of a PNG; no browser is needed.' },
}

/** The tracer's knobs, without `size`: here `--size` is the PNG's, and the canvas stays the lesson's. */
const { size: _canvasSize, ...TRACER_KNOBS } = TRACE_OPTIONS

/** A trace as `svg trace --out` wrote it, checked for the parts a preview draws. */
async function readTraceFile(file: string): Promise<PreviewTrace> {
  const text = await readFile(file, 'utf8').catch(() => {
    throw new CliError(`Could not read the trace ${file}.`)
  })
  let parsed: Partial<PreviewTrace> | null
  try {
    parsed = JSON.parse(text) as Partial<PreviewTrace> | null
  } catch {
    throw new CliError(`${file} is not JSON; a trace comes from \`svg trace --out\`.`)
  }
  if (!parsed || typeof parsed !== 'object' || !parsed.canvas || !Array.isArray(parsed.strokes) || !Array.isArray(parsed.fills)) {
    throw new CliError(`${file} is not a trace; one comes from \`svg trace --out\`.`)
  }
  return parsed as PreviewTrace
}

/** `x0,y0,x1,y1` in canvas units, refused unless it is a box with some size. */
function parseCrop(text: string): [number, number, number, number] {
  const parts = text.split(',').map((part) => part.trim())
  if (parts.length !== 4) throw new CliError('--crop takes four numbers: x0,y0,x1,y1 in canvas units.')
  const [x0, y0, x1, y1] = parts.map((part) => parseNumber(part, '--crop'))
  if (x1 <= x0 || y1 <= y0) throw new CliError('--crop must run left to right and top to bottom: x1 > x0 and y1 > y0.')
  return [x0, y0, x1, y1]
}

/** Writes the picture as the options ask: SVG text as it is, or a PNG through the browser. `stem` is the default file name without its extension. */
async function writePicture(ctx: Context, args: Parsed, svgText: string, stem: string, defaultSize: number, extra: Record<string, unknown> = {}) {
  const asSvg = Boolean(args.values.svg)
  const size = args.values.size === undefined ? defaultSize : parseNumber(stringValue(args.values, 'size'), '--size')
  const out = stringValue(args.values, 'out') ?? `${stem}${asSvg ? '.svg' : '.png'}`
  let bytes: Buffer
  if (asSvg) {
    bytes = Buffer.from(svgText)
  } else {
    const browser = await ctx.browser()
    bytes = Buffer.from(await browser.renderPng(svgText, size), 'base64')
  }
  await writeFile(out, bytes)
  ctx.out.result({ file: out, bytes: bytes.byteLength, format: asSvg ? 'svg' : 'png', ...extra }, () => `Wrote ${out} (${bytes.byteLength} bytes).`)
}

/**
 * Seeing the drawing: the pictures an author looks at between `svg trace`
 * and a plan, and between a lesson and its corrections.
 */
export const previewCommands: Command[] = [
  command(
    'svg preview',
    'A picture of a trace with every line and colour labelled by its id, to write a plan from. Takes an SVG, or a trace JSON from `svg trace --out`.',
    ['<file>'],
    {
      ...PICTURE_OPTIONS,
      only: { type: 'string', description: 'Label only these ids, a comma list with ranges (s30-s40,f1); the other lines are faded.', placeholder: 'ids' },
      crop: { type: 'string', description: 'Show only this part of the canvas, x0,y0,x1,y1 in canvas units; labels scale to it.', placeholder: 'box' },
      ...TRACER_KNOBS,
    },
    async (ctx, args) => {
      const file = args.positionals[0]
      const only = args.values.only === undefined ? undefined : parseIdList(stringValue(args.values, 'only') ?? '')
      const crop = args.values.crop === undefined ? undefined : parseCrop(stringValue(args.values, 'crop') ?? '')
      let trace: PreviewTrace
      if (path.extname(file).toLowerCase() === '.json') {
        trace = await readTraceFile(file)
      } else {
        const browser = await ctx.browser()
        trace = await browser.trace(await readSvg(file), traceOptionsFrom(args))
      }
      if (only) {
        const known = new Set([...trace.strokes.map((stroke) => stroke.id), ...trace.fills.map((fill) => fill.id)])
        const unknown = only.filter((id) => !known.has(id))
        if (unknown.length > 0) throw new CliError(`--only names ids that are not in the trace: ${unknown.join(', ')}.`)
      }
      const svgText = traceSvg(trace, { labels: !args.values['no-labels'], only, crop })
      await writePicture(ctx, args, svgText, withExtension(file, '.preview'), PREVIEW_EDGE, { lines: trace.strokes.length, colours: trace.fills.length, only: only ?? null, crop: crop ?? null })
    },
  ),

  command(
    'lessons render',
    'A picture of a lesson: its finished drawing, or with --sheet one panel per step with this step’s lines labelled as `lessons summary` names them.',
    ['<id>'],
    {
      ...PICTURE_OPTIONS,
      sheet: { type: 'boolean', description: 'A contact sheet: one panel per step, then the finished drawing.' },
      columns: { type: 'string', description: 'Panels across the sheet (default 3).', placeholder: 'n' },
    },
    async (ctx, args) => {
      const id = args.positionals[0]
      const { tutorial } = await readLesson(ctx, id)
      if (args.values.sheet) {
        const columns = args.values.columns === undefined ? 3 : parseIndex(stringValue(args.values, 'columns'), '--columns')
        const svgText = lessonSheetSvg(tutorial, { columns, labels: !args.values['no-labels'] })
        // The PNG's size is its longer edge, so a tall sheet is rendered at its own height: its width then stays as built and panels stay legible.
        const [, width, height] = svgText.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/) ?? []
        await writePicture(ctx, args, svgText, `${id}.sheet`, Math.max(Number(width) || PREVIEW_EDGE, Number(height) || 0), sheetGrid(tutorial, columns))
        return
      }
      await writePicture(ctx, args, drawingSvg(tutorial), id, PREVIEW_EDGE)
    },
  ),
]
