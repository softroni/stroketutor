import XCTest
@testable import StrokeTutor

/// The catalog is what decides which lessons exist and in what order, so these
/// tests guard both the shipped files and the loader's leniency.
final class CatalogLoaderTests: XCTestCase {

    func testTheBundledCatalogLoads() {
        let result = CatalogLoader.load(from: .appUnderTest)
        XCTAssertFalse(result.catalog.paths.isEmpty, "No paths were loaded from the bundle.")
        XCTAssertFalse(result.catalog.lessons.isEmpty, "No lessons were loaded from the bundle.")

        for path in result.catalog.paths {
            for id in path.lessonIds {
                XCTAssertNotNil(result.catalog.lesson(id: id),
                                "Path \(path.id) names \(id), which is not in the catalog.")
            }
        }
    }

    func testEveryCatalogLessonHasABundledTutorial() {
        let catalog = CatalogLoader.load(from: .appUnderTest).catalog
        let tutorials = TutorialLoader.loadBundledTutorials(in: .appUnderTest).tutorials
        let ids = Set(tutorials.map(\.tutorialID))
        for lesson in catalog.lessons {
            XCTAssertTrue(ids.contains(lesson.id), "Lesson \(lesson.id) has no tutorial in the bundle.")
        }
    }

    func testOnlyApprovedLessonsReachLearners() {
        let catalog = CatalogLoader.load(from: .appUnderTest).catalog
        XCTAssertTrue(catalog.lessons.allSatisfy { $0.status == .approved })
    }

    /// `cat-face` is a sample tutorial that belongs to no path. It must not appear
    /// anywhere a learner can see, and the only thing stopping it is the data.
    @MainActor
    func testALessonInNoPathNeverReachesAScreen() {
        let model = AppModel(bundle: .appUnderTest,
                             settings: Settings(defaults: Self.scratchDefaults()),
                             storeDirectory: Self.temporaryDirectory())
        model.loadContent()
        let visible = Set(model.paths.flatMap(\.lessons).map(\.id))
        XCTAssertFalse(visible.contains("cat-face"),
                       "cat-face is in no path and must not be offered.")
        XCTAssertNil(model.lesson(id: "cat-face"))
    }

    @MainActor
    func testTheShippedPathsJoinTheirLessons() {
        let model = AppModel(bundle: .appUnderTest,
                             settings: Settings(defaults: Self.scratchDefaults()),
                             storeDirectory: Self.temporaryDirectory())
        model.loadContent()
        XCTAssertFalse(model.paths.isEmpty)
        for path in model.paths {
            for lesson in path.lessons {
                XCTAssertEqual(lesson.pathId, path.id)
                XCTAssertFalse(lesson.title.isEmpty)
                XCTAssertGreaterThan(lesson.stepCount, 0)
                XCTAssertGreaterThanOrEqual(lesson.estimatedMinutes, 1)
            }
        }
        XCTAssertNotNil(model.currentPath)
    }

    func testAMissingCatalogIsAWarningNotACrash() {
        // An empty bundle has no Catalog folder at all.
        let result = CatalogLoader.load(from: Bundle(for: CatalogLoaderTests.self))
        XCTAssertTrue(result.catalog.paths.isEmpty)
        XCTAssertFalse(result.warnings.isEmpty, "A missing catalog should say so.")
    }

    // MARK: - Helpers

    static func temporaryDirectory() -> URL {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("StrokeTutorTests-\(UUID().uuidString)", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    static func scratchDefaults() -> UserDefaults {
        UserDefaults(suiteName: "StrokeTutorTests-\(UUID().uuidString)") ?? .standard
    }
}
