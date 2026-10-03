import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { askApple, forgetAdNames, readAdNames } from './appleAds'

const sampleFile = fileURLToPath(new URL('./fixtures/apple-ads-names.json', import.meta.url))

afterEach(() => forgetAdNames())

/** What `superwall asa … --json` answers, by the resource asked for. */
function fakeApple(calls: string[][] = []) {
  return async (args: string[]) => {
    calls.push(args)
    const [, resource] = args
    if (resource === 'campaigns') {
      return {
        data: [
          { id: 2144789293, name: 'PC - US - Category', adamId: 6816231257 },
          { id: 99, name: 'GeoBlitz - US', adamId: 1234 },
        ],
      }
    }
    if (resource === 'adgroups') return { data: [{ id: 2151492291, name: 'Category' }] }
    return { data: [{ id: 2339019453, text: 'how to draw app', matchType: 'EXACT' }] }
  }
}

describe('Apple Ads names', () => {
  it('names Paper Coach’s campaigns, ad groups and keywords, and no other app’s', async () => {
    const calls: string[][] = []
    const names = await askApple(fakeApple(calls))
    expect(names).toEqual({
      campaigns: { '2144789293': 'PC - US - Category' },
      adGroups: { '2151492291': 'Category' },
      keywords: { '2339019453': { text: 'how to draw app', match: 'EXACT' } },
    })
    expect(calls).toContainEqual(['asa', 'keywords', 'list', '--campaign', '2144789293', '--adgroup', '2151492291', '--app', '54792', '-d', 'limit=1000'])
    expect(calls.some((args) => args.includes('99'))).toBe(false)
  })

  it('asks once in half an hour, and says what went wrong when it cannot', async () => {
    let asked = 0
    const run = async (args: string[]) => {
      asked += 1
      return fakeApple()(args)
    }
    const now = Date.parse('2026-10-02T23:00:00Z')
    await readAdNames({ run }, now)
    await readAdNames({ run }, now + 29 * 60_000)
    expect(asked).toBe(3)
    forgetAdNames()
    const failed = await readAdNames({ run: async () => Promise.reject(new Error('not signed in')) }, now)
    expect(failed.problem).toContain('not signed in')
    expect(failed.names.keywords).toEqual({})
  })

  it('reads the sample’s names from a file', async () => {
    const response = await readAdNames({ sampleFile })
    expect(response.source).toBe('sample')
    expect(response.names.keywords['2339019453']).toEqual({ text: 'how to draw app', match: 'EXACT' })
  })
})
