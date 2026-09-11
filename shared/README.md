# shared/

The contract between the iOS app and the web player. Nothing in here is a copy
of anything — both sides read these exact files.

```
shared/
  tutorial.schema.json     the schema, v1
  Tutorials/               the golden tutorials that ship in the app
  conformance/             cases both players must agree about
```

| File | Read by iOS | Read by web |
|---|---|---|
| `tutorial.schema.json` | no (see below) | yes — Ajv compiles it and validates every load |
| `Tutorials/*.json` | yes — bundled as a folder reference | yes — imported via the `@shared` alias |
| `conformance/` | yes — `ConformanceTests.swift` | yes — `conformance.test.ts` |

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

## Running both suites

```bash
cd web && npm test
xcodebuild test -project StrokeTutor.xcodeproj -scheme StrokeTutor \
  -destination 'platform=iOS Simulator,name=iPhone 17'
```
