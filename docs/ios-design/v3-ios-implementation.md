# Implementing the v3 design in the iOS app

Written 2026-09-13. The creator asked for `docs/ios-design/v3.html` to be implemented in the SwiftUI app as closely
as possible. This is the plan the implementation agents follow; the lead reviews every phase in the simulator.

**Sources of truth, in order:** `docs/ios-design/v3.html` (open it in a browser; every screen, variant and developer
note), `docs/ios-design/src/v3/design-system.css` (the tokens), `docs/ios-design/src/v3/handbook.html` (what changed
and the SwiftUI notes), `docs/ios-design/src/v3/screens/*.html` (markup and notes per screen), then the first
document's handbook `docs/ios-design/src/handbook.html` (the app map, on-device data, narration pipeline, accessibility
checklist) for everything v3 did not restate.

**Constraints**
- iOS 17+, SwiftUI, Swift 5 language mode, no third-party packages. Xcode 26 with the iPhone 17 simulator.
- The Xcode project uses folder-synchronized groups: any file under `StrokeTutor/` is compiled, any file under
  `StrokeTutorTests/` is a test. Never edit `project.pbxproj` by hand. `shared/Tutorials`, `shared/Catalog` and
  `shared/Assets/References` are bundled as folder references (`Tutorials/`, `Catalog/`, `References/` in the bundle).
- The existing player core stays and is wrapped: `PlayerViewModel` (state machine), `DrawingCanvasView`,
  `StrokeShape`, `SVGPathParser`, `TutorialLoader` (lenient), `TutorialLibrary`. Change them only where this plan says.
- Everything in `shared/` is read-only for this work. Do not touch `web/`.
- Tone: adult, calm, short sentences (BRIEF §Tone). At most one exclamation mark in the whole app.
- Build and run only in the simulator: `xcodebuild -project StrokeTutor.xcodeproj -scheme StrokeTutor -destination
  'platform=iOS Simulator,name=iPhone 17' -derivedDataPath <your own path> build`. Tests: the same with `test`.

## Architecture

```
StrokeTutor/
  StrokeTutorApp.swift          @main → AppRoot
  App/
    AppRoot.swift               first run → OnboardingFlow (fullScreenCover), else MainTabs; presents the player cover
    AppModel.swift              @Observable @MainActor: catalog, library, progress, sketchbook, settings, navigation
    MainTabs.swift              three tabs (Learn · Sketchbook · Settings), custom tab bar per v3 (.tabbar), one
                                NavigationStack per tab so back stacks survive tab switches
    AppRoute.swift              enum of pushed routes (paths, pathDetail(id), lessonPreview(id), sketchbookEntry(id),
                                settings sub-pages) + the cover routes (player, completion, capture)
  Design/
    Theme.swift                 v3 tokens: colours, type, radii, spacing, shadows (values below)
    ButtonStyles.swift          TactileButtonStyle (.primary .secondary .soft .ink .whiteOnGreen .pending) with the
                                4 pt pressed edge; QuietTextButtonStyle; RoundIconButtonStyle
    Components/                 LessonNode, PathNodesView, HeroCard, StepSegments, ProgressBar, Chip, ChoiceRow,
                                SpeechBubble, LinaView (four poses), NarrationChip, DrawingThumbnail, PageThumb,
                                ReferenceImageView, StatTile, SettingsRow/ListCard, ToggleRow, SegmentedPicker
  Content/
    Catalog.swift               CatalogPath, CatalogLesson, LessonReference (Codable, mirror shared/catalog.schema.json)
    CatalogLoader.swift         reads Catalog/paths.json + Catalog/lessons.json from the bundle, lenient
    Lesson.swift                Lesson = catalog lesson + PreparedTutorial + path; estimated minutes; drawing bounds
    (Models/, Loading/, Parsing/ stay where they are; TutorialDocument gains v2)
  Stores/
    Settings.swift              @AppStorage-backed keys (list below) behind one @Observable object
    ProgressStore.swift         LessonProgress records, JSON in Application Support, unlock rules
    SketchbookStore.swift       SketchbookPage records + JPEGs in Application Support/Sketchbook
  Features/
    Onboarding/                 OnboardingFlow + one view per beat (ob-splash … ob-ready)
    Home/                       HomeView (hp-home), PathsView (hp-paths), PathDetailView (hp-path), LessonPreviewView (hp-preview)
    Player/                     PlayerScreen (pl-player, pl-landscape), PlayerSheet, LeaveSheet (pl-leave), ReferenceSheet
    Completion/                 CompletionView (sk-complete), CaptureFlow (sk-capture: primer · camera/photos · review · saved)
    Sketchbook/                 SketchbookView (sk-book), SketchbookEntryView (sk-entry)
    Settings/                   SettingsView (st-settings), NarrationSettingsView (st-voice), ReminderSettingsView (st-reminder), AboutView
```

