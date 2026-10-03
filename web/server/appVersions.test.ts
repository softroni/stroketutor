import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { askAppStoreConnect, forgetAppVersions, readAppVersions } from './appVersions'
import { forgetLearners, readLearners } from './learners'

const versionsFile = fileURLToPath(new URL('./fixtures/app-versions.json', import.meta.url))
const now = Date.parse('2026-10-02T23:30:00Z')

afterEach(() => {
  forgetAppVersions()
  forgetLearners()
})

/** What `superwall asc get /v1/apps/…/appStoreVersions --json` answers. */
async function fakeConnect() {
  return {
    data: [
      {
        type: 'appStoreVersions',
        id: 'b',
        attributes: { versionString: '1.1', appStoreState: 'READY_FOR_SALE', appVersionState: 'READY_FOR_DISTRIBUTION' },
        relationships: { appStoreVersionPhasedRelease: { data: { type: 'appStoreVersionPhasedReleases', id: 'b' } } },
      },
      {
        type: 'appStoreVersions',
        id: 'a',
        attributes: { versionString: '1.0', appStoreState: 'REPLACED_WITH_NEW_VERSION', appVersionState: 'REPLACED_WITH_NEW_VERSION' },
        relationships: { appStoreVersionPhasedRelease: { data: null } },
      },
    ],
    included: [{ type: 'appStoreVersionPhasedReleases', id: 'b', attributes: { phasedReleaseState: 'ACTIVE', startDate: '2026-10-06' } }],
  }
}

describe('App Store Connect versions', () => {
  it('says which versions are or were on sale, and when a phased release began', async () => {
    expect(await askAppStoreConnect(fakeConnect)).toEqual([
      { version: '1.1', state: 'READY_FOR_SALE', released: true, since: '2026-10-06' },
      { version: '1.0', state: 'REPLACED_WITH_NEW_VERSION', released: true, since: null },
    ])
  })

  it('says what went wrong, and counts every version meanwhile', async () => {
    const failed = await readAppVersions({ run: async () => ({ error: { message: 'Not signed in' } }) }, now)
    expect(failed).toMatchObject({ versions: [], problem: expect.stringContaining('Not signed in') })
  })

  it('leaves the test builds’ events out of what the page reads, and says so', async () => {
    const fake = (async () =>
      new Response(
        JSON.stringify({
          results: [
            [1790949956518, 'app_opened', 'tester', null, null, null, null, null, null, null, null, null, null, null, null, null, null, '1.1'],
            [1790949975257, 'app_opened', 'learner', null, null, null, null, null, null, null, null, null, null, null, null, null, null, '1.0'],
          ],
        }),
        { status: 200 },
      )) as unknown as typeof fetch
    const response = await readLearners({ apiKey: 'phx_test', fetch: fake, versions: { sampleFile: versionsFile } }, '2026-10-02', '2026-10-03', now)
    expect(response.events.map((event) => event.id)).toEqual(['learner'])
    expect(response.leftOut).toEqual([{ version: '1.1', why: 'not on sale', state: 'WAITING_FOR_REVIEW', events: 1 }])
  })
})
