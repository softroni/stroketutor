# StrokeTutor

A guided physical-sketching system for adult beginners. The phone is a calm instructor. It animates one
meaningful drawing step, stops, and waits while the learner copies that step onto real paper with a real pen.
Nothing continues until the learner taps "I drew it".

The direction of the project is set by the master plan, [docs/StrokeTutor_Master_Plan.pdf](docs/StrokeTutor_Master_Plan.pdf).
Read it before proposing architecture, schema or content-pipeline changes. This README tracks delivery of that
plan as milestones.

```
shared/                 contract read by both players: schema v1, Tutorials/, conformance/
StrokeTutor/            SwiftUI learner app (iOS)        StrokeTutorTests/  iOS tests
web/                    React/Vite player → StrokeTutor Studio (private authoring tool)
docs/                   master plan
```

See [shared/README.md](shared/README.md) for the content contract and [web/README.md](web/README.md) for the web player.

## Ground rules (from the master plan, §12 and §39)

- **`shared/tutorial.schema.json` v1 does not change** while the Studio is being proven. Curriculum, authoring and
  asset metadata live *beside* tutorials (`shared/Catalog/`, `shared/Assets/`), never inside them.
- **Keep the asymmetry:** the web Studio is strict and iOS is lenient. Never weaken a test because generated content fails it.
- **The TypeScript and Swift SVG parsers keep identical semantics.** The conformance corpus is the gate.
- **`TutorialPlayer` is the learner preview.** Never build a Studio-only imitation of it.
- **No separate final artwork.** The final drawing is every tutorial stroke, complete.
- **The Studio writes repository files; it never runs git.**
- The OpenRouter key stays server-side. The file API writes only to whitelisted paths under `shared/`.

## Milestones

Milestone numbers match the Phases in the master plan's roadmap (§33).

| ID | Milestone | Plan ref | Mode | Status | Commit |
|---|---|---|---|---|---|
| M0 | Baseline: protect the PoC | §34 Phase 0 | autonomous | ✅ Done 2026-09-11 | `5a4e687` |
| M1 | Studio shell + catalog | §14–15, §26, §34 Phase 1 | autonomous | ✅ Done 2026-09-11 | `5482365` |
| M2 | Lesson editor | §17–19, §34 Phase 2 | autonomous | ✅ Done 2026-09-11 | `4c40bf3` |
| M3 | Repository writer | §25, §27, §34 Phase 3 | autonomous | ✅ Done 2026-09-11 | `25d4368` |
| M4 | OpenRouter integration | §20–22, §35 Phase 4 | autonomous (live check needs a key) | ✅ Done 2026-09-11 | see git log |
| M5 | AI generation quality | §23–24, §35 Phase 5 | **gated**: needs creator judgement | 🟡 In progress | see git log |
| M6 | Houses vertical slice | §35 Phase 6, App. A | **gated**: needs reference photos + approval | ⬜ Not started | |
| M7 | iOS product shell | §29–31 | **gated** on M6 | ⬜ Not started | |
| M8 | Private sketchbook | §32 | gated | ⬜ Not started | |
| M9 | Content expansion | §33 Phase 9 | gated | ⬜ Not started | |
| M10 | Monetization / distribution | §33 Phase 10 | gated | ⬜ Not started | |

Status key: ⬜ not started · 🟡 in progress · ✅ done · ⏸ blocked (see notes).

### Next up

**M5, part 2: generation history and compare.** Keep every generation and regeneration beside the draft, not in
`shared/Tutorials`, so a new version never replaces a good one blindly, with a side-by-side compare and "use this one"
(§24). Part 1, regenerating one layer at a time, is done; see M5 below.

Part 3 needs the creator: real reference photos, live model iteration and their judgement on the prompt. Start with the
observations under M4 below.

---

