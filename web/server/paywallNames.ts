import { promises as fs } from 'node:fs'

import type { PaywallNames, PaywallNamesResponse } from '../src/studio/learners'
import { superwall } from './appleAds'

/**
 * The names behind the paywall ids the app sends with Superwall's events (`paywall_id`,
 * `variant_id`, `placement`): each paywall's name ("Flow 1"), and each test version's
 * paywall, campaign and share of the traffic, read with the `superwall` CLI (project
 * 42098, app 56531, as the runbook's A/B tests are run). Kept half an hour (a failure,
 * five minutes); with STUDIO_LEARNERS_SAMPLE, from a file beside the sample.
 */
export interface PaywallNamesOptions {
  sampleFile?: string
  /** Runs `superwall` with these arguments and `--json`; for the tests. */
  run?: (args: string[]) => Promise<unknown>
}

const PROJECT = '42098'
const APP = '56531'
const KEEP_MS = 30 * 60_000
const KEEP_FAILURE_MS = 5 * 60_000

let kept: { at: number; keep: number; response: PaywallNamesResponse } | null = null
let asking: Promise<PaywallNamesResponse> | null = null

/** Forgets the kept names; for the tests. */
export function forgetPaywallNames() {
  kept = null
  asking = null
}

export async function readPaywallNames(options: PaywallNamesOptions, now: number = Date.now()): Promise<PaywallNamesResponse> {
  if (options.sampleFile) {
    try {
      const names = JSON.parse(await fs.readFile(options.sampleFile, 'utf8')) as PaywallNames
      return { names: { paywalls: names.paywalls, variants: names.variants, placements: names.placements }, source: 'sample', problem: null }
    } catch (error) {
      return { names: emptyNames(), source: 'sample', problem: `The sample's paywall names did not read: ${message(error)}` }
    }
  }
  if (kept && now - kept.at < kept.keep) return kept.response
  asking ??= askSuperwall(options.run ?? superwall)
    .then((names) => ({ names, source: 'superwall' as const, problem: null }))
    .catch((error: unknown) => ({
      names: kept?.response.names ?? emptyNames(),
      source: 'superwall' as const,
      problem: `Superwall's names did not come: ${message(error)}`,
    }))
    .then((response) => {
      kept = { at: now, keep: response.problem ? KEEP_FAILURE_MS : KEEP_MS, response }
      asking = null
      return response
    })
  return asking
}

/** Paper Coach's paywalls, and every version of its campaigns' tests. */
export async function askSuperwall(run: (args: string[]) => Promise<unknown>): Promise<PaywallNames> {
  const names = emptyNames()
  const list = async (...args: string[]) => {
    const answer = await run([...args, '--project', PROJECT])
    if (answer && typeof answer === 'object' && 'error' in answer) throw new Error(JSON.stringify((answer as { error: unknown }).error))
    const rows = Array.isArray(answer) ? answer : (answer as { data?: unknown })?.data
    return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : []
  }
  const [paywalls, campaigns] = await Promise.all([list('paywalls', 'list'), list('campaigns', 'list')])
  const byId = new Map<string, Record<string, unknown>>()
  for (const paywall of paywalls) {
    if (String(paywall.application_id) !== APP) continue
    byId.set(String(paywall.id), paywall)
    names.paywalls[String(paywall.identifier)] = String(paywall.name)
  }
  for (const campaign of campaigns) {
    // Superwall's own example campaign is not a test.
    if (String(campaign.application_id) !== APP || campaign.archived || campaign.description === 'Example Campaign') continue
    const campaignName = String(campaign.description ?? campaign.id)
    for (const placement of (campaign.placements as { event_name?: string }[] | undefined) ?? []) {
      if (placement.event_name) names.placements[placement.event_name] = campaignName
    }
    for (const audience of (campaign.audiences as { variants?: Record<string, unknown>[] }[] | undefined) ?? []) {
      for (const variant of audience.variants ?? []) {
        const paywall = variant.paywall ? byId.get(String(variant.paywall)) : undefined
        names.variants[String(variant.id)] = {
          paywall: paywall ? String(paywall.name) : variant.type === 'holdout' ? 'Holdout' : String(variant.paywall ?? ''),
          campaign: campaignName,
          share: Number(variant.percentage ?? 0),
        }
      }
    }
  }
  return names
}

function emptyNames(): PaywallNames {
  return { paywalls: {}, variants: {}, placements: {} }
}

function message(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 300)
}
