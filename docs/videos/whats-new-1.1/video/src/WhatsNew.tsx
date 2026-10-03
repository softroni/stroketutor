import { Audio, Video } from "@remotion/media";
import { loadFont } from "@remotion/fonts";
import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  Series,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";

import captions from "./captions.json";
import { Clip, FPS, SCENES, Scene, clipFrames, sceneFrames } from "./scenes";

loadFont({ family: "Fredoka", url: staticFile("brand/Fredoka.ttf"), weight: "300 700" });

const INK = "#12352B";
const SOFT = "#2F5C50";
const GREEN = "#1F9D66";

// The iPhone: its 604 × 1312 recording at 424 × 921 in a dark bezel. The iPad: its upright
// 1032 × 1376 recording at 696 × 928; on its side the same device turned a quarter and a
// little larger, so the landscape screen fills the left of the frame.
const DEVICES = {
  phone: { w: 424, h: 921, bezel: 14, outer: 66, inner: 54, cx: 520, cy: 540 },
  pad: { w: 696, h: 928, bezel: 20, outer: 54, inner: 34, cx: 651, cy: 540 },
} as const;
const SIDEWAYS_SCALE = 1.18;
const COLUMNS = {
  phone: { x: 900, w: 880, headline: 84, words: 50, lina: 1 },
  pad: { x: 1270, w: 590, headline: 66, words: 40, lina: 0.8 },
} as const;

type Caption = { text: string; duration: number; words: { text: string; start: number; end: number }[] };
const CAPTIONS = captions as Record<string, Caption>;

const ease = Easing.bezier(0.16, 1, 0.3, 1);
const turnEase = Easing.bezier(0.45, 0, 0.25, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const WhatsNew: React.FC = () => (
  <AbsoluteFill style={{ background: "linear-gradient(135deg, #CFF8EC 0%, #A9EEDB 100%)", fontFamily: "Fredoka" }}>
    <Series>
      {SCENES.map((scene, i) => (
        <Series.Sequence key={scene.id} name={scene.id} durationInFrames={sceneFrames(scene)}>
          <SceneView scene={scene} deviceIn={i === 0 || SCENES[i - 1].device !== scene.device} />
        </Series.Sequence>
      ))}
    </Series>
  </AbsoluteFill>
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

export const SceneView: React.FC<{ scene: Scene; deviceIn: boolean }> = ({ scene, deviceIn }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const total = sceneFrames(scene);
  const col = COLUMNS[scene.device];
  return (
    <AbsoluteFill>
      <Device kind={scene.device} turn={sideways(scene, t)} appear={deviceIn ? interpolate(frame, [0, 10], [0, 1], { ...clamp, easing: ease }) : 1}>
        <Series>
          {scene.clips.map((clip, i) => (
            <Series.Sequence key={i} name={clip.src} durationInFrames={clipFrames(clip)}>
              <ClipView clip={clip} fadeIn={i > 0 && !clip.cut} />
            </Series.Sequence>
          ))}
        </Series>
      </Device>

      {scene.voices.map((v) => (
        <Sequence key={v.id} name={`voice ${v.id}`} from={Math.round(v.at * FPS)}>
          <Audio src={staticFile(`vo/${v.id}.wav`)} />
        </Sequence>
      ))}

      {scene.end ? (
        <EndCard frame={frame} />
      ) : (
        <div style={{ position: "absolute", left: col.x, width: col.w, top: scene.device === "pad" ? 200 : 230, display: "flex", flexDirection: "column", gap: scene.device === "pad" ? 44 : 56 }}>
          <div
            style={{
              fontSize: col.headline,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
              color: INK,
              opacity: interpolate(frame, [0, 12, total - 8, total], [0, 1, 1, 0], clamp),
              translate: interpolate(frame, [0, 18], ["0px 24px", "0px 0px"], { ...clamp, easing: ease }),
            }}
          >
            {scene.headline}
          </div>
          <LinaSays scene={scene} t={t} total={total} />
        </div>
      )}
    </AbsoluteFill>
  );
};

const Device: React.FC<{ kind: "phone" | "pad"; turn: number; appear: number; children: React.ReactNode }> = ({ kind, turn, appear, children }) => {
  const d = DEVICES[kind];
  const W = d.w + d.bezel * 2;
  const H = d.h + d.bezel * 2;
  const scale = (1 + (SIDEWAYS_SCALE - 1) * turn) * (0.94 + 0.06 * appear);
  return (
    <div
      style={{
        position: "absolute",
        left: d.cx - W / 2,
        top: d.cy - H / 2,
        width: W,
        height: H,
        borderRadius: d.outer,
        background: "#1C1C1E",
        opacity: appear,
        transform: `rotate(${-90 * turn}deg) scale(${scale})`,
        boxShadow: "0 40px 80px rgba(18, 53, 43, 0.28), 0 8px 18px rgba(18, 53, 43, 0.16), inset 0 0 0 2px #3A3A3C",
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

/** Lina in the corner of a speech bubble, the sentence she is saying in it, each word lit as she says it. */
const LinaSays: React.FC<{ scene: Scene; t: number; total: number }> = ({ scene, t, total }) => {
  const frame = Math.round(t * FPS);
  const col = COLUMNS[scene.device];
  // The latest voice that has started, or the first one before any has.
  const started = scene.voices.filter((v) => v.at <= t);
  const voice = started[started.length - 1] ?? scene.voices[0];
  const cap = CAPTIONS[voice.id];
  const local = t - voice.at;

  const sentences: Caption["words"][] = [];
  for (const w of cap.words) {
    if (sentences.length === 0 || /[.?!:]$/.test(sentences[sentences.length - 1].slice(-1)[0]?.text ?? "")) sentences.push([]);
    sentences[sentences.length - 1].push(w);
  }
  const current = [...sentences].reverse().find((s) => s[0].start - 0.15 <= local) ?? sentences[0];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 24 * col.lina,
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

const EndCard: React.FC<{ frame: number }> = ({ frame }) => {
  const appear = (at: number) => ({
    opacity: interpolate(frame, [at, at + 14], [0, 1], clamp),
    translate: interpolate(frame, [at, at + 20], ["0px 20px", "0px 0px"], { ...clamp, easing: ease }),
  });
  const col = COLUMNS.phone;
  return (
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
          3 free lessons on every path
        </div>
      </div>
    </div>
  );
};