### M0 · Baseline: protect the PoC
- [x] `cd web && npm test` and `npm run build` green; record counts.
- [x] `xcodebuild test` (iPhone 17 simulator) green; record counts.
- [x] simple-house and cat-face play on web and on iOS.
- [x] Record the deliberate web/iOS divergences (see [shared/README.md](shared/README.md)).
- [x] Log gaps between the plan and the current code, without changing behaviour.

**Exit:** the baseline is documented below and green.

### M1 · Studio shell + catalog
- [x] `shared/Catalog/paths.json` + `lessons.json`: ordered paths; lesson status (draft / needs-review / approved),
      objective, stage, and an optional reference `{file, source, license}`. The tutorial schema is untouched.
- [x] Catalog validation with tests: dangling ids, duplicates, every lesson resolves to a tutorial.
- [x] Tutorials load from `shared/Tutorials/*.json` by glob, so new files appear without code changes.
- [x] Paths view: ordered lessons, status, finished-stroke thumbnail, estimated time, drag reorder.
- [x] Lesson Workspace: Reference | Drawing | Steps, with debug tools under Advanced.
- [x] Existing paste/drop/file import still works.
- [x] simple-house appears in a Houses path.

**Exit:** path and lesson navigation work with the existing sample.

**Done.**
- **Verification:** web 80 tests (22 new) and the build pass; iOS still 35/35.
- **Checked in the browser:** the Paths view, the Lesson Workspace, Preview as learner, and Import & test. After a fresh load there were no console errors.

**Departures and decisions:**
- **One schema file.** The catalog schema is `shared/catalog.schema.json`, with a definition for each of the two files. The plan left the format open.
  "Stage" became `complexity` (1–5), and I added a creator-only `notes` field.
- **Lesson id = file name.** A lesson's id is its tutorial's file name. The Studio refuses a tutorial whose `id` doesn't match its file name,
  because lessons are found and saved by id.
- **Preview arrived early.** "Preview as learner" (listed under M2) landed now, because `TutorialPlayer` already accepts any validated tutorial.
- **Placeholder time estimate.** Estimated learner time is animation × 3 + 8 s per step. Calibrate it against real lessons in M6.
- **Catalogue status.** simple-house is catalogued as `needs-review`, because its copy is child-oriented. cat-face stays out of the catalog.
- **Importer moved.** The importer moved from `app/App.tsx` to `app/ImportView.tsx`, under **Import & test**. The narrow-layout overlap is fixed.
- **Reorder isn't saved yet.** Lesson reordering holds in memory until the repository writer (M3) can save it.

### M2 · Lesson editor
- [x] Pure, tested ops: reorder steps/strokes, move strokes, group into a new step, split, merge, delete stroke, and
      edits to title, instruction, duration and lineWidth. Undo/redo.
- [x] Invariants hold: every stroke appears exactly once (except explicit deletes), no empty steps, unique step ids.
- [x] Canvas stroke selection (click, shift-click), step list reorder, temporary step colours in Edit mode.
- [x] Replay a stroke, a step or the whole lesson; live strict validation.
- [x] "Preview as Learner" mounts the real `TutorialPlayer`.

**Exit:** simple-house can be reordered, grouped and split, then re-previewed, with no hand-written JSON.

**Done.**
- **Tests:** web 106 (26 new). The editor ops are checked against both golden files, including 300 random operations on each,
  asserting the invariants and strict validity after every step. The build passes. Nothing in `shared/` or iOS changed, so the iOS
  tests weren't re-run.
- **In the browser:** on simple-house I moved a step, undid it with ⌘Z, split "Add two windows", and grouped the door with a window into a new
  step. The lesson stayed valid throughout, and Preview as learner played the edited five-step lesson in `TutorialPlayer`. No console errors.

**Departures and decisions:**
- **Edits aren't saved yet.** Edits live in the open lesson only. Leaving it discards them, and a reload or close asks first. Saving is M3.
- **Selection ids are editor-only.** They're stripped on the way out, and fields are rebuilt in the golden files' order, so an unchanged lesson
  round-trips byte for byte.
