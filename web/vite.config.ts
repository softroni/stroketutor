import { fileURLToPath } from 'node:url'
import process from 'node:process'

import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

import { DEFAULT_TTS_MCP_URL, DEFAULT_TTS_URL, studioApi } from './server/studioApi'

// The schema, the golden tutorials and the conformance corpus live one level up
// in shared/, because the iOS app reads the same files. Nothing in shared/ is a
// copy of anything.
const shared = fileURLToPath(new URL('../shared', import.meta.url))
const webDir = fileURLToPath(new URL('.', import.meta.url))
// The Studio's local workspace (drafts, history, trash), gitignored. Only published lessons reach shared/.
const studioDir = fileURLToPath(new URL('../.studio', import.meta.url))

export default defineConfig(({ mode }) => {
  // Read with no prefix filter so OPENROUTER_API_KEY can reach the server
  // plugin. It goes nowhere else: Vite only ever exposes VITE_-prefixed
  // variables to the browser bundle, so the key cannot leak into it.
  const env = loadEnv(mode, webDir, '')

  return {
    // studioApi is the Studio's local server: it reads and writes shared/ and
    // talks to OpenRouter during `npm run dev` only. See server/studioApi.ts.
    plugins: [
      react(),
      studioApi({
        sharedDir: shared,
        workspaceFile: env.STUDIO_WORKSPACE || `${studioDir}/workspace.sqlite`,
        backupDir: `${studioDir}/backups`,
        openRouterKey: env.OPENROUTER_API_KEY || undefined,
        defaultModel: env.OPENROUTER_MODEL || undefined,
        // Lina's voice is made on the creator's own Mac, on their tailnet.
        ttsUrl: env.STUDIO_TTS_URL || DEFAULT_TTS_URL,
        ttsMcpUrl: env.STUDIO_TTS_MCP_URL || DEFAULT_TTS_MCP_URL,
      }),
    ],
    resolve: {
      alias: { '@shared': shared },
    },
    server: {
      // Honours PORT when something else assigns one; plain `npm run dev` uses
      // Vite's usual 5173.
      port: Number(process.env.PORT) || 5173,
      open: true,
      // Lets the dev server read shared/, which sits outside the Vite root.
      fs: { allow: ['..'] },
    },
    test: {
      // The parser, conformance, editor, file-writer and generation tests are
      // pure; nothing here needs a DOM.
      environment: 'node',
      include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'cli/**/*.test.ts'],
    },
  }
})
