/**
 * What's new in Paper Coach 1.1, scene by scene. Every clip is a screen
 * recording of the 1.1 (4) build (`release/1.1`) on scratch simulators:
 * an iPhone 17 Pro (`public/clips`, 604 × 1312) and an iPad Pro 13" (M5)
 * (1032 × 1376, always in the iPad's own upright frame: a landscape screen is
 * stored sideways, and the device is turned in the edit). Times are in seconds:
 * `from` and `dur` in the clip's own time, `rate` its playback speed, a voice's
 * `at` and a turn's `at` from the start of its scene. A clip whose `src` ends in
 * .png is a still; `cut` joins a clip to the one before without a fade.
 */

export type Clip = { src: string; from?: number; dur: number; rate?: number; cut?: boolean };
export type Voice = { id: string; at: number };
export type Orientation = "portrait" | "landscape";
export type Turn = { at: number; to: Orientation; dur?: number };
export type Scene = {
  id: string;
  headline?: string;
  device: "phone" | "pad";
  orient?: Orientation;
  turns?: Turn[];
  clips: Clip[];
  voices: Voice[];
  end?: boolean;
};

export const FPS = 30;

export const SCENES: Scene[] = [
  {
    id: "hook",
    headline: "What's new in Paper Coach 1.1",
    device: "phone",
    clips: [{ src: "hydrant", from: 7.0, dur: 11.4, rate: 1.6 }],
    voices: [{ id: "v01-hook", at: 0.3 }],
  },
  {
    id: "town",
    headline: "A new path: Around Town",
    device: "phone",
    clips: [{ src: "town", from: 23.9, dur: 14.0 }],
    voices: [
      { id: "v02-town", at: 0.3 },
      { id: "v03-count", at: 10.1 },
    ],
  },
  {
    id: "draw",
    headline: "Draw a fire hydrant, step by step",
    device: "phone",
    clips: [
      { src: "hydrant", from: 18.8, dur: 5.8 },
      { src: "hydrant", from: 28.2, dur: 7.2, cut: true },
    ],
    voices: [
      { id: "collar", at: 0.3 },
      { id: "dome", at: 6.2 },
    ],
  },
  {
    id: "ipad",
    headline: "On iPad, every screen turns sideways",
    device: "pad",
    orient: "portrait",
    turns: [{ at: 2.55, to: "landscape", dur: 0.6 }],
    clips: [
      { src: "ipad-rotate", from: 13.0, dur: 2.55 },
      { src: "freeze-rotate.png", dur: 0.6, cut: true },
      { src: "ipad-rotate", from: 15.57, dur: 6.0, cut: true },
    ],
    voices: [{ id: "v04-ipad", at: 0.3 }],
  },
  {
    id: "studio",
    headline: "The teacher beside your paper",
    device: "pad",
    orient: "landscape",
    clips: [{ src: "ipad-lesson", from: 37.6, dur: 9.0 }],
    voices: [{ id: "v05-studio", at: 0.3 }],
  },
  {
    id: "upright",
    headline: "Upright, a sheet of paper",
    device: "pad",
    orient: "landscape",
    turns: [{ at: 1.6, to: "portrait", dur: 0.6 }],
    clips: [
      { src: "ipad-lesson", from: 59.4, dur: 1.6 },
      { src: "freeze-upright.png", dur: 0.6, cut: true },
      { src: "ipad-lesson", from: 61.03, dur: 7.0, cut: true },
    ],
    voices: [{ id: "v06-upright", at: 1.2 }],
  },
  {
    id: "photo",
    headline: "Photos taken in dim light",
    device: "phone",
    clips: [
      { src: "photo", from: 6.0, dur: 5.6, rate: 0.9 },
      { src: "photo", from: 11.65, dur: 3.0, cut: true },
      { src: "photo", from: 15.95, dur: 4.0, cut: true },
    ],
    voices: [
      { id: "v07-photo", at: 0.3 },
      { id: "v08-photo2", at: 6.4 },
    ],
  },
  {
    id: "edit",
    headline: "Fix a kept page any time",
    device: "phone",
    clips: [
      { src: "edit", from: 4.6, dur: 7.4, rate: 2 },
      { src: "edit", from: 15.0, dur: 7.4, rate: 2 },
      { src: "edit", from: 26.6, dur: 2.4, rate: 1.5 },
    ],
    voices: [{ id: "v09-edit", at: 0.3 }],
  },
  {
    id: "time",
    headline: "Your real drawing time",
    device: "phone",
    clips: [
      { src: "hydrant", from: 149.5, dur: 6.0 },
      { src: "hold-completion.png", dur: 0.8, cut: true },
    ],
    voices: [{ id: "v10-time", at: 0.3 }],
  },
  {
    id: "colors",
    headline: "A color for every path",
    device: "phone",
    clips: [{ src: "town", from: 14.0, dur: 7.6 }],
    voices: [{ id: "v11-colors", at: 0.3 }],
  },
  {
    id: "new",
    headline: "New here? How it works",
    device: "phone",
    clips: [{ src: "preview", from: 4.6, dur: 3.5 }],
    voices: [{ id: "v12-new", at: 0.2 }],
  },
  {
    id: "watch",
    headline: "Watch a line, then draw it",
    device: "phone",
    clips: [{ src: "hydrant", from: 37.6, dur: 6.8 }],
    voices: [{ id: "v13-watch", at: 0.2 }],
  },
  {
    id: "color",
    headline: "Finish it in full color",
    device: "phone",
    clips: [{ src: "hydrant", from: 95.0, dur: 51.0, rate: 9 }],
    voices: [{ id: "v14-color", at: 0.2 }],
  },
  {
    id: "keep",
    headline: "Keep every drawing",
    device: "phone",
    clips: [{ src: "sketchbook", from: 4.0, dur: 4.5 }],
    voices: [{ id: "v15-keep", at: 0.2 }],
  },
  {
    id: "end",
    device: "phone",
    clips: [{ src: "hold-cafe.png", dur: 8.4 }],
    voices: [{ id: "v16-end", at: 0.3 }],
    end: true,
  },
];

export const clipFrames = (c: Clip) => Math.round((c.dur / (c.rate ?? 1)) * FPS);
export const sceneFrames = (s: Scene) => s.clips.reduce((n, c) => n + clipFrames(c), 0);
export const totalFrames = SCENES.reduce((n, s) => n + sceneFrames(s), 0);
