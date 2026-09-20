# shared/

The contract between the iOS app and the web player. Nothing in here is a copy
of anything — both sides read these exact files.

```
shared/
  tutorial.schema.json     the schema, v1 (frozen)
  tutorial.v2.schema.json  v2: v1 plus stroke colours and fills (web only until M7)
  Tutorials/               published tutorials: what ships in the app
  conformance/             cases both players must agree about
  catalog.schema.json      the curriculum catalog schema, v1
  Catalog/                 paths.json + lessons.json: where each published lesson sits in the curriculum
  Assets/References/       reference photos of published lessons, named <lesson>.jpg|png|webp|svg
```

**Only published content lives here.** The Studio works in a local workspace outside git
(`.studio/workspace.sqlite`): drafts, edits, unpublished photos, every recorded version and the
Trash. It writes here only when a lesson is published or unpublished, through
`web/server/repoWriter.ts`, which validates strictly and never writes over or deletes a file that
changed on disk. `Catalog/` is the working curriculum narrowed to published lessons. Published changes
are ordinary diffs to review before committing; see [web/README.md](../web/README.md#workspace-and-publishing).

| File | Read by iOS | Read by web |
|---|---|---|
| `tutorial.schema.json` | no (see below) | yes — Ajv compiles it and validates every load |
| `tutorial.v2.schema.json` | no — iOS refuses `schemaVersion` 2 by name until M7 | yes — used for documents that declare version 2 |
| `Tutorials/*.json` | yes — bundled as a folder reference | yes — globbed via the `@shared` alias |
| `conformance/` | yes — `ConformanceTests.swift` | yes — `conformance.test.ts` |
| `catalog.schema.json`, `Catalog/` | not yet — the learner app adopts it in M7 | yes — the Studio validates both files and their cross-references |
| `Assets/References/` | not yet — M7 | yes — shown beside the lesson, served by the Studio server |

`Tutorials` keeps its capital T because it is also the folder name inside the app
bundle, which `TutorialLoader.bundleSubdirectory` looks for.

## Why the schema is not the whole contract

Foundation has no JSON Schema validator, so iOS does not check documents against
`tutorial.schema.json` at runtime — `TutorialDocument.swift` and `TutorialLoader`
implement the same rules in Swift. The schema alone could not be the whole
contract anyway. It cannot express:

- the SVG path grammar (`SVGPathParser.swift` and `svgPath.ts` — same subset,
  same rejections, same character indices in errors);
- where the two players *should* differ.

That is what `conformance/` is for. It is the thing that actually stops the two
implementations drifting apart.

## The conformance corpus

`conformance/cases/` holds whole tutorial documents. `conformance/cases.json`
says what each player must decide about each one:

```json
{
  "file": "divergent-zero-duration.json",
  "expect": "invalid",
  "why": "A stroke that takes no time never animates.",
  "web": { "path": "steps[0].strokes[0].duration" },
  "ios": { "expect": "valid", "warningContains": "duration", "why": "…" }
}
```

- `expect` is the verdict **both** players must reach.
- `web` and `ios` add assertions for that player: the JSON path it must name, a
  fragment its message must contain, a warning it must raise.
- An `expect` inside `web` or `ios` records a **deliberate divergence**, and both
  suites refuse to let one exist without a `why`.

Adding a case is dropping a `.json` in `cases/` and an entry in `cases.json`.
Both suites pick it up with no other change — `conformance/` is a folder
reference in the Xcode project, and the web suite reads the directory.

## The deliberate divergences

The device is lenient because it must never strand a child mid-lesson; the
authoring tool is strict because catching a bad export before it ships is the
tool's entire job. So for version 1 the tool is *never* more permissive than the
device, only louder.

| Document | Web | iOS |
|---|---|---|
| `duration` or `lineWidth` of 0 | rejects | clamps to 0.8s / 8, with a warning |
| unknown property, including `fills` in a v1 document | rejects as a likely typo | ignored by `JSONDecoder` |
| empty `title` | rejects | loads, shows an empty label |
| unparseable or 3-digit hex | rejects | warns, falls back to the default colour |
| any `schemaVersion` 2 document | plays it | refuses by name until M7; a bundled one is skipped, not reported |

The hex row is the direction that actually bites: a browser draws `#FFF` happily
while `Color(hex:)` requires 6 or 8 digits and would silently substitute the
default. The tool rejects it so the two can never disagree on screen.

The version 2 row is the one place the tool is ahead of the device, on purpose: v2 is
authored and previewed in the Studio before the iOS player learns it. Until then the app
skips a bundled v2 lesson instead of reporting it as broken (`TutorialLoader.isForNewerApp`),
so the Studio saves v2 lessons into `Tutorials/` alongside v1 ones.

## Version 2: colour

`tutorial.v2.schema.json` is version 1 plus colour, and nothing else changes:

- a stroke may carry `color`, instead of `style.strokeColor`;
- a step may carry `fills`: shapes painted after its strokes, each with `d` (the same
  absolute M/L/C/Q/Z grammar), `color`, `duration` and an optional `fillRule`;
- a step's `strokes` may then be empty, but a step needs at least one stroke or fill.

Fills are painted beneath every stroke of the lesson, so outlines always stay on top,
and a lesson normally keeps its colour steps until every outline is drawn. The web
player reveals a fill left to right, like colouring in. Version 1 is untouched and
frozen: a v1 document that carries `fills` is refused as an unknown property.

## The curriculum catalog

A tutorial answers *how does this drawing play?* The catalog answers *where does this lesson
live in the curriculum, and how far through authoring is it?* They are kept apart on purpose, so
curriculum work can never touch the playback contract above.

- `Catalog/paths.json` lists subject paths in order, each with its lesson ids in unlock order, and
  optionally the **levels** that group them. A level (Starter, Core, Advanced) has an id, a name and
  a line about what its paths teach; it only groups the path list and recommends an order, and never
  locks a path. A path names its level in `level`; one with none is listed after the levels, and a
  curriculum with no levels has no `levels` key at all and is one flat list.
- `Catalog/lessons.json` holds per-lesson metadata: authoring status (`draft`, `needs-review`,
  `approved`), a one-line objective, complexity, creator notes, and an optional reference photo
  with its source and licence. The photo lives in `Assets/References/`, named by a bare file name
  so it can never point outside that folder. A generated lesson also keeps a `generation` record:
  the model, the prompt version, the creator's goal and constraints, and the model's analysis of
  the photo. It is authoring history for comparing prompts and models, never shown to learners.

A lesson's id is also its tutorial's file name, `Tutorials/<id>.json`. Beyond the schema, the
Studio checks that ids are unique, that every lesson resolves to a valid tutorial, that no lesson
sits in two paths, that a path's level exists, and that referenced photos exist. A tutorial no path
lists still plays; it is just unreachable for a learner, and the Studio says so.

The schema also has a fourth status, `planned`. A planned lesson is a place held in a path before
anything is drawn: an id, a `title`, an `objective`, and nothing else — no tutorial, no photo, no
steps. It exists so a whole curriculum can be laid out at once and filled one lesson at a time. It
lives in the Studio's workspace only: **a planned lesson is never published**, so nothing here in
`shared/` ever carries one, and `title` never appears on a lesson that has a tutorial.

## Running both suites

```bash
cd web && npm test
xcodebuild test -project StrokeTutor.xcodeproj -scheme StrokeTutor \
  -destination 'platform=iOS Simulator,name=iPhone 17'
```
