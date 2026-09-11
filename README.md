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
| M1 | Studio shell + catalog | §14–15, §26, §34 Phase 1 | autonomous | ✅ Done 2026-09-11 | see git log |
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

**M2: Lesson editor.** Autonomous runs stop after **M4**. M5 and later need the creator.

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
