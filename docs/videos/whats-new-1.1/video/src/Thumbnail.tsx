import { loadFont } from "@remotion/fonts";
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";

loadFont({ family: "Fredoka", url: staticFile("brand/Fredoka.ttf"), weight: "300 700" });

/** YouTube's thumbnail: the iPad on its side with Around Town's fire hydrant, and what 1.1 brings. */
export const Thumbnail: React.FC = () => (
  <AbsoluteFill style={{ background: "linear-gradient(135deg, #CFF8EC 0%, #A9EEDB 100%)", fontFamily: "Fredoka" }}>
    <div
      style={{
        position: "absolute",
        left: 70,
        top: 190,
        width: 1032 + 40,
        height: 774 + 40,
        borderRadius: 54,
        background: "#1C1C1E",
        rotate: "-4deg",
        boxShadow: "0 40px 80px rgba(18, 53, 43, 0.3)",
      }}
    >
      <Img src={staticFile("clips/thumb-ipad.png")} style={{ position: "absolute", left: 20, top: 20, width: 1032, height: 774, borderRadius: 34 }} />
    </div>
    <div style={{ position: "absolute", left: 1190, top: 120, width: 680, fontSize: 64, fontWeight: 600, color: "#2F5C50" }}>New in 1.1</div>
    <div style={{ position: "absolute", left: 1190, top: 200, width: 690, fontSize: 124, fontWeight: 600, lineHeight: 1.0, letterSpacing: "-0.015em", color: "#12352B" }}>
      <span style={{ color: "#1F9D66" }}>Around Town</span> and a bigger iPad
    </div>
    <div style={{ position: "absolute", left: 1190, top: 820, display: "flex", alignItems: "center", gap: 24 }}>
      <Img src={staticFile("brand/AppIcon.png")} style={{ width: 120, height: 120, borderRadius: 28, boxShadow: "0 12px 28px rgba(18, 53, 43, 0.22)" }} />
      <div style={{ fontSize: 64, fontWeight: 600, color: "#12352B" }}>Paper Coach</div>
    </div>
  </AbsoluteFill>
);
