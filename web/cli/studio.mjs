#!/usr/bin/env node
// The Studio's command line: every authoring action of the web Studio, from a
// terminal, on the same workspace (see web/README.md, "The command line").
//
// This file is plain JavaScript so that `node cli/studio.mjs` needs no build
// step. It starts Vite in middleware mode (no HTTP port, no browser, no
// watcher) purely as a module loader: the Studio's TypeScript, its `@shared`
// alias and its JSON schema imports then resolve exactly as they do for the
// Studio server, which loads the same validators through `ssrLoadModule`.
// The browser bridge (cli/browser.ts) reuses the same Vite instance to serve
// the tracer to headless Chromium.
import { fileURLToPath } from 'node:url'

import { createServer, loadEnv } from 'vite'

const webDir = fileURLToPath(new URL('..', import.meta.url))
const sharedDir = fileURLToPath(new URL('../../shared', import.meta.url))

const vite = await createServer({
  configFile: false,
  root: webDir,
  appType: 'custom',
  logLevel: 'error',
  resolve: { alias: { '@shared': sharedDir } },
  server: { middlewareMode: true, hmr: false, watch: null, fs: { allow: ['..'] } },
  optimizeDeps: { noDiscovery: true, include: [] },
})

try {
  const { run } = await vite.ssrLoadModule('/cli/main.ts')
  // No prefix filter, as in vite.config.ts, so OPENROUTER_API_KEY, OPENROUTER_MODEL,
  // STUDIO_WORKSPACE and the voice server's STUDIO_TTS_URL / STUDIO_TTS_MCP_URL
  // from web/.env.local reach the command line.
  const env = loadEnv('development', webDir, '')
  process.exitCode = await run(process.argv.slice(2), { env, webDir, sharedDir, vite })
} finally {
  await vite.close()
}
