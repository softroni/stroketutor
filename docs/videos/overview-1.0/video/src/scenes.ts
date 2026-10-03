/**
 * The Paper Coach 1.0 overview, scene by scene. Every clip is a screen
 * recording of the 1.0 (2) build on an iPad simulator, upright (`public/clips`,
 * 1032 × 1376). Times are in seconds: `from` and `dur` in the clip's own time,
 * `rate` its playback speed, and a voice's `at` from the start of its scene.
 */

export type Clip = { src: string; from: number; dur: number; rate?: number };
export type Voice = { id: string; at: number };
export type Scene = {
  id: string;
  headline?: string;
  clips: Clip[];
  voices: Voice[];
  /** Extra seconds after the clips, holding `holdImage` on the iPad. */
  hold?: number;
  holdImage?: string;
  end?: boolean;
};

export const FPS = 30;

export const SCENES: Scene[] = [
  {
    id: "hook",
    headline: "Learn to draw, step by step",
    clips: [{ src: "intro", from: 0.8, dur: 4.2 }],
    voices: [{ id: "v01-hook", at: 0.5 }],
  },
  {
    id: "method",
    headline: "Watch a line, then draw it",
    clips: [{ src: "method", from: 0, dur: 9.2 }],
    voices: [{ id: "v02-lina", at: 0.4 }],
  },
  {
    id: "setup",
    headline: "Draw what you love",
    clips: [
      { src: "setup-level", from: 1.0, dur: 3.6, rate: 1.5 },
      { src: "setup-path", from: 1.0, dur: 2.9, rate: 1.5 },
      { src: "setup-ready", from: 0.2, dur: 4.3, rate: 1.5 },
    ],
    voices: [{ id: "v03-pick", at: 0.3 }],
  },
  {
    id: "lesson",
    headline: "One line at a time",
    clips: [{ src: "steps12", from: 0, dur: 13.0 }],
    voices: [
      { id: "deck", at: 0.0 },
      { id: "hull", at: 6.0 },
    ],
  },
  {
    id: "pace",
    headline: "The pace is yours",
    clips: [
      { src: "steps34", from: 0, dur: 8.2, rate: 2.2 },
      { src: "step5", from: 0, dur: 5.5, rate: 2.2 },
    ],
    voices: [{ id: "v06-pace", at: 0.5 }],
  },
  {
    id: "color",
    headline: "Finish it in full color",
    clips: [
      { src: "color", from: 0, dur: 11.5, rate: 2 },
      { src: "complete", from: 0, dur: 3.6 },
    ],
    voices: [
      { id: "color-hull", at: 0.1 },
      { id: "v07-color", at: 2.0 },
    ],
  },
  {
    id: "keep",
    headline: "Keep every drawing",
    clips: [
      { src: "corners", from: 0.5, dur: 2.2 },
      { src: "saved", from: 0.4, dur: 2.2 },
      { src: "sketchbook", from: 0.5, dur: 2.6 },
    ],
    voices: [{ id: "v08-keep", at: 0.3 }],
  },
  {
    id: "more",
    headline: "Start simple, then level up",
    clips: [
      { src: "more", from: 0.8, dur: 2.4 },
      { src: "lessons", from: 2.0, dur: 7.0, rate: 2 },
      { src: "path", from: 0.5, dur: 3.0 },
    ],
    voices: [{ id: "v09-more", at: 0.3 }],
  },
  {
    id: "family",
    headline: "A sketchbook for everyone at home",
    clips: [{ src: "who", from: 0.5, dur: 5.2 }],
    voices: [{ id: "v10-family", at: 0.3 }],
  },
  {
    id: "end",
    clips: [
      { src: "kit", from: 0, dur: 3.1 },
      { src: "splash", from: 0, dur: 3.7 },
    ],
    voices: [{ id: "v11-end", at: 0.2 }],
    hold: 1.6,
    holdImage: "clips/splash-hold.png",
    end: true,
  },
];

export const clipFrames = (c: Clip) => Math.round((c.dur / (c.rate ?? 1)) * FPS);
export const sceneFrames = (s: Scene) =>
  s.clips.reduce((n, c) => n + clipFrames(c), 0) + Math.round((s.hold ?? 0) * FPS);
export const totalFrames = SCENES.reduce((n, s) => n + sceneFrames(s), 0);
