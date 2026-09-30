import { describe, expect, it } from 'vitest'

import type { Tutorial } from '../../src/schema/types'

import {
  SPEED_DRAW,
  captionsFor,
  defaultIntro,
  defaultSpeedIntro,
  defaultSignoff,
  lineChunks,
  planVideo,
  postCaption,
  stickerLessons,
  stillMoments,
  subjectOf,
  type Segment,
  type VideoInput,
} from './plan'

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

// "Draw more with Paper Coach." as Whisper heard it: she stops at 2.1 s of a 2.5 s take.
const signoff = {
  text: 'Draw more with Paper Coach.',
  durationS: 2.5,
  words: [
    { text: 'Draw', start: 0.1, end: 0.4 },
    { text: 'more', start: 0.4, end: 0.7 },
    { text: 'with', start: 0.7, end: 0.9 },
    { text: 'Paper', start: 0.9, end: 1.5 },
    { text: 'Coach.', start: 1.5, end: 2.1 },
  ],
}

const plan = (changes: Partial<VideoInput> = {}) =>
  planVideo({
    tutorial,
    intro: { text: 'Let’s draw fish. Grab a pencil.', durationS: 4 },
    signoff,
    clips: {
      body: { text: 'Start with a long oval.', durationS: 3 },
      'lesson-outro': { text: 'That’s a fish, all yours.', durationS: 2 },
    },
    place: { pathTitle: 'Food & Treats', number: 2, count: 10 },
    cta: 'Free <b>now</b>',
    stickers: 3,
    ...changes,
  })

const endingOf = (segments: Segment[]) => segments[segments.length - 1] as Extract<Segment, { kind: 'outro' }>

describe('the speed draw', () => {
  it('goes from the opening straight to the ending, with no steps and none of their recordings', () => {
    const { segments, cues } = plan({ speed: true })
    expect(segments.map((segment) => segment.kind)).toEqual(['intro', 'outro'])
    expect(cues.map((cue) => cue.key)).not.toContain('body')
  })

  it('holds the opening until the whole picture has drawn, at no faster than the lesson’s own pace', () => {
    // Three seconds of drawing: the opening waits for all of it, however short Lina's line.
    const short = plan({ speed: true, intro: { text: 'Watch.', durationS: 0.5 } })
    expect(short.hook.speed).toBeCloseTo(1)
    expect(short.hook.drawFrom + 3 / short.hook.speed).toBeLessThanOrEqual(short.segments[0].end + 1e-9)
    // A long lesson is drawn in SPEED_DRAW seconds.
    const long = plan({ speed: true, tutorial: { ...tutorial, steps: tutorial.steps.map((step) => ({ ...step, strokes: step.strokes.map((stroke) => ({ ...stroke, duration: 30 })) })) } })
    expect(long.hook.drawFrom + 31 / long.hook.speed).toBeCloseTo(long.hook.drawFrom + SPEED_DRAW)
  })

  it('says it shows the drawing rather than drawing along', () => {
    expect(defaultSpeedIntro('Rocket')).toBe('Watch a rocket come together, one line at a time.')
  })
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
    // The ending: her closing line from 0.3 s in, a breath, then her last words, and 1.6 s after she stops.
    expect(segments[3]).toMatchObject({ kind: 'outro' })
    expect(cues.map((cue) => cue.key)).toEqual(['intro', 'body', 'lesson-outro', 'signoff'])
    expect(cues[1].at).toBeCloseTo(5.2)
    expect(cues[2].at).toBeCloseTo(11.9)
    expect(cues[3].at).toBeCloseTo(11.9 + 2 + 0.45)
    expect(total).toBeCloseTo(14.35 + 2.1 + 1.6)
  })

  it('puts Paper Coach in Lina’s place as she starts her last words, and captions her closing line until then', () => {
    const { segments, captions } = plan()
    const ending = endingOf(segments)
    expect(ending.swapAt).toBeCloseTo(14.35 - 0.15)
    const closing = captions.filter((caption) => caption.from >= ending.start)
    expect(closing.map((caption) => caption.text).join(' ')).toBe('That’s a fish, all yours.')
    expect(closing[0].from).toBeCloseTo(ending.start)
    for (const caption of closing) expect(caption.to).toBeLessThanOrEqual(ending.swapAt)
  })

  it('without last words, puts Paper Coach in her place once she has finished, for long enough to read', () => {
    const { segments, cues, total } = plan({ signoff: null })
    expect(cues.map((cue) => cue.key)).toEqual(['intro', 'body', 'lesson-outro'])
    expect(endingOf(segments).swapAt).toBeCloseTo(13.9 + 0.5)
    expect(total).toBeCloseTo(14.4 + 2.6)
  })

  it('lands the stickers one after another as the ending begins, at most four', () => {
    expect(endingOf(plan().segments).stickersAt).toEqual([12.2, 12.52, 12.84].map((at) => expect.closeTo(at, 5)))
    expect(endingOf(plan({ stickers: 9 }).segments).stickersAt).toHaveLength(4)
    expect(endingOf(plan({ stickers: 0 }).segments).stickersAt).toEqual([])
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

  it('picks stills inside the video, the closing one after the stickers land and before Paper Coach comes in', () => {
    const p = plan()
    const moments = stillMoments(p, tutorial)
    expect(moments.map((moment) => moment.name)).toEqual(['opening', 'opening-drawing', 'line', 'colour', 'closing', 'ending'])
    for (const moment of moments) expect(moment.at).toBeLessThan(p.total)
    const closing = moments.find((moment) => moment.name === 'closing')!.at
    const ending = endingOf(p.segments)
    expect(closing).toBeGreaterThan(ending.stickersAt[2] + 0.42)
    expect(closing).toBeLessThan(ending.swapAt)
  })
})

