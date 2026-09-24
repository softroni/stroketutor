import Foundation
import SwiftUI
import UIKit

#if DEBUG
/// A screenshot harness for the design review: launched with `-STScreen <name>`,
/// it clears the two stores that persist between launches, seeds exactly the
/// state one named screen needs, and navigates there — so `xcrun simctl`, which
/// cannot tap, can still capture every screen and variant in `v3.html`. See the
/// top of `AppRoot.swift` for how this is wired in and `PlayerScreen.harnessState`
/// / `CaptureFlow`'s debug initialiser for the two screens whose state lives in a
/// private `@State` this file cannot reach any other way.
///
/// Debug-only, and inert unless `-STScreen` is present on the launch arguments —
/// a normal launch, and a launch with only `-onboardingBeat`, never call into
/// this file. Onboarding beats are captured with that existing argument alone
/// (`OnboardingFlow.launchArgumentBeat`); `-STScreen` is never combined with it.
enum DebugScreenHarness {

    /// Reads `-STScreen <name>` and, if present, seeds and navigates. Called once
    /// by `AppRoot`, right after `loadContent()` and before the onboarding check
    /// — seeding always marks onboarding done, so a screenshot launch never lands
    /// on the onboarding cover instead of the requested screen.
    /// True on a screenshot launch, so `AppRoot` does not raise "Who's drawing?"
    /// over the screen that was asked for.
    static var isActive: Bool {
        UserDefaults.standard.string(forKey: "STScreen") != nil
    }

