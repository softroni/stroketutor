import { contextLines, type ChatMessage, type LessonContext } from './lessonPrompt'

/**
 * Prompts for regenerating one layer of an existing lesson (master plan §24:
 * "if the drawing is good but grouping is weak, preserve the drawing and
 * regenerate only the weak layer"). The drawing is never sent as path data and
 * never comes back: the model sees numbered lines and colours and answers with
 * ids, and the code rebuilds the lesson from the shapes it already has.
 * Each layer's prompt is versioned separately and recorded with its result.
 */
export type EditLayer = 'order' | 'steps' | 'instructions'

export const REGENERATE_PROMPT_VERSIONS: Record<EditLayer, string> = {
  order: 'regenerate-order-v1',
  steps: 'regenerate-steps-v1',
  instructions: 'regenerate-instructions-v1',
}

type Box = [number, number, number, number]
type XY = [number, number]

/** The current lesson as the model is told about it: where each shape is and how big, never its path data. */
export interface LessonSummary {
  canvas: { width: number; height: number }
  steps: {
    id: string
    title: string
    instruction: string
    strokes: { id: string; box: Box; start: XY; end: XY; length: number }[]
    fills: { id: string; color: string; box: Box; area: number }[]
  }[]
}

type Image = { contentType: string; base64: string }

export interface RegeneratePromptInput {
  layer: EditLayer
  title: string
  context: LessonContext
  lesson: LessonSummary
  /** What the creator wants changed this time; may be empty. */
  note: string
  /** A picture of the current drawing, rendered by the Studio. */
  drawing: Image
  /** The photo or SVG the lesson simplifies, when it has one. */
  reference?: Image
}

const text = { type: 'string' }
const ids = { type: 'array', items: { type: 'string' } }
const object = (properties: Record<string, unknown>) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
})
const answer = (properties: Record<string, unknown>) => object({ rationale: text, ...properties })

/** Strict JSON schemas: every answer carries a rationale for the creator and the steps as ids. */
export const REGENERATE_SCHEMAS: Record<EditLayer, unknown> = {
  instructions: answer({ steps: { type: 'array', items: object({ id: text, title: text, instruction: text }) } }),
  order: answer({
    steps: { type: 'array', items: object({ id: text, strokeIds: ids, fillIds: ids }) },
    reversedStrokeIds: ids,
  }),
  steps: answer({
    steps: { type: 'array', items: object({ id: text, title: text, instruction: text, strokeIds: ids, fillIds: ids }) },
  }),
}

const INTRO = `You improve pen-and-ink drawing lessons for Paper Coach. Adults who never learned to draw copy each step onto real paper with a pen, one step at a time, while a phone animates that step.

The drawing itself is finished and stays exactly as it is. You receive it as numbered lines (s1, s2, …) and colour areas (f1, f2, …) with where each one sits, grouped into the lesson's current steps, plus a picture of the drawing and sometimes the reference it simplifies. You change one layer of the lesson and leave everything else alone.`

