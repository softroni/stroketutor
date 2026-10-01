import type { Tutorial } from '../../src/schema/types'

import type { VideoPlan } from './plan'

/** The video's frame, in CSS pixels; `render.ts` draws it at twice this and scales down. */
export const FRAME = { width: 1080, height: 1920 }

/** Where nothing the platforms draw on top reaches: the brand at the top to Lina's line at the bottom, clear of the buttons on the right. */
export const SAFE = { top: 170, bottom: 1450, left: 180, right: 900 }

/**
 * Where the hook's title goes (plan.ts, `Opening`): the top of the frame down
 * to the progress bar, where the classic opening has Paper Coach, the lesson's
 * place and its title. Wider than `SAFE`, since the buttons on the right start
 * far lower, but clear of the 55 px a taller phone crops off each side.
 */
export const HOOK_BOX = { top: SAFE.top, bottom: 528, left: 80, right: FRAME.width - 80 }

/** The hook's title at its largest, in CSS pixels; a long subject is set smaller until the title and its second line fit `HOOK_BOX`. */
const HOOK_SIZE = 112

export interface PageAssets {
  /** Fredoka, the App Store screenshots' face, as base64 TTF. */
  font: string
  /** The app icon, as base64 PNG. */
  icon: string
  /** Apple's "Download on the App Store" badge as SVG text, when the repository has it. */
  badge: string | null
  /** Other lessons' illustrations as SVG text, stuck round the finished picture at the end, one per `STICKER_SLOTS` place. */
  stickers: string[]
}

/** A sticker's place: its centre, the length of its illustration's longer side, and its turn, in the frame's pixels and degrees. */
export interface StickerSlot {
  x: number
  y: number
  size: number
  turn: number
}

/**
 * Where the stickers land, in the order they do: two down each side of the
 * card, over its edges, as the App Store screenshots' stickers sit over the
 * phone, so they frame the drawing. All inside `STICKER_BOUNDS`.
 */
export const STICKER_SLOTS: StickerSlot[] = [
  { x: 152, y: 700, size: 180, turn: -10 },
  { x: 928, y: 668, size: 166, turn: 9 },
  { x: 160, y: 1128, size: 170, turn: 7 },
  { x: 932, y: 912, size: 160, turn: -8 },
]

/**
 * How far the stickers may reach: clear of the 55 px a taller phone crops off
 * each side, the ending's title above the card, the bottom row, and the
 * platforms' buttons down the right from about y 1100.
 */
export const STICKER_BOUNDS = { crop: 55, top: 520, bottom: SAFE.bottom - 132, buttons: { left: SAFE.right, top: 1100 } }

/** Whether a sticker there stays inside `STICKER_BOUNDS`, turned and floating: up and down it reaches half its diagonal, and a little. */
export function withinBounds(slot: StickerSlot): boolean {
  const reach = (slot.size / 2) * Math.SQRT2 + 8
  const { crop, top, bottom, buttons } = STICKER_BOUNDS
  const clearOfButtons = slot.x + reach <= buttons.left || slot.y + reach < buttons.top
  return slot.x - slot.size / 2 >= crop && slot.x + slot.size / 2 <= FRAME.width - crop && slot.y - reach > top && slot.y + reach < bottom && clearOfButtons
}

/**
 * Where a sticker may go, best first, for when its slot would cover part of
 * the drawing (a bus or a still life reaches the card's sides): the slot, then
 * a little higher or lower, then smaller with its outer edge where it was, so
 * it reaches less far over the card. Every one inside `STICKER_BOUNDS`. The
 * page takes the first that covers nothing drawn and no other sticker, and
 * leaves the sticker out when none does.
 */
export function stickerCandidates(slot: StickerSlot): StickerSlot[] {
  const candidates: StickerSlot[] = []
  for (const scale of [1, 0.85, 0.72]) {
    const size = Math.round(slot.size * scale)
    const x = slot.x + ((slot.size - size) / 2) * (slot.x < FRAME.width / 2 ? -1 : 1)
    for (const dy of [0, -30, 30, -60, 60, -90, 90, -120, 120]) {
      const candidate = { x, y: slot.y + dy, size, turn: slot.turn }
      if (withinBounds(candidate)) candidates.push(candidate)
    }
  }
  return candidates
}

/**
 * The backdrop's three stops, lightest to deepest, when the lesson is in no
 * path: the Paper Coach greens of the App Store screenshots.
 */
