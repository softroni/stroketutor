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
| M0 | Baseline: protect the PoC | §34 Phase 0 | autonomous | ⬜ Not started | |
| M1 | Studio shell + catalog | §14–15, §26, §34 Phase 1 | autonomous | ⬜ Not started | |
| M2 | Lesson editor | §17–19, §34 Phase 2 | autonomous | ⬜ Not started | |
| M3 | Repository writer | §25, §27, §34 Phase 3 | autonomous | ⬜ Not started | |
| M4 | OpenRouter integration | §20–22, §35 Phase 4 | autonomous (live check needs a key) | ⬜ Not started | |
| M5 | AI generation quality | §23–24, §35 Phase 5 | **gated**: needs creator judgement | ⬜ Not started | |
| M6 | Houses vertical slice | §35 Phase 6, App. A | **gated**: needs reference photos + approval | ⬜ Not started | |
| M7 | iOS product shell | §29–31 | **gated** on M6 | ⬜ Not started | |
| M8 | Private sketchbook | §32 | gated | ⬜ Not started | |
| M9 | Content expansion | §33 Phase 9 | gated | ⬜ Not started | |
| M10 | Monetization / distribution | §33 Phase 10 | gated | ⬜ Not started | |

Status key: ⬜ not started · 🟡 in progress · ✅ done · ⏸ blocked (see notes).

### Next up

**M0: Baseline.** Autonomous runs stop after **M4**. M5 and later need the creator.

---

### M0 · Baseline: protect the PoC
- [ ] `cd web && npm test` and `npm run build` green; record counts.
- [ ] `xcodebuild test` (iPhone 17 simulator) green; record counts.
- [ ] simple-house and cat-face play on web and on iOS.
- [ ] Record the deliberate web/iOS divergences (see [shared/README.md](shared/README.md)).
- [ ] Log gaps between the plan and the current code, without changing behaviour.

**Exit:** the baseline is documented below and green.

### M1 · Studio shell + catalog
- [ ] `shared/Catalog/paths.json` + `lessons.json`: ordered paths; lesson status (draft / needs-review / approved),
      objective, stage, and an optional reference `{file, source, license}`. The tutorial schema is untouched.
- [ ] Catalog validation with tests: dangling ids, duplicates, every lesson resolves to a tutorial.
- [ ] Tutorials load from `shared/Tutorials/*.json` by glob, so new files appear without code changes.
- [ ] Paths view: ordered lessons, status, finished-stroke thumbnail, estimated time, drag reorder.
- [ ] Lesson Workspace: Reference | Drawing | Steps, with debug tools under Advanced.
- [ ] Existing paste/drop/file import still works.
- [ ] simple-house appears in a Houses path.

**Exit:** path and lesson navigation work with the existing sample.

### M2 · Lesson editor
- [ ] Pure, tested ops: reorder steps/strokes, move strokes, group into a new step, split, merge, delete stroke, and
      edits to title, instruction, duration and lineWidth. Undo/redo.
- [ ] Invariants hold: every stroke appears exactly once (except explicit deletes), no empty steps, unique step ids.
- [ ] Canvas stroke selection (click, shift-click), step list reorder, temporary step colours in Edit mode.
- [ ] Replay a stroke, a step or the whole lesson; live strict validation.
- [ ] "Preview as Learner" mounts the real `TutorialPlayer`.

**Exit:** simple-house can be reordered, grouped and split, then re-previewed, with no hand-written JSON.

### M3 · Repository writer
- [ ] Local dev-server API. It writes only to `shared/Tutorials/`, `shared/Assets/References/` and `shared/Catalog/`.
      Ids are safe, writes are atomic, and the client never supplies a path.
- [ ] Server-side strict validation before any write.
- [ ] Non-blocking quality warnings: stroke count, tiny strokes, estimated time over 5 min, crowded step.
- [ ] Approve & Save → re-read the saved file → confirm stroke/step order matches → show the result.
- [ ] Tests: traversal rejected, non-whitelisted paths rejected, invalid tutorials refused, save/reload parity.

**Exit:** an edited tutorial validates, saves to `shared/Tutorials`, reopens, and matches the preview.

### M4 · OpenRouter integration
- [ ] Server-side proxy; `OPENROUTER_API_KEY` in `web/.env.local` (gitignored); model id configurable.
- [ ] Reference image + path context + creator prompt are sent only on an explicit Generate.
- [ ] Structured `{analysis, tutorial}` output; only `tutorial` is strictly validated and allowed into the editor.
- [ ] Failures keep the creator's input and never overwrite an approved lesson.
- [ ] New Lesson flow with one "Generate Tutorial" action; Settings shows key status, never the key.
- [ ] Fixture-based tests for malformed, missing and invalid responses.

**Exit:** an uploaded reference plus a prompt produces a candidate tutorial, and failures are handled cleanly.

### M5 · AI generation quality (gated)
Prompting for human pen gestures, stage-level regeneration (drawing / order / steps / instructions),
generation history and compare, prompt versions. Needs live model iteration and the creator's judgement.

### M6 · Houses vertical slice (gated)
About five lessons: Simple House → House With Chimney → Small Cottage → House From an Angle → Two-Story House.
Needs licensed reference photos with source/licence metadata, plus creator approval against the §36 quality checklist.

### M7 · iOS product shell (gated on M6)
Onboarding, Home/Paths, Path Detail, Lesson Preview, and the player with the reference photo visible. Reads `shared/Catalog`.
Rewrite the current kid-oriented copy for an adult audience; accessibility (§31).

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

_To be recorded._

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