const TASKS: Record<EditLayer, string> = {
  instructions: `Your layer: the words.
- Rewrite the title and instruction of every step. Keep every step, its id and its place: answer with one entry per step, in the lesson's order, using the lesson's step ids.
- The lines in each step are fixed. Use their positions and the picture to say exactly what they draw.`,
  order: `Your layer: the drawing sequence.
- Put the steps, and the lines and colours inside each step, in the order a capable person would draw them by hand: big structure first, then the main features, then details, with each new line starting where it meets something already on the page.
- A line is animated from its start point to its end point. List it in reversedStrokeIds when a hand would naturally draw it the other way, for example a roof edge from the eaves up to the ridge, or a long edge from left to right. Leave every other line out of reversedStrokeIds.
- Every step keeps its own lines, colours and words. Answer with every step id exactly once, each listing exactly its own line ids and colour ids in the new order. Never move a line or colour to another step.
- Steps that only colour stay after every step that draws lines.`,
  steps: `Your layer: the steps.
- Regroup the lines and colours into steps that teach well, and write each step's words. Use every line id and every colour id exactly once; never use an id that is not listed.
- Each step is one meaningful action a beginner can hold in mind: one to six lines that belong together, such as both windows or the two edges of a trunk. Aim for 4 to 12 steps.
- The learner is 8 to 16. Prefer what is intuitive, easy and natural to follow over what is economical, even if that means more steps. Finish one part of the subject completely before starting the next: the whole stem, then the leaf, then the leaf's centre line; never half of one thing, then another, then back.
- A very long curved line is hard for a young hand. When the lines you are given already split a big outline into parts, give each part its own step ("Draw the left side", "Draw the right side") rather than putting them together.
- Big structure first, then the main features, then details. Within a step, list the lines in the order to draw them.
- Colour areas go in their own steps after every step that draws lines: one colour per step, or two or three small areas together, large areas first. Name each colour in plain words. When the lesson has no colour areas, every fillIds list stays empty.
- id: a short lowercase slug, unique within the lesson.`,
}

const WORDS = `Words
- title: short and direct, for example "Draw the roofline".
- instruction: one or two short sentences a child of 8 to 16 reads at a glance: under about twelve words each, 110 characters in all. Say where the pen starts and what to draw, in plain words and a familiar picture ("a big letter C", "like a mirror"); leave out sizes and proportions. A colour step is one sentence: "Colour the leaf green." Calm: no exclamation marks, no praise, no art jargon.
- Describe only what the step's own lines and colours draw.`

const RATIONALE = 'rationale: one or two sentences for the lesson\'s creator on what you changed and why.'

function systemPrompt(layer: EditLayer): string {
  return [INTRO, TASKS[layer], layer === 'order' ? '' : WORDS, RATIONALE].filter(Boolean).join('\n\n')
}

function userText(input: RegeneratePromptInput): string {
  const n = (value: number) => String(Math.round(value))
  const box = (b: Box) => `${n(b[0])},${n(b[1])} to ${n(b[2])},${n(b[3])}`
  const xy = (p: XY) => `${n(p[0])},${n(p[1])}`
  const { lesson } = input
  const lines = contextLines(input.title, input.context)
  lines.push(
    '',
    `The current lesson, on a ${lesson.canvas.width} by ${lesson.canvas.height} canvas (origin top left, y down).`,
    'Lines: id: bounding box left,top to right,bottom; drawn from x,y to x,y; length.',
    'Colour areas: id: colour; bounding box; area in square units.',
  )
  lesson.steps.forEach((step, index) => {
    lines.push('', `Step ${index + 1}, id "${step.id}": ${step.title}`, `Instruction: ${step.instruction}`)
    for (const stroke of step.strokes) {
      lines.push(`${stroke.id}: ${box(stroke.box)}; from ${xy(stroke.start)} to ${xy(stroke.end)}; ${n(stroke.length)}`)
    }
    for (const fill of step.fills) lines.push(`${fill.id}: ${fill.color}; ${box(fill.box)}; ${n(fill.area)}`)
  })
  if (input.note) {
    lines.push('', "The creator's note for this change. Follow it unless it breaks a rule above:", input.note)
  }
  lines.push(
    '',
    input.reference
      ? 'A picture of the current drawing follows, then the reference it simplifies.'
      : 'A picture of the current drawing follows.',
  )
  return lines.join('\n')
}

const imagePart = (image: Image) => ({
  type: 'image_url' as const,
  image_url: { url: `data:${image.contentType};base64,${image.base64}` },
})

/** Text first, then the pictures, as for the other prompts. */
export function buildRegenerateMessages(input: RegeneratePromptInput): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt(input.layer) },
    {
      role: 'user',
      content: [
        { type: 'text', text: userText(input) },
        imagePart(input.drawing),
        ...(input.reference ? [imagePart(input.reference)] : []),
      ],
    },
  ]
}
