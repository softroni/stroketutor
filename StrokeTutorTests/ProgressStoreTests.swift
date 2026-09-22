import XCTest
@testable import StrokeTutor

/// The unlock rule and the JSON round-trip. Every store here is pointed at a
/// temporary directory, so a test never touches the simulator's real data.
@MainActor
final class ProgressStoreTests: XCTestCase {

    private var directory: URL!

    override func setUp() {
        super.setUp()
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("ProgressStoreTests-\(UUID().uuidString)", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: directory)
        directory = nil
        super.tearDown()
    }

    // MARK: - Unlock rules

    func testTheFirstLessonIsUnlockedAndTheRestAreNot() throws {
        let path = try Self.makePath(lessonCount: 3)
        let store = ProgressStore(baseDirectory: directory)

        XCTAssertTrue(store.isUnlocked(path.lessons[0], in: path))
        XCTAssertFalse(store.isUnlocked(path.lessons[1], in: path))
        XCTAssertFalse(store.isUnlocked(path.lessons[2], in: path))
    }

    func testCompletingALessonUnlocksTheNextOneOnly() throws {
        let path = try Self.makePath(lessonCount: 3)
        let store = ProgressStore(baseDirectory: directory)

        store.markCompleted(path.lessons[0].id, pathId: path.id)

        XCTAssertTrue(store.isUnlocked(path.lessons[1], in: path))
        XCTAssertFalse(store.isUnlocked(path.lessons[2], in: path))
        XCTAssertEqual(store.drawnCount(in: path), 1)
        XCTAssertEqual(store.nextLesson(in: path)?.id, path.lessons[1].id)
    }

    func testAPathDrawnToTheEndOffersNoNextLesson() throws {
        let path = try Self.makePath(lessonCount: 2)
        let store = ProgressStore(baseDirectory: directory)
        for lesson in path.lessons { store.markCompleted(lesson.id, pathId: path.id) }

        XCTAssertNil(store.nextLesson(in: path))
        XCTAssertEqual(store.drawnCount(in: path), 2)
    }

    func testCompletingTwiceKeepsTheFirstDateAndCountsBoth() throws {
        let path = try Self.makePath(lessonCount: 1)
        let store = ProgressStore(baseDirectory: directory)
        let first = Date(timeIntervalSince1970: 1_000_000)

        store.markCompleted(path.lessons[0].id, pathId: path.id, at: first)
        store.markCompleted(path.lessons[0].id, pathId: path.id, at: first.addingTimeInterval(86_400))

        let record = try XCTUnwrap(store.progress(for: path.lessons[0].id))
        XCTAssertEqual(record.completedAt, first)
        XCTAssertEqual(record.timesCompleted, 2)
    }

    /// `hp-preview` shows "how a lesson works" until three lessons are drawn, so the
    /// count spans every path, counts a lesson once however often it is redrawn, and
    /// ignores a lesson that was only opened.
    func testCompletedCountSpansPathsAndCountsEachLessonOnce() throws {
        let trees = try Self.makePath(lessonCount: 2)
        let store = ProgressStore(baseDirectory: directory)
        XCTAssertEqual(store.completedCount, 0)

        store.markCompleted(trees.lessons[0].id, pathId: trees.id)
        store.markCompleted(trees.lessons[0].id, pathId: trees.id)
        store.markCompleted("elsewhere", pathId: "another-path")
        store.markOpened(trees.lessons[1].id, pathId: trees.id, step: 2)

        XCTAssertEqual(store.completedCount, 2)
    }

    // MARK: - Resume

    func testLeavingALessonStoresTheStepAndFinishingClearsIt() throws {
        let path = try Self.makePath(lessonCount: 1)
        let store = ProgressStore(baseDirectory: directory)
        let lesson = path.lessons[0]

        store.markOpened(lesson.id, pathId: path.id, step: 3)
        XCTAssertEqual(store.resumeStep(for: lesson.id), 3)

        store.markCompleted(lesson.id, pathId: path.id)
        XCTAssertNil(store.resumeStep(for: lesson.id))
    }

    func testClearResumeKeepsTheCompletion() throws {
        let path = try Self.makePath(lessonCount: 1)
        let store = ProgressStore(baseDirectory: directory)
        let lesson = path.lessons[0]

        store.markCompleted(lesson.id, pathId: path.id)
        store.markOpened(lesson.id, pathId: path.id, step: 2)
        store.clearResume(lesson.id)

        XCTAssertNil(store.resumeStep(for: lesson.id))
        XCTAssertTrue(store.isCompleted(lesson.id))
    }

    // MARK: - Persistence

    func testProgressSurvivesAReload() throws {
        let path = try Self.makePath(lessonCount: 2)
        let store = ProgressStore(baseDirectory: directory)
        store.markCompleted(path.lessons[0].id, pathId: path.id)
        store.markOpened(path.lessons[1].id, pathId: path.id, step: 1)

        let reloaded = ProgressStore(baseDirectory: directory)
        XCTAssertTrue(reloaded.isCompleted(path.lessons[0].id))
        XCTAssertEqual(reloaded.resumeStep(for: path.lessons[1].id), 1)
        XCTAssertTrue(FileManager.default.fileExists(atPath: directory.appendingPathComponent("progress.json").path))
    }

    func testResetClearsEverything() throws {
        let path = try Self.makePath(lessonCount: 2)
        let store = ProgressStore(baseDirectory: directory)
        store.markCompleted(path.lessons[0].id, pathId: path.id)

        store.resetAll()

        XCTAssertTrue(store.records.isEmpty)
        XCTAssertEqual(ProgressStore(baseDirectory: directory).records.count, 0)
    }

    // MARK: - Fixtures

    /// A path of identical one-step lessons, enough for the unlock rule.
    static func makePath(lessonCount: Int) throws -> PathModel {
        let tutorial = try TutorialLoader.prepare(data: Data("""
        {
          "schemaVersion": 1, "id": "fixture", "title": "Fixture",
          "canvas": { "width": 100, "height": 100 },
          "steps": [ { "id": "one", "title": "One", "instruction": "Draw.", "voiceover": null,
                       "strokes": [ { "d": "M 0 0 L 50 50", "duration": 1, "lineWidth": 4 } ] } ]
        }
        """.utf8), fileName: "fixture.json", source: .bundled)

        let lessons = (1...lessonCount).map { index in
            Lesson(id: "lesson-\(index)",
                   title: "Lesson \(index)",
                   pathId: "fixtures",
                   tutorial: tutorial,
                   objective: "Draw a line.",
                   complexity: 1,
                   reference: nil)
        }
        return PathModel(id: "fixtures", title: "Fixtures", description: nil, level: nil, lessons: lessons)
    }
}
