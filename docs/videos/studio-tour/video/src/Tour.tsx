import { Audio, Video } from "@remotion/media";
import { loadFont } from "@remotion/fonts";
import React from "react";
import { AbsoluteFill, Easing, Freeze, Img, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";

import { CAPTIONS, FPS, RESOLVED, Resolved, Shot, TOTAL_FRAMES, type Cam } from "./edit";

loadFont({ family: "Fredoka", url: staticFile("brand/Fredoka.ttf"), weight: "300 700" });

export const W = 1920;
export const H = 1080;
export const INK = "#12352B";
export const GREEN = "#1F9D66";
export const MINT = "linear-gradient(135deg, #DDFBF1 0%, #A9EEDB 100%)";
export const ease = Easing.bezier(0.16, 1, 0.3, 1);
const inOut = Easing.bezier(0.65, 0, 0.35, 1);
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const f = (s: number) => Math.round(s * FPS);

// ---------- Sound ----------

// The music sits under the voices: lighter between lines, about 10 dB down while anyone speaks.
const MUSIC_UP = 0.4;
const MUSIC_UNDER = 0.125;
const SPEECH: [number, number][] = RESOLVED.flatMap((r) => r.placed.map((p) => [r.start + p.start, r.start + p.end] as [number, number]));
const musicVolume = (frame: number) => {
  const t = frame / FPS;
  let under = 0;
  for (const [a, b] of SPEECH) {
    const d = t < a ? a - t : t > b ? t - b : 0;
    under = Math.max(under, interpolate(d, [0.15, 0.7], [1, 0], clamp));
  }
  const total = TOTAL_FRAMES / FPS;
  const fade = interpolate(t, [0, 0.8, total - 3.2, total - 0.1], [0, 1, 1, 0], clamp);
  return (MUSIC_UP + (MUSIC_UNDER - MUSIC_UP) * under) * fade;
};

// ---------- The film ----------

export const Tour: React.FC = () => (
  <AbsoluteFill style={{ background: "#F6F4EF", fontFamily: "Fredoka" }}>
    <Audio src={staticFile("music/bed.wav")} volume={musicVolume} />
    {RESOLVED.map((r) => (
      <Sequence key={r.section.id} name={r.section.id} from={f(r.start)} durationInFrames={f(r.dur)}>
        <SectionView r={r} />
      </Sequence>
    ))}
    <Captions />
  </AbsoluteFill>
);

const SectionView: React.FC<{ r: Resolved }> = ({ r }) => (
  <AbsoluteFill>
    {r.shots.map((shot, i) => (
      <Sequence key={i} name={`${shot.clip} ${shot.from ?? ""}`} from={f(shot.start)} durationInFrames={Math.max(1, f(shot.end) - f(shot.start))}>
        <ShotView shot={shot} first={i === 0} />
      </Sequence>
    ))}
    {r.placed.map((p) => (
      <Sequence key={p.key} name={`${p.kind} ${p.id}`} from={f(p.start)} durationInFrames={f(p.end - p.start) + 6}>
        {p.kind === "pip" ? <PiP src={p.id} dur={p.end - p.start} /> : <Audio src={staticFile(`vo/${p.id}.wav`)} />}
        {p.kind === "lina" && <LinaBadge dur={p.end - p.start} />}
      </Sequence>
    ))}
    {r.sfx.map((s) => (
      <Sequence key={s.src} name={`sfx ${s.src}`} from={f(s.t)} durationInFrames={f(2.2)}>
        <Audio src={staticFile(`sfx/${s.src}.wav`)} />
        <Pop label={s.label} kind={s.src} />
      </Sequence>
    ))}
    {r.callouts.map((c) => (
      <Sequence key={c.text} name="callout" from={f(c.t)} durationInFrames={f(c.dur)}>
        <Callout text={c.text} dur={c.dur} />
      </Sequence>
    ))}
    {r.section.title && <SectionTag r={r} />}
  </AbsoluteFill>
);

// ---------- A shot: a recording, its camera moving ----------

const camAt = (cam: Cam[] | undefined, p: number) => {
  if (!cam || cam.length === 0) return { x: 0.5, y: 0.5, z: 1 };
  if (p <= cam[0].p) return cam[0];
  for (let i = 0; i < cam.length - 1; i++) {
    const a = cam[i];
    const b = cam[i + 1];
    if (p <= b.p) {
      const e = inOut((p - a.p) / Math.max(1e-6, b.p - a.p));
      // Zoom in steps that feel even: between the two zooms on a log scale.
      return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, z: Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * e) };
    }
  }
  return cam[cam.length - 1];
};

