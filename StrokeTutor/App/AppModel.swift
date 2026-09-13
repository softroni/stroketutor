import Foundation
import Observation
import SwiftUI

/// The one object every screen reads: the content that shipped, the three stores,
/// and where the app currently is. Put in the environment by `AppRoot` and taken
/// with `@Environment(AppModel.self)`.
///
/// Content is joined once at launch — the catalog says which lessons exist and in
/// what order, the tutorials say how they are drawn — so a screen never has to
/// decide what a path contains. A lesson the catalog names but whose tutorial did
/// not ship simply is not in `paths`, and a tutorial no path names (today,
/// `cat-face`) never reaches a screen.
@Observable
@MainActor
final class AppModel {

    // MARK: - Stores

    let settings: Settings
    let progress: ProgressStore
    let sketchbook: SketchbookStore
    let library: TutorialLibrary

    // MARK: - Content

    private(set) var catalog: Catalog = .empty
    /// The catalog's paths joined with their loaded lessons, in catalog order.
    private(set) var paths: [PathModel] = []
    /// Everything skipped while loading, for the log and for a debug screen.
    private(set) var contentWarnings: [String] = []
    private(set) var hasLoadedContent = false

    // MARK: - Navigation

    var selectedTab: MainTab = .learn
    var learnPath = NavigationPath()
    var sketchbookPath = NavigationPath()
    var settingsPath = NavigationPath()
    /// The full-screen flow on top of the tabs, if any.
    var cover: AppCover?
    /// A locked lesson tapped on Home. `hp-home` sends a grey node to `hp-path`
    /// with the locked sheet already up; the path detail reads this on appear and
    /// clears it, so the sheet is raised once and never again on a later visit.
    var pendingLockedLessonId: String?

    private let bundle: Bundle

    init(bundle: Bundle = .main,
         settings: Settings? = nil,
         storeDirectory: URL? = nil) {
        self.bundle = bundle
        self.settings = settings ?? Settings()
        progress = ProgressStore(baseDirectory: storeDirectory)
        sketchbook = SketchbookStore(baseDirectory: storeDirectory)
        library = TutorialLibrary()
    }

    /// Reads the catalog and the tutorials and joins them. Safe to call again.
    func loadContent() {
        library.loadBundledTutorials(in: bundle)
        let result = CatalogLoader.load(from: bundle)
        catalog = result.catalog

        var warnings = result.warnings
        var byId: [String: PreparedTutorial] = [:]
        for tutorial in library.tutorials where tutorial.source == .bundled {
            byId[tutorial.tutorialID] = tutorial
        }

        paths = catalog.paths.map { path in
            var lessons: [Lesson] = []
            for id in path.lessonIds {
                guard let entry = catalog.lesson(id: id) else { continue }
                guard let tutorial = byId[id] else {
                    warnings.append("Lesson \"\(id)\" has no tutorial in the bundle; skipped.")
                    continue
                }
                lessons.append(Lesson(id: id,
                                      title: tutorial.title,
                                      pathId: path.id,
                                      tutorial: tutorial,
                                      objective: entry.objective,
                                      complexity: entry.complexity,
                                      reference: entry.reference))
            }
            return PathModel(id: path.id,
                             title: path.title,
                             description: path.description,
                             lessons: lessons)
        }

        contentWarnings = warnings
        hasLoadedContent = true

        // Keep the chosen path pointing at something that exists.
        if currentPath == nil, let first = paths.first {
            settings.currentPathId = first.id
        }
    }

    // MARK: - Content lookups

    var isCatalogEmpty: Bool {
        paths.allSatisfy(\.isEmpty)
    }

    /// The path Home shows: the chosen one, or the first that shipped.
    var currentPath: PathModel? {
        paths.first { $0.id == settings.currentPathId } ?? paths.first { !$0.isEmpty } ?? paths.first
    }

    func path(id: String) -> PathModel? {
        paths.first { $0.id == id }
    }

    func lesson(id: String) -> Lesson? {
        for path in paths {
            if let lesson = path.lesson(id: id) { return lesson }
        }
        return nil
    }

    func path(forLesson lessonId: String) -> PathModel? {
        paths.first { $0.lesson(id: lessonId) != nil }
    }

    /// The next lesson of the same path, for "Next lesson" on completion.
    func nextLesson(after lesson: Lesson) -> Lesson? {
        guard let path = path(id: lesson.pathId),
              let index = path.lessons.firstIndex(where: { $0.id == lesson.id }),
              path.lessons.indices.contains(index + 1) else { return nil }
        return path.lessons[index + 1]
    }

