import { fileURLToPath } from 'node:url'

import { createServer, type ViteDevServer } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { BrowserBridge } from './bridge'
import { openBrowser } from './browser'

/**
 * Runs the Studio's browser code in headless Chromium, as `studio svg trace`
 * does. Needs a browser, so it runs only when asked:
 * `STUDIO_BROWSER_TESTS=1 npm test` (with `npx playwright install chromium`
 * done once, or STUDIO_CHROMIUM naming a Chrome).
 */
const enabled = process.env.STUDIO_BROWSER_TESTS === '1'

const HOUSE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <style>.wall{fill:none;stroke:#111;stroke-width:3}</style>
  <g transform="translate(10 10)">
    <rect class="wall" x="10" y="30" width="60" height="50"/>
    <polygon points="10,30 40,5 70,30" fill="#c0392b"/>
  </g>
</svg>`

describe.skipIf(!enabled)('the browser bridge', () => {
  let vite: ViteDevServer
  let browser: BrowserBridge

  beforeAll(async () => {
    const webDir = fileURLToPath(new URL('../', import.meta.url))
    vite = await createServer({
      configFile: false,
      root: webDir,
      appType: 'custom',
      logLevel: 'error',
      resolve: { alias: { '@shared': fileURLToPath(new URL('../../shared', import.meta.url)) } },
      server: { middlewareMode: true, hmr: false, watch: null, fs: { allow: ['..'] } },
      optimizeDeps: { noDiscovery: true, include: [] },
    })
    browser = await openBrowser(vite)
  }, 60_000)

  afterAll(async () => {
    await browser?.close()
    await vite?.close()
  })

  it('traces an SVG the way New lesson does', async () => {
    const trace = await browser.trace(HOUSE, { maxStrokes: 16 })
    expect(trace.canvas).toEqual({ width: 1000, height: 1000 })
    expect(trace.strokes.length).toBeGreaterThan(0)
    expect(trace.strokes.every((stroke) => /^M /.test(stroke.d))).toBe(true)
    expect(trace.fills.map((fill) => fill.color)).toContain('#C0392B')
  }, 60_000)

  it('rewrites an SVG as plain paths with the file’s CSS and transforms resolved', async () => {
    const result = await browser.optimize(HOUSE, { decimals: 0 })
    expect(result.kept).toBe(2)
    expect(result.svg).toContain('stroke="#111111" stroke-width="30"')
    expect(result.svg).toContain('fill="#C0392B"')
    // translate(10 10) on a 100-unit file fitted to 1000: the wall starts at (200, 400).
    expect(result.svg).toContain('d="M 200 400 L 800 400')
  }, 60_000)

  it('renders a PNG on white paper', async () => {
    const png = Buffer.from(await browser.renderPng(HOUSE, 256), 'base64')
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(png.byteLength).toBeGreaterThan(100)
  }, 60_000)

  it('reports a problem in the file as its own error', async () => {
    await expect(browser.trace('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>')).rejects.toThrow("can't be traced")
  }, 60_000)
})
