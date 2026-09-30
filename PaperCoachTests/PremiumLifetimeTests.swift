import StoreKit
import XCTest
@testable import PaperCoach

/// Premium Lifetime, a one-time purchase outside the subscription group, and codes
/// redeemed in Settings. What `refreshEntitlements` reads of each transaction
/// (`PremiumStore.Holding`) is built here by hand: nothing is bought.
@MainActor
final class PremiumLifetimeTests: XCTestCase {

    private static let lifetime = PremiumStore.ProductID.lifetime

    private var defaults: UserDefaults!
    private lazy var sink = CapturingSink()

    override func setUp() {
        super.setUp()
        defaults = CatalogLoaderTests.scratchDefaults()
    }

    override func tearDown() {
        defaults = nil
        super.tearDown()
    }

    // MARK: - What unlocks Premium

    func testLifetimeUnlocksPremiumBoughtOrShared() {
        let own = Self.holding()
        let shared = Self.holding(familyShared: true)

        XCTAssertTrue(PremiumStore.Entitlement([own]).isActive)
        XCTAssertTrue(PremiumStore.Entitlement([shared]).isActive, "Family Sharing is on: a grown-up's Lifetime is the family's.")
        XCTAssertTrue(PremiumStore.Entitlement([Self.holding(fromCode: true)]).isActive, "A friend's free code is Lifetime too.")
    }

    func testARefundedLifetimeUnlocksNothing() {
        let refunded = Self.holding(revoked: Date())

        XCTAssertFalse(refunded.unlocksPremium)
        XCTAssertFalse(PremiumStore.Entitlement([refunded]).isActive)
    }

    func testLifetimeHasNoFreeWeek() {
        let entitlement = PremiumStore.Entitlement([Self.holding()])

        XCTAssertNil(entitlement.trialEndsAt)
        XCTAssertNil(entitlement.trialProductID)
    }

    func testAFreeWeekStillRunningBesideLifetimeKeepsItsReminder() {
        // Someone given Lifetime during a Yearly free week: the week still ends in a
        // charge, so the reminder still applies.
        let weekEnds = Date(timeIntervalSinceReferenceDate: 812_000_000)
        let trial = PremiumStore.Holding(productID: PremiumStore.ProductID.yearly,
                                         subscriptionGroupID: PremiumStore.subscriptionGroupID,
                                         revocationDate: nil,
                                         isFreeTrial: true,
                                         expirationDate: weekEnds)

        let entitlement = PremiumStore.Entitlement([Self.holding(), trial])

        XCTAssertEqual(entitlement.trialEndsAt, weekEnds)
        XCTAssertEqual(entitlement.trialProductID, PremiumStore.ProductID.yearly)
    }

    // MARK: - Codes

    func testACodeThatBringsPremiumIsReportedOnce() {
        XCTAssertTrue(Self.holding(fromCode: true).bringsPremiumFromCode)
        XCTAssertTrue(Self.holding(familyShared: true, fromCode: true).bringsPremiumFromCode)

        XCTAssertFalse(Self.holding().bringsPremiumFromCode, "Bought, not redeemed.")
        XCTAssertFalse(Self.holding(fromCode: true, revoked: Date()).bringsPremiumFromCode)
        let renewal = PremiumStore.Holding(productID: PremiumStore.ProductID.yearly,
                                           subscriptionGroupID: PremiumStore.subscriptionGroupID,
                                           revocationDate: nil, isFreeTrial: false, expirationDate: nil,
                                           isFromCode: true, isRenewal: true)
        XCTAssertFalse(renewal.bringsPremiumFromCode, "A code's later free months are not another code.")
        let elsewhere = PremiumStore.Holding(productID: "com.softroni.papercoach.other", subscriptionGroupID: "99999999",
                                             revocationDate: nil, isFreeTrial: false, expirationDate: nil,
                                             isFromCode: true)
        XCTAssertFalse(elsewhere.bringsPremiumFromCode)
    }

    func testACodeReachesAnalyticsWithItsPlan() {
        let model = makeModel()

        model.premium.onPremiumFromCode?("lifetime")

        XCTAssertEqual(sink.captured.last?.name, "premium_from_code")
        XCTAssertEqual(sink.captured.last?.properties["plan"], "lifetime")
    }

    func testTheEventNamesNeverChange() {
        XCTAssertEqual(AnalyticsEvent.offerCodeSheetOpened.name, "offer_code_sheet_opened")
        XCTAssertEqual(AnalyticsEvent.premiumFromCode(plan: "lifetime"),
                       AnalyticsEvent(name: "premium_from_code", properties: ["plan": "lifetime"]))
        XCTAssertEqual(AnalyticsEvent.purchaseAttempted(plan: PremiumStore.Plan.lifetime.rawValue, outcome: "purchased").properties,
                       ["plan": "lifetime", "outcome": "purchased"])
    }

