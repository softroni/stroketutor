import { describe, expect, it } from 'vitest'

import type { Tutorial } from '../../src/schema/types'

import { captionsFor, defaultIntro, planVideo, postCaption, stillMoments, subjectOf } from './plan'

const tutorial: Tutorial = {
  schemaVersion: 2,
  id: 'fish-chips',
  title: 'Fish & <Chips>',
  canvas: { width: 1000, height: 1000 },
  steps: [
    { id: 'body', title: 'Draw the body', instruction: 'A long oval.', voiceover: null, strokes: [{ d: 'M 0 0 L 10 10', duration: 2, lineWidth: 10 }] },
    { id: 'colour', title: 'Color it', instruction: 'Orange.', voiceover: null, strokes: [], fills: [{ d: 'M 0 0 L 10 0 L 10 10 Z', color: '#FF8800', duration: 1 }] },
  ],
}

const plan = () =>
  planVideo({
    tutorial,
    intro: { text: 'Let’s draw fish. Grab a pencil.', durationS: 4 },
    clips: {
      body: { text: 'Start with a long oval.', durationS: 3 },
      'lesson-outro': { text: 'Done!', durationS: 2 },
    },
    place: { pathTitle: 'Food & Treats', number: 2, count: 10 },
    cta: 'Free <b>now</b>',
  })

describe('planVideo', () => {
  it('times each part from the recordings and the lesson’s own pace', () => {
    const { segments, cues, total } = plan()
    // The opening: Lina at 0.35 s for 4 s, then 0.6 s with the finished picture.
    expect(segments[0]).toMatchObject({ kind: 'intro', start: 0 })
    expect(segments[0].end).toBeCloseTo(4.95)
    // A step lasts as long as the longer of its recording (from 0.25 s in) and its lines (from 0.6 s in), plus 0.9 s.
    expect(segments[1]).toMatchObject({ kind: 'step', index: 0 })
    expect(segments[1].start).toBeCloseTo(4.95)
    expect((segments[1] as { drawAt: number }).drawAt).toBeCloseTo(5.55)
    expect(segments[1].end).toBeCloseTo(9.1)
    // A step with no recording lasts as long as its colour takes.
    expect(segments[2].end).toBeCloseTo(11.6)
    // The ending holds 2.6 s after Lina's closing line.
    expect(segments[3]).toMatchObject({ kind: 'outro' })
    expect(total).toBeCloseTo(16.5)
    expect(cues.map((cue) => cue.key)).toEqual(['intro', 'body', 'lesson-outro'])
    expect(cues[1].at).toBeCloseTo(5.2)
  })

  it('draws the whole lesson in the opening, never slower than its own pace', () => {
    const { hook, segments } = plan()
    expect(hook.speed).toBe(1)
    expect(hook.drawFrom).toBeGreaterThan(hook.hold)
    expect(hook.drawFrom + 3 / hook.speed).toBeLessThanOrEqual(segments[0].end)
  })

  it('escapes every piece of text the page shows as HTML', () => {
    const { text } = plan()
    expect(text.introTitle).toBe('Let’s draw a <em>fish &amp; &lt;chips&gt;</em>')
    expect(text.introChip).toBe('Food &amp; Treats · Lesson 2 of 10')
    expect(text.cta).toBe('Free &lt;b&gt;now&lt;/b&gt;')
  })

  it('picks stills inside the video', () => {
    const p = plan()
    const moments = stillMoments(p, tutorial)
    expect(moments.map((moment) => moment.name)).toEqual(['opening', 'opening-drawing', 'line', 'colour', 'ending'])
    for (const moment of moments) expect(moment.at).toBeLessThan(p.total)
  })
})

describe('captionsFor', () => {
  it('shows a sentence or two at a time, with no gap from the start of the part to its end', () => {
    const captions = captionsFor({ text: 'Now the rind. Draw a curve across the slice, a little above the bottom. That makes a stripe.', durationS: 6 }, 1, 0.5, 9)
    expect(captions.map((caption) => caption.text)).toEqual([
      'Now the rind. Draw a curve across the slice, a little above the bottom.',
      'That makes a stripe.',
    ])
    expect(captions[0].from).toBe(0.5)
    expect(captions[0].to).toBe(captions[1].from)
    expect(captions[1].to).toBe(9)
  })
})

describe('subjectOf and defaultIntro', () => {
  it.each([
    ['Watermelon Slice', 'a', 'watermelon slice'],
    ['Ice Cream Cone', 'an', 'ice cream cone'],
    ['Orange Half', 'an', 'orange half'],
    ['UFO', 'a', 'UFO'],
    ['Mars Rover', 'a', 'Mars rover'],
    ['Grapes', '', 'grapes'],
    ['Rolling Hills', '', 'rolling hills'],
    ['Dice', '', 'dice'],
    ['Cactus', 'a', 'cactus'],
    ['School Bus', 'a', 'school bus'],
    ['Stack of Books', 'a', 'stack of books'],
    ['Planet with Rings', 'a', 'planet with rings'],
  ])('%s → %s %s', (title, article, subject) => {
    expect(subjectOf(title)).toEqual({ article, subject })
  })

  it('invites the viewer to draw along', () => {
    expect(defaultIntro('Watermelon Slice')).toBe('Let’s draw a watermelon slice. Grab a pencil and draw along with me.')
    expect(defaultIntro('Cherries')).toBe('Let’s draw cherries. Grab a pencil and draw along with me.')
  })
})

describe('postCaption', () => {
  it('says what the video is, where the lesson is, and tags it', () => {
    const caption = postCaption(tutorial, { pathTitle: 'Food & Treats', number: 2, count: 10 })
    expect(caption).toContain('fish & <chips>: 1 easy step, then color it in.')
    expect(caption).toContain('Lesson 2 of the Food & Treats path in Paper Coach.')
    expect(caption).toMatch(/#howtodraw .* #fishchips #papercoach$/)
  })
})
