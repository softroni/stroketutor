import { Audio, Video } from "@remotion/media";
import { loadFont } from "@remotion/fonts";
import React from "react";
import { AbsoluteFill, Easing, Img, Sequence, Series, interpolate, staticFile, useCurrentFrame } from "remotion";

import captions from "./captions.json";
import { Desk } from "./Desk";
import { Clip, FPS, SCENES, Scene, clipFrames, sceneFrames } from "./scenes";
import { Wall } from "./Wall";

loadFont({ family: "Fredoka", url: staticFile("brand/Fredoka.ttf"), weight: "300 700" });

export const INK = "#12352B";
export const SOFT = "#2F5C50";
export const GREEN = "#1F9D66";
export const GOLD = "#B7791F";
export const BACKGROUND = "linear-gradient(135deg, #CFF8EC 0%, #A9EEDB 100%)";

// The iPhone: its 604 × 1312 recording at 424 × 921 in a dark bezel. The iPad: its upright
// 1032 × 1376 recording at 696 × 928; on its side the same device turned a quarter and a
// little larger, so the landscape screen fills the left of the frame.
export const DEVICES = {
  phone: { w: 424, h: 921, bezel: 14, outer: 66, inner: 54, cx: 520, cy: 540 },
  pad: { w: 696, h: 928, bezel: 20, outer: 54, inner: 34, cx: 651, cy: 540 },
} as const;
const SIDEWAYS_SCALE = 1.18;
export const COLUMNS = {
  phone: { x: 900, w: 880, top: 200, headline: 84, words: 50, lina: 1 },
  pad: { x: 1270, w: 590, top: 170, headline: 66, words: 40, lina: 0.8 },
  wall: { x: 1170, w: 700, top: 190, headline: 66, words: 42, lina: 0.85 },
  duo: { x: 1190, w: 670, top: 190, headline: 72, words: 42, lina: 0.85 },
} as const;
type Column = (typeof COLUMNS)[keyof typeof COLUMNS];

type Caption = { text: string; duration: number; words: { text: string; start: number; end: number }[] };
export const CAPTIONS = captions as Record<string, Caption>;

export const ease = Easing.bezier(0.16, 1, 0.3, 1);
const turnEase = Easing.bezier(0.45, 0, 0.25, 1);
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// The music sits under Lina: full between her lines, about 9.5 dB down while she speaks.
const MUSIC_UP = 0.72;
const MUSIC_UNDER = 0.24;
/** When Lina speaks, in seconds from the start of these scenes. */
const voiceSpans = (scenes: Scene[]): [number, number][] => {
  const spans: [number, number][] = [];
  let t = 0;
  for (const s of scenes) {
    for (const v of s.voices) spans.push([t + v.at, t + v.at + (CAPTIONS[v.id]?.duration ?? 0)]);
    t += sceneFrames(s) / FPS;
  }
  return spans;
};
const musicVolume = (spans: [number, number][], totalFrames: number) => (frame: number) => {
  const t = frame / FPS;
  let under = 0;
  for (const [a, b] of spans) {
    const d = t < a ? a - t : t > b ? t - b : 0;
    under = Math.max(under, interpolate(d, [0.15, 0.7], [1, 0], clamp));
  }
  const total = totalFrames / FPS;
  const fade = interpolate(t, [0, 1.0, total - 3.0, total - 0.2], [0, 1, 1, 0], clamp);
  return (MUSIC_UP + (MUSIC_UNDER - MUSIC_UP) * under) * fade;
};