## Phases and ownership

**Phase 1 — foundation (one agent).** Everything outside `Features/`, plus a compiling stub for every screen in
`Features/` with its final public initializer, so Phase 2 agents replace file contents without touching anything
else. Includes: v2 tutorial support in the loader and canvas, the catalog, the stores, the design system, the
components, the app root, tabs and navigation, and the tests updated (v2 accepted, v3 refused, catalog loads, progress
unlock rules, sketchbook round-trip). Ends with a green build, green tests, and the app running in the simulator
showing the tab skeleton with real catalog data on a stub Home.

**Phase 2 — features (parallel agents, one per folder under `Features/`).** Each agent owns exactly its folder. It may
add files to `Design/Components/` only if the new component is generic and named for its use; it must not modify
files owned by Phase 1 or by another Phase 2 folder. Anything it needs from `AppModel`, the stores or the components
that does not exist is reported back to the lead, not hacked around.

**Phase 3 — integration (lead).** Merge, build, run every flow in the simulator against v3.html, fix, run tests,
update the README milestone table, commit and push.

## The design system in Swift (Phase 1 writes this; everyone uses it)

Colours (`Theme`): `paper` #FFFFFF · `page` #FFFFFF · `surface` #F5F5F3 · `surface2` #ECECE9 · `ink` #141414 ·
`ink70/55/40/25/12/06` (ink at that opacity) · `line` #E7E6E2 · `lineStrong` #D5D3CD · `green` #1FA463 · `greenDeep`
#15804B · `greenSoft` #E5F5EC · `greenTint` #F2FAF5 · `clay` #E4643B · `clayDeep` #BF4E2A · `claySoft` #FDECE4 · `gold`
#E0A32E · `goldDeep` #B9821F · `goldSoft` #FBF1DA · `blue` #2F6BE8 · `blueSoft` #E8EFFD · `danger` #D9382D · `dangerSoft`
#FCE8E6. Put them in the asset catalog as named colours too (light only), so a dark appearance can be added later.

Type (`Theme.font(_:)` returning `.system(size:weight:design:.rounded)`): largeTitle 36/heavy, title1 30/heavy,
title2 24/heavy, title3 20/heavy, headline 17/bold, body 17/medium, bodyRegular 17/regular, instruction 24/heavy,
subhead 15/semibold, footnote 13/semibold, eyebrow 12/heavy uppercase tracking 1. Use `.dynamicTypeSize` scaling via
`@ScaledMetric` where a size matters for layout.

Radii: canvas 28 · card 24 · control 20 · chip capsule · thumb 18. Spacing: gutter 20 · stack 12 · section 20 · card
padding 20. Tap target 60 (44 for nav-bar glyphs, 84 for nodes). Shadows: float `0 10 30 @14%` + `0 2 6 @6%`, chip
`0 4 14 @12%`; nothing else has a shadow.

