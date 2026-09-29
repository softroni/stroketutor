import { describe, expect, it } from 'vitest'

import { sessionPrompt } from './sessionPrompt'

describe('sessionPrompt', () => {
  const prompt = sessionPrompt({
    id: 'wheels',
    title: 'Wheels',
    level: { id: 'core', title: 'Core' },
    lessons: [
      { id: 'classic-red-car', title: 'Classic Red Car', planned: false },
      { id: 'car', title: 'Car', objective: 'Side view with two wheels', planned: true },
    ],
  })

  it('names the path, its folder and its documents', () => {
    expect(prompt).toContain('"Wheels" path (path id `wheels`)')
    expect(prompt).toContain('docs/curriculum/wheels/<lesson-id>-<model>.png')
    expect(prompt).toContain('docs/curriculum/wheels-prompts.md')
    expect(prompt).toContain('docs/curriculum/wheels-words.md')
  })

  it('asks for the picture prompts first and waits before building', () => {
    const [first, second] = prompt.split('PART 2')
    expect(first).toContain('PART 1: the picture prompts')
    expect(first).toContain('Then stop. Build nothing yet.')
    expect(first).not.toContain('voice narrate')
    expect(second).toContain('I will attach the pictures')
    expect(second).toContain('voice narrate')
    expect(second).toContain('without stopping for my approval')
    expect(second).not.toContain('Show it to me before building')
  })

  it('lists planned lessons to build, by their place, apart from the drawn ones', () => {
    const [todo, done] = prompt.split('Already drawn')
    expect(todo).toContain('2. car: Car (Side view with two wheels)')
    expect(todo).not.toContain('classic-red-car')
    expect(done).toContain('1. classic-red-car: Classic Red Car')
  })

  it("points at the level's system prompt instead of copying a style prompt", () => {
    const [first] = prompt.split('PART 2')
    expect(first).toContain('in the Core level, for learners aged 10 to 15.')
    expect(first).toContain('`style-v3-core` in web/src/studio/levelPrompts.ts')
    expect(first).toContain('lines a learner of ten to fifteen can draw')
    expect(first).not.toContain('style-v2')
    expect(first).not.toContain('a child')
    expect(prompt).toContain('fruits-words.md, for learners aged 10 to 15')
  })

  it('asks for the level first when the path has none with a system prompt', () => {
    for (const level of [null, { id: 'bonus', title: 'Bonus' }]) {
      const text = sessionPrompt({ id: 'a', title: 'A', level, lessons: [] })
      expect(text).toContain('Ask me which level it belongs to')
      expect(text).not.toContain('style-v3')
    }
  })

  it('says so when nothing is left to build', () => {
    expect(
      sessionPrompt({ id: 'a', title: 'A', level: null, lessons: [{ id: 'x', title: 'X', planned: false }] }),
    ).toContain('Every lesson of this path already has a drawing.')
  })
})
