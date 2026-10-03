# What's new in Paper Coach 1.1 (16:9)

A 2:07 what's-new video of 1.1 (4), for every platform the day 1.1 goes on sale (social-plan.md, *What's new
videos*). Made 2026-10-02 by the social check while 1.1 was waiting for review. Not posted: 1.1 isn't on sale yet.

What it shows, in order: Around Town (the path, its ten lessons, the fire hydrant drawn with Lina's own step
recordings), the iPad turning sideways (Home, then the lesson with the teacher beside the paper, then upright on
its sheet), Original / Bright / Scan for a dim photo, fixing a kept page's light and corners, the real drawing time,
the path colors, then "how it works" (watch, draw, color, keep) and the end card with the App Store badge.

- `raw/`: screen recordings of the `release/1.1` build (`81f492a`, worktree `../../../stroketutor-release-1.1`,
  Debug) on two scratch simulators, deleted afterwards: an iPhone 17 Pro (`p0*`) and an iPad Pro 13" (M5) (`d0*`),
  status bar at 9:41 and full battery. `*.log` holds each run's STEP and MARK lines; `norm/` the 30 fps copies.
  simctl writes frames only when the screen changes, so cut points were read off contact sheets, not the marks.
- `driver/`: a throwaway XCUITest project (xcodegen) that taps and turns the installed app from a script, for runs
  where the Simulator tools aren't available (a scheduled run). `run.sh <udid> "<script>" out.mp4` records while
  it plays; the commands are listed at the top of `DriverUITests/Driver.swift`.
- `voice/`: Lina's lines (`lines.tsv`, `make.sh`: `studio voice say lina-bright`), her in-app recordings of the
  fire hydrant's `collar` and `dome`, and Whisper's transcripts (`whisper/`). Every line was heard as written
  (v02 and v03 differ only as "11th", "110", "shopfront", "cafe").
- `video/`: the Remotion project, copied from `.studio/overview-1.0`. `src/scenes.ts` is the edit, `src/WhatsNew.tsx`
  the look (the iPad is turned in the edit; its clips stay in its upright frame, with the resize arc covered),
  `src/captions.json` the word times, `public/vo` the voices at -16 LUFS.
- `out/`: `paper-coach-whats-new-1.1.mp4` (audio at -16 LUFS), `paper-coach-whats-new-1.1.en.srt`, and
  `thumbnail.jpg` (and `.png`).

Re-render after an edit, then bring the sound to -16 LUFS again (two-pass `loudnorm`, as done here):

    cd video && npx remotion render PaperCoachWhatsNew ../out/paper-coach-whats-new-1.1.mp4 --codec=h264 --crf=18
    node --experimental-strip-types srt.ts > ../out/paper-coach-whats-new-1.1.en.srt
    npx remotion still Thumbnail ../out/thumbnail.png

Posting, the day 1.1 is on sale (live in `facts.json` and tagged `1.1(4)`), from `web/`:

    node cli/studio.mjs social announce --wide --video ../.studio/whats-new-1.1/out/paper-coach-whats-new-1.1.mp4 \
      --lesson fire-hydrant --news "Paper Coach 1.1: Around Town, a new path of 10 lessons from a fire hydrant to a café, every screen sideways on iPad, and Bright or Scan for photos in dim light." \
      --headline "What's new in Paper Coach 1.1: Around Town, step by step" --campaign whats-new-1-1 \
      --thumbnail ../.studio/whats-new-1.1/out/thumbnail.jpg --subtitles ../.studio/whats-new-1.1/out/paper-coach-whats-new-1.1.en.srt --log

If Apple rejects 1.1 and the build changes, check the video against the new build before it goes out.