describe('defaultSignoff', () => {
  it('names the app and where it is, and says only the download is free when Premium unlocks the lesson', () => {
    expect(defaultSignoff(true)).toBe('Draw more with Paper Coach. It’s free on the App Store.')
    expect(defaultSignoff(false)).toBe('Draw more with Paper Coach. It’s free to download on the App Store.')
  })
})

describe('stickerLessons', () => {
  const paths = [{ lessonIds: ['a', 'b', 'c', 'd', 'e', 'f'] }, { lessonIds: ['x', 'y'] }, { lessonIds: ['g', 'h'] }]
  const all = () => true

  it('takes the lessons after it in its path, wrapping round to the start', () => {
    expect(stickerLessons(paths, 'c', all)).toEqual(['d', 'e', 'f', 'a'])
    expect(stickerLessons(paths, 'f', all)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('fills up with the first lessons of the other paths, never itself', () => {
    expect(stickerLessons(paths, 'x', all)).toEqual(['y', 'a', 'g'])
    expect(stickerLessons(paths, 'zebra', all)).toEqual(['a', 'x', 'g'])
  })

  it('leaves out lessons with no illustration to stick', () => {
    expect(stickerLessons(paths, 'c', (id) => id !== 'd' && id !== 'f')).toEqual(['e', 'a', 'b', 'x'])
  })
})

describe('captionsFor', () => {
  // "Let’s draw a pine tree. Grab a pencil and draw along with me." as Whisper heard Lina say it.
  const words = [
    ['Let’s', 0, 0.66], ['draw', 0.66, 0.8], ['a', 0.8, 0.96], ['pine', 0.96, 1.18], ['tree.', 1.18, 1.52],
    ['Grab', 2.1, 2.26], ['a', 2.26, 2.36], ['pencil', 2.36, 2.66], ['and', 2.66, 3.08], ['draw', 3.08, 3.26],
    ['along', 3.26, 3.56], ['with', 3.56, 3.78], ['me.', 3.78, 3.96],
  ].map(([text, start, end]) => ({ text: text as string, start: start as number, end: end as number }))
  const clip = { text: 'Let’s draw a pine tree. Grab a pencil and draw along with me.', durationS: 4.16, words }

  it('shows a few words at a time on one line, never leaving “a” at the end of one', () => {
    expect(captionsFor(clip, 0.35, 0, 5).map((caption) => caption.text)).toEqual([
      'Let’s draw',
      'a pine tree.',
      'Grab a pencil',
      'and draw',
      'along with me.',
    ])
  })

  it('shows each line from its first word until the next, and the last a moment after she stops', () => {
    const captions = captionsFor(clip, 0.35, 0, 5)
    expect(captions[0].from).toBe(0)
    expect(captions[1].from).toBeCloseTo(0.35 + 0.8)
    expect(captions[0].to).toBe(captions[1].from)
    // Through the breath after "tree." until "Grab".
    expect(captions[1].to).toBeCloseTo(0.35 + 2.1)
    expect(captions[4].to).toBe(5)
    expect(captionsFor(clip, 0.35, 0, 8)[4].to).toBeCloseTo(0.35 + 3.96 + 1.2)
  })

  it('lights each word from when she starts it until the next one starts', () => {
    const [first] = captionsFor(clip, 0.35, 0, 5)
    expect(first.words.map((word) => word.text)).toEqual(['Let’s', 'draw'])
    expect(first.words[0].from).toBeCloseTo(0.35)
    expect(first.words[0].to).toBeCloseTo(0.35 + 0.66)
    expect(first.words[1].to).toBe(first.to)
    const last = captionsFor(clip, 0.35, 0, 5)[4]
    expect(last.words[2].to).toBeCloseTo(0.35 + 3.96 + 0.25)
  })

  it('estimates the timing from the words’ lengths when nobody has listened', () => {
    const captions = captionsFor({ text: clip.text, durationS: 4 }, 1, 0.5, 9)
    expect(captions[0].from).toBe(0.5)
    expect(captions[0].words[0].from).toBe(1)
    expect(captions.map((caption) => caption.text)).toContain('a pine tree.')
    for (let i = 1; i < captions.length; i += 1) expect(captions[i].from).toBeGreaterThan(captions[i - 1].from)
    expect(captions[captions.length - 1].to).toBeLessThanOrEqual(9)
  })
})

describe('lineChunks', () => {
  const lines = (text: string) =>
    lineChunks(text.split(' ').map((word, index) => ({ text: word, start: index * 0.3, end: index * 0.3 + 0.25 }))).map((chunk) =>
      chunk.map((word) => word.text).join(' '),
    )

  it('cuts lines at commas and sentences, near twelve characters, with nothing left hanging', () => {
    expect(lines('Two pines on the left hill, trunk and spiky top, then a small one with no trunk.')).toEqual([
      'Two pines on',
      'the left hill,',
      'trunk and',
      'spiky top,',
      'then a small one',
      'with no trunk.',
    ])
    expect(lines('Now the rind. Draw a curve across the slice, a little above the bottom.')).toEqual([
      'Now the rind.',
      'Draw a curve',
      'across the slice,',
      'a little above',
      'the bottom.',
    ])
    for (const line of lines('A pineapple wears a spiky crown of leaves, and its skin is covered in diamonds.')) {
      expect(line.length).toBeLessThanOrEqual(18)
      expect(line).not.toMatch(/ (a|an|the|its)$/)
    }
  })

  it('starts a new line at a pause', () => {
    const words = [
      { text: 'Start', start: 0, end: 0.3 },
      { text: 'here', start: 0.3, end: 0.6 },
      { text: 'then', start: 1.2, end: 1.4 },
      { text: 'curve', start: 1.4, end: 1.7 },
    ]
    expect(lineChunks(words).map((chunk) => chunk.length)).toEqual([2, 2])
  })

  it('keeps a long word alone on its line', () => {
    expect(lines('Extraordinarily')).toEqual(['Extraordinarily'])
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