- **Moving strokes between steps.** Strokes change step through Group or "Move to step…" on the selection, not by dragging. Steps reorder by
  drag or with the arrow buttons; every operation is reachable from the keyboard.
- **Placeholder wording.** A grouped step starts as "New step" with placeholder wording, and a split step's second half is titled "… (continued)".
  The creator rewrites both; validation doesn't flag placeholders yet. That's a candidate warning for M5.
- **Splitting.** Split is a faint "split here" rule between strokes, always visible, so it can be found without hovering.
- **Replay.** Replay uses `StrokeCanvas` with the same duration-based clock as playback. The interactive canvas is a separate static SVG with
  wide invisible hit areas, so thin strokes are easy to click.

### M3 · Repository writer
- [x] Local dev-server API. It writes only to `shared/Tutorials/`, `shared/Assets/References/` and `shared/Catalog/`.
      Ids are safe, writes are atomic, and the client never supplies a path.
- [x] Server-side strict validation before any write.
- [x] Non-blocking quality warnings: stroke count, tiny strokes, estimated time over 5 min, crowded step.
- [x] Approve & Save → re-read the saved file → confirm stroke/step order matches → show the result.
- [x] Tests: traversal rejected, non-whitelisted paths rejected, invalid tutorials refused, save/reload parity.

**Exit:** an edited tutorial validates, saves to `shared/Tutorials`, reopens, and matches the preview.

**Done.**
- **Web tests:** 140 pass (34 new: 13 file-writer, 7 formatter, 9 quality, 5 library), and the build passes.
- **iOS:** 35/35 passed with a Studio-written `simple-house.json` in place, so iOS loads what the Studio saves.
- **End to end in the browser:**
  1. Swapped the two window strokes and pressed Save. The diff was exactly those two strokes.
  2. The Studio read the file back from disk and reported it identical to the preview.
  3. Swapped them back and saved again, which left the golden file byte for byte.
  4. "Approve & save" set the status in `lessons.json`. That was a test edit, so I restored the status to `needs-review`.
  5. Neither save reloaded the page.
- **API guards, checked from the page:**

  | Request | Result |
  |---|---|
  | Write without the Studio header | 403 |
  | Non-image sent as PNG | 415 |
  | Traversal id | 400 |
  | Stale version | 409 |
  | Unknown route | 404 |

**Departures and decisions:**
- **Where the server lives.** It's Vite middleware (`web/server/studioApi.ts`) that runs only under `npm run dev`. `web/server/repoWriter.ts` does
  the file work, validating with the Studio's own validators loaded through Vite rather than a copy of them.
- **How writes are guarded:**
  - A write names the version it replaces: a SHA-256 of the file as read. A stale version gets 409, and a missing one on an existing file gets 428.
  - Writes must be same-origin and carry an `X-StrokeTutor-Studio` header.
  - Files are written to a temporary name, then renamed into place.
- **Reading through the API.** In dev the Studio reads `shared/` through `/api/library` instead of bundling it, so a save never reloads the page.
  Without the server (a static build) it falls back to a read-only bundled copy. *If a dev server served the Studio from before M3, restart it
  once:* its stale module graph reloads the page on save.
- **Formatting.** Saved JSON is formatted like the hand-written golden files, so an unchanged lesson saves byte for byte.
- **Reference photos:**
  - Stored as `shared/Assets/References/<lessonId>.<ext>`: JPEG, PNG or WebP, up to 8 MB, with the file signature checked.
    SVG was added later (see the follow-up below).
  - A source and a licence are required, and are recorded in `lessons.json`.
  - The upload *form* wasn't driven end to end, because the browser tool can't pick local files. The endpoint was exercised from the page and by tests.
- **Catalog writes.** `paths.json` and `lessons.json` are validated together, and both versions are checked before either file is written. The two
  renames aren't a single transaction.
