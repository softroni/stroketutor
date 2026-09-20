import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { fakeConverter, startFakeTts, type FakeTts } from '../server/testing'
import { wavDurationMs } from '../server/tts'
import {
  APP_LINE_IDS,
  type AppNarration,
  type AppVoiceManifest,
  type LessonNarration,
  type Take,
  type Voice,
  type VoiceManifest,
  type VoiceState,
} from '../src/voice/types'

import { openTestStudio, type TestStudio } from './testing'

let t: TestStudio
let tts: FakeTts
/** What the fake model answers `voice lines generate`; set by the test that wants one. */
let modelAnswer: unknown = null
let modelCalls: Record<string, unknown>[] = []

beforeEach(async () => {
  tts = await startFakeTts()
  modelAnswer = null
  modelCalls = []
  const fetch = (async (_url: string, init: RequestInit) => {
    modelCalls.push(JSON.parse(String(init.body)) as Record<string, unknown>)
    const payload = {
      model: 'vendor/text-model',
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(modelAnswer) } }],
    }
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as unknown as typeof globalThis.fetch
  t = await openTestStudio({
    tts: { url: tts.url, mcpUrl: tts.mcpUrl, convert: fakeConverter().convert },
    generation: { apiKey: 'test-key', defaultModel: 'vendor/text-model', fetch },
  })
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
    // Five steps, and what Lina says before and after the lesson.
    expect(first.stdout).toContain('1 of 7')
    expect(first.stdout).toContain('Recorded 7 steps of Simple House.')

    const again = await t.json<{ recorded: unknown[] }>('voice narrate simple-house')
    expect(again.recorded).toEqual([])
    expect(tts.speech).toHaveLength(7)

    const remade = await t.json<{ recorded: unknown[] }>('voice narrate simple-house --remake')
    expect(remade.recorded).toHaveLength(7)
    expect(tts.speech).toHaveLength(14)
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
    expect(published.stdout).toContain('8 files')
    expect(published.stdout).toContain('git add -- shared/Assets/Voice/simple-house/chimney.m4a')

    const manifest = JSON.parse(
      await readFile(path.join(t.shared, 'Assets', 'Voice', 'simple-house', 'manifest.json'), 'utf8'),
    ) as VoiceManifest
    expect(Object.keys(manifest.steps)).toHaveLength(7)
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

  it('narrates every lesson with --all, in curriculum order, and keeps going past a failure', async () => {
    await t.studio('voice cast house-chatterbox')
    const all = await t.studio('voice narrate --all')
    expect(all.code).toBe(0)
    // The curriculum's own order — trees, houses, cars — then the unfiled lesson.
    const at = (title: string) => all.stdout.indexOf(title)
    expect(at('Palm Tree 4 (palm-tree-4)')).toBeGreaterThan(-1)
    expect(at('Palm Tree 4 (palm-tree-4)')).toBeLessThan(at('Simple House (simple-house)'))
    expect(at('Simple House (simple-house)')).toBeLessThan(at('Classic Red Car (classic-red-car)'))
    expect(at('Classic Red Car (classic-red-car)')).toBeLessThan(at('Cat Face (cat-face)'))
    expect(all.stdout).toContain('Narrated 44 steps across 4 lessons.')

    // A second run has nothing to do.
    const again = await t.studio('voice narrate --all')
    expect(again.stdout).toContain('Narrated 0 steps across 4 lessons.')

    // A speech server that has gone down fails every lesson, and says so once at the end.
    await tts.close()
    await t.studio(['voice', 'lines', 'set', 'simple-house', 'door', 'A tall door, near the middle.'])
    const broken = await t.studio('voice narrate --all')
    expect(broken.code).toBe(1)
    expect(broken.stderr).toContain('1 lesson failed')
    expect(broken.stderr).toContain('simple-house:')
  })

  it('refuses --all together with a lesson, and a bare narrate without either', async () => {
    const both = await t.studio('voice narrate simple-house --all')
    expect(both.code).toBe(2)
    expect(both.stderr).toContain('Name a lesson or pass --all')

    const neither = await t.studio('voice narrate')
    expect(neither.code).toBe(2)
    expect(neither.stderr).toContain('Pass --all to narrate every lesson')
  })

  it('publishes every complete narration with --all, and says why it skipped the rest', async () => {
    await narrateHouse()
    const all = await t.json<{
      published: { lessonId: string; files: string[] }[]
      skipped: { lessonId: string; reason: string }[]
    }>('voice publish --all')

    expect(all.published.map((lesson) => lesson.lessonId)).toEqual(['simple-house'])
    expect(all.published[0].files).toHaveLength(8)
    expect(all.skipped.map((lesson) => lesson.lessonId)).toEqual(['palm-tree-4', 'classic-red-car', 'cat-face'])
    expect(all.skipped[0].reason).toContain('not complete')
    expect(all.skipped[0].reason).toContain('not yet')

    const printed = await t.studio('voice publish --all')
    expect(printed.stdout).toContain('Published the voice of 1 lesson')
    expect(printed.stdout).toContain('Skipped 3 lessons')
    expect(printed.stdout).toContain('git add -- shared/Assets/Voice/simple-house/chimney.m4a')
  })

  it('lists the spoken lines as a plan, and applies one back', async () => {
    const listed = await t.json<{ lines: Record<string, string | null> }>('voice lines list simple-house')
    expect(listed.lines).toEqual({ 'lesson-intro': null, walls: null, roof: null, door: null, windows: null, chimney: null, 'lesson-outro': null })

    const plan = path.join(t.root, 'lines.json')
    await writeFile(plan, JSON.stringify({ lines: { walls: 'Start with the box, low on the page.', door: null } }))
    const applied = await t.json<LessonNarration>(['voice', 'lines', 'apply', 'simple-house', '--plan', plan])
    expect(applied.steps.find((step) => step.stepId === 'walls')!.spokenLine).toBe('Start with the box, low on the page.')
    expect(applied.steps.find((step) => step.stepId === 'door')!.spokenLine).toBe(null)

    const table = await t.studio('voice lines list simple-house')
    expect(table.stdout).toContain('written line')
    expect(table.stdout).toContain('(instruction)')

    await writeFile(plan, JSON.stringify({ lines: { chimbley: 'Oops.' } }))
    const refused = await t.studio(['voice', 'lines', 'apply', 'simple-house', '--plan', plan])
    expect(refused.code).toBe(1)
    expect(refused.stderr).toContain('"chimbley"')
  })

  it('has a model write the spoken lines, and spends nothing with --dry-run', async () => {
    const dry = await t.json<{ model: string; keyConfigured: boolean; wouldWrite: string[] }>(
      'voice lines generate simple-house --dry-run',
    )
    expect(dry.model).toBe('vendor/text-model')
    expect(dry.keyConfigured).toBe(true)
    expect(dry.wouldWrite).toEqual(['walls', 'roof', 'door', 'windows', 'chimney'])
    expect(modelCalls).toHaveLength(0)

    modelAnswer = {
      rationale: 'Short lines, said while the stroke draws.',
      lines: ['walls', 'roof', 'door', 'windows', 'chimney'].map((id) => ({ id, text: `Say ${id}.` })),
    }
    const written = await t.json<LessonNarration>('voice lines generate simple-house')
    expect(modelCalls).toHaveLength(1)
    expect(written.steps.filter((step) => step.kind === 'step').map((step) => step.spokenLine)).toEqual([
      'Say walls.',
      'Say roof.',
      'Say door.',
      'Say windows.',
      'Say chimney.',
    ])
  })

  it('keeps a frozen voice’s reference in shared/, and puts it back', async () => {
    const take = await t.json<Take>(['voice', 'say', 'lina-bright', 'Hi, I am Lina.'])
    const frozen = await t.json<Voice>(['voice', 'freeze', 'lina-bright', '--take', take.id])
    const exported = await t.studio('voice reference export lina-bright')
    expect(exported.code).toBe(0)
    expect(exported.stdout).toContain('git add -- shared/Assets/VoiceReference/lina-bright.wav')
    expect(existsSync(path.join(t.shared, 'Assets', 'VoiceReference', 'lina-bright.json'))).toBe(true)
    // The app bundles all of Assets/Voice/, so the reference is a sibling of it, not inside it.
    expect(existsSync(path.join(t.shared, 'Assets', 'Voice', 'reference'))).toBe(false)

    tts.addVoiceCalls.length = 0
    const restored = await t.studio('voice reference restore lina-bright')
    expect(restored.code).toBe(0)
    expect(restored.stdout).toContain('Restored Lina, bright (lina-bright)')
    expect(tts.addVoiceCalls[0].name).toBe(frozen.frozen!.referenceName)

    const loose = await t.studio('voice reference export house-chatterbox')
    expect(loose.code).toBe(1)
    expect(loose.stderr).toContain('is not frozen')
  })

  it('lists Lina’s own lines, rewrites one, records them and publishes them', async () => {
    const listed = await t.json<AppNarration>('voice app list')
    expect(listed.lines.map((line) => line.id)).toEqual([...APP_LINE_IDS])
    expect(listed.lines.every((line) => line.stale === 'missing')).toBe(true)

    const printed = await t.studio('voice app list')
    expect(printed.stdout).toContain('Onboarding and Settings: meet the voice')
    expect(printed.stdout).toContain('9 lines, 9 still to make')

    const written = await t.json<AppNarration>(['voice', 'app', 'set', 'lesson-2', 'You did the hard part twice.'])
    expect(written.lines.find((line) => line.id === 'lesson-2')!.text).toBe('You did the hard part twice.')

    const strange = await t.studio(['voice', 'app', 'set', 'lesson-9', 'Nope.'])
    expect(strange.code).toBe(1)
    expect(strange.stderr).toContain('is not one of the app’s lines')

    await t.studio('voice cast house-chatterbox')
    const recorded = await t.studio('voice app narrate')
    expect(recorded.code).toBe(0)
    expect(recorded.stdout).toContain('1 of 9')
    expect(recorded.stdout).toContain('Recorded 9 lines of Lina’s own.')
    expect(tts.speech).toHaveLength(9)

    const again = await t.json<{ recorded: unknown[] }>('voice app narrate')
    expect(again.recorded).toEqual([])

    const published = await t.studio('voice app publish')
    expect(published.code).toBe(0)
    expect(published.stdout).toContain('10 files')
    expect(published.stdout).toContain('git add -- shared/Assets/Voice/app/hello.m4a')

    const manifest = JSON.parse(
      await readFile(path.join(t.shared, 'Assets', 'Voice', 'app', 'manifest.json'), 'utf8'),
    ) as AppVoiceManifest
    expect(Object.keys(manifest.lines)).toEqual([...APP_LINE_IDS])
    expect(manifest.lines['lesson-2'].text).toBe('You did the hard part twice.')

    const removed = await t.studio('voice app unpublish --yes')
    expect(removed.code).toBe(0)
    expect(existsSync(path.join(t.shared, 'Assets', 'Voice', 'app'))).toBe(false)
  })

  it('takes Lina’s own lines along with `publish --all`, and says when it cannot', async () => {
    await narrateHouse()
    const without = await t.studio('voice publish --all')
    expect(without.stdout).toContain('Lina’s own lines were skipped: 9 lines still to make')
    expect(existsSync(path.join(t.shared, 'Assets', 'Voice', 'app'))).toBe(false)

    await t.studio('voice app narrate')
    const with_ = await t.json<{ appLines: boolean; files: string[] }>('voice publish --all')
    expect(with_.appLines).toBe(true)
    expect(with_.files).toContain('shared/Assets/Voice/app/path-4.m4a')
    expect(with_.files).toContain('shared/Assets/Voice/app/manifest.json')
    expect(existsSync(path.join(t.shared, 'Assets', 'Voice', 'app', 'manifest.json'))).toBe(true)
  })

  it('describes itself in the overview and with --help', async () => {
    const overview = await t.studio('')
    expect(overview.stdout).toContain('voice narrate')
    expect(overview.stdout).toContain('voice lines generate')
    expect(overview.stdout).toContain('voice reference export')
    expect(overview.stdout).toContain('voice app narrate')
    const help = await t.studio('voice say --help')
    expect(help.stdout).toContain('--another')
    const lines = await t.studio('voice lines generate --help')
    expect(lines.stdout).toContain('--overwrite')
    expect(lines.stdout).toContain('--dry-run')
  })
})
