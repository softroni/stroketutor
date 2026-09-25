import { OUTPUT_SCHEMA, contextLines, type ChatMessage, type LessonContext } from './lessonPrompt'

/**
 * The instructions for teaching a drawing traced from the creator's SVG
 * ("code traces, model teaches", 2026-09-11). The Studio has already made
 * every line and colour; the model only orders them into steps and writes
 * the words. Versioned like the photo prompt, and recorded with each lesson.
 */
export const SVG_PROMPT_VERSION = 'svg-lesson-v1'

type Box = [number, number, number, number]

/** What the model is told about the traced drawing: where things are and how big, never path data. */
export interface TraceSummary {
  canvas: { width: number; height: number }
  strokes: { id: string; box: Box; length: number; closed: boolean }[]
  fills: { id: string; color: string; area: number; box: Box }[]
}

export interface SvgPromptInput {
  title: string
  context: LessonContext
  trace: TraceSummary
  /** A picture of the finished drawing, rendered from the SVG. */
  image: { contentType: string; base64: string }
}

const stepsOf = (idsKey: 'strokeIds' | 'fillIds') => ({
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'title', 'instruction', idsKey],
    properties: {
      id: { type: 'string' },
      title: { type: 'string' },
      instruction: { type: 'string' },
      [idsKey]: { type: 'array', items: { type: 'string' } },
    },
  },
})

/** Strict JSON schema for the answer: the same analysis as the photo prompt, then the two kinds of step. */
export const SVG_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['analysis', 'outlineSteps', 'colourSteps'],
  properties: {
    analysis: OUTPUT_SCHEMA.properties.analysis,
    outlineSteps: stepsOf('strokeIds'),
    colourSteps: stepsOf('fillIds'),
  },
}

const SYSTEM_PROMPT = `You design pen-and-ink drawing lessons for Paper Couch. Adults who never learned to draw copy each step onto real paper with a pen, one step at a time, while a phone animates that step.

The drawing is already made. It was traced from the creator's own SVG file, and you receive it as a list of numbered lines and colour areas with where each one sits, plus a picture of the finished drawing. Do not invent, change or leave out any geometry. Your job is to teach it: put the lines into steps in the order a person would draw them, then the colours, and write what to do in each step.

Answer in three parts.

1. analysis: study the picture.
- mainForms: the few big shapes that make the subject recognisable.
- importantDetails: the details the lines keep that add recognition or character.
- detailsRemoved: anything visible in the picture that the listed lines leave out; an empty list if nothing.
- drawingStrategy: one or two sentences on where the drawing starts and how it builds up.

2. outlineSteps: every line, in drawing order.
- Use every line id exactly once. Never use an id that is not listed.
- 4 to 12 steps. Each step is one meaningful action a beginner can hold in mind: one to six lines that belong together, such as the two edges of a trunk.
- The learner is 8 to 16. Prefer what is intuitive, easy and natural to follow over what is economical, even if that means more steps. Finish one part of the subject completely before starting the next: the whole stem, then the leaf, then the leaf's centre line; never half of one thing, then another, then back.
- A very long curved line is hard for a young hand. When the lines you are given already split a big outline into parts, give each part its own step ("Draw the left side", "Draw the right side") rather than putting them together.
- Big structure first, then the main features, then details. Within a step, list the lines in the order to draw them.
- Use the bounding boxes and the picture to tell which lines form which part.

3. colourSteps: after every outline is drawn.
- Use every colour id exactly once. Leave colourSteps empty only when there are no colour areas.
- One colour per step, or two or three small areas coloured together. Large areas first.
- Name each colour in plain words, such as dark green or sand, and say what it covers.

Every step
- title: short and direct, for example "Draw the trunk" or "Colour the leaves".
- instruction: one or two short sentences a child of 8 to 16 reads at a glance: under about twelve words each, 110 characters in all. Say where the pen starts and what to draw, in plain words and a familiar picture ("a big letter C", "like a mirror"); leave out sizes and proportions. A colour step is one sentence: "Colour the leaf green." Calm: no exclamation marks, no praise, no art jargon.
- id: a short lowercase slug, unique within the lesson.`

function userText(input: SvgPromptInput): string {
  const { trace } = input
  const n = (value: number) => String(Math.round(value))
  const box = (b: Box) => `${n(b[0])},${n(b[1])} to ${n(b[2])},${n(b[3])}`
  const lines = contextLines(input.title, input.context)
  lines.push(
    '',
    `The drawing, traced from the creator's SVG, on a ${trace.canvas.width} by ${trace.canvas.height} canvas (origin top left, y down).`,
    '',
    'Lines (id: bounding box left,top to right,bottom; length; open or closed):',
  )
  for (const stroke of trace.strokes) {
    lines.push(`${stroke.id}: ${box(stroke.box)}; ${n(stroke.length)}; ${stroke.closed ? 'closed' : 'open'}`)
  }
  if (trace.fills.length > 0) {
    lines.push('', 'Colour areas (id: colour; bounding box; area in square units):')
    for (const fill of trace.fills) lines.push(`${fill.id}: ${fill.color}; ${box(fill.box)}; ${n(fill.area)}`)
  } else {
    lines.push('', 'There are no colour areas, so colourSteps stays empty.')
  }
  lines.push('', 'A picture of the finished, coloured drawing follows.')
  return lines.join('\n')
}

/** Text first, then the picture, as for the photo prompt. */
export function buildSvgMessages(input: SvgPromptInput): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: userText(input) },
        { type: 'image_url', image_url: { url: `data:${input.image.contentType};base64,${input.image.base64}` } },
      ],
    },
  ]
}
