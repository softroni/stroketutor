import { promises as fs } from 'node:fs'

import type { AfterPurchase, LearnerEvent, Subscription, SubscriptionsResponse } from '../src/studio/learners'
import { superwall } from './appleAds'
import { readPurchaseEvents, type LearnersOptions } from './learners'

/**
 * What became of each purchase after it was made, for the Learners page: a free week whose
 * renewal was turned off (or back on), a trial that turned paid, a renewal, a refund, the end.
 * Apple tells Superwall in its server notifications; Superwall keeps them in its ClickHouse
 * (`open_revenue.attributed_events_by_ts_rep`), read here with the `superwall` CLI, as
 * `docs/ops/today.py` reads them for the daily check.
 *
 * Superwall does not know PostHog's ids, so each purchase is tied to its learner by the
 * moment it was made: the app sends `superwall_transaction_complete` (and `purchase_attempted`)
 * to PostHog in the same second as Superwall's own `transaction_complete`, with the same test
 * version. A Family Sharing copy is another family member's, so it is left out. Kept five
 * minutes (a failure, one); with STUDIO_LEARNERS_SAMPLE, from a file beside the sample.
 */
export interface SubscriptionsOptions {
  learners?: LearnersOptions
  sampleFile?: string
  /** Runs `superwall` with these arguments and `--json`; for the tests. */
  run?: (args: string[]) => Promise<unknown>
  /** PostHog's purchase events; for the tests. */
  purchases?: () => Promise<LearnerEvent[]>
}

/** Paper Coach in Superwall. */
const APP = '56531'
const KEEP_MS = 5 * 60_000
const KEEP_FAILURE_MS = 60_000
/** How far back purchases are read: a yearly plan's whole first year. */
const DAYS = 400
/** The app's purchase event and Superwall's come within seconds; a few minutes still finds a slow sheet. */
export const MATCH_WINDOW_MS = 3 * 60_000
/** Superwall's events that are the purchase itself, which PostHog already shows. */
const PURCHASES = new Set(['initial_purchase', 'transaction_complete', 'non_renewing_purchase'])

let kept: { at: number; keep: number; response: SubscriptionsResponse } | null = null
let asking: Promise<SubscriptionsResponse> | null = null

/** Forgets the kept answer; for the tests. */
export function forgetSubscriptions() {
  kept = null
  asking = null
}

export async function readSubscriptions(options: SubscriptionsOptions, now: number = Date.now()): Promise<SubscriptionsResponse> {
  if (options.sampleFile) {
    try {
      const sample = JSON.parse(await fs.readFile(options.sampleFile, 'utf8')) as { subscriptions?: Subscription[] }
      return { subscriptions: sample.subscriptions ?? [], unmatched: 0, source: 'sample', problem: null }
    } catch {
      // No sample of them: the page shows the purchases without what came after.
      return { subscriptions: [], unmatched: 0, source: 'sample', problem: null }
    }
  }
  if (kept && now - kept.at < kept.keep) return kept.response
  const purchases = options.purchases ?? (() => readPurchaseEvents(options.learners ?? {}, DAYS))
  asking ??= Promise.all([askSuperwall(options.run ?? superwall), purchases()])
    .then(([rows, events]) => ({ ...matchSubscriptions(rows, events), source: 'superwall' as const, problem: null }))
    .catch((error: unknown) => ({
      subscriptions: kept?.response.subscriptions ?? [],
      unmatched: kept?.response.unmatched ?? 0,
      source: 'superwall' as const,
      problem: `Superwall’s subscription events did not come: ${error instanceof Error ? error.message : String(error)}`.slice(0, 400),
    }))
    .then((response) => {
      kept = { at: now, keep: response.problem ? KEEP_FAILURE_MS : KEEP_MS, response }
      asking = null
      return response
    })
  return asking
}

/** One of Superwall's rows, as the query below names its columns. */
export interface SuperwallRow {
  ts: string
  name: string
  productId: string | null
  periodType: string | null
  variantId: string | number | null
  originalTransactionId: string | null
  purchasedAt: string | null
  transactionCompleteEventDate: string | null
  expirationAt: string | null
  isFamilyShare: number | boolean | null
  isRefund: number | boolean | null
  isTrialConversion: number | boolean | null
}

