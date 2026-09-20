import { existsSync } from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

import type { ViteDevServer } from 'vite'

import type { BrowserBridge, OptimizeOptions } from './bridge'
import type { PageBridge } from './browser/page'
import { CliError } from './output'

/**
 * The parts of the Studio that need a rendering engine (an SVG's CSS,
 * transforms and pixels) run in headless Chromium, driven by Playwright,
 * on a page served by the same Vite instance the command line loads its
 * modules through. So `studio svg trace` runs `src/trace/traceSvg.ts` as New
 * lesson does, not a port of it. Chromium is started only by commands that
 * need it, and once per command.
 *
 * `npx playwright install chromium` fetches the browser once; STUDIO_CHROMIUM
 * names another Chromium or Chrome executable to use instead.
 */
export async function openBrowser(vite: ViteDevServer | undefined): Promise<BrowserBridge> {
  if (!vite) throw new CliError('The browser bridge needs the Vite instance the command line starts; run commands through `npm run studio`.')
  let playwright: typeof import('playwright')
  try {
    playwright = await import('playwright')
  } catch {
    throw new CliError('Playwright is not installed: run `npm install` in web/ first.')
  }
  const executablePath = process.env.STUDIO_CHROMIUM || playwright.chromium.executablePath()
  if (!existsSync(executablePath)) {
    throw new CliError(
      process.env.STUDIO_CHROMIUM
        ? `STUDIO_CHROMIUM points at ${executablePath}, which does not exist.`
        : 'Chromium is not installed: run `npx playwright install chromium` once (or set STUDIO_CHROMIUM to a Chrome executable).',
    )
  }

  // The page and the Studio's modules, served on a loopback port for this command only.
  const server = http.createServer((req, res) => {
    if (req.url === PAGE_PATH) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end('<!doctype html><meta charset="utf-8"><title>StrokeTutor Studio command line</title><script type="module" src="/cli/browser/page.ts"></script>')
      return
    }
    vite.middlewares(req, res, () => {
      res.statusCode = 404
      res.end()
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const { port } = server.address() as AddressInfo

  const browser = await playwright.chromium.launch({ headless: true, executablePath })
  const page = await browser.newPage()
  page.setDefaultTimeout(180_000)
  const problems: string[] = []
  page.on('pageerror', (error) => problems.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text())
  })
  await page.goto(`http://127.0.0.1:${port}${PAGE_PATH}`)
  try {
    await page.waitForFunction(() => Boolean(window.studioBridge), undefined, { timeout: 30_000 })
  } catch {
    await browser.close()
    server.close()
    throw new CliError(`The Studio's browser page did not load.${problems.length > 0 ? ` ${problems.join(' ')}` : ''}`)
  }

  /** Calls one bridge method in the page and unwraps its answer. */
  async function call<K extends keyof PageBridge>(method: K, ...args: Parameters<PageBridge[K]>): Promise<Unwrapped<ReturnType<PageBridge[K]>>> {
    const answer = await page.evaluate(
      ([name, list]) => (window.studioBridge[name] as (...inner: unknown[]) => Promise<unknown>)(...list),
      [method, args] as const,
    )
    const result = answer as { ok: true; value: unknown } | { ok: false; error: string }
    if (!result.ok) throw new CliError(result.error)
    return result.value as Unwrapped<ReturnType<PageBridge[K]>>
  }

  return {
    trace: (text, options = {}) => call('trace', text, options),
    renderPng: (text, longestEdge) => call('renderPng', text, longestEdge),
    drawingPng: (tutorial) => call('drawingPng', tutorial),
    optimize: (text, options: OptimizeOptions) => call('optimize', text, options),
    fromImage: (base64, contentType, size, options) => call('fromImage', base64, contentType, size, options),
    async close() {
      await browser.close()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    },
  }
}

const PAGE_PATH = '/__studio/page.html'

type Unwrapped<T> = T extends Promise<{ ok: true; value: infer V } | { ok: false; error: string }> ? V : never
