import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { fakeConverter, startFakeTts, type FakeTts } from '../server/testing'
import { wavDurationMs } from '../server/tts'
import type { LessonNarration, Take, Voice, VoiceManifest, VoiceState } from '../src/voice/types'

import { openTestStudio, type TestStudio } from './testing'

let t: TestStudio
let tts: FakeTts

beforeEach(async () => {
  tts = await startFakeTts()
  t = await openTestStudio({ tts: { url: tts.url, mcpUrl: tts.mcpUrl, convert: fakeConverter().convert } })
})

afterEach(async () => {
  await t.close()
  await tts.close()
})

/** Narrates the whole house, which is what `voice publish` needs. */
const narrateHouse = () => t.studio('voice cast house-chatterbox').then(() => t.studio('voice narrate simple-house'))

describe('the voice commands', () => {
  it('lists the suggested voices, and says which is cast', async () => {
    const listed = await t.studio('voice list')
    expect(listed.code).toBe(0)
    expect(listed.stdout).toContain('lina-bright')
    expect(listed.stdout).toContain('House voice')

    const cast = await t.studio('voice cast lina-serena')
    expect(cast.code).toBe(0)
    expect(cast.stdout).toContain('Cast Lina, gentle as Lina.')

    const after = await t.json<{ castVoiceId: string; voices: Voice[] }>('voice list')
    expect(after.castVoiceId).toBe('lina-serena')
    expect(after.voices).toHaveLength(5)
  })

  it('reports the speech server', async () => {
    const status = await t.json<VoiceState>('voice status')
    expect(status.server.reachable).toBe(true)
    expect(status.server.warm).toEqual(['chatterbox-turbo'])

    await tts.close()
    const asleep = await t.json<VoiceState>('voice status')
    expect(asleep.server.reachable).toBe(false)
  })

  it('says a line, reuses it, and writes the WAV with --out', async () => {
    const file = path.join(t.root, 'hello.wav')
    const first = await t.json<Take & { file: string }>(['voice', 'say', 'house-chatterbox', 'Hello from the Studio.', '--out', file])
    expect(first.cached).toBe(false)
    expect(first.file).toBe(file)
    expect(wavDurationMs(new Uint8Array(await readFile(file)))).toBe(first.durationMs)

    const again = await t.json<Take>(['voice', 'say', 'house-chatterbox', 'Hello from the Studio.'])
    expect(again.cached).toBe(true)
    expect(again.id).toBe(first.id)
    expect(tts.speech).toHaveLength(1)

    const another = await t.json<Take>(['voice', 'say', 'house-chatterbox', 'Hello from the Studio.', '--another'])
    expect(another.id).not.toBe(first.id)
  })

  it('narrates every step that needs it, and says nothing is left the second time', async () => {
    const first = await narrateHouse()
    expect(first.code).toBe(0)
    expect(first.stdout).toContain('1 of 5')
    expect(first.stdout).toContain('Recorded 5 steps of Simple House.')

    const again = await t.json<{ recorded: unknown[] }>('voice narrate simple-house')
    expect(again.recorded).toEqual([])
    expect(tts.speech).toHaveLength(5)

    const remade = await t.json<{ recorded: unknown[] }>('voice narrate simple-house --remake')
    expect(remade.recorded).toHaveLength(5)
    expect(tts.speech).toHaveLength(10)
  })

  it('refuses to narrate with nobody cast', async () => {
    const outcome = await t.studio('voice narrate simple-house')
    expect(outcome.code).toBe(1)
    expect(outcome.stderr).toContain('No voice is cast')
  })

  it('writes a spoken line for a step and puts the instruction back', async () => {
    await narrateHouse()
    const written = await t.json<LessonNarration>(['voice', 'lines', 'set', 'simple-house', 'door', 'Now the door.'])
    const door = written.steps.find((step) => step.stepId === 'door')!
    expect(door.spokenLine).toBe('Now the door.')
    expect(door.stale).toBe('text-changed')

    const cleared = await t.json<LessonNarration>('voice lines clear simple-house door')
    expect(cleared.steps.find((step) => step.stepId === 'door')!.spokenLine).toBe(null)
    expect(cleared.steps.find((step) => step.stepId === 'door')!.stale).toBe(null)
  })

  it('publishes the narration into shared/, and prints the git add line', async () => {
    const refused = await t.studio('voice publish simple-house')
    expect(refused.code).toBe(1)
    expect(refused.stderr).toContain('no recording')

    await narrateHouse()
    const published = await t.studio('voice publish simple-house')
    expect(published.code).toBe(0)
    expect(published.stdout).toContain('6 files')
    expect(published.stdout).toContain('git add -- shared/Assets/Voice/simple-house/chimney.m4a')

    const manifest = JSON.parse(
      await readFile(path.join(t.shared, 'Assets', 'Voice', 'simple-house', 'manifest.json'), 'utf8'),
    ) as VoiceManifest
    expect(Object.keys(manifest.steps)).toHaveLength(5)
    expect(manifest.voiceId).toBe('house-chatterbox')

    const removed = await t.studio('voice unpublish simple-house --yes')
    expect(removed.code).toBe(0)
    expect(existsSync(path.join(t.shared, 'Assets', 'Voice', 'simple-house'))).toBe(false)
  })

  it('adds a voice, and refuses one the speech server could not use', async () => {
    const added = await t.json<Voice>([
      'voice',
      'add',
      '--name',
      'Lina, test',
      '--engine',
      'qwen-custom',
      '--speaker',
      'Serena',
      '--instruct',
      'Calm and clear.',
    ])
    expect(added.id).toBe('lina-test')
    expect(added.speaker).toBe('Serena')

    const refused = await t.studio(['voice', 'add', '--name', 'Nope', '--engine', 'qwen-custom', '--speaker', 'Gandalf'])
    expect(refused.code).toBe(1)
    expect(refused.stderr).toContain('Vivian')
  })

  it('prints the audition script and changes one line', async () => {
    const script = await t.studio('voice script')
    expect(script.stdout).toContain('hello')
    expect(script.stdout).toContain("Hi, I'm Lina.")

    const changed = await t.json<{ script: { id: string; text: string }[] }>(['voice', 'script', 'set', 'wobble', 'A wobble is fine.'])
    expect(changed.script.find((line) => line.id === 'wobble')!.text).toBe('A wobble is fine.')
    expect(changed.script).toHaveLength(4)
  })

  it('describes itself in the overview and with --help', async () => {
    const overview = await t.studio('')
    expect(overview.stdout).toContain('voice narrate')
    const help = await t.studio('voice say --help')
    expect(help.stdout).toContain('--another')
  })
})
