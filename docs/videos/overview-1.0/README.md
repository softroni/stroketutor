# Paper Coach 1.0 overview video (16:9)

A 79-second overview of what 1.0 (2) does, for YouTube and Facebook: the upright iPad recording on the
left of a mint 1920 × 1080 frame, a headline and Lina's speech bubble (word by word) on the right, and an
end card with the App Store badge. Made 2026-10-01.

- `raw/`: screen recordings of the `1.0(2)` build (worktree `../../../stroketutor-1.0`) on a scratch
  iPad Pro 13" (M5) simulator, upright, status bar set to 9:41 and full battery. `01` first run,
  `02` the sailboat lesson and the tabs, `03` harness screens (`-STScreen capture-corners`,
  `capture-saved`, `sketchbook-filled`, `profiles-picker`), `05` splash, intro and Watch/Draw/Tap.
- `voice/`: Lina's new lines (`studio voice say lina-bright … --out`), her real 1.0 step recordings for
  the sailboat (`deck`, `hull`), and Whisper's word times (`whisper/`). The hook's first take was heard
  as "dry it", so take 2 is used.
- `video/`: the Remotion project. `src/scenes.ts` is the edit (clips, speeds, voice cues, headlines);
  `src/Overview.tsx` the look; `src/captions.json` the word times. `public/clips` are the cuts
  (1032 × 1376, 30 fps), `public/vo` the voices at -16 LUFS.
- `out/paper-coach-overview-1.0.mp4`: the render.

Re-render after an edit:

    cd video && npx remotion render PaperCoachOverview ../out/paper-coach-overview-1.0.mp4 --codec=h264 --crf=18

Preview: `cd video && npx remotion studio`.

## For the 1.1 version

1.1 adds what 1.0 can't show: every screen turns sideways on iPad (1.0 rotates only the player),
the teacher beside the paper on iPad, Original/Bright/Scan for a page photo, the real drawing time on
completion, editing a kept page, Around Town, Lifetime and "Redeem a code". Record those from the
`1.1(…)` tag the same way, copy `video/` and change `scenes.ts`.