const ShotView: React.FC<{ shot: Shot & { start: number; end: number }; first: boolean }> = ({ shot, first }) => {
  const frame = useCurrentFrame();
  if (shot.clip === "TITLE") return <TitleCard dur={shot.end - shot.start} />;
  if (shot.clip === "END") return <EndCard />;
  const len = Math.max(1, f(shot.end) - f(shot.start));
  const { x, y, z } = camAt(shot.cam, frame / len);
  const tx = Math.min(0, Math.max(W - W * z, W / 2 - x * W * z));
  const ty = Math.min(0, Math.max(H - H * z, H / 2 - y * H * z));
  const video = (
    <Video
      src={staticFile(`clips/${shot.clip}.mp4`)}
      trimBefore={f(shot.from ?? 0)}
      playbackRate={shot.freeze ? 1 : shot.rate ?? 1}
      muted
      style={{ width: W, height: H }}
    />
  );
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#F6F4EF", opacity: first ? interpolate(frame, [0, 8], [0, 1], clamp) : 1 }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `translate(${tx}px, ${ty}px) scale(${z})`, transformOrigin: "0 0" }}>
        {shot.freeze ? <Freeze frame={0}>{video}</Freeze> : video}
      </div>
    </AbsoluteFill>
  );
};

// ---------- Words on screen ----------

type Word = { text: string; start: number; end: number };
type Phrase = { words: Word[]; start: number; end: number; lina: boolean };

/** Every line's words, in phrases short enough for one line, at their times in the film. */
const PHRASES: Phrase[] = (() => {
  const phrases: Phrase[] = [];
  for (const r of RESOLVED) {
    for (const p of r.placed) {
      if (p.kind === "pip") continue;
      const words = CAPTIONS[p.id].words.map((w) => ({ text: w.text, start: r.start + p.start + w.start, end: r.start + p.start + w.end }));
      let current: Word[] = [];
      const flush = () => {
        if (current.length) phrases.push({ words: current, start: current[0].start, end: current[current.length - 1].end, lina: p.kind === "lina" });
        current = [];
      };
      words.forEach((w) => {
        current.push(w);
        const n = current.length;
        const chars = current.reduce((c, x) => c + x.text.length + 1, 0);
        if (/[.!?]$/.test(w.text) && n >= 3) flush();
        else if (/[,:;]$/.test(w.text) && n >= 5) flush();
        else if (chars > 46) flush();
      });
      flush();
    }
  }
  return phrases;
})();

