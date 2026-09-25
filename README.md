# Paper Coach

A guided physical-sketching system for adult beginners. The phone is a calm instructor. It animates one
meaningful drawing step, stops, and waits while the learner copies that step onto real paper with a real pen.
Nothing continues until the learner taps "I drew it".

The direction of the project is set by the master plan, [docs/PaperCoach_Master_Plan.pdf](docs/PaperCoach_Master_Plan.pdf).
Read it before proposing architecture, schema or content-pipeline changes. This README tracks delivery of that
plan as milestones.

```
shared/                 contract read by both players: schema v1, Tutorials/, conformance/
PaperCoach/            SwiftUI learner app (iOS)        PaperCoachTests/  iOS tests
web/                    React/Vite player → Paper Coach Studio (private authoring tool)
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
| M5 | AI generation quality | §23–24, §35 Phase 5 | **gated**: needs creator judgement | ✅ Done 2026-09-11 | see git log |
| M6 | Houses vertical slice | §35 Phase 6, App. A | **gated**: needs reference photos + approval | ⬜ Not started | |
| M7 | iOS product shell | §29–31 | started ahead of M6 at the creator's request (2026-09-13) | 🟡 Built to the v3 design; awaits M6 content and creator review | see git log |
| M8 | Private sketchbook | §32 | with M7 | 🟡 Built (photo capture, local pages, notes, delete); crop/straighten pending | see git log |
| M9 | Content expansion | §33 Phase 9 | gated | ⬜ Not started | |
| M10 | Monetization / distribution | §33 Phase 10 | gated | 🟡 Premium, paywall and guided first run built 2026-09-24; App Store Connect record, products and listing filled 2026-09-25 (`docs/app-store/listing.md`); needs availability, review contact, App Privacy, a build and a device test | see git log |

Status key: ⬜ not started · 🟡 in progress · ✅ done · ⏸ blocked (see notes).

### Next up

**M6 · Houses vertical slice. It needs the creator.** M5 is done; see below. M7 and M8 were built ahead of it
(2026-09-13) against the two published lessons, so M6's lessons will appear in the app as soon as they are approved.

M6 needs licensed reference photos, each with its source and licence recorded, and the creator's approval of each lesson
against the §36 checklist. The five lessons are:
- Simple House, which exists;
- House With Chimney;
- Small Cottage;
- House From an Angle;
- Two-Story House.

The blue two-story house from the M5 tuning round would suit the last one, if a licensed copy can be used. Don't start
M6 without the creator.

### iOS design track

The screens of the learner app were designed on 2026-09-12, ahead of M7, as an interactive HTML document with
developer notes: [docs/ios-design/index.html](docs/ios-design/index.html) (open it in a browser; see
[docs/ios-design/README.md](docs/ios-design/README.md)). It adds two decisions to the master plan, both bounded and
explained in its handbook: every step is narrated by the tutor's recorded voice (ElevenLabs, produced in the Studio
later, shipped as optional audio beside the lesson), and a tutor character, Lina, who teaches during onboarding and
is only a voice in the player. No Studio or Xcode code changed.

### Studio track

This is quality-of-life work on the Studio itself, which the creator asked for on 2026-09-11. It runs alongside the
milestones and doesn't unblock M6. The approved plan: a local workspace kept apart from published content, delete with
confirmation, then a less clumsy Paths view, lesson workspace and New lesson flow. A fifth, the command line,
was asked for on 2026-09-12, and a sixth the same day: the command line as an agent's authoring tool. An eighth, the
Voice page, on 2026-09-13. **All eight are done.**

| ID | Work | Status | Commit |
|---|---|---|---|
| S1 | Workspace vs published: a local SQLite workspace, Publish, Unpublish, delete with confirmation, Trash | ✅ Done 2026-09-11 | see git log |
| S2 | Paths view: search and status filters, one ⋯ menu per lesson, Unfiled / Publish / Trash in the sidebar | ✅ Done 2026-09-11 | see git log |
| S3 | Lesson workspace in three full-height panes, autosave, a drawer for Regenerate and History, shortcuts | ✅ Done 2026-09-11 | see git log |
| S4 | New lesson layout, "save as draft" from Import & test, a ⌘K palette | ✅ Done 2026-09-11 | see git log |
| S5 | Command line: every Studio action from the terminal, SVG trace/optimise/render in headless Chromium | ✅ Done 2026-09-12 | see git log |
| S6 | The agent as author: plans by hand, labelled previews and step sheets, `strokes reverse`, the `author-lesson` skill | ✅ Done 2026-09-12 | see git log |
| S7 | Reviewing a lesson: replay speeds up to instant, replays that hold their last frame and show the learner's view, lines only, folding the active step | ✅ Done 2026-09-12 | see git log |
| S8 | Voice: casting Lina from candidate voices on the creator's private TTS server, freezing the chosen one, narrating lessons and publishing `shared/Assets/Voice/` | ✅ Done 2026-09-13 | see git log |
| S9 | Levels and planned lessons: paths grouped under named levels, placeholder lessons that hold a place until their tutorial is generated, `curriculum apply` for a plan file, level headers on the iOS paths screen | ✅ Done 2026-09-19 | see git log |
| S10 | Lessons from generated pictures, for ages 8 to 16: `svg from-image` (a flat-colour PNG as an SVG, colours snapped to `docs/curriculum/palette.json`), a tracer that parts shapes that touch and relaxes its lines, `strokes split` / `strokes join`, the `long-stroke` and `long-instruction` quality warnings, prompts in `docs/curriculum/fruits-prompts.md` | 🟡 Built 2026-09-19; Apple is the first lesson made this way | see git log |
| S11 | Lina around a lesson: the player opens on the finished drawing and a quick run through every step ("I’m ready" starts step 1), keeps the finished drawing beside the step dots while drawing (never on the paper), and ends on her closing line; `lesson-intro` and `lesson-outro` are narrated and published like steps (`web/src/voice/bookends.ts`); voice controls in the lesson’s Preview. **iOS still to follow**: the manifest’s `steps` now carries those two ids | 🟡 Web built 2026-09-19 | see git log |
| S12 | One Publish on the lesson page: the lesson and the curriculum, whatever Lina has not recorded yet, her voice into `shared/Assets/Voice/`, then a commit of exactly those files under a message made from what changed ("Fruits: update Apple (lesson and voice)") and a push to `main` (`web/server/release.ts`, `POST /api/release/:lesson`). Words and voice are edited on the lesson page too. No voice cast, a speech server that is down, another branch or a refused push are reported and never hold the lesson back | ✅ Done 2026-09-20 | see git log |

#### S1 · Workspace vs published
- [x] A SQLite workspace in `.studio/` (gitignored), on Node's built-in `node:sqlite`, backed up daily (newest seven kept).
- [x] Every authoring write goes to the workspace. Only Publish and Unpublish write `shared/`.
- [x] `shared/Catalog` is the working curriculum narrowed to published lessons. What Publish would change is computed each
      time, never queued.
- [x] A Publish view, plus **Publish…** in the lesson workspace and in each lesson's ⋯ menu.
- [x] Unpublish, Duplicate, and Delete to the Trash. Deleting a published lesson asks for its id to be typed.
- [x] Deleting a path asks whether its lessons stay (unfiled) or go to the Trash too.
- [x] A Trash with Restore, Delete forever and Empty trash.
- [x] **Adopt shared/** when `shared/Catalog` changes outside the Studio.
- [x] Migration, as the creator chose: palm-tree, tree and coconut-palm moved into the workspace. palm-tree-4,
      simple-house and cat-face stay published.

**Done.**
- **Tests:** web 279 pass, including new tests for the store and for the catalog projection. The count went down, not
  up, because some tests loop over every file in `shared/Tutorials`, which lost three lessons. The build passes. iOS
  passes 36/36 against the migrated `shared/`.
- **In the browser,** on the creator's own dev server:
  1. the Publish view showed the published curriculum before and after;
  2. Palm Tree was unpublished through its dialog, with its id typed, and stayed editable as a Draft with its photo;
  3. a duplicate was made, deleted to the Trash, restored, then deleted for good;
  4. the delete dialog opened with Cancel focused. There were no console errors.

**Departures and decisions:**
- **Saving no longer writes `shared/`.** "Published" still means validated content in `shared/` (master plan §27 and
  §39), but now only Publish writes there. Drafts and experiments stay out of git, and history moved from
  `shared/History/` into the workspace.
- **An overlay, not a copy.** A published lesson nobody has touched is read from `shared/`. Editing it adds a working
  copy, shown as **Published · edited**, until it is published again.
- **A path is published once it holds a published lesson.** Empty paths stay in the workspace.
- **Publishing takes the curriculum with it.** Any publish rewrites `shared/Catalog` in the working order. The Publish
  view shows the before and after.
- **Publishing approves.** It goes through the same warnings and checklist as Approve….
- **The workspace isn't in git.** Its only copies are the daily backups in `.studio/backups/`, plus whatever backs up
  the machine.
- **Node 22.13 or later** is needed for `node:sqlite` (`engines` in `web/package.json`). Its experimental-feature warning
  is silenced for that one import.

#### S2 · Paths view
- [x] Search every lesson by title, id or objective. `/` focuses the search and Esc clears it; each result shows its path.
- [x] Status chips (All, Drafts, Needs review, Approved, Published, Edited), with counts for what's shown.
- [x] List or grid. Rows are compact (about 87 px, down from about 140), with a drag handle.
- [x] One ⋯ menu per lesson: open, duplicate, publish or unpublish, move earlier or later, move to another path, take
      out of the path, delete. ⌥↑ and ⌥↓ move the focused lesson.
- [x] A path's title is renamed in place. Its ⋯ menu holds the description, its order and deletion. Paths reorder by
      drag in the sidebar.
- [x] The sidebar shows how many of each path's lessons are in the app, and links to Not in a path (now its own view),
      Publish and Trash.
- [x] The filter, the layout and the last path are remembered in the browser.

**Done.**
- **Tests:** web 279 pass and the build passes. Nothing in `shared/` or iOS changed.
- **In the browser,** at 1440 × 900:
  - the path counts read Trees 1/4 and Houses 1/1;
  - the Drafts filter left two rows, and they can't be dragged while filtered;
  - search found lessons across paths, Esc cleared it, and `/` focused it;
  - grid and list both work;
  - four lessons fit without the page scrolling.

**Decisions:**
- **Drag reorders only a whole path shown as a list,** so a filtered or searched list can't be reordered by accident.
  The ⋯ menu's move earlier and later work everywhere.
- **The sidebar count reads published / total**, so a path nobody would see in the app stands out.

#### S3 · Lesson workspace
- [x] Three full-height panes that scroll on their own, so the page never does:
  - the reference and the lesson's details, on the left, collapsible with `[`;
  - the drawing, sized to fit;
  - the steps, on the right.
- [x] The active step opens in place, with its title, instruction and strokes. The other steps show one line each.
- [x] A bar floats over the drawing for the selected strokes: group, move to a step, seconds, width, replay, delete.
- [x] A transport bar: previous and next step, replay step or lesson, colour by step, and the reference underneath
      the drawing.
- [x] Regenerate, History, the generation record and Debug open in a drawer that slides over the steps.
      Approve and Publish confirm in a dialog.
- [x] Autosave into the workspace about a second after an edit, one save at a time, and on leaving the lesson.
      ⌘S keeps a version in History.
- [x] Toasts for passing confirmations. The objective, complexity and notes are edited in the rail.
- [x] Keyboard: ↑ ↓ / J K to change step, Space to replay the step, ⇧Space the lesson, P to preview, G to group,
      M to move, ⌫ to delete, Esc, `[`, ⌘Z, ⌘S, and `?` for the list.

#### S9 · Levels and planned lessons
Asked for on 2026-09-19, with the audience set to ages 8 to 16. The curriculum is planned in
[docs/curriculum/plan.json](docs/curriculum/plan.json): three levels (Starter, Core, Advanced), 13 paths, 130
lessons, no living things.
- [x] **Levels.** `paths.json` may carry `levels`, and a path a `level`. A level groups and recommends; it never
      locks a path. The Studio's Paths view, `levels …` and `paths level` edit them; `hp-paths` on iOS shows
      them as section headers, and looks as before when the catalog has none.
- [x] **Planned lessons.** A lesson with status `planned` has a title and an objective and no tutorial. It is
      never published. Generating or importing a lesson under its id fills it: same place in the path, now a
      draft. `lessons plan`, and `#/new?lesson=<id>` in the Studio.
- [x] **`curriculum apply <plan>`** creates or updates levels, paths and planned lessons from a plan file, and
      changes nothing when run again.
- [x] Applied to the creator's workspace. Palm Tree 4 and Classic Red Car stay published, now in Plants and
      Wheels; the ten Mountains drafts, House 1 and the old Trees, Houses, Mountains and Cars paths are in the
      Studio's Trash.
- [ ] Not done: an onboarding question that picks the learner's starting level; the Studio's new level headers
      and planned rows have been typechecked and tested but not yet looked at in a browser.

#### S8 · Voice: casting Lina
Asked for on 2026-09-13: a Studio page to configure the iOS tutor's voice, preview it, keep it consistent, and
choose between several candidates. Speech is made on the creator's own MLX-Audio server on their tailnet
(`STUDIO_TTS_URL`, `STUDIO_TTS_MCP_URL`), never by an outside provider. See
[web/README.md](web/README.md#voice) for the endpoints and the `voice` commands.
- [x] **The cast.** Candidate voices (five suggested: two designed from a description, two Qwen speakers, the
      Chatterbox house voice) each read the same audition script, and "Try a line" says one sentence in every voice.
      One is cast as Lina.
- [x] **Freezing.** A designed voice drifts a little between takes, so one take can be uploaded to the speech
      server as a reference and every later line is cloned from it. Takes are cached by a hash of the engine, the
      description, the speaker, the reference and the words.
- [x] **Narrating a lesson.** One recording per step, of the instruction or of a spoken line written for it; a
      take goes stale when the words or the voice change. Publish voice converts the takes to AAC (`afconvert`,
      48 kbps mono) and writes `shared/Assets/Voice/<lessonId>/<stepId>.m4a` with a `manifest.json`, the layout
      `NarrationPlayer.swift` already looks up.
- [x] **Spoken lines.** A step's written instruction is too long to say aloud, so each step can carry a spoken
      line: typed in the narration table, written by a model (`spoken-lines-v1`, with a note and the hand-written
      lines kept), or applied from a plan (`voice lines apply --plan`). `voice narrate --all` and
      `voice publish --all` do the catalog in one go. Voice publishes only for a lesson published without edits.
- [x] **The freeze in the repo.** `voice freeze` writes the frozen voice's reference WAV and record to
      `shared/Assets/VoiceReference/` (unfreeze removes them), and a fresh clone freezes itself to what is there:
      the workspace on its first voice command, the speech server on the first line spoken.
      It is a sibling of `Assets/Voice/`, not inside it, because the app bundles all of `Assets/Voice/`.
- [x] **Lina's own lines.** The nine things she says outside any lesson: `hello` (onboarding's "Meet the voice" and
      the Settings sample) and `lesson-1`…`lesson-4`, `path-1`…`path-4` (the completion screens). The ids are fixed —
      iOS asks for each by name — and the words are the creator's, edited on the Voice page or with `voice app set`.
      They record and go stale exactly as a step does, publish as `shared/Assets/Voice/app/<id>.m4a` with a
      `manifest.json`, and `voice publish --all` takes them along with the lessons.
- [x] **In the app.** The Xcode project bundles `shared/Assets/Voice/` as the folder reference `Voice/`, so a
      lesson narrated tomorrow needs no change to the project file. `VoiceLibrary` reads a lesson's manifest the
      first time that lesson asks for a line, and a step is spoken only when the manifest names it *and* the file
      is there — a lesson nobody has narrated is silent and hides its chip, as every lesson did before. The player
      speaks a step's line when its animation starts and stops on replay, back, skip, close and leave; the speed
      setting never touches the voice. `Voice/app/` carries Lina's own lines — `hello` on the onboarding beat and
      in Settings, `lesson-1`…`path-4` on the completion screen — and every one of those screens keeps its written
      fallback for a line that was not published. Xcode refuses to build when `shared/Assets/Voice/` is missing
      altogether, so the folder is kept in a checkout by its README.
- [x] Published. `shared/Assets/Voice/` now carries narration for most of the catalog's lessons and Lina's own
      lines (`Voice/app/`); the app speaks from the checked-in build.

#### S7 · Reviewing a lesson
Asked for on 2026-09-12, after reviewing the classic red car.
- [x] Replay speed: ½×, 1×, 2×, 4× or **Instant**, which lands on the final frame at once. `−` and `+` change it.
- [x] A replay shows the paper as the learner has it at that moment: earlier steps faded, later steps not yet drawn,
      and a whole step's colour fills go in after its strokes. It **holds its last frame** with a chip naming what was
      drawn, ↻ Again and ✕ Done; Esc, a click on the paper, picking a stroke or moving to another step leaves it.
- [x] **Lines only** (`L`) hides the colour fills so the stroke structure can be read. `C` toggles colour by step,
      `R` the reference underneath.
- [x] The active step folds and unfolds (click its title, or Enter), so the whole list is in view while it stays
      selected. Every step card has a ▶ on its head, so any step replays with one click.

**Done.**
- **Tests:** web 280 pass. They include new ones: autosaves keep only the pre-edit version, and ⌘S after an autosave
  still records one. The build passes.
- **In the browser,** at 1440 × 900 on Palm Tree 4:
  - **no page scroll:** the drawing is 658 px square, and the active step's instruction is on screen with it;
  - **autosave,** on a throwaway copy: typing showed "Saving…", then "✓ Saved". The workspace held the new text,
    and History held only the baseline;
  - **⌘S** added one version;
  - **keys:** J and K moved between steps, and `?` opened the shortcut list;
  - **selection:** picking a stroke showed the selection bar, and Esc cleared it;
  - **drawer:** it opened without moving the steps pane, and Esc closed it.

**Found and fixed along the way:**
- **Stylesheet order.** `paths.css` (S2) was imported from its component, so on a fresh load it came *before*
  `studio.css` and lost. The override sheets are now imported from `Studio.tsx`, after `studio.css`.
- **Panes scrolled sideways.** The closed drawer, waiting off to the right, let focus and `scrollIntoView` scroll the
  panes sideways. They now use `overflow: clip`.

**Decisions:**
- **Autosave replaces Save.** A lesson can't be lost by leaving it. History stays meaningful because only ⌘S,
  regenerations and publishes record versions.
- **The Inspector is gone.** Its step fields moved into the active step, and its selection tools into the floating bar.

#### S4 · New lesson, Import & test, ⌘K
- [x] New lesson in two columns: the photo on the left, in a zone you drop it on or click, shown at once; the
      curriculum place and what to teach on the right.
- [x] A footer that stays in view, with Generate and what's still missing, or how long generation has been running.
- [x] Recently used sources and licences are offered again (kept in the browser). A new candidate scrolls into view.
- [x] Import & test: **Save as workspace draft…** takes a title, an id, a path and an objective, then opens the
      draft in the workspace. It never writes `shared/`.
- [x] ⌘K, or **Jump to…** in the header, opens a palette of every lesson, path and page, filtered as you type.

**Done.**
- **Tests:** web 280 pass and the build passes.
- **In the browser,** at 1440 × 900:
  - **New lesson:** the photo sat on the left and the fields on the right, with the footer at the bottom of the window
    listing what was still needed.
  - **⌘K:** it opened the palette with its field focused. "palm" found the three palm lessons, and choosing one
    opened it.
  - **Import & test:** "Save as workspace draft…" opened with the title and a free id filled in. It stayed disabled
    until there was an objective, then opened the draft in Trees. `shared/` was untouched, and the test draft was
    then deleted for good.

**Decisions:**
- **The palette covers places, not actions.** Lessons, paths and pages cover the everyday jumps. Actions stay next
  to what they act on.

---

#### S5 · The command line
`npm run studio -- <command>` does what the Studio does, on the same workspace, so paths, lessons, steps,
strokes, references, history, publishing and the trash can be managed without the UI, and an image or an SVG
can become a lesson from a script. See [web/README.md](web/README.md#the-command-line).
- [x] One bootstrap (`web/cli/studio.mjs`) starts Vite as a module loader only, so the Studio's own store,
      validators and editing operations run unchanged; nothing is reimplemented.
- [x] `paths`, `lessons`, `steps`, `strokes`, `history`, `publish`, `trash`, `status`, `settings`, `models`,
      `adopt-shared`, with `--json` for scripts and typed confirmation (or `--yes`) for destructive changes.
- [x] `svg trace`, `svg optimize` (normalise; `--simplify` for fewer points), `svg render`: the Studio's
      browser code in headless Chromium through Playwright, so a trace matches New lesson's exactly.
- [x] `svg to-steps`, `image to-steps`, `lessons generate` and `lessons regenerate`, ending as "Keep as
      draft" and the Regenerate drawer do; `--no-model` builds a lesson from a trace without a model.
- [x] The workspace waits its turn on a busy SQLite file, so the command line and `npm run dev` share it.

**Done.**
- **Tests:** web 342 pass (53 of them for the command line, in-process on the server tests' fixture with a
  fake model and a fake browser) and 4 browser smoke tests pass in real Chromium with
  `STUDIO_BROWSER_TESTS=1`. The build passes.
- **From the terminal,** on a scratch workspace over the real `shared/`: a path was created, moved and renamed;
  a lesson was duplicated, split, retimed, approved, exported and imported at a chosen position; the palm
  SVG was traced (64 lines, 8 colours, 84% of its outlines), optimised with `--simplify` (131,977 → 98,037
  bytes, 99 specks left out), rendered to a PNG that matched, and built into a seven-step lesson with
  `--no-model`; a draft was deleted, restored and deleted for good. `shared/` was untouched.

**Decisions:**
- **Chromium, not a Node port of the tracer.** A second implementation of the SVG geometry pass would drift
  from the browser on CSS and transform edge cases; running the same code headless cannot.
- **`svg optimize` is normalising first.** Without `--simplify` the drawing is unchanged: shapes become
  plain paths the players read, on the lesson's canvas. Simplification is opt-in because it changes lines.

---

#### S6 · The agent as author: plans, previews, the skill
A Claude Code session, not an OpenRouter model, plans paths, asks for source SVGs and turns each into a lesson
as a human would draw it: it groups and orders the traced lines, colours last, and looks at the result.
OpenRouter stays optional (`--model`). See [web/README.md](web/README.md#the-command-line) and
[.claude/skills/author-lesson/SKILL.md](.claude/skills/author-lesson/SKILL.md).
- [x] Plans in the models' answer vocabulary: `svg to-steps --plan` builds from a trace and
      `outlineSteps`/`colourSteps`; `lessons apply --layer steps|order|instructions --plan` reshapes an
      existing lesson over its labels s1..sN / f1..fM, with `reversedStrokeIds`. Each plan is checked in
      full and refused by name before anything is written.
- [x] Seeing the drawing: `svg trace --summary` and `lessons summary` print the ids; `svg preview` draws a
      trace with every id at its line's start point; `lessons render --sheet` is a contact sheet, one panel
      per step as the player shows it. Built as SVG text in `src/studio/preview.ts`, rendered through the
      existing browser bridge.
- [x] `strokes reverse`: a stroke drawn from its other end; `reversePath` now gives a closed shape back byte
      for byte when reversed twice.
- [x] The drawing method as a project skill, `author-lesson`, distilled from the prompts and the master plan
      (§7, §18, §23), so every session authors the same way.
- [x] The command line as a project skill, `studio-cli`: the operating manual for any agent (running it, global
      options, exit codes, selectors, every command, plan files, recipes, gotchas) with every `--help` verbatim
      in `reference.md`.

**Done.**
- **Tests:** web 366 pass (70 for the command line and 7 for the preview module, in-process with a fake
  browser and a fake model) and 4 browser smoke tests pass in real Chromium. The build passes.
- **End to end,** on a scratch workspace over the real `shared/`: the palm SVG was traced with `--summary`
  (64 lines, 8 colours), previewed with its ids, planned by hand into 11 outline steps (trunk, base, each
  frond, coconuts, sand) and 6 colour steps, built with `--plan` and no model, rendered as an 18-panel
  sheet, reordered with an order plan that reversed the trunk edges, and a stroke was reversed twice to a
  byte-identical export; the draft was deleted and the trash emptied. `shared/` was untouched.

- **Fresh-session trial (2026-09-12):** a cold Opus session given only the two skills and the palm SVG authored an
  11-step lesson from a 32-line trace, valid with no quality warnings, with two corrections after the first build:
  reversing 15 lines (the plan could not say direction) and rewording. Its findings became `reversedStrokeIds`
  in build plans, "from → to" in `svg trace --summary`, a sheet-size fix for narrow sheets, and five sentences in
  the skill (direction, label renumbering, merging like groups, colour grouping, minutes vs seconds).

**Decisions:**
- **One vocabulary for plans.** A plan by hand is the model's answer shape, so the server's assembly and
  corrections (unplaced ids added to the last step, and reported) serve both, and a session can compare its
  plan with a model's through History.
- **Pictures are strings.** Previews are built in pure code and unit-tested; Chromium only turns the final
  SVG into pixels. Labels sit at a line's start because that is what a plan needs to know: where the
  animation begins, and so whether to reverse it.

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
  - Writes must be same-origin and carry an `X-PaperCoach-Studio` header.
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
  - **Crowded lines (improved 2026-09-11):** thinning splits a crossing into two junctions joined by a stub, which cut
    every line through it. Such junctions are now merged and the stubs dropped. On the palm:
    - 124 pieces instead of 150, with 16 shorter than 16 units instead of 41;
    - the 64 kept lines follow 84.5% of the outline instead of 83%, and 71% of the crowded top area instead of 53%.

    What is still left out is mostly genuinely short marks: bark, ground specks and the insides of the coconuts.
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
  - **Time (changed 2026-09-11):** the server used to give up at 180 s. The SVG prompt and layer regeneration now get
    4 minutes, and photo generation keeps 3.
    - **Why not cap the reasoning instead:** OpenRouter's reasoning controls differ by model family, and with
      `require_parameters` they would exclude providers. See `TRACE_TIMEOUT_MS` in `web/server/generateFromTrace.ts`.

### M5 · AI generation quality (done 2026-09-11)
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

**Part 2 · History and compare (2026-09-11)**
The plan's "compare generations: retain good prior versions instead of overwriting blindly" (§24). Every version of a lesson is
kept, beside it and never in its place, and any two can be compared.

- [x] **Storage: `shared/History/<lesson>/<time>-<kind>-<random>.json`** (`web/src/history/types.ts`).
  - Studio-only: the iOS target bundles only `shared/Tutorials`, so the app never sees history.
  - Written as ordinary files, like every Studio save; the creator decides whether to commit them.
  - Each entry holds a whole tutorial and how it came about: `kind`, which is `generated`, `regenerated` or `saved`.
    Depending on the kind it also records the layer, model, prompt version, goal, constraints, note, rationale, the
    Studio's corrections, the analysis, the cost, and whether it was the kept candidate.
- [x] **Server: in `repoWriter.ts`,** which stays the only code that touches disk.
  - `GET /api/history/:lesson` lists entries, newest first. A file that can't be read is skipped.
  - `POST /api/history/:lesson` only adds, and only generated or regenerated versions.
  - Refused: a tutorial that isn't valid, one whose id doesn't match the lesson, or a lesson that doesn't exist.
  - The server assigns the id and time. Ids start with the time, so the order on disk is the order of events.
  - **Saves record themselves:** the writer records every save that changes a lesson. A save that changes nothing records
    nothing.
  - **Baseline:** before a lesson's first regeneration or changing save is recorded, its version on disk is recorded as
    "Saved, before any recorded change", so there is always something to go back to.
- [x] **Recording:**
  - New lesson keeps every valid candidate in the session. **Generate another** adds one and never replaces, and the
    creator can switch between them. **Keep as draft** records all of them, marking the kept one.
  - Each valid regeneration is recorded as soon as it arrives, whether or not it is used.
- [x] **Workspace History tab:**
  - every entry, newest first, with its kind, time, model, prompt, cost and size;
  - the chosen entry side by side with the editor's version or with another entry, with changed steps marked;
  - **Use this version** puts it in the editor as an undoable edit, like a regeneration.
- [x] 6 tests (`web/server/history.test.ts`): recording a regeneration after the baseline, saves recording themselves,
  no-op saves and new lessons recording nothing, candidate order and unreadable files, and every refusal. Docs updated
  in `web/README.md` and `shared/README.md`.

**Checked, 2026-09-11:** all 254 web tests pass. In the browser, on Coconut Palm:
- **Regeneration recorded:** an Instructions regeneration (`google/gemini-3.8-flash`, 15 s, $0.0099) was recorded as it
  arrived, after the baseline. The lesson file was untouched, and the History tab listed both.
- **Compare and Use:** comparing with the baseline marked the changed steps. **Use this version** put the regenerated words
  in the editor, and ⌘Z took them back.
- **Cleanup:** the test's history files were deleted afterwards.

**Not driven in the browser:**
- keeping one of several New lesson candidates, because the browser tool can't choose a photo in the file picker;
- a Save recording history, which the server tests cover.

**Part 3 · Prompt tuning (2026-09-11).** One round on four photos the creator supplied: a two-story house, a barn at an
angle, a corner shop at an angle and a front-facing shopfront. Each was generated with `lesson-v1` and
`google/gemini-3.8-flash` through `/api/generate`, which writes nothing, for about $0.14 in all. The creator reviewed
each lesson beside its photo, step by step.

- **Result:** all four read as their photos, in 6–7 steps and 16–27 strokes. The words are calm, adult and specific.
- **Creator's judgement:**
  - the level of detail is right;
  - either order is fine, roof first or walls first;
  - ignore the hand-drawn look for now.

  So `lesson-v1` stays, and there is no `lesson-v2`.
- **Known, deferred:**
  - 86 of 88 strokes were ruler-straight, despite the prompt asking for gentle curves. The drawings look like vector
    icons, which is the §23 "overly geometric" risk. A code wobble or a stronger prompt can be tried later.
  - The barn's raised middle roof came out as a jumbled wedge. Complicated multi-level roofs in perspective can go wrong.
  - The busiest steps hold 6 strokes.
- **Photos:** the tuning photos were only sent to the model; none is saved in `shared/`. The shopfront photo carries an
  Alamy watermark, so it must not become a lesson reference. Any photo used for a real lesson needs its source and
  licence.
- **One provider failure:** one generation failed inside Google's provider with no tokens and no cost. It succeeded when
  retried.

**Exit condition:** "most candidate lessons need only modest structural correction". It is met, by the creator's
judgement on this round.

**Where regenerations are recorded:** in the lesson's history (part 2). The catalog's `generation` block still describes
the lesson's first generation only.

### M6 · Houses vertical slice (gated)
About five lessons: Simple House → House With Chimney → Small Cottage → House From an Angle → Two-Story House.
Needs licensed reference photos with source/licence metadata, plus creator approval against the §36 quality checklist.

### M7 · iOS product shell (started 2026-09-13, ahead of M6 at the creator's request)
Onboarding, Home/Paths, Path Detail, Lesson Preview, and the player with the reference photo visible. Reads `shared/Catalog`.
Rewrite the current kid-oriented copy for an adult audience; accessibility (§31).
Reference images may be SVG, which `UIImage` can't draw; decide how the app shows them.

**Done 2026-09-13**, implementing `docs/ios-design/v3.html` (plan: `docs/ios-design/v3-ios-implementation.md`).
The app reads `shared/Catalog` and bundles `shared/Assets/References`; SVG references render in a non-interactive
`WKWebView`. Tutorial schema v2 (stroke colours, fills) plays on iOS. The Xcode project uses folder-synchronized
groups. Departures from the plan, with reasons: the tutor "Lina" and per-step narration plumbing are in (design
decision of 2026-09-12; no audio ships yet, so the narration chip stays hidden); paths with no approved lesson are
hidden rather than shown empty; the player fits the paper to the drawing's bounds. Still open: crop/straighten in
capture, a real contact address and privacy URL on About, landscape verified only structurally.

**Soft lock (2026-09-23, creator's decision).** Lessons inside a path still show as locked until the ones before them
are drawn, but the locked sheet now offers "Try it anyway" under "Go to <previous>". Completion is self-reported, so a
lock with no way round it would only push a learner to tap "I drew it" through lessons they wanted to skip. A lesson
drawn early counts as drawn; the lessons in front of it stay next, and later ones stay locked behind them.

### M8 · Private sketchbook
Photograph the finished page and store it locally, linked to the lesson, path and date. No feed, no accounts.
Read Apple's current camera and photo-library permission guidance before building, and cite it in code.

**Built with M7 (2026-09-13):** capture primer, camera or Photos, review, saved; pages as JPEG + JSON index in
Application Support; sketchbook tab by month; entry with note, share and delete; opt-in "Also save to Photos".
Usage strings cite App Store Review Guideline 5.1.1(ii). Crop and straighten is a disabled stub.

### Follow-up · First rest goes to All paths (2026-09-23)
The first time an early learner (three or fewer lessons done) leaves a lesson-complete screen by "Not now", or by
"Done" after adding the drawing to the sketchbook, they land on All paths (`hp-paths`) instead of their own path's
page, with a one-time header: the written title "N paths to explore" and a row with Lina's face and a new line she
says once. "Next lesson" is unchanged.
- [x] iOS: the redirect for an early learner's first rest (`AppModel.leaveCompletion(for:)`, once per learner via
      `ProfilePreferences.hasSeenPathsWelcome`), and the one-time header on All paths with `LinaLineRow`. Tests in
      `CurrentPathTests`, `ProfileTests` and `NarrationTests`; debug screen `-STScreen paths-welcome`.
- [x] Lina's app line `paths-welcome`, "There's a lot more to draw here. Pick whatever you like next.", recorded
      and published to `shared/Assets/Voice/app/`.
- [x] Web: `APP_LINE_IDS` extended to ten ids (`web/src/voice/types.ts`, `web/src/voice/suggestions.ts`); counts and
      sentences hard-coded to nine app lines / eight completions fixed across the Voice page, server and CLI, and
      their tests. Web tests pass (except two pre-existing, unrelated failures where `docs/curriculum/plan.json`
      has grown past the curriculum-plan fixtures' expected counts).
- [x] Design notes: `docs/ios-design/src/v3/screens/20-home-paths.html` (`hp-paths`) and
      `.../40-completion-sketchbook.html` (`sk-complete`), rebuilt into `v3.html`.

### M9 · Content expansion
Add paths only once the Studio workflow is repeatable.

### M10 · Monetization / distribution
Only after the core experience and retention are understood. Keep entitlement logic separate from curriculum metadata.
**Compliance:** for any auto-renewable subscription purchase flow, the billed amount must be the most prominent
pricing element: largest type, highest contrast, leading position. That includes the CTA; a trial button naming only the
free period is not enough. Apple Guideline 3.1.2(c); see <https://developer.apple.com/app-store/subscriptions/>.
Read Apple's current guidance before building and cite it in code. Never copy a flow from competitor screenshots.

**Age group, ahead of analytics (2026-09-23).** PostHog and Superwall are planned. The app will not be submitted to
the Kids category, so it is a mixed-audience app: the audience is 8 to 16, and adults use it too. Onboarding now asks
`ob-age`, after `ob-who`: six bands (Under 6, 6–9, 10–12, 13–15, 16–17, 18+) in a 2×3 grid, nothing preselected, and
"Prefer not to say". The answer and its date are kept on each profile, with stable keys (`under6` … `18plus`,
`preferNotToSay`), and can be changed on the learner's page in Settings. When a PIN is set, moving someone to a less
protected tier needs it.
- **`Analytics`** (`PaperCoach/App/Analytics.swift`) is the only way out. Today its sink is `NoAnalyticsSink`, so
  nothing is sent. A PostHog or Superwall sink must honour `AnalyticsPolicy`:
  - under 13, "prefer not to say" or never asked: anonymous events, with an id that lasts one launch;
  - 13 to 17: the profile's own id, no session replay;
  - 18+: everything.
- **The name typed on `ob-who` is never sent.**
- **Before either SDK ships:** put the paywall behind the PIN on child-tier profiles and word it for the parent;
  update the privacy label; check both vendors' terms for apps children use; check the state app-store age laws and
  Apple's Declared Age Range API.

**Premium and the guided first run (2026-09-24).** Designed as a clickable wireframe with the creator first, then built.
- **What is free:** every path is open, and lessons 1–3 of each are free (`PremiumAccess.freeLessonsPerPath`). From
  lesson 4 a lesson wears a gold crown (bottom right on a tile, top right on a node, "Lesson 4 · Premium" on the path)
  beside the order lock, which still teaches the order. Tapping a crown opens the Premium drawer before anything else.
  A subscriber sees no crowns.
- **StoreKit 2** (`PaperCoach/Stores/PremiumStore.swift`): one group, `com.softroni.papercoach.premium.yearly` (with
  a one-week free introductory offer, $19.99/year) and `…premium.weekly` ($1.99/week, no trial), both Family Sharing. `PaperCoach.storekit` at the
  repository root mirrors them at those prices; choose it under Scheme › Run › Options › StoreKit
  Configuration. Premium belongs to the Apple account, so every learner on the device shares it.
- **Testing without buying** (debug builds only): Settings › Premium › "Premium for testing" switches between
  App Store (what the account really holds), Locked and Unlocked. It is kept across launches
  (`PremiumStore.debugOverride`) and never compiled into a release build.
- **The guided first run** (`AppModel+FirstRun.swift`, stage saved in `Settings.firstRunStage`): `ob-ready` has no
  "Look around first"; the first lesson has no close button or ⋯ menu; completion and the saved photo have no "Next
  lesson" or "Done"; both lead to the sketchbook tour (the lesson's path only, no Paths/Dates switch, no tab bar), then
  "More coming" (the path's other lessons sliding past) → 7 days free → the reminder promise (asks for notification
  permission) → the paywall. A relaunch returns to the same stop.
- **The paywall** leads with the billed amount in the largest type and names it on the button, per Apple's
  subscription page (quoted in `PaywallView.swift`); "View more plans" opens Yearly/Weekly; Restore, Terms of Use and
  Privacy are on it. The one way out is "Continue with free lessons". A trial reminder is scheduled two days before
  the free week ends (`TrialReminder`).
- **Children** (the child privacy tier: under 13, or "prefer not to say") never see a price: the drawer says "Ask a
  grown-up" and "Save it for later" (a wish list per learner), then "This part is for a grown-up" → the parental check
  (the app's PIN when one is set, else a sum written in words) → a paywall written for the parent, showing the child's
  drawing and wish list. After a child closes the drawer once, more crowns only nudge for the rest of the session.
- **Teens** get the adult flow; an Ask to Buy purchase shows "Waiting for a grown-up to say yes" and unlocks when
  approved (`Transaction.updates`).
- After lesson 3 of a path, completion and the saved photo show "Next: … · Premium" as a gold card, and a free lesson
  from another path under it. Settings has a Premium row (the paywall, or Manage Subscriptions) and Restore.
- **App Store Connect (2026-09-25):** the record exists ("Paper Coach: Learn to Draw", Apple ID 6816231257,
  `com.softroni.papercoach`), both products and the free week are set up with Family Sharing and the prices above,
  and the listing copy, screenshots and subscription review screenshots are on it. What the API could not do, and
  the exact review notes to paste, are in `docs/app-store/listing.md`. Still to do: availability, review contact,
  App Privacy, a build, and the whole flow on a device against the sandbox.
- **Harness:** `-STScreen offer-paywall` opens the paywall as an adult (the subscription review screenshot).

---

## Baseline (M0)

Recorded 2026-09-11 on the PoC as first committed (`c43cd04`), with no code changed.

| Check | Result |
|---|---|
| `npm test` (Vitest 3.2) | ✅ 58 passed: 25 SVG path parser, 33 conformance and golden-file |
| `npm run build` (tsc + Vite 6.4) | ✅ 175 modules, 301 kB JS (96 kB gzip) |
| `xcodebuild test` (Xcode 26.6, iPhone 17 simulator) | ✅ 35 passed, 0 failures, across the 3 suites in `PaperCoachTests/` |
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
   xcodebuild test -project PaperCoach.xcodeproj -scheme PaperCoach -destination 'platform=iOS Simulator,name=iPhone 17'
   ```
4. Verify UI changes in the browser (`npm run dev`).
5. Update the table, the checklist and **Next up** here. Record any departure from the master plan, with the reason.
6. Commit on `main` and push. Never push red.

A scheduled task (`stroketutor-milestones`, every 30 min) resumes this loop if a session is interrupted. It skips a
run while the lock heartbeat is under 20 minutes old, and deletes itself once M4 is done.
