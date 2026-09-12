import { parsePath, type Point } from '../player/svgPath'
import { DEFAULT_STYLE, cssColor, resolveStyle, type Tutorial } from '../schema/types'

/**
 * Pictures for someone (or an agent) planning a lesson, built as SVG text in
 * plain code so they can be checked without a browser; `cli/commands/preview.ts`
 * renders them to PNG through the same bridge that renders references.
 *
 * - `traceSvg`: a trace with every line and colour labelled by its id, so a
 *   plan can name them (a trace's boxes and lengths alone are why models group
 *   badly).
 * - `lessonSheetSvg`: a contact sheet of a lesson, one panel per step as the
 *   player shows it, this step's lines labelled s1..sN as `lessons summary`
 *   (`summariseLesson`) numbers them.
 *
 * Every `d` and colour that reaches here came through the tracer or the
 * validator, so it is plain path data and a hex value; ids and titles are
 * escaped anyway.
 */

type Box = [number, number, number, number]

/** The parts of a trace a preview needs: `TracedDrawing` (browser) and `Trace` (server) both fit. */
export interface PreviewTrace {
  canvas: { width: number; height: number }
  strokes: { id: string; d: string; lineWidth: number; color?: string }[]
  fills: { id: string; d: string; color: string; box: Box }[]
}

export interface TraceSvgOptions {
  /** Label every line and colour with its id. */
  labels?: boolean
  /** The paper colour; the lesson's default paper when omitted. */
  background?: string
}

export interface SheetOptions {
  columns?: number
  labels?: boolean
}

/** Label colours: lines in red, colours in blue, so the two kinds of id read apart from the ink. */
const LINE_LABEL = '#C62828'
const FILL_LABEL = '#1565C0'
/** Earlier steps in a panel are drawn as the player draws completed steps. */
const DONE_OPACITY = 0.3
/** A sheet is at most this wide, whatever its columns. */
const SHEET_WIDTH = 2400
const CAPTION_HEIGHT = 44
const GAP = 16

export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)
}

const n = (value: number) => String(Number(value.toFixed(2)))

/** Where a path starts: its first `M`. */
export function pathStart(d: string): Point | null {
  try {
    const first = parsePath(d)[0]
    return first.kind === 'move' ? first.to : null
  } catch {
    return null
  }
}

/** The box round a path's points (control points included, which is close enough for placing a label). */
export function pathBox(d: string): Box | null {
  const points: Point[] = []
  try {
    for (const segment of parsePath(d)) {
      if (segment.kind === 'move' || segment.kind === 'line') points.push(segment.to)
      else if (segment.kind === 'quad') points.push(segment.control, segment.end)
      else if (segment.kind === 'cubic') points.push(segment.control1, segment.control2, segment.end)
    }
  } catch {
    return null
  }
  if (points.length === 0) return null
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

/** A bold label with a white halo, so it reads over ink and colour alike. */
function labelText(text: string, at: Point, size: number, colour: string): string {
  const halo = n(size / 5)
  return `<text x="${n(at.x)}" y="${n(at.y)}" font-family="Helvetica, Arial, sans-serif" font-weight="bold" font-size="${n(size)}" fill="${colour}" stroke="#FFFFFF" stroke-width="${halo}" stroke-linejoin="round" paint-order="stroke">${escapeXml(text)}</text>`
}

/**
 * A line's label sits at its start point, with a dot on the point itself,
 * since that is where the animation begins. Neighbouring ids go above and
 * below the point in turn, so lines that start close together (the leaflets
 * of a frond) keep their labels apart.
 */
function lineLabel(id: string, d: string, box: Box | null, size: number, slot: number): string {
  const start = pathStart(d) ?? (box ? { x: box[0], y: box[1] } : null)
  if (!start) return ''
  const dot = `<circle cx="${n(start.x)}" cy="${n(start.y)}" r="${n(size / 5)}" fill="${LINE_LABEL}" stroke="#FFFFFF" stroke-width="${n(size / 12)}"/>`
  const above = slot % 2 === 0
  return dot + labelText(id, { x: start.x + size * 0.35, y: above ? start.y - size * 0.35 : start.y + size * 1.1 }, size, LINE_LABEL)
}

/** A colour's label sits at the centre of its box. */
function fillLabel(id: string, box: Box | null, size: number): string {
  if (!box) return ''
  return labelText(id, { x: (box[0] + box[2]) / 2 - size * 0.6, y: (box[1] + box[3]) / 2 + size * 0.35 }, size, FILL_LABEL)
}

const strokePath = (d: string, colour: string, width: number, opacity?: number) =>
  `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${n(width)}" stroke-linecap="round" stroke-linejoin="round"${opacity === undefined ? '' : ` opacity="${n(opacity)}"`}/>`

const fillPath = (d: string, colour: string, rule: string, opacity?: number) =>
  `<path d="${d}" fill="${colour}" fill-rule="${rule}"${opacity === undefined ? '' : ` fill-opacity="${n(opacity)}"`}/>`

/** The label size for a canvas: about a 45th of its longer side. */
const labelSize = (canvas: { width: number; height: number }) => Math.max(canvas.width, canvas.height) / 45

/**
 * The trace on the lesson canvas: colours faint beneath, every line in ink
 * (or its own colour) in id order, and, with labels, each id where the eye
 * needs it: a line's at its start, a colour's at the middle of its area.
 */
export function traceSvg(trace: PreviewTrace, { labels = true, background = DEFAULT_STYLE.backgroundColor }: TraceSvgOptions = {}): string {
  const { width, height } = trace.canvas
  const size = labelSize(trace.canvas)
  const fills = trace.fills.map((fill) => fillPath(fill.d, cssColor(fill.color), 'evenodd', 0.35))
  const strokes = trace.strokes.map((stroke) => strokePath(stroke.d, cssColor(stroke.color ?? DEFAULT_STYLE.strokeColor), stroke.lineWidth))
  const tags = labels
    ? [...trace.fills.map((fill) => fillLabel(fill.id, fill.box, size)), ...trace.strokes.map((stroke, index) => lineLabel(stroke.id, stroke.d, null, size, index))]
    : []
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(width)} ${n(height)}" width="${n(width)}" height="${n(height)}">`,
    `<rect width="${n(width)}" height="${n(height)}" fill="${cssColor(background)}"/>`,
    ...fills,
    ...strokes,
    ...tags,
    '</svg>',
  ].join('')
}

