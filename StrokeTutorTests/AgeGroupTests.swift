import XCTest
@testable import StrokeTutor

/// The age group: its stored keys never move, an older `profile.json` still reads,
/// the PIN guards only the changes that loosen a child's protections, and what
/// analytics may send follows the learner who is drawing.
@MainActor
final class AgeGroupTests: XCTestCase {

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

    // MARK: - Keys and tiers

    func testTheStoredKeysNeverChange() {
        XCTAssertEqual(AgeGroup.allCases.map(\.rawValue),
                       ["under6", "6to9", "10to12", "13to15", "16to17", "18plus", "preferNotToSay"],
                       "These are in every profile.json and every chart; rename titles, never keys.")
        XCTAssertEqual(AgeGroup.bands.count, 6, "Six tiles, two to a row.")
        XCTAssertFalse(AgeGroup.bands.contains(.preferNotToSay))
    }

    func testAnyoneUnder13OrWhoDidNotSayIsTreatedAsAChild() {
        XCTAssertEqual(AgeGroup.under6.privacyTier, .child)
        XCTAssertEqual(AgeGroup.from6To9.privacyTier, .child)
        XCTAssertEqual(AgeGroup.from10To12.privacyTier, .child)
        XCTAssertEqual(AgeGroup.preferNotToSay.privacyTier, .child)
        XCTAssertEqual(AgeGroup.from13To15.privacyTier, .teen)
        XCTAssertEqual(AgeGroup.from16To17.privacyTier, .teen)
        XCTAssertEqual(AgeGroup.adult.privacyTier, .adult)
        XCTAssertEqual(Profile(name: "", avatar: .fox).privacyTier, .child, "Never asked is a child.")
    }

    func testOnlyAChangeToALessProtectedTierLoosens() {
        XCTAssertTrue(AgeGroup.loosensPrivacy(from: .from6To9, to: .adult))
        XCTAssertTrue(AgeGroup.loosensPrivacy(from: .from10To12, to: .from13To15))
        XCTAssertTrue(AgeGroup.loosensPrivacy(from: .preferNotToSay, to: .from16To17))
        XCTAssertTrue(AgeGroup.loosensPrivacy(from: nil, to: .adult))

        XCTAssertFalse(AgeGroup.loosensPrivacy(from: .from6To9, to: .from10To12), "Growing up within a tier is free.")
        XCTAssertFalse(AgeGroup.loosensPrivacy(from: .adult, to: .under6), "More protection is always free.")
        XCTAssertFalse(AgeGroup.loosensPrivacy(from: .adult, to: .preferNotToSay))
        XCTAssertFalse(AgeGroup.loosensPrivacy(from: nil, to: .from10To12))
    }

    // MARK: - Reading and writing

    func testAProfileWrittenBeforeTheQuestionStillReads() throws {
        let json = """
        {"id":"6C1E1D0A-3B7D-4E0F-9B8B-1B2C3D4E5F60","name":"Sam","avatar":"owl",\
        "createdAt":"2026-09-01T10:00:00Z","lastUsedAt":"2026-09-02T10:00:00Z","migratedFromLegacy":false}
        """
        let profile = try Self.decoder.decode(Profile.self, from: Data(json.utf8))
        XCTAssertEqual(profile.name, "Sam")
        XCTAssertNil(profile.ageGroup)
        XCTAssertNil(profile.ageGroupAnsweredAt)
    }

    func testAnAgeKeyThisBuildDoesNotKnowReadsAsPreferNotToSay() throws {
        let json = """
        {"id":"6C1E1D0A-3B7D-4E0F-9B8B-1B2C3D4E5F60","name":"","avatar":"fox",\
        "createdAt":"2026-09-01T10:00:00Z","lastUsedAt":"2026-09-02T10:00:00Z","migratedFromLegacy":false,\
        "ageGroup":"70plus"}
        """
        let profile = try Self.decoder.decode(Profile.self, from: Data(json.utf8))
        XCTAssertEqual(profile.ageGroup, .preferNotToSay, "Unknown reads as the careful answer.")
    }

