import StoreKit
import XCTest
@testable import PaperCoach

/// Premium is any product in its subscription group, not two fixed ids: a price
/// test's new product must unlock what it charges for, name its own price when its
/// free week starts, and be reported as its plan. What `refreshEntitlements` reads
/// of each transaction (`PremiumStore.Holding`) is built here by hand: nothing is
/// bought.
final class PremiumGroupTests: XCTestCase {

    private static let premiumGroup = PremiumStore.subscriptionGroupID
    private static let priceTestYearly = "com.softroni.papercoach.premium.yearly.pricetest"
    private static let otherGroupYearly = "com.softroni.papercoach.other.yearly"

    // MARK: - What unlocks Premium

    func testAProductPremiumDoesNotListUnlocksItFromPremiumsGroup() {
        let entitlement = PremiumStore.Entitlement([Self.holding(Self.priceTestYearly, group: Self.premiumGroup)])

        XCTAssertTrue(entitlement.isActive, "A price test's product unlocks what it charges for.")
    }

    func testAProductFromAnotherGroupUnlocksNothing() {
        let entitlement = PremiumStore.Entitlement([
            Self.holding(Self.otherGroupYearly, group: "99999999", freeTrialEnds: Self.nextWeek),
            Self.holding(Self.otherGroupYearly, group: nil),
        ])

        XCTAssertFalse(entitlement.isActive)
        XCTAssertNil(entitlement.trialEndsAt, "Nor is its free week Premium's.")
        XCTAssertNil(entitlement.trialProductID)
    }

    func testARefundUnlocksNothingInTheGroupOrOut() {
        for productID in [Self.priceTestYearly, PremiumStore.ProductID.yearly, PremiumStore.ProductID.weekly] {
            let refunded = Self.holding(productID, group: Self.premiumGroup, revoked: Date())
            XCTAssertFalse(refunded.unlocksPremium, productID)
            XCTAssertFalse(PremiumStore.Entitlement([refunded]).isActive, productID)
        }
    }

    func testTheTwoPlansUnlockPremiumWhateverTheirGroupSays() {
        for productID in PremiumStore.ProductID.all {
            XCTAssertTrue(Self.holding(productID, group: Self.premiumGroup).unlocksPremium, productID)
            XCTAssertTrue(Self.holding(productID, group: nil).unlocksPremium, productID)
        }
    }

    func testNothingHeldIsNoPremium() {
        let entitlement = PremiumStore.Entitlement([])

        XCTAssertFalse(entitlement.isActive)
        XCTAssertNil(entitlement.trialEndsAt)
    }

    // MARK: - The free week

    func testAFreeWeekOnAPriceTestProductIsThatProducts() {
        let entitlement = PremiumStore.Entitlement([
            Self.holding(Self.otherGroupYearly, group: "99999999", freeTrialEnds: Self.nextWeek.addingTimeInterval(86_400)),
            Self.holding(Self.priceTestYearly, group: Self.premiumGroup, freeTrialEnds: Self.nextWeek),
        ])

        XCTAssertTrue(entitlement.isActive)
        XCTAssertEqual(entitlement.trialEndsAt, Self.nextWeek)
        XCTAssertEqual(entitlement.trialProductID, Self.priceTestYearly,
                       "So \"trial started\" names this product's price, not Yearly's.")
    }

    func testAPaidSubscriptionHasNoFreeWeek() {
        let entitlement = PremiumStore.Entitlement([Self.holding(PremiumStore.ProductID.yearly, group: Self.premiumGroup)])

        XCTAssertTrue(entitlement.isActive)
        XCTAssertNil(entitlement.trialEndsAt)
        XCTAssertNil(entitlement.trialProductID)
    }

    func testThePriceAfterAFreeWeekFollowsTheProductsPeriod() {
        XCTAssertEqual(PremiumStore.price("$39.99", per: .yearly), "$39.99/year")
        XCTAssertEqual(PremiumStore.price("$2.99", per: .weekly), "$2.99/week")
        XCTAssertNil(PremiumStore.price("$4.99", per: .monthly), "The screen names the plan rather than guess.")
    }

    // MARK: - The plan a product is reported as

    func testAPeriodNamesItsPlan() {
        XCTAssertEqual(PremiumStore.Plan(period: .yearly), .yearly)
        XCTAssertEqual(PremiumStore.Plan(period: .weekly), .weekly)
        XCTAssertNil(PremiumStore.Plan(period: .monthly))
        XCTAssertNil(PremiumStore.Plan(period: .everySixMonths))
        XCTAssertNil(PremiumStore.Plan(period: .everyTwoWeeks))
    }

    /// The two plans as StoreKit loads them, where it can: with the scheme's
    /// `PaperCoach.storekit`, as `xcodebuild test` runs it. Elsewhere there may be no
    /// App Store to ask.
    /// App Store Connect's own group id is checked against `subscriptionGroupID` by
    /// hand: `GET /v1/apps/6816231257/subscriptionGroups` said 22413930 on 2026-09-30.
    @MainActor
    func testTheLoadedPlansAreReportedByHowOftenTheyRenew() async throws {
        let products = (try? await Product.products(for: PremiumStore.ProductID.all)) ?? []
        guard products.count == PremiumStore.ProductID.all.count else {
            throw XCTSkip("StoreKit returned \(products.count) of the two plans here.")
        }
        let plans = Dictionary(uniqueKeysWithValues: products.map { ($0.id, PremiumStore.Plan($0)) })

        XCTAssertEqual(plans, [PremiumStore.ProductID.yearly: .yearly, PremiumStore.ProductID.weekly: .weekly])
        XCTAssertEqual(Set(products.compactMap { $0.subscription?.subscriptionGroupID }), [PremiumStore.subscriptionGroupID],
                       "Both plans are in the group Premium recognises.")
    }

    // MARK: - Fixtures

    private static let nextWeek = Date(timeIntervalSinceReferenceDate: 812_000_000)

    private static func holding(_ productID: String, group: String?, revoked: Date? = nil,
                                freeTrialEnds: Date? = nil) -> PremiumStore.Holding {
        PremiumStore.Holding(productID: productID,
                             subscriptionGroupID: group,
                             revocationDate: revoked,
                             isFreeTrial: freeTrialEnds != nil,
                             expirationDate: freeTrialEnds ?? nextWeek.addingTimeInterval(365 * 86_400))
    }
}
