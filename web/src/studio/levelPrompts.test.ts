import { describe, expect, it } from 'vitest'

import palette from '../../../docs/curriculum/palette.json'

import { LEVEL_PROMPTS, levelPrompt } from './levelPrompts'

describe('levelPrompts', () => {
  const prompts = Object.entries(LEVEL_PROMPTS)

  it('has one prompt per level of the curriculum, each with its own version', () => {
    expect(Object.keys(LEVEL_PROMPTS)).toEqual(['starter', 'core', 'advanced'])
    expect(new Set(prompts.map(([, prompt]) => prompt.version)).size).toBe(3)
  })

  it('names who each level is for', () => {
    expect(LEVEL_PROMPTS.starter.prompt).toContain('children under ten')
    expect(LEVEL_PROMPTS.core.prompt).toContain('aged ten to fifteen')
    expect(LEVEL_PROMPTS.advanced.prompt).toContain('sixteen or older')
  })

  it('keeps the look of the course at every level', () => {
    for (const [, { prompt }] of prompts) {
      for (const hex of palette) expect(prompt).toContain(hex)
      expect(prompt).toContain('about 1% of the image width')
      expect(prompt).toContain('Pure white (#ffffff) background')
      expect(prompt).toContain('No people, animals or insects.')
      expect(prompt).toContain('a dark area (an opening, a hole, a lens) is purple')
    }
  })

  it('opens up overlap, form and light only above Starter, and perspective and letters only at Advanced', () => {
    expect(LEVEL_PROMPTS.starter.prompt).not.toMatch(/^(FORM|LIGHT|VIEW AND DEPTH|TEXTURE)$/m)
    expect(LEVEL_PROMPTS.core.prompt).toMatch(/^FORM$/m)
    expect(LEVEL_PROMPTS.core.prompt).toMatch(/^LIGHT$/m)
    expect(LEVEL_PROMPTS.advanced.prompt).toMatch(/^VIEW AND DEPTH$/m)
    expect(LEVEL_PROMPTS.advanced.prompt).toMatch(/^TEXTURE$/m)
    expect(LEVEL_PROMPTS.advanced.prompt).toContain('unless the description asks\n  for letters')
    expect(LEVEL_PROMPTS.core.prompt).not.toContain('asks\n  for letters')
  })

  it('reads as it is pasted: no line wider than the textarea shows at a glance', () => {
    for (const [, { prompt }] of prompts) {
      for (const row of prompt.split('\n')) expect(row.length).toBeLessThanOrEqual(100)
    }
  })

  it('finds a level by id, and none for a level it does not know', () => {
    expect(levelPrompt('core')?.version).toBe('style-v3-core')
    expect(levelPrompt('bonus')).toBeNull()
    expect(levelPrompt('constructor')).toBeNull()
    expect(levelPrompt(null)).toBeNull()
  })
})
