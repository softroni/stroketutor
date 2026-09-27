import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import {
  SCREENSHOT_DEVICES,
  plainTitle,
  type Screenshot,
  type ScreenshotDevice,
  type ScreenshotList,
} from '../src/studio/screenshots'

/**
 * The App Store screenshots for the Studio's Screenshots page, read from
 * `docs/app-store/marketing` (`marketingDir`): the PNGs `render.mjs` wrote to
 * `out/<device>/<nn>-<id>.png`, and the headlines and sizes in `shots.js`.
 * Read-only: the Studio shows the screenshots and never makes or changes them.
 */

const LABELS: Record<ScreenshotDevice, string> = { iphone: 'iPhone 6.9″', ipad: 'iPad 13″' }
const FILE = /^(\d\d)-([a-z0-9-]+)\.png$/

interface ShotsModule {
  DEVICES?: Record<string, { width?: number; height?: number }>
  SHOTS?: { id: string; title: string }[]
}

export async function listScreenshots(marketingDir: string): Promise<ScreenshotList> {
  const shotsModule = await readShotsModule(marketingDir)
  const titles = new Map((shotsModule.SHOTS ?? []).map((shot) => [shot.id, plainTitle(shot.title)]))

  let newest = 0
  const sets = await Promise.all(
    SCREENSHOT_DEVICES.map(async (device) => {
      const dir = path.join(marketingDir, 'out', device)
      const names = (await fs.readdir(dir).catch(() => [] as string[])).filter((name) => FILE.test(name)).sort()
      const shots: Screenshot[] = await Promise.all(
        names.map(async (name) => {
          const [, number, id] = FILE.exec(name)!
          const updated = Math.round((await fs.stat(path.join(dir, name))).mtimeMs)
          newest = Math.max(newest, updated)
          return {
            number,
            id,
            title: titles.get(id) ?? id,
            url: `/api/screenshots/${device}/${name}?v=${updated}`,
            updated,
          }
        }),
      )
      const size = shotsModule.DEVICES?.[device]
      return { device, label: LABELS[device], width: size?.width ?? null, height: size?.height ?? null, shots }
    }),
  )

  return { sets, updated: newest, commit: await lastCommit(marketingDir) }
}

/** One screenshot's bytes, or null for a device or a name that is not a screenshot. */
export async function readScreenshot(marketingDir: string, device: string, name: string): Promise<Buffer | null> {
  if (!SCREENSHOT_DEVICES.includes(device as ScreenshotDevice) || !FILE.test(name)) return null
  return fs.readFile(path.join(marketingDir, 'out', device, name)).catch(() => null)
}

/**
 * shots.js, imported fresh whenever it changes (the file's time is in the URL,
 * so Node's module cache never serves an old copy). An unreadable file leaves
 * the ids as titles rather than failing the page.
 */
async function readShotsModule(marketingDir: string): Promise<ShotsModule> {
  const file = path.join(marketingDir, 'shots.js')
  try {
    const stamp = Math.round((await fs.stat(file)).mtimeMs)
    return (await import(/* @vite-ignore */ `${pathToFileURL(file).href}?v=${stamp}`)) as ShotsModule
  } catch {
    return {}
  }
}

async function lastCommit(marketingDir: string): Promise<ScreenshotList['commit']> {
  try {
    const { stdout } = await promisify(execFile)('git', ['log', '-1', '--format=%h%x09%cI%x09%s', '--', 'out'], {
      cwd: marketingDir,
    })
    const [hash, date, subject] = stdout.trim().split('\t')
    return hash ? { hash, date, subject: subject ?? '' } : null
  } catch {
    return null
  }
}
