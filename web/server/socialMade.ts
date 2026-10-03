import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { MadeVideo } from '../src/studio/social'

import { FINAL_STATUSES, postedLessons, postStates, type SocialRecord } from './social/posts'

/** Where the Video tab and `lessons video` keep lesson videos, under .studio. */
const LESSON_VIDEOS = 'videos'

/**
 * The videos made on this Mac that haven't gone out yet, for the Social page,
 * newest first:
 *
 * - 16:9 videos made to be posted as they are (`social announce --wide
 *   --video`): a version's what's-new video, an overview, a long video. Each is
 *   a project of its own under .studio with its renders in `out/`
 *   (`.studio/whats-new-1.1/out/paper-coach-whats-new-1.1.mp4`), and a
 *   `thumbnail.jpg` or `.png` beside them is its poster. One counts as posted
 *   once a post names its file (`video` in the record, from 2026-10-03), or,
 *   for a post from before then, once a 16:9 post went out after it was made.
 * - Lesson videos and speed draws (`.studio/videos/<id>.mp4`,
 *   `<id>-speed.mp4`) of lessons not posted yet. The daily post renders a
 *   lesson's video again at 17:00, so these are a preview, not the file that
 *   goes out.
 *
 * A test post, a refused one, or one that failed on every platform posted
 * nothing, and an unlisted YouTube video hasn't gone out until it is made
 * public. A folder that can't be read is no videos, not an error.
 */
export async function readMadeVideos(
  studioDir: string,
  records: SocialRecord[],
  title: (lessonId: string) => string | undefined = () => undefined,
): Promise<MadeVideo[]> {
  const went = postStates(records)
    .filter(({ post }) => !post.private && !post.unlisted && post.outcome !== 'refused')
    .filter(({ status }) => !(status && FINAL_STATUSES.has(status.status) && !Object.values(status.results).some((result) => result.success)))
    .map(({ post }) => post)
  const lessons = postedLessons(records)

  const made: MadeVideo[] = []
  for (const folder of await folders(studioDir)) {
    if (folder === LESSON_VIDEOS) continue
    const out = path.join(studioDir, folder, 'out')
    const names = await files(out)
    const videos = names.filter((name) => name.endsWith('.mp4'))
    const poster = ['thumbnail.jpg', 'thumbnail.jpeg', 'thumbnail.png'].find((name) => names.includes(name))
    for (const name of videos) {
      const file = path.join(out, name)
      const info = await fs.stat(file).catch(() => null)
      if (!info?.isFile()) continue
      const posted = went.some((post) =>
        post.video ? path.resolve(post.video) === file : post.media === 'wide' && Date.parse(post.at) > info.mtimeMs,
      )
      if (posted) continue
      made.push({
        id: `${folder}/out/${name}`,
        kind: 'wide',
        title: projectTitle(folder) + (videos.length > 1 ? ` (${name.replace(/\.mp4$/, '')})` : ''),
        madeAt: info.mtime.toISOString(),
        bytes: info.size,
        ...(poster ? { poster: `${folder}/out/${poster}` } : {}),
      })
    }
  }

  for (const name of await files(path.join(studioDir, LESSON_VIDEOS))) {
    const match = /^(.+?)(-speed)?\.mp4$/.exec(name)
    if (!match) continue
    const [, lessonId, speed] = match
    const posted = speed
      ? went.some((post) => post.lessonId === lessonId && post.media === 'speed')
      : lessons.has(lessonId)
    if (posted) continue
    const info = await fs.stat(path.join(studioDir, LESSON_VIDEOS, name)).catch(() => null)
    if (!info?.isFile()) continue
    made.push({
      id: `${LESSON_VIDEOS}/${name}`,
      kind: speed ? 'speed' : 'lesson',
      title: title(lessonId) ?? lessonId,
      lessonId,
      madeAt: info.mtime.toISOString(),
      bytes: info.size,
    })
  }

  return made.sort((a, b) => Date.parse(b.madeAt) - Date.parse(a.madeAt))
}

/**
 * The file a made video's id names under .studio, or null for anything else:
 * only `<folder>/out/<file>` (an .mp4 or its thumbnail) and `videos/<file>.mp4`,
 * never a path that climbs out of .studio.
 */
export function madeFile(studioDir: string, id: string): string | null {
  const shape = /^[^/\\]+\/out\/[^/\\]+\.(mp4|jpe?g|png)$/.test(id) || new RegExp(`^${LESSON_VIDEOS}/[^/\\\\]+\\.mp4$`).test(id)
  if (!shape || id.split('/').some((part) => part === '..' || part === '.' || part.startsWith('.'))) return null
  const root = path.resolve(studioDir)
  const file = path.resolve(root, id)
  return file.startsWith(root + path.sep) ? file : null
}

/** "What’s new in 1.1", "Overview of 1.0"; any other project by its folder's name ("long-landscape" → "Long landscape"). */
export function projectTitle(folder: string): string {
  const whatsNew = /^whats-new-(.+)$/.exec(folder)
  if (whatsNew) return `What’s new in ${whatsNew[1]}`
  const overview = /^overview-(.+)$/.exec(folder)
  if (overview) return `Overview of ${overview[1]}`
  const words = folder.replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

async function folders(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).map((entry) => entry.name).sort()
}

async function files(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  return entries.filter((entry) => entry.isFile() && !entry.name.startsWith('.')).map((entry) => entry.name).sort()
}
