import type { ChatMessage } from './lessonPrompt'

/**
 * The prompt for the lines Lina speaks while a step animates.
 *
 * A step's written instruction is written to be read on a screen and re-read:
 * it says where a line starts, what it lines up with, how big it is. Spoken
 * aloud it is far too long — Palm Tree's first instruction takes seventeen
 * seconds, and the stroke is drawn in three. The spoken line is a different
 * piece of writing for the same step: one or two sentences a teacher would say
 * over the learner's shoulder while the stroke draws, with the written
 * instruction still on screen for anyone who wants the detail.
 *
 * The model is told about every step, including ones that already have a line,
 * so the lesson it writes has one voice throughout; which of its lines are kept
 * is `writeSpokenLines`'s decision, not the prompt's.
 *
 * Versioned like the other prompts, because a change here changes how Lina
 * sounds and every run records the version that produced it.
 */
export const SPOKEN_LINES_PROMPT_VERSION = 'spoken-lines-v1'

/** The longest a spoken line may be, in characters. About eight seconds of speech. */
export const MAX_SPOKEN_LINE = 240

/** One step as the model is told about it: its words, and how much it draws or colours. */
export interface SpokenLinesStep {
  id: string
  title: string
  instruction: string
  /** How many lines this step draws. A colour step has none. */
  strokes: number
  /** How many areas this step colours. */
  fills: number
  /** The line the creator already wrote for it, when there is one. */
  spokenLine: string | null
}

export interface SpokenLinesInput {
  title: string
  /** The lesson's one-line objective from the catalog, when it has an entry. */
  objective: string
  steps: SpokenLinesStep[]
  /** What the creator wants different this time; may be empty. */
  note: string
  /** True when lines already written are being kept, so the model is told which. */
  keepWritten: boolean
}

const text = { type: 'string' }

/** Strict JSON: a rationale for the creator, then one line per step, in order. */
export const SPOKEN_LINES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rationale', 'lines'],
  properties: {
    rationale: text,
    lines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'text'],
        properties: { id: text, text },
      },
    },
  },
}

const SYSTEM = `You write what Lina says out loud in Paper Coach, a drawing app for adults who never learned to draw. Each step of a lesson animates one part of the drawing while the learner copies it onto real paper with a pen.

Lina is an adult art teacher: warm, genuinely glad to be teaching this, calm. She is not a cheerleader and not a narrator reading a manual. She speaks the way a good teacher speaks while you are already drawing — beside you, not at you.

Every step keeps its written instruction on screen, so your line does not have to carry the detail. It has to carry the start.

Rules for each line:
- One or two sentences. At most 22 words, and shorter is better: the line is spoken while the stroke draws, in five to eight seconds.
- Say where to start and which way the line goes, or which area to colour. That is what someone with a pen in their hand needs first.
- Plain words. No art jargon, nothing that sounds written for a child, no praise for work not done yet.
- Do not open every line with "Now". Vary how the lines begin, and let some begin with the thing itself.
- At most one exclamation mark in the whole lesson, and none is fine.
- Never mention the app, the screen, tapping, buttons, the animation or the instruction.
- A colour step is shorter than a drawing step: name the area and the colour, and stop.
- The last step may close the lesson in a few words, once the drawing is done.

Two examples of the register.

A drawing step titled "Draw the trunk", whose instruction is a paragraph about two near-parallel curves leaning right from the base of the canvas:
  "Start at the bottom and sweep up to the right, then bring a second curve up beside it."

A colour step titled "Colour the leaves":
  "Fill the fronds with green, working from the stem outwards."

rationale: one or two sentences for the lesson's creator on how you pitched the lesson.
lines: one entry per step, in the order given, each with the step's own id. Use every step id exactly once.`

function userText(input: SpokenLinesInput): string {
  const lines = [
    `Lesson: ${input.title}`,
    ...(input.objective ? [`What it teaches: ${input.objective}`] : []),
    `${input.steps.length} steps follow, in order.`,
  ]
  input.steps.forEach((step, index) => {
    const draws =
      step.strokes > 0 && step.fills > 0
        ? `${count(step.strokes, 'line')} and ${count(step.fills, 'colour area')}`
        : step.fills > 0
          ? `${count(step.fills, 'colour area')}, no lines`
          : count(step.strokes, 'line')
    lines.push('', `Step ${index + 1}, id "${step.id}": ${step.title} (${draws})`, `Written instruction: ${step.instruction}`)
    if (step.spokenLine) {
      lines.push(
        input.keepWritten
          ? `Already spoken here, and being kept: “${step.spokenLine}”. Answer for this step anyway; match its register.`
          : `Spoken here now, and being replaced: “${step.spokenLine}”`,
      )
    }
  })
  if (input.note) {
    lines.push('', "The creator's note for this lesson. Follow it unless it breaks a rule above:", input.note)
  }
  return lines.join('\n')
}

function count(n: number, one: string): string {
  return `${n} ${n === 1 ? one : `${one}s`}`
}

export function buildSpokenLinesMessages(input: SpokenLinesInput): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: [{ type: 'text', text: userText(input) }] },
  ]
}