- **Approval** writes the tutorial and sets the status to `approved`, after showing the §36 checklist. Quality warnings never block it.
- **Conformance test.** It now checks that the golden tutorials exist, rather than asserting an exact file list, because the Studio can add lessons.
- **Stroke length.** The quality checks measure stroke length from path geometry, since `measurePathLength` needs a DOM and returns 0 without one.
- **No git from the Studio.** The Studio still never runs git (§27); saves show up as ordinary diffs.

### M4 · OpenRouter integration
- [x] Server-side proxy; `OPENROUTER_API_KEY` in `web/.env.local` (gitignored); model id configurable.
- [x] Reference image + path context + creator prompt are sent only on an explicit Generate.
- [x] Structured `{analysis, tutorial}` output; only `tutorial` is strictly validated and allowed into the editor.
- [x] Failures keep the creator's input and never overwrite an approved lesson.
- [x] New Lesson flow with one "Generate Tutorial" action; Settings shows key status, never the key.
- [x] Fixture-based tests for malformed, missing and invalid responses.

**Exit:** an uploaded reference plus a prompt produces a candidate tutorial, and failures are handled cleanly.

**Done.**
- **Tests:** web 160 pass (20 new). The generation tests use recorded model outputs in `web/server/fixtures/`, one good and
  one that breaks the contract, and cover:
  - every OpenRouter failure mode in its error docs (401, 402, 429, 503, provider errors inside a 200, truncated output,
    non-JSON, missing analysis or steps);
  - input checks that run before anything is spent;
  - refusal of an existing id.
  The build passes. iOS isn't affected (only the catalog schema gained an optional field), so its tests weren't re-run.
- **Live check** on 2026-09-11, using the key in `web/.env.local`:
  - **Request:** a synthetic house image, lesson 2 of Houses, with the goal "add a chimney as the one new detail".
  - **Run:** `anthropic/claude-sonnet-5` answered in 59 s. It cost about $0.056 (2,169 tokens in, 5,204 out).
  - **Result:** a *valid* tutorial with 5 steps and 6 strokes: body, roof, a dedicated chimney step, door, windows.
    It also returned a sensible analysis of what it left out.
  - **Nothing written:** no files were written.
- **In the browser:** Settings shows the key as configured without showing it. The live model list has 236 models that
  take images and support structured output. New Lesson renders and lists what's still missing before Generate is enabled.
- **Not driven end to end:** "Keep as draft" wasn't driven through the UI, because the browser tool can't choose a photo in
  the file picker. It chains three calls, each already verified in M3 (create-only tutorial write, photo upload, catalog write).
  Try it once with a real photo.

**Departures and decisions:**
- **The model isn't fixed in code.** It's chosen in Settings from OpenRouter's live list and kept in the browser.
  `OPENROUTER_MODEL` can set a default.
- **The server fills in the fixed fields.** It sets `schemaVersion`, `id`, `title` and the 1000 × 1000 canvas, and the model
  supplies only the analysis and the steps. Step ids are made unique; everything else is left to strict validation, which
  names the exact field.
- **Invalid output never reaches the editor.** The candidate is shown with its issues instead. The browser re-validates with
  the same code before accepting anything.
- **Keeping a draft** writes the tutorial (create-only), the photo and a `draft` catalog entry. The entry records a new optional
  `generation` block (model, prompt version, goal, constraints, analysis) — the plan's "analysis as Studio metadata".
- **Prompt versioning.** The prompt is versioned as `lesson-v1` in `web/server/prompts/lessonPrompt.ts`.
- **Security.** Generation requests are guarded like writes (same-origin plus the Studio header), so another website can't spend credits.

**Observations to start M5 with**, from a single live run, so treat them as early signs:
- **Geometric first stroke.** The first stroke was a perfectly straight rectangle, despite the prompt asking for gentle hand
  curvature. This is the §37 "overly geometric" risk.
- **Child-leaning instruction.** One instruction referred back to "your simple house", which is good curriculum awareness,
  but another opened with a child-leaning tone.
- **Per-stage regeneration.** Regenerating a single stage (drawing, order, steps, instructions) is the natural next control.

