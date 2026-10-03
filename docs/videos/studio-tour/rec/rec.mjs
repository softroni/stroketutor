// Records the Studio in a headless Chrome with the DevTools screencast, then makes a 30 fps mp4.
import { chromium } from '/Users/kevin/dev/stroketutor/web/node_modules/playwright/index.mjs'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

/** The page's width in CSS pixels, and the recording's size: twice 1080p's, so the edit can zoom in and stay sharp. */
export const W = 1440, OUT_W = 2880, OUT_H = 1620

const CURSOR = `
(() => {
  if (window.__cursor) return
  const make = () => {
    const c = document.createElement('div')
    c.id = '__cursor'
    c.innerHTML = '<svg width="26" height="30" viewBox="0 0 26 30"><path d="M3 2 L3 24 L9 18.5 L13 27 L17 25.2 L13 17 L21 17 Z" fill="#111" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>'
    Object.assign(c.style, { position: 'fixed', left: '0px', top: '0px', zIndex: 2147483647, pointerEvents: 'none', transform: 'translate(-3px,-2px)', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))', display: 'none' })
    document.documentElement.appendChild(c)
    window.__cursor = c
    addEventListener('mousemove', e => { c.style.display = 'block'; c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px' }, true)
    addEventListener('mousedown', e => {
      const r = document.createElement('div')
      Object.assign(r.style, { position: 'fixed', left: e.clientX - 18 + 'px', top: e.clientY - 18 + 'px', width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(66,133,244,.35)', border: '2px solid rgba(66,133,244,.8)', zIndex: 2147483646, pointerEvents: 'none', transition: 'transform .45s ease-out, opacity .45s ease-out' })
      document.documentElement.appendChild(r)
      requestAnimationFrame(() => { r.style.transform = 'scale(1.8)'; r.style.opacity = '0' })
      setTimeout(() => r.remove(), 600)
    }, true)
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', make); else make()
})()`

// Kevin asked to be called Zak in this video: swap the name wherever the page shows it.
const ZAK = `
(() => {
  const swap = n => { if (n.nodeValue && n.nodeValue.includes('Kevin')) n.nodeValue = n.nodeValue.replace(/Kevin/g, 'Zak') }
  const walk = root => { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) swap(n) }
  const start = () => {
    walk(document.body)
    new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') swap(m.target); m.addedNodes.forEach(n => n.nodeType === 3 ? swap(n) : n.nodeType === 1 && walk(n)) } })
      .observe(document.body, { subtree: true, childList: true, characterData: true })
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start); else start()
})()`

export async function open(width = W) {
  const browser = await chromium.launch({ channel: 'chrome' })
  const ctx = await browser.newContext({ viewport: { width, height: Math.round(width * 9 / 16) }, deviceScaleFactor: OUT_W / width, colorScheme: 'light' })
  await ctx.addInitScript(CURSOR)
  await ctx.addInitScript(ZAK)
  const page = await ctx.newPage()
  return { browser, ctx, page }
}

/** Records `fn(page)` into ../raw/<name>.mp4. */
export async function record(page, name, fn) {
  const dir = `/Users/kevin/dev/stroketutor/.studio/studio-tour/rec/frames-${name}`
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true })
  const cdp = await page.context().newCDPSession(page)
  const frames = []
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const i = frames.length
    frames.push(metadata.timestamp)
    writeFileSync(`${dir}/${String(i).padStart(6, '0')}.jpg`, Buffer.from(data, 'base64'))
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: OUT_W, maxHeight: OUT_H, everyNthFrame: 1 })
  const t0 = Date.now() / 1000
  // a tiny repaint so the first frame arrives
  await page.evaluate(() => { document.body.style.outline = '0px solid transparent' })
  const marks = []
  const mark = label => marks.push({ label, at: Date.now() / 1000 })
  await fn(page, mark)
  await page.waitForTimeout(300)
  const t1 = Date.now() / 1000
  await cdp.send('Page.stopScreencast')
  await cdp.detach()
  // concat list with each frame's duration; the last holds to the end
  let list = ''
  for (let i = 0; i < frames.length; i++) {
    const next = i + 1 < frames.length ? frames[i + 1] : Math.max(frames[i] + 0.04, t1)
    list += `file '${dir}/${String(i).padStart(6, '0')}.jpg'\nduration ${Math.max(0.001, next - frames[i]).toFixed(4)}\n`
  }
  list += `file '${dir}/${String(frames.length - 1).padStart(6, '0')}.jpg'\n`
  writeFileSync(`${dir}/list.txt`, list)
  const out = `/Users/kevin/dev/stroketutor/.studio/studio-tour/raw/${name}.mp4`
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${dir}/list.txt`, '-vf', `fps=30,scale=${OUT_W}:${OUT_H}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', out])
  const first = frames[0] ?? t0
  writeFileSync(out.replace(/\.mp4$/, '.marks.json'), JSON.stringify(marks.map(m => ({ label: m.label, s: +(m.at - first).toFixed(2) })), null, 1))
  const span = frames.length ? frames[frames.length - 1] - frames[0] : 0
  console.log(`${name}: ${frames.length} frames over ${span.toFixed(1)} s (${(frames.length / Math.max(span, 0.001)).toFixed(1)} fps avg)`)
  rmSync(dir, { recursive: true, force: true })
  return out
}

export async function smoothScroll(page, to, ms = 1500) {
  await page.evaluate(([to, ms]) => new Promise(res => {
    const el = document.scrollingElement
    const from = el.scrollTop, t0 = performance.now()
    const target = typeof to === 'number' ? to : (document.querySelector(to).getBoundingClientRect().top + from - 90)
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    const step = now => { const t = Math.min(1, (now - t0) / ms); el.scrollTop = from + (target - from) * ease(t); t < 1 ? requestAnimationFrame(step) : res() }
    requestAnimationFrame(step)
  }), [to, ms])
}

/** Moves the visible cursor to an element (or x,y) along a smooth path. */
export async function moveTo(page, target, ms = 600) {
  let x, y
  if (typeof target === 'string' || target?.boundingBox) {
    const loc = typeof target === 'string' ? page.locator(target).first() : target
    const b = await loc.boundingBox()
    x = b.x + b.width / 2; y = b.y + b.height / 2
  } else ({ x, y } = target)
  const steps = Math.max(8, Math.round(ms / 16))
  await page.mouse.move(x, y, { steps })
  return { x, y }
}

export async function clickOn(page, target, ms = 600) {
  await moveTo(page, target, ms)
  await page.waitForTimeout(150)
  await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up()
}