    func testTheAnswerAndItsDateAreKeptPerLearner() throws {
        let model = makeModel()
        let first = model.activeProfile
        let second = try XCTUnwrap(model.addProfile(name: "Maya", avatar: .owl))
        let answeredAt = Date(timeIntervalSince1970: 1_790_000_000)

        model.setAgeGroup(first.id, to: .adult, at: answeredAt)
        model.setAgeGroup(second.id, to: .from6To9)

        XCTAssertEqual(model.activeProfile.ageGroup, .adult)
        XCTAssertEqual(model.activeProfile.ageGroupAnsweredAt, answeredAt)

        let relaunched = makeModel()
        XCTAssertEqual(relaunched.profiles.first { $0.id == first.id }?.ageGroup, .adult)
        XCTAssertEqual(relaunched.profiles.first { $0.id == second.id }?.ageGroup, .from6To9)
    }

    func testRenamingKeepsTheAgeGroup() {
        let model = makeModel()
        model.setAgeGroup(model.activeProfile.id, to: .from13To15)

        model.updateProfile(model.activeProfile.id, name: "Ada", avatar: .whale)

        XCTAssertEqual(model.activeProfile.ageGroup, .from13To15)
        XCTAssertEqual(makeModel().activeProfile.ageGroup, .from13To15)
    }

    func testThePINIsAskedOnlyWhenOneIsSetAndTheChangeLoosens() {
        let model = makeModel()
        let id = model.activeProfile.id
        model.setAgeGroup(id, to: .from6To9)

        XCTAssertFalse(model.ageChangeNeedsPIN(id, to: .adult), "No PIN, nothing to ask.")

        model.pin.set("2468")
        XCTAssertTrue(model.ageChangeNeedsPIN(id, to: .adult))
        XCTAssertTrue(model.ageChangeNeedsPIN(id, to: .from13To15))
        XCTAssertFalse(model.ageChangeNeedsPIN(id, to: .from10To12))
        XCTAssertFalse(model.ageChangeNeedsPIN(id, to: .preferNotToSay))
    }

    // MARK: - Analytics

    func testAChildIsNeverFollowedFromOneLaunchToTheNext() {
        let model = makeModel()
        model.setAgeGroup(model.activeProfile.id, to: .from6To9)
        model.analytics.track(.onboardingAgeAnswered)

        let policy = model.analytics.policy
        XCTAssertFalse(policy.keepsPersonProfile)
        XCTAssertFalse(policy.allowsAutocapture)
        XCTAssertFalse(policy.allowsSessionReplay)

        let event = sink.captured.last
        XCTAssertNotNil(event)
        XCTAssertEqual(event?.event.name, "ob_age_answered")
        XCTAssertEqual(event?.event.properties["age_group"], "6to9")
        XCTAssertNotEqual(event?.distinctId, model.activeProfile.id.uuidString,
                          "A child's events carry an id that lasts one launch, not the profile's.")
        XCTAssertEqual(event?.policy, policy)
    }

    func testAnAdultIsTrackedUnderTheirOwnIdWithEverythingAllowed() {
        let model = makeModel()
        model.setAgeGroup(model.activeProfile.id, to: .adult)
        model.analytics.track(.onboardingBeatViewed("ob-level"))

        XCTAssertTrue(model.analytics.policy.allowsSessionReplay)
        XCTAssertEqual(sink.identified.last?.distinctId, model.activeProfile.id.uuidString)
        XCTAssertEqual(sink.captured.last?.distinctId, model.activeProfile.id.uuidString)
        XCTAssertEqual(sink.captured.last?.event.properties["beat"], "ob-level")
        XCTAssertEqual(sink.captured.last?.event.properties["age_group"], "18plus")
    }