    @MainActor
    static func applyIfRequested(to app: AppModel) {
        guard let name = UserDefaults.standard.string(forKey: "STScreen") else { return }

        // `progress.json`, the sketchbook and `UserDefaults` all outlive one
        // `simctl launch`, so every run starts by wiping them — otherwise one
        // screen's seeded progress would leak into the next screen's screenshot.
        app.progress.resetAll()
        for page in app.sketchbook.pages { app.sketchbook.delete(page) }
        app.settings.resetToDefaults()
        app.preferences.resetToDefaults()
        app.settings.hasCompletedOnboarding = true

        pendingPlayerHarnessState = nil
        pendingCaptureReviewImage = nil
        pendingCaptureSavedPage = nil
        pendingCaptureOpensCornerEditor = false
        raiseDeleteConfirmation = false
        raiseProfileSwitcher = false
        raisePINCreate = false
        pendingLessonsJump = nil
        pendingLessonsSearch = nil
        app.pathsWelcomePending = false

        // The screens below are captured with two of the shipped drawings: the palm
        // tree (upright) and the red car (wide). They are found by lesson id and not
        // by the path they sit in, so renaming a path in the catalog cannot empty
        // this file; a catalog that carries neither falls back to the first two
        // paths that shipped with anything at all.
        let shipped = app.paths.filter { !$0.isEmpty }
        guard let treeLesson = app.lesson(id: "palm-tree") ?? shipped.first?.lessons.first,
              let treePath = app.path(id: treeLesson.pathId)
        else {
            return // The catalog carries no lesson with a tutorial behind it.
        }
        let carLesson = app.lesson(id: "fruit-bowl")
            ?? shipped.first { $0.id != treePath.id }?.lessons.first
            ?? treeLesson
        guard let carPath = app.path(id: carLesson.pathId) else { return }

        app.selectedTab = .home
        app.popToRoot(.home)
        app.popToRoot(.path)
        app.popToRoot(.sketchbook)
        app.popToRoot(.settings)

        switch name {
        case "home-first":
            break // The clean, onboarded Home state left by the reset above.

        case "home-progress":
            // A learner a few days in: two lessons drawn on the current path and
            // the third paused part-way, one lesson of another path drawn, and
            // their pages in the sketchbook.
            markFirst(2, of: treePath, in: app)
            if carPath.id != treePath.id { markFirst(1, of: carPath, in: app) }
            app.select(treePath)
            if let paused = app.progress.nextLesson(in: treePath) {
                app.progress.markOpened(paused.id, pathId: treePath.id, step: midStep(of: paused))
            }
            for lesson in treePath.lessons.prefix(2) + carPath.lessons.prefix(1) {
                addPlaceholderPage(to: app, lesson: lesson)
            }

        case "home-shelves":
            // Home a few weeks in: shelves at different places, so the row that
            // scrolls itself to its next lesson can be seen doing it.
            for (path, count) in zip(shipped, [4, 1, 0, 10]) {
                markFirst(count, of: path, in: app)
            }
            addPlaceholderPage(to: app, lesson: treeLesson)

        case "paths":
            // All paths is reached from the Path tab's title, so it is pushed there.
            // The current path is two lessons in and another is finished, so a
            // started card, a finished one and fresh ones can all be seen.
            markFirst(2, of: treePath, in: app)
            if carPath.id != treePath.id { markFirst(carPath.lessonCount, of: carPath, in: app) }
            app.open(treePath)
            app.push(.paths)

        case "paths-welcome":
            // A new learner's first rest after a lesson: All paths with its
            // one-time header and Lina's line, the tree's path current, as
            // `AppModel.leaveCompletion(for:)` leaves it.
            app.progress.markCompleted(treeLesson.id, pathId: treePath.id)
            app.select(treePath)
            app.pathsWelcomePending = true
            app.showAllPaths()

        case "lessons", "lessons-deep", "lessons-search":
            // The Lessons tab with the catalog in three states at once: the first
            // path finished (a gold chip), the second part-way, the rest untouched.
            // The deep variant jumps to the fourth path, so the chip band can be
            // seen holding its place with the list well past the top. The search
            // variant opens the search field with `-STLessonsSearch <words>` typed
            // in ("rokcet" when the argument is left out: a typo that still finds
            // the rocket; "dragon" shows the no-results card, "" the empty field).
            for (path, count) in zip(shipped, [shipped.first?.lessonCount ?? 0, 3]) {
                markFirst(count, of: path, in: app)
            }
            if name == "lessons-deep", shipped.count > 3 {
                pendingLessonsJump = shipped[3].id
            }
            if name == "lessons-search" {
                pendingLessonsSearch = UserDefaults.standard.string(forKey: "STLessonsSearch") ?? "rokcet"
            }
            app.popToRoot(.lessons)
            app.selectedTab = .lessons

        case "path-default":
            // Two lessons drawn, so done, current and locked nodes all show.
            markFirst(2, of: treePath, in: app)
            app.open(treePath)

        case "path-locked":
            // See `AppModel.debugAppendLesson`: the catalog has one lesson per
            // path, so nothing is ever really locked. A synthetic second lesson
            // behind the real one is the only way to raise this sheet.
            let locked = harnessLesson(from: treeLesson, suffix: "harness-locked")
            app.debugAppendLesson(locked, toPathId: treePath.id)
            markFirst(2, of: treePath, in: app)
            app.pendingLockedLessonId = locked.id
            app.open(treePath)

        case "path-complete":
            markFirst(treePath.lessonCount, of: treePath, in: app)
            app.open(treePath)

        case "preview-default":
            app.push(.lessonPreview(lessonId: treeLesson.id))

        case "preview-resume":
            app.progress.markOpened(treeLesson.id, pathId: treePath.id, step: midStep(of: treeLesson))
            app.push(.lessonPreview(lessonId: treeLesson.id))

        // A learner who knows the routine: three lessons drawn elsewhere, so "how a
        // lesson works" is gone and the picture takes its room.
        case "preview-returning":
            let others = shipped.filter { $0.id != treePath.id }
            for path in others.prefix(3) {
                if let first = path.lessons.first {
                    app.progress.markCompleted(first.id, pathId: path.id)
                }
            }
            app.push(.lessonPreview(lessonId: treeLesson.id))

        // The wide drawing, as a new learner sees it.
        case "preview-wide":
            app.push(.lessonPreview(lessonId: carLesson.id))

        case "player-orientation":
            app.cover = .player(lessonId: treeLesson.id, resumeFrom: nil)

        case "player-drawing":
            pendingPlayerHarnessState = PlayerHarnessState(stepIndex: 0, isDrawing: true)
            app.cover = .player(lessonId: treeLesson.id, resumeFrom: nil)

        case "player-awaiting":
            pendingPlayerHarnessState = PlayerHarnessState(stepIndex: midStep(of: treeLesson))
            app.cover = .player(lessonId: treeLesson.id, resumeFrom: nil)

        case "player-reference":
            pendingPlayerHarnessState = PlayerHarnessState(stepIndex: 0, showsReference: true)
            app.cover = .player(lessonId: treeLesson.id, resumeFrom: nil)

        case "player-muted":
            app.preferences.narrationEnabled = false
            pendingPlayerHarnessState = PlayerHarnessState(stepIndex: midStep(of: treeLesson))
            app.cover = .player(lessonId: treeLesson.id, resumeFrom: nil)

        case "player-last":
            pendingPlayerHarnessState = PlayerHarnessState(stepIndex: max(0, treeLesson.stepCount - 1))
            app.cover = .player(lessonId: treeLesson.id, resumeFrom: nil)

        case "leave-sheet":
            pendingPlayerHarnessState = PlayerHarnessState(stepIndex: midStep(of: treeLesson),
                                                           showsLeaveSheet: true)
            app.cover = .player(lessonId: treeLesson.id, resumeFrom: nil)

        // The car is the wide drawing. Captured on its side this is the wide page
        // (`PlayerWideBar`, the panel gone), the layout a learner chose by tapping
        // the paper; `player-nudge` captured on its side is the panel with the
        // "Tap the drawing" pill, and upright, step one with the "Turn sideways"
        // nudge at the bottom of the paper.
        case "player-wide":
            app.settings.landscapeWidePage = true
            pendingPlayerHarnessState = PlayerHarnessState(stepIndex: midStep(of: carLesson))
            app.cover = .player(lessonId: carLesson.id, resumeFrom: nil)

        case "player-nudge":
            pendingPlayerHarnessState = PlayerHarnessState(stepIndex: 0)
            app.cover = .player(lessonId: carLesson.id, resumeFrom: nil)

        case "completion-default":
            // Same reason as `path-locked`: with one lesson per path this lesson
            // is always the last one, so "Next lesson" never has anything to
            // offer without a synthetic lesson after it.
            let next = harnessLesson(from: treeLesson, suffix: "harness-next")
            app.debugAppendLesson(next, toPathId: treePath.id)
            app.progress.markCompleted(treeLesson.id, pathId: treePath.id)
            app.cover = .completion(lessonId: treeLesson.id)

        case "completion-pathdone":
            app.progress.markCompleted(carLesson.id, pathId: carPath.id)
            app.cover = .completion(lessonId: carLesson.id)

        case "capture-primer":
            app.progress.markCompleted(treeLesson.id, pathId: treePath.id)
            app.cover = .capture(lessonId: treeLesson.id)

        // A keystoned sheet on a desk, which auto-crop finds and straightens: the
        // review shows the straightened page and "Fix corners".
        case "capture-review":
            app.progress.markCompleted(treeLesson.id, pathId: treePath.id)
            pendingCaptureReviewImage = pagePhoto()
            app.cover = .capture(lessonId: treeLesson.id)

        // The bare desk: nothing to find, so the photo stays as taken and the
        // button reads "Crop".
        case "capture-review-nopage":
            app.progress.markCompleted(treeLesson.id, pathId: treePath.id)
            pendingCaptureReviewImage = pagePhoto(showsPage: false)
            app.cover = .capture(lessonId: treeLesson.id)

        // The corner editor over the same sheet, raised once auto-crop has
        // answered so its handles start on the detected corners.
        case "capture-corners":
            app.progress.markCompleted(treeLesson.id, pathId: treePath.id)
            pendingCaptureReviewImage = pagePhoto()
            pendingCaptureOpensCornerEditor = true
            app.cover = .capture(lessonId: treeLesson.id)

        case "capture-saved":
            app.progress.markCompleted(treeLesson.id, pathId: treePath.id)
            pendingCaptureSavedPage = app.sketchbook.add(image: placeholderPhoto(),
                                                         lessonId: treeLesson.id,
                                                         pathId: treePath.id)
            app.cover = .capture(lessonId: treeLesson.id)

        case "sketchbook-empty":
            app.selectedTab = .sketchbook

        // The album a learner has a few weeks in (see `seedAlbum`), shown by path —
        // the default — or, for `sketchbook-dates`, by month.
        case "sketchbook-filled":
            seedAlbum(in: app, current: treePath, other: carPath)
            UserDefaults.standard.set(SketchbookView.Arrangement.paths.rawValue,
                                      forKey: SketchbookView.arrangementKey)
            app.selectedTab = .sketchbook

        case "sketchbook-dates":
            seedAlbum(in: app, current: treePath, other: carPath)
            UserDefaults.standard.set(SketchbookView.Arrangement.dates.rawValue,
                                      forKey: SketchbookView.arrangementKey)
            app.selectedTab = .sketchbook

        case "entry":
            app.progress.markCompleted(treeLesson.id, pathId: treePath.id)
            addPlaceholderPage(to: app, lesson: treeLesson)
            app.selectedTab = .sketchbook
            if let page = app.sketchbook.pages.first {
                app.push(.sketchbookEntry(pageId: page.id))
            }

        case "entry-delete":
            addPlaceholderPage(to: app, lesson: treeLesson)
            app.selectedTab = .sketchbook
            if let page = app.sketchbook.pages.first {
                raiseDeleteConfirmation = true
                app.push(.sketchbookEntry(pageId: page.id))
            }

        case "settings":
            app.selectedTab = .settings

        case "narration-on":
            app.preferences.narrationEnabled = true
            app.selectedTab = .settings
            app.push(.narrationSettings)

        case "narration-off":
            app.preferences.narrationEnabled = false
            app.selectedTab = .settings
            app.push(.narrationSettings)

        case "reminder-off":
            app.settings.reminderEnabled = false
            app.selectedTab = .settings
            app.push(.reminderSettings)

        case "reminder-on":
            app.settings.reminderEnabled = true
            app.selectedTab = .settings
            app.push(.reminderSettings)

        case "profiles-picker":
            ensureSecondLearner(in: app)
            app.cover = .profilePicker

        case "profiles-switcher":
            ensureSecondLearner(in: app)
            raiseProfileSwitcher = true

        case "profiles-settings":
            ensureSecondLearner(in: app)
            app.selectedTab = .settings

        case "profile-detail":
            app.selectedTab = .settings
            app.push(.profile(id: app.activeProfile.id))

        case "pin":
            app.selectedTab = .settings
            raisePINCreate = true

        case "offer-more-coming":
            // The first step of the offer at the end of the first run: the first
            // lesson of a path drawn, the rest of it still ahead.
            app.progress.markCompleted(treeLesson.id, pathId: treePath.id)
            app.markFirstRunStarted(with: treeLesson)
            app.settings.firstRunStage = .offer
            app.cover = .offer(.onboarding)

        default:
            break // Unknown name: leave the clean, onboarded Home screen showing.
        }
    }

