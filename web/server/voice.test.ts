import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { validateCatalog } from '../src/catalog/validate'
import { validateTutorial } from '../src/schema/validate'
import type { Tutorial } from '../src/schema/types'
import type { VoiceManifest } from '../src/voice/types'

import { WriteRefused, createRepoWriter, type RepoWriter } from './repoWriter'
import { fakeConverter, startFakeTts, type FakeTts } from './testing'
import { silentWav, wavDurationMs } from './tts'
import {
  castVoice,
  createVoice,
  deleteVoice,
  freezeVoice,
  lessonNarration,
  narrateStep,
  publishVoice,
  say,
  setNarrationLine,
  textHash,
  unfreezeVoice,
  updateVoice,
  voiceState,
  type VoiceDeps,
} from './voice'
import { openWorkspace, type Workspace } from './workspaceStore'

const realShared = fileURLToPath(new URL('../../shared/', import.meta.url))

let root: string
let shared: string
let writer: RepoWriter
let workspace: Workspace
let tts: FakeTts
let converter: ReturnType<typeof fakeConverter>
let deps: VoiceDeps

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'stroketutor-voice-'))
  shared = path.join(root, 'shared')
  for (const folder of ['Tutorials', 'Catalog', 'Assets']) {
    await cp(path.join(realShared, folder), path.join(shared, folder), { recursive: true })
  }
  writer = createRepoWriter({ sharedDir: shared, validateTutorial, validateCatalog })
  workspace = await openWorkspace({ file: ':memory:', writer, validateTutorial, validateCatalog })
  tts = await startFakeTts()
  converter = fakeConverter()
  deps = { workspace, writer, tts: { url: tts.url, mcpUrl: tts.mcpUrl, convert: converter.convert } }
})

afterEach(async () => {
  workspace.close()
  await tts.close()
  await rm(root, { recursive: true, force: true })
})

async function refusal(action: () => Promise<unknown> | unknown): Promise<WriteRefused> {
  try {
    await action()
  } catch (error) {
    if (error instanceof WriteRefused) return error
    throw error
  }
  throw new Error('Expected a refusal.')
}

/** The house, narrated end to end in the house voice, ready to publish. */
async function narrateHouse(voiceId = 'house-chatterbox') {
  castVoice(voiceId, deps)
  const steps = (await lessonNarration('simple-house', deps)).steps
  for (const step of steps) await narrateStep('simple-house', { stepId: step.stepId }, deps)
  return lessonNarration('simple-house', deps)
}

const voiceFolder = path.join('Assets', 'Voice', 'simple-house')
const readManifest = async (): Promise<VoiceManifest> =>
  JSON.parse(await readFile(path.join(shared, voiceFolder, 'manifest.json'), 'utf8'))

describe('the WAV duration parser', () => {
  it('reads the length out of a file’s own header', () => {
    expect(wavDurationMs(silentWav(7040))).toBe(7040)
    expect(wavDurationMs(silentWav(250))).toBe(250)
    expect(wavDurationMs(silentWav(0))).toBe(null)
  })

  it('measures what is there when the header claims more', () => {
    const wav = silentWav(1000)
    // A file cut short mid-recording still has to report something sensible.
    expect(wavDurationMs(wav.slice(0, 44 + 24000))).toBe(500)
  })

  it('says nothing about what is not a WAV', () => {
    expect(wavDurationMs(new Uint8Array([1, 2, 3]))).toBe(null)
    expect(wavDurationMs(new Uint8Array(64))).toBe(null)
  })
})