export async function askSuperwall(run: (args: string[]) => Promise<unknown>): Promise<SuperwallRow[]> {
  const answer = await run([
    'query',
    'SELECT ts, name, productId, periodType, variantId, originalTransactionId, purchasedAt, transactionCompleteEventDate, ' +
      'expirationAt, isFamilyShare, isRefund, isTrialConversion FROM open_revenue.attributed_events_by_ts_rep FINAL ' +
      `WHERE applicationId = ${APP} AND isSandbox = 0 AND ts >= now() - INTERVAL ${DAYS} DAY AND ts < now() ORDER BY ts`,
  ])
  if (answer && typeof answer === 'object' && 'error' in answer) throw new Error(JSON.stringify((answer as { error: unknown }).error))
  const rows = Array.isArray(answer) ? answer : (answer as { data?: unknown })?.data
  return Array.isArray(rows) ? (rows as SuperwallRow[]) : []
}

/** ClickHouse's "2026-10-03 10:57:41.663000", which is UTC without saying so, in milliseconds. */
export function utc(value: string | null | undefined): number | null {
  if (!value) return null
  const at = Date.parse(`${value.trim().replace(' ', 'T')}Z`)
  return Number.isFinite(at) ? at : null
}

const truthy = (value: number | boolean | null | undefined) => value === true || value === 1 || (value as unknown) === '1'

/** "com.softroni.papercoach.premium.yearly" → "yearly". */
function planOf(productId: string | null): string | null {
  return productId ? productId.split('.').pop() ?? null : null
}

/** What one of Superwall's later events means for the learner. */
function kindOf(row: SuperwallRow): AfterPurchase['kind'] {
  if (truthy(row.isRefund) || row.name === 'refund') return 'refunded'
  switch (row.name) {
    case 'cancellation':
      return 'renewalOff'
    case 'uncancellation':
      return 'renewalOn'
    case 'renewal':
      return truthy(row.isTrialConversion) ? 'paid' : 'renewed'
    case 'expiration':
      return 'expired'
    case 'billing_issue':
      return 'billingIssue'
    default:
      return 'other'
  }
}

/**
 * Each purchase Superwall knows, with what came after it, tied to the learner whose own
 * purchase event in PostHog is closest in time (within `MATCH_WINDOW_MS`, the same test
 * version when both name one). `unmatched` counts purchases no learner's event matched.
 */
export function matchSubscriptions(rows: SuperwallRow[], purchases: LearnerEvent[]): { subscriptions: Subscription[]; unmatched: number } {
  const byTransaction = new Map<string, SuperwallRow[]>()
  for (const row of rows) {
    if (!row.originalTransactionId || truthy(row.isFamilyShare)) continue
    const list = byTransaction.get(row.originalTransactionId)
    if (list) list.push(row)
    else byTransaction.set(row.originalTransactionId, [row])
  }
  const candidates = purchases.filter(
    (event) =>
      event.event === 'superwall_transaction_complete' ||
      (event.event === 'purchase_attempted' && event.outcome === 'purchased' && event.plan !== 'restore'),
  )

  const subscriptions: Subscription[] = []
  let unmatched = 0
  for (const [id, list] of byTransaction) {
    const purchase = list.find((row) => row.name === 'transaction_complete') ?? list.find((row) => PURCHASES.has(row.name))
    // A purchase made before the rows reach back: what came after it has no learner to go to.
    if (!purchase) continue
    const first = list.find((row) => row.name === 'initial_purchase') ?? purchase
    const anchor = utc(purchase.transactionCompleteEventDate) ?? utc(purchase.purchasedAt) ?? utc(purchase.ts)
    if (anchor === null) continue
    const variant = purchase.variantId != null ? String(purchase.variantId) : null
    let best: LearnerEvent | null = null
    for (const event of candidates) {
      const gap = Math.abs(event.at - anchor)
      if (gap > MATCH_WINDOW_MS) continue
      if (variant && event.variant && event.variant !== variant) continue
      if (!best || gap < Math.abs(best.at - anchor)) best = event
    }
    if (!best) {
      unmatched += 1
      continue
    }
    subscriptions.push({
      id,
      learner: best.id,
      boughtAt: utc(first.purchasedAt) ?? anchor,
      trial: (first.periodType ?? '').toUpperCase() === 'TRIAL',
      plan: planOf(first.productId ?? purchase.productId),
      events: list
        .filter((row) => !PURCHASES.has(row.name))
        .flatMap((row) => {
          const at = utc(row.ts)
          return at === null
            ? []
            : [{ at, kind: kindOf(row), name: row.name, trial: (row.periodType ?? '').toUpperCase() === 'TRIAL', until: utc(row.expirationAt) }]
        })
        .sort((a, b) => a.at - b.at),
    })
  }
  return { subscriptions: subscriptions.sort((a, b) => a.boughtAt - b.boughtAt), unmatched }
}
