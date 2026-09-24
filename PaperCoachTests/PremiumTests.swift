import XCTest
@testable import PaperCoach

/// The free lessons and the crowns, the free lesson offered beside a Premium one,
/// the guided first run's saved stage, a child's wish list and the parental check.
/// StoreKit itself is left to the `PaperCoach.storekit` configuration in Xcode;
/// nothing here buys anything.
@MainActor
final class PremiumTests: XCTestCase {

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

    // MARK: - Which lessons are free

    func testTheFirstThreeLessonsOfAPathAreFreeAndTheRestArePremium() throws {
        let path = try Self.makePath(id: "plants", lessonCount: 10)

        for lesson in path.lessons.prefix(3) {
            XCTAssertFalse(PremiumAccess.isPremiumLesson(lesson, in: path), lesson.id)
        }
        for lesson in path.lessons.dropFirst(3) {
            XCTAssertTrue(PremiumAccess.isPremiumLesson(lesson, in: path), lesson.id)
        }
    }

    func testALessonThePathDoesNotListIsNeverPremium() throws {
        let plants = try Self.makePath(id: "plants", lessonCount: 10)
        let fruits = try Self.makePath(id: "fruits", lessonCount: 10)

        XCTAssertFalse(PremiumAccess.isPremiumLesson(fruits.lessons[8], in: plants))
    }

    // MARK: - The free lesson beside a Premium one

    func testTheSuggestionPrefersAPathNotYetStarted() throws {
        let plants = try Self.makePath(id: "plants", lessonCount: 10)
        let fruits = try Self.makePath(id: "fruits", lessonCount: 10)
        let sky = try Self.makePath(id: "sky", lessonCount: 10)
        let progress = ProgressStore(baseDirectory: base)
        for lesson in plants.lessons.prefix(3) { progress.markCompleted(lesson.id, pathId: plants.id) }
        progress.markCompleted(fruits.lessons[0].id, pathId: fruits.id)

        let suggestion = PremiumAccess.freeLessonSuggestion(excludingPath: plants.id,
                                                            paths: [plants, fruits, sky],
                                                            progress: progress)

        XCTAssertEqual(suggestion?.id, sky.lessons[0].id)
    }

    func testTheSuggestionFallsBackToTheNextFreeLessonOfAStartedPath() throws {
        let plants = try Self.makePath(id: "plants", lessonCount: 10)
        let fruits = try Self.makePath(id: "fruits", lessonCount: 10)
        let progress = ProgressStore(baseDirectory: base)
        for lesson in plants.lessons.prefix(3) { progress.markCompleted(lesson.id, pathId: plants.id) }
        progress.markCompleted(fruits.lessons[0].id, pathId: fruits.id)

        let suggestion = PremiumAccess.freeLessonSuggestion(excludingPath: plants.id,
                                                            paths: [plants, fruits],
                                                            progress: progress)

        XCTAssertEqual(suggestion?.id, fruits.lessons[1].id)
    }

    func testThereIsNoSuggestionOnceEveryOtherFreeLessonIsDrawn() throws {
        let plants = try Self.makePath(id: "plants", lessonCount: 10)
        let fruits = try Self.makePath(id: "fruits", lessonCount: 10)
        let progress = ProgressStore(baseDirectory: base)
        for lesson in fruits.lessons.prefix(3) { progress.markCompleted(lesson.id, pathId: fruits.id) }

        let suggestion = PremiumAccess.freeLessonSuggestion(excludingPath: plants.id,
                                                            paths: [plants, fruits],
                                                            progress: progress)

        XCTAssertNil(suggestion, "Fruits' next lesson is the fourth, which is Premium")
    }

    // MARK: - The guided first run

    func testTheFirstRunStageSurvivesARelaunchAndClearsWhenItEnds() {
        let settings = Settings(defaults: defaults)
        XCTAssertNil(settings.firstRunStage)

        settings.firstRunLessonId = "pine-tree"
        settings.firstRunStage = .sketchbook

        let relaunched = Settings(defaults: defaults)
        XCTAssertEqual(relaunched.firstRunStage, .sketchbook)
        XCTAssertEqual(relaunched.firstRunLessonId, "pine-tree")

        relaunched.firstRunStage = nil
        relaunched.firstRunLessonId = nil
        let again = Settings(defaults: defaults)
        XCTAssertNil(again.firstRunStage)
        XCTAssertNil(again.firstRunLessonId)
    }

    func testResettingSettingsEndsTheFirstRun() {
        let settings = Settings(defaults: defaults)
        settings.firstRunStage = .offer
        settings.firstRunLessonId = "pine-tree"

        settings.resetToDefaults()

        XCTAssertNil(Settings(defaults: defaults).firstRunStage)
        XCTAssertNil(Settings(defaults: defaults).firstRunLessonId)
    }

    // MARK: - The wish list

    func testTheWishListIsKeptPerLearnerAndToggles() {
        let preferences = ProfilePreferences(directory: base)
        preferences.toggleWish("mushroom")
        preferences.toggleWish("rose")

        XCTAssertEqual(ProfilePreferences(directory: base).wishList, ["mushroom", "rose"])

        preferences.toggleWish("mushroom")
        XCTAssertEqual(ProfilePreferences(directory: base).wishList, ["rose"])
    }

    func testPreferencesWrittenBeforeTheWishListReadAsAnEmptyOne() throws {
        let json = #"{"currentPathId":"plants","narrationEnabled":true,"defaultSpeed":1}"#
        let values = try JSONDecoder().decode(ProfilePreferences.Values.self, from: Data(json.utf8))
        XCTAssertEqual(values.wishList, [])
        XCTAssertEqual(values.currentPathId, "plants")
    }

    // MARK: - The parental check

    func testTheParentalQuestionIsWrittenInWordsAndAnsweredInNumbers() {
        let question = ParentalQuestion(left: 12, right: 8)
        XCTAssertEqual(question.answer, 96)
        XCTAssertFalse(question.text.contains("12"))
        XCTAssertFalse(question.text.contains("8"))
    }

    func testANewParentalQuestionIsNeverTheSameAsTheOneBefore() {
        let first = ParentalQuestion.random()
        for _ in 0..<50 {
            XCTAssertNotEqual(ParentalQuestion.random(excluding: first), first)
        }
    }

    // MARK: - Fixtures

    static func makePath(id: String, lessonCount: Int) throws -> PathModel {
        let tutorial = try TutorialLoader.prepare(data: Data("""
        {
          "schemaVersion": 1, "id": "fixture", "title": "Fixture",
          "canvas": { "width": 100, "height": 100 },
          "steps": [ { "id": "one", "title": "One", "instruction": "Draw.", "voiceover": null,
                       "strokes": [ { "d": "M 0 0 L 50 50", "duration": 1, "lineWidth": 4 } ] } ]
        }
        """.utf8), fileName: "fixture.json", source: .bundled)

        let lessons = (1...lessonCount).map { index in
            Lesson(id: "\(id)-\(index)",
                   title: "\(id.capitalized) \(index)",
                   pathId: id,
                   tutorial: tutorial,
                   objective: "Draw a line.",
                   complexity: 1,
                   reference: nil)
        }
        return PathModel(id: id, title: id.capitalized, description: nil, level: nil, lessons: lessons)
    }
}
