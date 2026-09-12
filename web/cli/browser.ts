import type { ViteDevServer } from 'vite'

import type { BrowserBridge } from './bridge'

/** Placeholder until the headless-Chromium bridge lands. */
export async function openBrowser(_vite: ViteDevServer | undefined): Promise<BrowserBridge> {
  throw new Error('The browser bridge is not available yet.')
}
