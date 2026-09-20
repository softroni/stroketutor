import { describe, expect, it } from 'vitest'

import { imageToSvg } from './imageToSvg'

/** A red disc with a dark ring round it on white paper, its edges blurred as a generated PNG's are. */
function picture(size: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(size * size * 4)
  const mix = (a: number[], b: number[], t: number) => a.map((value, k) => value + (b[k] - value) * t)
  const step = (edge: number, r: number) => Math.min(1, Math.max(0, (r - edge) / 2 + 0.5))
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const r = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2)
      const inside = mix([219, 60, 55], [38, 44, 51], step(60, r))
      data.set([...mix(inside, [255, 255, 255], step(70, r)), 255], (y * size + x) * 4)
    }
  }
  return data
}

describe('a flat-colour picture as an SVG', () => {
  it('finds the colour and the outline, and nothing in the blur between them', () => {
    const result = imageToSvg(picture(200), 200, 200)
    expect(result.colours).toHaveLength(2)
    expect(result.svg.match(/<path /g)).toHaveLength(2)
    // The outline is written last, on top of the colour.
    expect(result.svg.lastIndexOf('#262C33')).toBeGreaterThan(result.svg.lastIndexOf('#DB3C37'))
    const [disc, ring] = result.colours
    expect(disc.area).toBeGreaterThan(Math.PI * 58 * 58)
    expect(disc.area).toBeLessThan(Math.PI * 62 * 62)
    expect(ring.area).toBeGreaterThan(Math.PI * (68 * 68 - 62 * 62))
  })

  it("snaps each colour to the course's palette, and says when one is far from it", () => {
    const snapped = imageToSvg(picture(200), 200, 200, { palette: [[216, 67, 59], [38, 41, 46]] })
    expect(snapped.colours.map((colour) => colour.color)).toEqual(['#D8433B', '#26292E'])
    expect(snapped.colours[0].from).toBe('#DB3C37')
    const far = imageToSvg(picture(200), 200, 200, { palette: [[38, 41, 46], [91, 143, 199]] })
    expect(far.colours[0].color).toBe('#DB3C37')
    expect(far.notes.join(' ')).toContain('#DB3C37')
  })

  it('refuses a blank picture', () => {
    expect(() => imageToSvg(new Uint8ClampedArray(40 * 40 * 4).fill(255), 40, 40)).toThrow(/no flat colour/)
  })
})