### Follow-up · Path management (2026-09-11)
The plan's Studio MVP starts with "create and reorder a Path" (§28, item 1), but M1–M3 only covered lesson order.

**Added to the Paths view:**
- create a path: title, a fixed id and an optional description;
- edit a path's title and description;
- reorder paths;
- delete a path, but only once it's empty;
- move a lesson to another path, or out of all paths.

**Every change saves at once** through the repository writer. This also fixes a bug: an unsaved lesson order used to be
thrown away silently whenever another save re-read the catalog.

**Verified:**
- **Tests:** 173 web tests pass (13 new).
- **In the browser:** I created "Trees", moved it above Houses, moved Simple House into Trees and back, then deleted Trees.
  `paths.json` ended byte-identical to where it started.

### Follow-up · SVG reference images (2026-09-11)
A lesson's reference image can now be an SVG as well as JPEG, PNG or WebP, in both the workspace and New lesson.
- **Stored as is.** It's saved as `<lessonId>.svg`, and `reference.file` in `catalog.schema.json` allows `.svg`.
- **The model gets a PNG.** OpenRouter takes PNG, JPEG, WebP and GIF, but not SVG. So for generation the browser renders the
  SVG to a PNG (longest edge 1536 px, on white), and the server still refuses SVG sent to the model.
- **No active content.** An SVG is a document, and it's served from the origin that holds the write endpoints. So:
  - on save, the server refuses scripts, event-handler attributes, `<foreignObject>`, embedded documents, `javascript:`
    links, entity declarations and links to other files, each with a reason. Embedded `data:` images are allowed.
  - every reference is served with `Content-Security-Policy: default-src 'none'; …; sandbox` and `nosniff`, which covers
    anything the check misses when a file is opened on its own.
- **For M7:** `UIImage` can't draw SVG, so the iOS app will need a plan for SVG references: render with a web view, or
  convert them to PNG when they're bundled.

**Verified:** web 183 tests pass (10 new), the build succeeds, and iOS tests pass. In the browser, an SVG rendered to a PNG with the
right aspect ratio, and a clean SVG was stored and served with the CSP headers. An SVG with a script was refused.

### Follow-up · Image-generation models (2026-09-11)
Generating with `google/gemini-2.5-flash-image` failed with only "Provider returned error". The provider's real reason,
from `error.metadata`, was Google AI Studio's "JSON mode is not enabled for this model". Image-generation models
(output "image,text") still list structured outputs, so Settings offered them.
- **Settings now offers only models that answer in text.** This dropped 10 of 240, and Settings warns if the saved
  choice isn't in the list.
- **Provider refusals now show the provider's own reason**, and a 400 suggests trying another model.
- **Mid-answer failures.** A second failure, with `google/gemini-3.8-flash`, arrived as a 200 with `finish_reason: "error"`
  and no error object, so it read "no details given". It now names the provider and its `native_finish_reason`, and
  the server logs the outcome without the key or the request. The same request rerun live, with a palm-tree SVG, gave a
  valid 6-step lesson in 39 s for about $0.025, so the failure looks transient.

**Verified:** web 185 tests pass (2 new) and the build succeeds. Live, the same request now reports the reason above,
and Settings flags the saved model.

### Follow-up · Coconut Palm, drawn by hand (2026-09-11)
The creator didn't like the Gemini draft of the palm, so Claude drew `coconut-palm` by hand, without a model. It's the
first lesson in the new Trees path: 9 steps, 29 strokes, about 4 minutes.
- **Order:** front to back, so no line crosses one already drawn: front coconuts, then the coconuts behind them (only
  their visible parts), trunk, frond spines, leaf zigzags, bark, sand.
- **Checks:** the geometry was computed with a small script. No line runs into a coconut or across the trunk, and no two
  fronds' lines cross. There are no quality warnings.
