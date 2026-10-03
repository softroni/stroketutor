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
import { FPS, SCENES, Scene, clipFrames, sceneFrames } from "./scenes";

loadFont({ family: "Fredoka", url: staticFile("brand/Fredoka.ttf"), weight: "300 700" });

const INK = "#12352B";
const SOFT = "#2F5C50";
const GREEN = "#1F9D66";

// The iPad: an upright 1032 × 1376 screen at 696 × 928, in a dark bezel.
const SCREEN = { w: 696, h: 928 };
const BEZEL = 20;
const DEVICE = { x: 150, y: (1080 - SCREEN.h - BEZEL * 2) / 2 };
const COLUMN = { x: 1000, w: 800 };

type Caption = { text: string; duration: number; words: { text: string; start: number; end: number }[] };
const CAPTIONS = captions as Record<string, Caption>;

const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const Overview: React.FC = () => (
  <AbsoluteFill style={{ background: "linear-gradient(135deg, #CFF8EC 0%, #A9EEDB 100%)", fontFamily: "Fredoka" }}>
    <Series>
      {SCENES.map((scene) => (
        <Series.Sequence key={scene.id} name={scene.id} durationInFrames={sceneFrames(scene)}>
          <SceneView scene={scene} />
        </Series.Sequence>
      ))}
    </Series>
  </AbsoluteFill>
);

export const SceneView: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const total = sceneFrames(scene);
  return (
    <AbsoluteFill>
      <Device>
        <Series>
          {scene.clips.map((clip, i) => (
            <Series.Sequence key={i} name={clip.src} durationInFrames={clipFrames(clip)}>
              <ClipView src={clip.src} from={clip.from} rate={clip.rate ?? 1} fadeIn={i > 0} />
            </Series.Sequence>
          ))}
          {scene.hold && scene.holdImage ? (
            <Series.Sequence name="hold" durationInFrames={Math.round(scene.hold * FPS)}>
              <Img src={staticFile(scene.holdImage)} style={{ width: "100%", height: "100%" }} />
            </Series.Sequence>
          ) : null}
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
        <div style={{ position: "absolute", left: COLUMN.x, width: COLUMN.w, top: 240, display: "flex", flexDirection: "column", gap: 56 }}>
          <div
            style={{
              fontSize: 84,
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

const Device: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      position: "absolute",
      left: DEVICE.x,
      top: DEVICE.y,
      width: SCREEN.w + BEZEL * 2,
      height: SCREEN.h + BEZEL * 2,
      borderRadius: 54,
      background: "#1C1C1E",
      boxShadow: "0 40px 80px rgba(18, 53, 43, 0.28), 0 8px 18px rgba(18, 53, 43, 0.16), inset 0 0 0 2px #3A3A3C",
    }}
  >
    <div style={{ position: "absolute", left: BEZEL, top: BEZEL, width: SCREEN.w, height: SCREEN.h, borderRadius: 34, overflow: "hidden", background: "#fff" }}>
      {children}
    </div>
  </div>
);

const ClipView: React.FC<{ src: string; from: number; rate: number; fadeIn: boolean }> = ({ src, from, rate, fadeIn }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: fadeIn ? interpolate(frame, [0, 5], [0, 1], clamp) : 1, background: "#fff" }}>
      <Video
        src={staticFile(`clips/${src}.mp4`)}
        trimBefore={Math.round(from * FPS)}
        playbackRate={rate}
        muted
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};

/** Lina in the corner of a speech bubble, the sentence she is saying in it, each word lit as she says it. */
const LinaSays: React.FC<{ scene: Scene; t: number; total: number }> = ({ scene, t, total }) => {
  const frame = Math.round(t * FPS);
  // The latest voice that has started, or the first one before any has.
  const started = scene.voices.filter((v) => v.at <= t);
  const voice = started[started.length - 1] ?? scene.voices[0];
  const cap = CAPTIONS[voice.id];
  const local = t - voice.at;

  const sentences: Caption["words"][] = [];
  for (const w of cap.words) {
    if (sentences.length === 0 || /[.?!]$/.test(sentences[sentences.length - 1].slice(-1)[0]?.text ?? "")) sentences.push([]);
    sentences[sentences.length - 1].push(w);
  }
  const current = [...sentences].reverse().find((s) => s[0].start - 0.15 <= local) ?? sentences[0];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 24,
        opacity: interpolate(frame, [4, 16, total - 8, total], [0, 1, 1, 0], clamp),
      }}
    >
      <Img src={staticFile("brand/lina-wave.svg")} style={{ width: 132, height: 158, flex: "none", marginTop: 6 }} />
      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: 140,
          padding: "30px 36px",
          borderRadius: 36,
          background: "#fff",
          boxShadow: "0 14px 34px rgba(18, 53, 43, 0.14)",
          fontSize: 50,
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
  return (
    <div style={{ position: "absolute", left: COLUMN.x, width: COLUMN.w, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 36 }}>
      <div style={{ fontSize: 84, fontWeight: 600, lineHeight: 1.05, color: INK, ...appear(6) }}>A pen, paper, and five minutes</div>
      <div style={{ display: "flex", alignItems: "center", gap: 28, ...appear(100) }}>
        <Img src={staticFile("brand/AppIcon.png")} style={{ width: 150, height: 150, borderRadius: 34, boxShadow: "0 12px 28px rgba(18, 53, 43, 0.22)" }} />
        <div>
          <div style={{ fontSize: 72, fontWeight: 600, color: INK, lineHeight: 1 }}>Paper Coach</div>
          <div style={{ fontSize: 40, fontWeight: 500, color: SOFT, marginTop: 10 }}>Learn to draw on real paper</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 28, ...appear(120) }}>
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