describe('the cache key', () => {
  it('covers the words, the description, the speaker and the reference', () => {
    const base = { engine: 'qwen-design' as const, instruct: 'Warm.', speaker: null, frozen: null }
    const words = textHash(base, 'Hello.')
    expect(textHash(base, 'Hello.')).toBe(words)
    expect(textHash(base, 'Hello!')).not.toBe(words)
    expect(textHash({ ...base, instruct: 'Warmer.' }, 'Hello.')).not.toBe(words)
    expect(textHash({ ...base, speaker: 'Vivian' }, 'Hello.')).not.toBe(words)
    expect(
      textHash(
        { ...base, frozen: { referenceName: 'lina-x-a1b2c3', referenceText: 'Hello.', takeId: 't', frozenAt: 'now' } },
        'Hello.',
      ),
    ).not.toBe(words)
  })
})

describe('seeding', () => {
  it('writes the suggestions and the script on the first read', async () => {
    const state = await voiceState(deps)
    expect(state.voices.map((voice) => voice.id)).toEqual([
      'lina-bright',
      'lina-studio',
      'lina-spark',
      'lina-serena',
      'house-chatterbox',
    ])
    expect(state.voices.every((voice) => voice.suggested)).toBe(true)
    expect(state.script.map((line) => line.id)).toEqual(['hello', 'step', 'wobble', 'done'])
    expect(state.castVoiceId).toBe(null)
  })

  it('does not bring back a suggestion that was deleted', async () => {
    await voiceState(deps)
    deleteVoice('lina-spark', {}, deps)
    const again = await voiceState(deps)
    expect(again.voices.map((voice) => voice.id)).not.toContain('lina-spark')
  })
})

describe('the speech server as the Studio sees it', () => {
  it('reports what is warm and what references exist', async () => {
    const { server } = await voiceState(deps)
    expect(server).toMatchObject({ url: tts.url, reachable: true, warm: ['chatterbox-turbo'], generating: false })
    expect(server.references).toEqual(['test-reference'])
  })

  it('says it is unreachable instead of throwing when the Mac is asleep', async () => {
    await tts.close()
    const { server } = await voiceState(deps)
    expect(server.reachable).toBe(false)
    expect(server.error).toContain('Could not read the health of the voice server')
  })

  it('quotes the server’s own words when a line fails', async () => {
    await voiceState(deps)
    tts.failSpeech = { status: 500, body: 'model not found: /Users/kevin/tts/models/qwen-design' }
    const refused = await refusal(() => say('lina-bright', 'Hello.', {}, deps))
    expect(refused.status).toBe(502)
    expect(refused.message).toContain('answered 500')
    expect(refused.message).toContain('model not found')
  })
})

describe('saying a line', () => {
  it('reuses the take already made, and makes another when asked', async () => {
    await voiceState(deps)
    const first = await say('house-chatterbox', 'Hello there.', {}, deps)
    expect(first.cached).toBe(false)
    expect(first.durationMs).toBeGreaterThan(0)

    const again = await say('house-chatterbox', 'Hello there.', {}, deps)
    expect(again.cached).toBe(true)
    expect(again.id).toBe(first.id)
    expect(tts.speech).toHaveLength(1)

    const another = await say('house-chatterbox', 'Hello there.', { another: true }, deps)
    expect(another.id).not.toBe(first.id)
    expect(another.textHash).toBe(first.textHash)
    expect(tts.speech).toHaveLength(2)
    expect((await voiceState(deps)).takes).toHaveLength(2)
  })

  it('sends each engine the body it wants', async () => {
    await voiceState(deps)
    await say('house-chatterbox', 'One.', {}, deps)
    await say('lina-bright', 'Two.', {}, deps)
    await say('lina-spark', 'Three.', {}, deps)
    expect(tts.speech[0]).toMatchObject({ model: expect.stringContaining('chatterbox-turbo'), input: 'One.' })
    expect(tts.speech[1]).toMatchObject({ model: expect.stringContaining('qwen-design'), instruct: expect.stringContaining('art teacher') })
    expect(tts.speech[2]).toMatchObject({ model: expect.stringContaining('qwen-custom'), voice: 'Vivian' })
  })

  it('makes the line again once the description changes', async () => {
    await voiceState(deps)
    const before = await say('lina-bright', 'Hello.', {}, deps)
    updateVoice('lina-bright', { instruct: 'A different woman entirely, low and slow.' }, deps)
    const after = await say('lina-bright', 'Hello.', {}, deps)
    expect(after.textHash).not.toBe(before.textHash)
    expect(after.cached).toBe(false)
  })
})

