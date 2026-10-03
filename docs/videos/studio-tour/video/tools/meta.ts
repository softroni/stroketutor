// node tools/meta.mjs: the YouTube captions (../out/paper-coach-studio-tour.en.srt) and chapters, from the edit.
// Bundled with esbuild first (see ../README.md), since the edit imports captions.json.
import { writeFileSync } from "node:fs";

import { CAPTIONS, RESOLVED } from "../src/edit";

const NAMES: Record<string, string> = { intro: "Paper Coach Studio", outro: "One developer, one Claude" };
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const srtTime = (s: number) => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3_600_000), m = Math.floor(ms / 60_000) % 60, sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
};

const cues: { start: number; end: number; text: string }[] = [];
for (const r of RESOLVED) {
  for (const p of r.placed) {
    if (p.kind === "pip") continue;
    let words: { text: string; start: number; end: number }[] = [];
    const flush = () => {
      if (!words.length) return;
      cues.push({ start: r.start + p.start + words[0].start, end: r.start + p.start + words[words.length - 1].end + 0.3, text: (p.kind === "lina" ? "Lina: " : "") + words.map((w) => w.text).join(" ") });
      words = [];
    };
    for (const w of CAPTIONS[p.id].words) {
      words.push(w);
      const chars = words.reduce((c, x) => c + x.text.length + 1, 0);
      if ((/[.!?]$/.test(w.text) && words.length >= 3) || chars > 60) flush();
    }
    flush();
  }
}
cues.forEach((c, i) => {
  if (cues[i + 1] && c.end > cues[i + 1].start) c.end = cues[i + 1].start - 0.01;
});
writeFileSync("../out/paper-coach-studio-tour.en.srt", cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join("\n"));
console.log(RESOLVED.map((r) => `${clock(r.start)} ${r.section.title ?? NAMES[r.section.id]}`).join("\n"));
for (const r of RESOLVED) if (r.dur < 10) console.warn(`chapter ${r.section.id} is ${r.dur.toFixed(1)} s: YouTube wants 10 s or more`);
