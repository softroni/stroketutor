import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { validateCatalog } from '../src/catalog/validate'
import { validateTutorial } from '../src/schema/validate'
import type { Tutorial } from '../src/schema/types'
import { APP_LINE_IDS, type AppVoiceManifest, type VoiceManifest, type VoiceReferenceRecord } from '../src/voice/types'
import { FIXTURE_SHARED } from '../test/fixture'

import { GenerationFailed } from './openrouter'
import { WriteRefused, createRepoWriter, type RepoWriter } from './repoWriter'
import { fakeConverter, startFakeTts, type FakeTts } from './testing'
import { silentWav, wavDurationMs } from './tts'
import {
  adoptKeptReferences,
  appLines,
  applySpokenLines,
  castVoice,
  createVoice,
  deletePublishedAppLines,
  deleteVoice,
  exportReference,
  freezeVoice,
  lessonNarration,
  narrateAppLine,
  narrateStep,
  publishAppLines,
  publishVoice,
  restoreReference,
  say,
  setAppLine,
  setNarrationLine,
  textHash,
  unfreezeVoice,
  updateVoice,
  voiceState,
  writeSpokenLines,
  type VoiceDeps,
} from './voice'
import { openWorkspace, type Workspace } from './workspaceStore'

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
    await cp(path.join(FIXTURE_SHARED, folder), path.join(shared, folder), { recursive: true })
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