Buttons (`TactileButtonStyle`): a rounded rectangle (radius 20) with a second rectangle 4 pt lower in the edge colour;
pressed = label moves down 4 pt and the edge disappears. Variants: primary (green fill, white 20/heavy text, min height
64, edge greenDeep) · secondary (white fill, 2 pt lineStrong border, ink 18/heavy text, min height 60, edge lineStrong)
· soft (surface fill, edge surface2) · ink (ink fill, edge black) · whiteOnGreen (white fill, green text, edge black 18%)
· pending (white fill, 2.5 pt green border, green text, edge greenSoft). Quiet text buttons are 17/bold ink70, 48 tall.
Round icon buttons: 60 pt circle, secondary treatment; `.small` = 48.

Lesson node (`LessonNode(state:drawing:)`): 84 pt circle, 5 pt edge below; `.done` gold fill, white strokes, a 28 pt
ink-gold check badge bottom-right; `.current` white fill, 4 pt green ring, a slowly pulsing halo (off under Reduce
Motion); `.locked` surface fill, strokes at ink25. The drawing inside is the lesson's tutorial rendered at 60 pt.
`PathNodesView(lessons:progress:onTap:)` lays rows on a zig-zag (x offset ±40 pt alternating), label on the outer side:
title 16/heavy, sub 13/semibold ink55 ("Drawn 3 Sep" · "Next · 7 steps" · "After Small Cottage").

Tab bar: white, 2 pt top line, three tabs, 26 pt glyphs (pencil, book, gear from SF Symbols) in a 56 × 30 pill,
greenSoft pill + green glyph and label when active, labels 11.5/heavy ink40 otherwise.

Lina (`LinaView(pose:size:)`): draw her with SwiftUI shapes in the same proportions as `#lina-neutral` in
`src/symbols.svg.html` (200 × 240 box: clay body, skin #EFC9AE, dark hair, blue beret #2178D9, round glasses, small
smile). Poses neutral · pen · point · wave differ only in the raised arm. `LinaFace` is the round 32/48 pt portrait.

