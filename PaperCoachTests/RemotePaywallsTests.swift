import XCTest
@testable import PaperCoach

/// Superwall's paywalls for learners 13 and over, through the SDK-free half of the
/// integration: when Superwall may start and what it may send (`SuperwallGate`),
/// what a Superwall paywall's answer leads to (`RemotePaywallResult`,
/// `OfferRoute`), the names the dashboard routes, the words Superwall is told
/// about Premium, and `AppModel` telling it who is drawing. Nothing here starts
/// the SDK: the tests always get `NativePaywallsOnly`.
@MainActor
final class RemotePaywallsTests: XCTestCase {

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

    // MARK: - When Superwall starts

    func testALaunchWithAGrownUpDrawingStartsSuperwallWithTrackingOffThenOn() {
        var gate = SuperwallGate(isAllowed: true)

        XCTAssertEqual(gate.launch(tier: .adult, waitingForPicker: false), [.configure])
        XCTAssertEqual(gate.phase, .starting)
        XCTAssertFalse(gate.mayPresent, "Not until configure has called back.")

        XCTAssertEqual(gate.configureFinished(), [.trackEvents(true)])
        XCTAssertEqual(gate.phase, .started)
        XCTAssertTrue(gate.mayPresent)
    }

    func testALaunchWithAChildDrawingNeverStartsSuperwall() {
        var gate = SuperwallGate(isAllowed: true)

        XCTAssertEqual(gate.launch(tier: .child, waitingForPicker: false), [])
        XCTAssertEqual(gate.learnerChanged(to: .child), [])

        XCTAssertEqual(gate.phase, .notStarted)
        XCTAssertFalse(gate.mayPresent)
        XCTAssertFalse(gate.forwardsEvents)
    }

    func testSuperwallStartsTheFirstTimeATeenOrGrownUpDraws() {
        var gate = SuperwallGate(isAllowed: true)
        _ = gate.launch(tier: .child, waitingForPicker: false)

        XCTAssertEqual(gate.learnerChanged(to: .teen), [.configure],
                       "A switch, or a child's age group changed to 13 or over.")
    }

    func testWhileWhoIsDrawingIsUpTheLastLearnerDoesNotCount() {
        var gate = SuperwallGate(isAllowed: true)

        XCTAssertEqual(gate.launch(tier: .adult, waitingForPicker: true), [],
                       "The grown-up who drew last may not be the one drawing now.")
        XCTAssertEqual(gate.phase, .notStarted)

        XCTAssertEqual(gate.learnerChanged(to: .child), [], "A child answered.")
        XCTAssertEqual(gate.phase, .notStarted)
    }

    func testAGrownUpAnsweringWhoIsDrawingStartsSuperwall() {
        var gate = SuperwallGate(isAllowed: true)
        _ = gate.launch(tier: .child, waitingForPicker: true)

        XCTAssertEqual(gate.learnerChanged(to: .adult), [.configure])
    }

    func testAChangeBeforeLaunchIsOnlyNoted() {
        var gate = SuperwallGate(isAllowed: true)

        XCTAssertEqual(gate.learnerChanged(to: .adult), [], "Launch is not over yet.")
        XCTAssertEqual(gate.phase, .notStarted)
        XCTAssertEqual(gate.launch(tier: .adult, waitingForPicker: false), [.configure])
    }

    func testSuperwallIsConfiguredOnceAndTrackingFollowsWhoeverDraws() {
        var gate = SuperwallGate(isAllowed: true)
        _ = gate.launch(tier: .adult, waitingForPicker: false)

        XCTAssertEqual(gate.learnerChanged(to: .child), [], "Still starting: configure's callback decides.")
        XCTAssertEqual(gate.configureFinished(), [], "A child draws, and tracking is already off.")
        XCTAssertFalse(gate.mayPresent)
        XCTAssertFalse(gate.forwardsEvents)

        XCTAssertEqual(gate.learnerChanged(to: .adult), [.trackEvents(true)])
        XCTAssertEqual(gate.learnerChanged(to: .teen), [], "Already on.")
        XCTAssertTrue(gate.mayPresent)
        XCTAssertTrue(gate.forwardsEvents)

        XCTAssertEqual(gate.learnerChanged(to: .child), [.trackEvents(false)])
        XCTAssertFalse(gate.mayPresent)
        XCTAssertFalse(gate.forwardsEvents)

        XCTAssertEqual(gate.learnerChanged(to: .adult), [.trackEvents(true)], "Never a second configure.")
        XCTAssertEqual(gate.configureFinished(), [], "Only the first callback counts.")
    }

