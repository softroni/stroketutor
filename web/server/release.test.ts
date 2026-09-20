import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { validateCatalog } from '../src/catalog/validate'
import { validateTutorial } from '../src/schema/validate'
import type { Tutorial } from '../src/schema/types'
import { FIXTURE_SHARED } from '../test/fixture'

import { gitIn, releaseLesson, releaseMessage, type Git } from './release'
import { createRepoWriter } from './repoWriter'
import { fakeConverter, startFakeTts, type FakeTts } from './testing'
import { castVoice, voiceState, type VoiceDeps } from './voice'
import { openWorkspace, type Workspace } from './workspaceStore'

let root: string
let remote: string
let workspace: Workspace
let tts: FakeTts
let deps: VoiceDeps
let git: Git

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'stroketutor-release-'))
  remote = await mkdtemp(path.join(tmpdir(), 'stroketutor-remote-'))
  const shared = path.join(root, 'shared')
  for (const folder of ['Tutorials', 'Catalog', 'Assets']) {
    await cp(path.join(FIXTURE_SHARED, folder), path.join(shared, folder), { recursive: true })
  }
  // A repository on main with the fixture committed, and a bare remote to push to.
  await gitIn(remote)(['init', '--bare', '-b', 'main'])
  git = gitIn(root)
  await git(['init', '-b', 'main'])
  await git(['config', 'user.email', 'studio@example.test'])
  await git(['config', 'user.name', 'Studio Test'])
  await git(['config', 'commit.gpgsign', 'false'])
  await git(['remote', 'add', 'origin', remote])
  await git(['add', '-A'])
  await git(['commit', '-m', 'The fixture'])
  await git(['push', '-u', 'origin', 'main'])

  const writer = createRepoWriter({ sharedDir: shared, validateTutorial, validateCatalog })
  workspace = await openWorkspace({ file: ':memory:', writer, validateTutorial, validateCatalog })
  tts = await startFakeTts()
  deps = { workspace, writer, tts: { url: tts.url, mcpUrl: tts.mcpUrl, convert: fakeConverter().convert } }
})

afterEach(async () => {
  workspace.close()
  await tts.close()
  await rm(root, { recursive: true, force: true })
  await rm(remote, { recursive: true, force: true })
})

/** Rewords the house's first step in the workspace, so there is a lesson change to publish. */
async function rewordHouse() {
  const stored = (await workspace.readTutorial('simple-house'))!
  const tutorial = JSON.parse(stored.text) as Tutorial
  tutorial.steps[0].instruction = 'Draw a big square for the walls.'
  await workspace.writeTutorial('simple-house', tutorial, { etag: stored.etag }, { checkpoint: false })
}

describe('publishing a lesson with everything', () => {
  it('records what Lina has not said, publishes her voice, commits exactly those files and pushes to main', async () => {
    await voiceState(deps)
    castVoice('house-chatterbox', deps)
    await rewordHouse()
    // Something of the creator's own, edited but not the Studio's to commit.
    await writeFile(path.join(root, 'notes.txt'), 'mine')

    const released = await releaseLesson('simple-house', deps, git)

    expect(released.voice).toEqual({ published: true, recorded: 7, note: null })
    expect(released.files).toContain('shared/Tutorials/simple-house.json')
    expect(released.files).toContain('shared/Assets/Voice/simple-house/lesson-intro.m4a')
    expect(released.git).toMatchObject({ committed: true, pushed: true, note: null })
    expect(released.git.subject).toBe('Houses: update Simple House (lesson and voice)')

    const message = await git(['log', '-1', '--format=%B'])
    expect(message).toContain('5 steps.')
    expect(message).toContain('Voice: 7 lines as House voice, 7 recorded for this release.')
    expect(message).toContain('Published from StrokeTutor Studio.')
    expect((await git(['status', '--porcelain'])).trim()).toBe('?? notes.txt')
    expect((await gitIn(remote)(['log', '-1', '--format=%s', 'main'])).trim()).toBe(released.git.subject)
  })

  it('has nothing to commit the second time', async () => {
    await voiceState(deps)
    castVoice('house-chatterbox', deps)
    await releaseLesson('simple-house', deps, git)
    const again = await releaseLesson('simple-house', deps, git)
    expect(again.voice).toEqual({ published: false, recorded: 0, note: null })
    expect(again.git.committed).toBe(false)
    expect(again.git.note).toMatch(/nothing to commit/)
  })

  it('publishes the lesson without a voice when none is cast, and leaves another branch alone', async () => {
    await voiceState(deps)
    await rewordHouse()
    await git(['checkout', '-b', 'experiment'])
    const released = await releaseLesson('simple-house', deps, git)
    expect(released.files).toContain('shared/Tutorials/simple-house.json')
    expect(released.files.some((file) => file.includes('Assets/Voice'))).toBe(false)
    expect(released.voice.note).toMatch(/No voice is cast/)
    expect(released.git).toMatchObject({ committed: false, pushed: false })
    expect(released.git.note).toContain('"experiment", not main')
  })
})

describe('the commit message', () => {
  const about = { lessonId: 'apple', title: 'Apple', pathTitle: 'Fruits', steps: 8 }
  it('says a first publish from an update, and what was touched', () => {
    const first = releaseMessage({ ...about, status: '?? shared/Tutorials/apple.json\n M shared/Catalog/paths.json\n?? shared/Assets/Voice/apple/stem.m4a\n', voice: { name: 'Lina, bright', lines: 10, recorded: 0 } })
    expect(first.subject).toBe('Fruits: publish Apple, with its voice')
    expect(first.body).toContain('8 steps.\nVoice: 10 lines as Lina, bright.\n3 files in shared/.')
    expect(releaseMessage({ ...about, status: ' M shared/Assets/Voice/apple/stem.m4a\n', voice: null }).subject).toBe('Fruits: update Apple (voice)')
    expect(releaseMessage({ ...about, pathTitle: null, status: ' M shared/Tutorials/apple.json\n', voice: null }).subject).toBe('update Apple (lesson)')
    expect(releaseMessage({ ...about, status: ' M shared/Catalog/lessons.json\n', voice: null }).subject).toBe('Fruits: update Apple (curriculum)')
  })
})
