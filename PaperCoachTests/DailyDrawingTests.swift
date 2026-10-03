import XCTest
@testable import PaperCoach

/// Today's drawing: which Premium lesson a date gets (`DailyDrawing`), and the app
/// opening it to every learner for that day only, from Home's card
/// (`AppModel.openDailyDrawing()`) and anywhere else its crown would show.
@MainActor
final class DailyDrawingTests: XCTestCase {

    private var base: URL!
    private var defaults: UserDefaults!
    /// Made on first use, inside a test, where the main actor is already held.
    private lazy var sink = RecordingSink()

    private let chicago = TimeZone(identifier: "America/Chicago")!

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

    // MARK: - The order

    func testTheDaysTakeLessonFourOfEveryPathThenLessonFiveOfEvery() throws {
        let paths = try fixturePaths()
        let order = DailyDrawing.order(of: paths).map(\.id)

        XCTAssertEqual(Array(order.prefix(8)), ["plants-4", "fruits-4", "sky-4",
                                                "plants-5", "fruits-5", "sky-5",
                                                "plants-6", "fruits-6"])
        XCTAssertEqual(order.count, 7 + 7 + 2, "Every Premium lesson once; the short path drops out of the later rounds.")
        XCTAssertFalse(order.contains { ["plants-1", "plants-2", "plants-3", "sky-3"].contains($0) },
                       "Never a free lesson.")
    }

    func testTwoDaysRunningNeverShareAPathRoundTheWholeCycle() throws {
        let order = DailyDrawing.order(of: try fixturePaths())
        for (today, tomorrow) in zip(order, order.dropFirst() + order.prefix(1)) {
            XCTAssertNotEqual(today.pathId, tomorrow.pathId, "\(today.id) then \(tomorrow.id)")
        }
    }

    func testTheShippedCatalogsOrderStartsWithTheFirstPathsFourthLesson() throws {
        let model = makeModel()
        let order = DailyDrawing.order(of: model.paths)
        let premiumCount = model.paths.reduce(0) { $0 + max(0, $1.lessons.count - PremiumAccess.freeLessonsPerPath) }

        XCTAssertEqual(order.count, premiumCount)
        XCTAssertEqual(Set(order.map(\.id)).count, premiumCount, "No lesson twice.")
        let first = try XCTUnwrap(model.paths.first { $0.lessons.count > PremiumAccess.freeLessonsPerPath })
        XCTAssertEqual(order.first?.id, first.lessons[PremiumAccess.freeLessonsPerPath].id)
    }

    func testNoPremiumLessonsMeansNoDrawingOfTheDay() throws {
        let short = try PremiumTests.makePath(id: "short", lessonCount: 3)
        XCTAssertNil(DailyDrawing.lesson(on: Date(), paths: [short]))
    }

    // MARK: - The days

    func testTheFirstDayDrawsTheFirstLessonAndEachDayTheNext() throws {
        let paths = try fixturePaths()
        let order = DailyDrawing.order(of: paths)

        XCTAssertEqual(DailyDrawing.dayNumber(of: date("2026-10-05 00:00"), timeZone: chicago), 0)
        XCTAssertEqual(DailyDrawing.dayNumber(of: date("2026-10-05 23:59"), timeZone: chicago), 0)
        XCTAssertEqual(DailyDrawing.dayNumber(of: date("2026-10-06 00:00"), timeZone: chicago), 1)
        XCTAssertEqual(DailyDrawing.lesson(on: date("2026-10-05 09:00"), paths: paths, timeZone: chicago)?.id, order[0].id)
        XCTAssertEqual(DailyDrawing.lesson(on: date("2026-10-06 09:00"), paths: paths, timeZone: chicago)?.id, order[1].id)
        XCTAssertEqual(DailyDrawing.lesson(on: date("2026-10-21 09:00"), paths: paths, timeZone: chicago)?.id,
                       order[0].id, "Sixteen days later the cycle starts again.")
    }

    func testADayBeforeTheFirstTakesTheEndOfTheCycle() throws {
        let paths = try fixturePaths()
        let order = DailyDrawing.order(of: paths)

        XCTAssertEqual(DailyDrawing.dayNumber(of: date("2026-10-04 12:00"), timeZone: chicago), -1)
        XCTAssertEqual(DailyDrawing.lesson(on: date("2026-10-04 12:00"), paths: paths, timeZone: chicago)?.id,
                       order.last?.id)
    }

    func testTheDayTurnsAtTheLearnersOwnMidnight() {
        // 23:30 in Chicago is already the next morning in London.
        let moment = date("2026-10-05 23:30")
        XCTAssertEqual(DailyDrawing.dayNumber(of: moment, timeZone: chicago), 0)
        XCTAssertEqual(DailyDrawing.dayNumber(of: moment, timeZone: TimeZone(identifier: "Europe/London")!), 1)
    }

    func testAChangeOfClocksIsStillOneDay() {
        // Chicago leaves daylight saving time on 2026-11-01: a 25-hour day.
        XCTAssertEqual(DailyDrawing.dayNumber(of: date("2026-11-01 12:00"), timeZone: chicago), 27)
        XCTAssertEqual(DailyDrawing.dayNumber(of: date("2026-11-02 00:30"), timeZone: chicago), 28)
    }

    func testTheHarnessFindsTheDayOfALesson() throws {
        let paths = try fixturePaths()
        let day = try XCTUnwrap(DailyDrawing.firstDate(showing: "fruits-5", paths: paths, timeZone: chicago))

        XCTAssertEqual(DailyDrawing.lesson(on: day, paths: paths, timeZone: chicago)?.id, "fruits-5")
        XCTAssertNil(DailyDrawing.firstDate(showing: "fruits-1", paths: paths), "A free lesson is never today's drawing.")
    }

