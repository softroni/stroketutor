import type { Tutorial } from '../schema/types'

/**
 * What Lina says around a lesson, as a teacher would: a few words before it
 * starts, over a quick look at how the drawing comes together, and one
 * sentence at the end. They are narrated, recorded and published exactly as a
 * step is, under two ids no real step may take, so everything that knows about
 * steps (the Voice page, `voice narrate`, the manifest) knows about them too.
 *
 * Every lesson has words for both without anybody writing them: a few
 * patterns, chosen by the lesson's id so that one lesson always says the same
 * thing and the next one along probably says something else. A spoken line
 * written for either id (`voice lines set <lesson> lesson-outro "…"`) replaces
 * the pattern, which is how a lesson gets a line about its own subject.
 */
export const INTRO_ID = 'lesson-intro'
export const OUTRO_ID = 'lesson-outro'

export type BookendKind = 'intro' | 'outro'

export const bookendKind = (stepId: string): BookendKind | null => (stepId === INTRO_ID ? 'intro' : stepId === OUTRO_ID ? 'outro' : null)

export const BOOKEND_TITLES: Record<BookendKind, string> = { intro: 'Before the lesson', outro: 'After the lesson' }

// A teacher greets, says what is being made, takes the pressure off, and hands over.
const INTROS = [
  'Hi, it’s Lina. Today we’re drawing {subject}. Watch how it comes together, then it’s your turn.',
  'Hello again. This time it’s {subject}. Have a look at how it’s made first, then we’ll draw it together, one step at a time.',
  'Hi, Lina here. Ready to draw {subject}? Watch the whole thing once, then grab your pen.',
  'Hey, good to see you. We’re going to draw {subject} today. It’s easier than it looks. Watch first, then we’ll go slowly.',
]

// At the end a teacher looks at the child's drawing, not at the model: it is theirs, and it need not match.
const OUTROS = [
  'You did it. That’s your very own {thing}, and nobody else’s looks quite like yours.',
  'Look at that, {subject}, drawn by you. Wobbly lines are welcome here. They’re what make it yours.',
  'And that’s {subject}. Hold it up and have a good look. You made that.',
  'All done. Every time you draw, your hand learns a little more, and today it learned {subject}.',
  'Nice work sticking with it to the end. Show someone your {thing}. I bet they’ll smile.',
]

/** "Apple" → "an apple", "Cherries" → "cherries", "Watermelon Slice" → "a watermelon slice". */
export function subjectOf(title: string): { subject: string; thing: string } {
  const thing = title.trim().toLowerCase()
  const plural = /[^s]s$/.test(thing)
  const article = /^[aeiou]/.test(thing) ? 'an' : 'a'
  return { thing, subject: plural ? thing : `${article} ${thing}` }
}

function pick(list: string[], lessonId: string, salt: number): string {
  let hash = salt
  for (const char of lessonId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return list[hash % list.length]
}

/** The words a lesson's intro or outro says when no line has been written for it. */
export function defaultBookend(kind: BookendKind, tutorial: Pick<Tutorial, 'id' | 'title'>): string {
  const { subject, thing } = subjectOf(tutorial.title)
  const pattern = kind === 'intro' ? pick(INTROS, tutorial.id, 7) : pick(OUTROS, tutorial.id, 13)
  const text = pattern.replace('{subject}', subject).replace('{thing}', thing)
  return text.charAt(0).toUpperCase() + text.slice(1)
}
