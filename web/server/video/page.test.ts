import { describe, expect, it } from 'vitest'

import type { Tutorial } from '../../src/schema/types'

import { backdropStops, FRAME, HOOK_BOX, SAFE, STICKER_BOUNDS, STICKER_SLOTS, stickerCandidates, videoPage, withinBounds } from './page'
import { MAX_STICKERS, type VideoPlan } from './plan'

const tutorial = { title: 'Sun', canvas: { width: 100, height: 100 }, steps: [] } as unknown as Tutorial
const plan = { text: { introChip: '', introTitle: '', hook: null, outroChip: '', outroTitle: '', cta: 'Free' } } as unknown as VideoPlan
const assets = { font: '', icon: '', badge: null, stickers: [] }

describe('backdropStops', () => {
  it('keeps the color in the middle, a touch lighter at the top and darker at the foot', () => {
    expect(backdropStops('#4F8A1F')).toEqual({ light: '#619635', mid: '#4F8A1F', deep: '#365E15' })
    expect(backdropStops('2f6be8').mid).toBe('#2F6BE8')
  })
})

describe('videoPage', () => {
  it('wears the path color, or the Paper Coach greens outside every path', () => {
    expect(videoPage(tutorial, plan, assets, '#2F6BE8')).toContain('--backdrop: #2F6BE8;')
    expect(videoPage(tutorial, plan, assets)).toContain('--backdrop-light: #26B571; --backdrop: #1FA463; --backdrop-deep: #127544;')
  })

  it('sticks one sticker per illustration, as many as there are places for', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>'
    const count = (html: string) => html.match(/class="sticker"/g)?.length ?? 0
    expect(count(videoPage(tutorial, plan, { ...assets, stickers: [svg, svg] }))).toBe(2)
    expect(count(videoPage(tutorial, plan, { ...assets, stickers: Array(9).fill(svg) }))).toBe(STICKER_SLOTS.length)
    expect(count(videoPage(tutorial, plan, assets))).toBe(0)
  })
})

describe('the hook’s title', () => {
  it('sits where the classic opening’s brand, place and title are: from the top of the safe area to above the progress bar and the card, clear of the crop', () => {
    expect(HOOK_BOX.top).toBeGreaterThanOrEqual(SAFE.top)
    expect(HOOK_BOX.bottom).toBeLessThan(540)
    expect(HOOK_BOX.left).toBeGreaterThanOrEqual(55 + 20)
    expect(FRAME.width - HOOK_BOX.right).toBeGreaterThanOrEqual(55 + 20)
    // Far above where the platforms' buttons start down the right.
    expect(HOOK_BOX.bottom).toBeLessThan(STICKER_BOUNDS.buttons.top)
  })

  it('is on the page only for the hook opening', () => {
    const hook = { text: { ...plan.text, hook: { title: 'How to draw a <em>sun</em>', steps: '4 easy steps' } } } as unknown as VideoPlan
    const html = videoPage(tutorial, hook, assets)
    expect(html).toContain('<b id="hook-title">How to draw a <em>sun</em></b><span>4 easy steps</span>')
    expect(videoPage(tutorial, plan, assets)).not.toContain('id="hook-title"')
  })
})

describe('stickers', () => {
  it('have a place for every sticker the plan lands, each on screen and off the words and the buttons', () => {
    expect(STICKER_SLOTS).toHaveLength(MAX_STICKERS)
    for (const slot of STICKER_SLOTS) expect(withinBounds(slot)).toBe(true)
  })

  it('keep a turned sticker off the crop, the title, the bottom row and the buttons', () => {
    const slot = { x: 150, y: 800, size: 160, turn: 0 }
    expect(withinBounds(slot)).toBe(true)
    expect(withinBounds({ ...slot, x: 60 })).toBe(false)
    expect(withinBounds({ ...slot, y: 600 })).toBe(false)
    expect(withinBounds({ ...slot, y: 1250 })).toBe(false)
    expect(withinBounds({ ...slot, x: 930, y: 1000 })).toBe(false)
    expect(withinBounds({ ...slot, x: 930 })).toBe(true)
    expect(STICKER_BOUNDS.bottom).toBe(SAFE.bottom - 132)
  })

  it('fall back from their slot to higher or lower, then smaller with the outer edge kept, always in bounds', () => {
    for (const slot of STICKER_SLOTS) {
      const candidates = stickerCandidates(slot)
      expect(candidates[0]).toEqual(slot)
      expect(candidates.length).toBeGreaterThan(4)
      for (const candidate of candidates) expect(withinBounds(candidate)).toBe(true)
      const outer = (s: typeof slot) => (s.x < FRAME.width / 2 ? s.x - s.size / 2 : s.x + s.size / 2)
      for (const candidate of candidates) expect(outer(candidate)).toBeCloseTo(outer(slot), 0)
      expect(Math.min(...candidates.map((candidate) => candidate.size))).toBeLessThan(slot.size)
    }
  })
})
