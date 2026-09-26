import XCTest
@testable import PaperCoach

/// Apple Ads attribution and app opens: Apple's answer is read, kept and reported
/// once, the app stops asking in time, and the campaign rides on the events that
/// say what an install was worth, and on a 13+ learner's person.
@MainActor
final class AppleAdsAttributionTests: XCTestCase {

    private var base: URL!
    private var defaults: UserDefaults!
    private lazy var sink = CapturingSink()

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

    /// Apple's documented sample answer, which is also what a development or
    /// TestFlight build is given.
    private static let sample = Data("""
        {"attribution": true, "orgId": 1234567890, "campaignId": 1234567890, "conversionType": "Download",
         "clickDate": "2020-04-08T17:17Z", "claimType": "Click", "adGroupId": 1234567890,
         "countryOrRegion": "US", "keywordId": 12323222, "adId": 1234567890}
        """.utf8)

    private static let paid = AppleAdsAttribution.Record(attribution: true, orgId: 40, campaignId: 41, adGroupId: 42,
                                                         keywordId: 43, adId: 44, countryOrRegion: "US",
                                                         conversionType: "Download", claimType: "Click")

    // MARK: - Apple's answer

    func testApplesSampleAnswerReadsAndIsMarkedAsTheSample() throws {
        guard case let .record(record) = AppleAdsAttribution.response(status: 200, body: Self.sample) else {
            return XCTFail("A 200 with Apple's sample body is an answer.")
        }
        XCTAssertTrue(record.attribution)
        XCTAssertEqual(record.keywordId, 12_323_222)
        XCTAssertEqual(record.conversionType, "Download")
        XCTAssertTrue(record.isTestPayload)
        XCTAssertEqual(record.analyticsProperties["asa_test_payload"], "true")
        XCTAssertEqual(record.analyticsProperties["asa_keyword_id"], "12323222")
    }

    func testEachStatusSaysWhatToDoNext() {
        XCTAssertEqual(AppleAdsAttribution.response(status: 404, body: Data()), .notYet)
        XCTAssertEqual(AppleAdsAttribution.response(status: 400, body: Data()), .refused)
        XCTAssertEqual(AppleAdsAttribution.response(status: 500, body: Data()), .unreachable)
        XCTAssertEqual(AppleAdsAttribution.response(status: 200, body: Data("<html>".utf8)), .refused)
    }

