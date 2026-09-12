import { describe, expect, it } from 'vitest'

import type { Tutorial } from '../schema/types'

import { lessonSheetSvg, parseIdList, pathBox, pathStart, sheetGrid, traceSvg, type PreviewTrace } from './preview'

const trace: PreviewTrace = {
  canvas: { width: 1000, height: 1000 },
  strokes: [
    { id: 's1', d: 'M 100 100 L 300 100', lineWidth: 6 },
    { id: 's2', d: 'M 300 100 C 300 200 300 250 300 300', lineWidth: 6, color: '#1F3A5F' },
  ],
  fills: [{ id: 'f1', d: 'M 100 100 L 300 100 L 300 300 L 100 300 Z', color: '#E8C872', box: [100, 100, 300, 300] }],
}

const house: Tutorial = {
  schemaVersion: 2,
  id: 'house',
  title: 'House',
  canvas: { width: 1000, height: 800 },
  steps: [
    { id: 'walls', title: 'Draw the walls', instruction: 'A square.', strokes: [{ d: 'M 250 480 L 750 480 L 750 850 L 250 850 Z', duration: 2, lineWidth: 16 }] },
    { id: 'roof', title: 'Add the roof <fast> & "sure"', instruction: 'A triangle.', strokes: [{ d: 'M 200 480 L 500 260 L 800 480 Z', duration: 2, lineWidth: 16 }] },
    { id: 'door', title: 'Put in the door', instruction: 'A rectangle.', strokes: [{ d: 'M 440 850 L 440 690 L 560 690 L 560 850', duration: 1, lineWidth: 12 }] },
    { id: 'colour', title: 'Colour it in', instruction: 'Sand.', strokes: [], fills: [{ d: 'M 250 480 L 750 480 L 750 850 L 250 850 Z', color: '#E8C872', duration: 1, fillRule: 'evenodd' }] },
  ],
}

