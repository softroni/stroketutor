import XCTest
@testable import PaperCoach

/// The App Store rating prompt: who is asked and when (`RatingPromptPolicy`), and
/// `AppModel` filling that in for the learner drawing, recording the ask and
/// sending `rating_prompt_requested`. StoreKit itself is never called here; the
/// completion screen does that when `claimRatingPrompt(after:)` says yes.
@MainActor
final class RatingPromptTests: XCTestCase {

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
        try? FileManager.default.removeItem(at: base)
        base = nil
        defaults = nil
        super.tearDown()
    }

    // MARK: - The policy

    func testALearner13OrOverIsAskedFromTheirThirdFinishedDrawingOn() {
        for tier in [PrivacyTier.teen, .adult] {
            XCTAssertFalse(policy(tier: tier, finishedDrawings: 1).shouldRequest)
            XCTAssertFalse(policy(tier: tier, finishedDrawings: 2).shouldRequest)
            XCTAssertTrue(policy(tier: tier, finishedDrawings: 3).shouldRequest, "The third drawing.")
            XCTAssertTrue(policy(tier: tier, finishedDrawings: 12).shouldRequest, "And any after it.")
        }
    }

    func testTheChildTierIsNeverAsked() {
        XCTAssertFalse(policy(tier: .child, finishedDrawings: 50).shouldRequest)

        for group in AgeGroup.allCases {
            let asked = policy(tier: group.privacyTier).shouldRequest
            switch group {
            case .from13To15, .from16To17, .adult:
                XCTAssertTrue(asked, "\(group.rawValue) is 13 or over.")
            case .under6, .from6To9, .from10To12, .preferNotToSay:
                XCTAssertFalse(asked, "\(group.rawValue) is the child tier.")
            }
        }
        let neverAsked = Profile(name: "", avatar: .fox, ageGroup: nil)
        XCTAssertFalse(policy(tier: neverAsked.privacyTier).shouldRequest,
                       "A learner whose age was never asked counts as a child.")
    }

    func testNeverInTheLearnersFirstSession() {
        XCTAssertFalse(policy(finishedDrawings: 5, isFirstSession: true).shouldRequest)
        XCTAssertTrue(policy(finishedDrawings: 5, isFirstSession: false).shouldRequest)
    }

    func testNeverDuringTheGuidedFirstRun() {
        XCTAssertFalse(policy(isInGuidedFirstRun: true).shouldRequest)
    }

    func testAtMostOncePerAppVersion() {
        XCTAssertTrue(policy(appVersion: "1.1", lastRequestedVersion: nil).shouldRequest, "Never asked.")
        XCTAssertFalse(policy(appVersion: "1.1", lastRequestedVersion: "1.1").shouldRequest, "Asked in this version.")
        XCTAssertTrue(policy(appVersion: "1.2", lastRequestedVersion: "1.1").shouldRequest, "A new version may ask again.")
    }

    func testNeverInAScreenshotLaunchOrTheTests() {
        XCTAssertTrue(RatingPromptPolicy.isAllowed(screenshotLaunch: false, runningTests: false))
        XCTAssertFalse(RatingPromptPolicy.isAllowed(screenshotLaunch: true, runningTests: false))
        XCTAssertFalse(RatingPromptPolicy.isAllowed(screenshotLaunch: false, runningTests: true))
        XCTAssertFalse(policy(isAllowed: false).shouldRequest)
    }

    // MARK: - The app

    func testTheUnitTestsNeverAsk() {
        let model = AppModel(bundle: .appUnderTest,
                             settings: Settings(defaults: defaults),
                             storeDirectory: base,
                             analyticsSink: sink)
        XCTAssertFalse(model.asksForRatings, "Left to the launch, the tests are a launch that never asks.")
    }

    func testAnAdultPastTheirFirstSessionIsAskedOnceThisVersionAfterTheirThirdDrawing() throws {
        let model = makeModel(ageGroup: .adult)
        model.startNewSession()
        let lessons = try threeLessons(in: model)

        model.presentCompletion(lessons[0])
        XCTAssertFalse(model.claimRatingPrompt(after: lessons[0]))
        model.presentCompletion(lessons[1])
        XCTAssertFalse(model.claimRatingPrompt(after: lessons[1]))
        model.presentCompletion(lessons[2])
        XCTAssertTrue(model.claimRatingPrompt(after: lessons[2]))

        XCTAssertEqual(asks.count, 1)
        XCTAssertEqual(asks.first?.properties, ["lesson_id": lessons[2].id,
                                                "path_id": lessons[2].pathId,
                                                "finished_drawings": "3",
                                                "age_group": "18plus"])
        XCTAssertEqual(defaults.string(forKey: AppModel.ratingPromptVersionKey), model.appVersion)

        model.presentCompletion(lessons[0])
        XCTAssertFalse(model.claimRatingPrompt(after: lessons[0]), "Once per version.")
        XCTAssertEqual(asks.count, 1)

        defaults.set("0.9", forKey: AppModel.ratingPromptVersionKey)
        XCTAssertTrue(model.claimRatingPrompt(after: lessons[0]), "Asked in an older version: this one may ask.")
    }

    func testTheSameLessonDrawnThreeTimesCountsAsThreeDrawings() throws {
        let model = makeModel(ageGroup: .from13To15)
        model.startNewSession()
        let lesson = try XCTUnwrap(try threeLessons(in: model).first)

        for _ in 0..<3 { model.presentCompletion(lesson) }

        XCTAssertEqual(model.progress.finishedDrawingCount, 3)
        XCTAssertEqual(model.progress.completedCount, 1)
        XCTAssertTrue(model.claimRatingPrompt(after: lesson))
    }

    func testANewLearnerIsNotAskedUntilTheirNextSession() throws {
        let model = makeModel(ageGroup: .adult)
        let lessons = try threeLessons(in: model)
        lessons.forEach { model.presentCompletion($0) }

        XCTAssertFalse(model.claimRatingPrompt(after: lessons[2]), "The install's first launch.")

        model.startNewSession()
        XCTAssertTrue(model.claimRatingPrompt(after: lessons[2]), "Back from the background: a new session.")
    }

    func testALearnerAddedLaterWaitsForTheirOwnNextSession() throws {
        let model = makeModel(ageGroup: .adult)
        model.startNewSession()
        let added = try XCTUnwrap(model.addProfile(name: "Sam", avatar: .owl, ageGroup: .adult))
        model.switchProfile(to: added.id)
        let lessons = try threeLessons(in: model)
        lessons.forEach { model.presentCompletion($0) }

        XCTAssertFalse(model.claimRatingPrompt(after: lessons[2]), "Sam was added in this session.")

        model.startNewSession()
        XCTAssertTrue(model.claimRatingPrompt(after: lessons[2]))
    }

    func testAChildIsNeverAskedAndNothingIsSent() throws {
        for group in [AgeGroup.from10To12, .preferNotToSay] {
            let model = makeModel(ageGroup: group)
            model.startNewSession()
            let lessons = try threeLessons(in: model)
            for _ in 0..<3 { lessons.forEach { model.presentCompletion($0) } }

            XCTAssertFalse(model.claimRatingPrompt(after: lessons[2]), group.rawValue)
        }
        XCTAssertTrue(asks.isEmpty)
        XCTAssertNil(defaults.string(forKey: AppModel.ratingPromptVersionKey))
    }

    func testALearnerWhoHasLeftTheCompletionScreenIsNotStopped() throws {
        let model = makeModel(ageGroup: .adult)
        model.startNewSession()
        let lessons = try threeLessons(in: model)
        lessons.forEach { model.presentCompletion($0) }

        model.dismissCover()
        XCTAssertFalse(model.claimRatingPrompt(after: lessons[2]), "\"Not now\": the cover is on its way down.")
        model.presentCapture(lessons[2])
        XCTAssertFalse(model.claimRatingPrompt(after: lessons[2]), "On to the photo of the page.")
        XCTAssertTrue(asks.isEmpty)

        model.cover = .completion(lessonId: lessons[2].id)
        XCTAssertTrue(model.claimRatingPrompt(after: lessons[2]), "Back from the photo to the finished drawing.")
    }

    func testTheGuidedFirstRunIsNeverInterrupted() throws {
        let model = makeModel(ageGroup: .adult)
        model.startNewSession()
        let lessons = try threeLessons(in: model)
        lessons.forEach { model.presentCompletion($0) }
        model.markFirstRunStarted(with: lessons[2])

        XCTAssertFalse(model.claimRatingPrompt(after: lessons[2]))

        model.finishFirstRun()
        XCTAssertTrue(model.claimRatingPrompt(after: lessons[2]))
    }

    // MARK: - Helpers

    private func policy(isAllowed: Bool = true,
                        tier: PrivacyTier = .adult,
                        finishedDrawings: Int = 3,
                        isFirstSession: Bool = false,
                        isInGuidedFirstRun: Bool = false,
                        appVersion: String = "1.1",
                        lastRequestedVersion: String? = nil) -> RatingPromptPolicy {
        RatingPromptPolicy(isAllowed: isAllowed,
                           tier: tier,
                           finishedDrawings: finishedDrawings,
                           isFirstSession: isFirstSession,
                           isInGuidedFirstRun: isInGuidedFirstRun,
                           appVersion: appVersion,
                           lastRequestedVersion: lastRequestedVersion)
    }

    /// A fresh install whose learner has answered `ob-age`, in a launch that may
    /// ask, as the app's own would.
    private func makeModel(ageGroup: AgeGroup) -> AppModel {
        let model = AppModel(bundle: .appUnderTest,
                             settings: Settings(defaults: defaults),
                             storeDirectory: base.appendingPathComponent(UUID().uuidString, isDirectory: true),
                             analyticsSink: sink,
                             asksForRatings: true)
        model.loadContent()
        model.setAgeGroup(model.activeProfile.id, to: ageGroup)
        return model
    }

    private func threeLessons(in model: AppModel) throws -> [Lesson] {
        let lessons = model.paths.flatMap(\.lessons)
        try XCTSkipIf(lessons.count < 3, "The bundle carries fewer than three lessons.")
        return Array(lessons.prefix(3))
    }

    private var asks: [AnalyticsEvent] {
        sink.captured.filter { $0.name == "rating_prompt_requested" }
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
