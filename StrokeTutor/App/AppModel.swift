import Foundation
import Observation
import SwiftUI

/// The one object every screen reads: the content that shipped, the learner who is
/// drawing and their stores, and where the app currently is. Put in the
/// environment by `AppRoot` and taken with `@Environment(AppModel.self)`.
///
/// Content is joined once at launch — the catalog says which lessons exist and in
/// what order, the tutorials say how they are drawn — so a screen never has to
/// decide what a path contains. A lesson the catalog names but whose tutorial did
/// not ship simply is not in `paths`, and a tutorial no path names never reaches
/// a screen.
///
/// `progress`, `sketchbook` and `preferences` always belong to `activeProfile`.
/// They change only in `switchProfile(to:)`, which first saves and closes whatever
/// the previous learner had open.
@Observable
@MainActor
final class AppModel {

    // MARK: - Stores

    /// Device-wide preferences.
    let settings: Settings
    let profileStore: ProfileStore
    let pin: AppPIN
    let library: TutorialLibrary

    /// One learner's three stores, opened together from their folder.
    struct ProfileStores {
        let profileId: UUID
        let progress: ProgressStore
        let sketchbook: SketchbookStore
        let preferences: ProfilePreferences
    }

    private(set) var activeProfile: Profile
    private(set) var active: ProfileStores

    var progress: ProgressStore { active.progress }
    var sketchbook: SketchbookStore { active.sketchbook }
    var preferences: ProfilePreferences { active.preferences }

    /// Every store opened this session, by profile. Switching back to a learner reuses
    /// theirs rather than reading the files again, so a page still being saved into
    /// the old instance is never overwritten by a fresh one that missed it.
    private var openedStores: [UUID: ProfileStores] = [:]

    /// Set only when the migration could not commit: the old top-level files, run
    /// in place for this session under a profile that is not on disk. The
    /// migration tries again on the next launch.
    private(set) var temporaryProfile: Profile?
    private(set) var migrationOutcome: LegacyProfileMigration.Outcome

    /// The learners, oldest first.
    var profiles: [Profile] {
        (temporaryProfile.map { [$0] } ?? []) + profileStore.profiles
    }

    /// Saves the open lesson's place. The player sets it while it is on screen so a
    /// profile switch can save before closing it; cleared with the cover.
    @ObservationIgnored var sessionSaver: (() -> Void)?

    // MARK: - Content

    private(set) var catalog: Catalog = .empty
    /// The catalog's paths joined with their loaded lessons, in catalog order.
    private(set) var paths: [PathModel] = []
    /// Everything skipped while loading, for the log and for a debug screen.
    private(set) var contentWarnings: [String] = []
    private(set) var hasLoadedContent = false

    // MARK: - Navigation

    var selectedTab: MainTab = .learn
    /// One back stack per tab. Typed arrays rather than `NavigationPath`s so the
    /// screen on top can be read — `MainTabs` asks it whether the tab bar belongs
    /// under it.
    var learnPath: [AppRoute] = []
    var sketchbookPath: [AppRoute] = []
    var settingsPath: [AppRoute] = []
    /// The full-screen flow on top of the tabs, if any.
    var cover: AppCover? {
        didSet {
            if case .player = cover { return }
            sessionSaver = nil
        }
    }
    /// A locked lesson tapped on Home. `hp-home` sends a grey node to `hp-path`
    /// with the locked sheet already up; the path detail reads this on appear and
    /// clears it, so the sheet is raised once and never again on a later visit.
    var pendingLockedLessonId: String?

    private let bundle: Bundle

