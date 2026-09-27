import CoreGraphics
import XCTest
@testable import PaperCoach

/// Which anatomy the player takes for a window, and the sheet of paper the big
/// screen shows under the drawing. The first iPad build chose by
/// `verticalSizeClass`, which is regular on an iPad both ways up, so an iPad on its
/// side kept the upright phone layout stretched across it.
final class PlayerLayoutTests: XCTestCase {

    // MARK: - PlayerLayout

    func testPhonesKeepTheirTwoLayouts() {
        // iPhone 17 Pro Max, upright and on its side; iPhone SE-sized, the same.
        XCTAssertEqual(PlayerLayout.choose(for: CGSize(width: 440, height: 956), isAccessibilitySize: false), .portrait)
        XCTAssertEqual(PlayerLayout.choose(for: CGSize(width: 956, height: 440), isAccessibilitySize: false), .landscape)
        XCTAssertEqual(PlayerLayout.choose(for: CGSize(width: 375, height: 667), isAccessibilitySize: false), .portrait)
        XCTAssertEqual(PlayerLayout.choose(for: CGSize(width: 667, height: 375), isAccessibilitySize: false), .landscape)
    }

    func testAnIPadOnItsSideGetsTheStudio() {
        // 13-inch and 11-inch, on their sides.
        XCTAssertEqual(PlayerLayout.choose(for: CGSize(width: 1376, height: 1032), isAccessibilitySize: false), .studio)
        XCTAssertEqual(PlayerLayout.choose(for: CGSize(width: 1194, height: 834), isAccessibilitySize: false), .studio)
    }

    func testAnUprightIPadIsRoomy() {
        XCTAssertEqual(PlayerLayout.choose(for: CGSize(width: 1032, height: 1376), isAccessibilitySize: false), .roomyPortrait)
        XCTAssertEqual(PlayerLayout.choose(for: CGSize(width: 834, height: 1194), isAccessibilitySize: false), .roomyPortrait)
    }

    func testANarrowIPadWindowIsLaidOutLikeAPhone() {
        // A third of the screen beside another app.
        XCTAssertEqual(PlayerLayout.choose(for: CGSize(width: 375, height: 1032), isAccessibilitySize: false), .portrait)
        // A short, wide window: the phone on its side.
        XCTAssertEqual(PlayerLayout.choose(for: CGSize(width: 1000, height: 520), isAccessibilitySize: false), .landscape)
    }

    func testAccessibilitySizesNeverGetASidePanel() {
        XCTAssertEqual(PlayerLayout.choose(for: CGSize(width: 956, height: 440), isAccessibilitySize: true), .portrait)
        // An iPad on its side keeps the page, over the sheet, where the words can grow.
        XCTAssertEqual(PlayerLayout.choose(for: CGSize(width: 1376, height: 1032), isAccessibilitySize: true), .roomyPortrait)
    }

    func testOnlyTheBigScreenLayoutsAreRoomy() {
        XCTAssertTrue(PlayerLayout.studio.isRoomy)
        XCTAssertTrue(PlayerLayout.roomyPortrait.isRoomy)
        XCTAssertFalse(PlayerLayout.portrait.isRoomy)
        XCTAssertFalse(PlayerLayout.landscape.isRoomy)
    }

    // MARK: - PageSheet

    func testAWideDrawingGetsTheSheetOnItsSide() {
        XCTAssertTrue(PageSheet(shape: .wide).isLandscape)
        XCTAssertFalse(PageSheet(shape: .tall).isLandscape)
        XCTAssertFalse(PageSheet(shape: .square).isLandscape)
    }

    func testTheSheetFillsTheAreaAtPaperProportions() {
        let area = CGRect(x: 0, y: 0, width: 1000, height: 800)
        let upright = PageSheet(shape: .tall).sheetRect(in: area)
        XCTAssertEqual(upright.height, 800, accuracy: 0.01, "An upright sheet in a wide area is as tall as it")
        XCTAssertEqual(upright.height / upright.width, PageSheet.ratio, accuracy: 0.001)
        XCTAssertEqual(upright.midX, area.midX, accuracy: 0.01)
        XCTAssertEqual(upright.midY, area.midY, accuracy: 0.01)

        let onItsSide = PageSheet(shape: .wide).sheetRect(in: area)
        XCTAssertEqual(onItsSide.width, 1000, accuracy: 0.01, "A sheet on its side in a wide area is as wide as it")
        XCTAssertEqual(onItsSide.width / onItsSide.height, PageSheet.ratio, accuracy: 0.001)
        XCTAssertLessThanOrEqual(onItsSide.height, area.height)
    }

    func testTheDrawingKeepsTheSheetsMargin() {
        let sheet = CGRect(x: 100, y: 50, width: 500, height: 707)
        let drawing = PageSheet(shape: .tall).drawingRect(in: sheet)
        let margin = 500 * PageSheet.margin
        XCTAssertEqual(drawing.minX - sheet.minX, margin, accuracy: 0.01)
        XCTAssertEqual(sheet.maxY - drawing.maxY, margin, accuracy: 0.01)
        XCTAssertTrue(sheet.contains(drawing))
    }

    func testAnEmptyAreaHasNoSheet() {
        XCTAssertEqual(PageSheet(shape: .tall).sheetRect(in: .zero), .zero)
    }

    // MARK: - The steps panel

    func testStepTitlesStartWithACapitalInTheList() {
        XCTAssertEqual(PlayerStepList.sentenceCase("the roof"), "The roof")
        XCTAssertEqual(PlayerStepList.sentenceCase("Draw the trunk"), "Draw the trunk")
        XCTAssertEqual(PlayerStepList.sentenceCase(""), "")
    }
}
