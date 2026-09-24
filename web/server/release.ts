import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { bookendKind } from '../src/voice/bookends'

import { lessonNarration, narrateStep, publishVoice, type VoiceDeps } from './voice'

/** Runs git in the repository and answers with what it printed; throws with git's own words when it fails. */
export type Git = (args: string[]) => Promise<string>

const run = promisify(execFile)

export function gitIn(directory: string): Git {
  return async (args) => {
    try {
      const { stdout } = await run('git', args, { cwd: directory, maxBuffer: 8 * 1024 * 1024 })
      return stdout
    } catch (error) {
      const failed = error as { stderr?: string; message: string }
      throw new Error((failed.stderr || failed.message).trim())
    }
  }
}

export interface ReleaseResult {
  /** Everything in shared/ this release wrote or removed. */
  files: string[]
  voice: { published: boolean; recorded: number; note: string | null }
  git: { committed: boolean; pushed: boolean; commit: string | null; subject: string | null; note: string | null }
}

/**
 * The lesson page's Publish: the lesson, its voice, and the commit, in one go
 * (the creator, 2026-09-20: "publish everything including voice", then "a
 * dynamic git commit on publish and push to main").
 *
 * In order, each step only if the one before it held:
 *  1. the lesson and the curriculum into shared/, as Publish always did;
 *  2. whatever Lina has not said yet, or said in old words, is recorded, and
 *     her voice goes into shared/Assets/Voice/ beside the lesson;
 *  3. exactly the files written are committed, under a message that says what
 *     changed, and pushed to main.
 * A lesson is never held back by its voice or by git: no cast voice, a speech
 * server that is down, a branch other than main or a refused push are each
 * reported in words, and what was done before them stays done.
 */
export async function releaseLesson(lessonId: string, deps: VoiceDeps, git: Git | null): Promise<ReleaseResult> {
  const written = await deps.workspace.publish([lessonId])
  const files = new Set(written.files)

  const voice: ReleaseResult['voice'] = { published: false, recorded: 0, note: null }
  let voiceName: string | null = null
  let lines = 0
  try {
    let narration = await lessonNarration(lessonId, deps)
    if (!narration.castVoiceId) {
      voice.note = 'No voice is cast as Lina, so the lesson went out without one.'
    } else {
      for (const part of narration.steps.filter((candidate) => candidate.stale !== null)) {
        narration = await narrateStep(lessonId, { stepId: part.stepId }, deps)
        voice.recorded += 1
      }
      if (!narration.published || narration.published.behind || voice.recorded > 0) {
        for (const file of (await publishVoice(lessonId, deps)).files) files.add(file)
        voice.published = true
      }
      voiceName = narration.castVoiceId ? (deps.workspace.readVoice(narration.castVoiceId)?.name ?? null) : null
      lines = narration.steps.length
    }
  } catch (error) {
    voice.note = `The voice was not published: ${error instanceof Error ? error.message : String(error)}`
  }

  const result: ReleaseResult = {
    files: [...files].sort(),
    voice,
    git: { committed: false, pushed: false, commit: null, subject: null, note: null },
  }
  if (!git) {
    result.git.note = 'This copy is not a git repository, so nothing was committed.'
    return result
  }
  if (result.files.length === 0) {
    result.git.note = 'Nothing in shared/ changed, so there was nothing to commit.'
    return result
  }

  try {
    const branch = (await git(['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
    if (branch !== 'main') {
      result.git.note = `The repository is on "${branch}", not main, so the files were left for you to commit.`
      return result
    }
    const status = await git(['status', '--porcelain', '--', ...result.files])
    if (!status.trim()) {
      result.git.note = 'shared/ already matched the last commit, so there was nothing to commit.'
      return result
    }
    const narration = await lessonNarration(lessonId, deps).catch(() => null)
    const { subject, body } = releaseMessage({
      lessonId,
      title: narration?.title ?? lessonId,
      pathTitle: await pathTitleOf(lessonId, deps),
      status,
      steps: narration ? narration.steps.filter((part) => bookendKind(part.stepId) === null).length : null,
      voice: voice.published && voiceName ? { name: voiceName, lines, recorded: voice.recorded } : null,
    })
    await git(['add', '-A', '--', ...result.files])
    // Only these paths: whatever else is staged or edited in the working tree is not the Studio's to commit.
    await git(['commit', '-m', subject, '-m', body, '--', ...result.files])
    result.git.committed = true
    result.git.subject = subject
    result.git.commit = (await git(['rev-parse', '--short', 'HEAD'])).trim()
  } catch (error) {
    result.git.note = `The commit failed: ${error instanceof Error ? error.message : String(error)}`
    return result
  }
  try {
    await git(['push', 'origin', 'main'])
    result.git.pushed = true
  } catch (error) {
    result.git.note = `Committed, but the push failed: ${error instanceof Error ? error.message : String(error)}`
  }
  return result
}

async function pathTitleOf(lessonId: string, deps: VoiceDeps): Promise<string | null> {
  try {
    const library = await deps.workspace.readLibrary()
    if (!library.paths) return null
    const paths = JSON.parse(library.paths.text) as { paths?: { title: string; lessonIds?: string[] }[] }
    return paths.paths?.find((path) => path.lessonIds?.includes(lessonId))?.title ?? null
  } catch {
    return null
  }
}

/**
 * The commit's words, from what git says changed: "Fruits: publish Apple, with
 * its voice" the first time, "Fruits: update Apple (voice)" after a new take.
 */
export function releaseMessage(input: {
  lessonId: string
  title: string
  pathTitle: string | null
  /** `git status --porcelain` over the released files. */
  status: string
  steps: number | null
  voice: { name: string; lines: number; recorded: number } | null
}): { subject: string; body: string } {
  const changed = input.status
    .split('\n')
    .filter(Boolean)
    .map((line) => ({ code: line.slice(0, 2), file: line.slice(3).replace(/^"|"$/g, '') }))
  const tutorial = changed.find((entry) => entry.file === `shared/Tutorials/${input.lessonId}.json`)
  const isNew = tutorial ? tutorial.code.includes('?') || tutorial.code.includes('A') : false
  const touched = {
    lesson: Boolean(tutorial) || changed.some((entry) => entry.file.startsWith('shared/Assets/References/')),
    voice: changed.some((entry) => entry.file.startsWith('shared/Assets/Voice/')),
    curriculum: changed.some((entry) => entry.file.startsWith('shared/Catalog/')),
  }
  const where = input.pathTitle ? `${input.pathTitle}: ` : ''
  let subject: string
  if (isNew) {
    subject = `${where}publish ${input.title}${touched.voice ? ', with its voice' : ''}`
  } else {
    const parts = [touched.lesson ? 'lesson' : '', touched.voice ? 'voice' : '', !touched.lesson && !touched.voice && touched.curriculum ? 'curriculum' : ''].filter(Boolean)
    subject = `${where}update ${input.title}${parts.length > 0 ? ` (${parts.join(' and ')})` : ''}`
  }
  const body = [
    input.steps !== null ? `${input.steps} ${input.steps === 1 ? 'step' : 'steps'}.` : '',
    input.voice
      ? `Voice: ${input.voice.lines} lines as ${input.voice.name}${input.voice.recorded > 0 ? `, ${input.voice.recorded} recorded for this release` : ''}.`
      : '',
    `${changed.length} ${changed.length === 1 ? 'file' : 'files'} in shared/.`,
    '',
    'Published from Paper Coach Studio.',
  ]
    .filter((line, index, all) => line !== '' || (index > 0 && all[index - 1] !== ''))
    .join('\n')
  return { subject, body }
}