Drawing thumbnails (`DrawingThumbnail(tutorial:size:strokeColor:)`): all strokes of a tutorial drawn at once on white
(or on the node's colour), fitted to the drawing's bounds. `PageThumb` is a 3:4 white page with a drawing inside.

Reference image (`ReferenceImageView(reference:)`): `References/<file>` from the bundle. SVG is rendered by a
non-scrolling, non-interactive `WKWebView` that loads the file with a stylesheet making it fill the view; raster files
use `Image`. A missing file shows the warm placeholder from v3 (`.photo--warm`) with no text.

## Content and data (Phase 1)

- **Tutorial v2.** `TutorialDocument.supportedSchemaVersions = [1, 2]`. v2 adds optional `color` on a stroke and an
  optional `fills` array on a step (`d`, `color?`, `duration`, `fillRule?` nonzero|evenodd), painted after the step's
  strokes and beneath every stroke of the lesson. Decode leniently (unknown keys ignored). `PreparedStroke.color:
  Color?`, `PreparedFill`, `PreparedStep.fills`. `DrawingCanvasView` paints fills (fade in over `duration`) in a layer
  under all strokes. `PlayerViewModel.runStep` plays fills after strokes, in order. The white paper wins: the player
  ignores `style.backgroundColor` unless the document is v2 and sets one explicitly.
- **Catalog.** `CatalogLoader.load(from: .main)` returns `Catalog { paths: [CatalogPath], lessons: [CatalogLesson] }`
  with the shapes of `shared/catalog.schema.json` (`reference.file/source/license`, `objective`, `complexity`,
  `status`). Lenient: a missing file, a lesson whose tutorial is not bundled, or a lesson not `approved` is skipped
  with a logged warning; never crash. `AppModel.paths: [PathModel]` joins catalog paths with their loaded lessons in
  order. The catalog at the time of writing has Trees (palm-tree-4, v2) and Cars (classic-red-car, v2); `cat-face` is
  in no path and must not appear. Do not add content; the app is data-driven.
- **Lesson.** `Lesson { id, title, pathId, tutorial: PreparedTutorial, objective, complexity, reference }`;
  `estimatedMinutes` = (Σ stroke durations × 3 + 8 s × steps) / 60, rounded up, shown as "About 4 min"; `stepCount`;
  `drawingBounds` = union of all stroke and fill paths + 6 % margin (the paper is fitted to this, not the full canvas).
- **Settings** (`@AppStorage`): `hasCompletedOnboarding` false · `currentPathId` "" · `narrationEnabled` true ·
  `defaultSpeed` 1.0 · `reduceMotionOverride` false · `leftHanded` false · `alsoSaveToPhotos` false · `reminderEnabled`
  false · `reminderDays` "12345" · `reminderTime` "07:30".
- **ProgressStore.** `LessonProgress { lessonId, pathId, completedAt: Date?, timesCompleted, lastStepIndex: Int?,
  lastOpenedAt: Date? }` as a JSON array at `Application Support/progress.json`, written atomically. API:
  `progress(for:)`, `isUnlocked(lesson, in: path)` (every earlier lesson in the path has `completedAt`),
  `nextLesson(in: path)`, `drawnCount(in: path)`, `markOpened(lessonId, step:)`, `markCompleted(lessonId, pathId:)`,
  `clearResume(lessonId)`, `resetAll()`. Sketchbook pages are never deleted by reset.
- **SketchbookStore.** `SketchbookPage { id, lessonId, pathId, completedAt, imageFile, note: String? }`, JSON index +
  JPEG (quality 0.85, longest side 2048) at `Application Support/Sketchbook/`. API: `pages` (newest first),
  `add(image:lessonId:pathId:)`, `update(note:)`, `delete(page)`, `image(for:)`. Included in device backups, never in
  Photos unless `alsoSaveToPhotos` (then also `PHPhotoLibrary` add, with the add-only usage string).
- **AppModel navigation.** `presentPlayer(lesson, resumeFrom: Int?)`, `dismissPlayer()`, `presentCompletion(lesson)`,
  `presentCapture(lesson)`, `select(path)`, plus the three `NavigationPath`s. The player, onboarding and capture are
  `fullScreenCover`s from `AppRoot`; sheets are `.sheet` with detents as each screen's notes say.

## Screen contracts (Phase 2; ids are the v3.html anchors)

- **Onboarding** `ob-splash ob-1 ob-2 ob-3 ob-who ob-level ob-path ob-voice ob-ready` (8-step progress rail,
  `ob-1`=1 … `ob-ready`=8): `OnboardingFlow(onFinished:)`; a thick green progress bar with a back chevron; Lina +
  speech bubble; `ob-who` collects name + avatar; `ob-level` and `ob-path` are single-choice rows/cards from the
  real catalog (first level, then first path in that level, preselected) — a level with exactly one shipped path
  (Advanced → Landscape today) skips `ob-path` and writes `currentPathId` directly; the voice beat writes
  `narrationEnabled`; the last beat shows the chosen path's first lesson drawing itself and its Start drawing → the
  lesson preview of that lesson. Writes `hasCompletedOnboarding`, `currentPathId`.
- **Home** `hp-home`: title + gold chip with the sketchbook count; the hero banner (Continue · <path> / Start here ·
  <path>; next lesson; "Lesson n of m · About k min"; the drawing on a white thumb; white-on-green "Start drawing");
  eyebrow "<Path> · n of m drawn" with "All paths"; the node path of the current path. Empty catalog: a plain card
  "No lessons are installed." `hp-paths`: cards per path with a drawing/icon tile, progress bar or "Not started",
  current path outlined green. `hp-path`: destination drawing large, description, progress, all nodes; tapping a locked
  node presents the locked sheet ("Finish <previous> first."); complete variant. `hp-preview`: reference and finished
  drawing side by side, title, "About k min · n steps", complexity dots, objective card, Lina line, Start drawing
  (or "Continue from step n" + "Start over" when a resume point exists).
- **Player** `pl-player pl-landscape pl-leave`: exactly the v3 anatomy (56 pt header: close, "Step n of m" over
  `StepSegments`, more menu with speed and restart; full-bleed white paper fitted to `drawingBounds`; narration chip
  top-left only when narration is enabled and an audio file exists (none ship yet, so it is hidden, but the component
  exists); reference thumb top-right 76 pt with an expand badge → `ReferenceSheet`; the bottom sheet with the
  instruction 24/heavy centred + one muted hint line, then back-step · replay · the wide primary). Primary is
  `.pending` while drawing (tappable: skips ahead), `.primary` when awaiting, reads "Finish" on the last step → completion.
  Before step 1: the orientation state (whole drawing ghosted at 20 %, the objective, "Begin"). Close → `LeaveSheet`
  (Keep drawing / Leave; Leave stores `lastStepIndex`). Speed applies from the next stroke and persists as the default.
  iPhone landscape: paper left full height, the sheet as a 312 pt right panel. Rotation is allowed on the player only.
  A wide drawing (`PageShape`: ink wider than 4:3, e.g. the car) has a second layout on its side, the *wide page*:
  the panel gone, a 64 pt bar (`PlayerWideBar`: close, ⋯, "Step n of m" as the way back to the words, narration
  chip · reference thumb 48 pt, back · replay · a 48 pt primary) along the bottom, and the ink over the whole paper
  (about 600 pt of car on an iPhone instead of 425). Which layout shows is the learner's own choice,
  `Settings.landscapeWidePage`: a tap on the paper switches and is remembered across lessons and launches, and
  nothing else — no step, no phase — switches it. Until they have chosen, the panel shows with one dismissable pill
  on the paper, "Tap the drawing for a bigger page". Held upright, the same drawing shows a pill at the bottom of
  the paper, "Turn sideways to draw it bigger", through the orientation beat and step one, gone once the phone has
  turned. Tall and square drawings change nothing.
- **Completion** `sk-complete`: the finished drawing on a white page with the gold "Drawn · date" chip, headline
  "Your <subject> is finished." (subject = lesson title lower-cased; a generic "Your drawing is finished." if awkward),
  one line from Lina with her face, two tiles (steps, minutes drawn), Add to sketchbook → capture; Next lesson;
  Not now. Path-done variant when it was the last lesson. `sk-capture`: primer (three promises) → camera
  (`UIImagePickerController` `.camera`, falls back to `PhotosPicker` in the simulator) → review (Retake / Keep, Crop &
  straighten may be a stub button) → saved (Next lesson / Open your sketchbook / Done). Camera and Photos usage strings
  in Info.plist, written per Apple's current guidance and cited in a code comment.
- **Sketchbook** `sk-book sk-entry`: two-column pages by month with the photo and lesson title + date; empty state;
  entry with the photo large, lesson/path/date, note field, Draw it again, Share (`ShareLink`), Delete with an alert.
- **Settings** `st-settings st-voice st-reminder`: grouped cards with tinted icon tiles exactly as v3; narration
  toggle, speed segmented control, the sample card; the reminder with day pills and a time (`UNUserNotificationCenter`,
  one calm notification, request permission only when the toggle is turned on); About & credits (photo credits from the
  catalog's `reference.source/license`), Privacy text, Reset progress with a confirmation (never touches the sketchbook).

## Quality bar
- Every screen matches v3.html at 393 × 852 within a few points; compare side by side in the simulator.
- Dynamic Type up to the accessibility sizes does not clip; Reduce Motion stops halos, waves and transitions.
- VoiceOver labels on every control; the canvas is one element describing the step.
- No warnings in the build; tests green; nothing crashes when the catalog is empty or a file is missing.
