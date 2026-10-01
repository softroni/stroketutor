import UIKit
import XCTest
@testable import PaperCoach

/// Sharing a drawing (`DrawingShare`): the words and the link that go with the card,
/// who is asked first, the card itself, and the two events.
@MainActor
final class DrawingShareTests: XCTestCase {

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

    // MARK: - The words and the link

    func testTheLinkIsTaggedSoAppStoreConnectCountsTheDownloadsItBrings() {
        XCTAssertEqual(AppStoreListing.campaignURL(.shareSaved)?.absoluteString,
                       "https://apps.apple.com/app/apple-store/id6816231257?pt=128560181&ct=app-share-saved&mt=8")
        XCTAssertEqual(AppStoreListing.campaignURL(.shareSettings)?.absoluteString,
                       "https://apps.apple.com/app/apple-store/id6816231257?pt=128560181&ct=app-share-settings&mt=8")
    }

    func testEveryPlaceThatHandsOutTheLinkHasItsOwnCampaign() {
        let campaigns = AppStoreListing.Campaign.allCases.map(\.rawValue)
        XCTAssertEqual(campaigns, ["app-share-saved", "app-share-sketchbook", "app-share-sketchbook-bar", "app-share-settings"],
                       "These are App Store Connect's campaign names: add new ones, never rename one.")
        for campaign in campaigns {
            XCTAssertTrue(campaign.hasPrefix("app-"), "Apart from the social posts' campaigns: \(campaign)")
            XCTAssertLessThanOrEqual(campaign.count, 40, "Apple's limit for a campaign token: \(campaign)")
        }

        let entries: [DrawingShare.Entry] = [.sketchbook, .sketchbookBar, .saved]
        XCTAssertEqual(Set(entries.map(\.campaign)).count, entries.count, "Each share button, its own campaign.")
        XCTAssertFalse(entries.map(\.campaign).contains(.shareSettings))
    }

    func testSomeone13OrOverInvitesTheFriendToDrawItToo() {
        let link = URL(string: "https://apps.apple.com/app/id6816231257")!
        XCTAssertEqual(DrawingShare.message(forChild: false, link: link),
                       "I drew this with Paper Coach. Can you draw it too? https://apps.apple.com/app/id6816231257")
    }

    func testAChildsDrawingGoesOutInTheGrownUpsWords() {
        let message = DrawingShare.message(forChild: true, link: nil)
        XCTAssertEqual(message, "Look at this drawing, made with Paper Coach!")
        XCTAssertFalse(message.contains("I drew"), "The grown-up sends it, so the words say nothing about who drew it.")
    }

    func testTheWordsStayOffWhereTheyWouldOnlyGetInTheWay() {
        for activity: UIActivity.ActivityType in [.airDrop, .saveToCameraRoll, .print] {
            XCTAssertFalse(SharedTextItem.carriesText(activity), activity.rawValue)
        }
        for activity: UIActivity.ActivityType in [.message, .mail, UIActivity.ActivityType("net.whatsapp.WhatsApp.ShareExtension")] {
            XCTAssertTrue(SharedTextItem.carriesText(activity), activity.rawValue)
        }
    }

    // MARK: - Who is asked first

    func testAChildsShareWaitsForAGrownUp() {
        for ageGroup in [AgeGroup.under6, .from6To9, .from10To12, .preferNotToSay] {
            let model = makeModel()
            model.setAgeGroup(model.activeProfile.id, to: ageGroup)
            XCTAssertEqual(model.grownUpCheckBeforeSharing, .question, ageGroup.rawValue)
        }

        let withPIN = makeModel()
        withPIN.setAgeGroup(withPIN.activeProfile.id, to: .from6To9)
        withPIN.pin.set("2468")
        XCTAssertEqual(withPIN.grownUpCheckBeforeSharing, .pin, "Once there is a PIN, the PIN is the grown-up's check.")
    }

    func testSomeone13OrOverSharesStraightAway() {
        for ageGroup in [AgeGroup.from13To15, .from16To17, .adult] {
            let model = makeModel()
            model.setAgeGroup(model.activeProfile.id, to: ageGroup)
            model.pin.set("2468")
            XCTAssertEqual(model.grownUpCheckBeforeSharing, .notNeeded, ageGroup.rawValue)
        }
    }

    // MARK: - The card

    func testTheCardIs1080By1350() throws {
        let card = try XCTUnwrap(DrawingShare.card(photo: Self.photo(), tutorial: nil, title: "Ice Cream Cone", tint: nil))
        XCTAssertEqual(card.size.width * card.scale, 1080)
        XCTAssertEqual(card.size.height * card.scale, 1350)
    }

    func testNothingGoesOutWithoutAPhoto() throws {
        let model = makeModel()
        let page = try XCTUnwrap(model.sketchbook.add(image: Self.photo(), lessonId: "rocket", pathId: "space"))

        XCTAssertFalse(DrawingShare.share(page, photo: nil, app: model, entry: .sketchbook, from: ShareAnchor()),
                       "The photo has gone from the device: there is no card to make.")
        XCTAssertFalse(sink.captured.contains { $0.name == "drawing_share_opened" })
    }

    // MARK: - Events

    func testTheEventNamesNeverChange() {
        XCTAssertEqual(AnalyticsEvent.drawingShareOpened(lessonId: "rocket", pathId: "space", entry: "saved"),
                       AnalyticsEvent(name: "drawing_share_opened",
                                      properties: ["lesson_id": "rocket", "path_id": "space", "entry": "saved"]))
        XCTAssertEqual(AnalyticsEvent.drawingShared(lessonId: "rocket", pathId: "space", entry: "sketchbook",
                                                    activity: "com.apple.UIKit.activity.Message"),
                       AnalyticsEvent(name: "drawing_shared",
                                      properties: ["lesson_id": "rocket", "path_id": "space", "entry": "sketchbook",
                                                   "activity": "com.apple.UIKit.activity.Message"]))
        XCTAssertEqual(DrawingShare.Entry.sketchbook.rawValue, "sketchbook")
        XCTAssertEqual(DrawingShare.Entry.sketchbookBar.rawValue, "sketchbook_bar")
        XCTAssertEqual(DrawingShare.Entry.saved.rawValue, "saved")
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

    /// A plain white page, 3 : 4, as a photographed sheet is.
    private static func photo() -> UIImage {
        let size = CGSize(width: 300, height: 400)
        return UIGraphicsImageRenderer(size: size).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
        }
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
