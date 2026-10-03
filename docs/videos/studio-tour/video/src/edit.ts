/**
 * The Studio tour, section by section. Each section lists what is heard, in order (the narrator's
 * lines, Lina, the lesson video), and the shots seen under it; times are worked out from the takes'
 * lengths (captions.json), so a new take moves everything after it.
 *
 * The clips (`public/clips`, 2880 × 1620) are recordings of the live Studio in the light theme
 * (`../rec/record.mjs`): the Learners ones at a 1152-pixel-wide page, the rest at 1440. A shot plays
 * a clip from `from` (seconds) at `rate`, or holds that frame (`freeze`), until the start of an item
 * (`until: "p3"`, or `["p3", 1.5]` for 1.5 s after it) or the end of its section. Its camera moves
 * through `cam` keyframes: `p` is how far through the shot (0 to 1), `x` and `y` the point looked at
 * (fractions of the frame), `z` the zoom.
 */
import captions from "./captions.json";

export const FPS = 30;

export type Cam = { p: number; x: number; y: number; z: number };
export type Until = string | [string, number] | number;
export type Shot = { clip: string; from?: number; rate?: number; freeze?: boolean; until?: Until; cam?: Cam[] };
export type Item =
  | { voice: string; gap?: number }
  | { lina: string; gap?: number }
  | { pip: string; dur: number; gap?: number }
  | { pause: number };
export type Sfx = { src: string; at: [string, number]; label: string };
export type Callout = { at: [string, number]; dur: number; text: string };
export type Section = {
  id: string;
  title?: string;
  lead?: number;
  tail?: number;
  items: Item[];
  shots: Shot[];
  sfx?: Sfx[];
  callouts?: Callout[];
};

type Caption = { text: string; duration: number; words: { text: string; start: number; end: number }[] };
export const CAPTIONS = captions as Record<string, Caption>;

const GAP = 0.3;