- **Reference:** the Pixabay palm SVG, stored as `coconut-palm.svg`.
- **Not committed:** the Gemini draft `palm-tree` stays in the working copy.
- **Tests:** they now check that the golden lessons are present rather than an exact file list, and the writer tests
  copy `shared/Assets`, because the Studio adds lessons and references.

### Next · Lessons from SVG files, with fills (decided 2026-09-11)
When the reference is an SVG, the lesson should follow the source file closely, and the file's colours should be filled
in after all the outlines are drawn.

**Decisions by the creator:**
- **Schema v2** with optional stroke colours and filled shapes. v1 stays frozen. iOS keeps rejecting v2 by name until
  M7 teaches it v2.
- **Code traces, the model teaches.** The Studio turns the SVG into exact strokes and fills itself. A text model only
  groups them into steps and writes the instructions.

**To do:**
- [x] `shared/tutorial.v2.schema.json`, the web types and a validator for versions 1 and 2, and v2 conformance cases.
  The old unsupported-version case now uses version 3. A v1 document with `fills` is refused on the web; iOS drops
  the key, like any unknown property.
- [x] Web player: coloured strokes, and fill steps revealed after the outlines.
  - fills are painted beneath every stroke and revealed left to right, like colouring in;
  - the thumbnail and the editor show fills;
  - editing keeps fill-only steps, and split and merge carry fills along.
