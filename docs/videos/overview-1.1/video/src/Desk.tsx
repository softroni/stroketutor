import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";

import { CAPTIONS, Clips, Device, INK, LinaSays, clamp, ease } from "./Overview";
import strokesData from "./strokes.json";
import { FPS, Scene, sceneFrames } from "./scenes";

type Stroke = { d: string; w: number; dur: number };
type Lesson = { id: string; steps: { id: string; strokes: Stroke[] }[] };
const STROKES = strokesData as Record<string, Lesson>;

// The photo (Pixabay 1558811, 1280 × 851): a spiral sketchbook on a dark wooden desk. Its page is
// centred on (640.5, 433.75), turned 8.8° anticlockwise. Scaled up so the page fills the right of the
// frame and the phone lies on the wood to its left.
const PHOTO = { w: 1280, h: 851, scale: 1.9, left: -17, top: -284 };
const PAGE = { cx: 640.5, cy: 433.75, rotate: -8.8 };
// Where the drawing sits on the page, in the photo's pixels from the page's centre (before its turn).
const DRAWING = { dx: -4, dy: -40, size: 330 };

/** The phone on the desk beside a sketchbook, the lesson drawing itself on the page as you would. */
export const Desk: React.FC<{ scene: Scene; continued?: boolean }> = ({ scene, continued }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const total = sceneFrames(scene);
  const drift = interpolate(frame, [0, total], [1, 1.03]);
  const fade = continued ? 1 : interpolate(frame, [0, 10], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: "#3B2414", overflow: "hidden", opacity: fade }}>
      <div style={{ position: "absolute", inset: 0, scale: `${drift}`, transformOrigin: "62% 45%" }}>
        <div
          style={{
            position: "absolute",
            left: PHOTO.left,
            top: PHOTO.top,
            width: PHOTO.w,
            height: PHOTO.h,
            transform: `scale(${PHOTO.scale})`,
            transformOrigin: "0 0",
          }}
        >
          <Img src={staticFile("photos/px-1558811.jpg")} style={{ position: "absolute", inset: 0, width: PHOTO.w, height: PHOTO.h, filter: "blur(0.6px) saturate(0.95)" }} />
          {scene.paper && <Page scene={scene} t={t} />}
        </div>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 60% 45%, rgba(0,0,0,0) 55%, rgba(20,10,4,0.38) 100%)" }} />
        <Device
          kind="phone"
          appear={continued ? 1 : interpolate(frame, [4, 16], [0, 1], { ...clamp, easing: ease })}
          at={{ cx: 300, cy: 572, scale: 0.86, rotate: 4 }}
          shadow="-18px 34px 50px rgba(10, 5, 0, 0.55), 0 6px 14px rgba(10, 5, 0, 0.35), inset 0 0 0 2px #3A3A3C"
        >
          <Clips clips={scene.clips ?? []} />
        </Device>
      </div>
      {scene.headline && (
        <div
          style={{
            position: "absolute",
            left: 56,
            top: 34,
            padding: "14px 30px",
            borderRadius: 26,
            background: "rgba(255, 255, 255, 0.94)",
            boxShadow: "0 12px 30px rgba(0, 0, 0, 0.28)",
            fontSize: 58,
            fontWeight: 600,
            color: INK,
            opacity: interpolate(frame, [6, 18, total - 8, total], [0, 1, 1, 0], clamp),
            translate: interpolate(frame, [6, 24], ["0px -16px", "0px 0px"], { ...clamp, easing: ease }),
          }}
        >
          {scene.headline}
        </div>
      )}
      {scene.voices.length > 0 && CAPTIONS[scene.voices[0].id] && (
        <div style={{ position: "absolute", right: 50, bottom: 40, width: 980, filter: "drop-shadow(0 16px 30px rgba(0,0,0,0.35))" }}>
          <LinaSays scene={scene} t={t} total={total} col={{ words: 44, lina: 0.82 }} />
        </div>
      )}
    </AbsoluteFill>
  );
};

/** The page: each step's strokes in pencil as it is drawn, then the colors over them. */
const Page: React.FC<{ scene: Scene; t: number }> = ({ scene, t }) => {
  const paper = scene.paper!;
  const lesson = STROKES[paper.lesson];
  const color = paper.colorAt === undefined ? 0 : interpolate(t, [paper.colorAt, paper.colorAt + (paper.colorDur ?? 1.6)], [0, 1], { ...clamp, easing: ease });
  const s = DRAWING.size;
  const lines: { d: string; w: number; p: number }[] = [];
  for (const draw of paper.draws) {
    const strokes = lesson.steps[draw.step].strokes;
    const sum = strokes.reduce((n, k) => n + k.dur, 0) || 1;
    let at = draw.at;
    for (const k of strokes) {
      const dur = (k.dur / sum) * draw.dur;
      lines.push({ d: k.d, w: k.w, p: dur <= 0 ? (t >= at ? 1 : 0) : interpolate(t, [at, at + dur], [0, 1], clamp) });
      at += dur;
    }
  }
  return (
    <div
      style={{
        position: "absolute",
        left: PAGE.cx - s / 2,
        top: PAGE.cy - s / 2,
        width: s,
        height: s,
        transform: `rotate(${PAGE.rotate}deg) translate(${DRAWING.dx}px, ${DRAWING.dy}px)`,
        mixBlendMode: "multiply",
      }}
    >
      {color > 0 && (
        <Img
          src={staticFile(`refs/${paper.lesson}.svg`)}
          style={{
            position: "absolute",
            inset: 0,
            width: s,
            height: s,
            opacity: 0.9,
            filter: "saturate(0.85) contrast(0.95)",
            clipPath: `inset(${(1 - color) * 100}% 0 0 0)`,
          }}
        />
      )}
      <svg viewBox="0 0 1000 1000" width={s} height={s} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <filter id="pencil" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="7" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" />
          </filter>
        </defs>
        <g filter="url(#pencil)" fill="none" stroke="#2E2B28" strokeLinecap="round" strokeLinejoin="round" opacity={0.86}>
          {lines.map((l, i) =>
            l.p > 0 ? <path key={i} d={l.d} strokeWidth={l.w * 0.85} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - l.p} /> : null,
          )}
        </g>
      </svg>
    </div>
  );
};