export const SECTIONS: Section[] = [
  {
    id: "intro",
    lead: 0.6,
    tail: 0.4,
    items: [{ voice: "i1" }, { voice: "i2", gap: 0.35 }],
    shots: [
      { clip: "TITLE", until: 3.9 },
      { clip: "nav", from: 0.1, rate: 1.25, cam: [{ p: 0, x: 0.5, y: 0.5, z: 1.04 }, { p: 1, x: 0.5, y: 0.45, z: 1.1 }] },
    ],
  },
  {
    id: "paths",
    title: "Paths",
    tail: 0.45,
    items: [{ voice: "p1" }, { voice: "p2" }, { voice: "p3" }, { voice: "p4" }],
    shots: [
      {
        clip: "paths", from: 1.0, rate: 1.25, until: "p2",
        cam: [{ p: 0, x: 0.5, y: 0.5, z: 1.0 }, { p: 0.16, x: 0.1, y: 0.42, z: 1.9 }, { p: 0.45, x: 0.1, y: 0.42, z: 1.9 }, { p: 0.62, x: 0.55, y: 0.55, z: 1.12 }, { p: 1, x: 0.55, y: 0.55, z: 1.15 }],
      },
      { clip: "paths", from: 11.25, until: ["p2", 1.7], cam: [{ p: 0, x: 0.42, y: 0.75, z: 1.25 }, { p: 1, x: 0.5, y: 0.5, z: 1.0 }] },
      // The drawing coloured by step while that is said; the replay starts on "in the order a real person would draw it".
      { clip: "lessonPlay", from: 0.3, freeze: true, until: ["p2", 3.7], cam: [{ p: 0, x: 0.46, y: 0.56, z: 1.3 }, { p: 1, x: 0.46, y: 0.56, z: 1.45 }] },
      { clip: "lessonPlay", from: 0.3, until: ["p3", 2.2], cam: [{ p: 0, x: 0.46, y: 0.56, z: 1.45 }, { p: 1, x: 0.46, y: 0.56, z: 1.55 }] },
      { clip: "lessonPlay", from: 6.7, until: "p4", cam: [{ p: 0, x: 0.46, y: 0.56, z: 1.55 }, { p: 0.3, x: 0.855, y: 0.42, z: 1.85 }, { p: 1, x: 0.855, y: 0.47, z: 1.85 }] },
      {
        clip: "lessonSteps", from: 7.0, rate: 1.45,
        cam: [{ p: 0, x: 0.5, y: 0.5, z: 1.05 }, { p: 0.55, x: 0.5, y: 0.5, z: 1.05 }, { p: 0.68, x: 0.36, y: 0.6, z: 1.3 }, { p: 0.8, x: 0.36, y: 0.6, z: 1.3 }, { p: 0.92, x: 0.72, y: 0.075, z: 1.9 }, { p: 1, x: 0.72, y: 0.075, z: 1.9 }],
      },
    ],
    callouts: [{ at: ["p3", 3.2], dur: 3.8, text: "The steps and Lina’s words: planned by Claude" }],
  },
  {
    id: "voice",
    title: "Voice",
    tail: 0.4,
    items: [{ voice: "v1" }, { voice: "v2" }, { lina: "lina-wobble", gap: 0.4 }, { voice: "v3", gap: 0.45 }],
    shots: [
      { clip: "voice", from: 0, rate: 0.75, until: "v2", cam: [{ p: 0, x: 0.2, y: 0.17, z: 1.9 }, { p: 0.5, x: 0.2, y: 0.17, z: 1.9 }, { p: 0.74, x: 0.5, y: 0.5, z: 1.0 }, { p: 1, x: 0.5, y: 0.5, z: 1.0 }] },
      { clip: "voice", from: 5.15, freeze: true, until: "lina-wobble", cam: [{ p: 0, x: 0.5, y: 0.5, z: 1.0 }, { p: 0.1, x: 0.15, y: 0.33, z: 2.1 }, { p: 0.5, x: 0.15, y: 0.33, z: 2.1 }, { p: 0.65, x: 0.5, y: 0.42, z: 1.15 }, { p: 1, x: 0.5, y: 0.42, z: 1.18 }] },
      { clip: "voice", from: 5.3, until: "v3", cam: [{ p: 0, x: 0.15, y: 0.48, z: 1.9 }, { p: 1, x: 0.15, y: 0.48, z: 1.95 }] },
      {
        clip: "voice", from: 12.3,
        cam: [{ p: 0, x: 0.14, y: 0.72, z: 2.0 }, { p: 0.13, x: 0.14, y: 0.72, z: 2.0 }, { p: 0.24, x: 0.5, y: 0.5, z: 1.0 }, { p: 0.44, x: 0.5, y: 0.45, z: 1.2 }, { p: 1, x: 0.45, y: 0.5, z: 1.35 }],
      },
    ],
    callouts: [{ at: ["v3", 6.2], dur: 4.2, text: "Made on Zak’s own Mac · no cloud" }],
  },
  {
    id: "learners",
    title: "Learners",
    tail: 0.45,
    items: [
      { voice: "l1" }, { voice: "l2" }, { voice: "l3" }, { voice: "l4", gap: 1.3 }, { voice: "l5" }, { voice: "l6" },
      { voice: "l7" }, { voice: "k1" }, { voice: "k2" }, { voice: "l8" },
    ],
    sfx: [
      { src: "install", at: ["l3", 3.2], label: "An install" },
      { src: "trial", at: ["l3", 5.0], label: "A free trial" },
      { src: "buy", at: ["l3", 7.28], label: "A sale!" },
    ],
    shots: [
      { clip: "learnersTop", from: 0.2, rate: 0.6, until: "l2", cam: [{ p: 0, x: 0.5, y: 0.5, z: 1.0 }, { p: 1, x: 0.5, y: 0.5, z: 1.08 }] },
      { clip: "learnersTop", from: 0.8, rate: 0.45, until: "l3", cam: [{ p: 0, x: 0.17, y: 0.33, z: 2.2 }, { p: 0.36, x: 0.17, y: 0.33, z: 2.2 }, { p: 0.52, x: 0.5, y: 0.64, z: 1.28 }, { p: 1, x: 0.5, y: 0.64, z: 1.32 }] },
      {
        clip: "learnersTop", from: 4.7, freeze: true, until: "l4",
        cam: [{ p: 0, x: 0.5, y: 0.64, z: 1.32 }, { p: 0.3, x: 0.095, y: 0.65, z: 2.4 }, { p: 0.46, x: 0.095, y: 0.65, z: 2.4 }, { p: 0.54, x: 0.775, y: 0.65, z: 2.4 }, { p: 0.72, x: 0.775, y: 0.65, z: 2.4 }, { p: 0.8, x: 0.91, y: 0.65, z: 2.4 }, { p: 1, x: 0.91, y: 0.65, z: 2.4 }],
      },
      { clip: "learnersTop", from: 4.84, rate: 0.5, until: "l5", cam: [{ p: 0, x: 0.5, y: 0.6, z: 1.05 }, { p: 0.38, x: 0.26, y: 0.44, z: 1.85 }, { p: 1, x: 0.26, y: 0.44, z: 1.85 }] },
      {
        clip: "learnersTop", from: 9.03, rate: 0.62, until: "l6",
        cam: [{ p: 0, x: 0.75, y: 0.42, z: 1.75 }, { p: 0.2, x: 0.75, y: 0.42, z: 1.75 }, { p: 0.3, x: 0.5, y: 0.5, z: 1.05 }, { p: 0.5, x: 0.5, y: 0.5, z: 1.05 }, { p: 0.58, x: 0.3, y: 0.42, z: 1.85 }, { p: 0.76, x: 0.3, y: 0.42, z: 1.85 }, { p: 0.84, x: 0.79, y: 0.33, z: 2.0 }, { p: 1, x: 0.79, y: 0.33, z: 2.0 }],
      },
      { clip: "learnersTop", from: 19.6, rate: 0.95, until: "l7", cam: [{ p: 0, x: 0.5, y: 0.5, z: 1.05 }, { p: 0.22, x: 0.45, y: 0.48, z: 1.85 }, { p: 0.55, x: 0.45, y: 0.48, z: 1.85 }, { p: 0.68, x: 0.68, y: 0.68, z: 2.0 }, { p: 1, x: 0.68, y: 0.68, z: 2.0 }] },
      { clip: "learnersTop", from: 29.2, rate: 0.9, until: ["l7", 6.0], cam: [{ p: 0, x: 0.5, y: 0.5, z: 1.0 }, { p: 0.45, x: 0.5, y: 0.55, z: 1.0 }, { p: 1, x: 0.45, y: 0.6, z: 1.3 }] },
      { clip: "learnersSession", from: 0.2, until: "k1", cam: [{ p: 0, x: 0.5, y: 0.43, z: 1.25 }, { p: 0.35, x: 0.36, y: 0.43, z: 1.9 }, { p: 0.85, x: 0.36, y: 0.43, z: 1.9 }, { p: 1, x: 0.45, y: 0.5, z: 1.4 }] },
      { clip: "learnersSession", from: 5.04, rate: 0.75, until: "k2", cam: [{ p: 0, x: 0.4, y: 0.45, z: 1.2 }, { p: 0.52, x: 0.4, y: 0.5, z: 1.2 }, { p: 0.62, x: 0.32, y: 0.63, z: 1.95 }, { p: 1, x: 0.32, y: 0.63, z: 1.95 }] },
      { clip: "learnersSession", from: 12.38, rate: 0.72, until: "l8", cam: [{ p: 0, x: 0.4, y: 0.5, z: 1.2 }, { p: 0.25, x: 0.4, y: 0.5, z: 1.2 }, { p: 0.34, x: 0.34, y: 0.53, z: 1.8 }, { p: 0.7, x: 0.34, y: 0.53, z: 1.8 }, { p: 0.8, x: 0.4, y: 0.5, z: 1.2 }, { p: 1, x: 0.4, y: 0.5, z: 1.2 }] },
      { clip: "learnersPeriod", from: 0, rate: 0.6, cam: [{ p: 0, x: 0.5, y: 0.6, z: 1.15 }, { p: 0.55, x: 0.5, y: 0.6, z: 1.15 }, { p: 0.68, x: 0.62, y: 0.42, z: 1.6 }, { p: 1, x: 0.62, y: 0.42, z: 1.6 }] },
    ],
    callouts: [
      { at: ["l2", 0.2], dur: 3.6, text: "Live from PostHog · every minute" },
      { at: ["k2", 5.6], dur: 4.0, text: "Cancellations: from Apple, through Superwall" },
    ],
  },
  {
    id: "social",
    title: "Social",
    tail: 0.5,
    items: [{ voice: "s1" }, { voice: "s2" }, { voice: "s3" }, { pip: "mushroom", dur: 6.3, gap: 0.2 }, { voice: "s4", gap: 0.35 }],
    shots: [
      { clip: "social", from: 0, rate: 0.8, until: "s2", cam: [{ p: 0, x: 0.22, y: 0.13, z: 1.9 }, { p: 0.55, x: 0.22, y: 0.13, z: 1.9 }, { p: 1, x: 0.45, y: 0.45, z: 1.2 }] },
      { clip: "social", from: 2.4, freeze: true, until: "s3", cam: [{ p: 0, x: 0.45, y: 0.45, z: 1.2 }, { p: 0.15, x: 0.5, y: 0.62, z: 1.4 }, { p: 1, x: 0.5, y: 0.62, z: 1.42 }] },
      { clip: "social", from: 6.3, rate: 0.9, until: "mushroom", cam: [{ p: 0, x: 0.5, y: 0.5, z: 1.1 }, { p: 0.5, x: 0.5, y: 0.52, z: 1.35 }, { p: 1, x: 0.5, y: 0.52, z: 1.35 }] },
      { clip: "social", from: 9.9, freeze: true, until: "s4", cam: [{ p: 0, x: 0.5, y: 0.52, z: 1.35 }, { p: 1, x: 0.5, y: 0.52, z: 1.35 }] },
      { clip: "social", from: 4.0, rate: 0.6, cam: [{ p: 0, x: 0.45, y: 0.6, z: 1.2 }, { p: 1, x: 0.45, y: 0.62, z: 1.35 }] },
    ],
  },
  {
    id: "docs",
    title: "Docs",
    // YouTube's chapters are 10 s or more.
    tail: 2.6,
    items: [{ voice: "d1" }],
    shots: [
      { clip: "docs", from: 0.6, until: ["d1", 4.6], cam: [{ p: 0, x: 0.3, y: 0.3, z: 1.6 }, { p: 0.4, x: 0.3, y: 0.3, z: 1.6 }, { p: 1, x: 0.38, y: 0.55, z: 1.35 }] },
      { clip: "docs", from: 11.95, freeze: true, until: ["d1", 6.4], cam: [{ p: 0, x: 0.13, y: 0.23, z: 2.3 }, { p: 1, x: 0.13, y: 0.23, z: 2.3 }] },
      { clip: "docs", from: 12.2, rate: 1.2, cam: [{ p: 0, x: 0.3, y: 0.3, z: 1.4 }, { p: 1, x: 0.5, y: 0.55, z: 1.2 }] },
    ],
  },
  {
    id: "today",
    title: "Today",
    tail: 0.5,
    items: [{ voice: "t1" }, { voice: "t2" }, { voice: "t3" }],
    shots: [
      { clip: "today", from: 0, rate: 0.6, until: "t2", cam: [{ p: 0, x: 0.22, y: 0.2, z: 2.0 }, { p: 0.5, x: 0.22, y: 0.2, z: 2.0 }, { p: 1, x: 0.36, y: 0.3, z: 1.5 }] },
      { clip: "today", from: 2.61, rate: 0.85, until: "t3", cam: [{ p: 0, x: 0.36, y: 0.45, z: 1.3 }, { p: 0.3, x: 0.5, y: 0.45, z: 1.15 }, { p: 0.75, x: 0.5, y: 0.45, z: 1.15 }, { p: 1, x: 0.5, y: 0.55, z: 1.1 }] },
      {
        clip: "today", from: 8.0,
        cam: [{ p: 0, x: 0.47, y: 0.68, z: 1.5 }, { p: 0.2, x: 0.47, y: 0.68, z: 1.5 }, { p: 0.32, x: 0.5, y: 0.5, z: 1.05 }, { p: 0.45, x: 0.77, y: 0.56, z: 1.7 }, { p: 0.78, x: 0.77, y: 0.56, z: 1.7 }, { p: 1, x: 0.5, y: 0.5, z: 1.1 }],
      },
    ],
  },
  {
    id: "outro",
    lead: 0.3,
    tail: 3.2,
    items: [{ voice: "o1" }],
    shots: [{ clip: "END" }],
  },
];