    func testALaunchThatMayNotStartSuperwallNeverDoes() {
        var gate = SuperwallGate(isAllowed: false)

        XCTAssertEqual(gate.launch(tier: .adult, waitingForPicker: false), [])
        XCTAssertEqual(gate.learnerChanged(to: .teen), [])
        XCTAssertFalse(gate.mayPresent)
    }

    func testScreenshotsNativePaywallAndTestLaunchesMayNotStartSuperwall() {
        XCTAssertTrue(SuperwallGate.isAllowed(screenshotLaunch: false, forcesNativePaywall: false, runningTests: false))
        XCTAssertFalse(SuperwallGate.isAllowed(screenshotLaunch: true, forcesNativePaywall: false, runningTests: false))
        XCTAssertFalse(SuperwallGate.isAllowed(screenshotLaunch: false, forcesNativePaywall: true, runningTests: false))
        XCTAssertFalse(SuperwallGate.isAllowed(screenshotLaunch: false, forcesNativePaywall: false, runningTests: true))
    }

    // MARK: - What a Superwall paywall's close means

    func testAPaywallClosedAfterAPurchaseOrARestoreSaysSo() {
        XCTAssertEqual(RemotePaywallResult(closedBy: .purchased, lastPurchase: .purchased), .purchased)
        XCTAssertEqual(RemotePaywallResult(closedBy: .purchased, lastPurchase: nil), .purchased)
        XCTAssertEqual(RemotePaywallResult(closedBy: .restored, lastPurchase: nil), .restored)
    }

    func testTheLastPurchaseDecidesAPaywallClosedAsDeclined() {
        XCTAssertEqual(RemotePaywallResult(closedBy: .declined, lastPurchase: .purchased), .purchased,
                       "A purchase that asked the paywall to stay up.")
        XCTAssertEqual(RemotePaywallResult(closedBy: .declined, lastPurchase: .pending), .pending,
                       "Ask to Buy leaves the paywall up; it closes as declined.")
        XCTAssertEqual(RemotePaywallResult(closedBy: .declined, lastPurchase: .cancelled), .declined)
        XCTAssertEqual(RemotePaywallResult(closedBy: .declined, lastPurchase: .failed), .declined)
        XCTAssertEqual(RemotePaywallResult(closedBy: .declined, lastPurchase: nil), .declined)
    }

    func testAPaywallThatFailedToLoadGivesWayToTheNativeOne() {
        XCTAssertEqual(RemotePaywallResult(closedBy: .failedToLoad, lastPurchase: nil), .unavailable)
    }

    // MARK: - Where the flow goes

    func testALessonOrSettingsAsksSuperwallFirstForTeensAndAdults() {
        XCTAssertEqual(OfferRoute.firstStep(for: .premiumLesson(lessonId: "mushroom"), isChild: false,
                                            usesRemotePaywall: true), .remotePaywall)
        XCTAssertEqual(OfferRoute.firstStep(for: .settings, isChild: false, usesRemotePaywall: true), .remotePaywall)
        XCTAssertEqual(OfferRoute.firstStep(for: .settings, isChild: false, usesRemotePaywall: false), .paywall)
    }

    func testAChildsWayIsNeverAskedOfSuperwall() {
        XCTAssertEqual(OfferRoute.firstStep(for: .premiumLesson(lessonId: "mushroom"), isChild: true,
                                            usesRemotePaywall: true), .grownUp)
        XCTAssertEqual(OfferRoute.firstStep(for: .settings, isChild: true, usesRemotePaywall: true), .grownUp)
        XCTAssertEqual(OfferRoute.stepAfterMoreComing(isChild: true, usesRemotePaywall: true), .grownUp)
    }

    func testTheFirstRunStillOpensOnMoreComingThenAsksSuperwall() {
        XCTAssertEqual(OfferRoute.firstStep(for: .onboarding, isChild: false, usesRemotePaywall: true), .moreComing)
        XCTAssertEqual(OfferRoute.stepAfterMoreComing(isChild: false, usesRemotePaywall: true), .remotePaywall)
    }

