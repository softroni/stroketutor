import path from 'node:path'

import { exportVideo, type VideoDeps, type VideoRequest, type VideoResult } from '../../server/video/render'

import { stringValue } from '../args'
import { command, type Command } from '../command'
import type { Context } from '../context'

/** What the Studio server hands `exportVideo`, from the command line's own workspace and `shared/`. */
export async function videoDeps(ctx: Context): Promise<VideoDeps> {
  const repoDir = path.resolve(ctx.sharedDir, '..')
  return { voice: await ctx.voice(), repoDir, videosDir: path.join(repoDir, '.studio', 'videos') }
}

const minutes = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`

/** A path as short as it can be said: relative when it is under the current folder, absolute otherwise. */
export const shown = (file: string) => {
  const relative = path.relative(process.cwd(), file)
  return relative.startsWith('..') || path.isAbsolute(relative) ? file : relative
}

/** `exportVideo` with its progress as notes, a tenth at a time, and a warning for each out-of-date recording. */
export async function renderVideo(ctx: Context, request: VideoRequest): Promise<VideoResult> {
  let lastTenth = -1
  const result = await exportVideo(request, await videoDeps(ctx), {
    onProgress: (progress) => {
      if (progress.stage === 'frames') {
        const tenth = Math.floor((progress.done / Math.max(1, progress.total)) * 10)
        if (tenth !== lastTenth) ctx.out.note(`Drawing the frames: ${progress.done} of ${progress.total}`)
        lastTenth = tenth
      } else if (progress.stage !== 'done') {
        ctx.out.note(`${progress.message}…`)
      }
    },
  })
  for (const title of result.staleSteps) {
    ctx.out.warn(`“${title}” was recorded before its words last changed; the video uses the recording as it is.`)
  }
  if (result.timingNote) ctx.out.warn(result.timingNote)
  return result
}

/**
 * `lessons video`: the lesson page's Video tab from the terminal, on the same
 * code (server/video/render.ts), so any session can film any lesson.
 */
export const videoCommands: Command[] = [
  command(
    'lessons video',
    'A vertical draw-along video of a lesson (1080 × 1920) for Shorts, TikTok and Reels: Lina’s opening line over the drawing coming together, every step with her recording, and Paper Coach with the App Store badge at the end.',
    ['<id>'],
    {
      out: { type: 'string', description: 'Where to write the video (default .studio/videos/<id>.mp4). A caption to post with it goes beside it as .txt.', placeholder: 'file.mp4' },
      intro: { type: 'string', description: 'Lina’s opening line (default “Let’s draw a <lesson>. Grab a pencil and draw along with me.”). Spoken through the Studio in her cast voice, and reused once made.', placeholder: 'words' },
      cta: { type: 'string', description: 'The line under Paper Coach at the end (default “Free · link in bio” beside the App Store badge).', placeholder: 'words' },
      stills: { type: 'string', description: 'Write PNG frames into this folder instead of the video (the opening, a line being drawn, a colour going in, the ending), to check the look in seconds.', placeholder: 'dir' },
    },
    async (ctx, args) => {
      const result = await renderVideo(ctx, {
        lessonId: args.positionals[0],
        intro: stringValue(args.values, 'intro') ?? null,
        cta: stringValue(args.values, 'cta') ?? null,
        out: stringValue(args.values, 'out') ?? null,
        stillsDir: stringValue(args.values, 'stills') ?? null,
      })
      ctx.out.result(result, (data: VideoResult) =>
        data.file
          ? [
              `Wrote ${shown(data.file)} (${minutes(data.durationS)}, ${(data.bytes / 1e6).toFixed(1)} MB) in ${minutes(data.renderSeconds)}: ${data.frames} frames, ${data.stillFrames} of them still.`,
              `The post caption is beside it: ${shown(data.captionFile ?? '')}`,
            ]
          : [`Wrote ${data.stills.length} stills of a ${minutes(data.durationS)} video:`, ...data.stills.map((file) => `  ${shown(file)}`)],
      )
    },
  ),
]
