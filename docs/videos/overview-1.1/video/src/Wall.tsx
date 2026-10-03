import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame } from "remotion";

import { COLUMNS, GOLD, GREEN, TextColumn, clamp, ease } from "./Overview";
import { FPS, Scene, sceneFrames } from "./scenes";
import wall from "./wall.json";

type Path = { id: string; title: string; color: string; lessons: string[] };
const PATHS = wall as Path[];

// Each path's deep color, as the app names them (PathTint.swift).
const DEEP: Record<string, string> = {
  sky: "#2F6BE8", peach: "#D8572D", pink: "#D6456F", butter: "#A87414", leaf: "#4F8A1F",
  lavender: "#7A4FD6", aqua: "#178A8A", indigo: "#4052C8", orchid: "#A93CA0", sand: "#8A5A33",
};

const CELL = 84;
const GAP = 9;
const LEFT = 70;
const TOP = 66;
const FREE_ROWS = 3;

/** Every lesson: a column per path, its lessons top to bottom, easiest first. The free ones (the
 * first three of every path) or the Premium ones (the rest) can stand out. */
export const Wall: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const total = sceneFrames(scene);
  const mode = scene.wall ?? "all";
  // A wall shown again (free, then Premium) is already up; only the first one builds.
  const build = mode === "all";
  const focus = interpolate(frame, [6, 22], [0, 1], { ...clamp, easing: ease });
  const out = interpolate(frame, [total - 8, total], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      {PATHS.map((path, col) =>
        path.lessons.map((id, row) => {
          const delay = (col + row) * 1.6;
          const p = build ? spring({ frame: frame - delay, fps: FPS, config: { damping: 14, stiffness: 140 } }) : 1;
          const free = row < FREE_ROWS;
          const lit = mode === "all" || (mode === "free" ? free : !free);
          const dim = 1 - (lit ? 0 : 0.72 * focus);
          const ring = lit && mode !== "all" ? focus : 0;
          return (
            <div
              key={id}
              style={{
                position: "absolute",
                left: LEFT + col * (CELL + GAP),
                top: TOP + row * (CELL + GAP),
                width: CELL,
                height: CELL,
                borderRadius: 20,
                background: "#fff",
                boxShadow: `0 6px 14px rgba(18, 53, 43, ${0.1 * dim}), 0 0 0 ${ring * 4}px ${mode === "free" ? GREEN : GOLD}`,
                opacity: Math.min(1, p) * dim,
                scale: `${0.4 + 0.6 * Math.min(p, 1.1)}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Img src={staticFile(`refs/${id}.svg`)} style={{ width: CELL * 0.8, height: CELL * 0.8 }} />
              {row === 0 && (
                <div style={{ position: "absolute", top: -12, left: CELL / 2 - 14, width: 28, height: 6, borderRadius: 3, background: DEEP[path.color] ?? GREEN, opacity: Math.min(1, p) }} />
              )}
              {mode === "premium" && !free && (
                <div style={{ position: "absolute", right: -8, bottom: -8, fontSize: 24, opacity: focus, scale: `${0.5 + 0.5 * focus}` }}>👑</div>
              )}
            </div>
          );
        }),
      )}
      {mode === "free" && (
        <Band top={TOP - 14} height={FREE_ROWS * (CELL + GAP) + 10} color={GREEN} label="Free" p={focus} />
      )}
      {mode === "premium" && (
        <Band top={TOP + FREE_ROWS * (CELL + GAP) - 10} height={(10 - FREE_ROWS) * (CELL + GAP) + 12} color={GOLD} label="Premium" p={focus} />
      )}
      <TextColumn scene={scene} col={COLUMNS.wall} />
    </AbsoluteFill>
  );
};

/** A label beside the rows that stand out. */
const Band: React.FC<{ top: number; height: number; color: string; label: string; p: number }> = ({ top, height, color, label, p }) => {
  const right = LEFT + 11 * (CELL + GAP) - GAP;
  return (
    <div style={{ position: "absolute", left: right + 14, top, height, width: 8, borderRadius: 4, background: color, opacity: p, transformOrigin: "top", scale: `1 ${p}` }}>
      <div
        style={{
          position: "absolute",
          left: 16,
          top: height / 2 - 22,
          fontSize: 34,
          fontWeight: 600,
          color,
          whiteSpace: "nowrap",
          writingMode: "vertical-rl",
          transform: "translateY(-30%)",
        }}
      >
        {label}
      </div>
    </div>
  );
};
