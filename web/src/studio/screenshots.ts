/**
 * The App Store screenshots, as the Studio server lists them from
 * `docs/app-store/marketing/out`. The Studio only shows them: `render.mjs`
 * makes them, outside the Studio (docs/app-store/marketing/README.md).
 */
export type ScreenshotDevice = 'iphone' | 'ipad'

export const SCREENSHOT_DEVICES: ScreenshotDevice[] = ['iphone', 'ipad']

export interface Screenshot {
  /** Its place in the listing, `01`… */
  number: string
  /** The shot's id in shots.js: `learn`, `paths`… */
  id: string
  /** Its headline, as plain text. */
  title: string
  /** Where the Studio server serves it; the address changes whenever the file does. */
  url: string
  /** When the file was last written, in milliseconds since 1970. */
  updated: number
}

export interface ScreenshotSet {
  device: ScreenshotDevice
  /** `iPhone 6.9″`, `iPad 13″`: the App Store's display names. */
  label: string
  /** The upload size, from shots.js; null when it could not be read. */
  width: number | null
  height: number | null
  shots: Screenshot[]
}

export interface ScreenshotList {
  sets: ScreenshotSet[]
  /** The newest file's time: it moves whenever anything is rendered again. */
  updated: number
  /** The last commit that touched the screenshots, when git can say. */
  commit: { hash: string; date: string; subject: string } | null
}

/** A shots.js headline as plain text: `<br>` becomes a space and other tags go. */
export function plainTitle(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The shot before or after `id` in a set, wrapping round; null when the set is empty. */
export function neighbour(shots: Screenshot[], id: string, step: 1 | -1): Screenshot | null {
  if (shots.length === 0) return null
  const at = shots.findIndex((shot) => shot.id === id)
  return shots[(Math.max(at, 0) + step + shots.length) % shots.length]
}