    // MARK: - State AppRoot and two views read when they build a debug cover

    /// Set by a `player-*` case above; `AppRoot` passes it to `PlayerScreen` as
    /// `harnessState` when it builds the `.player` cover. Nil on every normal
    /// launch, and cleared at the top of every `applyIfRequested`.
    static var pendingPlayerHarnessState: PlayerHarnessState?
    /// Set by the `capture-review*` and `capture-corners` cases; `AppRoot` passes
    /// it to `CaptureFlow`.
    static var pendingCaptureReviewImage: UIImage?
    /// Set by `capture-corners`; `AppRoot` passes it to `CaptureFlow`, which raises
    /// its corner editor once auto-crop has answered.
    static var pendingCaptureOpensCornerEditor = false
    /// Set by `capture-saved`; `AppRoot` passes it to `CaptureFlow`.
    static var pendingCaptureSavedPage: SketchbookPage?
    /// Set by `entry-delete`; `SketchbookEntryView` reads and clears this once, in
    /// its own `onAppear`, since its delete alert is behind private `@State`.
    static var raiseDeleteConfirmation = false
    /// Set by `profiles-switcher`; `HomeView` reads and clears it in `onAppear`.
    static var raiseProfileSwitcher = false
    /// Set by `pin`; `SettingsView` reads and clears it in `onAppear`.
    static var raisePINCreate = false
    /// Set by `lessons-deep`; `LessonsView` reads it just after appearing (not
    /// clearing it: the tab is rebuilt once the harness resets the learner) and
    /// jumps its list to that path, since where a scroll sits is its own `@State`.
    static var pendingLessonsJump: String?
    /// Set by `lessons-search`; `LessonsView` reads it the same way, opens its search field and types these words, since both are its own `@State`.
    static var pendingLessonsSearch: String?

