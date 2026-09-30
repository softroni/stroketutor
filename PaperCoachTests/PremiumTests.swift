import XCTest
@testable import PaperCoach

/// The free lessons and the crowns, what a tap on a crown opens, the free lesson
/// offered beside a Premium one, the guided first run's saved stage, a child's wish
/// list and the parental check. StoreKit itself is left to the `PaperCoach.storekit`
/// configuration in Xcode; nothing here buys anything.
@MainActor
final class PremiumTests: XCTestCase {

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

    // MARK: - A tap on a Premium lesson

    func testATapOnAPremiumLessonOpensThePaywallForTeensAndAdults() throws {
        for ageGroup in [AgeGroup.from13To15, .from16To17, .adult] {
            let model = makeModel()
            model.setAgeGroup(model.activeProfile.id, to: ageGroup)
            let lesson = try premiumLesson(in: model)

            XCTAssertTrue(model.offerPremiumIfNeeded(for: lesson), ageGroup.rawValue)

            XCTAssertEqual(model.cover, .offer(.premiumLesson(lessonId: lesson.id)), ageGroup.rawValue)
            XCTAssertFalse(model.learnerIsChild, ageGroup.rawValue)
            XCTAssertEqual(OfferRoute.firstStep(for: .premiumLesson(lessonId: lesson.id),
                                                isChild: model.learnerIsChild),
                           .paywall, ageGroup.rawValue)
            XCTAssertNil(model.offerReturnLessonId, "Opened over the tabs, it has no screen to go back to.")
        }
        XCTAssertEqual(tappedLessonIds.count, 3, "One premium_lesson_tapped per tap.")
    }

    func testAChildsTapOnAPremiumLessonOpensTheWayToAGrownUp() throws {
        for ageGroup in [AgeGroup.from6To9, .preferNotToSay, nil] {
            let model = makeModel()
            if let ageGroup { model.setAgeGroup(model.activeProfile.id, to: ageGroup) }
            let lesson = try premiumLesson(in: model)
            let name = ageGroup?.rawValue ?? "never asked"

            XCTAssertTrue(model.offerPremiumIfNeeded(for: lesson), name)

            XCTAssertTrue(model.learnerIsChild, name)
            XCTAssertEqual(model.cover, .offer(.premiumLesson(lessonId: lesson.id)), name)
            XCTAssertEqual(OfferRoute.firstStep(for: .premiumLesson(lessonId: lesson.id),
                                                isChild: model.learnerIsChild),
                           .grownUp, "A child never meets a price before the parental check.")
            // Superwall is never asked for a child, whatever it would say.
            XCTAssertEqual(OfferRoute.firstStep(for: .premiumLesson(lessonId: lesson.id),
                                                isChild: true, usesRemotePaywall: true),
                           .grownUp, name)
        }
        XCTAssertEqual(tappedLessonIds.count, 3)
    }

    func testEveryTapOpensTheWayToPremiumAgain() throws {
        for ageGroup in [AgeGroup.from6To9, .adult] {
            let model = makeModel()
            model.setAgeGroup(model.activeProfile.id, to: ageGroup)
            let path = try premiumPath(in: model)
            let crowned = Array(path.lessons.dropFirst(PremiumAccess.freeLessonsPerPath))
            // The same crown three times, then two others: each tap opens the
            // cover, and leaving it ("Keep drawing free lessons", "Continue with
            // free lessons") goes back to the tabs, with nothing held back for the
            // next tap.
            let taps = [crowned[0], crowned[0], crowned[0]] + crowned.dropFirst().prefix(2)

            for lesson in taps {
                XCTAssertTrue(model.offerPremiumIfNeeded(for: lesson), ageGroup.rawValue)
                XCTAssertEqual(model.cover, .offer(.premiumLesson(lessonId: lesson.id)), ageGroup.rawValue)

                model.finishOffer(.premiumLesson(lessonId: lesson.id), subscribed: false)
                XCTAssertNil(model.cover, ageGroup.rawValue)
            }
        }
        XCTAssertEqual(tappedLessonIds.count, 10)
    }

    func testTheGoldCardAfterALessonReturnsToThatLessonsWayOut() throws {
        let model = makeModel()
        let path = try premiumPath(in: model)
        let free = path.lessons[PremiumAccess.freeLessonsPerPath - 1]
        for lesson in path.lessons.prefix(PremiumAccess.freeLessonsPerPath - 1) {
            model.progress.markCompleted(lesson.id, pathId: path.id)
        }
        // Not a new learner's first rest: "Not now" goes back to the path.
        model.preferences.hasSeenPathsWelcome = true
        model.presentCompletion(free)
        let next = try XCTUnwrap(model.premiumNextLesson(after: free), "The lesson after the free ones wears a crown.")

        XCTAssertTrue(model.offerPremiumIfNeeded(for: next))

        XCTAssertEqual(model.cover, .offer(.premiumLesson(lessonId: next.id)))
        XCTAssertEqual(model.offerReturnLessonId, free.id)

        model.finishOffer(.premiumLesson(lessonId: next.id), subscribed: false)

        // As the completion screen's own "Not now" (`leaveCompletion(for:)`) leaves it.
        XCTAssertNil(model.cover)
        XCTAssertNil(model.offerReturnLessonId)
        XCTAssertEqual(model.selectedTab, .path)
        XCTAssertEqual(model.pathStack, [])
        XCTAssertEqual(model.currentPath?.id, path.id)
        XCTAssertEqual(tappedLessonIds, [next.id])
    }