    // MARK: - "Redeem a code" in Settings

    func testRedeemingACodeIsBehindTheGrownUpsCheckForAChild() {
        for ageGroup in [AgeGroup.from6To9, .preferNotToSay] {
            let model = makeModel()
            model.setAgeGroup(model.activeProfile.id, to: ageGroup)
            XCTAssertEqual(model.grownUpCheckBeforePremium, .question, ageGroup.rawValue)
        }

        let withPIN = makeModel()
        withPIN.setAgeGroup(withPIN.activeProfile.id, to: .from6To9)
        withPIN.pin.set("2468")
        XCTAssertEqual(withPIN.grownUpCheckBeforePremium, .pin, "The PIN guards Premium once there is one.")
    }

    func testRedeemingACodeIsStraightAwayFor13AndOver() {
        for ageGroup in [AgeGroup.from13To15, .from16To17, .adult] {
            let model = makeModel()
            model.setAgeGroup(model.activeProfile.id, to: ageGroup)
            model.pin.set("2468")
            XCTAssertEqual(model.grownUpCheckBeforePremium, .notNeeded, ageGroup.rawValue)
        }
    }

    // MARK: - The plans sheet

    func testThePlansSheetListsLifetimeLastWithYearlyChosen() {
        XCTAssertEqual(PaywallPlansSheet.plans { _ in true }, [.yearly, .weekly, .lifetime])
        XCTAssertEqual(PaywallPlansSheet.initialPlan, .yearly, "Lifetime is never chosen for the learner.")
        XCTAssertEqual(PaywallPlansSheet.plans { $0 != .lifetime }, [.yearly, .weekly],
                       "Without its product from StoreKit, no Lifetime row and no made-up price.")
    }

    func testThePlansSheetSubtitleSaysLifetimeIsOnePayment() {
        XCTAssertEqual(PaywallPlansSheet.subtitle(for: .lifetime), "Paper Coach Premium · one payment",
                       "Lifetime never renews.")
        XCTAssertEqual(PaywallPlansSheet.subtitle(for: .yearly), "Paper Coach Premium · auto-renewing")
        XCTAssertEqual(PaywallPlansSheet.subtitle(for: .weekly), "Paper Coach Premium · auto-renewing")
        XCTAssertEqual(PaywallPlansSheet.subtitle(for: PaywallPlansSheet.initialPlan),
                       "Paper Coach Premium · auto-renewing", "The sheet opens on Yearly.")
    }

    /// The three plans as the App Store sandbox gives them, which is what
    /// `xcodebuild test` asks (the scheme's `PaperCoach.storekit` is only for Run).
    /// Skipped offline, and until Lifetime exists in App Store Connect.
    func testTheLoadedPlansFillTheSheetAndReportTheirPlans() async throws {
        let store = PremiumStore(defaults: defaults)
        await store.loadProducts()
        guard store.lifetime != nil, store.yearly != nil, store.weekly != nil else {
            throw XCTSkip("The App Store gave Yearly \(store.yearly != nil), Weekly \(store.weekly != nil), Lifetime \(store.lifetime != nil).")
        }

        XCTAssertEqual(PaywallPlansSheet.plans { store.product(for: $0) != nil }, [.yearly, .weekly, .lifetime])
        XCTAssertEqual(store.lifetimePrice, "$99.99")
        XCTAssertEqual(store.lifetime?.type, .nonConsumable)
        XCTAssertEqual(store.lifetime.flatMap(PremiumStore.Plan.init), .lifetime)
        XCTAssertEqual(store.yearly.flatMap(PremiumStore.Plan.init), .yearly)
        XCTAssertEqual(store.weekly.flatMap(PremiumStore.Plan.init), .weekly)
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

    private static func holding(familyShared: Bool = false, fromCode: Bool = false,
                                revoked: Date? = nil) -> PremiumStore.Holding {
        PremiumStore.Holding(productID: lifetime,
                             subscriptionGroupID: nil,
                             revocationDate: revoked,
                             isFreeTrial: false,
                             expirationDate: nil,
                             isFamilyShared: familyShared,
                             isFromCode: fromCode)
    }
}

/// Keeps every event the app would have sent.
@MainActor
private final class CapturingSink: AnalyticsSink {
    private(set) var captured: [AnalyticsEvent] = []

    func identify(distinctId: String, properties: [String: String], policy: AnalyticsPolicy) {}

    func capture(_ event: AnalyticsEvent, distinctId: String, policy: AnalyticsPolicy) {
        captured.append(event)
    }

    func reset() {}
}