    func testAPurchaseRestoreOrAskToBuyFromSuperwallGoesOnAsFromTheNativePaywall() {
        XCTAssertEqual(OfferRoute.next(afterRemotePaywall: .purchased, isPremium: true), .outcome(.purchased))
        XCTAssertEqual(OfferRoute.next(afterRemotePaywall: .restored, isPremium: true), .outcome(.restored))
        XCTAssertEqual(OfferRoute.next(afterRemotePaywall: .pending, isPremium: false), .outcome(.pending))
    }

    func testClosingSuperwallsPaywallEndsTheFlowWithNoSecondPaywall() {
        XCTAssertEqual(OfferRoute.next(afterRemotePaywall: .declined, isPremium: false), .finish(subscribed: false))
        XCTAssertEqual(OfferRoute.next(afterRemotePaywall: .declined, isPremium: true), .finish(subscribed: true))
    }

    func testNoSuperwallPaywallShowsTheNativeOneUnlessPremiumIsAlreadyThere() {
        XCTAssertEqual(OfferRoute.next(afterRemotePaywall: .unavailable, isPremium: false), .nativePaywall)
        XCTAssertEqual(OfferRoute.next(afterRemotePaywall: .unavailable, isPremium: true), .finish(subscribed: true))
    }

    // MARK: - Names the dashboard routes

    func testThePlacementNamesNeverChange() {
        XCTAssertEqual(PaywallPlacement(entry: .onboarding).name, "onboarding_offer")
        XCTAssertEqual(PaywallPlacement(entry: .premiumLesson(lessonId: "mushroom")).name, "premium_lesson")
        XCTAssertEqual(PaywallPlacement(entry: .settings).name, "settings_premium",
                       "The campaigns on the Superwall dashboard route these; rename nothing once shipped.")
    }

    func testOnlyALessonsIdRidesAlongWithAPlacement() {
        XCTAssertEqual(PaywallPlacement(entry: .premiumLesson(lessonId: "mushroom")).params, ["lesson_id": "mushroom"])
        XCTAssertEqual(PaywallPlacement(entry: .onboarding).params, [:])
        XCTAssertEqual(PaywallPlacement(entry: .settings).params, [:])
    }

    // MARK: - Premium, in Superwall's words

    func testSuperwallIsToldPremiumAsThePremiumEntitlement() {
        XCTAssertEqual(RemoteSubscriptionStatus(isPremium: true), .active(entitlements: ["premium"]))
        XCTAssertEqual(RemoteSubscriptionStatus(isPremium: false), .inactive)
    }

    func testAPurchaseThroughPremiumStoreIsReportedToSuperwall() {
        XCTAssertEqual(RemotePurchaseAnswer(.purchased), .purchased)
        XCTAssertEqual(RemotePurchaseAnswer(.restored), .purchased)
        XCTAssertEqual(RemotePurchaseAnswer(.pending), .pending)
        XCTAssertEqual(RemotePurchaseAnswer(.cancelled), .cancelled)
        XCTAssertEqual(RemotePurchaseAnswer(.failed), .failed)
    }

    func testARestoreWithNothingToRestoreIsStillAnAnswer() {
        XCTAssertEqual(RemoteRestoreAnswer(.restored), .restored)
        XCTAssertEqual(RemoteRestoreAnswer(.nothingToRestore), .restored,
                       "The SDK reads the inactive status and says there was nothing.")
        XCTAssertEqual(RemoteRestoreAnswer(.failed), .failed)
    }

    func testAProductIdNamesItsPlan() {
        XCTAssertEqual(PremiumStore.Plan(productId: PremiumStore.ProductID.yearly), .yearly)
        XCTAssertEqual(PremiumStore.Plan(productId: PremiumStore.ProductID.weekly), .weekly)
        XCTAssertNil(PremiumStore.Plan(productId: "com.example.other"))
    }

    // MARK: - Superwall's events in Analytics

    func testTheForwardedEventNamesNeverChange() {
        XCTAssertEqual(SuperwallPaywallEvent.allCases.map(\.rawValue), [
            "superwall_paywall_open", "superwall_paywall_close", "superwall_paywall_decline",
            "superwall_transaction_start", "superwall_transaction_complete", "superwall_transaction_fail",
            "superwall_transaction_abandon", "superwall_transaction_restore", "superwall_free_trial_start",
        ])
    }

