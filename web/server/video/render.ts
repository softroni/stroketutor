import { execFile, spawn } from 'node:child_process'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { availableParallelism, tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import type { Browser, Page } from 'playwright'

import { colorOfPath, PATH_SWATCHES } from '../../src/catalog/pathColors'
import type { LessonsFile, PathsFile } from '../../src/catalog/types'
import type { Tutorial } from '../../src/schema/types'
import { INTRO_ID, OUTRO_ID } from '../../src/voice/bookends'
import type { VideoDefaults, VideoProgress, VideoResult, VideoStage } from '../../src/video/types'
import type { StepNarration } from '../../src/voice/types'
import { WriteRefused } from '../repoWriter'
import { FREE_LESSONS_PER_PATH } from '../social/posts'
import { lessonNarration, readTakeAudio, say, type VoiceDeps } from '../voice'

import { FRAME, videoPage } from './page'
import {
  DEFAULT_CTA,
  DEFAULT_CTA_WITH_BADGE,
  SIGNOFF_ID,
  defaultIntro,
  defaultSignoff,
  planVideo,
  postCaption,
  stickerLessons,
  stillMoments,
  type Clip,
  type VideoInput,
  type VideoPlan,
} from './plan'
import { alignWords, hearRecordings } from './words'

/**
 * A lesson as a vertical draw-along video (1080 × 1920, 30 fps, H.264 and
 * AAC), for YouTube Shorts, TikTok and Instagram Reels. One function behind
 * both `studio lessons video` and the lesson page's Video tab.
 *
 * It uses the lesson as it stands in the workspace and Lina's recordings as
 * the Voice section has them, so a draft can be filmed as well as a published
 * lesson. Her opening line and her last words are spoken through the Studio
 * like any other take, so the same words cost nothing the second time; the
 * last words are the same for every free lesson, so they are made only once.
 *
 * Frames are screenshots of `page.ts` in headless Chromium, drawn at twice the
 * size and scaled down with Lanczos, so lines and text come out smooth. Whisper
 * says when Lina says each word, for the captions (`words.ts`). Her
 * recordings are placed at their moments, the two lines made here are matched
 * to the loudness of her step recordings, and the mix is normalised to -14
 * LUFS, where the platforms play everything.
 */

export interface VideoDeps {
  voice: VoiceDeps
  /** The repository root: the font, the app icon and the App Store badge are read from it. */
  repoDir: string
  /** Where a video goes unless the request names a file: `.studio/videos`. */
  videosDir: string
}

export interface VideoRequest {
  lessonId: string
  /** Lina's opening line; the default says "Let's draw …". */
  intro?: string | null
  /** Lina's last words, as Paper Coach takes her place; the default says where to find it, and an empty string leaves them out. */
  signoff?: string | null
  /** The line under Paper Coach at the end. */
  cta?: string | null
  /** The video file; `<videosDir>/<lesson>.mp4` when absent. The post caption goes beside it as `.txt`. */
  out?: string | null
  /** Instead of the video, write a few PNG frames here: the opening, a line, a colour, the ending. */
  stillsDir?: string | null
}

export type { VideoDefaults, VideoProgress, VideoResult, VideoStage }

export const FPS = 30
/** Frames are drawn at this multiple of 1080 × 1920 and scaled down. */
const SCALE = 2
const BADGE = 'docs/app-store/marketing/assets/badges/download-on-the-app-store-black.svg'
const FONT = 'docs/app-store/marketing/assets/fonts/Fredoka.ttf'
const ICON = 'PaperCoach/Assets.xcassets/AppIcon.appiconset/AppIcon.png'
/** The lessons' illustrations, the App Store screenshots' stickers. */
const REFERENCES = 'shared/Assets/References'

export function videoFile(lessonId: string, deps: Pick<VideoDeps, 'videosDir'>): string {
  return path.join(deps.videosDir, `${lessonId}.mp4`)
}

export async function videoDefaults(lessonId: string, deps: VideoDeps): Promise<VideoDefaults> {
  const tutorial = await readTutorial(lessonId, deps)
  const narration = await lessonNarration(lessonId, deps.voice)
  const badge = existsSync(path.join(deps.repoDir, BADGE))
  const file = videoFile(lessonId, deps)
  const info = await stat(file).catch(() => null)
  const { place, free } = await placeOf(lessonId, deps)
  return {
    lessonId,
    title: tutorial.title,
    intro: defaultIntro(tutorial.title),
    signoff: defaultSignoff(free),
    cta: badge ? DEFAULT_CTA_WITH_BADGE : DEFAULT_CTA,
    badge,
    missing: missingSteps(narration.steps),
    stale: staleSteps(narration.steps),
    caption: postCaption(tutorial, place),
    video: info ? { file, bytes: info.size, modifiedAt: info.mtime.toISOString() } : null,
  }
}

export async function exportVideo(
  request: VideoRequest,
  deps: VideoDeps,
  { onProgress = () => undefined, signal }: { onProgress?: (progress: VideoProgress) => void; signal?: AbortSignal } = {},
): Promise<VideoResult> {
  const { lessonId } = request
  const started = Date.now()
  const elapsed = () => Math.round((Date.now() - started) / 100) / 10
  const report = (stage: VideoStage, message: string, done = 0, total = 0) => onProgress({ stage, done, total, message })
  const stopIfAsked = () => {
    if (signal?.aborted) throw new WriteRefused(409, 'The video was stopped.')
  }

  report('preparing', 'Reading the lesson and Lina’s recordings')
  const tutorial = await readTutorial(lessonId, deps)
  const narration = await lessonNarration(lessonId, deps.voice)
  const missing = missingSteps(narration.steps)
  if (missing.length > 0) {
    throw new WriteRefused(
      409,
      `Lina hasn’t recorded ${missing.length === 1 ? 'this step' : 'these steps'} of “${tutorial.title}” yet: ${missing.join(', ')}. ` +
        `Record them in the lesson’s Voice section, or with \`studio voice narrate ${lessonId}\`, then make the video.`,
    )
  }
  const ffmpegCheck = await run('ffmpeg', ['-version']).catch((error: unknown) => error)
  if (ffmpegCheck instanceof Error) throw new WriteRefused(500, `Making a video needs ffmpeg (brew install ffmpeg). ${ffmpegCheck.message}`)

  const work = await mkdtemp(path.join(tmpdir(), 'papercoach-video-'))
  try {
    // Every recording in a file ffmpeg can read, with its exact length.
    report('voice', 'Recording Lina’s opening line and last words')
    const { place, backdrop, free, stickers } = await placeOf(lessonId, deps)
    const introText = request.intro?.trim() || defaultIntro(tutorial.title)
    const signoffText = request.signoff == null ? defaultSignoff(free) : request.signoff.trim()
    const voiceId = narration.castVoiceId ?? narration.steps.find((step) => step.take)?.take?.voiceId
    if (!voiceId) throw new WriteRefused(409, 'No voice is cast as Lina, so her opening line can’t be spoken. Cast one on the Voice page.')
    const speak = async (text: string, what: string) => {
      try {
        return (await say(voiceId, text, {}, deps.voice)).id
      } catch (error) {
        throw new WriteRefused(
          502,
          `${what} couldn’t be recorded: ${error instanceof Error ? error.message : String(error)} Her speech server runs on the creator’s Mac; once a line has been made, it is reused without it.`,
        )
      }
    }
    const introTakeId = await speak(introText, 'Lina’s opening line')
    const signoffTakeId = signoffText ? await speak(signoffText, 'Lina’s last words') : null
    stopIfAsked()

    const files = new Map<string, string>()
    const takeIds = new Map<string, string>()
    const clips: Record<string, Clip> = {}
    const writeTake = async (key: string, takeId: string, text: string) => {
      const audio = readTakeAudio(takeId, deps.voice)
      if (!audio) throw new WriteRefused(500, `The recording for “${key}” is missing from the workspace.`)
      const file = path.join(work, `${key}${audio.contentType.includes('wav') ? '.wav' : '.m4a'}`)
      await writeFile(file, audio.bytes)
      files.set(key, file)
      takeIds.set(key, takeId)
      return { text, durationS: await durationOf(file) }
    }
    let intro: Clip = await writeTake('intro', introTakeId, introText)
    let signoff: Clip | null = signoffTakeId ? await writeTake(SIGNOFF_ID, signoffTakeId, signoffText) : null
    for (const step of narration.steps) {
      if (step.stepId === INTRO_ID || !step.take) continue
      clips[step.stepId] = await writeTake(step.stepId, step.take.id, step.take.text)
    }

    // When she says each word, for the captions: heard once per recording, then remembered.
    report('voice', 'Listening for when Lina says each word')
    const { heard, problem } = await hearRecordings(
      [...takeIds].map(([key, takeId]) => ({ takeId, file: files.get(key)! })),
      { cacheDir: path.join(deps.videosDir, 'words'), work },
    )
    let estimated = 0
    const timed = (key: string, clip: Clip): Clip => {
      const words = heard.get(takeIds.get(key)!)
      const aligned = words ? alignWords(clip.text, words, clip.durationS) : null
      if (!aligned) estimated += 1
      return aligned ? { ...clip, words: aligned } : clip
    }
    intro = timed('intro', intro)
    if (signoff) signoff = timed(SIGNOFF_ID, signoff)
    for (const key of Object.keys(clips)) clips[key] = timed(key, clips[key])
    const timingNote = estimated === 0 ? null : (problem ?? `The captions’ word timing is estimated for ${estimated} of Lina’s recordings, which Whisper heard differently.`)
    stopIfAsked()

    const badgePath = path.join(deps.repoDir, BADGE)
    const badge = existsSync(badgePath) ? await readFile(badgePath, 'utf8') : null
    const cta = request.cta?.trim() || (badge ? DEFAULT_CTA_WITH_BADGE : DEFAULT_CTA)
    const input: VideoInput = { tutorial, clips, intro, signoff, place, cta, stickers: stickers.length }
    const plan = planVideo(input)
    const html = videoPage(tutorial, plan, {
      font: (await readAsset(deps.repoDir, FONT)).toString('base64'),
      icon: (await readAsset(deps.repoDir, ICON)).toString('base64'),
      badge,
      stickers: await Promise.all(stickers.map((file) => readFile(file, 'utf8'))),
    }, backdrop)
    const pagePath = path.join(work, 'page.html')
    await writeFile(pagePath, html)
    const caption = postCaption(tutorial, place)
    const frames = Math.ceil(plan.total * FPS)
    const stale = staleSteps(narration.steps)

    if (request.stillsDir) {
      const browser = await launchChromium()
      try {
        const page = await openFramePage(browser, pagePath)
        await mkdir(request.stillsDir, { recursive: true })
        const stills: string[] = []
        for (const moment of stillMoments(plan, tutorial)) {
          await renderAt(page, moment.at)
          const file = path.join(request.stillsDir, `${lessonId}-${moment.name}.png`)
          await page.screenshot({ path: file })
          stills.push(file)
        }
        report('done', 'Stills written')
        return { lessonId, file: null, captionFile: null, caption, stills, durationS: plan.total, frames, stillFrames: 0, renderSeconds: elapsed(), bytes: 0, staleSteps: stale, timingNote }
      } finally {
        await browser.close()
      }
    }

    const silent = path.join(work, 'video.mp4')
    const { stillFrames } = await drawFrames(pagePath, frames, silent, work, {
      onFrames: (done) => report('frames', 'Drawing the frames', done, frames),
      stopIfAsked,
    })
    stopIfAsked()

    report('audio', 'Mixing Lina’s voice')
    const mixed = path.join(work, 'audio.m4a')
    await mixAudio(plan, files, mixed)

    // Written beside the old video and renamed over it, so a failed export never leaves half a file.
    const out = path.resolve(request.out ?? videoFile(lessonId, deps))
    await mkdir(path.dirname(out), { recursive: true })
    const partial = `${out}.partial.mp4`
    await run('ffmpeg', [
      '-y', '-loglevel', 'error', '-i', silent, '-i', mixed, '-c:v', 'copy', '-c:a', 'copy',
      // x264 records only the colour matrix; this adds BT.709 primaries and transfer, so no platform shifts the path's colour.
      '-bsf:v', 'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0',
      '-shortest', '-movflags', '+faststart', partial,
    ])
    await rename(partial, out)
    const captionFile = out.replace(/\.mp4$/i, '') + '.txt'
    await writeFile(captionFile, `${caption}\n`)
    const { size } = await stat(out)
    report('done', 'Done')
    return { lessonId, file: out, captionFile, caption, stills: [], durationS: plan.total, frames, stillFrames, renderSeconds: elapsed(), bytes: size, staleSteps: stale, timingNote }
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}

// ---------- Pieces ----------

async function readTutorial(lessonId: string, deps: VideoDeps): Promise<Tutorial> {
  const stored = await deps.voice.workspace.readTutorial(lessonId)
  if (!stored) throw new WriteRefused(404, `There is no lesson "${lessonId}".`)
  return JSON.parse(stored.text) as Tutorial
}

interface Place {
  place: VideoInput['place']
  /** The deep shade of the path's color; none outside every path. */
  backdrop?: string
  /** Whether the app gives the lesson away: one of the first lessons of its path. */
  free: boolean
  /** The illustrations of the lessons whose stickers land round it at the end, as files. */
  stickers: string[]
}

/**
 * Which path the lesson is in and where, from the working curriculum, the
 * backdrop that path's color gives the video, whether the lesson is free, and
 * its stickers: the lessons `stickerLessons` picks among the published ones
 * whose illustration is an SVG, which is what a die-cut sticker needs.
 */
async function placeOf(lessonId: string, deps: VideoDeps): Promise<Place> {
  try {
    const catalog = await deps.voice.workspace.readCatalog()
    const { paths } = JSON.parse(catalog.paths.text) as PathsFile
    const { lessons } = JSON.parse(catalog.lessons.text) as LessonsFile
    const art = new Map(
      lessons.flatMap((lesson) => {
        const file = lesson.reference?.file
        const published = existsSync(path.join(deps.repoDir, 'shared', 'Tutorials', `${lesson.id}.json`))
        return file?.endsWith('.svg') && published ? [[lesson.id, path.join(deps.repoDir, REFERENCES, file)] as const] : []
      }),
    )
    const stickers = stickerLessons(paths, lessonId, (id) => existsSync(art.get(id) ?? '')).map((id) => art.get(id)!)
    const found = paths.find((entry) => entry.lessonIds.includes(lessonId))
    if (!found) return { place: null, free: false, stickers }
    const index = found.lessonIds.indexOf(lessonId)
    return {
      place: { pathTitle: found.title, number: index + 1, count: found.lessonIds.length },
      backdrop: PATH_SWATCHES[colorOfPath(paths, found.id)].deep,
      free: index < FREE_LESSONS_PER_PATH,
      stickers,
    }
  } catch {
    return { place: null, free: false, stickers: [] }
  }
}

/** The steps a video can't be made without: every real step, and the closing line. The opening is the video's own. */
function missingSteps(steps: StepNarration[]): string[] {
  return steps.filter((step) => step.stepId !== INTRO_ID && !step.take).map((step) => (step.stepId === OUTRO_ID ? 'the closing line' : step.title))
}

function staleSteps(steps: StepNarration[]): string[] {
  return steps.filter((step) => step.stepId !== INTRO_ID && step.take && step.stale === 'text-changed').map((step) => step.title)
}

async function readAsset(repoDir: string, relative: string): Promise<Buffer> {
  try {
    return await readFile(path.join(repoDir, relative))
  } catch {
    throw new WriteRefused(500, `The video needs ${relative} from the repository, and it isn’t there.`)
  }
}

/**
 * Chromium for the frames: STUDIO_CHROMIUM if set, else Playwright's own
 * download, else the Google Chrome installed on the Mac.
 */
async function launchChromium(): Promise<Browser> {
  let playwright: typeof import('playwright')
  try {
    playwright = await import('playwright')
  } catch {
    throw new WriteRefused(500, 'Making a video needs Playwright: run `npm install` in web/.')
  }
  const override = process.env.STUDIO_CHROMIUM
  const bundled = playwright.chromium.executablePath()
  try {
    if (override) return await playwright.chromium.launch({ headless: true, executablePath: override })
    if (existsSync(bundled)) return await playwright.chromium.launch({ headless: true, executablePath: bundled })
    return await playwright.chromium.launch({ headless: true, channel: 'chrome' })
  } catch (error) {
    throw new WriteRefused(
      500,
      `Chromium could not be started for the frames. Install Google Chrome, run \`npx playwright install chromium\`, or set STUDIO_CHROMIUM. ${error instanceof Error ? error.message.split('\n')[0] : ''}`,
    )
  }
}

async function openFramePage(browser: Browser, pagePath: string): Promise<Page> {
  const page = await browser.newPage({ viewport: FRAME, deviceScaleFactor: SCALE })
  await page.goto(`file://${pagePath}`)
  await page.evaluate(() => document.fonts.ready)
  return page
}

/** Sets the page for `t` seconds in; the answer is a signature of what is on screen. */
function renderAt(page: Page, t: number): Promise<string> {
  return page.evaluate((at) => (window as unknown as { renderAt(t: number): string }).renderAt(at), t)
}

/** How many Chromiums draw frames at once: STUDIO_VIDEO_WORKERS, or half the cores up to four. */
function workerCount(frames: number): number {
  const asked = Number(process.env.STUDIO_VIDEO_WORKERS)
  const wanted = Number.isInteger(asked) && asked > 0 ? asked : Math.min(4, Math.max(1, Math.floor(availableParallelism() / 2)))
  // A part shorter than a few seconds costs more to start than it saves.
  return Math.max(1, Math.min(wanted, Math.floor(frames / 90)))
}

/**
 * Every frame of the video, into `out` (H.264, no sound). The frames are cut
 * into as many runs as there are workers; each run has its own Chromium and its
 * own encoder, and the parts are joined without re-encoding. A frame whose
 * signature matches the one before it (a pause, Lina still talking after the
 * line is drawn) reuses that frame's picture instead of taking a new one.
 */
async function drawFrames(
  pagePath: string,
  frames: number,
  out: string,
  work: string,
  { onFrames, stopIfAsked }: { onFrames: (done: number) => void; stopIfAsked: () => void },
): Promise<{ stillFrames: number }> {
  const workers = workerCount(frames)
  const size = Math.ceil(frames / workers)
  const runs = Array.from({ length: workers }, (_, index) => ({ from: index * size, to: Math.min(frames, (index + 1) * size) })).filter(
    (range) => range.to > range.from,
  )
  const done = runs.map(() => 0)
  let stillFrames = 0
  let failure: unknown = null
  let lastReport = 0
  const tell = () => {
    const now = Date.now()
    if (now - lastReport < 250) return
    lastReport = now
    onFrames(done.reduce((sum, count) => sum + count, 0))
  }

  const parts = runs.map((_, index) => path.join(work, `part-${index}.mp4`))
  const outcomes = await Promise.allSettled(
    runs.map(async ({ from, to }, index) => {
      const browser = await launchChromium()
      const encoder = startEncoder(parts[index])
      try {
        const page = await openFramePage(browser, pagePath)
        let lastSignature: string | null = null
        let lastPicture: Buffer | null = null
        for (let frame = from; frame < to; frame += 1) {
          stopIfAsked()
          if (failure) throw failure
          const signature = await renderAt(page, frame / FPS)
          if (signature !== lastSignature || !lastPicture) {
            lastPicture = await page.screenshot({ type: 'jpeg', quality: 95 })
            lastSignature = signature
          } else {
            stillFrames += 1
          }
          await encoder.write(lastPicture)
          done[index] = frame - from + 1
          tell()
        }
        await encoder.finish()
      } catch (error) {
        failure ??= error
        encoder.kill()
        throw error
      } finally {
        await browser.close()
      }
    }),
  )
  const failed = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected')
  if (failed) throw failure ?? failed.reason
  onFrames(frames)

  if (parts.length === 1) {
    await rename(parts[0], out)
  } else {
    const list = path.join(work, 'parts.txt')
    await writeFile(list, parts.map((part) => `file '${part.replace(/'/g, `'\\''`)}'`).join('\n'))
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out])
  }
  return { stillFrames }
}

/**
 * One encoder, fed JPEG frames on its input: Lanczos down to 1080 × 1920 in
 * BT.709, then x264 tuned for flat artwork, at a quality high enough that the
 * platforms' own re-encode starts from a clean copy.
 */
function startEncoder(file: string) {
  const child = spawn(
    'ffmpeg',
    [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-vf', `scale=${FRAME.width}:${FRAME.height}:flags=lanczos+accurate_rnd+full_chroma_int:out_color_matrix=bt709:out_range=tv,format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '15', '-profile:v', 'high',
      '-r', String(FPS), file,
    ],
    { stdio: ['pipe', 'ignore', 'pipe'] },
  )
  let log = ''
  child.stderr.on('data', (chunk: Buffer) => (log += chunk.toString()))
  const closed = new Promise<void>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg stopped (${code}). ${log.trim()}`))))
  })
  closed.catch(() => undefined)
  return {
    async write(picture: Buffer) {
      if (!child.stdin.write(picture)) await once(child.stdin, 'drain')
    },
    async finish() {
      child.stdin.end()
      await closed
    },
    kill() {
      child.kill('SIGKILL')
    },
  }
}

/**
 * Lina's recordings, each at its moment. Her opening line and last words are
 * made fresh and can come out louder or softer than the published steps, so
 * they are brought to the steps' loudness first; then the whole mix goes to
 * -14 LUFS with a -1.5 dB true-peak ceiling.
 */
async function mixAudio(plan: VideoPlan, files: Map<string, string>, out: string) {
  const fresh = ['intro', SIGNOFF_ID]
  const cues = plan.cues.filter((cue) => files.has(cue.key))
  const steps = cues.filter((cue) => !fresh.includes(cue.key)).slice(0, 4)
  const target = steps.length > 0 ? average(await Promise.all(steps.map((cue) => loudnessOf(files.get(cue.key)!)))) : Number.NaN
  const gains = new Map<string, number>()
  for (const key of fresh.filter((name) => Number.isFinite(target) && files.has(name))) {
    const loudness = await loudnessOf(files.get(key)!)
    if (Number.isFinite(loudness)) gains.set(key, Math.max(-12, Math.min(12, target - loudness)))
  }
  const total = plan.total.toFixed(3)
  const inputs = cues.flatMap((cue) => ['-i', files.get(cue.key)!])
  const chains = cues.map(
    (cue, index) => `[${index}:a]aresample=48000,volume=${(gains.get(cue.key) ?? 0).toFixed(2)}dB,adelay=${Math.round(cue.at * 1000)}:all=1[a${index}]`,
  )
  const filter =
    cues.length > 0
      ? `${chains.join(';')};${cues.map((_, index) => `[a${index}]`).join('')}amix=inputs=${cues.length}:normalize=0:duration=longest,` +
        `apad=whole_dur=${total},atrim=0:${total},loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[out]`
      : `anullsrc=r=48000:cl=stereo,atrim=0:${total}[out]`
  await run('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filter, '-map', '[out]', '-ac', '2', '-c:a', 'aac', '-b:a', '192k', out])
}

const execFileAsync = promisify(execFile)

async function run(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync(command, args, { maxBuffer: 64 * 1024 * 1024 })
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stderr?: string }
    if (failure.code === 'ENOENT') throw new Error(`${command} is not installed.`)
    throw new Error(`${command} failed: ${(failure.stderr ?? failure.message).trim()}`)
  }
}

async function durationOf(file: string): Promise<number> {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])
  const seconds = Number(stdout.trim())
  if (!Number.isFinite(seconds)) throw new WriteRefused(500, `Could not read how long ${path.basename(file)} is.`)
  return seconds
}

/** Integrated loudness in LUFS, from the summary ffmpeg's EBU R128 filter prints last. */
async function loudnessOf(file: string): Promise<number> {
  const { stderr } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128', '-f', 'null', '-'])
  const values = [...stderr.matchAll(/^\s+I:\s+(-?[\d.]+) LUFS/gm)]
  return values.length > 0 ? Number(values[values.length - 1][1]) : Number.NaN
}

const average = (values: number[]) => {
  const finite = values.filter(Number.isFinite)
  return finite.length > 0 ? finite.reduce((sum, value) => sum + value, 0) / finite.length : Number.NaN
}
