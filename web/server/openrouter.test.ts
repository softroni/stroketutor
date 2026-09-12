import { describe, expect, it } from 'vitest'

import { DEFAULT_TIMEOUT_MS, GenerationFailed, completeJSON } from './openrouter'

/** A stand-in for OpenRouter that never answers, and gives up only when the request is aborted. */
const silent = ((_url: string, init: RequestInit) =>
  new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')))
  })) as unknown as typeof globalThis.fetch

const request = { model: 'vendor/model', messages: [], schemaName: 'test', schema: {} }

describe('completeJSON', () => {
  it('stops a request that runs past its own timeout, and says how long it waited', async () => {
    const failure = await completeJSON({ ...request, timeoutMs: 20 }, { apiKey: 'test-key', fetch: silent }).catch(
      (error: unknown) => error,
    )
    expect(failure).toBeInstanceOf(GenerationFailed)
    expect(failure).toMatchObject({ status: 504 })
    expect((failure as Error).message).toContain('took longer than 0 seconds')
  })

  it('allows a photo generation three minutes by default', () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(180_000)
  })
})