    /// Profile screens need a second learner to show anything worth reviewing. Added
    /// once and left: profiles, unlike the stores above, are not wiped per run.
    @MainActor
    private static func ensureSecondLearner(in app: AppModel) {
        guard app.profiles.count < 2 else { return }
        app.addProfile(name: "Maya", avatar: .owl)
    }

    // MARK: - Helpers

    /// A step past the first and before the last, so "paused" and "awaiting"
    /// screenshots never coincide with the orientation beat or the last-step
    /// "Finish" state.
    private static func midStep(of lesson: Lesson) -> Int {
        max(0, min(lesson.stepCount - 1, lesson.stepCount / 2))
    }

    /// A copy of a shipped lesson under a different id, for the two screens that
    /// need a lesson the catalog does not actually have. Reuses the real
    /// tutorial, objective and reference rather than inventing content.
    private static func harnessLesson(from lesson: Lesson, suffix: String) -> Lesson {
        Lesson(id: "\(lesson.id)-\(suffix)",
              title: lesson.title,
              pathId: lesson.pathId,
              tutorial: lesson.tutorial,
              objective: lesson.objective,
              complexity: lesson.complexity,
              reference: lesson.reference)
    }

    /// Marks a path's first `count` lessons drawn, a day apart and oldest first, as
    /// a learner would have drawn them.
    @MainActor
    private static func markFirst(_ count: Int, of path: PathModel, in app: AppModel) {
        let lessons = path.lessons.prefix(count)
        for (offset, lesson) in lessons.enumerated() {
            let daysAgo = Double(lessons.count - offset)
            app.progress.markCompleted(lesson.id, pathId: path.id,
                                       at: Date().addingTimeInterval(-daysAgo * 86_400))
        }
    }