- [x] v2 lessons live in `shared/Tutorials` (the creator's choice). The iOS loader skips a bundled file of a newer
  version instead of reporting it (`TutorialLoader.isForNewerApp`). A file the learner imports still gets the version
  error by name.
- [x] SVG tracer (`web/src/trace/traceSvg.ts`, runs in the browser):
  - [x] parse shapes, transforms and styles. The file is mounted in a shadow root, so its CSS can't leak into the Studio,
    and it is checked with the same safety rules as the server (`web/src/svg/safety.ts`);
  - [x] map them to absolute M/L/C/Q/Z on the lesson canvas. `web/src/svg/pathNormalize.ts` converts the full path
    grammar, with arcs turned into cubics;
  - [x] turn thin dark filled bands (cartoon outlines) into centre-line strokes, and use stroked paths directly:
    - Zhang–Suen thinning, with line width taken from the band;
    - spurs pruned, lines carried straight on through junctions, and near-touching ends joined;
  - [x] turn coloured regions into fills:
    - k-means in CIELAB, keeping the file's own most common colours;
    - specks removed, and colour grown under the outlines so no paper shows;
    - one evenodd shape per colour;
  - [x] simplify to a drawable count: up to 64 strokes by default, longest first, with a note on how much of the
    outline the kept lines follow.

  **On the Pixabay palm:** 0.2 s. 8 fills from the file's 28 colours, and with the outlines it reproduces the picture
  closely. 64 strokes follow 83% of the outline length.

  **Known limits:**
  - Where many lines crowd together, the outline still breaks into short pieces. The upright top frond is the example:
    21 pieces, of which 7 are kept.
  - Touching coconuts come out as arcs rather than closed circles.
  - Not yet handled: `<use>`, and group-level opacity. Gradients count as a colour rather than as ink.
- [x] Generation (`POST /api/generate-from-trace`, prompt `svg-lesson-v1`):
  - the model gets the traced lines and colours as ids with positions and sizes, never path data, plus the picture;
  - it returns outline steps, then colour steps, as strict JSON;
  - code builds the lesson from the exact traced shapes. Every line and colour appears once: invented or repeated ids
    are ignored, anything left out joins the last step of its kind, and each correction is noted;
  - a drawing with no colour stays v1.
- [x] Studio: choosing an SVG in New lesson traces it straight away and previews the result. Generate then uses the
  trace; if tracing fails, it falls back to the picture. "Keep as draft" is unchanged.

  **Live check, 2026-09-11** (`google/gemini-3.8-flash`, the palm):
  - **Result:** a valid v2 lesson: 12 outline steps (coconuts, trunk, ground, then each frond), then 6 colour steps.
    The model placed every line and colour itself, so no corrections were needed.
  - **Cost and time:** 130 s and about $0.09. The model used 24,188 output tokens, mostly reasoning, which cut off the
    first attempt at the photo prompt's 16,000-token limit. This request now allows 32,000.
  - **Watch the time:** the server gives up at 180 s.

### M5 · AI generation quality (in progress)
Phase 5 in the plan (p. 33, §23–24): human pen gestures, stage-level regeneration, quality warnings, generation history.
Its exit condition is that most candidate lessons need only modest structural correction.

Already covered by earlier milestones:
- supported SVG commands in the prompt and in strict validation (M4);
- the §23 warnings: stroke count, tiny strokes, over five minutes, a crowded step, a jump from the previous lesson (M3).

**Part 1 · Regenerate one layer (2026-09-11)**
- [x] `POST /api/regenerate` (`web/server/regenerate.ts`). Writes nothing.
  - **Drawing:** a whole new generation for the same lesson. A photo uses the photo prompt; an SVG reference is traced again
    in the browser, at a chosen level of detail, and uses the SVG prompt.
  - **Order, Steps, Instructions:** the current lesson is sent with a picture of it and its reference. The model sees each
    line and colour as an id with its box, its two ends and its size, and answers with ids and words. Code rebuilds the
    lesson from the shapes it already has, so nothing outside that layer can change.
    - **Order** moves steps, and lines within a step, and can reverse which end a line is drawn from. It never moves a line
      to another step.
    - **Steps** regroups every line and colour, each placed exactly once.
    - **Instructions** rewrites titles and instructions only.
  - Prompts `regenerate-order-v1`, `regenerate-steps-v1` and `regenerate-instructions-v1`. Each answer carries a rationale
    for the creator.
- [x] Workspace: **Regenerate…** opens a panel with the four layers, cheapest first, and an optional "What should be
  different?" note.
  - The result is shown beside the current version, with changed steps marked, the model's rationale and anything the
    Studio corrected.
  - **Use the regenerated version** puts it in the editor as an ordinary edit: Undo takes it back, Save writes it.
- [x] 13 tests: path reversal, each layer's rebuild, request checks before any spend, and the drawing layer on an
  existing lesson.

**Live check, 2026-09-11** (`google/gemini-3.8-flash`, Coconut Palm, Instructions). The note was "Sound like a calm adult
teacher, not a children's book. Say where each line starts."
- **Result:** all 9 instructions were rewritten, and every line stayed as it was.
- **Cost and time:** 21 s and about $0.012. The model's rationale was shown beside the result.
- **For part 3:** the new words do say where lines start, but they place things less exactly than the hand-written ones.
  "Near the centre of the page" replaced "a little above the middle and slightly left of centre."

**Follow-up (2026-09-11):** New lesson and the Regenerate panel can change the model in place with **Change model**,
which opens the Settings list inline. The choice is saved as Settings saves it.

**Part 2 · History and compare.** Next.

**Part 3 · Prompt tuning (needs the creator).** 3–5 real reference photos, live runs and the creator's judgement, towards
`lesson-v2`.

**Not yet recorded:** the catalog's `generation` block still describes a lesson's first generation. Regenerations will be
recorded by part 2.

### M6 · Houses vertical slice (gated)
About five lessons: Simple House → House With Chimney → Small Cottage → House From an Angle → Two-Story House.
Needs licensed reference photos with source/licence metadata, plus creator approval against the §36 quality checklist.

### M7 · iOS product shell (gated on M6)
Onboarding, Home/Paths, Path Detail, Lesson Preview, and the player with the reference photo visible. Reads `shared/Catalog`.
Rewrite the current kid-oriented copy for an adult audience; accessibility (§31).
Reference images may be SVG, which `UIImage` can't draw; decide how the app shows them.

### M8 · Private sketchbook
Photograph the finished page and store it locally, linked to the lesson, path and date. No feed, no accounts.
Read Apple's current camera and photo-library permission guidance before building, and cite it in code.

### M9 · Content expansion
Add paths only once the Studio workflow is repeatable.

### M10 · Monetization / distribution
Only after the core experience and retention are understood. Keep entitlement logic separate from curriculum metadata.
**Compliance:** for any auto-renewable subscription purchase flow, the billed amount must be the most prominent
pricing element: largest type, highest contrast, leading position. That includes the CTA; a trial button naming only the
free period is not enough. Apple Guideline 3.1.2(c); see <https://developer.apple.com/app-store/subscriptions/>.
Read Apple's current guidance before building and cite it in code. Never copy a flow from competitor screenshots.

---

## Baseline (M0)

Recorded 2026-09-11 on the PoC as first committed (`c43cd04`), with no code changed.

| Check | Result |
|---|---|
| `npm test` (Vitest 3.2) | ✅ 58 passed: 25 SVG path parser, 33 conformance and golden-file |
| `npm run build` (tsc + Vite 6.4) | ✅ 175 modules, 301 kB JS (96 kB gzip) |
| `xcodebuild test` (Xcode 26.6, iPhone 17 simulator) | ✅ 35 passed, 0 failures, across the 3 suites in `StrokeTutorTests/` |
| simple-house / cat-face on web | ✅ both load and animate; "Step 1 of 5 · Draw the walls" / "Step 1 of 6 · Draw the head" |
| simple-house / cat-face on iOS | ✅ both selectable and animating in the simulator |

**Deliberate divergences**, unchanged and documented in [shared/README.md](shared/README.md): a zero
`duration` or `lineWidth`, an unknown property, an empty `title`, and an unparseable or 3-digit hex colour
are rejected by the web and tolerated (clamped, ignored or defaulted, with a warning) by iOS.

**Gaps between the master plan and the PoC**, logged here and assigned rather than fixed in M0:

- **Audience and tone.** The PoC was written for children, the plan targets adults (§2, §30). Examples:
  tutorial copy ("Great job, your house is done!"), web "Nicely done!", iOS "Finished!" and
  "Watch carefully…", the schema's "Shown to the child", and comments in `PlayerViewModel` and
  `shared/README.md`. Content goes to M6; iOS copy to M7. The schema's description text is left alone
  while v1 is frozen.
- **cat-face** is a cute subject the style guide avoids (§5). It stays as a PoC sample, since iOS bundles it and
  the conformance suite counts it, but it goes into no path.
- **Speed changes differ.** The web applies a new speed from the next stroke; iOS
  (`PlayerViewModel.cycleSpeed`) restarts the current step. The conformance corpus doesn't cover
  playback timing. Decide which one is intended before M7.
- **No curriculum, reference photo, completion capture or sketchbook yet** (§14–17, §31–32). These are M1, M3, M7 and M8.
- **Web importer layout below 1100px.** The sticky source panel slides over the player. Fixed in M1.
- **Hard-coded tutorial list.** `conformance.test.ts` asserts `shared/Tutorials` holds exactly cat-face and simple-house.
  That assertion has to change in M3, once the Studio can save new tutorials.

## Working on milestones

1. Take the lock: write `.milestones/lock` (gitignored), refresh its heartbeat often, and delete it when you stop.
2. Implement the milestone's checklist.
3. `cd web && npm test && npm run build`. Run the iOS tests too when `shared/` or iOS changed:
   ```bash
   xcodebuild test -project StrokeTutor.xcodeproj -scheme StrokeTutor -destination 'platform=iOS Simulator,name=iPhone 17'
   ```
4. Verify UI changes in the browser (`npm run dev`).
5. Update the table, the checklist and **Next up** here. Record any departure from the master plan, with the reason.
6. Commit on `main` and push. Never push red.

A scheduled task (`stroketutor-milestones`, every 30 min) resumes this loop if a session is interrupted. It skips a
run while the lock heartbeat is under 20 minutes old, and deletes itself once M4 is done.
