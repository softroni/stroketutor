// Writes gallery.html beside this file: every screenshot in out/, in listing order,
// with the first three as App Store search shows them. render.mjs calls it after
// each run; `node docs/app-store/marketing/gallery.mjs` rewrites it on its own.
// Plain <img> tags and no scripts, so it opens straight from disk.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DEVICES, SHOTS } from './shots.js';

const here = path.dirname(fileURLToPath(import.meta.url));

const caption = (html) => html.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').trim();
const escape = (text) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function writeGallery() {
  const titles = new Map(SHOTS.map((s) => [s.id, caption(s.title)]));
  const files = (device) => {
    const dir = path.join(here, 'out', device);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((f) => /^\d\d-.+\.png$/.test(f)).sort().map((f) => {
      const id = f.replace(/^\d\d-|\.png$/g, '');
      const stamp = Math.round(fs.statSync(path.join(dir, f)).mtimeMs);
      return { src: `out/${device}/${f}?v=${stamp}`, number: f.slice(0, 2), title: titles.get(id) ?? id };
    });
  };
  let commit = '';
  try {
    commit = execFileSync('git', ['log', '-1', '--format=%h %ad', '--date=format:%Y-%m-%d %H:%M', '--', 'out'],
      { cwd: here, encoding: 'utf8' }).trim();
  } catch {}

  const card = (shot) => `
      <figure>
        <a href="${shot.src}" target="_blank"><img src="${shot.src}" alt="${escape(shot.title)}" loading="lazy"></a>
        <figcaption><b>${shot.number}</b> ${escape(shot.title)}</figcaption>
      </figure>`;
  const section = (device, label) => {
    const shots = files(device);
    const { width, height } = DEVICES[device];
    return `
    <section>
      <h2>${label} <span>${width} × ${height} · ${shots.length} shots</span></h2>
      <div class="grid ${device}">${shots.map(card).join('')}
      </div>
    </section>`;
  };
  const search = files('iphone').slice(0, 3);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Paper Coach screenshots</title>
<!-- Written by gallery.mjs (render.mjs runs it). Edit that, not this file. -->
<style>
  :root { --bg: #f4f4f2; --fg: #141414; --muted: #6b6b66; --card: #fff; --line: #e2e1dc; --phone: #000; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #161616; --fg: #f1f1ee; --muted: #9a9a94; --card: #202020; --line: #2e2e2c; --phone: #000; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px 16px 64px; background: var(--bg); color: var(--fg);
         font: 15px/1.45 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; }
  main { max-width: 1400px; margin: 0 auto; }
  h1 { font-size: 28px; margin: 0 0 4px; letter-spacing: -0.01em; }
  .meta { color: var(--muted); margin: 0 0 32px; }
  h2 { font-size: 18px; margin: 40px 0 14px; }
  h2 span { color: var(--muted); font-weight: 400; font-size: 14px; margin-left: 8px; }
  .grid { display: grid; gap: 18px; }
  .grid.iphone { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
  .grid.ipad { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
  figure { margin: 0; }
  figure img { display: block; width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--line); }
  figcaption { margin-top: 8px; font-size: 13px; color: var(--muted); }
  figcaption b { color: var(--fg); margin-right: 4px; }
  .search { background: var(--phone); border-radius: 28px; padding: 18px; display: inline-flex; gap: 10px;
            max-width: 100%; }
  .search img { width: min(118px, 28vw); border-radius: 12px; display: block; }
  .note { color: var(--muted); font-size: 13px; margin: 10px 0 0; max-width: 60ch; }
</style>
</head>
<body>
<main>
  <h1>Paper Coach screenshots</h1>
  <p class="meta">docs/app-store/marketing/out${commit ? ` · last committed ${escape(commit)}` : ''} · click one for full size</p>

  <section>
    <h2>In App Store search <span>the first three, at the size search shows them</span></h2>
    <div class="search">${search.map((s) => `<img src="${s.src}" alt="${escape(s.title)}">`).join('')}</div>
    <p class="note">Search results show the first three iPhone screenshots side by side at about a third of the
      phone's width, so each has to read at this size.</p>
  </section>
${section('iphone', 'iPhone 6.9″')}
${section('ipad', 'iPad 13″')}
</main>
</body>
</html>
`;
  fs.writeFileSync(path.join(here, 'gallery.html'), html);
  return path.join(here, 'gallery.html');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(path.relative(process.cwd(), writeGallery()));
}
