# StrokeTutor Studio (web)

The private authoring tool for StrokeTutor lessons, built around the browser player that
tutorials are tested on before they ship to the iOS app. See the
[master plan](../docs/StrokeTutor_Master_Plan.pdf) (Part III) and the milestone tracker in the
[root README](../README.md).

Both apps read the same JSON — literally the same files, in [`../shared`](../shared).
The schema, the golden tutorials, the curriculum catalog and the conformance corpus live there
and are read by this app and by the iOS target; neither side keeps a copy. `src/player/svgPath.ts`
is a port of `StrokeTutor/Parsing/SVGPathParser.swift` — same grammar, same
rejections, same character indices in error messages.

What keeps the two honest is `shared/conformance/`: a corpus of documents with the
verdict each player must reach, run by `npm test` here and by `ConformanceTests.swift`
there. Where the two are meant to differ, the manifest says so and says why. See
[shared/README.md](../shared/README.md).

## Running

```bash
npm install
npm run dev      # opens the Studio on the Paths view
npm test         # path parser, conformance corpus, catalog, Studio helpers, command line
npm run build    # type-check and bundle
npm run studio   # the Studio from the terminal; see "The command line"
```

No accounts and no remote backend. `npm run dev` also mounts the Studio's small local server (see
[Saving](#saving)); a static build has no server and is read-only. Everything works offline except
generation, which calls OpenRouter only when **Generate tutorial** is pressed (see
[Generating](#generating)).

## Layout

```
../shared/            tutorial.schema.json, catalog.schema.json, Tutorials/, Catalog/, conformance/
src/
  schema/    types.ts, validate.ts          mirrors and enforces the tutorial schema
  catalog/   types.ts, validate.ts, metrics.ts   the curriculum catalog beside the tutorials
  player/    TutorialPlayer.tsx, StrokeCanvas.tsx, usePlayback.ts, svgPath.ts
  studio/    Studio.tsx, PathsView.tsx, LessonWorkspace.tsx, library.ts, route.ts
    editor/  ops.ts (pure, tested edits), history.ts, EditCanvas.tsx, StepEditor.tsx, Inspector.tsx
  app/       ImportView.tsx, TutorialSource.tsx, DebugPanel.tsx
  samples/   index.ts                       globs the golden files (read-only fallback)
server/      studioApi.ts, repoWriter.ts    the local server: the only code that writes shared/
             generate.ts, openrouter.ts, models.ts, prompts/   lesson generation (server-side only)
             fixtures/                      representative model outputs for tests
cli/         studio.mjs (bootstrap), main.ts, commands/   the Studio from the terminal, on the same store
             browser.ts, browser/page.ts    the Studio's browser code in headless Chromium, for SVGs
```

`@shared/*` resolves to `../shared/*` — see the alias in `vite.config.ts` and the
matching `paths` entry in `tsconfig.json`.

`player/` imports nothing from `app/` or `studio/`. `TutorialPlayer` takes a validated
`Tutorial` and nothing else, which is why the Studio's learner preview can be the real player
rather than an imitation of it.

## The Studio

Hash routes, so every screen can be bookmarked: `#/paths/<path>`, `#/lessons/<lesson>`, `#/import`.

- **Paths** lists every path in the working curriculum and the lessons of the selected one
  in unlock order, each with its finished drawing, a lifecycle badge (Draft, Needs review,
  Approved, Published, Published · edited), objective and an estimated learner time. It is also
  where the curriculum is shaped (`studio/pathOps.ts`):
  - **+ New path** takes a title, an id (fixed once created; lessons and the app refer to paths
    by it) and an optional description;
  - paths reorder with their ↑/↓ buttons; a path's title and description are edited in place;
  - **Delete path…** moves a path to the Trash, keeping its lessons under “Not in a path” or
    moving them to the Trash too;
  - lessons reorder by drag or ↑/↓, move to another path or out of every path with **Move to…**,
    and a catalogued lesson outside every path can be added to the open one;
  - each lesson's **⋯** menu duplicates it as a draft, publishes or unpublishes it, or deletes it.

  Every change is saved at once in the workspace, so there is never an unsaved curriculum to
  lose. Tutorials that no path lists are shown separately, because a learner would never reach
  them; ones not yet in the curriculum must be catalogued before joining a path.
- **Publish** lists everything in the workspace that is not in `shared/` yet: approved lessons,
  lessons still in progress, published lessons with changes, and curriculum changes shown before
  and after. See [Workspace and publishing](#workspace-and-publishing).
- **Trash** (from the Paths sidebar) holds deleted lessons and paths until they are deleted for good.
- **Lesson Workspace** fills the window with three panes that scroll on their own, so nothing is
  below the fold:
  - **the reference rail** (left; `[` hides it): the photo, with a switch to lay it under the drawing,
    and the lesson's objective, complexity and notes, edited in place;
  - **the drawing** (centre): the canvas sized to fit, with a transport bar (previous and next step,
    replay step or lesson, colour by step);
  - **the steps** (right): one line per step with its instruction, and the active step open for
    its title, instruction and strokes.

  It is an editor for the teaching structure, not for the drawing (§18). Click or shift-click strokes
  on the canvas or in the step list, and a bar floats over the drawing to group them into a new step,
  move them to another step, retime them or delete them. Reorder steps and strokes, split a step at
  any stroke, merge it with the next. Any stroke, step or the whole lesson can be replayed on the real
  clock, every change is undoable (⌘Z / ⇧⌘Z), and strict validation runs on every edit.

  Edits save themselves into the workspace a moment after you stop typing; **⌘S** also keeps the
  version in History. **Preview** mounts `TutorialPlayer` with the edited lesson. Regenerate, History,
  the generation record and the debug tools open in a drawer over the steps, and Approve and Publish
  confirm in a dialog. `?` lists the keyboard shortcuts.
- **Import & test** is the original loader: any tutorial JSON, validated and played. Nothing is saved
  unless **Save as workspace draft…** keeps it, with an id, a path and an objective, and opens it in the
  lesson workspace.
- **⌘K**, or **Jump to…** in the header, opens a palette to jump to any lesson, path or page by typing
  a few letters.

At start-up `studio/library.ts` validates every tutorial and the catalog once. A tutorial whose
`id` does not match its file name is refused, because lessons are found and saved by id.

The estimated learner time (`catalog/metrics.ts`) is a placeholder formula — animation time
times three, plus eight seconds per step — until real lessons are timed.

## Workspace and publishing

Content lives in two places:

| | Where | In git | Holds |
|---|---|---|---|
| **Workspace** | `../.studio/workspace.sqlite` (`STUDIO_WORKSPACE` overrides) | no | the working curriculum, drafts, edits to published lessons, photos not yet published, every recorded version, the Trash |
| **Published** | `../shared/` | yes | what the iOS app bundles: published tutorials, their photos, `Catalog/` |

The workspace (`server/workspaceStore.ts`, built-in `node:sqlite`, Node 22.13 or later) is an overlay
on `shared/`, not a copy. A published lesson nobody has touched is read straight from `shared/`;
editing it adds a working copy, and the lesson shows **Published · edited** until that is published.
The working curriculum lists every path and lesson, drafts included; `shared/Catalog` is its
projection onto published lessons, in the same order, leaving out a path with none
(`src/catalog/publishing.ts`). What Publish would change is computed from the two each time the
library is read, never queued. The workspace starts as a copy of `shared/Catalog` the first time the
Studio opens, and is copied once a day to `../.studio/backups/` (the newest seven are kept), since git
does not hold it.

- Autosave, **⌘S**, **Approve…**, New lesson's **Keep as draft**, photos, path edits, regenerations and
  history all write the workspace only.
- **Publish…** (in the workspace, a lesson's ⋯ menu, or the Publish view) shows the quality warnings and
  the §36 checklist, marks the lesson approved and writes, in this order, its photo, its tutorial and
  then `shared/Catalog`. The catalog goes last, so a failure part-way never leaves it pointing at a
  missing file, and publishing again resumes. Curriculum changes are published together with anything
  else; the Publish view can also publish them alone. The Studio lists the files it wrote as a
  `git add` line; committing is up to you.
- **Unpublish…** writes the lesson and its photo into the workspace, reads them back, and only then
  removes them from `shared/` and from the published curriculum. It stays a lesson you can edit and
  publish again.
- **Delete…** moves a lesson to the Trash, with its photo; a published lesson is unpublished first,
  and that asks for its id to be typed. Its history stays until the Trash is emptied. **Restore**
  puts it back where it was, as a draft. Deleting a path moves it to the Trash; its lessons stay under
  “Not in a path”, or go to the Trash too.
- If `shared/Catalog` changes outside the Studio (a git pull, a hand edit), a banner offers **Adopt
  shared/**: published lessons and paths then follow `shared/`, and workspace-only lessons keep their
  places. Publishing waits until then.

## The Studio server

`server/studioApi.ts` mounts a few JSON endpoints under `/api` on the Vite dev server and nowhere
else. `server/workspaceStore.ts` keeps the workspace. `server/repoWriter.ts` is the only code that
touches `shared/`, and only when publishing or unpublishing:

- only under `shared/Tutorials/`, `shared/Catalog/` and `shared/Assets/References/`, at file names
  the server derives from validated ids — the browser never sends a path;
- only documents that pass the Studio's own strict validators, loaded through Vite;
- only over the version the Studio read: each write or delete names a SHA-256 of the file it
  replaces, and a file changed on disk in the meantime is refused rather than overwritten;
- atomically (temporary file, then rename), formatted like the hand-written golden files.

Writes must be same-origin and carry an `X-StrokeTutor-Studio` header. In dev the Studio reads the
working library through `/api/library` rather than bundling it, so saving never reloads the page.

The workspace saves each edit about a second after the creator stops, one save at a time, naming the
version it replaces; leaving the lesson saves the last edit too. Autosaves don't add to History, except
that the version a lesson had before its first change is kept. **⌘S** keeps the current version in
History. **Approve…** shows the quality warnings (`studio/quality.ts`: length, stroke count, tiny strokes,
crowded steps, placeholder words, a jump from the previous lesson) with the §36 checklist, then
saves and marks the lesson approved. Warnings never block. A reference image is stored as
`<lesson>.jpg|png|webp|svg` with its source and licence recorded with the lesson. An SVG must be a
plain drawing: scripts, event handlers, `<foreignObject>`, entity declarations and links to other
files are refused with a reason, and every reference is served under a sandboxing
`Content-Security-Policy`. Nothing runs git: publishing appears as ordinary diffs to review.

## The command line

Everything the Studio does can be done from a terminal, on the same workspace, with the same store,
validators and editing operations (`cli/`). `npm run studio -- <command>` runs one command;
`npm run studio` alone lists them, and `--help` after any command describes it.

```bash
npm run studio -- status                                   # paths, lessons, what publishing would change
npm run studio -- paths create --title "Animals"
npm run studio -- lessons list --path houses
npm run studio -- steps split simple-house windows --at 2
npm run studio -- strokes set simple-house 4.* --duration 1.5
npm run studio -- lessons approve simple-house && npm run studio -- publish all
npm run studio -- svg trace palm.svg --out palm.trace.json
npm run studio -- svg optimize palm.svg --simplify
npm run studio -- svg to-steps palm.svg --id palm --title Palm --objective "…" --goal "…" --source … --license …
npm run studio -- image to-steps house.jpg --id house --title House --objective "…" --goal "…" --source … --license …
npm run studio -- lessons regenerate palm --layer instructions --note "Say where to start." --use
```

| Group | Commands |
|---|---|
| the Studio | `status`, `settings`, `models`, `adopt-shared` |
| `paths` | `list`, `show`, `create`, `rename`, `describe`, `move`, `reorder`, `add`, `delete` |
| `lessons` | `list`, `show`, `export`, `import`, `set`, `move`, `duplicate`, `delete`, `unpublish`, `approve`, `validate`, `quality`, `reference set`, `reference export`, `generate`, `regenerate` |
| `steps` | `list`, `set`, `split`, `merge`, `move`, `group` |
| `strokes` | `list`, `move`, `reorder`, `delete`, `set` (retime, line width) |
| `history` | `list`, `show`, `use` |
| `publish` | `pending`, `lessons`, `curriculum`, `all` |
| `trash` | `list`, `restore`, `purge`, `empty` |
| `svg` | `trace`, `optimize`, `render`, `to-steps` |
| `image` | `to-steps` |

- **The same workspace.** `cli/studio.mjs` is plain JavaScript that starts Vite in middleware mode as a
  module loader only (no port, no browser, no watcher), so the Studio's TypeScript, its `@shared` alias and
  its JSON schema imports resolve as they do for the Studio server, which loads the same validators through
  `ssrLoadModule`. `cli/context.ts` then opens the workspace with `server/workspaceStore.ts` and
  `server/repoWriter.ts`; nothing is reimplemented. The command line and `npm run dev` can share the
  workspace file (SQLite waits its turn), and the Studio shows the command line's changes on its next
  reload. `--workspace` and `--shared` point elsewhere; `STUDIO_WORKSPACE`, `OPENROUTER_API_KEY` and
  `OPENROUTER_MODEL` are read from `.env.local` as `vite.config.ts` reads them, and `--model` overrides
  the model.
- **Edits are the editor's.** `steps` and `strokes` commands run `src/studio/editor/ops.ts` on the lesson
  as it stands, validate, and save naming the version replaced, as ⌘S does: the version is kept in History
  (`--no-checkpoint` saves like an autosave). A step is named by its number in `steps list` or its id; a
  stroke by `<step>.<n>`, a range `2.1-3`, all of them `walls.*`, or a list `2.1,2.4-5`. A save that lands
  on a version changed meanwhile is refused with "run it again". `lessons set` changes the catalog entry
  (objective, status, complexity, notes) and `--title` the tutorial; `history use` brings a recorded
  version back.
- **Destructive changes ask, as the dialogs do.** Unpublishing, deleting a published lesson, trashing a
  path with its lessons, and deleting for good ask for the id to be typed; `--yes` answers for a script,
  and without a terminal nothing is changed until it is passed. Deleting a workspace draft goes straight
  to the Trash, where `trash restore` finds it.
- **Publishing is the same act.** `publish lessons`, `publish curriculum` and `publish all` call
  `workspace.publish`, print the `git add` line, and refuse while `shared/Catalog` has changed outside the
  Studio until `adopt-shared`.
- **SVGs go through a real browser.** Tracing, optimising and rendering need an engine that resolves a
  file's CSS, transforms and pixels, so `cli/browser.ts` opens `cli/browser/page.ts` in headless Chromium
  (Playwright), served by the same Vite: `svg trace` is New lesson's tracer to the byte, with its knobs as
  options (`--max-strokes 32|64|96` are the Regenerate drawer's detail levels). Chromium is started only
  by commands that need it. Run `npx playwright install chromium` once, or set `STUDIO_CHROMIUM` to a
  Chrome executable. `svg optimize` rewrites a file as the tracer sees it (`src/svg/optimize.ts`): one
  path per shape, absolute M/L/C/Q/Z, transforms applied, styles as attributes, fitted to the
  1000 × 1000 canvas; `--simplify` also simplifies each path, drops specks and smooths the curves that
  remain, keeping real corners. `svg render` is the PNG a model would be sent.
- **Generation ends as "Keep as draft" does.** `image to-steps` (a photo), `svg to-steps` (an SVG, traced;
  `--no-model` builds the lesson from the trace alone, a few lines per step) and `lessons generate`
  (either) keep the tutorial, the reference with its source and licence, a draft catalog entry with the
  generation record, and the candidate in History. `--no-keep` only shows it, `--out` writes it, and
  `--dry-run` says what would be sent without spending anything. `lessons regenerate --layer` records the
  result in History whether or not `--use` makes it the lesson.
- **Output.** Tables and sentences by default; `--json` prints one JSON document for scripts, with errors
  as `{ "error", "issues" }`. Exit code 1 means refused (a validation problem, a missing lesson, a model's
  failure), 2 that the command line could not be understood.

Every command runs in-process in `cli/*.test.ts` on the server tests' fixture (a scratch copy of `shared/`,
an in-memory workspace, a fake model), without Vite or a browser. `cli/browser.smoke.test.ts` traces,
optimises and renders in real Chromium when `STUDIO_BROWSER_TESTS=1`.

## Generating

```bash
echo 'OPENROUTER_API_KEY=sk-or-…' >> .env.local   # ignored by git; restart npm run dev
```

The key is read by `vite.config.ts` and handed to the server plugin only. Vite exposes nothing but
`VITE_`-prefixed variables to the browser, so it never reaches the bundle, and **Settings** shows
only whether a key is configured. `OPENROUTER_MODEL` in the same file sets a default model.

**Settings** lists the models OpenRouter currently offers that accept images, support
structured output and answer in text only, with prices; image-generation models such as
`google/gemini-2.5-flash-image` are left out. The choice is kept in the browser, and Settings warns
when the kept choice is no longer in the list. New lesson and the Regenerate panel show the model in use
with **Change model**, which opens the same list in place; a choice made there is saved the same way,
so Settings and the next visit use it too. A provider's refusal is shown with the provider's
own reason, taken from OpenRouter's `error.metadata`. No model id is written into
the code.

**New lesson** takes a path and position, a title and id, a one-line objective, the reference
photo with its source and licence, the learning goal and optional constraints, and one
**Generate tutorial** button. The photo is dropped on (or chosen from) a zone that shows it at once;
recently used sources and licences are offered again. A footer that stays in view says what is still
missing, or how long generation has been running. The server (`server/generate.ts`):

1. checks the input, and refuses an id that already exists — generation never replaces a lesson;
2. sends the photo (an SVG reference is rendered to PNG in the browser first, since models are not
   sent SVG), the goal and the titles and objectives of the path's earlier lessons to the
   chosen model, asking for strict JSON (`response_format` with a JSON schema, and
   `provider.require_parameters` so only providers that honour it are used);
3. fills in `schemaVersion`, `id`, `title` and the 1000 × 1000 canvas itself, makes step ids
   unique, and runs strict validation;
4. returns the candidate, the model's analysis of the photo and any issues. It writes nothing.

An invalid candidate is shown with its issues and never reaches the editor. A valid one is
previewed with its quality warnings; **Keep as draft** stores the tutorial (create-only), the photo
and a `draft` catalog entry that records the model, prompt version, goal and analysis in the
workspace, then opens the lesson. Nothing reaches `shared/` until it is published. Failures of any kind keep everything the creator typed.

**From an SVG.** When the reference is an SVG, New lesson traces it in the browser as soon as it is
chosen (`src/trace/traceSvg.ts`) and previews the lines and colours. **Generate tutorial** then
posts the trace to `POST /api/generate-from-trace` (`server/generateFromTrace.ts`, prompt
`svg-lesson-v1`):
- the model sees each line and colour as an id with its position and size, never its path data,
  plus the picture;
- it answers with outline steps, then colour steps;
- the server builds the lesson from the exact traced shapes, placing every line and colour once and
  noting any corrections.

If tracing fails, generation uses the picture instead.

**Regenerating one layer.** In the Lesson Workspace, **Regenerate…** redoes one layer of the lesson
(`POST /api/regenerate`, `server/regenerate.ts`, master plan §24):

| Layer | What changes | What stays |
|---|---|---|
| Instructions | every title and instruction | the drawing, the steps and their order |
| Steps | how lines and colours are grouped, and the words | every line and colour, each placed once |
| Order | the order of steps and of lines within them, and which end a line starts from | each step's lines, colours and words |
| Drawing | everything: a new generation from the reference | the lesson's id and title |

For the first three, the model is sent the lesson as ids with positions (never path data), a picture of the drawing
(`src/studio/drawingImage.ts`) and the reference. It answers with ids, and the server rebuilds the lesson from the
shapes it already has. A new drawing from an SVG traces the file again at the chosen detail.

The result appears beside the current version; **Use the regenerated version** makes it an ordinary edit, so
**Undo** takes it back and autosave keeps it. Nothing else is written by regenerating.

**History.** Every version of a lesson is kept in the workspace, never in its place, so a good one is
never lost (master plan §24). Each version is one record with an id `<time>-<kind>-<random>`
(`src/history/types.ts`), holding the whole tutorial and how it came about: model, prompt version,
note, rationale, the Studio's corrections, the analysis and the cost.
- **Generated:** New lesson keeps every valid candidate of the session (**Generate another** adds one
  and never replaces), and **Keep as draft** records all of them, the kept one marked.
- **Regenerated:** each valid regeneration, recorded as it arrives, whether or not it is used.
- **Saved:** every ⌘S that changes something since the last recorded version. Autosaves are not
  recorded, but the first time a lesson changes, the version it had goes in first, so there is always
  one to go back to.
- **Published:** each version written into `shared/` by Publish.

The workspace's **History** tab lists every version, newest first, and shows the chosen one beside
the editor's version or beside another recorded one. **Use this version** brings it back as an ordinary
edit. `GET /api/history/:lesson` lists; `POST /api/history/:lesson` only adds, and only generated or
regenerated versions that validate and carry the lesson's id. History lives in the workspace, outside
git, and the iOS app never sees it. A lesson's history is removed only when it is deleted for good.

The prompt lives in `server/prompts/lessonPrompt.ts` and carries a version (`lesson-v1`) that every
generated lesson records. `server/fixtures/` holds representative model outputs — one good, one
that breaks the contract — so the pipeline is tested without calling a model. OpenRouter's
documentation used for the request format is cited at the top of `server/openrouter.ts`.

## Loading a tutorial in Import & test

Four ways, all ending in the same validation path:

- the bundled samples,
- a `.json` file picker,
- dropping a `.json` file anywhere on the window,
- pasting JSON into the textarea and pressing **Load** — the quickest way to test
  AI-generated or hand-edited documents.

A document that fails validation is reported with its JSON path
(`steps[2].strokes[0].d`), the reason, and the offending value. The last document
that loaded cleanly stays on the canvas; the player never goes blank without saying
why.

## Playback

`idle → drawing(step) → awaitingUser(step) → drawing(next) → … → finished`

Strokes animate with the dash-offset technique, driven by `requestAnimationFrame`
and an explicit progress value rather than a CSS transition, so scrubbing and speed
changes land on the frame they are asked for. Progress is a fraction of the stroke's
*duration*, never of its length: two strokes with equal durations take equal time
however long their paths are, which is what makes timing parity with iOS checkable.

Strokes within a step are strictly sequential. Completed steps stay on the paper at
0.3 opacity; upcoming steps are not drawn at all. A speed change applies from the
next stroke, leaving the one in flight on its original clock.

## Debug panel

For hand-authoring coordinates: show-all rendering, a 100-unit grid with axis
labels, a live canvas-space cursor readout, and a stroke inspector listing every
stroke's `d`, duration and measured path length — hover a row to pick that stroke
out on the canvas. It renders its own static canvas next to the live player, so you
can read coordinates off a still copy while the animation plays. In the Studio it
lives under the workspace's **Advanced** tab.

## Schema v1

`shared/tutorial.schema.json` is the source of truth and validates every document
that is loaded; `types.ts` mirrors it. `canvas` maps directly to the SVG
`viewBox`, and coordinates and `lineWidth` are in canvas units. `style` is optional
and defaults to `#2B2B2B` on `#FAF7F0`; colours are `#RRGGBB` or `#RRGGBBAA` with the
`#` optional, matching what iOS `Color(hex:)` accepts — three-digit `#RGB` is refused
because the device would silently draw the default instead. `voiceover` is always
`null` in v1 and is ignored — there is no audio. A `schemaVersion` other than `1` is
rejected by name.

## Schema v2

`shared/tutorial.v2.schema.json` adds colour and nothing else: a stroke may carry its own `color`,
and a step may carry `fills`, shapes painted after its strokes. A step's `strokes` may then be
empty, but it needs a stroke or a fill. `validate.ts` picks the schema by `schemaVersion`, and v1
stays frozen, so a v1 document with `fills` is refused as an unknown property. The player paints
fills beneath every stroke and reveals each one left to right; `usePlayback` runs a step's strokes,
then its fills. iOS reads v1 only until M7 (see `shared/README.md`).

Paths support absolute `M`, `L`, `C`, `Q` and `Z` only. Commas or whitespace
separate numbers, and one command letter may carry repeated coordinate sets
(`L 10 10 20 20` is two segments). Lowercase `z` is accepted; any other lowercase
command is rejected rather than misrendered as absolute.
