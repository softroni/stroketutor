import { describe, expect, it } from 'vitest'

import { alignWords, estimateWords, scriptWords } from './words'

describe('scriptWords', () => {
  it('splits at spaces and keeps a lone dash with the word before it', () => {
    expect(scriptWords(' Draw the roof — a triangle. ')).toEqual(['Draw', 'the', 'roof —', 'a', 'triangle.'])
  })
})

describe('alignWords', () => {
  it('shows the script’s words at the times Whisper heard them', () => {
    const heard = [
      { word: "Let's", start: 0, end: 0.66 },
      { word: 'draw', start: 0.66, end: 0.8 },
      { word: 'a', start: 0.8, end: 0.96 },
      { word: 'rocket.', start: 0.96, end: 1.5 },
    ]
    expect(alignWords('Let’s draw a rocket.', heard, 2)).toEqual([
      { text: 'Let’s', start: 0, end: 0.66 },
      { text: 'draw', start: 0.66, end: 0.8 },
      { text: 'a', start: 0.8, end: 0.96 },
      { text: 'rocket.', start: 0.96, end: 1.5 },
    ])
  })

  it('shares the gap between heard words among the ones it heard differently', () => {
    const heard = [
      { word: 'Draw', start: 0.2, end: 0.5 },
      { word: 'four', start: 0.5, end: 0.8 },
      { word: 'legs.', start: 1.1, end: 1.4 },
    ]
    const words = alignWords('Draw 4 long legs.', heard, 2)!
    expect(words.map((word) => word.text)).toEqual(['Draw', '4', 'long', 'legs.'])
    expect(words[1].start).toBeCloseTo(0.5)
    expect(words[2].end).toBeCloseTo(1.1)
    expect(words[1].end).toBeCloseTo(words[2].start)
    expect(words[3]).toMatchObject({ start: 1.1, end: 1.4 })
  })

  it('gives up when nothing lines up', () => {
    expect(alignWords('Draw a circle.', [{ word: 'Hello', start: 0, end: 1 }], 2)).toBeNull()
    expect(alignWords('Draw a circle.', [], 2)).toBeNull()
  })
})

describe('estimateWords', () => {
  it('shares the recording by the words’ lengths, with a breath after a sentence', () => {
    const words = estimateWords('Draw it. Then color it.', 3)
    expect(words.map((word) => word.text)).toEqual(['Draw', 'it.', 'Then', 'color', 'it.'])
    expect(words[0].start).toBe(0)
    expect(words[4].end).toBeCloseTo(3)
    expect(words[2].start - words[1].end).toBeGreaterThan(words[1].start - words[0].end)
    for (let i = 1; i < words.length; i += 1) expect(words[i].start).toBeGreaterThanOrEqual(words[i - 1].end)
  })
})
