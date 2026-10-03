/**
 * Paper Coach, the full tour (1.1), scene by scene, and what a scene is made of. The raw
 * recordings (`../raw`) were cut by contact sheets: simctl writes frames only when the screen changes,
 * so the drivers' MARK times are not clip times.
 *
 * p01 the balloon lesson (first take), p02 onboarding, Home and search, p03 photo and sketchbook (balloon),
 * p04 All paths and the Plants path, p05 free intros, p06 Premium intros, p07 profiles and settings,
 * p08 the balloon lesson again (preview 16, intro 24, steps from 38), the palm tree photo (119) and the
 * waterfall intro (140), p09 the balloon finished, d01 iPad Home turning, d02 the tugboat on iPad.
 *
 * Every clip is a screen recording of the 1.1 (4) build
 * (`release/1.1`, 81f492a) on scratch simulators: an iPhone 17 Pro (`public/clips/p*`, 604 × 1312)
 * and an iPad Pro 13" (M5) (`public/clips/d*`, 1032 × 1376, always in the iPad's own upright frame;
 * a landscape screen is stored sideways and the device is turned in the edit). Times are in
 * seconds: `from` and `dur` in the clip's own time, `rate` its playback speed, a voice's `at`, a
 * turn's `at` and a paper draw's `at` from the start of its scene. A clip whose `src` ends in .png
 * is a still; `cut` joins a clip to the one before without a fade.
 */

export type Tag = "free" | "premium";
export type Clip = { src: string; from?: number; dur: number; rate?: number; cut?: boolean; lesson?: string; label?: string; tag?: Tag };
export type Voice = { id: string; at: number };
export type Orientation = "portrait" | "landscape";
export type Turn = { at: number; to: Orientation; dur?: number };

/** A step of a lesson drawn on the photographed paper: the strokes of `step` (an index), over `dur`. */
export type PaperDraw = { step: number; at: number; dur: number };

export type Scene = {
  id: string;
  /** device: a phone or iPad with words beside it; desk: the phone on a desk beside a sketchbook;
   * wall: all 110 drawings; duo: iPad and iPhone side by side; chapter: a title card; end: the end card. */
  kind?: "device" | "desk" | "wall" | "duo" | "chapter" | "end";
  chapter?: string;
  headline?: string;
  device?: "phone" | "pad";
  orient?: Orientation;
  turns?: Turn[];
  clips?: Clip[];
  padClips?: Clip[];
  /** For a scene without clips. */
  dur?: number;
  voices: Voice[];
  /** chapter: its number and the drawings around its title. */
  card?: { n: number; title: string; art: string[] };
  /** wall: which lessons stand out. */
  wall?: "all" | "free" | "premium";
  /** desk: what appears on the paper. */
  paper?: { lesson: string; draws: PaperDraw[]; colorAt?: number; colorDur?: number };
};

export const FPS = 30;

export const clipFrames = (c: Clip) => Math.round((c.dur / (c.rate ?? 1)) * FPS);
export const sceneFrames = (s: Scene) =>
  s.clips && s.clips.length > 0 ? s.clips.reduce((n, c) => n + clipFrames(c), 0) : Math.round((s.dur ?? 2) * FPS);

