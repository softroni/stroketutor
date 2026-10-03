import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { forgetAdSpend, readAdSpend } from './adSpend'
import { forgetAdNames } from './appleAds'

const sampleFile = fileURLToPath(new URL('./fixtures/apple-ads-spend.json', import.meta.url))
const now = Date.parse('2026-10-02T23:30:00Z')

afterEach(() => {
  forgetAdSpend()
  forgetAdNames()
})

const day = (spend: string, taps: number, installs = 0, impressions = 10) => ({ localSpend: { amount: spend }, impressions, taps, totalInstalls: installs })

/** What `superwall asa … --json` answers: one Paper Coach campaign, one of another app's. */
function fakeApple(calls: string[][] = []) {
  return async (args: string[]) => {
    calls.push(args)
    const [, what, kind] = args
    if (what === 'campaigns') return { data: [{ id: 2144789293, name: 'PC - US - Category', adamId: 6816231257 }, { id: 7, name: 'GeoBlitz', adamId: 1 }] }
    if (what === 'adgroups') return { data: [{ id: 2151492291, name: 'Category' }] }
    if (what === 'keywords') return { data: [{ id: 2339019453, text: 'how to draw app', matchType: 'EXACT' }] }
    if (kind === 'campaigns') {
      return { data: { reportingDataResponse: { row: [{ metadata: { campaignId: 2144789293 }, total: day('4.34', 3, 1) }, { metadata: { campaignId: 7 }, total: day('9', 9) }] } } }
    }
    return {
      data: {
        reportingDataResponse: {
          row: [
            { metadata: { keywordId: 2339019453, adGroupId: 2151492291 }, total: day('2.44', 1, 1) },
            // Nothing at all: left out.
            { metadata: { keywordId: 2334871441, adGroupId: 2151492291 }, total: day('0', 0, 0, 0) },
          ],
        },
      },
    }
  }
}

describe('Apple Ads spend', () => {
  it('reads Paper Coach’s keywords, and what a campaign spent outside them, for the page’s days', async () => {
    const calls: string[][] = []
    const response = await readAdSpend({ run: fakeApple(calls) }, '2026-10-02', '2026-10-03', now)
    expect(response.problem).toBeNull()
    expect(response.rows).toEqual([
      { key: 'keyword-2339019453', campaign: '2144789293', adGroup: '2151492291', keyword: '2339019453', spend: 2.44, impressions: 10, taps: 1, installs: 1 },
      // 4.34 in all, 2.44 of it on keywords: Search Match spent the rest.
      { key: 'campaign-2144789293', campaign: '2144789293', adGroup: null, keyword: null, spend: 1.9, impressions: 0, taps: 0, installs: 0 },
    ])
    // The page's `to` is the day after; Apple's end day is the last one, in the account's time zone.
    expect(calls).toContainEqual(['asa', 'reports', 'keywords', '--campaign', '2144789293', '--app', '54792', '--start', '2026-10-02', '--end', '2026-10-02', '--granularity', 'DAILY', '--time-zone', 'ORTZ'])
    expect(calls.some((args) => args.includes('7') && args.includes('keywords'))).toBe(false)
  })

  it('keeps today’s report a quarter of an hour, and asks for nothing after today', async () => {
    const calls: string[][] = []
    await readAdSpend({ run: fakeApple(calls) }, '2026-09-28', '2026-10-05', now)
    const asked = calls.length
    await readAdSpend({ run: fakeApple(calls) }, '2026-09-28', '2026-10-05', now + 14 * 60_000)
    expect(calls.length).toBe(asked)
    expect(calls.find((args) => args[2] === 'campaigns')).toContain('2026-10-02')
    expect(await readAdSpend({}, 'today', '2026-10-03', now)).toMatchObject({ rows: [], problem: expect.stringContaining('range of days') })
  })

  it('sums the sample’s days', async () => {
    const both = await readAdSpend({ sampleFile }, '2026-10-01', '2026-10-03', now)
    const second = await readAdSpend({ sampleFile }, '2026-10-02', '2026-10-03', now)
    const sum = (rows: { spend: number }[]) => Math.round(rows.reduce((total, row) => total + row.spend, 0) * 100) / 100
    expect(sum(second.rows)).toBe(5.24)
    expect(sum(both.rows)).toBe(7.12)
    expect(second.rows.find((row) => row.key === 'keyword-2339019453')).toMatchObject({ installs: 1 })
  })
})