/** The nested `<svg …>…</svg>` panels of a sheet, in order. */
const panelsOf = (sheet: string) => [...sheet.matchAll(/<svg x="[^"]*"[^>]*>(.*?)<\/svg>/g)].map((match) => match[1])

describe('traceSvg', () => {
  it('draws the colours faintly first, then every line, then a label at each line’s first M', () => {
    const svg = traceSvg(trace)
    const fill = svg.indexOf('fill="#E8C872" fill-rule="evenodd" fill-opacity="0.35"')
    const line1 = svg.indexOf('d="M 100 100 L 300 100" fill="none" stroke="#2B2B2B" stroke-width="6"')
    const line2 = svg.indexOf('d="M 300 100 C 300 200 300 250 300 300" fill="none" stroke="#1F3A5F"')
    expect(fill).toBeGreaterThan(0)
    expect(line1).toBeGreaterThan(fill)
    expect(line2).toBeGreaterThan(line1)
    // s2 starts at (300, 100): a dot on the point and the label just off it, with a white halo.
    expect(svg).toContain('<circle cx="300" cy="100"')
    expect(svg).toMatch(/<text x="307\.78" y="124\.44"[^>]*stroke="#FFFFFF"[^>]*paint-order="stroke">s2<\/text>/)
    expect(svg).toMatch(/<text x="107\.78" y="92\.22"[^>]*>s1<\/text>/)
    // f1's label sits at the centre of its box.
    expect(svg).toMatch(/<text x="186\.67" y="207\.78"[^>]*>f1<\/text>/)
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"')).toBe(true)
  })

  it('leaves the labels off when asked, and takes a background', () => {
    const svg = traceSvg(trace, { labels: false, background: 'FFFFFF' })
    expect(svg).not.toContain('<text')
    expect(svg).not.toContain('<circle')
    expect(svg).toContain('<rect width="1000" height="1000" fill="#FFFFFF"/>')
  })

  it('labels only the ids asked for and fades the other lines', () => {
    const svg = traceSvg(trace, { only: ['s2'] })
    expect(svg).toContain('>s2</text>')
    expect(svg).not.toContain('>s1</text>')
    expect(svg).not.toContain('>f1</text>')
    expect(svg).toMatch(/d="M 100 100 L 300 100"[^>]*opacity="0.3"/)
    expect(svg).not.toMatch(/d="M 300 100 C[^>]*opacity="0.3"/)
  })

  it('crops to part of the canvas and scales the labels to what is shown', () => {
    const svg = traceSvg(trace, { crop: [200, 50, 400, 250] })
    expect(svg).toContain('viewBox="200 50 200 200" width="200" height="200"')
    // A 200-unit view: labels are a 45th of it (4.44), not of the 1000 canvas (22.22).
    expect(svg).toMatch(/<text [^>]*font-size="4\.44"[^>]*>s2<\/text>/)
    expect(svg).toContain('<rect width="1000" height="1000"')
  })

  it('escapes an id in a label', () => {
    const svg = traceSvg({ ...trace, strokes: [{ id: 'a<b', d: 'M 1 1 L 2 2', lineWidth: 1 }], fills: [] })
    expect(svg).toContain('>a&lt;b</text>')
  })
})

describe('lessonSheetSvg', () => {
  it('has one panel per step and a finished panel, in a grid of the columns asked for', () => {
    expect(sheetGrid(house)).toEqual({ panels: 5, columns: 3, rows: 2 })
    expect(sheetGrid(house, 2)).toEqual({ panels: 5, columns: 2, rows: 3 })
    const sheet = lessonSheetSvg(house)
    expect(panelsOf(sheet)).toHaveLength(5)
    const width = Number(sheet.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)![1])
    expect(width).toBeLessThanOrEqual(2400)
    const xs = [...sheet.matchAll(/<svg x="([\d.]+)" y="([\d.]+)"/g)].map((match) => [Number(match[1]), Number(match[2])])
    expect(xs[0][0]).toBeLessThan(xs[1][0])
    expect(xs[1][0]).toBeLessThan(xs[2][0])
    expect(xs[3][0]).toBe(xs[0][0])
    expect(xs[3][1]).toBeGreaterThan(xs[0][1])
    // Each panel keeps the lesson's aspect ratio.
    const [, w, h] = sheet.match(/<svg x="[^"]*" y="[^"]*" width="([\d.]+)" height="([\d.]+)"/)!
    expect(Number(h) / Number(w)).toBeCloseTo(0.8, 2)
  })

  it('fades earlier steps in a middle panel, labels this one and leaves later ones out', () => {
    const [walls, roof, door, colour, finished] = panelsOf(lessonSheetSvg(house))
    expect(roof).toContain('d="M 250 480 L 750 480 L 750 850 L 250 850 Z" fill="none" stroke="#2B2B2B" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"')
    expect(roof).toMatch(/d="M 200 480 L 500 260 L 800 480 Z" fill="none"[^>]*stroke-linejoin="round"\/>/)
    expect(roof).not.toContain('M 440 850')
    expect(roof).not.toContain('#E8C872')
    expect(roof).toContain('>s2</text>')
    expect(roof).not.toContain('>s1</text>')
    expect(walls).toContain('>s1</text>')
    expect(walls).not.toContain('opacity="0.3"')
    expect(door).toContain('>s3</text>')
    expect(colour).toContain('fill="#E8C872" fill-rule="evenodd"')
    expect(colour).toContain('>f1</text>')
    expect(finished).toContain('#E8C872')
    expect(finished).toContain('M 440 850')
    expect(finished).not.toContain('<text')
    expect(finished).not.toContain('opacity="0.3"')
  })

  it('captions each panel with its number and title, escaped, and the last one Finished', () => {
    const sheet = lessonSheetSvg(house)
    expect(sheet).toContain('>1 · Draw the walls</text>')
    expect(sheet).toContain('>2 · Add the roof &lt;fast&gt; &amp; &quot;sure&quot;</text>')
    expect(sheet).toContain('>Finished</text>')
    expect(lessonSheetSvg(house, { labels: false })).not.toContain('>s1</text>')
  })
})

describe('parseIdList', () => {
  it('expands ranges, keeps order and drops repeats', () => {
    expect(parseIdList('s30,s32-s35,f1, s30')).toEqual(['s30', 's32', 's33', 's34', 's35', 'f1'])
    expect(parseIdList('s3-s1')).toEqual(['s3-s1'])
    expect(parseIdList('trunk,s2-4')).toEqual(['trunk', 's2', 's3', 's4'])
  })
})

describe('path helpers', () => {
  it('find a path’s start and box, and give up quietly on a malformed one', () => {
    expect(pathStart('M 10 20 L 30 40')).toEqual({ x: 10, y: 20 })
    expect(pathBox('M 10 20 Q 50 0 30 40')).toEqual([10, 0, 50, 40])
    expect(pathStart('L 1 1')).toBeNull()
    expect(pathBox('nope')).toBeNull()
  })
})
