# Paper Coach Studio, the tour (16:9, for friends)

A 3:54 tour of the Studio made 2026-10-03 at Kevin's request, to show friends (app developers) what it does:
Paths, Voice, Learners (the longest), Social, Docs and Today, in that order, with the thread that Claude runs much
of Paper Coach through it. Unlisted on YouTube (*Posting*). Not a Paper Coach promotion: it never goes public on
the schedule.

Kevin's choices: the Studio in its **light theme**; real data as it was that morning (learners are anonymous);
a narrator who is **not Lina**: after a few rounds of samples, "the British guy", excited and casual, *like a
friend showing you something cool, not a documentary*; and in the video Kevin is **Zak** (the narration says Zak,
and the recordings swap "Kevin" for "Zak" wherever the Studio shows it). Anything small enough to read on a phone
is zoomed into.

## What's here

- `rec/`: the recordings. `record.mjs [clip …] [--width=1152]` drives the live Studio
  (http://localhost:5173) in a headless Chrome with Playwright and records it with the DevTools screencast
  (`rec.mjs`), at 2880 × 1620 so the edit can zoom in and stay sharp: a page 1440 CSS pixels wide, or 1152 for the
  Learners clips (bigger text). It only plays, scrolls and opens things; it never makes, approves or publishes
  anything. A cursor is drawn into the page, and "Kevin" becomes "Zak". Each clip lands in `raw/<clip>.mp4` with
  `<clip>.marks.json` (seconds from its first frame). Week and Month on Learners are asked for once first, so
  PostHog has answered before filming. `sfx.mjs` renders the Learners page's own sounds (`web/src/studio/sounds.ts`,
  Web Audio) to WAV with an OfflineAudioContext.
- `voice/`: the narrator. `lines.tsv` is the script (id, words); `make.sh [id …]` speaks it with the local TTS
  server, cloning `ref/narrator.wav` (its words in `ref/narrator.txt`) with Qwen3 Base; `samples/` holds the voices
  Kevin chose from (`g-british-clone` won: a Qwen VoiceDesign British man, then cloned to sound excited).
  `norm.py` trims each take to its words and brings it to -16 LUFS into `video/public/vo`, Lina's take
  (`assets/lina-wobble.audio`, the frozen "Encouragement" from `/api/voice/takes/mu092f72-237e31b1`) at -17;
  `captions.py` gives every word its time from Whisper (`whisper <take> --model small.en --word_timestamps True`)
  into `video/src/captions.json`. Whisper hears "Zak" as Zach and "Lina" as Lena; those are listed, not errors.
- `music/`: `run.sh` makes the 240 s bed with ACE-Step 1.5 (`gen.py`, lean settings for this 16 GB Mac; see
  `../overview-1.1/music/gen.py`), upbeat lo-fi at 104 BPM in D major, seed 104. Never run it beside a render, the
  simulators or the TTS server; watch swap.
- `video/`: the Remotion project. `src/edit.ts` is the edit: sections, what is heard in each (times follow the takes'
  lengths), the shots under them and each shot's camera (`cam`: where it looks and how close); `src/Tour.tsx` the
  look: full-bleed recordings, word-by-word captions, the section tag, callouts, the sounds named as they play,
  Lina's badge, the lesson video in a phone, the title and end cards; `src/Thumbnail.tsx` YouTube's picture.
  `stills.mjs <dir> <frame> …` renders frames to check; `tools/meta.ts` writes the SRT and prints the chapters.
- `grid.sh <clip> <t> …`: frames of a recording with a 10% grid, to place the camera.
- `out/`: `paper-coach-studio-tour.mp4`, its `.en.srt` and `thumbnail.jpg`.

Its source is kept in `docs/videos/studio-tour` (`docs/videos/sync.sh studio-tour`); the recordings, takes, music
and renders stay on m4-1.

## Making it again

The clips are copied into `video/public/clips` as hard links of `raw/` (`ln -f raw/<clip>.mp4 video/public/clips/`).
From `video/`:

    npx remotion render StudioTour ../render/tour-raw.mp4 --codec=h264 --crf=18 --concurrency=2
    npx remotion render StudioTour ../render/tour-audio.wav --codec=wav
    npx remotion still Thumbnail ../out/thumbnail.png && magick ../out/thumbnail.png -quality 90 ../out/thumbnail.jpg
    node_modules/.bin/esbuild tools/meta.ts --bundle --platform=node --format=esm --outfile=tools/meta.mjs && node tools/meta.mjs
    cd .. && ./loudnorm.sh render/tour-raw.mp4 render/tour-audio.wav out/paper-coach-studio-tour.mp4

## Posting

YouTube, unlisted, on the Softroni channel through Upload-Post (`social announce --wide --unlisted --platforms
youtube … --campaign studio-tour`), so it never counts as a post that went out. The link is in the posts record
(`.studio/social/posts.jsonl`).
