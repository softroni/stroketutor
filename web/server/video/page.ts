import type { Tutorial } from '../../src/schema/types'

import type { VideoPlan } from './plan'

/** The video's frame, in CSS pixels; `render.ts` draws it at twice this and scales down. */
export const FRAME = { width: 1080, height: 1920 }

export interface PageAssets {
  /** Fredoka, the App Store screenshots' face, as base64 TTF. */
  font: string
  /** The app icon, as base64 PNG. */
  icon: string
  /** Apple's "Download on the App Store" badge as SVG text, when the repository has it. */
  badge: string | null
}

/**
 * The page every frame is a screenshot of. It carries the lesson, the plan and
 * the assets inline, draws nothing on its own, and exposes `renderAt(t)`, which
 * sets every element for the moment `t` seconds in and returns a signature of
 * what is on screen. So a frame depends only on `t`, a render is exact and
 * repeatable, and two frames with the same signature are the same picture.
 *
 * The look follows the App Store screenshots: the Paper Coach greens, Fredoka,
 * and the drawing on a white card. Everything sits between y 146 and 1622, clear
 * of the bar the platforms put at the top and of their captions and buttons at
 * the bottom.
 */
export function videoPage(tutorial: Tutorial, plan: VideoPlan, assets: PageAssets): string {
  const data = { tutorial, plan, ink: normaliseColour(tutorial.style?.strokeColor) ?? '#141414' }
  const icon = `data:image/png;base64,${assets.icon}`
  const badge = assets.badge ? `data:image/svg+xml;base64,${Buffer.from(assets.badge).toString('base64')}` : null
  return `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  @font-face { font-family: 'Fredoka'; src: url(data:font/ttf;base64,${assets.font}) format('truetype'); font-weight: 300 700; font-stretch: 75% 125%; }
  :root { --green-light: #26B571; --green: #1FA463; --green-deep: #127544; --highlight: #FFE08A; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${FRAME.width}px; height: ${FRAME.height}px; overflow: hidden; }
  body {
    font-family: 'Fredoka', sans-serif; color: #fff;
    background:
      radial-gradient(ellipse 75% 45% at 50% 45%, rgba(255, 255, 255, 0.16), transparent 70%),
      linear-gradient(168deg, var(--green-light) 0%, var(--green) 40%, var(--green-deep) 100%);
  }
  /* A fine, still grain over the green, so the platforms' re-encoding doesn't band the gradient. */
  .grain {
    position: absolute; inset: 0; opacity: 0.08; mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  }
  .brand {
    position: absolute; top: 146px; left: 0; right: 0;
    display: flex; align-items: center; justify-content: center; gap: 20px;
    font-size: 54px; font-weight: 600; letter-spacing: -0.01em; text-shadow: 0 0.05em 0.25em rgba(0, 0, 0, 0.14);
  }
  .brand img { width: 84px; height: 84px; border-radius: 20px; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22); }
  .chip {
    position: absolute; top: 272px; left: 50%; transform: translateX(-50%);
    padding: 8px 28px 11px; border-radius: 40px; background: rgba(0, 0, 0, 0.16);
    font-size: 36px; font-weight: 500; letter-spacing: 0.01em; white-space: nowrap;
  }
  .title {
    position: absolute; top: 346px; left: 60px; right: 60px; height: 156px;
    display: flex; align-items: center; justify-content: center; text-align: center;
    font-size: 74px; font-weight: 600; line-height: 1.04; letter-spacing: -0.012em;
    text-shadow: 0 0.05em 0.25em rgba(0, 0, 0, 0.14);
  }
  .title > span, .caption > span { text-wrap: balance; }
  .title em { font-style: normal; color: var(--highlight); }
  .title small { display: block; margin-top: 14px; font-size: 42px; font-weight: 500; letter-spacing: 0; opacity: 0.95; }
  .progress { position: absolute; top: 526px; left: 100px; width: 880px; height: 12px; border-radius: 6px; background: rgba(0, 0, 0, 0.16); overflow: hidden; }
  .progress > div { height: 100%; width: 0; background: var(--highlight); border-radius: 6px; }
  .card {
    position: absolute; top: 562px; left: 100px; width: 880px; height: 880px;
    background: #fff; border-radius: 44px; box-shadow: 0 30px 60px rgba(0, 0, 0, 0.30);
  }
  .card svg { position: absolute; inset: 34px; width: calc(100% - 68px); height: calc(100% - 68px); }
  /* The bottom row: Lina and her words, and at the end Paper Coach and the call to action, in the same place. */
  .row {
    position: absolute; top: 1470px; left: 100px; right: 120px; height: 152px;
    display: flex; align-items: center; gap: 28px;
  }
  .face { flex: none; width: 116px; height: 116px; border-radius: 50%; border: 5px solid #fff; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22); overflow: hidden; }
  .face svg { display: block; width: 100%; height: 100%; }
  .caption { font-size: 42px; font-weight: 500; line-height: 1.2; text-shadow: 0 2px 12px rgba(0, 0, 0, 0.25); }
  .cta { opacity: 0; }
  .cta > img { flex: none; width: 116px; height: 116px; border-radius: 27px; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22); }
  .cta b { display: block; font-size: 58px; font-weight: 600; line-height: 1.1; letter-spacing: -0.01em; text-shadow: 0 0.05em 0.25em rgba(0, 0, 0, 0.14); }
  .cta .line { display: flex; align-items: center; gap: 22px; margin-top: 8px; font-size: 38px; font-weight: 500; color: var(--highlight); }
  /* Apple's badge, as supplied: never recoloured, stretched or moved, only faded in with the rest. */
  .cta .badge { display: block; height: 72px; width: auto; }
</style></head>
<body>
  <div class="grain"></div>
  <div class="brand" id="brand"><img src="${icon}" alt=""><span>Paper Coach</span></div>
  <div class="chip" id="chip"></div>
  <div class="title" id="title"></div>
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
  <div class="row" id="lina"><div class="face">${LINA_FACE}</div><div class="caption" id="caption"></div></div>
  <div class="row cta" id="cta">
    <img src="${icon}" alt="">
    <div><b>Paper Coach</b><div class="line">${badge ? `<img class="badge" src="${badge}" alt="Download on the App Store">` : ''}<span>${plan.text.cta}</span></div></div>
  </div>
<script>
const D = ${JSON.stringify(data).replace(/</g, '\\u003c')};
${FRAME_SCRIPT}
</script></body></html>`
}

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

