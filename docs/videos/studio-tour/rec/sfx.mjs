// Renders the Learners page's own sounds (web/src/studio/sounds.ts, Web Audio) to WAV files for the edit.
import { chromium } from '/Users/kevin/dev/stroketutor/web/node_modules/playwright/index.mjs'
import { writeFileSync } from 'node:fs'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()
await page.goto('http://localhost:5173/#/docs')
await page.waitForTimeout(2000)
for (const kind of ['install', 'trial', 'buy']) {
  const b64 = await page.evaluate(async (kind) => {
    const { SOUNDS } = await import('/src/studio/sounds.ts')
    const rate = 48000
    const ctx = new OfflineAudioContext(1, rate * 2.2, rate)
    SOUNDS[kind](ctx, 0.02)
    const buf = await ctx.startRendering()
    const data = buf.getChannelData(0)
    const out = new DataView(new ArrayBuffer(44 + data.length * 2))
    const str = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)))
    str(0, 'RIFF'); out.setUint32(4, 36 + data.length * 2, true); str(8, 'WAVEfmt ')
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true); out.setUint32(24, rate, true)
    out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, data.length * 2, true)
    data.forEach((v, i) => out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true))
    let s = ''; const bytes = new Uint8Array(out.buffer)
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return btoa(s)
  }, kind)
  writeFileSync(`/Users/kevin/dev/stroketutor/.studio/studio-tour/video/public/sfx/${kind}.wav`, Buffer.from(b64, 'base64'))
}
await browser.close()