    /// A page for `lesson`, photographed `daysAgo` days ago: a stand-in photo of
    /// that lesson's own drawing (`lessonPhoto(of:)`), so a "Fruit Bowl" page shows a
    /// fruit bowl.
    @MainActor
    private static func addPlaceholderPage(to app: AppModel, lesson: Lesson, daysAgo: Double = 0) {
        _ = app.sketchbook.add(image: lessonPhoto(of: lesson),
                               lessonId: lesson.id,
                               pathId: lesson.pathId,
                               completedAt: Date().addingTimeInterval(-daysAgo * 86_400))
    }

    /// A sketchbook a few weeks in: the current path four lessons along, three of
    /// them photographed and one finished without a photo (its slot shows the gold
    /// check), and two pages from another path drawn about a month ago, so the
    /// album has two bands and the date view two months. The current path is made
    /// current without leaving the Sketchbook tab.
    @MainActor
    private static func seedAlbum(in app: AppModel, current: PathModel, other: PathModel) {
        app.select(current)
        let recent = Array(current.lessons.prefix(4))
        for (offset, lesson) in recent.enumerated() {
            let daysAgo = Double(8 - offset * 2)
            app.progress.markCompleted(lesson.id, pathId: current.id,
                                       at: Date().addingTimeInterval(-daysAgo * 86_400))
            if offset != 2 {
                addPlaceholderPage(to: app, lesson: lesson, daysAgo: daysAgo)
            }
        }
        guard other.id != current.id else { return }
        for (offset, lesson) in other.lessons.prefix(2).enumerated() {
            let daysAgo = Double(30 - offset * 2)
            app.progress.markCompleted(lesson.id, pathId: other.id,
                                       at: Date().addingTimeInterval(-daysAgo * 86_400))
            addPlaceholderPage(to: app, lesson: lesson, daysAgo: daysAgo)
        }
    }

