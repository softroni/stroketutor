import { loadFont } from "@remotion/fonts";
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";

loadFont({ family: "Fredoka", url: staticFile("brand/Fredoka.ttf"), weight: "300 700" });

/** YouTube's thumbnail: the finished sailboat on the iPad, and what the app does in five words. */
export const Thumbnail: React.FC = () => (
  <AbsoluteFill style={{ background: "linear-gradient(135deg, #CFF8EC 0%, #A9EEDB 100%)", fontFamily: "Fredoka" }}>
    <div
      style={{
        position: "absolute",
        left: 120,
        top: 70,
        width: 696 + 40,
        height: 928 + 40,
        borderRadius: 54,
        background: "#1C1C1E",
        rotate: "-4deg",
        boxShadow: "0 40px 80px rgba(18, 53, 43, 0.3)",
      }}
    >
      <Img src={staticFile("clips/thumb-sailboat.png")} style={{ position: "absolute", left: 20, top: 20, width: 696, height: 928, borderRadius: 34 }} />
    </div>
    <div style={{ position: "absolute", left: 960, top: 150, width: 860, fontSize: 132, fontWeight: 600, lineHeight: 1.0, letterSpacing: "-0.015em", color: "#12352B" }}>
      Learn to draw on <span style={{ color: "#1F9D66" }}>real paper</span>
    </div>
    <div style={{ position: "absolute", left: 960, top: 740, display: "flex", alignItems: "center", gap: 28 }}>
      <Img src={staticFile("brand/AppIcon.png")} style={{ width: 150, height: 150, borderRadius: 34, boxShadow: "0 12px 28px rgba(18, 53, 43, 0.22)" }} />
      <div style={{ fontSize: 76, fontWeight: 600, color: "#12352B" }}>Paper Coach</div>
    </div>
    <Img src={staticFile("brand/lina-wave.svg")} style={{ position: "absolute", right: 70, bottom: 0, width: 230, height: 276 }} />
  </AbsoluteFill>
);