    init(bundle: Bundle = .main,
         settings: Settings? = nil,
         storeDirectory: URL? = nil) {
        let settings = settings ?? Settings()
        let base = storeDirectory ?? AppStorageLocation.applicationSupport()
        let profileStore = ProfileStore(baseDirectory: base)
        self.bundle = bundle
        self.settings = settings
        self.profileStore = profileStore
        pin = AppPIN(defaults: settings.defaults)
        library = TutorialLibrary()

        let outcome = LegacyProfileMigration.run(baseDirectory: base,
                                                 defaults: settings.defaults,
                                                 profiles: profileStore)
        migrationOutcome = outcome

        let profile: Profile
        let stores: ProfileStores
        if case .failed = outcome {
            profile = Profile(name: LegacyProfileMigration.migratedProfileName, avatar: .fox)
            stores = ProfileStores(profileId: profile.id,
                                   progress: ProgressStore(baseDirectory: base),
                                   sketchbook: SketchbookStore(baseDirectory: base),
                                   preferences: ProfilePreferences(values: .init(legacy: settings.defaults)))
            temporaryProfile = profile
        } else if let existing = profileStore.mostRecentlyUsed {
            profile = existing
            stores = Self.openStores(for: existing, in: profileStore)
        } else if let first = try? profileStore.create(name: "", avatar: .fox) {
            // A fresh install: one learner, unnamed until onboarding asks.
            profile = first
            stores = Self.openStores(for: first, in: profileStore)
        } else {
            // Nothing can be written at all. Run in memory rather than not at all.
            profile = Profile(name: "", avatar: .fox)
            let scratch = FileManager.default.temporaryDirectory
                .appendingPathComponent(profile.id.uuidString, isDirectory: true)
            stores = ProfileStores(profileId: profile.id,
                                   progress: ProgressStore(baseDirectory: scratch),
                                   sketchbook: SketchbookStore(baseDirectory: scratch),
                                   preferences: ProfilePreferences(directory: nil))
            temporaryProfile = profile
        }
        activeProfile = profile
        active = stores
        openedStores[profile.id] = stores
    }