    /// A stand-in for a photo of a learner's page: the lesson's own strokes in
    /// pencil gray, a touch heavier than the lesson draws them and a little off
    /// true (turned, shifted, each line doubled by a faint second pass), on warm
    /// off-white paper with light from the top left and a soft vignette. Seeded by
    /// the lesson id, so the same lesson always comes out the same.
    static func lessonPhoto(of lesson: Lesson, size: CGSize = CGSize(width: 1200, height: 1600)) -> UIImage {
        var random = SeededRandom(seed: lesson.id)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            let cg = context.cgContext
            let space = CGColorSpaceCreateDeviceRGB()

            // Paper, lit from the top left.
            let paper = [UIColor(red: 0.98, green: 0.965, blue: 0.93, alpha: 1).cgColor,
                         UIColor(red: 0.93, green: 0.905, blue: 0.85, alpha: 1).cgColor]
            if let gradient = CGGradient(colorsSpace: space, colors: paper as CFArray, locations: [0, 1]) {
                cg.drawLinearGradient(gradient, start: .zero,
                                      end: CGPoint(x: size.width, y: size.height), options: [])
            }

            // The drawing, fitted inside a margin and set a little askew.
            let tutorial = lesson.tutorial
            let bounds = tutorial.drawingBounds
            if bounds.width > 0, bounds.height > 0 {
                let box = CGRect(origin: .zero, size: size).insetBy(dx: size.width * 0.14, dy: size.height * 0.16)
                let scale = min(box.width / bounds.width, box.height / bounds.height)
                let angle = random.next(in: -2.2...2.2) * .pi / 180
                let shift = CGPoint(x: random.next(in: -0.02...0.02) * size.width,
                                    y: random.next(in: -0.02...0.02) * size.height)
                let center = CGPoint(x: size.width / 2 + shift.x, y: size.height / 2 + shift.y)
                let transform = CGAffineTransform(translationX: -bounds.midX, y: -bounds.midY)
                    .concatenating(CGAffineTransform(scaleX: scale, y: scale))
                    .concatenating(CGAffineTransform(rotationAngle: angle))
                    .concatenating(CGAffineTransform(translationX: center.x, y: center.y))

                cg.setLineCap(.round)
                cg.setLineJoin(.round)
                for step in tutorial.steps {
                    for stroke in step.strokes {
                        let width = min(max(CGFloat(stroke.lineWidth) * scale * 0.8, 5), 14)
                        var path = stroke.path.cgPath.copy(using: [transform]) ?? stroke.path.cgPath
                        // The firm line.
                        cg.addPath(path)
                        cg.setStrokeColor(UIColor(red: 0.29, green: 0.29, blue: 0.32, alpha: 0.86).cgColor)
                        cg.setLineWidth(width)
                        cg.strokePath()
                        // A lighter second pass, a hair off the first.
                        var nudge = CGAffineTransform(translationX: random.next(in: -3...3),
                                                      y: random.next(in: -3...3))
                        path = path.copy(using: &nudge) ?? path
                        cg.addPath(path)
                        cg.setStrokeColor(UIColor(red: 0.36, green: 0.36, blue: 0.39, alpha: 0.28).cgColor)
                        cg.setLineWidth(width * 0.6)
                        cg.strokePath()
                    }
                }
            }

            // The vignette a phone camera leaves at the corners of a close shot.
            let vignette = [UIColor(white: 0, alpha: 0).cgColor,
                            UIColor(white: 0, alpha: 0.05).cgColor,
                            UIColor(red: 0.2, green: 0.14, blue: 0.06, alpha: 0.22).cgColor]
            if let gradient = CGGradient(colorsSpace: space, colors: vignette as CFArray, locations: [0, 0.6, 1]) {
                let center = CGPoint(x: size.width * 0.46, y: size.height * 0.44)
                cg.drawRadialGradient(gradient,
                                      startCenter: center, startRadius: 0,
                                      endCenter: center, endRadius: hypot(size.width, size.height) * 0.56,
                                      options: [.drawsAfterEndLocation])
            }
        }
    }

    /// A small deterministic generator (SplitMix64), so a seeded photo is the same
    /// on every run.
    private struct SeededRandom {
        private var state: UInt64

        init(seed: String) {
            state = seed.utf8.reduce(0xcbf2_9ce4_8422_2325) { ($0 ^ UInt64($1)) &* 0x100_0000_01b3 }
        }

        mutating func next(in range: ClosedRange<CGFloat>) -> CGFloat {
            state &+= 0x9e37_79b9_7f4a_7c15
            var z = state
            z = (z ^ (z >> 30)) &* 0xbf58_476d_1ce4_e5b9
            z = (z ^ (z >> 27)) &* 0x94d0_49bb_1331_11eb
            z ^= z >> 31
            let unit = CGFloat(z >> 11) / CGFloat(1 << 53)
            return range.lowerBound + (range.upperBound - range.lowerBound) * unit
        }
    }

    /// A photo-shaped stand-in for a photographed page — a paper-coloured
    /// gradient with a simple palm doodle — rendered at runtime so the harness
    /// ships no bundled asset of its own (plan: "seed a JPEG through
    /// `SketchbookStore.add` from an image you render at runtime").
    static func placeholderPhoto(size: CGSize = CGSize(width: 1200, height: 1600)) -> UIImage {
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { context in
            let cg = context.cgContext
            let colors = [UIColor(red: 0.96, green: 0.94, blue: 0.88, alpha: 1).cgColor,
                          UIColor(red: 0.87, green: 0.82, blue: 0.68, alpha: 1).cgColor]
            if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                                        colors: colors as CFArray,
                                        locations: [0, 1]) {
                cg.drawLinearGradient(gradient, start: .zero,
                                      end: CGPoint(x: size.width, y: size.height), options: [])
            }

            let trunk = UIBezierPath()
            trunk.lineWidth = size.width * 0.02
            trunk.move(to: CGPoint(x: size.width * 0.5, y: size.height * 0.9))
            trunk.addLine(to: CGPoint(x: size.width * 0.5, y: size.height * 0.45))
            UIColor(red: 0.25, green: 0.16, blue: 0.08, alpha: 1).setStroke()
            trunk.stroke()

            UIColor(red: 0.13, green: 0.35, blue: 0.16, alpha: 1).setStroke()
            for angleDegrees in stride(from: -60.0, through: 60.0, by: 30.0) {
                let radians = angleDegrees * .pi / 180
                let start = CGPoint(x: size.width * 0.5, y: size.height * 0.45)
                let end = CGPoint(x: start.x + sin(radians) * size.width * 0.3,
                                  y: start.y - cos(radians) * size.height * 0.22)
                let frond = UIBezierPath()
                frond.lineWidth = size.width * 0.015
                frond.move(to: start)
                frond.addLine(to: end)
                frond.stroke()
            }
        }
    }

    // MARK: - A photographed sheet, for auto-crop

    /// Where the sheet sits in `pagePhoto()`, in the upright photo's normalized,
    /// top-left space: narrower at the top (the phone tilted back) and turned a
    /// little clockwise, as a hand-held shot of a page on a desk comes out.
    /// Detection should find these; the unit tests hold it to that.
    static let pagePhotoCorners = PageCorners(topLeft: CGPoint(x: 0.19, y: 0.15),
                                              topRight: CGPoint(x: 0.80, y: 0.12),
                                              bottomRight: CGPoint(x: 0.89, y: 0.87),
                                              bottomLeft: CGPoint(x: 0.09, y: 0.89))

    /// A stand-in for a real camera shot of a finished page: an off-white sheet
    /// with pencil lines, keystoned on a dark wood desk. It comes out the way the
    /// camera delivers a portrait photo, a landscape sensor buffer tagged `.right`,
    /// so the harness exercises the orientation fix as well as detection.
    /// `showsPage: false` is the bare desk, for the "nothing detected" state.
    static func pagePhoto(size: CGSize = CGSize(width: 1200, height: 1600),
                          showsPage: Bool = true) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let upright = UIGraphicsImageRenderer(size: size, format: format).image { context in
            let cg = context.cgContext
            drawDesk(in: cg, size: size)
            guard showsPage else { return }

            let corners = pagePhotoCorners.points.map { CGPoint(x: $0.x * size.width, y: $0.y * size.height) }
            let sheet = UIBezierPath()
            sheet.move(to: corners[0])
            corners.dropFirst().forEach { sheet.addLine(to: $0) }
            sheet.close()

            // A soft shadow lifts the sheet off the desk, as in a real photo.
            cg.saveGState()
            cg.setShadow(offset: CGSize(width: 0, height: size.height * 0.008),
                         blur: size.width * 0.03,
                         color: UIColor.black.withAlphaComponent(0.55).cgColor)
            UIColor(red: 0.95, green: 0.93, blue: 0.88, alpha: 1).setFill()
            sheet.fill()
            cg.restoreGState()

            // Light falling from the top left across the paper.
            cg.saveGState()
            sheet.addClip()
            let light = [UIColor(red: 0.97, green: 0.96, blue: 0.92, alpha: 1).cgColor,
                         UIColor(red: 0.88, green: 0.86, blue: 0.80, alpha: 1).cgColor]
            if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                                        colors: light as CFArray, locations: [0, 1]) {
                cg.drawLinearGradient(gradient, start: corners[0], end: corners[2], options: [])
            }

            // Pencil: a horizon, a palm and a sun, laid onto the sheet through its
            // corners so they are keystoned with it.
            func onSheet(_ u: CGFloat, _ v: CGFloat) -> CGPoint {
                let top = CGPoint(x: corners[0].x + (corners[1].x - corners[0].x) * u,
                                  y: corners[0].y + (corners[1].y - corners[0].y) * u)
                let bottom = CGPoint(x: corners[3].x + (corners[2].x - corners[3].x) * u,
                                     y: corners[3].y + (corners[2].y - corners[3].y) * u)
                return CGPoint(x: top.x + (bottom.x - top.x) * v, y: top.y + (bottom.y - top.y) * v)
            }
            func pencil(_ points: [(CGFloat, CGFloat)], width: CGFloat = 0.006) {
                let line = UIBezierPath()
                line.lineWidth = size.width * width
                line.lineCapStyle = .round
                line.lineJoinStyle = .round
                line.move(to: onSheet(points[0].0, points[0].1))
                points.dropFirst().forEach { line.addLine(to: onSheet($0.0, $0.1)) }
                line.stroke()
            }
            UIColor(red: 0.30, green: 0.30, blue: 0.33, alpha: 0.85).setStroke()
            pencil([(0.08, 0.78), (0.35, 0.76), (0.62, 0.79), (0.92, 0.77)])
            pencil([(0.50, 0.77), (0.49, 0.62), (0.47, 0.48), (0.46, 0.36)], width: 0.009)
            for frond in [[(0.46, 0.36), (0.34, 0.33), (0.22, 0.40)],
                          [(0.46, 0.36), (0.40, 0.25), (0.30, 0.20)],
                          [(0.46, 0.36), (0.55, 0.24), (0.66, 0.22)],
                          [(0.46, 0.36), (0.60, 0.33), (0.72, 0.42)]] as [[(CGFloat, CGFloat)]] {
                pencil(frond)
            }
            var sun: [(CGFloat, CGFloat)] = []
            for step in 0...24 {
                let angle = CGFloat(step) / 24 * 2 * .pi
                sun.append((0.78 + cos(angle) * 0.08, 0.16 + sin(angle) * 0.06))
            }
            pencil(sun)
            cg.restoreGState()
        }
        return sensorOriented(upright)
    }

    /// Dark wood: a warm brown with long, slightly wavy grain lines.
    private static func drawDesk(in cg: CGContext, size: CGSize) {
        UIColor(red: 0.30, green: 0.19, blue: 0.11, alpha: 1).setFill()
        cg.fill(CGRect(origin: .zero, size: size))
        for line in 0..<90 {
            let y = CGFloat(line) / 90 * size.height
            let tone = 0.5 + 0.5 * sin(CGFloat(line) * 2.3)
            UIColor(red: 0.22 + 0.14 * tone, green: 0.13 + 0.09 * tone, blue: 0.07 + 0.05 * tone,
                    alpha: 0.6).setStroke()
            let grain = UIBezierPath()
            grain.lineWidth = size.height * (0.002 + 0.004 * tone)
            grain.move(to: CGPoint(x: 0, y: y))
            for step in 1...12 {
                let x = CGFloat(step) / 12 * size.width
                grain.addLine(to: CGPoint(x: x, y: y + sin(CGFloat(step) * 0.9 + CGFloat(line)) * size.height * 0.006))
            }
            grain.stroke()
        }
    }

    /// The same picture stored the way the camera stores a portrait shot: the
    /// pixels a quarter turn counter-clockwise, tagged `.right` so it still draws
    /// upright.
    static func sensorOriented(_ upright: UIImage) -> UIImage {
        guard let cgImage = upright.cgImage else { return upright }
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let sideways = UIImage(cgImage: cgImage, scale: 1, orientation: .left)
        let buffer = UIGraphicsImageRenderer(size: sideways.size, format: format).image { _ in
            sideways.draw(at: .zero)
        }
        guard let sensor = buffer.cgImage else { return upright }
        return UIImage(cgImage: sensor, scale: 1, orientation: .right)
    }
}

/// Screenshot-harness only (see `DebugScreenHarness` above): forces `PlayerScreen`
/// into one exact step and phase, and optionally raises the leave or reference
/// sheet, instead of the state a tap sequence would normally produce. Read once,
/// in `PlayerScreen.appear()`, from the `harnessState` the debug initialiser
/// stores.
struct PlayerHarnessState {
    var stepIndex: Int = 0
    /// True leaves the step mid-stroke, at a slowed-down speed, instead of
    /// letting it settle into `.awaitingUser`.
    var isDrawing: Bool = false
    var showsReference: Bool = false
    var showsLeaveSheet: Bool = false
}
#endif