    func testAnOrganicInstallIsAnAnswerToo() throws {
        let body = Data(#"{"attribution": false}"#.utf8)
        guard case let .record(record) = AppleAdsAttribution.response(status: 200, body: body) else {
            return XCTFail("An organic install is answered, and kept like any other answer.")
        }
        XCTAssertEqual(record.analyticsProperties, ["asa_attribution": "false"])
    }

    // MARK: - Asking

    func testAnAnswerIsKeptAndNeverAskedForAgain() async {
        let apple = FakeApple([.record(Self.paid)])
        let first = await attribution(apple).resolve()
        XCTAssertEqual(first, Self.paid)

        let nextLaunch = attribution(apple)
        XCTAssertEqual(nextLaunch.record, Self.paid, "The answer outlives the launch.")
        let again = await nextLaunch.resolve()
        XCTAssertNil(again, "Reported once, when it arrived.")
        XCTAssertEqual(apple.calls, 1)
    }

    func testAnAnswerNotReadyIsAskedForAgainThenLeftForTheNextLaunch() async {
        let apple = FakeApple([.notYet, .notYet, .notYet, .record(Self.paid)])
        let first = await attribution(apple).resolve()
        XCTAssertNil(first)
        XCTAssertEqual(apple.calls, AppleAdsAttribution.triesPerLaunch)

        let second = await attribution(apple).resolve()
        XCTAssertEqual(second, Self.paid)
    }

    func testTheAppStopsAskingAfterItsLaunchesAreUsedUp() async {
        let apple = FakeApple(Array(repeating: .unreachable, count: 20))
        for _ in 0..<(AppleAdsAttribution.maxLaunches + 3) {
            _ = await attribution(apple).resolve()
        }
        XCTAssertEqual(apple.calls, AppleAdsAttribution.maxLaunches)
    }

    func testWithoutATokenAppleIsNotAsked() async {
        let apple = FakeApple([.record(Self.paid)])
        let noToken = AppleAdsAttribution(defaults: defaults, retryDelay: .zero,
                                          token: { throw CocoaError(.featureUnsupported) },
                                          transport: apple.transport)
        let result = await noToken.resolve()
        XCTAssertNil(result)
        XCTAssertEqual(apple.calls, 0)
    }

    // MARK: - Where the campaign goes

    func testTheCampaignRidesOnlyOnTheEventsThatSayWhatAnInstallWasWorth() {
        let model = makeModel()
        model.analytics.setAcquisition(Self.paid.analyticsProperties)

        model.analytics.track(.appOpened(firstOpen: true))
        model.analytics.track(.purchaseAttempted(plan: "yearly", outcome: "purchased"))
        model.analytics.track(.pathOpened(pathId: "plants"))

        let byName = Dictionary(sink.captured.map { ($0.event.name, $0.event.properties) }, uniquingKeysWith: { $1 })
        XCTAssertEqual(byName["app_opened"]?["asa_keyword_id"], "43")
        XCTAssertEqual(byName["purchase_attempted"]?["asa_campaign_id"], "41")
        XCTAssertEqual(byName["purchase_attempted"]?["outcome"], "purchased", "An event's own keys win.")
        XCTAssertNil(byName["path_opened"]?["asa_campaign_id"])
    }

    func testAnAdultsPersonCarriesTheCampaignAndAChildsEventsKeepTheirOneLaunchId() {
        let model = makeModel()
        model.setAgeGroup(model.activeProfile.id, to: .adult)
        model.analytics.setAcquisition(Self.paid.analyticsProperties)
        XCTAssertEqual(sink.identified.last?.properties["asa_campaign_id"], "41")
        XCTAssertEqual(sink.identified.last?.properties["age_group"], "18plus")
        XCTAssertTrue(sink.identified.last?.policy.keepsPersonProfile ?? false)

        model.setAgeGroup(model.activeProfile.id, to: .from6To9)
        model.analytics.track(.offerFinished(entry: "settings", subscribed: true))
        XCTAssertFalse(sink.identified.last?.policy.keepsPersonProfile ?? true,
                       "A sink builds no person for a child (PostHogSink ignores this identify).")
        XCTAssertEqual(sink.captured.last?.event.properties["asa_campaign_id"], "41")
        XCTAssertNotEqual(sink.captured.last?.distinctId, model.activeProfile.id.uuidString)
    }

    func testAKeptAnswerIsOnTheEventsFromTheStartOfTheNextLaunch() async {
        let apple = FakeApple([.record(Self.paid)])
        _ = await attribution(apple).resolve()

        let model = makeModel()
        model.analytics.track(.appOpened(firstOpen: false))
        XCTAssertEqual(sink.captured.last?.event.properties["asa_ad_group_id"], "42")
    }

    func testResolvingReportsTheInstallOnce() async {
        let apple = FakeApple([.record(Self.paid)])
        let model = makeModel(appleAds: attribution(apple))
        await model.resolveAppleAdsAttribution()
        await model.resolveAppleAdsAttribution()

        let installs = sink.captured.filter { $0.event.name == "install_attributed" }
        XCTAssertEqual(installs.count, 1)
        XCTAssertEqual(installs.first?.event.properties["asa_attribution"], "true")
        XCTAssertEqual(installs.first?.event.properties["asa_country_or_region"], "US")
    }

    // MARK: - Opens

    func testOnlyTheFirstOpenAfterInstallIsMarkedFirst() {
        let model = makeModel()
        model.recordAppOpened()
        model.recordAppOpened()
        let opens = sink.captured.filter { $0.event.name == "app_opened" }
        XCTAssertEqual(opens.map { $0.event.properties["first_open"] }, ["true", "false"])
        XCTAssertEqual(opens.last?.event.properties["narration_on"], model.preferences.narrationEnabled ? "true" : "false")
        XCTAssertEqual(opens.last?.event.properties["reminder_on"], "false", "A fresh install has no reminder.")
        XCTAssertNotNil(opens.last?.event.properties["save_to_photos_on"])
    }

    // MARK: - Helpers

    private func attribution(_ apple: FakeApple) -> AppleAdsAttribution {
        AppleAdsAttribution(defaults: defaults, retryDelay: .zero, token: { "token" }, transport: apple.transport)
    }

    private func makeModel(appleAds: AppleAdsAttribution? = nil) -> AppModel {
        AppModel(bundle: .appUnderTest,
                 settings: Settings(defaults: defaults),
                 storeDirectory: base,
                 analyticsSink: sink,
                 appleAds: appleAds)
    }
}

/// Apple's attribution API, answering from a script and counting the calls.
private final class FakeApple: @unchecked Sendable {
    private let lock = NSLock()
    private var script: [AppleAdsAttribution.Response]
    private var count = 0

    init(_ script: [AppleAdsAttribution.Response]) {
        self.script = script
    }

    var calls: Int { lock.withLock { count } }

    var transport: AppleAdsAttribution.Transport {
        { [self] _ in
            lock.withLock {
                count += 1
                return script.isEmpty ? .unreachable : script.removeFirst()
            }
        }
    }
}

/// Keeps everything the app would have sent.
@MainActor
private final class CapturingSink: AnalyticsSink {
    struct Identified { let distinctId: String; let properties: [String: String]; let policy: AnalyticsPolicy }
    struct Captured { let event: AnalyticsEvent; let distinctId: String }

    private(set) var identified: [Identified] = []
    private(set) var captured: [Captured] = []

    func identify(distinctId: String, properties: [String: String], policy: AnalyticsPolicy) {
        identified.append(Identified(distinctId: distinctId, properties: properties, policy: policy))
    }

    func capture(_ event: AnalyticsEvent, distinctId: String, policy: AnalyticsPolicy) {
        captured.append(Captured(event: event, distinctId: distinctId))
    }

    func reset() {}
}
