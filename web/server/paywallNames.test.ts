import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { askSuperwall, forgetPaywallNames, readPaywallNames } from './paywallNames'

const sampleFile = fileURLToPath(new URL('./fixtures/superwall-names.json', import.meta.url))

afterEach(() => forgetPaywallNames())

/** What `superwall … --project 42098 --json` answers. */
async function fakeSuperwall(args: string[]) {
  if (args[0] === 'paywalls') {
    return [
      { id: '271755', application_id: '56531', identifier: 'new-flow-7f9d-2026-09-26', name: 'Flow 1' },
      { id: '9', application_id: '111', identifier: 'other-app', name: 'Elsewhere' },
    ]
  }
  return [
    {
      id: 109312,
      application_id: 56531,
      description: 'Onboarding offer',
      placements: [{ event_name: 'onboarding_offer' }],
      audiences: [{ variants: [{ id: '643126', paywall: '271755', percentage: 33 }, { id: '643128', paywall: null, percentage: 0, type: 'holdout' }] }],
    },
    { id: 109295, application_id: 56531, description: 'Example Campaign', placements: [{ event_name: 'campaign_trigger' }], audiences: [] },
  ]
}

describe('Superwall names', () => {
  it('names Paper Coach’s paywalls, test versions and placements, and no other app’s', async () => {
    expect(await askSuperwall(fakeSuperwall)).toEqual({
      paywalls: { 'new-flow-7f9d-2026-09-26': 'Flow 1' },
      variants: {
        '643126': { paywall: 'Flow 1', campaign: 'Onboarding offer', share: 33 },
        '643128': { paywall: 'Holdout', campaign: 'Onboarding offer', share: 0 },
      },
      placements: { onboarding_offer: 'Onboarding offer' },
    })
  })

  it('says what went wrong, Superwall’s own errors included', async () => {
    const failed = await readPaywallNames({ run: async () => ({ error: { message: 'Multiple projects found.' } }) })
    expect(failed.problem).toContain('Multiple projects found')
  })

  it('reads the sample’s names from a file', async () => {
    const response = await readPaywallNames({ sampleFile })
    expect(response.names.variants['643126']).toEqual({ paywall: 'Flow 1', campaign: 'Onboarding offer', share: 33 })
  })
})
