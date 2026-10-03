import { promises as fs } from 'node:fs'

import type { AppVersion } from '../src/studio/learners'
import { superwall } from './appleAds'

/**
 * Paper Coach's versions as App Store Connect has them: which are or were on sale, and when
 * a phased release began, read through Superwall's App Store Connect proxy (`superwall asc
 * get`, no key to handle). The Learners page uses them to leave out what TestFlight and App
 * Review devices sent (`leaveOutTestVersions`). Kept an hour (a failure, five minutes); with
 * STUDIO_LEARNERS_SAMPLE, from a file beside the sample.
 */
export interface AppVersionsOptions {
  sampleFile?: string
  /** Runs `superwall` with these arguments and `--json`; for the tests. */
  run?: (args: string[]) => Promise<unknown>
}

export interface AppVersionsResponse {
  versions: AppVersion[]
  problem: string | null
}

const APP_ID = '6816231257'
const KEEP_MS = 60 * 60_000
const KEEP_FAILURE_MS = 5 * 60_000
/** On sale now, or once was (https://developer.apple.com/documentation/appstoreconnectapi/appversionstate). */
const RELEASED = new Set(['READY_FOR_SALE', 'READY_FOR_DISTRIBUTION', 'REPLACED_WITH_NEW_VERSION', 'DEVELOPER_REMOVED_FROM_SALE', 'REMOVED_FROM_SALE'])

let kept: { at: number; keep: number; response: AppVersionsResponse } | null = null

/** Forgets the kept versions; for the tests. */
export function forgetAppVersions() {
  kept = null
}

export async function readAppVersions(options: AppVersionsOptions, now: number = Date.now()): Promise<AppVersionsResponse> {
  if (options.sampleFile) {
    try {
      return { versions: (JSON.parse(await fs.readFile(options.sampleFile, 'utf8')) as { versions: AppVersion[] }).versions, problem: null }
    } catch (error) {
      return { versions: [], problem: `The sample's app versions did not read: ${error instanceof Error ? error.message : String(error)}` }
    }
  }
  if (kept && now - kept.at < kept.keep) return kept.response
  let response: AppVersionsResponse
  try {
    response = { versions: await askAppStoreConnect(options.run ?? superwall), problem: null }
  } catch (error) {
    response = {
      versions: kept?.response.versions ?? [],
      problem: `App Store Connect's versions did not come (superwall asc): ${(error instanceof Error ? error.message : String(error)).slice(0, 300)}`,
    }
  }
  kept = { at: now, keep: response.problem ? KEEP_FAILURE_MS : KEEP_MS, response }
  return response
}

type Resource = { id: string; type: string; attributes?: Record<string, unknown>; relationships?: Record<string, { data?: { id: string } | null }> }

export async function askAppStoreConnect(run: (args: string[]) => Promise<unknown>): Promise<AppVersion[]> {
  const answer = (await run([
    'asc',
    'get',
    `/v1/apps/${APP_ID}/appStoreVersions?fields[appStoreVersions]=versionString,appStoreState,appVersionState,appStoreVersionPhasedRelease&include=appStoreVersionPhasedRelease&limit=200`,
  ])) as { data?: Resource[]; included?: Resource[]; error?: unknown }
  if (!answer || !Array.isArray(answer.data)) throw new Error(JSON.stringify(answer?.error ?? answer).slice(0, 200))
  const phased = new Map((answer.included ?? []).filter((entry) => entry.type === 'appStoreVersionPhasedReleases').map((entry) => [entry.id, entry]))
  return answer.data.map((entry) => {
    const attributes = entry.attributes ?? {}
    const state = String(attributes.appStoreState ?? attributes.appVersionState ?? '')
    const release = entry.relationships?.appStoreVersionPhasedRelease?.data
    const start = release ? phased.get(release.id)?.attributes?.startDate : null
    return {
      version: String(attributes.versionString),
      state,
      released: RELEASED.has(state) || RELEASED.has(String(attributes.appVersionState ?? '')),
      since: typeof start === 'string' && start ? start.slice(0, 10) : null,
    }
  })
}
