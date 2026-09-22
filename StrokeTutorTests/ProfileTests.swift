import UIKit
import XCTest
@testable import StrokeTutor

/// Profiles: each learner's data stays their own, the move from a pre-profiles install
/// survives being interrupted, and a switch never lets one learner's work land in
/// another's folder. Every test works in its own temporary directory and
/// `UserDefaults` suite.
@MainActor
final class ProfileTests: XCTestCase {

    private var base: URL!
    private var defaults: UserDefaults!

    override func setUp() {
        super.setUp()
        base = CatalogLoaderTests.temporaryDirectory()
        defaults = CatalogLoaderTests.scratchDefaults()
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: base)
        base = nil
        defaults = nil
        super.tearDown()
    }

    // MARK: - Isolation

    func testAFreshInstallStartsWithOneUnnamedLearner() {
        let model = makeModel()

        XCTAssertEqual(model.migrationOutcome, .notNeeded)
        XCTAssertEqual(model.profiles.count, 1)
        XCTAssertEqual(model.activeProfile.displayName, ProfileAvatar.fox.name,
                       "A blank name shows the picture's name.")
        XCTAssertFalse(model.shouldAskWhoIsDrawing, "One learner is never asked who is drawing.")
        XCTAssertNil(model.temporaryProfile)
    }

    func testEachLearnerKeepsTheirOwnProgressSketchbookAndPreferences() throws {
        let model = makeModel()
        let first = model.activeProfile
        let second = try XCTUnwrap(model.addProfile(name: "Maya", avatar: .owl))

        model.progress.markCompleted("palm-tree-4", pathId: "trees")
        _ = model.sketchbook.add(image: SketchbookStoreTests.image(), lessonId: "palm-tree-4", pathId: "trees")
        model.preferences.leftHanded = true

        model.switchProfile(to: second.id)

        XCTAssertEqual(model.activeProfile.id, second.id)
        XCTAssertFalse(model.progress.isCompleted("palm-tree-4"))
        XCTAssertTrue(model.sketchbook.isEmpty)
        XCTAssertFalse(model.preferences.leftHanded)
        model.preferences.reduceMotionOverride = true
        model.preferences.defaultSpeed = 2.0

        model.switchProfile(to: first.id)

        XCTAssertTrue(model.progress.isCompleted("palm-tree-4"))
        XCTAssertEqual(model.sketchbook.count, 1)
        XCTAssertTrue(model.preferences.leftHanded)
        XCTAssertFalse(model.preferences.reduceMotionOverride,
                       "Reduce motion belongs to the learner who turned it on.")
        XCTAssertEqual(model.preferences.defaultSpeed, 1.0)

        // And the same from disk, as the next launch reads it.
        let relaunched = makeModel()
        XCTAssertEqual(relaunched.profiles.map(\.id), [first.id, second.id])
        XCTAssertTrue(relaunched.shouldAskWhoIsDrawing)
        XCTAssertEqual(relaunched.activeProfile.id, first.id, "The learner who drew last opens.")
        relaunched.switchProfile(to: second.id)
        XCTAssertTrue(relaunched.preferences.reduceMotionOverride)
        XCTAssertEqual(relaunched.preferences.defaultSpeed, 2.0)
        XCTAssertTrue(relaunched.sketchbook.isEmpty)
    }

    func testAddingALearnerDoesNotChangeWhoTheNextLaunchOpens() throws {
        let model = makeModel()
        let first = model.activeProfile
        try XCTUnwrap(model.addProfile(name: "Maya", avatar: .owl))

        XCTAssertEqual(model.activeProfile.id, first.id)
        XCTAssertEqual(makeModel().activeProfile.id, first.id,
                       "A learner added from Settings has not drawn yet, so is not the one to open.")
    }

    func testDeletingALearnerRemovesOnlyTheirFolder() throws {
        let model = makeModel()
        let first = model.activeProfile
        let second = try XCTUnwrap(model.addProfile(name: "Sam", avatar: .frog))
        _ = model.sketchbook.add(image: SketchbookStoreTests.image(), lessonId: "l", pathId: "p")

        model.switchProfile(to: second.id)
        try model.deleteProfile(second.id)

        XCTAssertEqual(model.activeProfile.id, first.id, "Deleting who is drawing hands over first.")
        XCTAssertEqual(model.profiles.map(\.id), [first.id])
        XCTAssertFalse(FileManager.default.fileExists(atPath: model.profileStore.directory(for: second.id).path))
        XCTAssertEqual(model.sketchbook.count, 1)
    }

    func testTheLastLearnerCannotBeDeleted() throws {
        let model = makeModel()
        XCTAssertFalse(model.canDelete(model.activeProfile))
        try model.deleteProfile(model.activeProfile.id)
        XCTAssertEqual(model.profiles.count, 1)
    }

    func testRenamingKeepsTheLearnersWork() throws {
        let model = makeModel()
        model.progress.markCompleted("l", pathId: "p")

        model.updateProfile(model.activeProfile.id, name: "  A very long name for a small tile  ", avatar: .whale)

        XCTAssertEqual(model.activeProfile.name, "A very long name for")
        XCTAssertEqual(model.activeProfile.avatar, .whale)
        XCTAssertTrue(model.progress.isCompleted("l"))
        XCTAssertEqual(makeModel().activeProfile.avatar, .whale)
    }

    // MARK: - Migration

    func testALegacyInstallMovesIntoItsFirstProfile() throws {
        let page = try seedLegacyInstall()

        let model = makeModel()

        guard case let .migrated(id) = model.migrationOutcome else {
            return XCTFail("Expected a migration, got \(model.migrationOutcome)")
        }
        XCTAssertEqual(model.activeProfile.id, id)
        XCTAssertTrue(model.activeProfile.migratedFromLegacy)
        XCTAssertEqual(model.profiles.count, 1)

        XCTAssertTrue(model.progress.isCompleted("palm-tree-4"))
        XCTAssertEqual(model.progress.resumeStep(for: "classic-red-car"), 3)
        let migrated = try XCTUnwrap(model.sketchbook.page(id: page.id))
        XCTAssertEqual(migrated.note, "First try")
        XCTAssertNotNil(model.sketchbook.image(for: migrated), "The photo itself must come across.")

        XCTAssertEqual(model.preferences.currentPathId, "cars")
        XCTAssertFalse(model.preferences.narrationEnabled)
        XCTAssertEqual(model.preferences.defaultSpeed, 2.0)
        XCTAssertTrue(model.preferences.reduceMotionOverride)
        XCTAssertTrue(model.preferences.leftHanded)

        // The originals go only after the commit.
        XCTAssertFalse(FileManager.default.fileExists(atPath: base.appendingPathComponent("progress.json").path))
        XCTAssertFalse(FileManager.default.fileExists(atPath: base.appendingPathComponent("Sketchbook").path))
        for key in Settings.LegacyKey.all { XCTAssertNil(defaults.object(forKey: key), key) }
        XCTAssertTrue(model.settings.hasCompletedOnboarding, "Device settings stay where they were.")

        // A second launch does nothing more.
        let relaunched = makeModel()
        XCTAssertEqual(relaunched.migrationOutcome, .notNeeded)
        XCTAssertEqual(relaunched.profiles.count, 1)
    }

    func testAnInterruptedMigrationLeavesTheOriginalsAndCanBeRetried() throws {
        let page = try seedLegacyInstall()
        struct Killed: Error {}

        let store = ProfileStore(baseDirectory: base)
        let outcome = LegacyProfileMigration.run(baseDirectory: base, defaults: defaults, profiles: store,
                                                 beforeCommit: { throw Killed() })

        guard case .failed = outcome else { return XCTFail("Expected failure, got \(outcome)") }
        XCTAssertTrue(store.profiles.isEmpty, "Nothing is committed before the rename.")
        XCTAssertTrue(FileManager.default.fileExists(atPath: base.appendingPathComponent("progress.json").path))
        XCTAssertEqual(SketchbookStore(baseDirectory: base).count, 1)
        XCTAssertEqual(defaults.object(forKey: Settings.LegacyKey.leftHanded) as? Bool, true)

        // A kill leaves its staging folder behind; the next launch sweeps it.
        let leftover = store.rootDirectory.appendingPathComponent(".staging-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: leftover, withIntermediateDirectories: true)
        try Data("half".utf8).write(to: leftover.appendingPathComponent("progress.json"))

        let model = makeModel()

        guard case .migrated = model.migrationOutcome else {
            return XCTFail("Expected the retry to migrate, got \(model.migrationOutcome)")
        }
        XCTAssertFalse(FileManager.default.fileExists(atPath: leftover.path))
        XCTAssertEqual(model.profiles.count, 1)
        XCTAssertTrue(model.progress.isCompleted("palm-tree-4"))
        XCTAssertNotNil(model.sketchbook.page(id: page.id))
        XCTAssertTrue(model.preferences.leftHanded)
    }

    func testAnInterruptedCleanUpIsFinishedNotRepeated() throws {
        try seedLegacyInstall()
        let first = makeModel()
        XCTAssertEqual(first.profiles.count, 1)

        // Killed after the commit but before the originals were removed.
        ProgressStore(baseDirectory: base).markCompleted("stale", pathId: "p")
        defaults.set(true, forKey: Settings.LegacyKey.leftHanded)
        defaults.removeObject(forKey: LegacyProfileMigration.committedKey)

        let second = makeModel()

        XCTAssertEqual(second.migrationOutcome, .finishedCleanUp)
        XCTAssertEqual(second.profiles.count, 1, "The committed profile is not made twice.")
        XCTAssertFalse(second.progress.isCompleted("stale"))
        XCTAssertFalse(FileManager.default.fileExists(atPath: base.appendingPathComponent("progress.json").path))
        XCTAssertNil(defaults.object(forKey: Settings.LegacyKey.leftHanded))
    }

    func testAMigrationThatCannotWriteRunsOnTheOriginalsForTheSession() throws {
        try seedLegacyInstall()
        // A file where the Profiles folder should go: nothing can be staged.
        let blocker = base.appendingPathComponent(ProfileStore.folderName)
        try Data().write(to: blocker)

        let model = makeModel()

        guard case .failed = model.migrationOutcome else {
            return XCTFail("Expected failure, got \(model.migrationOutcome)")
        }
        XCTAssertNotNil(model.temporaryProfile)
        XCTAssertTrue(model.progress.isCompleted("palm-tree-4"), "The originals are in use this session.")
        XCTAssertEqual(model.sketchbook.count, 1)
        XCTAssertTrue(model.preferences.leftHanded)
        XCTAssertFalse(model.canDelete(model.activeProfile))

        try FileManager.default.removeItem(at: blocker)
        let next = makeModel()
        guard case .migrated = next.migrationOutcome else {
            return XCTFail("Expected the next launch to migrate, got \(next.migrationOutcome)")
        }
        XCTAssertTrue(next.progress.isCompleted("palm-tree-4"))
    }

    // MARK: - Switching

    func testSwitchingSavesTheOpenLessonClosesItAndClearsNavigation() throws {
        let model = makeModel(loadingContent: true)
        let first = model.activeProfile
        let second = try XCTUnwrap(model.addProfile(name: "Maya", avatar: .owl))
        let lesson = try XCTUnwrap(model.paths.first(where: { !$0.isEmpty })?.lessons.first)

        model.push(.paths)
        model.selectedTab = .sketchbook
        model.push(.about)
        model.presentPlayer(lesson)
        // What the player registers while it is on screen.
        var savedTo: UUID?
        let progressAtOpen = model.progress
        model.sessionSaver = {
            savedTo = model.activeProfile.id
            progressAtOpen.markOpened(lesson.id, pathId: lesson.pathId, step: 3)
        }

        model.switchProfile(to: second.id)

        XCTAssertEqual(savedTo, first.id, "The session is saved before the stores change.")
        XCTAssertNil(model.cover)
        XCTAssertNil(model.sessionSaver)
        XCTAssertTrue(model.learnPath.isEmpty)
        XCTAssertTrue(model.sketchbookPath.isEmpty)
        XCTAssertEqual(model.selectedTab, .learn)
        XCTAssertNil(model.progress.resumeStep(for: lesson.id))

        model.switchProfile(to: first.id)
        XCTAssertEqual(model.progress.resumeStep(for: lesson.id), 3)
    }

    func testAPageStillSavingWhenTheLearnerSwitchesStaysWithTheLearnerWhoTookIt() async throws {
        let model = makeModel()
        let first = model.activeProfile
        let second = try XCTUnwrap(model.addProfile(name: "Sam", avatar: .frog))
        let stores = model.activeStores

        let save = Task { @MainActor in
            await stores.sketchbook.addPage(image: SketchbookStoreTests.image(), lessonId: "l", pathId: "p")
        }
        model.switchProfile(to: second.id)
        let saved = await save.value
        let page = try XCTUnwrap(saved)

        XCTAssertTrue(model.sketchbook.isEmpty, "The new learner's sketchbook is untouched.")
        XCTAssertTrue(SketchbookStore(baseDirectory: model.profileStore.directory(for: second.id)).isEmpty)

        model.switchProfile(to: first.id)
        XCTAssertNotNil(model.sketchbook.page(id: page.id),
                        "Switching back reuses the store the page was saved into.")
        XCTAssertNotNil(SketchbookStore(baseDirectory: model.profileStore.directory(for: first.id)).page(id: page.id))
    }

    // MARK: - PIN

    func testThePINGuardsAndPausesAfterRepeatedGuesses() {
        let pin = AppPIN(defaults: defaults)
        XCTAssertFalse(pin.isSet)

        pin.set("12a4")
        XCTAssertFalse(pin.isSet, "Only four digits are accepted.")

        pin.set("2468")
        XCTAssertTrue(pin.isSet)
        XCTAssertNotEqual(defaults.string(forKey: AppPIN.Key.hash), "2468", "Only a hash is stored.")
        XCTAssertTrue(AppPIN(defaults: defaults).verify("2468"))

        let start = Date()
        for _ in 0..<AppPIN.attemptsBeforePause {
            XCTAssertFalse(pin.verify("0000", at: start))
        }
        XCTAssertTrue(pin.isPaused(at: start))
        XCTAssertFalse(pin.verify("2468", at: start), "A paused pad refuses even the right PIN.")
        XCTAssertTrue(pin.verify("2468", at: start.addingTimeInterval(AppPIN.pauseDuration + 1)))

        pin.remove()
        XCTAssertFalse(pin.isSet)
        XCTAssertFalse(AppPIN(defaults: defaults).isSet)
    }

    // MARK: - Helpers

    private func makeModel(loadingContent: Bool = false) -> AppModel {
        let model = AppModel(bundle: .appUnderTest,
                             settings: Settings(defaults: defaults),
                             storeDirectory: base)
        if loadingContent { model.loadContent() }
        return model
    }

    /// What a pre-profiles build left behind: files at the top of the folder and
    /// the per-learner keys in `UserDefaults`.
    @discardableResult
    private func seedLegacyInstall() throws -> SketchbookPage {
        let progress = ProgressStore(baseDirectory: base)
        progress.markCompleted("palm-tree-4", pathId: "trees")
        progress.markOpened("classic-red-car", pathId: "cars", step: 3)

        let sketchbook = SketchbookStore(baseDirectory: base)
        let page = try XCTUnwrap(sketchbook.add(image: SketchbookStoreTests.image(),
                                                lessonId: "palm-tree-4", pathId: "trees"))
        sketchbook.update(note: "First try", for: page.id)

        defaults.set(true, forKey: Settings.Key.hasCompletedOnboarding)
        defaults.set("cars", forKey: Settings.LegacyKey.currentPathId)
        defaults.set(false, forKey: Settings.LegacyKey.narrationEnabled)
        defaults.set(2.0, forKey: Settings.LegacyKey.defaultSpeed)
        defaults.set(true, forKey: Settings.LegacyKey.reduceMotionOverride)
        defaults.set(true, forKey: Settings.LegacyKey.leftHanded)
        return page
    }
}
