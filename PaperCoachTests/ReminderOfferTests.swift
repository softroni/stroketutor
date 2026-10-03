import XCTest
@testable import PaperCoach

/// "Draw again tomorrow?" on a finished drawing: when it shows
/// (`ReminderOfferPolicy`), and what each answer does to the practice reminder and
/// sends (`AppModel.claimReminderOffer(after:notificationsDenied:)`,
/// `acceptReminderOffer(at:authorize:)`, `declineReminderOffer()`). iOS's prompt is
/// never raised here: every "Remind me" is answered by the test.
@MainActor
final class ReminderOfferTests: XCTestCase {

    private var base: URL!
    private var defaults: UserDefaults!
    /// Made on first use, inside a test, where the main actor is already held.
    private lazy var sink = RecordingSink()

    override func setUp() {
        super.setUp()
        base = CatalogLoaderTests.temporaryDirectory()
        defaults = CatalogLoaderTests.scratchDefaults()
    }

    override func tearDown() {
        PracticeReminderScheduler.cancelAll()
        try? FileManager.default.removeItem(at: base)
        base = nil
        defaults = nil
        super.tearDown()
    }

    // MARK: - The policy

    func testItIsOfferedUntilAnsweredOnAtMostThreeDrawings() {
        XCTAssertTrue(policy().shouldOffer)
        XCTAssertTrue(policy(timesShown: 2).shouldOffer)
        XCTAssertFalse(policy(timesShown: 3).shouldOffer, "Three times unanswered is enough.")
        for answer in [ReminderOfferAnswer.yes, .no, .refused] {
            XCTAssertFalse(policy(answer: answer).shouldOffer, answer.rawValue)
        }
    }

    func testNeverOnceTheReminderIsOnOrIOSHasSaidNo() {
        XCTAssertFalse(policy(reminderEnabled: true).shouldOffer)
        XCTAssertFalse(policy(notificationsDenied: true).shouldOffer, "iOS would not ask again.")
    }

    func testNeverInALaunchThatMustNotOfferIt() {
        XCTAssertFalse(policy(isAllowed: false).shouldOffer)
    }

    func testTheNoteComesAtTheTimeOfTheDrawingDownToTheQuarterHour() {
        XCTAssertEqual(time("16:52"), DateComponents(hour: 16, minute: 45))
        XCTAssertEqual(time("09:00"), DateComponents(hour: 9, minute: 0))
        XCTAssertEqual(time("09:14"), DateComponents(hour: 9, minute: 0))
        XCTAssertEqual(time("23:59"), DateComponents(hour: 23, minute: 45))
    }

    // MARK: - The app

    func testTheUnitTestsNeverOfferIt() throws {
        let model = AppModel(bundle: .appUnderTest,
                             settings: Settings(defaults: defaults),
                             storeDirectory: base,
                             analyticsSink: sink)
        model.loadContent()
        let lesson = try firstLesson(in: model)
        model.presentCompletion(lesson)

        XCTAssertFalse(model.offersReminder)
        XCTAssertFalse(model.claimReminderOffer(after: lesson, notificationsDenied: false))
    }

    func testItShowsOnTheFinishedDrawingsScreenAndIsCounted() throws {
        let model = makeModel()
        let lesson = try firstLesson(in: model)

        XCTAssertFalse(model.claimReminderOffer(after: lesson, notificationsDenied: false), "No finished drawing on screen.")

        model.presentCompletion(lesson)
        XCTAssertTrue(model.claimReminderOffer(after: lesson, notificationsDenied: false))
        XCTAssertEqual(model.settings.reminderOfferShownCount, 1)
        XCTAssertEqual(viewed.last?.properties, ["lesson_id": lesson.id, "finished_drawings": "1",
                                                 "age_group": "unanswered"])

        model.presentCapture(lesson)
        XCTAssertFalse(model.claimReminderOffer(after: lesson, notificationsDenied: false), "On to the photo.")

        for _ in 0..<2 {
            model.presentCompletion(lesson)
            XCTAssertTrue(model.claimReminderOffer(after: lesson, notificationsDenied: false))
        }
        model.presentCompletion(lesson)
        XCTAssertFalse(model.claimReminderOffer(after: lesson, notificationsDenied: false), "Shown three times.")
        XCTAssertEqual(viewed.count, 3)
    }

