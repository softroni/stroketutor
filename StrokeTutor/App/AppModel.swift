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
    func presentPlayer(_ lesson: Lesson, resumeFrom: Int? = nil) {
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
}
