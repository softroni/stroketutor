import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { THEME_KEY } from './theme'

describe('theme', () => {
  it('is read before the first paint under the key the toggle saves', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
    expect(html).toContain(`localStorage.getItem('${THEME_KEY}')`)
  })
})
