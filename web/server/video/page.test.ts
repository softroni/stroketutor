import { describe, expect, it } from 'vitest'

import type { Tutorial } from '../../src/schema/types'

import { backdropStops, videoPage } from './page'
import type { VideoPlan } from './plan'

const tutorial = { title: 'Sun', canvas: { width: 100, height: 100 }, steps: [] } as unknown as Tutorial
const plan = { text: { introChip: '', introTitle: '', outroTitle: '', cta: 'Free' } } as unknown as VideoPlan
const assets = { font: '', icon: '', badge: null }

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
})
