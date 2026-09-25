/**
 * The instructions sent with every lesson generation, and the shape the model
 * must answer in. Versioned, because prompt changes change content quality and
 * every generated lesson records which version produced it (master plan §24).
 */
export const PROMPT_VERSION = 'lesson-v1'

export interface PreviousLesson {
  title: string
  objective: string
  steps: number
  strokes: number
}

/** Where the new lesson sits in the curriculum, and what the creator asked for. */
export interface LessonContext {
  pathTitle: string | null
  /** Zero-based position of the new lesson in its path. */
  position: number
  /** The lessons before it in the path, in order. */
  previous: PreviousLesson[]
  goal: string
  constraints: string
}

export interface PromptInput {
  title: string
  canvas: { width: number; height: number }
  image: { contentType: string; base64: string }
  context: LessonContext
}

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: ContentPart[] }

const stringList = { type: 'array', items: { type: 'string' } }

/**
 * Strict JSON schema for the model's answer (§22): creator-facing analysis plus
 * the steps. Only what the model must decide is asked for; schemaVersion, id,
 * title and canvas are filled in by the server, so they cannot be wrong.
 * Numeric limits are left to the Studio's own validation, which reports the
 * exact field.
 */
export const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['analysis', 'tutorial'],
  properties: {
    analysis: {
      type: 'object',
      additionalProperties: false,
      required: ['mainForms', 'importantDetails', 'detailsRemoved', 'drawingStrategy'],
      properties: {
        mainForms: stringList,
        importantDetails: stringList,
        detailsRemoved: stringList,
        drawingStrategy: { type: 'string' },
      },
    },
    tutorial: {
      type: 'object',
      additionalProperties: false,
      required: ['steps'],
      properties: {
        steps: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'title', 'instruction', 'strokes'],
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              instruction: { type: 'string' },
              strokes: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['d', 'duration', 'lineWidth'],
                  properties: {
                    d: { type: 'string' },
                    duration: { type: 'number' },
                    lineWidth: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const

function systemPrompt(canvas: { width: number; height: number }): string {
  return `You design pen-and-ink drawing lessons for Paper Couch. Adults who never learned to draw copy each step onto real paper with a pen, one step at a time, while a phone animates that step. Turn a real-world reference photo into a simplified drawing a beginner can finish in about five minutes, and teach it in a natural order.

Answer in two parts.

1. analysis: study the photo before drawing.
- mainForms: the few big shapes that make the subject recognisable.
- importantDetails: the details worth keeping because they add recognition, depth or character.
- detailsRemoved: what you deliberately leave out, each with a few words on why.
- drawingStrategy: one or two sentences on where the drawing starts and how it builds up.

2. tutorial: the drawing itself, as ordered steps of pen strokes.

Drawing
- Coordinates are on a ${canvas.width} by ${canvas.height} canvas, origin at the top left, y pointing down. Keep the drawing inside it with a comfortable margin.
- Every stroke is one continuous pen gesture a person would really make: a wall, a roofline, a window outline. Prefer a few confident lines to many small ones; roughly 8 to 30 strokes in total.
- Lines should look drawn by a capable hand, not a machine: allow slight natural curvature and imperfection, using gentle Q or C curves where a real pen would not be dead straight. Stay clean: no scribbles, no repeated sketchy lines.
- Leave out texture, shading and hatching unless one small touch is essential to read the subject.

Path syntax, strictly
- Use only these commands, uppercase and absolute: M x y, L x y, Q cx cy x y, C c1x c1y c2x c2y x y, and Z.
- Never use lowercase (relative) commands, and never H, V, S, T or A. Draw circles and arcs with C curves.
- Plain decimal numbers separated by spaces, for example "M 250 480 L 750 480". Every d starts with M.

Timing and weight
- duration: seconds to animate the stroke at normal speed. About one second per 200 canvas units of length; at least 0.6 and at most 4.
- lineWidth: canvas units. About 14 for the main structure, 10 to 12 for secondary lines and details.

Teaching
- 4 to 9 steps. Each step is one meaningful action a beginner can hold in mind, and may contain several related strokes, such as both windows.
- Order the steps the way someone would draw it: big structure first, then the main features, then details.
- title: short and direct, for example "Draw the roofline".
- instruction: one or two calm sentences for an adult. Say what to notice as well as what to draw: where the line starts, what it lines up with, how big it is compared with something already on the page. No exclamation marks, no praise, no art jargon.
- id: a short lowercase slug, unique within the lesson.`
}

function userText(title: string, context: LessonContext): string {
  return [...contextLines(title, context), '', 'The reference photo follows.'].join('\n')
}

/** Where the lesson sits in its path and what the creator asked for; shared with the SVG prompt. */
export function contextLines(title: string, context: LessonContext): string[] {
  const lines: string[] = []
  lines.push(
    context.pathTitle
      ? `Lesson: "${title}", lesson ${context.position + 1} of the "${context.pathTitle}" path.`
      : `Lesson: "${title}".`,
  )
  if (context.previous.length > 0) {
    lines.push('', 'The learner has already drawn these lessons in this path, in order:')
    for (const lesson of context.previous) {
      lines.push(
        `- "${lesson.title}": ${lesson.objective || 'no objective recorded'} (${lesson.steps} steps, ${lesson.strokes} strokes)`,
      )
    }
    lines.push('Build on what they already know. This lesson should be a modest step up, not a leap.')
  } else {
    lines.push('', 'This is the first lesson of its path, so aim for an immediate success.')
  }
  lines.push('', "The creator's learning goal for this lesson:", context.goal)
  if (context.constraints) lines.push('', "The creator's constraints:", context.constraints)
  return lines
}

/**
 * Text first, then the photo: OpenRouter recommends that order for image
 * inputs (https://openrouter.ai/docs/guides/overview/multimodal/image-understanding).
 */
export function buildMessages(input: PromptInput): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt(input.canvas) },
    {
      role: 'user',
      content: [
        { type: 'text', text: userText(input.title, input.context) },
        {
          type: 'image_url',
          image_url: { url: `data:${input.image.contentType};base64,${input.image.base64}` },
        },
      ],
    },
  ]
}
