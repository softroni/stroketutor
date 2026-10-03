# Paper Coach, the full tour (1.1, 16:9)

A 3:59 tour of Paper Coach for people who have never heard of it, made 2026-10-03 at Kevin's request: what it is,
how a lesson works on real paper, the 110 lessons, free and Premium, iPhone and iPad, profiles and reminders, a few
tips, and the end card with the App Store badge. Lina's voice over soft lo-fi music made on this Mac. It goes out
**the day after 1.1's what's-new video** (Kevin, 2026-10-03), so the day after 1.1 goes on sale. Not posted yet.

Chapters (also in the YouTube description, see *Posting*):

    0:00 Learn to draw with Paper Coach
    0:28 How it works
    1:41 So much to draw
    2:08 Free and Premium
    2:41 iPhone and iPad
    3:08 For everyone at home
    3:34 A few tips
    3:50 Download Paper Coach

## What's here

- `raw/`: screen recordings of the `release/1.1` build (`81f492a`, the 1.1 (4) in review; worktree
  `../../../stroketutor-release-1.1`, Debug, built 2026-10-02) on two scratch simulators, deleted afterwards: an
  iPhone 17 Pro (`p*`) and an iPad Pro 13" (M5) (`d*`), status bar at 9:41 and full battery. Driven by the what's-new
  video's XCUITest driver (`../whats-new-1.1/driver/run.sh <udid> "<script>" out.mp4`); `*.log` holds each run's
  steps. simctl writes frames only when the screen changes and in bursts, so cut points were read off contact sheets.
  What each holds is listed at the top of `video/src/scenes.ts`. The completion screen is `-STScreen
  completion-default` (the lesson's 3 min estimate), because the recorder squeezed the real one to a few frames.
- `voice/`: Lina's lines (`lines.tsv`: id, words, and the words as shown when they differ; `make.sh` speaks them
  with `studio voice say lina-bright`), two of her in-app recordings of the balloon (`app.tsv`), two lines cut in two
  at a pause (`splits.tsv`), Whisper's word times (`whisper/`), `captions.py` (word times → `video/src/captions.json`;
  it lists any word Whisper heard differently: only "Lena", "110" and "Everyone", all as said) and `norm.py` (every
  take at -16 LUFS into `video/public/vo`).
- `music/`: the background track. `gen.py` makes it with [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5)
  (MIT licence, installed at `~/dev/tools/ACE-Step-1.5`, its weights in `checkpoints/`, about 9.4 GB), turbo model,
  no language model, bfloat16 on MPS, the model freed before the audio is decoded: on this 16 GB Mac its defaults
  (float32 plus an MLX copy, about 19 GB) swapped the Mac into a restart. Never run it next to the simulators.
  `sample-style-30s.m4a` is the style test; `full/` the track used, `video/public/music/bed.wav` its copy.
- `video/`: the Remotion project, grown from the what's-new one. `src/scenes.ts` is the edit (scenes, clips,
  voices, what is drawn on the paper; `X_SCENES` the cut for X), `src/Overview.tsx` the look and the music under
  Lina (about 11 dB down while she speaks), `src/Desk.tsx` the phone on a desk beside a sketchbook with the lesson's
  own strokes drawn on the page (photo: Pixabay 1558811 by World-fly, Pixabay Content License), `src/Wall.tsx` all
  110 drawings with the free and Premium ones standing out, `src/Thumbnail.tsx` YouTube's thumbnail.
- `out/`: `paper-coach-tour-1.1.mp4` (3:59), `paper-coach-tour-1.1-x.mp4` (2:16, for X, which takes at most 2:20),
  `paper-coach-tour-1.1.en.srt`, `thumbnail.jpg` (and `.png`). Sound at -16 LUFS.

## Making it again

From `video/`, after an edit (the picture and the sound render apart, so a change to the mix alone needs only the
two `--codec=wav` lines):

    npx remotion render PaperCoachTour ../render/tour-raw.mp4 --codec=h264 --crf=18 --concurrency=3
    npx remotion render PaperCoachTourX ../render/tour-x-raw.mp4 --codec=h264 --crf=18 --concurrency=3
    npx remotion render PaperCoachTour ../render/tour-audio.wav --codec=wav
    npx remotion render PaperCoachTourX ../render/tour-x-audio.wav --codec=wav
    npx remotion still Thumbnail ../out/thumbnail.png && magick ../out/thumbnail.png -quality 90 ../out/thumbnail.jpg
    node --experimental-strip-types srt.ts > ../out/paper-coach-tour-1.1.en.srt
    cd .. && ./loudnorm.sh render/tour-raw.mp4 render/tour-audio.wav out/paper-coach-tour-1.1.mp4
    ./loudnorm.sh render/tour-x-raw.mp4 render/tour-x-audio.wav out/paper-coach-tour-1.1-x.mp4

Keep only finished files in `out/`: the Studio's Social page lists every `out/*.mp4` as a video made and not posted.
`node stills.mjs <dir> <frame> …` renders single frames to check the look; `node --experimental-strip-types
chapters.ts` prints the chapters. Checked 2026-10-03: a frame sheet of both cuts, -16.0 LUFS, no silence over
1.5 s, the music 7 to 11 dB under Lina between her lines and about 17 dB under while she speaks, Whisper hearing
her words exactly over it.

## Posting

The day after 1.1's what's-new video went out (social-plan.md, *The tour video*), from `web/`, three posts with the
same words: YouTube with the chapters in its description, X with the short cut, the five others as it is.

    T=../.studio/overview-1.1/out
    NEWS="New to drawing? Paper Coach teaches you one line at a time, on real paper: watch a line, draw it, color it, keep it in your sketchbook. 110 lessons on 11 paths, the first three of every path free, on iPhone and iPad."
    CHAPTERS=$(sed -n '/^Chapters/,/^## /p' ../.studio/overview-1.1/README.md | grep -E '^    [0-9]+:' | sed 's/^    //')
    HEAD="Learn to Draw Step by Step on Real Paper: the Paper Coach Tour"
    node cli/studio.mjs social announce --wide --platforms youtube --video $T/paper-coach-tour-1.1.mp4 --lesson hot-air-balloon \
      --news "$NEWS"$'\n\n'"$CHAPTERS" --headline "$HEAD" --campaign tour-1-1 --thumbnail $T/thumbnail.jpg --subtitles $T/paper-coach-tour-1.1.en.srt --log
    node cli/studio.mjs social announce --wide --platforms tiktok,instagram,facebook,threads,pinterest --video $T/paper-coach-tour-1.1.mp4 \
      --lesson hot-air-balloon --news "$NEWS" --headline "$HEAD" --campaign tour-1-1 --thumbnail $T/thumbnail.jpg --log
    node cli/studio.mjs social announce --wide --platforms x --video $T/paper-coach-tour-1.1-x.mp4 --lesson hot-air-balloon \
      --news "$NEWS" --headline "$HEAD" --campaign tour-1-1 --thumbnail $T/thumbnail.jpg --log

Try each with `--dry-run` first. If Apple rejects 1.1 and the build changes, check the video against the new build
before it goes out.
