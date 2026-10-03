# Promotion videos

The source of every 16:9 promotion video (posted with `social announce --wide`), one folder each, kept for future
videos to start from. Kevin's rule of 2026-10-03: **a promotion video's source goes into git as soon as it is made
or changed.**

| Folder | Video | Length | Made | Goes out |
|---|---|---|---|---|
| [`overview-1.0`](overview-1.0) | What Paper Coach 1.0 does, on an upright iPad | 1:19 | 2026-10-01 | Posted everywhere 2026-10-01 ([YouTube](https://www.youtube.com/watch?v=IFf4_f78Y9k)) |
| [`whats-new-1.1`](whats-new-1.1) | What's new in 1.1: Around Town, iPad sideways, Bright and Scan… | 2:07 | 2026-10-02 | The day 1.1 is on sale |
| [`overview-1.1`](overview-1.1) | The tour, for people new to Paper Coach: how it works, 110 lessons, free and Premium, iPhone and iPad, tips; soft music. A 2:16 cut for X | 3:59 | 2026-10-03 | The day after 1.1's what's-new video |
| [`studio-tour`](studio-tour) | The Studio itself, for Kevin's friends: Paths, Voice, Learners, Social, Docs, Today, and Claude running it; British narrator, upbeat music, light theme | 3:54 | 2026-10-03 | YouTube, unlisted, shared by hand; never on the schedule |

Each folder's own README says how that video was recorded, voiced, edited and rendered, and how it is posted. The
plan behind them is `docs/ops/social-plan.md` (*What's new videos*, *The tour video*).

## What is here, and what isn't

A video is made in `.studio/<folder>` (git ignores `.studio`), beside everything heavy: the screen recordings
(`raw/`), the clips cut from them and Lina's takes (`video/public/clips`, `video/public/vo`), the music, Whisper's
output and the renders (`out/`). Those stay on the Mac they were made on (m4-1); the posted videos are on the
platforms. Here is everything else, copied by `sync.sh`:

- the Remotion project: `video/src` (the edit in `scenes.ts`, the look, the captions' word times), `package.json`
  with its lock, the configs, and the scripts beside them (`srt.ts`, `chapters.ts`, `stills.mjs`);
- Lina's script and the scripts that speak, time and level it (`voice/lines.tsv`, `make.sh`, `captions.py`,
  `norm.py`);
- for the 1.1 videos, the XCUITest driver that taps and turns the app while it records
  (`whats-new-1.1/driver`), and for the tour the music generator (`overview-1.1/music/gen.py`) and `loudnorm.sh`.

Left out on purpose, and where to get them back:

- `video/public/brand`: the same four files in every video, kept once in [`brand/`](brand) (the app icon, Fredoka
  under the SIL OFL, Apple's App Store badge, Lina).
- `video/public/refs` (the tour): the lessons' pictures, `shared/Assets/References/*.svg` of the release.
- `video/public/photos` (the tour): Pixabay photo 1558811 (World-fly), not ours to republish on its own in a
  public repo; fetch it again with the key in `~/.config/pixabay/config`
  (`https://pixabay.com/api/?key=…&id=1558811`, its `largeImageURL`) as `px-1558811.jpg`.
- `driver/PCDriver.xcodeproj` and `driver/dd`: made by `xcodegen` from `project.yml` and by its build.

## Making the next one

1. Copy the closest folder to `.studio/<new folder>` (`whats-new-<version>`, `overview-<version>`…), then
   `cp docs/videos/brand/* .studio/<new>/video/public/brand/` and `npm ci` in its `video/`.
2. Record from the release branch's build on scratch simulators made for it (never "PC Shots" or "PC Review"),
   with the driver: `cd .studio/whats-new-1.1/driver && xcodegen && xcodebuild build-for-testing -project
   PCDriver.xcodeproj -scheme DriverUITests -destination 'generic/platform=iOS Simulator' -derivedDataPath dd`
   once, then `run.sh <udid> "<script>" out.mp4`.
3. Voice, edit, music and render as the folder's README says; check the render before it goes out.
4. Keep its source: `docs/videos/sync.sh <new folder>`, then commit `docs/videos/<new folder>`. Again after any
   change to a video.