    func testEveryAgeIsOfferedItInTheFirstRunToo() throws {
        let model = makeModel()
        model.setAgeGroup(model.activeProfile.id, to: .from6To9)
        let lesson = try firstLesson(in: model)
        model.markFirstRunStarted(with: lesson)
        model.presentCompletion(lesson)

        XCTAssertTrue(model.claimReminderOffer(after: lesson, notificationsDenied: false))
    }

    func testRemindMeTurnsTheReminderOnEveryDayAtThatTime() async throws {
        let model = makeModel()
        let lesson = try firstLesson(in: model)
        model.presentCompletion(lesson)
        XCTAssertTrue(model.claimReminderOffer(after: lesson, notificationsDenied: false))

        let answer = await model.acceptReminderOffer(at: today("16:52"), authorize: { .allowed })

        XCTAssertEqual(answer, .yes)
        XCTAssertTrue(model.settings.reminderEnabled)
        XCTAssertEqual(model.settings.reminderDays, "1234567")
        XCTAssertEqual(model.settings.reminderTime, "16:45")
        XCTAssertEqual(model.settings.reminderOfferAnswer, "yes")
        XCTAssertEqual(answered, ["yes"])

        model.settings.reminderEnabled = false
        model.presentCompletion(lesson)
        XCTAssertFalse(model.claimReminderOffer(after: lesson, notificationsDenied: false),
                       "Answered: turned off later in Settings, it is not offered again.")
    }

    func testRefusedInIOSsPromptNothingIsTurnedOn() async throws {
        let model = makeModel()

        let answer = await model.acceptReminderOffer(at: today("08:10"), authorize: { .denied })

        XCTAssertEqual(answer, .refused)
        XCTAssertFalse(model.settings.reminderEnabled)
        XCTAssertEqual(model.settings.reminderTime, "07:30", "The time stays as it was.")
        XCTAssertEqual(model.settings.reminderOfferAnswer, "refused")
        XCTAssertEqual(answered, ["refused"])
    }

    func testNoThanksPutsItAwayForGood() throws {
        let model = makeModel()
        let lesson = try firstLesson(in: model)
        model.presentCompletion(lesson)

        model.declineReminderOffer()

        XCTAssertFalse(model.settings.reminderEnabled)
        XCTAssertEqual(answered, ["no"])
        XCTAssertFalse(model.claimReminderOffer(after: lesson, notificationsDenied: false))
        XCTAssertEqual(Settings(defaults: defaults).reminderOfferAnswer, "no", "Kept across launches.")
    }

    func testResettingSettingsForgetsTheAnswer() {
        let settings = Settings(defaults: defaults)
        settings.reminderOfferAnswer = "no"
        settings.reminderOfferShownCount = 2

        settings.resetToDefaults()

        XCTAssertNil(settings.reminderOfferAnswer)
        XCTAssertEqual(settings.reminderOfferShownCount, 0)
        XCTAssertNil(Settings(defaults: defaults).reminderOfferAnswer)
    }

    // MARK: - Helpers

    private func policy(isAllowed: Bool = true,
                        reminderEnabled: Bool = false,
                        notificationsDenied: Bool = false,
                        answer: ReminderOfferAnswer? = nil,
                        timesShown: Int = 0) -> ReminderOfferPolicy {
        ReminderOfferPolicy(isAllowed: isAllowed,
                            reminderEnabled: reminderEnabled,
                            notificationsDenied: notificationsDenied,
                            answer: answer,
                            timesShown: timesShown)
    }

    private func makeModel() -> AppModel {
        let model = AppModel(bundle: .appUnderTest,
                             settings: Settings(defaults: defaults),
                             storeDirectory: base,
                             analyticsSink: sink,
                             offersReminder: true)
        model.loadContent()
        return model
    }

    private func firstLesson(in model: AppModel) throws -> Lesson {
        try XCTUnwrap(model.paths.first { !$0.isEmpty }?.lessons.first)
    }

    /// "16:52" today, on this device's clock.
    private func today(_ time: String) -> Date {
        let parts = time.split(separator: ":").compactMap { Int($0) }
        return Calendar.current.date(bySettingHour: parts[0], minute: parts[1], second: 0, of: Date())!
    }

    private func time(_ text: String) -> DateComponents {
        ReminderOfferPolicy.time(near: today(text))
    }

    private var viewed: [AnalyticsEvent] {
        sink.captured.filter { $0.name == "reminder_offer_viewed" }
    }

    private var answered: [String?] {
        sink.captured.filter { $0.name == "reminder_offer_answered" }.map { $0.properties["answer"] }
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