/** Lines are s1, s2, … and colours f1, f2, … in the order the lesson draws them, as `summariseLesson` labels them. */
function labelSteps(tutorial: Tutorial) {
  let strokes = 0
  let fills = 0
  return tutorial.steps.map((step) => ({
    step,
    strokes: step.strokes.map((item) => ({ id: `s${(strokes += 1)}`, item })),
    fills: (step.fills ?? []).map((item) => ({ id: `f${(fills += 1)}`, item })),
  }))
}

/** One panel's drawing: the lesson as the player shows it at step `upTo` (every step when `upTo` is past the end). */
function panelSvg(tutorial: Tutorial, upTo: number, labels: boolean, at: { x: number; y: number; width: number; height: number }): string {
  const style = resolveStyle(tutorial.style)
  const { width, height } = tutorial.canvas
  const size = labelSize(tutorial.canvas)
  const labelled = labelSteps(tutorial)
  const finished = upTo >= labelled.length
  const shown = labelled.slice(0, upTo + 1)
  const current = finished ? undefined : labelled[upTo]
  const fills = shown.flatMap((entry) => entry.fills.map(({ item }) => fillPath(item.d, cssColor(item.color), item.fillRule ?? 'nonzero')))
  const strokes = shown.flatMap((entry, index) =>
    entry.strokes.map(({ item }) => strokePath(item.d, cssColor(item.color ?? style.strokeColor), item.lineWidth, !finished && index < upTo ? DONE_OPACITY : undefined)),
  )
  const tags =
    labels && current
      ? [...current.fills.map(({ id, item }) => fillLabel(id, pathBox(item.d), size)), ...current.strokes.map(({ id, item }, index) => lineLabel(id, item.d, pathBox(item.d), size, index))]
      : []
  return [
    `<svg x="${n(at.x)}" y="${n(at.y)}" width="${n(at.width)}" height="${n(at.height)}" viewBox="0 0 ${n(width)} ${n(height)}">`,
    `<rect width="${n(width)}" height="${n(height)}" fill="${style.backgroundColor}"/>`,
    ...fills,
    ...strokes,
    ...tags,
    '</svg>',
  ].join('')
}

/**
 * A contact sheet: one panel per step, then the finished drawing, in a grid.
 * In a step's panel the colours of every step so far lie beneath, earlier
 * steps' lines are faded as the player fades completed steps, this step's
 * lines are full and labelled, and later steps are not there yet.
 */
export function lessonSheetSvg(tutorial: Tutorial, { columns = 3, labels = true }: SheetOptions = {}): string {
  const across = Math.max(1, Math.floor(columns))
  const panels = tutorial.steps.length + 1
  const rows = Math.ceil(panels / across)
  const panelWidth = Math.floor((SHEET_WIDTH - GAP * (across + 1)) / across)
  const drawingHeight = Math.round((panelWidth * tutorial.canvas.height) / tutorial.canvas.width)
  const panelHeight = CAPTION_HEIGHT + drawingHeight
  const sheetWidth = across * panelWidth + GAP * (across + 1)
  const sheetHeight = rows * panelHeight + GAP * (rows + 1)
  const captionSize = 22

  const parts: string[] = []
  for (let index = 0; index < panels; index += 1) {
    const x = GAP + (index % across) * (panelWidth + GAP)
    const y = GAP + Math.floor(index / across) * (panelHeight + GAP)
    const finished = index === tutorial.steps.length
    const caption = finished ? 'Finished' : `${index + 1} · ${tutorial.steps[index].title}`
    parts.push(
      `<rect x="${n(x)}" y="${n(y)}" width="${n(panelWidth)}" height="${n(panelHeight)}" fill="#FFFFFF" stroke="#D0D0D0"/>`,
      `<text x="${n(x + 12)}" y="${n(y + CAPTION_HEIGHT - 14)}" font-family="Helvetica, Arial, sans-serif" font-size="${captionSize}" fill="#2B2B2B">${escapeXml(caption)}</text>`,
      panelSvg(tutorial, index, labels && !finished, { x, y: y + CAPTION_HEIGHT, width: panelWidth, height: drawingHeight }),
    )
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(sheetWidth)} ${n(sheetHeight)}" width="${n(sheetWidth)}" height="${n(sheetHeight)}">`,
    `<rect width="${n(sheetWidth)}" height="${n(sheetHeight)}" fill="#F2F2F2"/>`,
    ...parts,
    '</svg>',
  ].join('')
}

/** How many panels a sheet of `tutorial` has, and its grid. */
export function sheetGrid(tutorial: Tutorial, columns = 3): { panels: number; columns: number; rows: number } {
  const across = Math.max(1, Math.floor(columns))
  const panels = tutorial.steps.length + 1
  return { panels, columns: across, rows: Math.ceil(panels / across) }
}
