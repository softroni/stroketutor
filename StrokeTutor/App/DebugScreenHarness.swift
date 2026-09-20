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
    @MainActor
    static func applyIfRequested(to app: AppModel) {
        guard let name = UserDefaults.standard.string(forKey: "STScreen") else { return }

        // `progress.json`, the sketchbook and `UserDefaults` all outlive one
        // `simctl launch`, so every run starts by wiping them — otherwise one
        // screen's seeded progress would leak into the next screen's screenshot.
        app.progress.resetAll()
        for page in app.sketchbook.pages { app.sketchbook.delete(page) }
        app.settings.resetToDefaults()
        app.settings.hasCompletedOnboarding = true

        pendingPlayerHarnessState = nil
        pendingCaptureReviewImage = nil
        pendingCaptureSavedPage = nil
        raiseDeleteConfirmation = false

        // The screens below are captured with two of the shipped drawings: the palm
        // tree (upright) and the red car (wide). They are found by lesson id and not
        // by the path they sit in, so renaming a path in the catalog cannot empty
        // this file; a catalog that carries neither falls back to the first two
        // paths that shipped with anything at all.
        let shipped = app.paths.filter { !$0.isEmpty }
        guard let treeLesson = app.lesson(id: "palm-tree-4") ?? shipped.first?.lessons.first,
              let treePath = app.path(id: treeLesson.pathId)
        else {
            return // The catalog carries no lesson with a tutorial behind it.
        }
        let carLesson = app.lesson(id: "classic-red-car")
            ?? shipped.first { $0.id != treePath.id }?.lessons.first
            ?? treeLesson
        guard let carPath = app.path(id: carLesson.pathId) else { return }

        app.selectedTab = .learn
        app.popToRoot(.learn)
        app.popToRoot(.sketchbook)
        app.popToRoot(.settings)

        switch name {
        case "home-first":
            break // The clean, onboarded Home state left by the reset above.

        case "home-progress":
            app.progress.markOpened(treeLesson.id, pathId: treePath.id, step: midStep(of: treeLesson))
            addPlaceholderPage(to: app, lesson: treeLesson)

        case "paths":
            app.push(.paths)

        case "path-default":
            app.push(.pathDetail(pathId: treePath.id))

        case "path-locked":
            // See `AppModel.debugAppendLesson`: the catalog has one lesson per
            // path, so nothing is ever really locked. A synthetic second lesson
            // behind the real one is the only way to raise this sheet.
            let locked = harnessLesson(from: treeLesson, suffix: "harness-locked")
            app.debugAppendLesson(locked, toPathId: treePath.id)
            app.pendingLockedLessonId = locked.id
            app.push(.pathDetail(pathId: treePath.id))

        case "path-complete":
            app.progress.markCompleted(treeLesson.id, pathId: treePath.id)
            app.push(.pathDetail(pathId: treePath.id))

        case "preview-default":
            app.push(.lessonPreview(lessonId: treeLesson.id))

        case "preview-resume":
            app.progress.markOpened(treeLesson.id, pathId: treePath.id, step: midStep(of: treeLesson))
            app.push(.lessonPreview(lessonId: treeLesson.id))

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
            app.settings.narrationEnabled = false
            pendingPlayerHarnessState = PlayerHarnessState(stepIndex: midStep(of: treeLesson))
            app.cover = .player(lessonId: treeLesson.id, resumeFrom: nil)

        case "player-last":
            pendingPlayerHarnessState = PlayerHarnessState(stepIndex: max(0, treeLesson.stepCount - 1))
            app.cover = .player(lessonId: treeLesson.id, resumeFrom: nil)

        case "player-lefthanded":
            app.settings.leftHanded = true
            pendingPlayerHarnessState = PlayerHarnessState(stepIndex: midStep(of: treeLesson))
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

        case "capture-review":
            app.progress.markCompleted(treeLesson.id, pathId: treePath.id)
            pendingCaptureReviewImage = placeholderPhoto()
            app.cover = .capture(lessonId: treeLesson.id)

        case "capture-saved":
            app.progress.markCompleted(treeLesson.id, pathId: treePath.id)
            pendingCaptureSavedPage = app.sketchbook.add(image: placeholderPhoto(),
                                                         lessonId: treeLesson.id,
                                                         pathId: treePath.id)
            app.cover = .capture(lessonId: treeLesson.id)

        case "sketchbook-empty":
            app.selectedTab = .sketchbook

        case "sketchbook-filled":
            addPlaceholderPage(to: app, lesson: treeLesson)
            addPlaceholderPage(to: app, lesson: carLesson)
            app.selectedTab = .sketchbook

        case "entry":
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
            app.settings.narrationEnabled = true
            app.selectedTab = .settings
            app.push(.narrationSettings)

        case "narration-off":
            app.settings.narrationEnabled = false
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

        case "about":
            app.selectedTab = .settings
            app.push(.about)

        default:
            break // Unknown name: leave the clean, onboarded Home screen showing.
        }
    }

    // MARK: - State AppRoot and two views read when they build a debug cover

    /// Set by a `player-*` case above; `AppRoot` passes it to `PlayerScreen` as
    /// `harnessState` when it builds the `.player` cover. Nil on every normal
    /// launch, and cleared at the top of every `applyIfRequested`.
    static var pendingPlayerHarnessState: PlayerHarnessState?
    /// Set by `capture-review`; `AppRoot` passes it to `CaptureFlow`.
    static var pendingCaptureReviewImage: UIImage?
    /// Set by `capture-saved`; `AppRoot` passes it to `CaptureFlow`.
    static var pendingCaptureSavedPage: SketchbookPage?
    /// Set by `entry-delete`; `SketchbookEntryView` reads and clears this once, in
    /// its own `onAppear`, since its delete alert is behind private `@State`.
    static var raiseDeleteConfirmation = false

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

    @MainActor
    private static func addPlaceholderPage(to app: AppModel, lesson: Lesson) {
        _ = app.sketchbook.add(image: placeholderPhoto(), lessonId: lesson.id, pathId: lesson.pathId)
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