const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const index = PHRASES.findIndex((ph, i) => {
    const next = PHRASES[i + 1];
    const until = Math.min(ph.end + 0.6, next ? next.start - 0.05 : Infinity);
    return t >= ph.start - 0.12 && t < until;
  });
  if (index < 0) return null;
  const phrase = PHRASES[index];
  const appear = interpolate(t, [phrase.start - 0.12, phrase.start + 0.05], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 44, pointerEvents: "none" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          maxWidth: 1600,
          padding: "14px 34px 16px",
          borderRadius: 26,
          background: phrase.lina ? "rgba(122, 52, 28, 0.86)" : "rgba(14, 30, 24, 0.84)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
          opacity: appear,
          translate: `0px ${(1 - appear) * 10}px`,
        }}
      >
        {phrase.lina && <Img src={staticFile("brand/lina-wave.svg")} style={{ width: 54, height: 54, borderRadius: 27, background: "#FFE7D6" }} />}
        <div style={{ fontSize: 50, fontWeight: 600, lineHeight: 1.15, color: "#fff", letterSpacing: "0.005em", textAlign: "center" }}>
          {phrase.words.map((w, i) => {
            const said = t >= w.start - 0.03;
            const now = t >= w.start - 0.03 && t < w.end + 0.05;
            return (
              <span key={i} style={{ opacity: said ? 1 : 0.5, color: now ? (phrase.lina ? "#FFD3B8" : "#9EF0C9") : "#fff" }}>
                {w.text}
                {i < phrase.words.length - 1 ? " " : ""}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** The section's name: large in the middle as it begins, then small in the top left corner. */
const SectionTag: React.FC<{ r: Resolved }> = ({ r }) => {
  const frame = useCurrentFrame();
  const n = RESOLVED.filter((x) => x.section.title).indexOf(r) + 1;
  const total = f(r.dur);
  const big = interpolate(frame, [26, 44], [1, 0], { ...clamp, easing: inOut });
  const show = interpolate(frame, [0, 9, total - 6, total], [0, 1, 1, 0], clamp);
  const scale = 0.42 + 0.58 * big;
  const left = 40 + (W / 2 - 40) * big;
  const top = 36 + (H * 0.42 - 36) * big;
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        transform: `translate(${-50 * big}%, ${-50 * big}%) scale(${scale * (0.92 + 0.08 * Math.min(1, frame / 9))})`,
        transformOrigin: big > 0.5 ? "50% 50%" : "0 0",
        opacity: show,
        display: "flex",
        alignItems: "center",
        gap: 26,
        padding: "22px 44px 24px 26px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.96)",
        boxShadow: `0 ${18 * big + 6}px ${50 * big + 18}px rgba(18,53,43,${0.18 + 0.1 * big})`,
        border: "2px solid rgba(18,53,43,0.08)",
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ width: 92, height: 92, borderRadius: 46, background: GREEN, color: "#fff", fontSize: 58, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</div>
      <div style={{ fontSize: 104, fontWeight: 600, color: INK, letterSpacing: "-0.01em" }}>{r.section.title}</div>
    </div>
  );
};

const Callout: React.FC<{ text: string; dur: number }> = ({ text, dur }) => {
  const frame = useCurrentFrame();
  const show = interpolate(frame, [0, 8, f(dur) - 8, f(dur)], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 34, pointerEvents: "none" }}>
      <div
        style={{
          padding: "14px 30px 16px",
          borderRadius: 20,
          background: GREEN,
          color: "#fff",
          fontSize: 40,
          fontWeight: 600,
          boxShadow: "0 12px 30px rgba(18,53,43,0.3)",
          opacity: show,
          transform: `translateY(${(1 - show) * -16}px) scale(${0.96 + 0.04 * show})`,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

/** A Learners sound, named as it plays. */
const Pop: React.FC<{ label: string; kind: string }> = ({ label, kind }) => {
  const frame = useCurrentFrame();
  const pop = interpolate(frame, [0, 6, 10], [0.6, 1.12, 1], { ...clamp, easing: ease });
  const show = interpolate(frame, [0, 4, 40, 50], [0, 1, 1, 0], clamp);
  const color = kind === "buy" ? "#E0A100" : kind === "trial" ? "#7C5CFA" : "#2F7DF6";
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 40, pointerEvents: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 32px 16px 22px", borderRadius: 999, background: "#fff", border: `4px solid ${color}`, boxShadow: "0 14px 34px rgba(0,0,0,0.2)", transform: `scale(${pop})`, opacity: show }}>
        <div style={{ width: 54, height: 54, borderRadius: 27, background: color, color: "#fff", fontSize: 34, display: "flex", alignItems: "center", justifyContent: "center" }}>♪</div>
        <div style={{ fontSize: 46, fontWeight: 600, color: INK }}>{label}</div>
      </div>
    </AbsoluteFill>
  );
};

/** Lina speaking: who she is, beside the page. */
const LinaBadge: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const show = interpolate(frame, [0, 8, f(dur) - 4, f(dur) + 4], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: "absolute", right: 60, top: 60, display: "flex", alignItems: "center", gap: 18, padding: "14px 30px 14px 14px", borderRadius: 999, background: "#fff", boxShadow: "0 14px 34px rgba(0,0,0,0.18)", opacity: show, transform: `scale(${0.94 + 0.06 * show})` }}>
      <Img src={staticFile("brand/lina-wave.svg")} style={{ width: 84, height: 84, borderRadius: 42, background: "#FFE7D6" }} />
      <div>
        <div style={{ fontSize: 40, fontWeight: 600, color: INK, lineHeight: 1.05 }}>Lina</div>
        <div style={{ fontSize: 28, color: "#5B6F67" }}>the app’s voice</div>
      </div>
    </div>
  );
};

/** A lesson's video for social, as it was posted, playing with its sound in a phone. */
const PiP: React.FC<{ src: string; dur: number }> = ({ src, dur }) => {
  const frame = useCurrentFrame();
  const show = interpolate(frame, [0, 10, f(dur) - 8, f(dur)], [0, 1, 1, 0], clamp);
  const ph = 900;
  const pw = Math.round((ph * 9) / 16);
  return (
    <AbsoluteFill style={{ opacity: show }}>
      <AbsoluteFill style={{ background: "rgba(14, 30, 24, 0.55)" }} />
      <div style={{ position: "absolute", left: 170, top: 330, width: 900, color: "#fff" }}>
        <div style={{ fontSize: 40, fontWeight: 500, opacity: 0.85 }}>The 5 PM post</div>
        <div style={{ fontSize: 86, fontWeight: 600, lineHeight: 1.05, marginTop: 8 }}>A lesson video that made itself</div>
      </div>
      <div style={{ position: "absolute", right: 210, top: (H - ph) / 2 - 10, width: pw + 28, height: ph + 28, borderRadius: 64, background: "#1C1C1E", boxShadow: "0 40px 80px rgba(0,0,0,0.45)", transform: `translateY(${(1 - show) * 40}px)` }}>
        <div style={{ position: "absolute", left: 14, top: 14, width: pw, height: ph, borderRadius: 52, overflow: "hidden", background: "#000" }}>
          <Video src={staticFile(`lesson/${src}.mp4`)} volume={(fr) => interpolate(fr, [f(dur) - 14, f(dur) - 2], [1, 0], clamp)} style={{ width: pw, height: ph }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- The cards ----------

const TitleCard: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const a = (start: number) => interpolate(frame, [start, start + 16], [0, 1], { ...clamp, easing: ease });
  const out = interpolate(frame, [f(dur) - 10, f(dur)], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ background: MINT, alignItems: "center", justifyContent: "center", opacity: out }}>
      <Img src={staticFile("brand/AppIcon.png")} style={{ width: 230, height: 230, borderRadius: 52, boxShadow: "0 30px 60px rgba(18,53,43,0.25)", opacity: a(0), transform: `scale(${0.8 + 0.2 * a(0)})` }} />
      <div style={{ marginTop: 44, fontSize: 132, fontWeight: 600, color: INK, letterSpacing: "-0.015em", opacity: a(6), translate: `0px ${(1 - a(6)) * 24}px` }}>Paper Coach Studio</div>
      <div style={{ marginTop: 10, fontSize: 50, color: "#2F5C50", opacity: a(14), translate: `0px ${(1 - a(14)) * 18}px` }}>The private web app behind Paper Coach</div>
    </AbsoluteFill>
  );
};

const STILLS = [
  { src: "paths", label: "Paths" },
  { src: "voice", label: "Voice" },
  { src: "learners", label: "Learners" },
  { src: "social", label: "Social" },
  { src: "docs", label: "Docs" },
  { src: "today", label: "Today" },
];

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const a = (start: number) => interpolate(frame, [start, start + 16], [0, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill style={{ background: MINT, alignItems: "center", opacity: interpolate(frame, [0, 10], [0, 1], clamp) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 40, marginTop: 120, opacity: a(2) }}>
        <Img src={staticFile("brand/AppIcon.png")} style={{ width: 170, height: 170, borderRadius: 40, boxShadow: "0 24px 48px rgba(18,53,43,0.22)" }} />
        <div>
          <div style={{ fontSize: 112, fontWeight: 600, color: INK, letterSpacing: "-0.015em", lineHeight: 1 }}>Paper Coach Studio</div>
          <div style={{ fontSize: 50, color: "#2F5C50", marginTop: 14 }}>Built by Zak · run with Claude</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 26, marginTop: 90 }}>
        {STILLS.map((s, i) => (
          <div key={s.src} style={{ opacity: a(10 + i * 4), transform: `translateY(${(1 - a(10 + i * 4)) * 30}px)` }}>
            <Img src={staticFile(`stills/${s.src}.jpg`)} style={{ width: 268, height: 151, borderRadius: 16, boxShadow: "0 14px 30px rgba(18,53,43,0.2)", border: "3px solid #fff" }} />
            <div style={{ marginTop: 12, fontSize: 32, fontWeight: 600, color: INK, textAlign: "center" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
