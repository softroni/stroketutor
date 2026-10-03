import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'

import type { AdNames, AdNamesResponse } from '../src/studio/learners'

/**
 * The names behind the Apple Ads ids the app sends (`asa_campaign_id`, `asa_ad_group_id`,
 * `asa_keyword_id`): Paper Coach's campaigns, their ad groups and their keywords, read
 * through Superwall's proxy to the Apple Ads API (`superwall asa … --app 54792`, the
 * connection that reaches Softroni's ads account, as `docs/ops/today.py` reads it). The
 * Studio needs the `superwall` CLI signed in on its machine; without it the page shows
 * the ids. Names change seldom, so an answer is kept half an hour (a failure, five
 * minutes). With STUDIO_LEARNERS_SAMPLE, the names come from a file beside the sample.
 */
export interface AdNamesOptions {
  /** A file of names to read instead (server/fixtures/apple-ads-names.json). */
  sampleFile?: string
  /** Runs `superwall` with these arguments and `--json`; for the tests. */
  run?: (args: string[]) => Promise<unknown>
}

/** The Superwall app whose Apple Ads connection reaches the Softroni LLC org. */
const ASA_VIA_APP = '54792'
/** Paper Coach's App Store id: only its campaigns are named. */
const ADAM_ID = '6816231257'
const KEEP_MS = 30 * 60_000
const KEEP_FAILURE_MS = 5 * 60_000

let kept: { at: number; keep: number; response: AdNamesResponse } | null = null
let asking: Promise<AdNamesResponse> | null = null

/** Forgets the kept names; for the tests. */
export function forgetAdNames() {
  kept = null
  asking = null
}

export async function readAdNames(options: AdNamesOptions, now: number = Date.now()): Promise<AdNamesResponse> {
  if (options.sampleFile) {
    try {
      const names = JSON.parse(await fs.readFile(options.sampleFile, 'utf8')) as AdNames
      return { names: { campaigns: names.campaigns, adGroups: names.adGroups, keywords: names.keywords }, source: 'sample', problem: null }
    } catch (error) {
      return { names: emptyNames(), source: 'sample', problem: `The sample's Apple Ads names did not read: ${message(error)}` }
    }
  }
  if (kept && now - kept.at < kept.keep) return kept.response
  asking ??= askApple(options.run ?? superwall)
    .then((names) => ({ names, source: 'apple-ads' as const, problem: null }))
    .catch((error: unknown) => ({
      names: kept?.response.names ?? emptyNames(),
      source: 'apple-ads' as const,
      problem: `Apple Ads' names did not come (superwall asa): ${message(error)}`,
    }))
    .then((response) => {
      kept = { at: now, keep: response.problem ? KEEP_FAILURE_MS : KEEP_MS, response }
      asking = null
      return response
    })
  return asking
}

/** Every campaign of Paper Coach's, every ad group in it, and every keyword in those. */
export async function askApple(run: (args: string[]) => Promise<unknown>): Promise<AdNames> {
  const names = emptyNames()
  const list = async (...args: string[]) => {
    const answer = (await run(['asa', ...args, '--app', ASA_VIA_APP, '-d', 'limit=1000'])) as { data?: unknown }
    return Array.isArray(answer?.data) ? (answer.data as Record<string, unknown>[]) : []
  }
  const campaigns = (await list('campaigns', 'list')).filter((campaign) => String(campaign.adamId) === ADAM_ID)
  await Promise.all(
    campaigns.map(async (campaign) => {
      const campaignId = String(campaign.id)
      names.campaigns[campaignId] = String(campaign.name)
      const groups = await list('adgroups', 'list', '--campaign', campaignId)
      await Promise.all(
        groups.map(async (group) => {
          const groupId = String(group.id)
          names.adGroups[groupId] = String(group.name)
          for (const keyword of await list('keywords', 'list', '--campaign', campaignId, '--adgroup', groupId)) {
            names.keywords[String(keyword.id)] = { text: String(keyword.text), match: String(keyword.matchType ?? '') }
          }
        }),
      )
    }),
  )
  return names
}

function emptyNames(): AdNames {
  return { campaigns: {}, adGroups: {}, keywords: {} }
}

function message(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 300)
}

/** Runs the `superwall` CLI with `--json` and answers its parsed output. */
export function superwall(args: string[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    execFile('superwall', [...args, '--json'], { timeout: 60_000, maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr.trim() || error.message))
      try {
        resolve(JSON.parse(stdout))
      } catch (caught) {
        reject(caught instanceof Error ? caught : new Error(String(caught)))
      }
    })
  })
}