/** A model that always answers `answer`, recording the request bodies it was sent. */
function model(answer: unknown) {
  const calls: { body: Record<string, unknown> }[] = []
  const fetch = (async (_url: string, init: RequestInit) => {
    calls.push({ body: JSON.parse(String(init.body)) as Record<string, unknown> })
    const payload = {
      model: 'vendor/text-model',
      choices: [{ finish_reason: 'stop', message: { content: typeof answer === 'string' ? answer : JSON.stringify(answer) } }],
      usage: { prompt_tokens: 700, completion_tokens: 200, cost: 0.001 },
    }
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as unknown as typeof globalThis.fetch
  return { calls, fetch }
}

/** Points the voice deps at a fake model, as the Studio server points them at OpenRouter. */
function withModel(answer: unknown) {
  const router = model(answer)
  deps.generation = { apiKey: 'test-key', defaultModel: 'vendor/text-model', fetch: router.fetch }
  return router
}

const HOUSE_STEPS = ['walls', 'roof', 'door', 'windows', 'chimney']
const spoken = (ids: string[], text = (id: string) => `Say ${id}.`) => ({
  rationale: 'Short lines, said while the stroke draws.',
  lines: ids.map((id) => ({ id, text: text(id) })),
})
/** The text of the one user message a spoken-lines request carries. */
const promptOf = (router: ReturnType<typeof model>, call = 0) =>
  ((router.calls[call].body.messages as { content: { text: string }[] }[])[1].content[0].text)

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
    await deleteVoice('lina-spark', {}, deps)
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

    await unfreezeVoice('lina-bright', deps)
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
    // Five steps, with what Lina says before the lesson first and after it last.
    expect(before.steps.map((step) => step.kind)).toEqual(['intro', 'step', 'step', 'step', 'step', 'step', 'outro'])
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

    await deleteVoice('house-chatterbox', { force: true }, deps)
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

  it('refuses while the lesson has edits that are not published', async () => {
    await voiceState(deps)
    await narrateHouse()
    const stored = (await workspace.readTutorial('simple-house'))!
    const house = JSON.parse(stored.text) as Tutorial
    await workspace.writeTutorial('simple-house', { ...house, title: 'House, edited' }, { etag: stored.etag })

    const refused = await refusal(() => publishVoice('simple-house', deps))
    expect(refused.status).toBe(409)
    expect(refused.message).toContain('edits that are not published')
    expect(existsSync(path.join(shared, 'Assets', 'Voice', 'simple-house'))).toBe(false)
  })

  it('writes one AAC file per step and a manifest beside them', async () => {
    await voiceState(deps)
    const narration = await narrateHouse()
    const { files } = await publishVoice('simple-house', deps)

    expect(files).toEqual([
      'shared/Assets/Voice/simple-house/chimney.m4a',
      'shared/Assets/Voice/simple-house/door.m4a',
      'shared/Assets/Voice/simple-house/lesson-intro.m4a',
      'shared/Assets/Voice/simple-house/lesson-outro.m4a',
      'shared/Assets/Voice/simple-house/manifest.json',
      'shared/Assets/Voice/simple-house/roof.m4a',
      'shared/Assets/Voice/simple-house/walls.m4a',
      'shared/Assets/Voice/simple-house/windows.m4a',
    ])
    expect(converter.calls).toHaveLength(7)

    const manifest = await readManifest()
    expect(manifest.manifestVersion).toBe(1)
    expect(manifest.lessonId).toBe('simple-house')
    expect(manifest.voiceId).toBe('house-chatterbox')
    expect(manifest.voiceName).toBe('House voice')
    expect(manifest.model).toBe('chatterbox')
    // What Lina says around the lesson is published as the steps are, under the two ids kept for it.
    expect(Object.keys(manifest.steps)).toEqual(['lesson-intro', 'walls', 'roof', 'door', 'windows', 'chimney', 'lesson-outro'])
    const walls = narration.steps[1]
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
    expect(fresh.published).toMatchObject({ voiceId: 'house-chatterbox', voiceName: 'House voice', stepCount: 7, behind: false })

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
      'lesson-intro.m4a',
      'lesson-outro.m4a',
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
    expect(files).toHaveLength(8)
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

describe('writing the spoken lines', () => {
  it('tells the model the lesson, its objective and every step, and saves a line for each', async () => {
    await voiceState(deps)
    const router = withModel(spoken(HOUSE_STEPS))
    const written = await writeSpokenLines('simple-house', {}, deps)

    const body = router.calls[0].body
    expect(body.model).toBe('vendor/text-model')
    expect((body.response_format as { json_schema: { name: string } }).json_schema.name).toBe('stroketutor_spoken_lines')
    const system = (body.messages as { content: string }[])[0].content
    expect(system).toContain('At most 22 words')
    expect(system).toContain('At most one exclamation mark in the whole lesson')
    const prompt = promptOf(router)
    expect(prompt).toContain('Lesson: Simple House')
    expect(prompt).toContain('What it teaches: See a house as a box')
    expect(prompt).toContain('Step 1, id "walls": Draw the walls (1 line)')
    expect(prompt).toContain('Step 4, id "windows": Add two windows (2 lines)')
    expect(prompt).toContain('Written instruction: Draw a big square')

    expect(written.writing.promptVersion).toBe('spoken-lines-v1')
    expect(written.writing.model).toBe('vendor/text-model')
    expect(written.writing.written).toEqual(HOUSE_STEPS)
    expect(written.writing.kept).toEqual([])
    const stepLines = written.steps.filter((step) => step.kind === 'step')
    expect(stepLines.map((step) => step.spokenLine)).toEqual(HOUSE_STEPS.map((id) => `Say ${id}.`))
    expect(stepLines[0].text).toBe('Say walls.')
  })

  it('says which steps colour rather than draw, and passes the creator’s note on', async () => {
    await voiceState(deps)
    const car = JSON.parse((await workspace.readTutorial('classic-red-car'))!.text) as Tutorial
    const router = withModel(spoken(car.steps.map((step) => step.id)))
    await writeSpokenLines('classic-red-car', { note: 'Name the colours plainly.' }, deps)

    const prompt = promptOf(router)
    expect(prompt).toContain('id "body": Draw the car body (4 lines)')
    expect(prompt).toContain('id "red-body"')
    expect(prompt).toContain('(1 colour area, no lines)')
    expect(prompt).toContain('Name the colours plainly.')
  })

  it('keeps the lines already written, and tells the model they are being kept', async () => {
    await voiceState(deps)
    await setNarrationLine('simple-house', 'door', 'A tall door, near the middle.', deps)
    const router = withModel(spoken(HOUSE_STEPS))
    const written = await writeSpokenLines('simple-house', {}, deps)

    expect(promptOf(router)).toContain('Already spoken here, and being kept: “A tall door, near the middle.”')
    expect(written.writing.kept).toEqual(['door'])
    expect(written.steps.find((step) => step.stepId === 'door')!.spokenLine).toBe('A tall door, near the middle.')
    expect(written.steps.find((step) => step.stepId === 'walls')!.spokenLine).toBe('Say walls.')
  })

  it('replaces them with --overwrite', async () => {
    await voiceState(deps)
    await setNarrationLine('simple-house', 'door', 'A tall door, near the middle.', deps)
    const router = withModel(spoken(HOUSE_STEPS))
    const written = await writeSpokenLines('simple-house', { overwrite: true }, deps)

    expect(promptOf(router)).toContain('Spoken here now, and being replaced')
    expect(written.writing.kept).toEqual([])
    expect(written.steps.find((step) => step.stepId === 'door')!.spokenLine).toBe('Say door.')
  })

  it('refuses an answer that does not cover every step exactly once', async () => {
    await voiceState(deps)
    const failure = async (answer: unknown) => {
      withModel(answer)
      try {
        await writeSpokenLines('simple-house', {}, deps)
      } catch (error) {
        if (error instanceof GenerationFailed) return error.message
        throw error
      }
      throw new Error('Expected a refusal.')
    }

    expect(await failure(spoken(['walls', 'roof']))).toContain('wrote nothing for the steps door, windows, chimney')
    expect(await failure(spoken([...HOUSE_STEPS, 'porch']))).toContain('"porch", which is not a step')
    expect(await failure(spoken(['walls', ...HOUSE_STEPS]))).toContain('two lines for the step "walls"')
    expect(await failure(spoken(HOUSE_STEPS, (id) => (id === 'roof' ? '   ' : 'Fine.')))).toContain('left the step "roof" with nothing to say')
    expect(await failure(spoken(HOUSE_STEPS, (id) => (id === 'roof' ? 'x'.repeat(241) : 'Fine.')))).toContain('241 characters')
    // Nothing was saved by any of them.
    expect((await lessonNarration('simple-house', deps)).steps.every((step) => step.spokenLine === null)).toBe(true)
  })

  it('needs an OpenRouter key, like every other generation', async () => {
    await voiceState(deps)
    const refused = await refusal(() => writeSpokenLines('simple-house', {}, deps))
    expect(refused.status).toBe(503)
    expect(refused.message).toContain('OPENROUTER_API_KEY')
  })
})

describe('a plan of spoken lines', () => {
  it('writes every line it names, and clears one with null', async () => {
    await voiceState(deps)
    const written = await applySpokenLines(
      'simple-house',
      { lines: { walls: 'Start with the box.', door: '  A tall door, near the middle.  ' } },
      deps,
    )
    expect(written.steps.find((step) => step.stepId === 'walls')!.spokenLine).toBe('Start with the box.')
    expect(written.steps.find((step) => step.stepId === 'door')!.spokenLine).toBe('A tall door, near the middle.')
    expect(written.steps.find((step) => step.stepId === 'roof')!.spokenLine).toBe(null)

    const cleared = await applySpokenLines('simple-house', { lines: { walls: null } }, deps)
    expect(cleared.steps.find((step) => step.stepId === 'walls')!.spokenLine).toBe(null)
  })

  it('refuses an unknown step by name, and writes nothing at all', async () => {
    await voiceState(deps)
    const refused = await refusal(() =>
      applySpokenLines('simple-house', { lines: { walls: 'Start with the box.', chimbley: 'Oops.' } }, deps),
    )
    expect(refused.status).toBe(404)
    expect(refused.message).toContain('"chimbley"')
    expect((await lessonNarration('simple-house', deps)).steps.every((step) => step.spokenLine === null)).toBe(true)
  })

  it('refuses an empty line and one too long to say', async () => {
    await voiceState(deps)
    const empty = await refusal(() => applySpokenLines('simple-house', { lines: { walls: '   ' } }, deps))
    expect(empty.status).toBe(422)
    expect(empty.message).toContain('Use null')

    const long = await refusal(() => applySpokenLines('simple-house', { lines: { walls: 'x'.repeat(241) } }, deps))
    expect(long.message).toContain('241 characters')
    expect((await lessonNarration('simple-house', deps)).steps[0].spokenLine).toBe(null)
  })

  it('refuses a plan that is not an object of lines', async () => {
    await voiceState(deps)
    expect((await refusal(() => applySpokenLines('simple-house', { lines: ['walls'] }, deps))).status).toBe(400)
  })
})

describe('the reference kept in the repository', () => {
  const referenceFolder = path.join('Assets', 'VoiceReference')

  /** Lina, designed, auditioned once and frozen on that take. */
  async function freezeLina() {
    await voiceState(deps)
    const take = await say('lina-bright', 'Hi, I am Lina.', {}, deps)
    const voice = await freezeVoice('lina-bright', take.id, deps)
    return { take, voice }
  }

  it('writes the WAV and its record, and puts the voice back on an empty machine', async () => {
    const { take, voice } = await freezeLina()
    const { files, record } = await exportReference('lina-bright', deps)
    expect(files).toEqual([
      'shared/Assets/VoiceReference/lina-bright.wav',
      'shared/Assets/VoiceReference/lina-bright.json',
    ])

    const kept = JSON.parse(await readFile(path.join(shared, referenceFolder, 'lina-bright.json'), 'utf8')) as VoiceReferenceRecord
    expect(kept).toEqual(record)
    expect(kept).toMatchObject({
      referenceVersion: 1,
      voiceId: 'lina-bright',
      engine: 'qwen-design',
      referenceName: voice.frozen!.referenceName,
      referenceText: 'Hi, I am Lina.',
      takeId: take.id,
      durationMs: take.durationMs,
    })
    const wav = new Uint8Array(await readFile(path.join(shared, referenceFolder, 'lina-bright.wav')))
    expect(wavDurationMs(wav)).toBe(take.durationMs)

    // A wiped Mac: a workspace that has never recorded anything, and a speech
    // server that has never heard of this reference.
    const fresh = await openWorkspace({ file: ':memory:', writer, validateTutorial, validateCatalog })
    tts.addVoiceCalls.length = 0
    const restored = await restoreReference('lina-bright', { ...deps, workspace: fresh })

    expect(tts.addVoiceCalls).toHaveLength(1)
    expect(tts.addVoiceCalls[0].name).toBe(voice.frozen!.referenceName)
    expect(tts.addVoiceCalls[0].transcript).toBe('Hi, I am Lina.')
    expect(Buffer.from(tts.addVoiceCalls[0].audio).toString('base64')).toBe(Buffer.from(wav).toString('base64'))

    expect(restored.voice.frozen).toEqual(voice.frozen)
    expect(restored.createdVoice).toBe(false)
    expect(restored.restoredTake).toBe(true)
    expect(fresh.readTake(take.id)?.text).toBe('Hi, I am Lina.')
    // And it speaks by cloning that reference again.
    const after = await say('lina-bright', 'A new line.', {}, { ...deps, workspace: fresh })
    expect(after.durationMs).toBeGreaterThan(0)
    expect(tts.speech[tts.speech.length - 1]).toMatchObject({
      ref_audio: `/Users/kevin/tts/voices/${voice.frozen!.referenceName}.wav`,
      ref_text: 'Hi, I am Lina.',
    })
    fresh.close()
  })

  it('creates the voice from the record when the workspace has never had it', async () => {
    const { voice } = await freezeLina()
    // Straight out of the workspace: `deleteVoice` would take the record with it.
    workspace.deleteVoice('lina-bright')

    const restored = await restoreReference('lina-bright', deps)
    expect(restored.createdVoice).toBe(true)
    expect(restored.voice).toMatchObject({
      id: 'lina-bright',
      name: voice.name,
      engine: 'qwen-design',
      instruct: voice.instruct,
      suggested: false,
    })
    expect(restored.voice.frozen!.referenceName).toBe(voice.frozen!.referenceName)
  })

  it('refuses to write out a voice that is not frozen, or one whose take is gone', async () => {
    await voiceState(deps)
    const loose = await refusal(() => exportReference('lina-bright', deps))
    expect(loose.status).toBe(422)
    expect(loose.message).toContain('is not frozen')

    const { voice } = await freezeLina()
    workspace.saveVoice({ ...voice, frozen: { ...voice.frozen!, takeId: 'gone' } })
    expect((await refusal(() => exportReference('lina-bright', deps))).status).toBe(409)

    expect((await refusal(() => restoreReference('nobody', deps))).status).toBe(404)
  })

  it('remembers a freeze in shared/ the moment it is made, and forgets it on unfreeze', async () => {
    const { take, voice } = await freezeLina()
    const kept = JSON.parse(await readFile(path.join(shared, referenceFolder, 'lina-bright.json'), 'utf8')) as VoiceReferenceRecord
    expect(kept).toMatchObject({ voiceId: 'lina-bright', referenceName: voice.frozen!.referenceName, takeId: take.id })
    expect(await writer.listVoiceReferenceIds()).toEqual(['lina-bright'])

    await unfreezeVoice('lina-bright', deps)
    expect(await writer.listVoiceReferenceIds()).toEqual([])
    // Nothing is left to freeze it back.
    expect(await adoptKeptReferences(deps)).toEqual([])
    expect(workspace.readVoice('lina-bright')!.frozen).toBe(null)
  })

  it('takes a deleted voice’s record out of shared/ with it', async () => {
    await freezeLina()
    await deleteVoice('lina-bright', { force: true }, deps)
    expect(await writer.listVoiceReferenceIds()).toEqual([])
  })

  it('freezes a fresh clone’s workspace to what shared/ remembers, and uploads the reference when first spoken', async () => {
    const { take, voice } = await freezeLina()

    // Another machine: the same shared/, a workspace that has recorded nothing,
    // and a speech server that has never been sent this reference.
    const fresh = await openWorkspace({ file: ':memory:', writer, validateTutorial, validateCatalog })
    const elsewhere = await startFakeTts()
    const there: VoiceDeps = { ...deps, workspace: fresh, tts: { ...deps.tts, url: elsewhere.url, mcpUrl: elsewhere.mcpUrl } }

    const adopted = await adoptKeptReferences(there)
    expect(adopted.map((one) => one.id)).toEqual(['lina-bright'])
    expect(fresh.readVoice('lina-bright')!.frozen).toEqual(voice.frozen)
    expect(fresh.readTake(take.id)?.text).toBe('Hi, I am Lina.')
    expect(elsewhere.addVoiceCalls).toHaveLength(0)
    // Looking again changes nothing.
    expect(await adoptKeptReferences(there)).toEqual([])

    await say('lina-bright', 'A new line.', {}, there)
    expect(elsewhere.addVoiceCalls.map((call) => call.name)).toEqual([voice.frozen!.referenceName])
    expect(elsewhere.speech[0]).toMatchObject({ ref_audio: `/Users/kevin/tts/voices/${voice.frozen!.referenceName}.wav` })
    await say('lina-bright', 'And another.', {}, there)
    expect(elsewhere.addVoiceCalls).toHaveLength(1)

    fresh.close()
    await elsewhere.close()
  })

  it('lets the repository win when it remembers a different freeze', async () => {
    const { voice } = await freezeLina()
    workspace.saveVoice({ ...voice, frozen: { ...voice.frozen!, referenceName: 'lina-lina-bright-000000' } })
    await adoptKeptReferences(deps)
    expect(workspace.readVoice('lina-bright')!.frozen!.referenceName).toBe(voice.frozen!.referenceName)
  })

  it('publishes the cast voice’s reference beside the lesson’s audio when shared/ has lost it, once', async () => {
    const { voice } = await freezeLina()
    await writer.deleteVoiceReference('lina-bright')
    await narrateHouse('lina-bright')
    const { files } = await publishVoice('simple-house', deps)
    expect(files).toContain('shared/Assets/VoiceReference/lina-bright.wav')
    expect(files).toContain('shared/Assets/VoiceReference/lina-bright.json')
    const kept = JSON.parse(await readFile(path.join(shared, referenceFolder, 'lina-bright.json'), 'utf8')) as VoiceReferenceRecord
    expect(kept.referenceName).toBe(voice.frozen!.referenceName)

    // The second publish leaves it alone: what is on disk already matches.
    const again = await publishVoice('simple-house', deps)
    expect(again.files).not.toContain('shared/Assets/VoiceReference/lina-bright.wav')
  })

  it('writes nothing for a voice that was never frozen', async () => {
    await voiceState(deps)
    await narrateHouse()
    const { files } = await publishVoice('simple-house', deps)
    expect(files.some((file) => file.includes('VoiceReference'))).toBe(false)
  })
})

describe('Lina’s own lines', () => {
  const appFolder = path.join('Assets', 'Voice', 'app')
  const readAppManifest = async (): Promise<AppVoiceManifest> =>
    JSON.parse(await readFile(path.join(shared, appFolder, 'manifest.json'), 'utf8'))

  /** Every app line recorded in the house voice, which is what publishing needs. */
  async function narrateApp(voiceId = 'house-chatterbox') {
    castVoice(voiceId, deps)
    for (const id of APP_LINE_IDS) await narrateAppLine(id, {}, deps)
    return appLines(deps)
  }

  it('seeds the app’s own lines, by their fixed ids, with nothing recorded', async () => {
    const narration = await appLines(deps)
    expect(narration.lines.map((line) => line.id)).toEqual([...APP_LINE_IDS])
    expect(narration.lines.every((line) => line.stale === 'missing' && line.take === null)).toBe(true)
    expect(narration.published).toBe(null)

    const hello = narration.lines[0]
    expect(hello.where).toBe('Onboarding and Settings: meet the voice')
    expect(hello.text).toBe(
      "Hi, I'm Lina. I'll talk you through each step while it draws. You can turn my voice off any time.",
    )
    expect(narration.lines.find((line) => line.id === 'path-4')!.text).toBe(
      'You have the shape of the subject now. The rest is time with a pen.',
    )
  })

  it('keeps a rewritten line, and refuses a strange id, an empty line and one too long', async () => {
    const written = await setAppLine('lesson-2', '  You did the hard part twice.  ', deps)
    expect(written.lines.find((line) => line.id === 'lesson-2')!.text).toBe('You did the hard part twice.')
    // The words are the creator's; the label saying where it plays is not touched.
    expect(written.lines.find((line) => line.id === 'lesson-2')!.where).toBe('Lesson complete, 2 of 4')
    expect((await appLines(deps)).lines.find((line) => line.id === 'lesson-2')!.text).toBe(
      'You did the hard part twice.',
    )

    const unknown = await refusal(() => setAppLine('lesson-5', 'Nope.', deps))
    expect(unknown.status).toBe(404)
    expect(unknown.message).toContain('is not one of the app’s lines')

    const empty = await refusal(() => setAppLine('hello', '   ', deps))
    expect(empty.status).toBe(422)
    expect(empty.message).toContain('cannot be empty')

    const long = await refusal(() => setAppLine('hello', 'x'.repeat(241), deps))
    expect(long.status).toBe(422)
    expect(long.message).toContain('241 characters')

    // None of the refusals wrote anything.
    expect((await appLines(deps)).lines.find((line) => line.id === 'hello')!.text).toContain("Hi, I'm Lina.")
  })

  it('records a line, and goes stale when the words or the voice change', async () => {
    castVoice('house-chatterbox', deps)
    const recorded = await narrateAppLine('hello', {}, deps)
    const hello = recorded.lines.find((line) => line.id === 'hello')!
    expect(hello.stale).toBe(null)
    expect(hello.take!.durationMs).toBeGreaterThan(0)
    expect(recorded.lines.filter((line) => line.stale === 'missing')).toHaveLength(APP_LINE_IDS.length - 1)

    const rewritten = await setAppLine('hello', 'Hi, I am Lina, and I will talk you through it.', deps)
    expect(rewritten.lines.find((line) => line.id === 'hello')!.stale).toBe('text-changed')

    await narrateAppLine('hello', {}, deps)
    castVoice('lina-serena', deps)
    expect((await appLines(deps)).lines.find((line) => line.id === 'hello')!.stale).toBe('voice-changed')

    // And it refuses with nobody cast at all.
    castVoice(null, deps)
    expect((await refusal(() => narrateAppLine('hello', {}, deps))).status).toBe(409)
  })

  it('refuses to publish while a line is missing or out of date', async () => {
    castVoice('house-chatterbox', deps)
    const nothing = await refusal(() => publishAppLines(deps))
    expect(nothing.status).toBe(422)
    expect(nothing.message).toContain('9 lines have no recording')

    await narrateApp()
    await setAppLine('path-1', 'Now go and find one outside.', deps)
    const stale = await refusal(() => publishAppLines(deps))
    expect(stale.message).toContain('1 is out of date')
    expect(existsSync(path.join(shared, appFolder))).toBe(false)
  })

  it('writes one file per line and a manifest, and takes them out again', async () => {
    await narrateApp()
    const { files } = await publishAppLines(deps)
    expect(files).toEqual(
      [
        ...APP_LINE_IDS.map((id) => `shared/Assets/Voice/app/${id}.m4a`),
        'shared/Assets/Voice/app/manifest.json',
      ].sort(),
    )

    const manifest = await readAppManifest()
    expect(manifest.manifestVersion).toBe(1)
    expect(manifest.voiceId).toBe('house-chatterbox')
    expect(manifest.voiceName).toBe('House voice')
    expect(manifest.model).toBe('chatterbox')
    expect(Object.keys(manifest.lines)).toEqual([...APP_LINE_IDS])
    expect(manifest.lines['lesson-1']).toMatchObject({
      file: 'lesson-1.m4a',
      text: 'That is the whole shape, in your hand. The next one starts from here.',
    })
    expect(manifest.lines['lesson-1'].durationMs).toBeGreaterThan(0)
    // The folder is the manifest, exactly: nothing else is in it.
    expect((await readdir(path.join(shared, appFolder))).sort()).toEqual(
      [...APP_LINE_IDS.map((id) => `${id}.m4a`), 'manifest.json'].sort(),
    )

    expect((await appLines(deps)).published).toMatchObject({
      voiceId: 'house-chatterbox',
      lineCount: 9,
      behind: false,
    })

    // A line rewritten and recorded again after publishing leaves shared/ behind.
    await setAppLine('path-1', 'Now go and find one outside.', deps)
    await narrateAppLine('path-1', {}, deps)
    expect((await appLines(deps)).published!.behind).toBe(true)

    const removed = await deletePublishedAppLines(deps)
    expect(removed.files).toHaveLength(10)
    expect(existsSync(path.join(shared, appFolder))).toBe(false)
    expect((await appLines(deps)).published).toBe(null)
    // Removing again is fine, and the recordings stayed in the workspace.
    expect((await deletePublishedAppLines(deps)).files).toEqual([])
    expect((await appLines(deps)).lines.find((line) => line.id === 'hello')!.take).not.toBe(null)
  })

  it('exports the frozen cast voice’s reference beside them, as a lesson does', async () => {
    const take = await say('lina-bright', 'Hi, I am Lina.', {}, deps)
    await freezeVoice('lina-bright', take.id, deps)
    await writer.deleteVoiceReference('lina-bright')
    await narrateApp('lina-bright')

    const { files } = await publishAppLines(deps)
    expect(files).toContain('shared/Assets/VoiceReference/lina-bright.wav')
    expect(files).toContain('shared/Assets/VoiceReference/lina-bright.json')
    expect((await readAppManifest()).model).toContain('qwen-base clone of')

    // The second publish leaves the reference alone: what is on disk matches.
    expect((await publishAppLines(deps)).files).not.toContain('shared/Assets/VoiceReference/lina-bright.wav')
  })

  it('keeps every lesson out of the folder the app’s lines live in', async () => {
    const clash = await refusal(() => deps.writer.readVoiceManifest('app'))
    expect(clash.status).toBe(422)
    expect(clash.message).toContain('Lina’s own lines')
  })
})
