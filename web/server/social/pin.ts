import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import type { Tutorial } from '../../src/schema/types'
import { panelSvg } from '../../src/studio/preview'
import { escapeHtml, subjectOf } from '../video/plan'
import { backdropStops } from '../video/page'
import { launchChromium } from '../video/render'

/**
 * The step pin: every step of a lesson on one tall image (1000 × 1500, the 2:3
 * Pinterest recommends), the classic "how to draw" picture. The look follows
 * the lesson videos: Fredoka, the path's color behind a white card, and in each
 * step's picture the lines of earlier steps faded as the player fades them, so
 * the new lines stand out. The last picture is the finished drawing in color.
 */

export const PIN = { width: 1000, height: 1500 }

const CARD = { left: 50, top: 300, width: 900, height: 1010 }
const CARD_PADDING = 34
const GAP = 22

/** How the step pictures are laid out on the card: as big as they can be, in a grid that fits. */
export function pinLayout(panels: number): { columns: number; rows: number; size: number } {
  const inner = { width: CARD.width - 2 * CARD_PADDING, height: CARD.height - 2 * CARD_PADDING }
  let best = { columns: 1, rows: panels, size: 0 }
  for (let columns = 1; columns <= Math.min(panels, 5); columns += 1) {
    const rows = Math.ceil(panels / columns)
    const size = Math.floor(Math.min((inner.width - GAP * (columns - 1)) / columns, (inner.height - GAP * (rows - 1)) / rows))
    if (size > best.size) best = { columns, rows, size }
  }
  return best
}

export interface PinInput {
  tutorial: Tutorial
  /** The deep shade of the lesson's path color; the Paper Coach green outside every path. */
  backdrop: string | null
  /** Fredoka and the app icon, base64. */
  font: string
  icon: string
}

export function pinPage({ tutorial, backdrop, font, icon }: PinInput): string {
  const stops = backdropStops(backdrop ?? '#1FA463')
  const { article } = subjectOf(tutorial.title)
  const steps = tutorial.steps.length
  const layout = pinLayout(steps)
  const drawingHeight = Math.round((layout.size * tutorial.canvas.height) / tutorial.canvas.width)
  const panels = tutorial.steps.map((_, index) => {
    // The last picture is the finished drawing, nothing faded.
    const upTo = index === steps - 1 ? steps : index
    const svg = panelSvg(tutorial, upTo, false, { x: 0, y: 0, width: layout.size, height: drawingHeight })
    return `<div class="panel" style="width:${layout.size}px;height:${drawingHeight}px">${svg}<span class="number">${index + 1}</span></div>`
  })
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face { font-family: Fredoka; src: url(data:font/ttf;base64,${font}); font-weight: 300 700; }
  * { box-sizing: border-box; margin: 0; }
  body {
    width: ${PIN.width}px; height: ${PIN.height}px; overflow: hidden; font-family: Fredoka, sans-serif; color: #fff;
    background: linear-gradient(180deg, ${stops.light} 0%, ${stops.mid} 45%, ${stops.deep} 100%);
  }
  .kicker { position: absolute; top: 70px; width: 100%; text-align: center; font-size: 34px; font-weight: 500; letter-spacing: 6px; opacity: 0.85; }
  h1 { position: absolute; top: 118px; width: 100%; padding: 0 50px; text-align: center; font-size: ${tutorial.title.length > 16 ? 72 : 88}px; line-height: 1; font-weight: 600; }
  .count { position: absolute; top: 232px; width: 100%; text-align: center; font-size: 30px; font-weight: 500; opacity: 0.9; }
  .card {
    position: absolute; left: ${CARD.left}px; top: ${CARD.top}px; width: ${CARD.width}px; height: ${CARD.height}px;
    background: #fff; border-radius: 40px; box-shadow: 0 24px 50px rgba(0, 0, 0, 0.28);
    display: flex; align-items: center; justify-content: center;
  }
  .grid { display: flex; flex-wrap: wrap; justify-content: center; gap: ${GAP}px; width: ${layout.columns * layout.size + (layout.columns - 1) * GAP}px; }
  .panel { position: relative; border-radius: 22px; overflow: hidden; box-shadow: inset 0 0 0 3px #EDEDED; }
  .panel svg { display: block; width: 100%; height: 100%; }
  .number {
    position: absolute; top: 12px; left: 12px; min-width: 50px; height: 50px; border-radius: 25px; padding: 0 14px;
    background: ${stops.mid}; color: #fff; font-size: 30px; font-weight: 600; display: flex; align-items: center; justify-content: center;
  }
  .footer { position: absolute; left: 50px; right: 50px; top: 1350px; height: 110px; display: flex; align-items: center; gap: 26px; }
  .footer img { width: 104px; height: 104px; border-radius: 24px; box-shadow: 0 8px 18px rgba(0, 0, 0, 0.25); }
  .name { font-size: 46px; font-weight: 600; line-height: 1.05; }
  .tagline { font-size: 27px; font-weight: 400; opacity: 0.92; margin-top: 6px; }
</style></head><body>
  <div class="kicker">HOW TO DRAW</div>
  <h1>${escapeHtml(article ? `${article} ${tutorial.title}` : tutorial.title)}</h1>
  <div class="count">${steps} easy steps</div>
  <div class="card"><div class="grid">${panels.join('')}</div></div>
  <div class="footer">
    <img src="data:image/png;base64,${icon}" alt="">
    <div><div class="name">Paper Coach</div><div class="tagline">Draw it on real paper, one line at a time · Free on the App Store</div></div>
  </div>
</body></html>`
}

/** Writes the pin as a PNG at twice its size, so lines stay crisp when Pinterest scales it. */
export async function renderPin(html: string, out: string): Promise<string> {
  const browser = await launchChromium()
  try {
    const page = await browser.newPage({ viewport: PIN, deviceScaleFactor: 2 })
    await page.setContent(html)
    await page.evaluate(() => document.fonts.ready)
    await mkdir(path.dirname(out), { recursive: true })
    await page.screenshot({ path: out })
    return out
  } finally {
    await browser.close()
  }
}