    func testAForwardedEventCarriesThePaywallAndItsExperimentOnly() {
        let context = SuperwallPaywallContext(placement: "settings_premium", paywallId: "premium",
                                              experimentId: "123", variantId: "456")

        let event = AnalyticsEvent.superwallPaywall(.transactionComplete, context: context,
                                                    productId: PremiumStore.ProductID.yearly)

        XCTAssertEqual(event.name, "superwall_transaction_complete")
        XCTAssertEqual(event.properties, ["placement": "settings_premium", "paywall_id": "premium",
                                          "experiment_id": "123", "variant_id": "456",
                                          "product_id": PremiumStore.ProductID.yearly])
    }

    func testATriggerWithoutAnExperimentLeavesItsIdsOut() {
        let event = AnalyticsEvent.superwallTriggerFired(placement: "premium_lesson", result: "no_audience_match",
                                                         experimentId: nil, variantId: nil)

        XCTAssertEqual(event.name, "superwall_trigger_fire")
        XCTAssertEqual(event.properties, ["placement": "premium_lesson", "trigger_result": "no_audience_match"])
    }

    // MARK: - AppModel tells it who is drawing

    func testTheTestsNeverStartSuperwall() {
        let model = AppModel(bundle: .appUnderTest, settings: Settings(defaults: defaults), storeDirectory: base)

        XCTAssertTrue(model.paywalls is NativePaywallsOnly)
        XCTAssertFalse(model.paywalls.canPresent)
        var answer: RemotePaywallResult?
        model.paywalls.present(.settingsPremium) { answer = $0 }
        XCTAssertEqual(answer, .unavailable)
    }

    func testLaunchPassesWhoIsDrawingAndWhetherThePickerWillAsk() {
        let paywalls = RecordingPaywalls()
        let model = makeModel(paywalls: paywalls)
        model.setAgeGroup(model.activeProfile.id, to: .adult)
        paywalls.calls = []

        model.startRemotePaywalls(waitingForPicker: true)

        XCTAssertEqual(paywalls.calls, [.launch(.adult, waitingForPicker: true)])
    }

    func testSwitchingLearnersOrAnsweringWithTheSameOneTellsSuperwall() throws {
        let paywalls = RecordingPaywalls()
        let model = makeModel(paywalls: paywalls)
        let first = model.activeProfile
        let teen = try XCTUnwrap(model.addProfile(name: "Maya", avatar: .owl, ageGroup: .from13To15))
        XCTAssertEqual(paywalls.calls, [], "Adding a learner who is not drawing changes nothing.")

        model.switchProfile(to: teen.id)
        model.switchProfile(to: teen.id)
        model.switchProfile(to: first.id)

        XCTAssertEqual(paywalls.calls, [.learnerDidChange(.teen), .learnerDidChange(.teen), .learnerDidChange(.child)])
    }

    func testChangingTheActiveLearnersAgeGroupTellsSuperwall() throws {
        let paywalls = RecordingPaywalls()
        let model = makeModel(paywalls: paywalls)
        let other = try XCTUnwrap(model.addProfile(name: "Sam", avatar: .frog))

        model.setAgeGroup(model.activeProfile.id, to: .from16To17)
        model.setAgeGroup(other.id, to: .adult)
        model.setAgeGroup(model.activeProfile.id, to: .from6To9)

        XCTAssertEqual(paywalls.calls, [.learnerDidChange(.teen), .learnerDidChange(.child)],
                       "Only the learner who is drawing counts.")
    }

    // MARK: - Helpers

    private func makeModel(paywalls: RemotePaywalls) -> AppModel {
        AppModel(bundle: .appUnderTest,
                 settings: Settings(defaults: defaults),
                 storeDirectory: base,
                 paywalls: paywalls)
    }
}

/// Keeps everything `AppModel` told Superwall's door.
@MainActor
private final class RecordingPaywalls: RemotePaywalls {
    enum Call: Equatable {
        case launch(PrivacyTier, waitingForPicker: Bool)
        case learnerDidChange(PrivacyTier)
    }

    var calls: [Call] = []

    func launch(tier: PrivacyTier, waitingForPicker: Bool) {
        calls.append(.launch(tier, waitingForPicker: waitingForPicker))
    }

    func learnerDidChange(tier: PrivacyTier) {
        calls.append(.learnerDidChange(tier))
    }

    var canPresent: Bool { false }

    func present(_ placement: PaywallPlacement, completion: @escaping (RemotePaywallResult) -> Void) {
        completion(.unavailable)
    }
}