const GREENS = { light: '#26B571', mid: '#1FA463', deep: '#127544' }

/**
 * The backdrop's stops for a path's color (its deep shade in the app): the
 * color itself in the middle, a touch lighter at the top, darker at the foot,
 * as the greens are.
 */
export function backdropStops(colour: string): typeof GREENS {
  return { light: mix(colour, '#FFFFFF', 0.1), mid: normaliseColour(colour)!.toUpperCase(), deep: mix(colour, '#000000', 0.32) }
}

function mix(colour: string, towards: string, amount: number): string {
  const channels = (hex: string) => [1, 3, 5].map((at) => parseInt(normaliseColour(hex)!.slice(at, at + 2), 16))
  const [from, to] = [channels(colour), channels(towards)]
  return `#${from.map((value, index) => Math.round(value + (to[index] - value) * amount).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

/**
 * The page every frame is a screenshot of. It carries the lesson, the plan and
 * the assets inline, draws nothing on its own, and exposes `renderAt(t)`, which
 * sets every element for the moment `t` seconds in and returns a signature of
 * what is on screen. So a frame depends only on `t`, a render is exact and
 * repeatable, and two frames with the same signature are the same picture.
 *
 * The look follows the App Store screenshots: Fredoka and the drawing on a
 * white card, over the color of the lesson's path (`backdrop`, the path's deep
 * shade in the app), so a video wears its path's color as the app does; the
 * Paper Coach greens outside every path. At the end, other lessons land round
 * the card as the screenshots' stickers do. Everything sits inside the part of
 * the frame the platforms leave alone (`SAFE`), measured on a real YouTube
 * Short on an iPhone: a phone taller than 9:16 crops about 55 px off each side,
 * the buttons run down the right from about y 1100, and the channel and title
 * lines start near y 1550.
 */
export function videoPage(tutorial: Tutorial, plan: VideoPlan, assets: PageAssets, backdrop?: string): string {
  const stops = backdrop ? backdropStops(backdrop) : GREENS
  const stickers = assets.stickers.slice(0, STICKER_SLOTS.length)
  const slots = STICKER_SLOTS.slice(0, stickers.length)
  const data = { tutorial, plan, ink: normaliseColour(tutorial.style?.strokeColor) ?? '#141414', stickers, spots: slots.map(stickerCandidates) }
  const icon = `data:image/png;base64,${assets.icon}`
  const badge = assets.badge ? `data:image/svg+xml;base64,${Buffer.from(assets.badge).toString('base64')}` : null
  return `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  @font-face { font-family: 'Fredoka'; src: url(data:font/ttf;base64,${assets.font}) format('truetype'); font-weight: 300 700; font-stretch: 75% 125%; }
  :root { --backdrop-light: ${stops.light}; --backdrop: ${stops.mid}; --backdrop-deep: ${stops.deep}; --highlight: #FFE08A; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${FRAME.width}px; height: ${FRAME.height}px; overflow: hidden; }
  body {
    font-family: 'Fredoka', sans-serif; color: #fff;
    background:
      radial-gradient(ellipse 75% 45% at 50% 45%, rgba(255, 255, 255, 0.16), transparent 70%),
      linear-gradient(168deg, var(--backdrop-light) 0%, var(--backdrop) 40%, var(--backdrop-deep) 100%);
  }
  /* A fine, still grain over the backdrop, so the platforms' re-encoding doesn't band the gradient. */
  .grain {
    position: absolute; inset: 0; opacity: 0.08; mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  }
  .brand {
    position: absolute; top: ${SAFE.top}px; left: 0; right: 0;
    display: flex; align-items: center; justify-content: center; gap: 20px;
    font-size: 54px; font-weight: 600; letter-spacing: -0.01em; text-shadow: 0 0.05em 0.25em rgba(0, 0, 0, 0.14);
  }
  .brand img { width: 84px; height: 84px; border-radius: 20px; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22); }
  .chip {
    position: absolute; top: 292px; left: 50%; transform: translateX(-50%);
    padding: 8px 28px 11px; border-radius: 40px; background: rgba(0, 0, 0, 0.16);
    font-size: 36px; font-weight: 500; letter-spacing: 0.01em; white-space: nowrap;
  }
  .title {
    position: absolute; top: 364px; left: 110px; right: 110px; height: 156px;
    display: flex; align-items: center; justify-content: center; text-align: center;
    font-size: 74px; font-weight: 600; line-height: 1.04; letter-spacing: -0.012em;
    text-shadow: 0 0.05em 0.25em rgba(0, 0, 0, 0.14);
  }
  .title > span { text-wrap: balance; }
  .title em { font-style: normal; color: var(--highlight); }
  .title small { display: block; margin-top: 14px; font-size: 42px; font-weight: 500; letter-spacing: 0; opacity: 0.95; }
  /* The hook: what the video is, as people search for it, large over the finished picture from the first frame. */
  .hook {
    position: absolute; top: ${HOOK_BOX.top}px; left: ${HOOK_BOX.left}px; width: ${HOOK_BOX.right - HOOK_BOX.left}px; height: ${HOOK_BOX.bottom - HOOK_BOX.top}px;
    display: flex; align-items: center; justify-content: center; text-align: center;
  }
  .hook > div { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 22px; }
  .hook b {
    display: block; width: 100%; font-size: ${HOOK_SIZE}px; font-weight: 700; line-height: 1; letter-spacing: -0.02em; text-wrap: balance;
    text-shadow: 0 0.04em 0.22em rgba(0, 0, 0, 0.2);
  }
  .hook b em { font-style: normal; color: var(--highlight); }
  .hook span {
    padding: 6px 34px 12px; border-radius: 50px; background: #fff; color: var(--backdrop-deep);
    font-size: 60px; font-weight: 600; line-height: 1.1; white-space: nowrap; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
  }
  .progress { position: absolute; top: 540px; left: ${SAFE.left}px; width: ${SAFE.right - SAFE.left}px; height: 12px; border-radius: 6px; background: rgba(0, 0, 0, 0.16); overflow: hidden; }
  .progress > div { height: 100%; width: 0; background: var(--highlight); border-radius: 6px; }
  .card {
    position: absolute; top: 576px; left: ${SAFE.left}px; width: ${SAFE.right - SAFE.left}px; height: ${SAFE.right - SAFE.left}px;
    background: #fff; border-radius: 40px; box-shadow: 0 30px 60px rgba(0, 0, 0, 0.30);
  }
  .card svg { position: absolute; inset: 30px; width: calc(100% - 60px); height: calc(100% - 60px); }
  /* Other lessons as die-cut stickers, as on the App Store screenshots: a white rim, then a soft shadow under the whole. */
  .sticker {
    position: absolute; opacity: 0;
    filter: drop-shadow(5px 0 0 #fff) drop-shadow(-5px 0 0 #fff) drop-shadow(0 5px 0 #fff) drop-shadow(0 -5px 0 #fff) drop-shadow(0 10px 14px rgba(0, 0, 0, 0.28));
  }
  /* The bottom row: Lina and her words, and at the end Paper Coach and the call to action, in the same place. */
  .row {
    position: absolute; top: ${SAFE.bottom - 132}px; left: ${SAFE.left}px; width: ${SAFE.right - SAFE.left}px; height: 132px;
    display: flex; align-items: center; gap: 24px;
  }
  .face { flex: none; width: 112px; height: 112px; border-radius: 50%; border: 5px solid #fff; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22); overflow: hidden; }
  .face svg { display: block; width: 100%; height: 100%; }
  /* A few words on one line, large enough to read without sound, the one Lina is saying in yellow. */
  .caption {
    flex: 1; min-width: 0; font-size: ${CAPTION_SIZE}px; font-weight: 600; line-height: 1.1; letter-spacing: -0.005em; white-space: nowrap;
    text-shadow: 0 3px 14px rgba(0, 0, 0, 0.28);
  }
  .caption .now { color: var(--highlight); }
  .cta { opacity: 0; }
  .cta > img { flex: none; width: 112px; height: 112px; border-radius: 26px; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22); }
  .cta b { display: block; font-size: 54px; font-weight: 600; line-height: 1.1; letter-spacing: -0.01em; text-shadow: 0 0.05em 0.25em rgba(0, 0, 0, 0.14); }
  .cta .line { display: flex; align-items: center; gap: 18px; margin-top: 8px; font-size: 34px; font-weight: 500; color: var(--highlight); white-space: nowrap; }
  /* Apple's badge, as supplied: never recoloured, stretched or moved, only faded in with the rest. */
  .cta .badge { display: block; height: 64px; width: auto; }
</style></head>
<body>
  <div class="grain"></div>
  <div class="brand" id="brand"><img src="${icon}" alt=""><span>Paper Coach</span></div>
  <div class="chip" id="chip"></div>
  <div class="title" id="title"></div>
  <div class="hook" id="hook">${plan.text.hook ? `<div><b id="hook-title">${plan.text.hook.title}</b>${plan.text.hook.steps ? `<span>${plan.text.hook.steps}</span>` : ''}</div>` : ''}</div>
  <div class="progress"><div id="bar"></div></div>
  <div class="card">
    <svg id="drawing" viewBox="0 0 ${tutorial.canvas.width} ${tutorial.canvas.height}" preserveAspectRatio="xMidYMid meet">
      <defs id="defs"></defs>
      <g id="fills"></g><g id="strokes"></g>
      <g id="ghost"></g>
      <circle id="halo" r="0" opacity="0.2"></circle>
      <circle id="tip" r="0"></circle>
    </svg>
  </div>
  ${slots.map((slot) => `<div class="sticker" style="left: ${slot.x}px; top: ${slot.y}px; width: ${slot.size}px; height: ${slot.size}px"></div>`).join('\n  ')}
  <div class="row" id="lina"><div class="face">${LINA_FACE}</div><div class="caption" id="caption"></div></div>
  <div class="row cta" id="cta">
    <img src="${icon}" alt="">
    <div><b>Paper Coach</b><div class="line">${badge ? `<img class="badge" src="${badge}" alt="Download on the App Store">` : ''}<span>${plan.text.cta}</span></div></div>
  </div>
<script>
const D = ${JSON.stringify(data).replace(/</g, '\\u003c')};
const CAPTION_SIZE = ${CAPTION_SIZE};
const HOOK_SIZE = ${HOOK_SIZE};
${FRAME_SCRIPT}
</script></body></html>`
}

/** Lina's words, in CSS pixels; a line wider than the room beside her portrait is set smaller to fit. */
const CAPTION_SIZE = 72

function normaliseColour(colour: string | undefined): string | null {
  return colour ? `#${colour.replace(/^#/, '')}` : null
}

/**
 * Lina's round portrait, as `LinaFace` draws it (PaperCoach/Design/Components/
 * LinaView.swift): her neutral pose in its 200 × 240 box, scaled to 1.5 × the
 * circle and nudged up and left, in the same colours.
 */
const LINA_FACE = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <defs><clipPath id="lina-clip"><circle cx="50" cy="50" r="50"/></clipPath></defs>
  <g clip-path="url(#lina-clip)">
    <rect width="100" height="100" fill="#F5D9C6"/>
    <g transform="translate(-25 -28) scale(0.75)">
      <path d="M62 236 C62 182 84 164 100 164 C116 164 138 182 138 236 Z" fill="#C4653A"/>
      <rect x="88" y="142" width="24" height="30" fill="#EFC9AE"/>
      <circle cx="100" cy="172" r="12" fill="#EFC9AE"/>
      <path d="M50 122 C42 60 70 30 100 30 C130 30 158 60 150 122 L148 156 L52 156 Z" fill="#2B2B2B"/>
      <ellipse cx="100" cy="102" rx="42" ry="48" fill="#EFC9AE"/>
      <path d="M57 94 C60 52 88 40 114 46 C136 51 148 72 146 94 C130 80 118 72 100 76 C84 79 70 84 57 94 Z" fill="#2B2B2B"/>
      <path d="M46 66 C52 28 150 20 160 60 C132 44 76 46 46 66 Z" fill="#2178D9"/>
      <g fill="none" stroke="#2B2B2B" stroke-width="3" stroke-linecap="round">
        <circle cx="82" cy="106" r="13"/><circle cx="118" cy="106" r="13"/>
        <path d="M95 106 L105 106"/><path d="M88 130 Q100 140 112 130"/>
      </g>
      <circle cx="83" cy="107" r="3.2" fill="#2B2B2B"/><circle cx="119" cy="107" r="3.2" fill="#2B2B2B"/>
      <circle cx="70" cy="124" r="5" fill="#E9A28E" opacity="0.6"/><circle cx="130" cy="124" r="5" fill="#E9A28E" opacity="0.6"/>
    </g>
  </g>
</svg>`

/**
 * The page's own code, as plain JavaScript (it runs in Chromium as written).
 * Strokes draw with the dash-offset technique and fills reveal left to right
 * through a clip, as the Studio's player does (src/player/StrokeCanvas.tsx);
 * the pencil dot and its halo follow the line being drawn.
 */
const FRAME_SCRIPT = String.raw`
const NS = 'http://www.w3.org/2000/svg';
const colour = (c) => (c ? '#' + String(c).replace(/^#/, '') : null);
const clamp = (x) => Math.max(0, Math.min(1, x));
const el = (name, attrs, parent) => {
  const node = document.createElementNS(NS, name);
  for (const key in attrs) node.setAttribute(key, attrs[key]);
  if (parent) parent.appendChild(node);
  return node;
};
const $ = (id) => document.getElementById(id);

// One entry per stroke and fill in drawing order: each step's strokes, then its fills.
// The ghost is the finished picture, shown at the very start and faded out for step 1.
const els = [];
const ghostFills = el('g', {}, $('ghost'));
const ghostStrokes = el('g', {}, $('ghost'));
D.tutorial.steps.forEach((step, si) => {
  step.strokes.forEach((s) => {
    const attrs = { d: s.d, fill: 'none', stroke: colour(s.color) || D.ink, 'stroke-width': s.lineWidth, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    const node = el('path', attrs, $('strokes'));
    el('path', attrs, ghostStrokes);
    els.push({ kind: 'stroke', step: si, dur: s.duration, node, len: node.getTotalLength(), width: s.lineWidth, colour: attrs.stroke });
  });
  (step.fills || []).forEach((f, fi) => {
    const id = 'clip-' + si + '-' + fi;
    const rect = el('rect', { x: 0, y: 0, width: 0, height: 0 }, el('clipPath', { id }, $('defs')));
    const attrs = { d: f.d, fill: colour(f.color), 'fill-rule': f.fillRule || 'nonzero' };
    const group = el('g', {}, $('fills'));
    const node = el('path', Object.assign({}, attrs, { 'clip-path': 'url(#' + id + ')' }), group);
    el('path', attrs, ghostFills);
    els.push({ kind: 'fill', step: si, dur: f.duration, node: group, rect, box: node.getBBox() });
  });
});

function runSequence(indices, elapsed, progress) {
  let at = 0;
  for (const i of indices) {
    const d = els[i].dur;
    progress[i] = d <= 0 ? (elapsed >= at ? 1 : 0) : clamp((elapsed - at) / d);
    at += d;
  }
}

// Text fades and rises in over 0.2 s (or fade) whenever it changes. What each text shows, and how far in, goes into the frame's signature.
const shown = {};
const textState = {};
function setText(id, value, since, asHtml, fade = 0.2) {
  const node = $(id);
  if (shown[id] !== value) {
    node.textContent = '';
    if (value) {
      const span = document.createElement('span');
      if (asHtml) span.innerHTML = value; else span.textContent = value;
      node.appendChild(span);
    }
    shown[id] = value;
    if (id === 'caption') fitCaption();
  }
  const a = value ? clamp(since / fade) : 0;
  node.style.opacity = a;
  node.style.translate = '0 ' + (1 - a) * 10 + 'px';
  textState[id] = (value || '') + '|' + a.toFixed(3);
}

// A caption line wider than the room beside Lina is set smaller until it fits; the lit word never changes its width.
function fitCaption() {
  const node = $('caption');
  node.style.fontSize = CAPTION_SIZE + 'px';
  const span = node.firstChild;
  if (!span) return;
  const width = span.getBoundingClientRect().width;
  if (width > node.clientWidth) node.style.fontSize = (CAPTION_SIZE * node.clientWidth) / width + 'px';
}

// The hook's title is set smaller, a step at a time, until it and its second line fit their box and no word runs
// past its sides. Once, at the first frame, when Fredoka has loaded.
let hookFitted = false;
function fitHook() {
  hookFitted = true;
  const title = $('hook-title');
  if (!title) return;
  const box = $('hook');
  const fits = () => title.parentNode.getBoundingClientRect().height <= box.clientHeight && title.scrollWidth <= title.clientWidth;
  for (let size = HOOK_SIZE; size > 48 && !fits(); size -= 4) title.style.fontSize = size - 4 + 'px';
}

const escapeHtml = (text) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// The caption's words, the one Lina is saying at t marked.
function captionHtml(caption, t) {
  return caption.words.map((w) => '<span' + (t >= w.from && t < w.to ? ' class="now"' : '') + '>' + escapeHtml(w.text) + '</span>').join(' ');
}

const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
// Past 1 and back, as a sticker pressed on overshoots a touch before it settles.
const overshoot = (x) => { const c = 1.70158, y = clamp(x) - 1; return 1 + (c + 1) * y * y * y + c * y * y; };

// The stickers of the ending. Each illustration goes in its own shadow root, so no style inside one reaches the page,
// and is cropped to its drawing, so an illustration's longer side is its sticker's size however much margin it came with.
// Then each takes the first of its places (stickerCandidates in page.ts) that covers nothing of the finished picture,
// which the ghost still shows whole at this point, and no other sticker; with none, it is left out.
const cardBox = document.querySelector('.card').getBoundingClientRect();
const finished = $('ghost');
function inkUnder(area) {
  const x0 = Math.max(area.left, cardBox.left), x1 = Math.min(area.right, cardBox.right);
  const y0 = Math.max(area.top, cardBox.top), y1 = Math.min(area.bottom, cardBox.bottom);
  for (let y = y0; y <= y1; y += 5) {
    for (let x = x0; x <= x1; x += 5) {
      if (document.elementsFromPoint(x, y).some((node) => node !== finished && finished.contains(node))) return true;
    }
  }
  return false;
}
const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
// What a sticker covers as it turns and floats: its illustration's box turned by up to about 14°, with its rim and a margin.
function footprint(spot, aspect) {
  const w = spot.size * aspect.w, h = spot.size * aspect.h, cos = Math.cos(0.25), sin = Math.sin(0.25);
  const hw = (w * cos + h * sin) / 2 + 12, hh = (w * sin + h * cos) / 2 + 12;
  return { left: spot.x - hw, right: spot.x + hw, top: spot.y - hh, bottom: spot.y + hh };
}
const taken = [];
const stickers = [];
document.querySelectorAll('.sticker').forEach((node, i) => {
  const root = node.attachShadow({ mode: 'open' });
  root.innerHTML = D.stickers[i];
  const art = root.querySelector('svg');
  let aspect = { w: 1, h: 1 };
  if (art) {
    const box = art.getBBox();
    art.removeAttribute('width');
    art.removeAttribute('height');
    art.style.cssText = 'display: block; width: 100%; height: 100%; overflow: visible';
    if (box.width > 0 && box.height > 0) {
      art.setAttribute('viewBox', [box.x, box.y, box.width, box.height].join(' '));
      const long = Math.max(box.width, box.height);
      aspect = { w: box.width / long, h: box.height / long };
    }
    art.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  }
  const spot = D.spots[i].find((candidate) => {
    const area = footprint(candidate, aspect);
    return !taken.some((other) => overlaps(area, other)) && !inkUnder(area);
  });
  if (!spot) return node.remove();
  taken.push(footprint(spot, aspect));
  Object.assign(node.style, { left: spot.x + 'px', top: spot.y + 'px', width: spot.size + 'px', height: spot.size + 'px' });
  stickers.push({ node, spot, period: 2.9 + ((stickers.length * 0.37) % 0.8) });
});
// Each lands with a small overshoot, turning into place, then floats a little at its own pace.
function placeStickers(landing, t) {
  return stickers.map((s, i) => {
    const since = landing[i] === undefined ? -1 : t - landing[i];
    if (since < 0) {
      s.node.style.opacity = 0;
      return '';
    }
    const p = clamp(since / 0.42);
    const float = clamp((since - 0.3) / 0.8);
    const phase = (since / s.period) * 2 * Math.PI;
    const scale = 0.45 + 0.55 * overshoot(p);
    const turn = s.spot.turn - 18 * (1 - ease(p)) + Math.sin(phase * 0.8 + 1) * 1.6 * float;
    const rise = Math.sin(phase) * 7 * float;
    s.node.style.opacity = clamp(since / 0.1);
    s.node.style.transform = 'translate(-50%, -50%) translateY(' + rise.toFixed(2) + 'px) rotate(' + turn.toFixed(2) + 'deg) scale(' + scale.toFixed(4) + ')';
    return s.node.style.transform + '|' + s.node.style.opacity;
  });
}

// In the hook, Paper Coach is left out of the opening and comes in with step 1; a speed draw, with no steps, has it
// only in the ending's bottom row.
const firstStep = D.plan.segments.find((s) => s.kind === 'step');

window.renderAt = (t) => {
  if (!hookFitted) fitHook();
  const P = D.plan;
  const seg = P.segments.find((s) => t >= s.start && t < s.end) || P.segments[P.segments.length - 1];
  const progress = els.map(() => 0);
  const opacity = els.map(() => 1);
  let ghost = 0;
  let bar = 0;
  let swap = 0;
  let hook = 0;

  if (seg.kind === 'intro') {
    // The finished picture, then it fades (to nothing, or in the hook to a faint guide) as the lesson is drawn fast.
    const F = P.fastDraw;
    ghost = t < F.hold ? 1 : Math.max(F.floor, 1 - (clamp((t - F.hold) / F.fade) * (1 - F.floor)));
    runSequence(els.map((_, i) => i), (t - F.drawFrom) * F.speed, progress);
    setText('chip', P.text.introChip, 1, true);
    setText('title', P.text.introTitle, 1, true);
    hook = P.text.hook ? 1 : 0;
  } else if (seg.kind === 'step') {
    const step = D.tutorial.steps[seg.index];
    const colouring = step.strokes.length === 0;
    // Earlier lines fade while a new one draws, as in the app; colouring shows everything at full strength.
    els.forEach((e, i) => {
      if (e.step < seg.index) {
        progress[i] = 1;
        opacity[i] = colouring ? 1 : e.kind === 'stroke' ? 0.3 : 0.45;
      }
    });
    runSequence(els.map((e, i) => (e.step === seg.index ? i : -1)).filter((i) => i >= 0), t - seg.drawAt, progress);
    if (seg.index === 0) ghost = clamp(1 - (t - seg.start) / 0.35);
    setText('chip', 'Step ' + (seg.index + 1) + ' of ' + D.tutorial.steps.length, t - seg.start, false);
    setText('title', step.title, t - seg.start, false);
    // The bar fills this step's share as the step begins, then holds, so a still moment is a still frame.
    bar = (seg.index + ease((t - seg.start) / 0.5)) / D.tutorial.steps.length;
  } else {
    progress.fill(1);
    bar = 1;
    swap = clamp((t - seg.swapAt) / 0.6);
    setText('chip', P.text.outroChip, t - seg.start, true);
    setText('title', P.text.outroTitle, t - seg.start, true);
  }

  const caption = P.captions.find((c) => t >= c.from && t < c.to);
  setText('caption', caption ? captionHtml(caption, t) : '', caption ? (caption.from === 0 ? 1 : t - caption.from) : 0, true, 0.12);
  const brand = (P.text.hook ? (firstStep ? clamp((t - firstStep.start) / 0.2) : 0) : 1) * (1 - swap);
  $('lina').style.opacity = 1 - swap;
  $('brand').style.opacity = brand;
  $('hook').style.opacity = hook;
  $('cta').style.opacity = swap;
  const stuck = placeStickers(seg.kind === 'outro' ? seg.stickersAt : [], t);

  let active = null;
  els.forEach((e, i) => {
    const p = progress[i];
    if (e.kind === 'stroke') {
      e.node.style.strokeDasharray = e.len + ' ' + e.len;
      e.node.style.strokeDashoffset = e.len * (1 - p);
      if (p > 0 && p < 1) active = { e, p };
    } else {
      e.rect.setAttribute('x', e.box.x);
      e.rect.setAttribute('y', e.box.y);
      e.rect.setAttribute('height', e.box.height);
      e.rect.setAttribute('width', e.box.width * p);
    }
    e.node.style.visibility = p <= 0 ? 'hidden' : 'visible';
    e.node.style.opacity = opacity[i];
  });
  $('ghost').style.opacity = ghost;

  if (active) {
    const point = active.e.node.getPointAtLength(active.e.len * active.p);
    for (const [dot, r] of [[$('tip'), 0.75], [$('halo'), 2.4]]) {
      dot.setAttribute('cx', point.x);
      dot.setAttribute('cy', point.y);
      dot.setAttribute('r', active.e.width * r);
      dot.setAttribute('fill', active.e.colour);
    }
  }
  $('tip').style.visibility = $('halo').style.visibility = active ? 'visible' : 'hidden';
  $('bar').style.width = bar * 100 + '%';

  // Everything this frame shows, so the renderer can reuse the last image when nothing has moved.
  return JSON.stringify([
    progress.map((p) => Math.round(p * 1e5)),
    opacity,
    Math.round(ghost * 1e4),
    Math.round(bar * 1e5),
    Math.round(swap * 1e4),
    Math.round(brand * 1e4),
    hook,
    textState,
    stuck,
  ]);
};
`