    func testTheSavedPhotosGoldCardReturnsToTheLessonButASketchbookPhotoDoesNot() throws {
        let model = makeModel()
        let path = try premiumPath(in: model)
        let free = path.lessons[PremiumAccess.freeLessonsPerPath - 1]
        let next = path.lessons[PremiumAccess.freeLessonsPerPath]

        model.presentCapture(free)
        model.offerPremiumIfNeeded(for: next)
        XCTAssertEqual(model.offerReturnLessonId, free.id)

        model.presentCapture(free, fromSketchbook: true)
        model.offerPremiumIfNeeded(for: next)
        XCTAssertNil(model.offerReturnLessonId, "A photo added from the sketchbook has no completion to end.")
        model.finishOffer(.premiumLesson(lessonId: next.id), subscribed: false)
        XCTAssertNil(model.cover)
    }

    func testAFreeLessonOrAPremiumLearnerChangesNothing() throws {
        let locked = makeModel()
        let path = try premiumPath(in: locked)
        let free = path.lessons[0]
        locked.presentCompletion(free)

        XCTAssertFalse(locked.offerPremiumIfNeeded(for: free))
        XCTAssertEqual(locked.cover, .completion(lessonId: free.id))
        XCTAssertNil(locked.offerReturnLessonId)

        defaults.set(true, forKey: PremiumStore.cacheKey)
        let subscriber = makeModel()
        XCTAssertTrue(subscriber.premium.isPremium)
        let premium = try premiumLesson(in: subscriber)

        XCTAssertFalse(subscriber.needsPremium(premium))
        XCTAssertFalse(subscriber.offerPremiumIfNeeded(for: premium))
        XCTAssertNil(subscriber.cover)
        XCTAssertNil(subscriber.offerReturnLessonId)

        XCTAssertEqual(tappedLessonIds, [])
    }

    func testSubscribingOpensTheLessonOnceItIsUnlocked() throws {
        defaults.set(true, forKey: PremiumStore.cacheKey)
        let model = makeModel()
        let lesson = try premiumLesson(in: model)
        model.cover = .offer(.premiumLesson(lessonId: lesson.id))

        model.finishOffer(.premiumLesson(lessonId: lesson.id), subscribed: true)

        XCTAssertNil(model.cover)
        XCTAssertEqual(model.homeStack.last, .lessonPreview(lessonId: lesson.id))
    }

    func testAPurchaseThatHasNotUnlockedTheLessonNeverReopensTheSameCover() throws {
        // A purchase the entitlement does not show yet (a product outside
        // Premium's subscription group, say): opening the lesson would ask for this
        // same cover again, over a flow that has already finished.
        let model = makeModel()
        let lesson = try premiumLesson(in: model)
        model.offerPremiumIfNeeded(for: lesson)

        model.finishOffer(.premiumLesson(lessonId: lesson.id), subscribed: true)

        XCTAssertNil(model.cover)
        XCTAssertEqual(model.homeStack, [])
        XCTAssertEqual(tappedLessonIds, [lesson.id])
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

    func testTheParentalQuestionNeverGoesPastTwelve() {
        for _ in 0..<200 {
            let question = ParentalQuestion.random()
            XCTAssertTrue((3...12).contains(question.left))
            XCTAssertTrue((3...12).contains(question.right))
        }
    }

    func testANewParentalQuestionIsNeverTheSameAsTheOneBefore() {
        let first = ParentalQuestion.random()
        for _ in 0..<50 {
            XCTAssertNotEqual(ParentalQuestion.random(excluding: first), first)
        }
    }

    // MARK: - Fixtures

    private func makeModel() -> AppModel {
        let model = AppModel(bundle: .appUnderTest,
                             settings: Settings(defaults: defaults),
                             storeDirectory: CatalogLoaderTests.temporaryDirectory(),
                             analyticsSink: sink)
        model.loadContent()
        return model
    }

    /// The lesson ids of every `premium_lesson_tapped` sent so far.
    private var tappedLessonIds: [String?] {
        sink.captured.filter { $0.name == "premium_lesson_tapped" }.map { $0.properties["lesson_id"] }
    }

    /// The first shipped path long enough to have Premium lessons.
    private func premiumPath(in model: AppModel) throws -> PathModel {
        try XCTUnwrap(model.paths.first { $0.lessons.count > PremiumAccess.freeLessonsPerPath + 2 },
                      "The catalog ships a path with Premium lessons.")
    }

    /// Its first Premium lesson.
    private func premiumLesson(in model: AppModel) throws -> Lesson {
        try premiumPath(in: model).lessons[PremiumAccess.freeLessonsPerPath]
    }

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
        return PathModel(id: id, title: id.capitalized, description: nil, level: nil, color: nil, lessons: lessons)
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