describe('freezing a voice', () => {
  it('uploads the take and clones from it afterwards', async () => {
    await voiceState(deps)
    const take = await say('lina-bright', 'Hi, I am Lina.', {}, deps)
    const frozen = await freezeVoice('lina-bright', take.id, deps)

    expect(tts.addVoiceCalls).toHaveLength(1)
    const call = tts.addVoiceCalls[0]
    expect(call.name).toMatch(/^lina-lina-bright-[0-9a-f]{6}$/)
    expect(call.transcript).toBe('Hi, I am Lina.')
    expect(wavDurationMs(call.audio)).toBe(wavDurationMs(silentWav(take.durationMs)))
    expect(frozen.frozen).toMatchObject({ referenceName: call.name, referenceText: 'Hi, I am Lina.', takeId: take.id })

    await say('lina-bright', 'A new line.', {}, deps)
    expect(tts.speech[tts.speech.length - 1]).toMatchObject({
      model: expect.stringContaining('qwen-base'),
      ref_audio: `/Users/kevin/tts/voices/${call.name}.wav`,
      ref_text: 'Hi, I am Lina.',
    })
  })

  it('refuses to change a frozen voice’s description until it is unfrozen', async () => {
    await voiceState(deps)
    const take = await say('lina-bright', 'Hi.', {}, deps)
    await freezeVoice('lina-bright', take.id, deps)
    const refused = await refusal(() => updateVoice('lina-bright', { instruct: 'Someone else.' }, deps))
    expect(refused.status).toBe(422)
    expect(refused.message).toContain('Unfreeze it first')

    unfreezeVoice('lina-bright', deps)
    expect(updateVoice('lina-bright', { instruct: 'Someone else.' }, deps).instruct).toBe('Someone else.')
  })

  it('has nothing to freeze for the fixed house voice', async () => {
    await voiceState(deps)
    const take = await say('house-chatterbox', 'Hi.', {}, deps)
    expect((await refusal(() => freezeVoice('house-chatterbox', take.id, deps))).status).toBe(422)
  })
})

describe('narrating a lesson', () => {
  it('speaks each step’s instruction and records the take against it', async () => {
    await voiceState(deps)
    castVoice('house-chatterbox', deps)
    const before = await lessonNarration('simple-house', deps)
    expect(before.steps).toHaveLength(5)
    expect(before.steps.every((step) => step.stale === 'missing')).toBe(true)
    expect(before.published).toBe(null)

    const after = await narrateStep('simple-house', { stepId: 'walls' }, deps)
    const walls = after.steps.find((step) => step.stepId === 'walls')!
    expect(walls.stale).toBe(null)
    expect(walls.take?.text).toBe(walls.instruction)
    expect(tts.speech[0].input).toBe(walls.instruction)
  })

  it('speaks a written line instead of the instruction, and goes stale when the words change', async () => {
    await voiceState(deps)
    castVoice('house-chatterbox', deps)
    await narrateStep('simple-house', { stepId: 'roof' }, deps)

    const written = await setNarrationLine('simple-house', 'roof', 'Now the roof. One long line each way.', deps)
    const roof = written.steps.find((step) => step.stepId === 'roof')!
    expect(roof.spokenLine).toBe('Now the roof. One long line each way.')
    expect(roof.text).toBe('Now the roof. One long line each way.')
    expect(roof.stale).toBe('text-changed')

    const remade = await narrateStep('simple-house', { stepId: 'roof' }, deps)
    expect(remade.steps.find((step) => step.stepId === 'roof')!.stale).toBe(null)

    const cleared = await setNarrationLine('simple-house', 'roof', null, deps)
    expect(cleared.steps.find((step) => step.stepId === 'roof')!.spokenLine).toBe(null)
  })

  it('goes stale when another voice is cast', async () => {
    await voiceState(deps)
    castVoice('house-chatterbox', deps)
    await narrateStep('simple-house', { stepId: 'door' }, deps)
    castVoice('lina-bright', deps)
    const after = await lessonNarration('simple-house', deps)
    expect(after.steps.find((step) => step.stepId === 'door')!.stale).toBe('voice-changed')
  })

  it('refuses to narrate before a voice is cast', async () => {
    await voiceState(deps)
    const refused = await refusal(() => narrateStep('simple-house', { stepId: 'walls' }, deps))
    expect(refused.status).toBe(409)
    expect(refused.message).toContain('No voice is cast')
  })

  it('keeps the newest take for a step when one is remade', async () => {
    await voiceState(deps)
    castVoice('house-chatterbox', deps)
    const first = await narrateStep('simple-house', { stepId: 'walls' }, deps)
    const firstTake = first.steps.find((step) => step.stepId === 'walls')!.take!
    const second = await narrateStep('simple-house', { stepId: 'walls', another: true }, deps)
    const secondTake = second.steps.find((step) => step.stepId === 'walls')!.take!
    expect(secondTake.id).not.toBe(firstTake.id)
    expect(second.steps.find((step) => step.stepId === 'walls')!.stale).toBe(null)
  })
})