/** The tour, or a shorter cut of it (`scenes`), over the music. */
export const Overview: React.FC<{ scenes?: Scene[] }> = ({ scenes = SCENES }) => {
  const total = scenes.reduce((n, s) => n + sceneFrames(s), 0);
  return (
    <AbsoluteFill style={{ background: BACKGROUND, fontFamily: "Fredoka" }}>
      <Audio src={staticFile("music/bed.wav")} volume={musicVolume(voiceSpans(scenes), total)} />
      <Series>
        {scenes.map((scene, i) => (
          <Series.Sequence key={scene.id} name={scene.id} durationInFrames={sceneFrames(scene)}>
            <SceneSwitch scene={scene} previous={scenes[i - 1]} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};

const SceneSwitch: React.FC<{ scene: Scene; previous?: Scene }> = ({ scene, previous }) => {
  const kind = scene.kind ?? "device";
  const deviceIn = !previous || (previous.kind ?? "device") !== "device" || previous.device !== scene.device;
  return (
    <AbsoluteFill>
      {kind === "device" && <DeviceScene scene={scene} deviceIn={deviceIn} />}
      {kind === "desk" && <Desk scene={scene} continued={previous?.kind === "desk"} />}
      {kind === "wall" && <Wall scene={scene} />}
      {kind === "duo" && <DuoScene scene={scene} />}
      {kind === "chapter" && <ChapterCard scene={scene} />}
      {kind === "end" && <EndScene scene={scene} />}
      <Voices scene={scene} />
    </AbsoluteFill>
  );
};

export const Voices: React.FC<{ scene: Scene }> = ({ scene }) => (
  <>
    {scene.voices.map((v) => (
      <Sequence key={v.id} name={`voice ${v.id}`} from={Math.round(v.at * FPS)}>
        <Audio src={staticFile(`vo/${v.id}.wav`)} />
      </Sequence>
    ))}
  </>
);

/** How far the device is turned onto its side at `t`: 0 upright, 1 sideways. */
const sideways = (scene: Scene, t: number) => {
  let value = scene.orient === "landscape" ? 1 : 0;
  for (const turn of scene.turns ?? []) {
    const target = turn.to === "landscape" ? 1 : 0;
    const p = interpolate(t, [turn.at, turn.at + (turn.dur ?? 0.6)], [0, 1], { ...clamp, easing: turnEase });
    if (t >= turn.at) value = value + (target - value) * p;
  }
  return value;
};

/** The clip playing at `t` seconds into a list of clips. */
const clipAt = (clips: Clip[], t: number) => {
  let start = 0;
  for (const c of clips) {
    const d = clipFrames(c) / FPS;
    if (t < start + d) return { clip: c, start };
    start += d;
  }
  return { clip: clips[clips.length - 1], start: start - clipFrames(clips[clips.length - 1]) / FPS };
};

const DeviceScene: React.FC<{ scene: Scene; deviceIn: boolean }> = ({ scene, deviceIn }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const kind = scene.device ?? "phone";
  return (
    <AbsoluteFill>
      <Device kind={kind} turn={sideways(scene, t)} appear={deviceIn ? interpolate(frame, [0, 10], [0, 1], { ...clamp, easing: ease }) : 1}>
        <Clips clips={scene.clips ?? []} />
      </Device>
      <TextColumn scene={scene} col={COLUMNS[kind]} />
    </AbsoluteFill>
  );
};

export const Clips: React.FC<{ clips: Clip[] }> = ({ clips }) => (
  <Series>
    {clips.map((clip, i) => (
      <Series.Sequence key={i} name={clip.src} durationInFrames={clipFrames(clip)}>
        <ClipView clip={clip} fadeIn={i > 0 && !clip.cut} />
      </Series.Sequence>
    ))}
  </Series>
);

export const Device: React.FC<{
  kind: "phone" | "pad";
  turn?: number;
  appear?: number;
  at?: { cx: number; cy: number; scale: number; rotate?: number };
  shadow?: string;
  children: React.ReactNode;
}> = ({ kind, turn = 0, appear = 1, at, shadow, children }) => {
  const d = DEVICES[kind];
  const W = d.w + d.bezel * 2;
  const H = d.h + d.bezel * 2;
  const cx = at?.cx ?? d.cx;
  const cy = at?.cy ?? d.cy;
  const scale = (at?.scale ?? 1) * (1 + (SIDEWAYS_SCALE - 1) * turn) * (0.94 + 0.06 * appear);
  return (
    <div
      style={{
        position: "absolute",
        left: cx - W / 2,
        top: cy - H / 2,
        width: W,
        height: H,
        borderRadius: d.outer,
        background: "#1C1C1E",
        opacity: appear,
        transform: `rotate(${-90 * turn + (at?.rotate ?? 0)}deg) scale(${scale})`,
        boxShadow: shadow ?? "0 40px 80px rgba(18, 53, 43, 0.28), 0 8px 18px rgba(18, 53, 43, 0.16), inset 0 0 0 2px #3A3A3C",
      }}
    >
      <div style={{ position: "absolute", left: d.bezel, top: d.bezel, width: d.w, height: d.h, borderRadius: d.inner, overflow: "hidden", background: "#fff" }}>
        {children}
      </div>
    </div>
  );
};

const ClipView: React.FC<{ clip: Clip; fadeIn: boolean }> = ({ clip, fadeIn }) => {
  const frame = useCurrentFrame();
  const still = clip.src.endsWith(".png");
  return (
    <AbsoluteFill style={{ opacity: fadeIn ? interpolate(frame, [0, 5], [0, 1], clamp) : 1, background: "#fff" }}>
      {still ? (
        <Img src={staticFile(`clips/${clip.src}`)} style={{ width: "100%", height: "100%" }} />
      ) : (
        <Video
          src={staticFile(`clips/${clip.src}.mp4`)}
          trimBefore={Math.round((clip.from ?? 0) * FPS)}
          playbackRate={clip.rate ?? 1}
          muted
          style={{ width: "100%", height: "100%" }}
        />
      )}
    </AbsoluteFill>
  );
};

/** The chapter's name, the headline, Lina's words, and the lesson playing, beside the device. */
export const TextColumn: React.FC<{ scene: Scene; col: Column; top?: number }> = ({ scene, col, top }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const total = sceneFrames(scene);
  const clips = scene.clips ?? [];
  const labelled = clips.some((c) => c.label);
  const now = labelled ? clipAt(clips, t) : null;
  return (
    <div style={{ position: "absolute", left: col.x, width: col.w, top: top ?? col.top, display: "flex", flexDirection: "column", gap: 40 * col.lina + 6 }}>
      <div style={{ opacity: interpolate(frame, [0, 12, total - 8, total], [0, 1, 1, 0], clamp) }}>
        {scene.chapter && (
          <div style={{ fontSize: 30 * Math.max(col.lina, 0.9), fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: GREEN, marginBottom: 14 }}>
            {scene.chapter}
          </div>
        )}
        {scene.headline && (
          <div
            style={{
              fontSize: col.headline,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
              color: INK,
              translate: interpolate(frame, [0, 18], ["0px 24px", "0px 0px"], { ...clamp, easing: ease }),
            }}
          >
            {scene.headline}
          </div>
        )}
      </div>
      {scene.voices.length > 0 && <LinaSays scene={scene} t={t} total={total} col={col} />}
      {now?.clip.label && <LessonChip key={now.clip.label} clip={now.clip} since={t - now.start} until={total / FPS - t} />}
    </div>
  );
};

/** The lesson on screen: its name, and Free or Premium. */
const LessonChip: React.FC<{ clip: Clip; since: number; until: number }> = ({ clip, since, until }) => {
  const premium = clip.tag === "premium";
  const pop = interpolate(since, [0, 0.35], [0, 1], { ...clamp, easing: ease });
  return (
    <div
      style={{
        alignSelf: "flex-start",
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "16px 30px 16px 18px",
        borderRadius: 999,
        background: "#fff",
        boxShadow: "0 12px 30px rgba(18, 53, 43, 0.14)",
        opacity: pop * interpolate(until, [0, 0.25], [0, 1], clamp),
        scale: `${0.9 + 0.1 * pop}`,
        translate: `0px ${(1 - pop) * 16}px`,
      }}
    >
      <Img src={staticFile(`refs/${clip.lesson}.svg`)} style={{ width: 64, height: 64 }} />
      <span style={{ fontSize: 44, fontWeight: 600, color: INK }}>{clip.label}</span>
      {clip.tag && (
        <span
          style={{
            fontSize: 28,
            fontWeight: 600,
            padding: "6px 16px",
            borderRadius: 999,
            color: premium ? GOLD : GREEN,
            background: premium ? "#FFF3C9" : "#DDF5E9",
          }}
        >
          {premium ? "👑 Premium" : "Free"}
        </span>
      )}
    </div>
  );
};

/** Lina in the corner of a speech bubble, the sentence she is saying in it, each word lit as she says it. */
export const LinaSays: React.FC<{ scene: Scene; t: number; total: number; col: { words: number; lina: number }; width?: number }> = ({ scene, t, total, col, width }) => {
  const frame = Math.round(t * FPS);
  // The latest voice that has started, or the first one before any has.
  const started = scene.voices.filter((v) => v.at <= t);
  const voice = started[started.length - 1] ?? scene.voices[0];
  const cap = CAPTIONS[voice.id];
  if (!cap) return null;
  const local = t - voice.at;

  const sentences: Caption["words"][] = [];
  for (const w of cap.words) {
    if (sentences.length === 0 || /[.?!:]["”]?$/.test(sentences[sentences.length - 1].slice(-1)[0]?.text ?? "")) sentences.push([]);
    sentences[sentences.length - 1].push(w);
  }
  const current = [...sentences].reverse().find((s) => s[0].start - 0.15 <= local) ?? sentences[0];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 24 * col.lina,
        width,
        opacity: interpolate(frame, [4, 16, total - 8, total], [0, 1, 1, 0], clamp),
      }}
    >
      <Img src={staticFile("brand/lina-wave.svg")} style={{ width: 132 * col.lina, height: 158 * col.lina, flex: "none", marginTop: 6 }} />
      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: 140 * col.lina,
          padding: `${30 * col.lina}px ${36 * col.lina}px`,
          borderRadius: 36 * col.lina,
          background: "#fff",
          boxShadow: "0 14px 34px rgba(18, 53, 43, 0.14)",
          fontSize: col.words,
          fontWeight: 500,
          lineHeight: 1.22,
          color: INK,
        }}
      >
        {current.map((w, i) => (
          <span key={i} style={{ opacity: w.start - 0.05 <= local ? 1 : 0.28 }}>
            {w.text}
            {i < current.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </div>
  );
};

/** iPad and iPhone side by side, both upright. */
const DuoScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const appear = (at: number) => interpolate(frame, [at, at + 12], [0, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill>
      <Device kind="pad" appear={appear(0)} at={{ cx: 400, cy: 540, scale: 0.86 }}>
        <Clips clips={scene.padClips ?? []} />
      </Device>
      <Device kind="phone" appear={appear(8)} at={{ cx: 900, cy: 600, scale: 0.78 }}>
        <Clips clips={scene.clips ?? []} />
      </Device>
      <TextColumn scene={scene} col={COLUMNS.duo} />
    </AbsoluteFill>
  );
};

/** A chapter's title card: its number, its name, and three of its drawings floating in. */
const ChapterCard: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const total = sceneFrames(scene);
  const card = scene.card!;
  const fade = interpolate(frame, [0, 8, total - 8, total], [0, 1, 1, 0], clamp);
  const rise = interpolate(frame, [0, 22], [30, 0], { ...clamp, easing: ease });
  const spots = [
    { x: 330, y: 300, r: -10, s: 230 },
    { x: 1590, y: 270, r: 9, s: 210 },
    { x: 1500, y: 800, r: -6, s: 250 },
    { x: 420, y: 790, r: 7, s: 220 },
  ];
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      {card.art.map((id, i) => {
        const s = spots[i % spots.length];
        const p = interpolate(frame, [4 + i * 4, 26 + i * 4], [0, 1], { ...clamp, easing: ease });
        const drift = Math.sin((frame + i * 20) / 18) * 6;
        return (
          <div
            key={id}
            style={{
              position: "absolute",
              left: s.x - s.s / 2,
              top: s.y - s.s / 2 + drift,
              width: s.s,
              height: s.s,
              borderRadius: 44,
              background: "#fff",
              boxShadow: "0 18px 40px rgba(18, 53, 43, 0.16)",
              rotate: `${s.r}deg`,
              scale: `${0.6 + 0.4 * p}`,
              opacity: p,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Img src={staticFile(`refs/${id}.svg`)} style={{ width: s.s * 0.78, height: s.s * 0.78 }} />
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 0, right: 0, top: 380 + rise, display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            background: GREEN,
            color: "#fff",
            fontSize: 54,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 12px 26px rgba(31, 157, 102, 0.35)",
          }}
        >
          {card.n}
        </div>
        <div style={{ fontSize: 118, fontWeight: 600, color: INK, letterSpacing: "-0.015em", textAlign: "center", lineHeight: 1.0 }}>{card.title}</div>
      </div>
    </AbsoluteFill>
  );
};

const EndScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const appear = (at: number) => ({
    opacity: interpolate(frame, [at, at + 14], [0, 1], clamp),
    translate: interpolate(frame, [at, at + 20], ["0px 20px", "0px 0px"], { ...clamp, easing: ease }),
  });
  const col = COLUMNS.phone;
  return (
    <AbsoluteFill>
      <Device kind="phone" appear={interpolate(frame, [0, 10], [0, 1], { ...clamp, easing: ease })}>
        <Clips clips={scene.clips ?? []} />
      </Device>
      <div style={{ position: "absolute", left: col.x, width: col.w, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 40 }}>
        <div style={{ fontSize: 84, fontWeight: 600, lineHeight: 1.05, color: INK, ...appear(6) }}>Grab a pen, and let's draw</div>
        <div style={{ display: "flex", alignItems: "center", gap: 28, ...appear(40) }}>
          <Img src={staticFile("brand/AppIcon.png")} style={{ width: 150, height: 150, borderRadius: 34, boxShadow: "0 12px 28px rgba(18, 53, 43, 0.22)" }} />
          <div>
            <div style={{ fontSize: 72, fontWeight: 600, color: INK, lineHeight: 1 }}>Paper Coach</div>
            <div style={{ fontSize: 40, fontWeight: 500, color: SOFT, marginTop: 10 }}>Learn to draw on real paper</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 28, ...appear(70) }}>
          <Img src={staticFile("brand/download-on-the-app-store-black.svg")} style={{ height: 96 }} />
          <div style={{ fontSize: 36, fontWeight: 500, color: GREEN, lineHeight: 1.2 }}>
            Free to download
            <br />
            iPhone and iPad
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
