// Lina's captions as an SRT file for YouTube, timed as the video plays them: `node --experimental-strip-types srt.ts > out.srt`
import { readFileSync } from "node:fs";
import { FPS, SCENES, sceneFrames } from "./src/scenes.ts";


type Word = { text: string; start: number; end: number };
const captions: Record<string, { words: Word[] }> = JSON.parse(readFileSync(new URL("./src/captions.json", import.meta.url), "utf8"));
const stamp = (t: number) => {
  const ms = Math.round(t * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const cues: { from: number; to: number; text: string }[] = [];
let sceneStart = 0;
for (const scene of SCENES) {
  for (const voice of scene.voices) {
    let line: Word[] = [];
    const flush = () => {
      if (line.length === 0) return;
      cues.push({ from: sceneStart + voice.at + line[0].start, to: sceneStart + voice.at + line[line.length - 1].end + 0.3, text: line.map((w) => w.text).join(" ") });
      line = [];
    };
    for (const word of captions[voice.id].words) {
      line.push(word);
      // A cue ends at a sentence or a comma, or when it would be too long to read at a glance.
      if (/[.?!]$/.test(word.text) || (/,$/.test(word.text) && line.length >= 3) || line.map((w) => w.text).join(" ").length > 38) flush();
    }
    flush();
  }
  sceneStart += sceneFrames(scene) / FPS;
}
cues.forEach((cue, i) => {
  const to = Math.min(cue.to, cues[i + 1]?.from ?? Infinity);
  console.log(`${i + 1}\n${stamp(cue.from)} --> ${stamp(to)}\n${cue.text}\n`);
});
