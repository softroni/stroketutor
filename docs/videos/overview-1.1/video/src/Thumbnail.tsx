import { loadFont } from "@remotion/fonts";
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";

loadFont({ family: "Fredoka", url: staticFile("brand/Fredoka.ttf"), weight: "300 700" });

const TILES = [
  { id: "pirate-ship", x: 70, y: 70, r: -8, s: 230 },
  { id: "sunflower", x: 90, y: 400, r: 6, s: 210 },
  { id: "rocket", x: 60, y: 700, r: -5, s: 230 },
  { id: "cafe", x: 800, y: 660, r: 7, s: 200 },
  { id: "ramen-bowl", x: 795, y: 380, r: -6, s: 185 },
];

/** YouTube's thumbnail: the phone with the finished balloon among the drawings you can make, and the promise. */
export const Thumbnail: React.FC = () => (
  <AbsoluteFill style={{ background: "linear-gradient(135deg, #CFF8EC 0%, #A9EEDB 100%)", fontFamily: "Fredoka" }}>
    {TILES.map((t) => (
      <div
        key={t.id}
        style={{
          position: "absolute",
          left: t.x + 160,
          top: t.y,
          width: t.s,
          height: t.s,
          borderRadius: 48,
          background: "#fff",
          rotate: `${t.r}deg`,
          boxShadow: "0 18px 40px rgba(18, 53, 43, 0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Img src={staticFile(`refs/${t.id}.svg`)} style={{ width: t.s * 0.8, height: t.s * 0.8 }} />
      </div>
    ))}
    <div
      style={{
        position: "absolute",
        left: 470,
        top: 60,
        width: 424 + 28,
        height: 921 + 28,
        borderRadius: 66,
        background: "#1C1C1E",
        rotate: "-3deg",
        boxShadow: "0 40px 80px rgba(18, 53, 43, 0.3)",
      }}
    >
      <Img src={staticFile("clips/hold-done.png")} style={{ position: "absolute", left: 14, top: 14, width: 424, height: 921, borderRadius: 54 }} />
    </div>
    <div style={{ position: "absolute", left: 1190, top: 150, width: 690, fontSize: 150, fontWeight: 600, lineHeight: 0.98, letterSpacing: "-0.02em", color: "#12352B" }}>
      Learn to <span style={{ color: "#1F9D66" }}>draw</span>, step by step
    </div>
    <div style={{ position: "absolute", left: 1190, top: 690, fontSize: 56, fontWeight: 600, color: "#2F5C50" }}>On real paper · 110 lessons</div>
    <div style={{ position: "absolute", left: 1190, top: 820, display: "flex", alignItems: "center", gap: 24 }}>
      <Img src={staticFile("brand/AppIcon.png")} style={{ width: 120, height: 120, borderRadius: 28, boxShadow: "0 12px 28px rgba(18, 53, 43, 0.22)" }} />
      <div style={{ fontSize: 64, fontWeight: 600, color: "#12352B" }}>Paper Coach</div>
    </div>
  </AbsoluteFill>
);
