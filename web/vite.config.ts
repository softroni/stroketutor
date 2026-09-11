import { fileURLToPath } from 'node:url'
import process from 'node:process'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

import { studioApi } from './server/studioApi'

// The schema, the golden tutorials and the conformance corpus live one level up
// in shared/, because the iOS app reads the same files. Nothing in shared/ is a
// copy of anything.
const shared = fileURLToPath(new URL('../shared', import.meta.url))

export default defineConfig({
  // studioApi is the Studio's local server: it reads and writes shared/ during
  // `npm run dev` only. See server/studioApi.ts.
  plugins: [react(), studioApi({ sharedDir: shared })],
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
    // The parser, conformance, editor and file-writer tests are pure; nothing
    // here needs a DOM.
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
})