    private static func openStores(for profile: Profile, in store: ProfileStore) -> ProfileStores {
        let folder = store.directory(for: profile.id)
        return ProfileStores(profileId: profile.id,
                             progress: ProgressStore(baseDirectory: folder),
                             sketchbook: SketchbookStore(baseDirectory: folder),
                             preferences: ProfilePreferences(directory: folder))
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
                             level: path.level,
                             lessons: lessons)
        }

        contentWarnings = warnings
        hasLoadedContent = true

        keepCurrentPathValid()
    }

    /// Keeps the learner's chosen path pointing at something that exists.
    private func keepCurrentPathValid() {
        guard hasLoadedContent,
              !paths.contains(where: { $0.id == preferences.currentPathId }),
              let first = paths.first(where: { !$0.isEmpty }) ?? paths.first else { return }
        preferences.currentPathId = first.id
    }

    // MARK: - Content lookups

    var isCatalogEmpty: Bool {
        paths.allSatisfy(\.isEmpty)
    }

    /// The path Home shows: the chosen one, or the first that shipped.
    var currentPath: PathModel? {
        paths.first { $0.id == preferences.currentPathId } ?? paths.first { !$0.isEmpty } ?? paths.first
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

    /// Chooses the path Home shows (`hp-paths`, and the onboarding beats `ob-level` and `ob-path`).
    func select(_ path: PathModel) {
        preferences.currentPathId = path.id
    }

    /// Makes a path the learner's current choice, then opens its detail screen.
    /// Keeping those actions together prevents Home and the path-card outline from
    /// lagging behind the detail screen the learner just chose.
    func open(_ path: PathModel) {
        select(path)
        push(.pathDetail(pathId: path.id))
    }

    /// Makes the lesson's path the current one, if it is not already. A lesson the
    /// catalog no longer names leaves the choice alone rather than pointing Home at
    /// a path that is not in `paths`.
    private func selectPath(ofLesson lesson: Lesson) {
        guard lesson.pathId != preferences.currentPathId,
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

    /// The screen on top of a tab's stack, or nil when the tab is at its root.
    func topRoute(of tab: MainTab) -> AppRoute? {
        switch tab {
        case .learn: return learnPath.last
        case .sketchbook: return sketchbookPath.last
        case .settings: return settingsPath.last
        }
    }

    func popToRoot(_ tab: MainTab? = nil) {
        switch tab ?? selectedTab {
        case .learn: learnPath = []
        case .sketchbook: sketchbookPath = []
        case .settings: settingsPath = []
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
    /// Starting a lesson also confirms its path as current. This keeps deep links,
    /// resumed lessons, and previews that proceed into the player aligned with the
    /// immediate path-card selection handled by `open(_:)`.
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

// MARK: - Profiles

extension AppModel {

    /// Whether a fresh launch should ask who is drawing. Only when there is more
    /// than one learner, and only at launch — coming back from the background keeps
    /// whoever was drawing.
    var shouldAskWhoIsDrawing: Bool {
        profiles.count > 1
    }

    func isTemporary(_ profile: Profile) -> Bool {
        profile.id == temporaryProfile?.id
    }

    /// The stores of whoever is drawing right now, for a flow that must keep
    /// writing to that learner even if the app switches under it.
    var activeStores: ProfileStores { active }

    /// Hands the app to another learner, in an order that cannot leak one learner's
    /// work into another's:
    ///
    /// 1. **Save** — the open lesson writes its step to the current learner's
    ///    progress.
    /// 2. **Close** — the player, completion, capture or picker cover goes away.
    /// 3. **Clear** — every tab's stack returns to its root, and Learn is shown.
    /// 4. **Replace** — only then do `progress`, `sketchbook` and `preferences`
    ///    point at the new learner.
    ///
    /// A photo still being written when this runs is unaffected: the capture flow
    /// holds the store it started with (`activeStores`), and that store is kept in
    /// `openedStores`, so the page lands in the right sketchbook and is there when
    /// the first learner comes back.
    func switchProfile(to id: UUID) {
        guard let target = profiles.first(where: { $0.id == id }) else { return }

        sessionSaver?()
        sessionSaver = nil

        cover = nil
        pendingLockedLessonId = nil

        learnPath = []
        sketchbookPath = []
        settingsPath = []
        selectedTab = .learn

        guard target.id != activeProfile.id else { return }
        let stores = openedStores[target.id] ?? Self.openStores(for: target, in: profileStore)
        openedStores[target.id] = stores
        active = stores
        activeProfile = target
        profileStore.markUsed(target.id)
        if let updated = profileStore.profile(id: target.id) { activeProfile = updated }
        keepCurrentPathValid()
    }

    /// A new learner, committed to disk before this returns. Nil if the folder could
    /// not be written.
    @discardableResult
    func addProfile(name: String, avatar: ProfileAvatar) -> Profile? {
        do {
            return try profileStore.create(name: name, avatar: avatar)
        } catch {
            return nil
        }
    }

    /// Name and picture only; neither needs the PIN.
    func updateProfile(_ id: UUID, name: String, avatar: ProfileAvatar) {
        guard var profile = profileStore.profile(id: id) else { return }
        profile.name = name
        profile.avatar = avatar
        profileStore.update(profile)
        if id == activeProfile.id, let updated = profileStore.profile(id: id) {
            activeProfile = updated
        }
    }

    /// Whether this learner can be deleted: never the last one, never the session-only
    /// fallback.
    func canDelete(_ profile: Profile) -> Bool {
        profiles.count > 1 && !isTemporary(profile)
    }

    /// Deletes a learner and everything they drew. The caller has already checked the
    /// PIN (or confirmed, when there is none). Deleting the learner who is
    /// drawing hands the app to whoever drew most recently first.
    func deleteProfile(_ id: UUID) throws {
        guard let profile = profiles.first(where: { $0.id == id }), canDelete(profile) else { return }
        if id == activeProfile.id {
            let next = profiles
                .filter { $0.id != id }
                .max { $0.lastUsedAt < $1.lastUsedAt }
            if let next { switchProfile(to: next.id) }
        }
        try profileStore.delete(id)
        openedStores[id] = nil
    }

    /// "Who's drawing?" — shown at launch when there is more than one learner.
    func presentProfilePicker() {
        cover = .profilePicker
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
                                 level: existing.level,
                                 lessons: existing.lessons + [lesson])
    }
}
#endif
