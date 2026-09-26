// Saves every App Store screenshot in shots.js at its upload size:
//
//   node docs/app-store/marketing/render.mjs [iphone|ipad] [shot id]
//
// Writes out/<device>/<nn>-<id>.png (RGB, no alpha: App Store Connect refuses
// transparency). It serves the repository over http so shots.html can read the
// lessons and illustrations in shared/, and drives the installed Google Chrome
// through the Studio's Playwright (web/node_modules).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEVICES, SHOTS } from './shots.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const { chromium } = createRequire(path.join(root, 'web/package.json'))('playwright');

const [onlyDevice, onlyShot] = process.argv.slice(2);
const devices = Object.keys(DEVICES).filter((d) => !onlyDevice || d === onlyDevice);
const shots = SHOTS.map((shot, i) => ({ ...shot, number: String(i + 1).padStart(2, '0') }))
  .filter((s) => !onlyShot || s.id === onlyShot);

const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf',
};
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}/docs/app-store/marketing/shots.html`;

const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const device of devices) {
    const { width, height } = DEVICES[device];
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`${r.status()} ${r.url()}`);
    });
    const dir = path.join(here, 'out', device);
    // A full run replaces the folder, so a shot dropped from shots.js is not uploaded.
    if (!onlyShot) fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });

    for (const shot of shots) {
      const file = path.join(here, 'out', device, `${shot.number}-${shot.id}.png`);
      await page.goto(`${base}?device=${device}&shot=${shot.id}`);
      await page.waitForFunction(() => window.ready === true, null, { timeout: 15000 });
      if (errors.length) throw new Error(`${device}/${shot.id}: ${errors.join('; ')}`);
      await page.locator('#canvas').screenshot({ path: file });
      execFileSync('magick', [file, '-alpha', 'off', file]);
      console.log(path.relative(root, file));
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
