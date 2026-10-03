import { afterEach, describe, expect, it } from 'vitest'

import type { LearnerEvent } from '../src/studio/learners'
import { askSuperwall, forgetSubscriptions, matchSubscriptions, readSubscriptions, utc, type SuperwallRow } from './subscriptions'

afterEach(() => forgetSubscriptions())

const row = (fields: Partial<SuperwallRow> & Pick<SuperwallRow, 'ts' | 'name'>): SuperwallRow => ({
  productId: 'com.softroni.papercoach.premium.yearly',
  periodType: 'TRIAL',
  variantId: 643130,
  originalTransactionId: '590002859181736',
  purchasedAt: '2026-10-03 10:57:35.000000',
  transactionCompleteEventDate: '2026-10-03 10:57:41.663000',
  expirationAt: '2026-10-10 10:57:35.000000',
  isFamilyShare: 0,
  isRefund: 0,
  isTrialConversion: 0,
  ...fields,
})

/** Oct 3, 2026, as Superwall had it: a 13–15 learner's free week, cancelled three hours in, and a family member's copy. */
const rows: SuperwallRow[] = [
  row({ ts: '2026-10-03 10:57:38.000000', name: 'initial_purchase' }),
  row({ ts: '2026-10-03 10:57:41.663000', name: 'transaction_complete', periodType: null, expirationAt: null }),
  row({ ts: '2026-10-03 11:35:31.000000', name: 'initial_purchase', originalTransactionId: '505937284682644257', isFamilyShare: 1, variantId: null, transactionCompleteEventDate: null }),
  row({ ts: '2026-10-03 14:02:00.000000', name: 'cancellation' }),
  row({ ts: '2026-10-03 14:31:16.000000', name: 'cancellation', originalTransactionId: '505937284682644257', isFamilyShare: 1, variantId: null, transactionCompleteEventDate: null }),
]

/** What the app sent PostHog: the same purchase, under the learner's id, and someone else's an hour later. */
const purchases: LearnerEvent[] = [
  { at: Date.parse('2026-10-03T10:57:41.900Z'), event: 'superwall_transaction_complete', id: 'e574-learner', variant: '643130', placement: 'settings_premium' },
  { at: Date.parse('2026-10-03T10:57:43.000Z'), event: 'purchase_attempted', id: 'e574-learner', plan: 'yearly', outcome: 'purchased' },
  { at: Date.parse('2026-10-03T11:57:00.000Z'), event: 'purchase_attempted', id: 'someone-else', plan: 'weekly', outcome: 'purchased' },
]

describe('subscriptions from Superwall', () => {
  it('reads ClickHouse’s times as UTC', () => {
    expect(utc('2026-10-03 10:57:41.663000')).toBe(Date.parse('2026-10-03T10:57:41.663Z'))
    expect(utc(null)).toBeNull()
  })

  it('ties a free week to the learner who bought it, with its cancellation, and leaves the family member’s copy out', () => {
    expect(matchSubscriptions(rows, purchases)).toEqual({
      unmatched: 0,
      subscriptions: [
        {
          id: '590002859181736',
          learner: 'e574-learner',
          boughtAt: Date.parse('2026-10-03T10:57:35Z'),
          trial: true,
          plan: 'yearly',
          events: [
            { at: Date.parse('2026-10-03T14:02:00Z'), kind: 'renewalOff', name: 'cancellation', trial: true, until: Date.parse('2026-10-10T10:57:35Z') },
          ],
        },
      ],
    })
  })

  it('counts a purchase no learner’s event is near, or whose test version differs, as unmatched', () => {
    const far = purchases.map((event) => ({ ...event, at: event.at + 10 * 60_000 }))
    expect(matchSubscriptions(rows, far)).toEqual({ subscriptions: [], unmatched: 1 })
    const other = purchases.filter((event) => event.event === 'superwall_transaction_complete').map((event) => ({ ...event, variant: '1' }))
    expect(matchSubscriptions(rows, other).unmatched).toBe(1)
  })

  it('says what each later event means', () => {
    const later = [
      ...rows.slice(0, 2),
      row({ ts: '2026-10-04 09:00:00.000000', name: 'uncancellation' }),
      row({ ts: '2026-10-10 10:57:40.000000', name: 'renewal', periodType: 'NORMAL', isTrialConversion: 1 }),
      row({ ts: '2026-10-12 10:00:00.000000', name: 'cancellation', periodType: 'NORMAL', isRefund: 1 }),
    ]
    const [subscription] = matchSubscriptions(later, purchases).subscriptions
    expect(subscription.events.map((event) => event.kind)).toEqual(['renewalOn', 'paid', 'refunded'])
  })

  it('asks Superwall for Paper Coach’s real events only, and keeps the answer', async () => {
    const asked: string[][] = []
    const run = async (args: string[]) => {
      asked.push(args)
      return { data: rows }
    }
    expect(await askSuperwall(run)).toHaveLength(5)
    expect(asked[0][0]).toBe('query')
    expect(asked[0][1]).toContain('applicationId = 56531 AND isSandbox = 0')
    const first = await readSubscriptions({ run, purchases: async () => purchases }, 0)
    expect(first).toMatchObject({ source: 'superwall', problem: null, unmatched: 0 })
    expect(first.subscriptions).toHaveLength(1)
    await readSubscriptions({ run, purchases: async () => purchases }, 60_000)
    expect(asked).toHaveLength(2)
  })

  it('says so when Superwall fails, and keeps nothing for long', async () => {
    const response = await readSubscriptions({ run: async () => ({ error: 'signed out' }), purchases: async () => purchases }, 0)
    expect(response.subscriptions).toEqual([])
    expect(response.problem).toContain('signed out')
  })
})
