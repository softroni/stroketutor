import { describe, expect, it } from 'vitest'

import type { Take, Voice } from '../../voice/types'

import { indexTakes, takeHash, takeKeySource, takeSlot, takesOfVoice } from './takeKey'

const voice: Voice = {
  id: 'lina-bright',
  name: 'Lina, bright',
  tagline: 'Warm and genuinely excited to teach you',
  engine: 'qwen-design',
  instruct: 'A warm, bright woman around thirty.',
  speaker: null,
  frozen: null,
  suggested: true,
  createdAt: '2026-09-13T09:00:00.000Z',
  updatedAt: '2026-09-13T09:00:00.000Z',
}

const take = (id: string, voiceId: string, textHash: string, createdAt: string): Take => ({
  id,
  voiceId,
  text: 'Hi, I am Lina.',
  textHash,
  durationMs: 7040,
  createdAt,
})

describe('takeKeySource', () => {
  it('is the settings and the words, in the order the server writes them', () => {
    expect(takeKeySource(voice, 'Hello')).toBe(
      '{"engine":"qwen-design","instruct":"A warm, bright woman around thirty.","speaker":null,"frozen":null,"text":"Hello"}',
    )
  })

  it('changes when the description, the speaker or the reference changes', () => {
    const source = takeKeySource(voice, 'Hello')
    expect(takeKeySource({ ...voice, instruct: 'Someone else' }, 'Hello')).not.toBe(source)
    expect(takeKeySource({ ...voice, speaker: 'Vivian' }, 'Hello')).not.toBe(source)
    expect(
      takeKeySource(
        {
          ...voice,
          frozen: {
            referenceName: 'lina-bright-a1b2c3',
            referenceText: 'Hello',
            takeId: 't1',
            frozenAt: '2026-09-13T10:00:00.000Z',
          },
        },
        'Hello',
      ),
    ).not.toBe(source)
  })
})

describe('takeHash', () => {
  it('is a stable sha256 hex digest', async () => {
    const hash = await takeHash(voice, 'Hello')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(await takeHash(voice, 'Hello')).toBe(hash)
    expect(await takeHash(voice, 'Hello there')).not.toBe(hash)
  })
})

describe('indexTakes', () => {
  it('keeps the newest take for each voice and hash', () => {
    const newest = take('t3', 'lina-bright', 'aaa', '2026-09-13T12:00:00.000Z')
    const older = take('t1', 'lina-bright', 'aaa', '2026-09-13T09:00:00.000Z')
    const other = take('t2', 'lina-spark', 'aaa', '2026-09-13T11:00:00.000Z')
    const index = indexTakes([newest, other, older])
    expect(index.get(takeSlot('lina-bright', 'aaa'))).toBe(newest)
    expect(index.get(takeSlot('lina-spark', 'aaa'))).toBe(other)
    expect(index.size).toBe(2)
  })
})

describe('takesOfVoice', () => {
  it('keeps only one voice, in the order it was given', () => {
    const mine = [take('t1', 'lina-bright', 'aaa', 'x'), take('t2', 'lina-bright', 'bbb', 'y')]
    expect(takesOfVoice([mine[0], take('t9', 'other', 'ccc', 'z'), mine[1]], 'lina-bright')).toEqual(mine)
  })
})
