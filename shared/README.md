# shared/

The contract between the iOS app and the web player. Nothing in here is a copy
of anything — both sides read these exact files.

```
shared/
  tutorial.schema.json     the schema, v1
  Tutorials/               the golden tutorials that ship in the app
  conformance/             cases both players must agree about
  catalog.schema.json      the curriculum catalog schema, v1
  Catalog/                 paths.json + lessons.json: where each lesson sits in the curriculum
  Assets/References/       reference photos, named <lesson>.jpg|png|webp (created by the Studio)
```

Everything here except `conformance/` can be written by the Studio's local server
(`web/server/repoWriter.ts`), which validates strictly and never saves over a file that changed on
disk. Studio saves are ordinary diffs to review before committing.

| File | Read by iOS | Read by web |
|---|---|---|
| `tutorial.schema.json` | no (see below) | yes — Ajv compiles it and validates every load |
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

## The four deliberate divergences

The device is lenient because it must never strand a child mid-lesson; the
authoring tool is strict because catching a bad export before it ships is the
tool's entire job. So the tool is *never* more permissive than the device, only
louder.

| Document | Web | iOS |
|---|---|---|
| `duration` or `lineWidth` of 0 | rejects | clamps to 0.8s / 8, with a warning |
| unknown property | rejects as a likely typo | ignored by `JSONDecoder` |
| empty `title` | rejects | loads, shows an empty label |
| unparseable or 3-digit hex | rejects | warns, falls back to the default colour |

The last one is the direction that actually bites: a browser draws `#FFF` happily
while `Color(hex:)` requires 6 or 8 digits and would silently substitute the
default. The tool rejects it so the two can never disagree on screen.

## The curriculum catalog

A tutorial answers *how does this drawing play?* The catalog answers *where does this lesson
live in the curriculum, and how far through authoring is it?* They are kept apart on purpose, so
curriculum work can never touch the playback contract above.

- `Catalog/paths.json` lists subject paths in order, each with its lesson ids in unlock order.
- `Catalog/lessons.json` holds per-lesson metadata: authoring status (`draft`, `needs-review`,
  `approved`), a one-line objective, complexity, creator notes, and an optional reference photo
  with its source and licence. The photo lives in `Assets/References/`, named by a bare file name
  so it can never point outside that folder.

A lesson's id is also its tutorial's file name, `Tutorials/<id>.json`. Beyond the schema, the
Studio checks that ids are unique, that every lesson resolves to a valid tutorial, that no lesson
sits in two paths, and that referenced photos exist. A tutorial no path lists still plays; it is
just unreachable for a learner, and the Studio says so.

## Running both suites

```bash
cd web && npm test
xcodebuild test -project StrokeTutor.xcodeproj -scheme StrokeTutor \
  -destination 'platform=iOS Simulator,name=iPhone 17'
```
