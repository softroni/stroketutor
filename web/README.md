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
npm test         # path parser, conformance corpus, catalog, Studio helpers
npm run build    # type-check and bundle
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
```

`@shared/*` resolves to `../shared/*` — see the alias in `vite.config.ts` and the
matching `paths` entry in `tsconfig.json`.

`player/` imports nothing from `app/` or `studio/`. `TutorialPlayer` takes a validated
`Tutorial` and nothing else, which is why the Studio's learner preview can be the real player
rather than an imitation of it.

## The Studio

Hash routes, so every screen can be bookmarked: `#/paths/<path>`, `#/lessons/<lesson>`, `#/import`.

- **Paths** lists every path in `shared/Catalog/paths.json` and the lessons of the selected one
  in unlock order, each with its finished drawing, authoring status, objective and an estimated
  learner time. Lessons can be reordered by drag or with the arrow buttons; the new order lasts
  for the session until the repository writer (M3) can save it. Tutorials that no path lists
  are shown separately, because a learner would never reach them.
- **Lesson Workspace** puts the reference photo, the drawing and the step list side by side,
  with an inspector and the debug tools underneath. It is an editor for the teaching structure,
  not for the drawing (§18): click or shift-click strokes on the canvas or in the step list, then
  group them into a new step, move them to another step, retime them or delete them; reorder
  steps and strokes, split a step at any stroke, merge it with the next, and edit its title and
  instruction. Strokes are coloured by step while editing. Any stroke, step or the whole lesson can
  be replayed on the real clock, every change is undoable (⌘Z / ⇧⌘Z), and strict validation runs
  on every edit. **Preview as learner** mounts `TutorialPlayer` with the edited lesson.
- **Import & test** is the original loader: any tutorial JSON, validated and played, never saved.

At start-up `studio/library.ts` validates every tutorial and the catalog once. A tutorial whose
`id` does not match its file name is refused, because lessons are found and saved by id.

The estimated learner time (`catalog/metrics.ts`) is a placeholder formula — animation time
times three, plus eight seconds per step — until real lessons are timed.

## Saving

`server/studioApi.ts` mounts a few JSON endpoints under `/api` on the Vite dev server and nowhere
else. `server/repoWriter.ts` does the disk work, and it is the only code that writes:

- only under `shared/Tutorials/`, `shared/Catalog/` and `shared/Assets/References/`, at file names
  the server derives from validated ids — the browser never sends a path;
- only documents that pass the Studio's own strict validators, loaded through Vite;
- only over the version the Studio read: each write names a SHA-256 of the file it replaces, and a
  file changed on disk in the meantime is refused rather than overwritten;
- atomically (temporary file, then rename), formatted like the hand-written golden files.

Writes must be same-origin and carry an `X-StrokeTutor-Studio` header. In dev the Studio reads
`shared/` through `/api/library` rather than bundling it, so saving never reloads the page.

**Save** writes the lesson, then reads it back from disk and confirms it matches the preview.
**Approve…** shows the quality warnings (`studio/quality.ts`: length, stroke count, tiny strokes,
crowded steps, placeholder words, a jump from the previous lesson) with the §36 checklist, then
saves and marks the lesson approved. Warnings never block. A reference photo is saved as
`<lesson>.jpg|png|webp` with its source and licence recorded in `lessons.json`. Nothing runs git:
saves appear as ordinary diffs to review.

## Generating

```bash
echo 'OPENROUTER_API_KEY=sk-or-…' >> .env.local   # ignored by git; restart npm run dev
```

The key is read by `vite.config.ts` and handed to the server plugin only. Vite exposes nothing but
`VITE_`-prefixed variables to the browser, so it never reaches the bundle, and **Settings** shows
only whether a key is configured. `OPENROUTER_MODEL` in the same file sets a default model.

**Settings** lists the models OpenRouter currently offers that accept images and support
structured output, with prices; the choice is kept in the browser. No model id is written into
the code.

**New lesson** takes a path and position, a title and id, a one-line objective, the reference
photo with its source and licence, the learning goal and optional constraints, and one
**Generate tutorial** button. The server (`server/generate.ts`):

1. checks the input, and refuses an id that already exists — generation never replaces a lesson;
2. sends the photo, the goal and the titles and objectives of the path's earlier lessons to the
   chosen model, asking for strict JSON (`response_format` with a JSON schema, and
   `provider.require_parameters` so only providers that honour it are used);
3. fills in `schemaVersion`, `id`, `title` and the 1000 × 1000 canvas itself, makes step ids
   unique, and runs strict validation;
4. returns the candidate, the model's analysis of the photo and any issues. It writes nothing.

An invalid candidate is shown with its issues and never reaches the editor. A valid one is
previewed with its quality warnings; **Keep as draft** writes the tutorial (create-only), the photo
and a `draft` catalog entry that records the model, prompt version, goal and analysis, then opens
the lesson in the workspace. Failures of any kind keep everything the creator typed.

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

Paths support absolute `M`, `L`, `C`, `Q` and `Z` only. Commas or whitespace
separate numbers, and one command letter may carry repeated coordinate sets
(`L 10 10 20 20` is two segments). Lowercase `z` is accepted; any other lowercase
command is rejected rather than misrendered as absolute.