export const SCENES: Scene[] = [
  {
    id: "hook",
    kind: "desk",
    headline: "Learn to draw, step by step",
    clips: [{ src: "p08-retakes", from: 37.6, dur: 76.8, rate: 8 }],
    voices: [{ id: "v01-hook", at: 0.4 }],
    paper: {
      lesson: "hot-air-balloon",
      draws: [
        { step: 0, at: 0.45, dur: 0.5 },
        { step: 1, at: 1.55, dur: 0.5 },
        { step: 2, at: 2.55, dur: 0.4 },
        { step: 3, at: 3.8, dur: 0.6 },
        { step: 4, at: 4.7, dur: 0.5 },
        { step: 5, at: 6.05, dur: 0.5 },
      ],
      colorAt: 7.0,
      colorDur: 2.2,
    },
  },
  {
    id: "meet",
    headline: "Meet Paper Coach",
    device: "phone",
    clips: [{ src: "p02-intro-home-search", from: 32.0, dur: 12.5, rate: 1.2 }],
    voices: [{ id: "v02-meet", at: 0.3 }],
  },
  {
    id: "kit",
    headline: "A pen, paper, five minutes",
    device: "phone",
    clips: [
      { src: "p02-intro-home-search", from: 9.0, dur: 6.8 },
      { src: "hold-kit.png", dur: 1.4, cut: true },
    ],
    voices: [{ id: "v03-kit", at: 0.3 }],
  },
  { id: "card-how", kind: "chapter", dur: 1.8, voices: [], card: { n: 1, title: "How it works", art: ["hot-air-balloon", "rocket", "cactus", "school-bus"] } },
  {
    id: "pick",
    chapter: "How it works",
    headline: "Pick what you'd love to draw",
    device: "phone",
    clips: [{ src: "p02-intro-home-search", from: 58.6, dur: 7.0 }],
    voices: [{ id: "v04-pick", at: 0.3 }],
  },
  {
    id: "preview",
    chapter: "How it works",
    headline: "Every lesson at a glance",
    device: "phone",
    clips: [{ src: "p08-retakes", from: 16.0, dur: 7.6 }],
    voices: [{ id: "v05-preview", at: 0.3 }],
  },
  {
    id: "intro",
    chapter: "How it works",
    headline: "See the whole picture first",
    device: "phone",
    clips: [{ src: "p08-retakes", from: 23.8, dur: 9.2, rate: 1.3 }],
    voices: [{ id: "v06-intro", at: 0.3 }],
  },
  {
    id: "steps",
    kind: "desk",
    headline: "Watch a line, then draw it",
    clips: [
      { src: "p08-retakes", from: 37.6, dur: 9.8, rate: 1.2 },
      { src: "p08-retakes", from: 47.4, dur: 13.0, rate: 2 },
      { src: "p08-retakes", from: 63.6, dur: 7.4 },
    ],
    voices: [
      { id: "v07-steps", at: 0.3 },
      { id: "v08-wait", at: 8.5 },
      { id: "stripes", at: 15.0 },
    ],
    paper: {
      lesson: "hot-air-balloon",
      draws: [
        { step: 0, at: 4.0, dur: 1.8 },
        { step: 1, at: 9.6, dur: 1.2 },
        { step: 2, at: 13.2, dur: 0.7 },
        { step: 3, at: 17.5, dur: 3.0 },
      ],
    },
  },
  {
    id: "color",
    kind: "desk",
    headline: "Finish it in full color",
    clips: [{ src: "p08-retakes", from: 91.5, dur: 22.5, rate: 3 }],
    voices: [{ id: "v09-color", at: 0.3 }],
    paper: {
      lesson: "hot-air-balloon",
      draws: [0, 1, 2, 3, 4, 5].map((step) => ({ step, at: 0, dur: 0 })),
      colorAt: 0.9,
      colorDur: 5.5,
    },
  },
  {
    id: "done",
    chapter: "How it works",
    headline: "A finished picture in minutes",
    device: "phone",
    clips: [
      { src: "p09-done", from: 8.0, dur: 3.45 },
      { src: "hold-done.png", dur: 2.7, cut: true },
    ],
    voices: [{ id: "v10-done", at: 0.3 }],
  },
  {
    id: "photo",
    chapter: "How it works",
    headline: "Snap a photo of your page",
    device: "phone",
    clips: [{ src: "p08-retakes", from: 119.4, dur: 13.0, rate: 1.6 }],
    voices: [{ id: "v11-photo", at: 0.3 }],
  },
  {
    id: "keep",
    chapter: "How it works",
    headline: "Keep every drawing",
    device: "phone",
    clips: [{ src: "p03-finish-photo-book", from: 52.0, dur: 6.0 }],
    voices: [{ id: "v12-keep", at: 0.3 }],
  },
  { id: "card-what", kind: "chapter", dur: 1.8, voices: [], card: { n: 2, title: "So much to draw", art: ["sailboat", "cupcake", "planet-with-rings", "mountain-range"] } },
  {
    id: "wall",
    kind: "wall",
    wall: "all",
    chapter: "So much to draw",
    headline: "110 lessons, 11 paths",
    dur: 5.6,
    voices: [{ id: "v13-wall", at: 0.4 }],
  },
  {
    id: "paths",
    chapter: "So much to draw",
    headline: "Draw what you love",
    device: "phone",
    clips: [{ src: "p04-paths", from: 10.6, dur: 10.9 }],
    voices: [{ id: "v14-paths", at: 0.3 }],
  },
  {
    id: "levels",
    chapter: "So much to draw",
    headline: "Start simple, then level up",
    device: "phone",
    clips: [{ src: "p04-paths", from: 29.8, dur: 11.8, rate: 1.3 }],
    voices: [{ id: "v15-levels", at: 0.3 }],
  },
  { id: "card-free", kind: "chapter", dur: 1.8, voices: [], card: { n: 3, title: "Free and Premium", art: ["donut", "pirate-ship", "watermelon-slice", "bonsai"] } },
  {
    id: "wall-free",
    kind: "wall",
    wall: "free",
    chapter: "Free and Premium",
    headline: "33 lessons, free",
    dur: 4.0,
    voices: [{ id: "v16a-free", at: 0.4 }],
  },
  {
    id: "free",
    chapter: "Free and Premium",
    headline: "Free on every path",
    device: "phone",
    clips: [
      { src: "p05-free", from: 9.8, dur: 7.2, rate: 2.4, lesson: "school-bus", label: "School Bus", tag: "free" },
      { src: "p05-free", from: 28.8, dur: 6.4, rate: 3.2, lesson: "donut", label: "Donut", tag: "free" },
      { src: "p05-free", from: 47.8, dur: 7.6, rate: 2.5, lesson: "tugboat", label: "Tugboat", tag: "free" },
    ],
    voices: [{ id: "v16b-free", at: 0.2 }],
  },
  {
    id: "wall-premium",
    kind: "wall",
    wall: "premium",
    chapter: "Free and Premium",
    headline: "Premium: all 110",
    dur: 5.6,
    voices: [{ id: "v17-premium", at: 0.4 }],
  },
  {
    id: "premium",
    chapter: "Free and Premium",
    headline: "Every lesson with Premium",
    device: "phone",
    clips: [
      { src: "p06-premium", from: 10.8, dur: 8.4, rate: 5.6, lesson: "pirate-ship", label: "Pirate Ship", tag: "premium" },
      { src: "p06-premium", from: 30.8, dur: 8.0, rate: 6.67, lesson: "ramen-bowl", label: "Ramen Bowl", tag: "premium" },
      { src: "p08-retakes", from: 140.8, dur: 7.2, rate: 6, lesson: "waterfall", label: "Waterfall", tag: "premium" },
      { src: "p06-premium", from: 60.8, dur: 8.2, rate: 6.8, lesson: "monster-truck", label: "Monster Truck", tag: "premium" },
      { src: "p06-premium", from: 81.8, dur: 7.8, rate: 6.5, lesson: "sunflower", label: "Sunflower", tag: "premium" },
      { src: "p06-premium", from: 99.8, dur: 9.6, rate: 1.4, lesson: "cafe", label: "Café", tag: "premium" },
    ],
    voices: [
      { id: "v18-premium2", at: 0.2 },
      { id: "v18b-premium3", at: 8.3 },
    ],
  },
  { id: "card-ipad", kind: "chapter", dur: 1.8, voices: [], card: { n: 4, title: "iPhone and iPad", art: ["tugboat", "airplane", "helicopter", "submarine"] } },
  {
    id: "duo",
    kind: "duo",
    chapter: "iPhone and iPad",
    headline: "On iPhone and iPad",
    padClips: [{ src: "d01-home", from: 15.0, dur: 4.2 }],
    clips: [{ src: "p02-intro-home-search", from: 32.0, dur: 4.2 }],
    voices: [{ id: "v19a-ipad", at: 0.3 }],
  },
  {
    id: "turn",
    chapter: "iPhone and iPad",
    headline: "Set it down any way you like",
    device: "pad",
    orient: "portrait",
    turns: [{ at: 1.2, to: "landscape", dur: 0.6 }],
    clips: [
      { src: "d01-home", from: 21.9, dur: 1.2 },
      { src: "freeze-d01.png", dur: 0.6, cut: true },
      { src: "d01-home", from: 23.2, dur: 3.6, cut: true },
    ],
    voices: [{ id: "v19b-ipad", at: 0.3 }],
  },
  {
    id: "studio",
    chapter: "iPhone and iPad",
    headline: "The teacher beside your paper",
    device: "pad",
    orient: "landscape",
    clips: [{ src: "d02-lesson", from: 34.6, dur: 7.4 }],
    voices: [{ id: "v20-studio", at: 0.3 }],
  },
  {
    id: "upright",
    chapter: "iPhone and iPad",
    headline: "Upright, a whole sheet",
    device: "pad",
    orient: "landscape",
    turns: [{ at: 2.1, to: "portrait", dur: 0.6 }],
    clips: [
      { src: "d02-lesson", from: 70.2, dur: 2.1 },
      { src: "freeze-d02.png", dur: 0.6, cut: true },
      { src: "d02-lesson", from: 72.4, dur: 5.6, cut: true },
    ],
    voices: [{ id: "v21-upright", at: 2.0 }],
  },
  { id: "card-home", kind: "chapter", dur: 1.8, voices: [], card: { n: 5, title: "For everyone at home", art: ["gift-box", "ice-cream-cone", "balloon-over-the-hill", "mug"] } },
  {
    id: "family",
    chapter: "For everyone at home",
    headline: "Everyone gets their own",
    device: "phone",
    clips: [
      { src: "p07-family", from: 7.0, dur: 5.8, rate: 1.4 },
      { src: "p07-family", from: 16.0, dur: 5.6, rate: 1.4 },
    ],
    voices: [{ id: "v22-family", at: 0.3 }],
  },
  {
    id: "reminder",
    chapter: "For everyone at home",
    headline: "A small note, not a streak",
    device: "phone",
    clips: [{ src: "p07-family", from: 25.0, dur: 8.6 }],
    voices: [{ id: "v23-reminder", at: 0.3 }],
  },
  {
    id: "quiet",
    chapter: "For everyone at home",
    headline: "My voice, on or off",
    device: "phone",
    clips: [{ src: "p07-family", from: 37.0, dur: 7.2 }],
    voices: [{ id: "v24-quiet", at: 0.3 }],
  },
  { id: "card-tips", kind: "chapter", dur: 1.8, voices: [], card: { n: 6, title: "A few tips", art: ["stack-of-books", "still-life", "star", "paper-airplane"] } },
  {
    id: "tips",
    kind: "desk",
    headline: "A few tips",
    clips: [{ src: "p05-free", from: 47.2, dur: 14.0 }],
    voices: [
      { id: "v25-tips", at: 0.3 },
      { id: "v26-tips2", at: 6.8 },
    ],
    paper: {
      lesson: "tugboat",
      draws: [0, 1, 2, 3, 4, 5, 6].map((step) => ({ step, at: 1.4 + step * 0.72, dur: 0.66 })),
      colorAt: 7.0,
      colorDur: 1.8,
    },
  },
  {
    id: "end",
    kind: "end",
    clips: [{ src: "hold-done.png", dur: 8.6 }],
    voices: [{ id: "v27-end", at: 0.4 }],
  },
];

export const TOTAL_FRAMES = SCENES.reduce((n, s) => n + sceneFrames(s), 0);

/** The cut for X, which takes at most 2:20: the same scenes without these. */
const NOT_ON_X = new Set(["card-how", "preview", "intro", "photo", "upright", "keep", "studio", "card-what", "levels", "card-free", "card-ipad", "card-home", "family", "reminder", "quiet", "card-tips", "tips"]);
export const X_SCENES: Scene[] = SCENES.filter((s) => !NOT_ON_X.has(s.id));
export const X_FRAMES = X_SCENES.reduce((n, s) => n + sceneFrames(s), 0);

/** Where each chapter starts, for the YouTube description. */
export const CHAPTERS: { title: string; at: number }[] = (() => {
  const marks: { title: string; at: number }[] = [{ title: "Learn to draw with Paper Coach", at: 0 }];
  let t = 0;
  for (const s of SCENES) {
    if (s.kind === "chapter" && s.card) marks.push({ title: s.card.title, at: t });
    if (s.kind === "end") marks.push({ title: "Download Paper Coach", at: t });
    t += sceneFrames(s) / FPS;
  }
  return marks;
})();
