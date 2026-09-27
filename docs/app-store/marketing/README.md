# App Store screenshots

Framed, captioned screenshots for the Paper Coach listing: eight for the iPhone 6.9" display (1320 × 2868) and the
same eight for the iPad 13" display (2064 × 2752), in `out/iphone/` and `out/ipad/`, numbered in listing order.
They replace the plain simulator captures in `../screenshots/`.

| # | Headline | Screen (`-STScreen`) |
|---|---|---|
| 1 | Learn to draw step by step | `player-awaiting`, with a photo of a hand drawing the same palm tree on paper, the marker at the end of the leaf the phone shows |
| 2 | Draw what you love | `paths` |
| 3 | Keep every drawing | `sketchbook-filled`, with a photo of hands holding a sketchpad with the sunflower lesson drawn and colored on it |
| 4 | Finish it in full color | `player-last@donut` |
| 5 | Watch a line, then draw it | `preview-default@rocket` |
| 6 | Start simple, then level up | `path-default` |
| 7 | A finished picture in minutes | `completion-default@sailboat` |
| 8 | Pick up where you left off | `home-progress` |

The first three are what App Store search shows, side by side at about a third of the phone's width, so they
say three different things (how it works, what there is to draw, what you keep) with three different drawings.
Every lesson ends with color steps, which is what #4 claims. No caption names a count of lessons or paths, since
both will grow.

Every headline is something the app does today (listing.md: lessons on many subjects, three levels, five to ten
minutes a lesson, the sketchbook). The drawings in #1 and #3 are the lessons' own pen strokes,
read from `shared/Tutorials/`, so they are exactly what a learner draws; in #1, steps 1 to 5 and step 6's arch part-way, ending at the marker's tip (`handDrawing` and `sketchpad` in `shots.js`).

## Seeing them

`gallery.html` shows every screenshot in listing order, and the first three at the size App Store search shows
them. `render.mjs` rewrites it after each run (`node docs/app-store/marketing/gallery.mjs` does it alone).

- In Paper Coach Studio: **Screenshots** in the top bar (http://m4-1.tail958ea4.ts.net:5173/#/screenshots, or
  http://localhost:5173/#/screenshots on this Mac), with an iPhone/iPad switch and a full-size viewer (←/→, Esc).
  It picks up a new render by itself.
- On this Mac: file:///Users/kevin/dev/stroketutor/docs/app-store/marketing/gallery.html
- From any device on the tailnet, through the always-on Studio server:
  http://m4-1.tail958ea4.ts.net:5173/@fs/Users/kevin/dev/stroketutor/docs/app-store/marketing/gallery.html

The autopull agent fast-forwards this checkout from GitHub, so both show what is on `main` within a minute of a push.

## Files

```
shots.js      the shots: headline, capture, stickers, placement (edit this)
shots.html    draws one shot: shots.html?device=iphone&shot=learn
render.mjs    saves them all: node docs/app-store/marketing/render.mjs [iphone|ipad] [shot id]
gallery.mjs   writes gallery.html, the page that shows them
capture.sh    takes the raw screens from the simulator through the debug harness
captures/     the raw screens, per device
frames/       Apple's device frames (not in git, see below)
assets/       Fredoka (SIL OFL, assets/fonts/OFL.txt) and the two photos
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
docs/app-store/marketing/capture.sh <iphone udid> iphone player-awaiting paths sketchbook-filled player-last@donut preview-default@rocket path-default completion-default@sailboat home-progress
docs/app-store/marketing/capture.sh <ipad udid> ipad player-awaiting paths sketchbook-filled player-last@donut preview-default@rocket path-default completion-default@sailboat home-progress
node docs/app-store/marketing/render.mjs
```

A lesson screen draws the palm tree unless another lesson follows an `@` (`player-last@donut` launches with
`-STLesson donut`). Only shot 1 uses the palm tree, since its photo shows the same drawing; the others each show a
different free lesson (the first of its path), so the listing shows the range of drawings, not one picture four times.

Each screen gets 8 seconds to settle (the player's reference picture loads last); Home needs longer: capture it
with `SETTLE=9`. The iPad captures are from the sidebar layout (commit `3b377c7`), so they go with a build that has
it; the iPhone screens did not change. Harness launches send no analytics
and never reach Superwall. On these simulators the iPad app opened full screen, not in a window.

## Credits

- Hands holding a sketchpad: Kai_NITEandDAY on Pixabay, https://pixabay.com/photos/hand-note-airplane-sketchbook-1791337/
  (Pixabay Content License).
- Hand drawing with a marker: Mohamed_hassan on Pixabay, https://pixabay.com/photos/writing-hand-write-pen-handwriting-3709125/
  (Pixabay Content License). Neither photo shows a face.
- Fredoka: The Fredoka Project Authors, SIL Open Font License 1.1.
