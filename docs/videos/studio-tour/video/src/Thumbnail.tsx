import { Img, AbsoluteFill, staticFile } from "remotion";

import { GREEN, INK, MINT } from "./Tour";

/** YouTube's picture for the tour: the line, and the Learners page beside it. */
export const Thumbnail: React.FC = () => (
  <AbsoluteFill style={{ background: MINT, fontFamily: "Fredoka", overflow: "hidden" }}>
    <div style={{ position: "absolute", right: -560, top: 200, width: 1500, height: 844, borderRadius: 34, overflow: "hidden", boxShadow: "0 40px 90px rgba(18,53,43,0.35)", transform: "rotate(-4deg)", border: "8px solid #fff" }}>
      <Img src={staticFile("stills/thumb.jpg")} style={{ width: 1500, height: 844 }} />
    </div>
    <div style={{ position: "absolute", left: 90, top: 110, width: 860 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <Img src={staticFile("brand/AppIcon.png")} style={{ width: 110, height: 110, borderRadius: 26 }} />
        <div style={{ fontSize: 56, fontWeight: 600, color: INK }}>Paper Coach Studio</div>
      </div>
      <div style={{ marginTop: 40, fontSize: 138, fontWeight: 700, lineHeight: 0.98, color: INK, letterSpacing: "-0.02em", textShadow: "0 4px 0 rgba(255,255,255,0.6)" }}>
        One dev.<br />
        <span style={{ color: GREEN }}>One Claude.</span>
        <br />A whole app.
      </div>
    </div>
  </AbsoluteFill>
);