describe('deleting a voice', () => {
  it('refuses while a lesson is narrated with it, and takes the recordings with it under force', async () => {
    await voiceState(deps)
    castVoice('house-chatterbox', deps)
    await narrateStep('simple-house', { stepId: 'walls' }, deps)

    const refused = await refusal(() => deleteVoice('house-chatterbox', {}, deps))
    expect(refused.status).toBe(409)
    expect(refused.message).toContain('simple-house')

    deleteVoice('house-chatterbox', { force: true }, deps)
    const after = await lessonNarration('simple-house', deps)
    expect(after.steps.every((step) => step.stale === 'missing')).toBe(true)
    expect(after.castVoiceId).toBe(null)
    expect((await voiceState(deps)).takes).toHaveLength(0)
  })
})

describe('publishing a lesson’s voice', () => {
  it('refuses while a step is missing or stale', async () => {
    await voiceState(deps)
    castVoice('house-chatterbox', deps)
    expect((await refusal(() => publishVoice('simple-house', deps))).message).toContain('no recording')

    await narrateHouse()
    await setNarrationLine('simple-house', 'door', 'Now the door.', deps)
    const stale = await refusal(() => publishVoice('simple-house', deps))
    expect(stale.status).toBe(422)
    expect(stale.message).toContain('out of date')
  })

  it('refuses while the lesson itself is not published', async () => {
    await voiceState(deps)
    const house = JSON.parse((await workspace.readTutorial('simple-house'))!.text) as Tutorial
    await workspace.writeTutorial('house-two', { ...house, id: 'house-two', title: 'House Two' }, { etag: null })
    castVoice('house-chatterbox', deps)
    for (const step of house.steps) await narrateStep('house-two', { stepId: step.id }, deps)

    const refused = await refusal(() => publishVoice('house-two', deps))
    expect(refused.status).toBe(422)
    expect(refused.message).toContain('not published yet')
    expect(existsSync(path.join(shared, 'Assets', 'Voice', 'house-two'))).toBe(false)
  })

  it('writes one AAC file per step and a manifest beside them', async () => {
    await voiceState(deps)
    const narration = await narrateHouse()
    const { files } = await publishVoice('simple-house', deps)

    expect(files).toEqual([
      'shared/Assets/Voice/simple-house/chimney.m4a',
      'shared/Assets/Voice/simple-house/door.m4a',
      'shared/Assets/Voice/simple-house/manifest.json',
      'shared/Assets/Voice/simple-house/roof.m4a',
      'shared/Assets/Voice/simple-house/walls.m4a',
      'shared/Assets/Voice/simple-house/windows.m4a',
    ])
    expect(converter.calls).toHaveLength(5)

    const manifest = await readManifest()
    expect(manifest.manifestVersion).toBe(1)
    expect(manifest.lessonId).toBe('simple-house')
    expect(manifest.voiceId).toBe('house-chatterbox')
    expect(manifest.voiceName).toBe('House voice')
    expect(manifest.model).toBe('chatterbox')
    expect(Object.keys(manifest.steps)).toEqual(['walls', 'roof', 'door', 'windows', 'chimney'])
    const walls = narration.steps[0]
    expect(manifest.steps.walls).toEqual({
      file: 'walls.m4a',
      text: walls.text,
      textHash: walls.take!.textHash,
      durationMs: walls.take!.durationMs,
    })
    // The published file is the converter's output, not the workspace's WAV.
    const published = await readFile(path.join(shared, voiceFolder, 'walls.m4a'))
    expect(published.subarray(4, 8).toString()).toBe('ftyp')
  })

  it('reports what is published, and when the workspace has moved on', async () => {
    await voiceState(deps)
    await narrateHouse()
    await publishVoice('simple-house', deps)

    const fresh = await lessonNarration('simple-house', deps)
    expect(fresh.published).toMatchObject({ voiceId: 'house-chatterbox', voiceName: 'House voice', stepCount: 5, behind: false })

    await setNarrationLine('simple-house', 'door', 'Now the door, a tall rectangle.', deps)
    await narrateStep('simple-house', { stepId: 'door' }, deps)
    const moved = await lessonNarration('simple-house', deps)
    expect(moved.published?.behind).toBe(true)
  })

  it('removes a file for a step that is no longer in the lesson', async () => {
    await voiceState(deps)
    await narrateHouse()
    await publishVoice('simple-house', deps)
    await writeFile(path.join(shared, voiceFolder, 'ghost.m4a'), 'left behind')

    const { files } = await publishVoice('simple-house', deps)
    expect(files).toContain('shared/Assets/Voice/simple-house/ghost.m4a')
    expect(existsSync(path.join(shared, voiceFolder, 'ghost.m4a'))).toBe(false)
    expect((await readdir(path.join(shared, voiceFolder))).sort()).toEqual([
      'chimney.m4a',
      'door.m4a',
      'manifest.json',
      'roof.m4a',
      'walls.m4a',
      'windows.m4a',
    ])
  })

  it('takes a published narration out again', async () => {
    await voiceState(deps)
    await narrateHouse()
    await publishVoice('simple-house', deps)
    const { files } = await writer.deleteVoice('simple-house')
    expect(files).toHaveLength(6)
    expect(existsSync(path.join(shared, voiceFolder))).toBe(false)
    expect((await lessonNarration('simple-house', deps)).published).toBe(null)
  })
})

describe('the candidates', () => {
  it('gives a new voice the slug of its name, made unique', async () => {
    await voiceState(deps)
    const first = createVoice({ name: 'Lina, bright', engine: 'chatterbox' }, deps)
    expect(first.id).toBe('lina-bright-2')
    const second = createVoice({ name: 'A Whole New Voice', engine: 'chatterbox' }, deps)
    expect(second.id).toBe('a-whole-new-voice')
    expect(second.suggested).toBe(false)
  })

  it('insists on a real speaker for a CustomVoice voice', async () => {
    await voiceState(deps)
    const refused = await refusal(() => createVoice({ name: 'Made up', engine: 'qwen-custom', speaker: 'Nobody' }, deps))
    expect(refused.status).toBe(422)
    expect(refused.message).toContain('Vivian')
  })

  it('insists a designed voice is described', async () => {
    await voiceState(deps)
    expect((await refusal(() => createVoice({ name: 'Blank', engine: 'qwen-design' }, deps))).status).toBe(422)
  })
})
