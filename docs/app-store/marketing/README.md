# App Store screenshots

Framed, captioned screenshots for the Paper Coach listing: eight for the iPhone 6.9" display (1320 × 2868) and the
same eight for the iPad 13" display (2064 × 2752), in `out/iphone/` and `out/ipad/`, numbered in listing order.
They replace the plain simulator captures in `../screenshots/`.

| # | Headline | Screen (`-STScreen`) |
|---|---|---|
| 1 | Learn to draw step by step | `player-awaiting`, with a photo of a hand drawing the same palm tree on paper, the marker at the end of the leaf the phone shows |
| 2 | Watch a line, then draw it | `preview-default` |
| 3 | Then add a little color | `player-last` |
| 4 | 100 lessons on 10 paths | `lessons` |
| 5 | Start simple, then level up | `path-default` |
| 6 | A finished picture in minutes | `completion-default` |
| 7 | Keep every drawing | `sketchbook-filled` |
| 8 | Pick up where you left off | `home-progress` |

Every headline is something the app does today (listing.md: 100 lessons on 10 paths, three levels, five to ten
minutes a lesson, the sketchbook). The drawing on the paper in #1 is the palm tree lesson's own pen strokes,
read from `shared/Tutorials/palm-tree.json`, so it is exactly what a learner draws: steps 1 to 5 and step 6's arch part-way, ending at the marker's tip (`handDrawing` in `shots.js`).

## Files

```
shots.js      the shots: headline, capture, stickers, placement (edit this)
shots.html    draws one shot: shots.html?device=iphone&shot=learn
render.mjs    saves them all: node docs/app-store/marketing/render.mjs [iphone|ipad] [shot id]
capture.sh    takes the raw screens from the simulator through the debug harness
captures/     the raw screens, per device
frames/       Apple's device frames (not in git, see below)
assets/       Fredoka (SIL OFL, assets/fonts/OFL.txt) and the hand-drawing photo
out/          the upload files: RGB PNG, no alpha
```

The stickers are the lessons' own illustrations from `shared/Assets/References/`, plus pencils drawn in
`shots.html`. `render.mjs` drives the installed Google Chrome through the Studio's Playwright (`web/node_modules`).

## Device frames

Apple's Design Resources licence allows the frames in screenshots but not redistribution, so `frames/` is ignored
by git. `render.mjs` looks in `frames/` first and then in `~/Library/Application Support/Softroni/DeviceFrames/`,
where this Mac keeps one copy for every checkout and worktree, so nothing needs setting up here. On another Mac,
open the Bezel disk images from https://developer.apple.com/design/resources/, accept the licence, and copy these
two PNGs into either folder:

- `Bezel-iPhone-18.dmg` › `PNG/iPhone 18 Pro Max/iPhone 18 Pro Max - Black - Portrait.png`
- `Bezel-iPad-Pro-(M5).dmg` › `PNG/iPad Pro (M5) 13" - Space Black - Portrait.png`

A fresh worktree also needs the Studio's packages for Playwright: `npm install` in `web/`.

## Changing a shot

Headlines, captures, stickers and placement are all in `shots.js`; the look (colours, font, sticker rim, pencils)
is in `shots.html`. Tune one shot in a browser through the same server `render.mjs` starts, or just re-render it:
`node docs/app-store/marketing/render.mjs iphone learn`. Upload `out/` to App Store Connect when done (the
upload used the API: delete the set's screenshots, reserve, PUT, commit, then order them).

## Capturing again

After a UI change, build the Debug app for the simulator, install it on the two screenshot simulators
(iOS 26.5: "PC Shots iPhone 17 Pro Max" and "PC Shots iPad Pro 13"; `xcrun simctl list devices | grep "PC Shots"`
gives their udids), boot them, then capture and render:

```bash
docs/app-store/marketing/capture.sh <iphone udid> iphone player-awaiting preview-default player-last lessons path-default completion-default sketchbook-filled home-progress
docs/app-store/marketing/capture.sh <ipad udid> ipad player-awaiting preview-default player-last lessons path-default completion-default sketchbook-filled home-progress
node docs/app-store/marketing/render.mjs
```

Home needs longer to settle than the other screens: capture it with `SETTLE=9`. Harness launches send no analytics
and never reach Superwall. On these simulators the iPad app opened full screen, not in a window.

## Credits

- Hand drawing with a marker: Mohamed_hassan on Pixabay, https://pixabay.com/photos/writing-hand-write-pen-handwriting-3709125/
  (Pixabay Content License). No face is shown.
- Fredoka: The Fredoka Project Authors, SIL Open Font License 1.1.