    // MARK: - The app

    func testWithNoDaySetNothingIsTodaysDrawing() throws {
        let model = makeModel()
        let lesson = try firstDailyLesson(in: model)

        XCTAssertNil(model.dailyDrawingDay, "Only AppRoot sets the day; the tests set their own.")
        XCTAssertNil(model.dailyDrawing)
        XCTAssertTrue(model.needsPremium(lesson))
    }

    func testTodaysDrawingIsOpenToALearnerWithoutPremiumForThatDayOnly() throws {
        let model = makeModel()
        model.setAgeGroup(model.activeProfile.id, to: .adult)
        let lesson = try firstDailyLesson(in: model)
        model.startDay(try dayShowing(lesson, in: model))

        XCTAssertEqual(model.dailyDrawing?.id, lesson.id)
        XCTAssertFalse(model.needsPremium(lesson), "No crown today.")
        XCTAssertTrue(model.isFreeToday(lesson))
        XCTAssertFalse(model.offerPremiumIfNeeded(for: lesson))
        model.showPreview(of: lesson)
        XCTAssertNil(model.cover, "No paywall.")
        XCTAssertEqual(model.homeStack.last, .lessonPreview(lessonId: lesson.id))

        let path = try XCTUnwrap(model.path(id: lesson.pathId))
        let other = try XCTUnwrap(path.lessons.last { $0.id != lesson.id })
        XCTAssertTrue(model.needsPremium(other), "Every other Premium lesson keeps its crown.")
        XCTAssertFalse(model.isFreeToday(other))

        model.startDay(try XCTUnwrap(Calendar.current.date(byAdding: .day, value: 1, to: try dayShowing(lesson, in: model))))
        XCTAssertNotEqual(model.dailyDrawing?.id, lesson.id)
        XCTAssertTrue(model.needsPremium(lesson), "The next day it needs Premium again.")
    }

    func testASubscriberIsNotToldItIsFreeToday() throws {
        defaults.set(true, forKey: PremiumStore.cacheKey)
        let model = makeModel()
        let lesson = try firstDailyLesson(in: model)
        model.startDay(try dayShowing(lesson, in: model))

        XCTAssertTrue(model.premium.isPremium)
        XCTAssertEqual(model.dailyDrawing?.id, lesson.id)
        XCTAssertFalse(model.isFreeToday(lesson))
    }

    func testTheCardOpensThePreviewPastThePathsOrderAndSaysSo() throws {
        let model = makeModel()
        let lesson = try firstDailyLesson(in: model)
        let path = try XCTUnwrap(model.path(id: lesson.pathId))
        model.startDay(try dayShowing(lesson, in: model))
        XCTAssertFalse(model.progress.isUnlocked(lesson, in: path), "The lessons before it are not drawn yet.")

        model.openDailyDrawing()

        XCTAssertNil(model.cover)
        XCTAssertEqual(model.homeStack.last, .lessonPreview(lessonId: lesson.id))
        let opened = try XCTUnwrap(sink.captured.last { $0.name == "daily_drawing_opened" })
        XCTAssertEqual(opened.properties, ["lesson_id": lesson.id, "path_id": lesson.pathId, "free_today": "true",
                                           "age_group": "unanswered"])
    }

    func testTheLessonEventsSayWhenItIsTodaysDrawing() throws {
        let model = makeModel()
        let lesson = try firstDailyLesson(in: model)
        let path = try XCTUnwrap(model.path(id: lesson.pathId))
        let free = path.lessons[0]
        model.startDay(try dayShowing(lesson, in: model))

        model.presentPlayer(lesson)
        model.presentCompletion(lesson)
        model.presentPlayer(free)
        model.presentCompletion(free)

        let started = sink.captured.filter { $0.name == "lesson_started" }
        let completed = sink.captured.filter { $0.name == "lesson_completed" }
        XCTAssertEqual(started.map { $0.properties["daily_drawing"] }, ["true", "false"])
        XCTAssertEqual(started.first?.properties["premium_lesson"], "true")
        XCTAssertEqual(completed.map { $0.properties["daily_drawing"] }, ["true", "false"])
    }

    // MARK: - Fixtures

    private func makeModel() -> AppModel {
        let model = AppModel(bundle: .appUnderTest,
                             settings: Settings(defaults: defaults),
                             storeDirectory: base,
                             analyticsSink: sink)
        model.loadContent()
        return model
    }

    /// The first lesson of the shipped catalog's rotation.
    private func firstDailyLesson(in model: AppModel) throws -> Lesson {
        try XCTUnwrap(DailyDrawing.order(of: model.paths).first, "The catalog ships Premium lessons.")
    }

    private func dayShowing(_ lesson: Lesson, in model: AppModel) throws -> Date {
        try XCTUnwrap(DailyDrawing.firstDate(showing: lesson.id, paths: model.paths))
    }

    /// Plants and Fruits with ten lessons each, Sky with five.
    private func fixturePaths() throws -> [PathModel] {
        [try PremiumTests.makePath(id: "plants", lessonCount: 10),
         try PremiumTests.makePath(id: "fruits", lessonCount: 10),
         try PremiumTests.makePath(id: "sky", lessonCount: 5)]
    }

    /// "2026-10-05 09:00" in Chicago.
    private func date(_ text: String) -> Date {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = chicago
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        return formatter.date(from: text)!
    }
}

/// Keeps every event the app would have sent.
@MainActor
private final class RecordingSink: AnalyticsSink {
    private(set) var captured: [AnalyticsEvent] = []

    func identify(distinctId: String, properties: [String: String], policy: AnalyticsPolicy) {}

    func capture(_ event: AnalyticsEvent, distinctId: String, policy: AnalyticsPolicy) {
        captured.append(event)
    }

    func reset() {}
}