    func testATeenIsTrackedWithoutSessionReplay() {
        let model = makeModel()
        model.setAgeGroup(model.activeProfile.id, to: .from16To17)

        XCTAssertTrue(model.analytics.policy.keepsPersonProfile)
        XCTAssertFalse(model.analytics.policy.allowsSessionReplay)
    }

    func testSwitchingLearnersSwitchesThePolicy() throws {
        let model = makeModel()
        let parent = model.activeProfile
        model.setAgeGroup(parent.id, to: .adult)
        let child = try XCTUnwrap(model.addProfile(name: "Maya", avatar: .owl))

        model.switchProfile(to: child.id)

        XCTAssertEqual(model.analytics.policy.tier, .child, "Maya was never asked, so she is a child.")
        model.analytics.track(.onboardingFinished(startedLesson: true))
        XCTAssertEqual(sink.captured.last?.event.properties["age_group"], "unanswered")
        XCTAssertEqual(sink.captured.last?.event.properties["started_lesson"], "true")

        model.switchProfile(to: parent.id)
        XCTAssertEqual(model.analytics.policy.tier, .adult)
    }

    func testTwoChildrenInOneLaunchNeverShareAnId() throws {
        let model = makeModel()
        let first = model.activeProfile
        let second = try XCTUnwrap(model.addProfile(name: "Leo", avatar: .frog))
        let firstId = model.analytics.distinctId

        model.switchProfile(to: second.id)
        XCTAssertNotEqual(model.analytics.distinctId, firstId)

        model.switchProfile(to: first.id)
        XCTAssertEqual(model.analytics.distinctId, firstId, "The same child keeps their id for the whole launch.")
    }

    func testTheSinkIsResetWheneverTheIdChanges() throws {
        let model = makeModel()
        XCTAssertEqual(sink.resets, 0, "The first identify has no one to forget.")

        model.setAgeGroup(model.activeProfile.id, to: .from10To12)
        XCTAssertEqual(sink.resets, 0, "Answering within the child tier keeps the same anonymous id.")

        model.setAgeGroup(model.activeProfile.id, to: .adult)
        XCTAssertEqual(sink.resets, 1, "A child's anonymous events are never merged into the adult they became.")

        let other = try XCTUnwrap(model.addProfile(name: "Maya", avatar: .owl))
        model.switchProfile(to: other.id)
        XCTAssertEqual(sink.resets, 2, "Another learner is someone new.")
    }

    func testNoNameIsEverSent() {
        let model = makeModel()
        model.updateProfile(model.activeProfile.id, name: "Ada Lovelace", avatar: .owl)
        model.setAgeGroup(model.activeProfile.id, to: .adult)
        model.analytics.track(.onboardingAgeAnswered)

        let sent = sink.identified.flatMap { $0.properties.values }
            + sink.captured.flatMap { $0.event.properties.values }
        XCTAssertFalse(sent.contains { $0.contains("Ada") })
    }

    // MARK: - Helpers

    private func makeModel() -> AppModel {
        AppModel(bundle: .appUnderTest,
                 settings: Settings(defaults: defaults),
                 storeDirectory: base,
                 analyticsSink: sink)
    }

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()
}

/// Keeps everything the app would have sent.
@MainActor
private final class RecordingSink: AnalyticsSink {
    struct Identified { let distinctId: String; let properties: [String: String]; let policy: AnalyticsPolicy }
    struct Captured { let event: AnalyticsEvent; let distinctId: String; let policy: AnalyticsPolicy }

    private(set) var identified: [Identified] = []
    private(set) var captured: [Captured] = []
    private(set) var resets = 0

    func identify(distinctId: String, properties: [String: String], policy: AnalyticsPolicy) {
        identified.append(Identified(distinctId: distinctId, properties: properties, policy: policy))
    }

    func capture(_ event: AnalyticsEvent, distinctId: String, policy: AnalyticsPolicy) {
        captured.append(Captured(event: event, distinctId: distinctId, policy: policy))
    }

    func reset() {
        resets += 1
    }
}
