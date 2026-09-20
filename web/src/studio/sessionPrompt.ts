/** One lesson of the path, as the prompt lists it. */
export interface PromptLesson {
  id: string
  title: string
  objective?: string
  /** Planned lessons have nothing drawn yet; they are the ones the session builds. */
  planned: boolean
}

export interface PromptPath {
  id: string
  title: string
  lessons: PromptLesson[]
}

/**
 * What to paste into a new Claude Code session to have a path's lessons made,
 * start to finish, in two parts with a wait between them. First the session
 * writes the picture prompts for an image model and stops; the creator has the
 * pictures generated (ChatGPT) and attaches them to the same session; then the
 * session builds every lesson. It is the order of work that the Fruits path
 * taught (2026-09-19): ask for pictures that trace well, check every picture
 * by tracing it before building on it, plan the path's words in one document
 * before any agent writes, keep the agents few, and look at every contact sheet.
 */
export function sessionPrompt(path: PromptPath): string {
  const todo = path.lessons.filter((lesson) => lesson.planned)
  const done = path.lessons.filter((lesson) => !lesson.planned)
  const line = (lesson: PromptLesson) =>
    `  ${path.lessons.indexOf(lesson) + 1}. ${lesson.id}: ${lesson.title}${lesson.objective ? ` (${lesson.objective})` : ''}`

  return [
    `Make the lessons of the "${path.title}" path (path id \`${path.id}\`), in two parts. Do part 1, then stop and wait for me.`,
    '',
    todo.length > 0 ? 'Lessons to make (each id is a planned placeholder; build under it so it keeps its place):' : 'Every lesson of this path already has a drawing.',
    ...todo.map(line),
    ...(done.length > 0 ? ['', 'Already drawn (leave them alone; read their words so nothing is repeated):', ...done.map(line)] : []),
    '',
    'First read your memory, then the author-lesson and studio-cli skills. US English in everything a learner',
    'reads or hears (color, center, gray).',
    '',
    'PART 1: the picture prompts',
    `Write docs/curriculum/${path.id}-prompts.md, modeled on docs/curriculum/fruits-prompts.md: the same style prompt,`,
    'word for word (style-v2), and one lesson prompt per lesson above with the exact parts and counts its objective',
    'names. Write each lesson prompt so the picture will trace into lines a child can draw:',
    '- every part has its own dark outline; nothing is shown by color alone;',
    '- parts stand apart with a clear white gap, touching only where one is attached to another; nothing overlaps',
    '  unless the objective is about overlap, and then only a few simple shapes do;',
    '- details are single lines of the same weight as the outlines, never thinner, never a colored tube or ribbon;',
    '- no highlights, shading, texture or shadow unless the objective asks for one;',
    '- the subject fills about 70% of the image, a little less when it is one big round shape;',
    '- colors come from docs/curriculum/palette.json, named in plain words with their hex values.',
    'Then give me, in the chat, one block per lesson that I can copy as it is into ChatGPT: the style prompt, a blank',
    'line and that lesson\'s prompt, headed by the lesson id, with the reference line for attaching a published',
    'picture of the course. Tell me anything you were unsure of in a lesson\'s objective. Then stop. Build nothing yet.',
    '',
    'PART 2: the lessons, when I come back with the pictures',
    'I will attach the pictures to a message in this session, one per lesson, and say which image model made them.',
    'From there, work through to the end without stopping for my approval; only a picture that has to be',
    'regenerated is worth waiting on, and only for that lesson.',
    `1. Save each one as docs/curriculum/${path.id}/<lesson-id>-<model>.png, matching picture to lesson by its subject.`,
    '   Tell me which file became which lesson, and if any lesson has no picture or any picture did not arrive as a',
    '   file. Work from the saved files from then on.',
    '2. Trace every picture yourself (svg from-image, svg trace --summary, svg preview) and give me one line per',
    '   picture: clean / needs the color-edge trace / regenerate, with the fix for its prompt. Solid dark shapes and',
    '   circles that touch get their outlines from `svg trace --ink-max-channel 0`, merged into the ink trace; thin',
    '   lines may need `svg from-image --min-area 10 --max-colours 12`. If a picture is the problem, say so and wait',
    '   for a new one instead of working around it; carry on with the others meanwhile.',
    `3. Write docs/curriculum/${path.id}-words.md, modeled on docs/curriculum/fruits-words.md: the rules, the phrases`,
    '   published lessons have already used, and a full script per lesson. Steps open with what is being drawn; no',
    '   sentence repeats across lessons except a plain color step; every intro, hand-over and outro is different.',
    '   Do not wait for me to review it: carry straight on. I will read the words once every lesson is done.',
    '4. Build with Opus agents, at most 4 at a time, one lesson each, every one following the words document:',
    '   build, look at the contact sheet, zoom into every junction for stray tails, `lessons quality`, then',
    '   `voice narrate`. Drafts only: no approve, no publish, no commit, nothing under shared/.',
    '5. Look at every contact sheet yourself before you call a lesson ready, and read all the scripts side by side',
    '   at the end. Then give me one report: each lesson with its steps and words, its contact sheet, its quality',
    '   warnings and anything you want me to look at. I will review then and send my feedback in one go.',
  ].join('\n')
}