    /// The lesson Home's hero offers, and the one a node marks "Next".
    var nextLessonInCurrentPath: Lesson? {
        guard let path = currentPath else { return nil }
        return progress.nextLesson(in: path)
    }

    /// Chooses the path Home shows (`hp-paths`, and the onboarding beat `ob-path`).
    func select(_ path: PathModel) {
        settings.currentPathId = path.id
    }

    /// Makes the lesson's path the current one, if it is not already. A lesson the
    /// catalog no longer names leaves the choice alone rather than pointing Home at
    /// a path that is not in `paths`.
    private func selectPath(ofLesson lesson: Lesson) {
        guard lesson.pathId != settings.currentPathId,
              let lessonPath = path(id: lesson.pathId) else { return }
        select(lessonPath)
    }

    // MARK: - Pushed navigation

    /// Pushes a route onto the current tab's stack, so a back stack survives a tab
    /// switch.
    func push(_ route: AppRoute) {
        switch selectedTab {
        case .learn: learnPath.append(route)
        case .sketchbook: sketchbookPath.append(route)
        case .settings: settingsPath.append(route)
        }
    }

    func popToRoot(_ tab: MainTab? = nil) {
        switch tab ?? selectedTab {
        case .learn: learnPath = NavigationPath()
        case .sketchbook: sketchbookPath = NavigationPath()
        case .settings: settingsPath = NavigationPath()
        }
    }

    /// Opens a lesson's preview from anywhere in the Learn tab.
    func showPreview(of lesson: Lesson) {
        selectedTab = .learn
        push(.lessonPreview(lessonId: lesson.id))
    }

    // MARK: - Covers

    func presentOnboarding() {
        cover = .onboarding
    }

    /// Opens the player. `resumeFrom` starts on a saved step instead of step one.
    ///
    /// Starting a lesson is also what moves the learner to its path (`hp-paths`:
    /// opening a path card does *not* change `currentPathId`, drawing in it does),
    /// so Home and the green outline on the cards follow the pen instead of staying
    /// on whichever path onboarding chose.
    func presentPlayer(_ lesson: Lesson, resumeFrom: Int? = nil) {
        selectPath(ofLesson: lesson)
        progress.markOpened(lesson.id, pathId: lesson.pathId, step: resumeFrom)
        cover = .player(lessonId: lesson.id, resumeFrom: resumeFrom)
    }

    /// Leaves the player without finishing. The caller has already stored the step.
    func dismissPlayer() {
        if case .player = cover { cover = nil }
    }

    /// The lesson is finished: record it, then show `sk-complete`.
    func presentCompletion(_ lesson: Lesson) {
        progress.markCompleted(lesson.id, pathId: lesson.pathId)
        cover = .completion(lessonId: lesson.id)
    }

    /// "Add to sketchbook" — the capture flow.
    func presentCapture(_ lesson: Lesson) {
        cover = .capture(lessonId: lesson.id)
    }

    /// Closes whatever cover is up and goes back to the tabs.
    func dismissCover() {
        cover = nil
    }

    /// Onboarding is over: remember it and show Home.
    func finishOnboarding() {
        settings.hasCompletedOnboarding = true
        cover = nil
    }

    /// "Reset onboarding" on `st-settings`: forgets that onboarding was completed
    /// and shows the flow again from its first beat. The flow itself only rewrites
    /// the path and the voice when the learner answers those beats, and
    /// `finishOnboarding` sets the flag back when they reach the end, so nothing
    /// else stored is touched.
    func resetOnboarding() {
        settings.hasCompletedOnboarding = false
        presentOnboarding()
    }
}

#if DEBUG
extension AppModel {
    /// Screenshot-harness only (`DebugScreenHarness`): inserts a synthetic lesson
    /// after a path's shipped lessons. The bundled catalog carries exactly one
    /// lesson per path today, so nothing can ever actually be "locked" behind
    /// another lesson, or have a "next lesson" to offer after it finishes — both
    /// states `v3.html` shows and this app will grow into. This is the one place
    /// that fakes a second lesson so those two screens can still be reviewed;
    /// `paths` is rebuilt from the bundle on every launch, so nothing here is ever
    /// written to disk.
    func debugAppendLesson(_ lesson: Lesson, toPathId pathId: String) {
        guard let index = paths.firstIndex(where: { $0.id == pathId }) else { return }
        let existing = paths[index]
        paths[index] = PathModel(id: existing.id,
                                 title: existing.title,
                                 description: existing.description,
                                 lessons: existing.lessons + [lesson])
    }
}
#endif