// Text fades and rises in over 0.2 s whenever it changes. What each text shows, and how far in, goes into the frame's signature.
const shown = {};
const textState = {};
function setText(id, value, since, asHtml) {
  const node = $(id);
  if (shown[id] !== value) {
    node.textContent = '';
    if (value) {
      const span = document.createElement('span');
      if (asHtml) span.innerHTML = value; else span.textContent = value;
      node.appendChild(span);
    }
    shown[id] = value;
  }
  const a = value ? clamp(since / 0.2) : 0;
  node.style.opacity = a;
  node.style.translate = '0 ' + (1 - a) * 10 + 'px';
  textState[id] = (value || '') + '|' + a.toFixed(3);
}

const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);

window.renderAt = (t) => {
  const P = D.plan;
  const seg = P.segments.find((s) => t >= s.start && t < s.end) || P.segments[P.segments.length - 1];
  const progress = els.map(() => 0);
  const opacity = els.map(() => 1);
  let ghost = 0;
  let bar = 0;
  let swap = 0;

  if (seg.kind === 'intro') {
    ghost = t < P.hook.hold ? 1 : clamp(1 - (t - P.hook.hold) / 0.25);
    runSequence(els.map((_, i) => i), (t - P.hook.drawFrom) * P.hook.speed, progress);
    setText('chip', P.text.introChip, 1, true);
    setText('title', P.text.introTitle, 1, true);
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
    setText('chip', '', 0, false);
    setText('title', P.text.outroTitle, t - seg.start, true);
  }

  const caption = P.captions.find((c) => t >= c.from && t < c.to);
  setText('caption', caption ? caption.text : '', caption ? (caption.from === 0 ? 1 : t - caption.from) : 0, false);
  $('lina').style.opacity = 1 - swap;
  $('brand').style.opacity = 1 - swap;
  $('cta').style.opacity = swap;

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
    textState,
  ]);
};
`
