import { describe, expect, it } from 'vitest'

import { sessionPrompt } from './sessionPrompt'

describe('sessionPrompt', () => {
  const prompt = sessionPrompt({
    id: 'wheels',
    title: 'Wheels',
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

  it('says so when nothing is left to build', () => {
    expect(sessionPrompt({ id: 'a', title: 'A', lessons: [{ id: 'x', title: 'X', planned: false }] })).toContain(
      'Every lesson of this path already has a drawing.',
    )
  })
})