/** The heard items of a section with their start and end, in seconds from its start. */
export type Placed = { key: string; kind: "voice" | "lina" | "pip"; id: string; start: number; end: number };

export type Resolved = {
  section: Section;
  start: number;
  dur: number;
  placed: Placed[];
  shots: (Shot & { start: number; end: number })[];
  sfx: (Sfx & { t: number })[];
  callouts: (Callout & { t: number })[];
};

const itemLength = (item: Item) =>
  "voice" in item ? CAPTIONS[item.voice].duration : "lina" in item ? CAPTIONS[item.lina].duration : "pip" in item ? item.dur : item.pause;

export function resolve(sections: Section[] = SECTIONS): Resolved[] {
  let at = 0;
  return sections.map((section) => {
    const placed: Placed[] = [];
    let t = section.lead ?? 0.25;
    section.items.forEach((item, index) => {
      if ("pause" in item) {
        t += item.pause;
        return;
      }
      if (index > 0) t += item.gap ?? GAP;
      const id = "voice" in item ? item.voice : "lina" in item ? item.lina : item.pip;
      const kind = "voice" in item ? "voice" : "lina" in item ? "lina" : "pip";
      placed.push({ key: id, kind, id, start: t, end: t + itemLength(item) });
      t += itemLength(item);
    });
    const dur = Math.round((t + (section.tail ?? 0.4)) * FPS) / FPS;
    const startOf = (key: string) => {
      const found = placed.find((p) => p.key === key);
      if (!found) throw new Error(`${section.id}: no item ${key}`);
      return found.start;
    };
    const time = (until: Until | undefined) =>
      until === undefined ? dur : typeof until === "number" ? until : typeof until === "string" ? startOf(until) : startOf(until[0]) + until[1];
    let shotStart = 0;
    const shots = section.shots.map((shot) => {
      const end = Math.round(time(shot.until) * FPS) / FPS;
      const resolved = { ...shot, start: shotStart, end };
      shotStart = end;
      return resolved;
    });
    const result: Resolved = {
      section,
      start: at,
      dur,
      placed,
      shots,
      sfx: (section.sfx ?? []).map((s) => ({ ...s, t: startOf(s.at[0]) + s.at[1] })),
      callouts: (section.callouts ?? []).map((c) => ({ ...c, t: startOf(c.at[0]) + c.at[1] })),
    };
    at += dur;
    return result;
  });
}

export const RESOLVED = resolve();
export const TOTAL_FRAMES = Math.round(RESOLVED.reduce((n, r) => n + r.dur, 0) * FPS);
