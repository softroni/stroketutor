import CoreGraphics
import XCTest
@testable import StrokeTutor

/// The sketchbook rule: which drawings get the wide page on their side and the
/// "turn sideways" nudge upright. The line is 4:3 either way, so the rule is only
/// ever applied to a plainly oblong drawing.
final class PageShapeTests: XCTestCase {

    func testAnOblongDrawingIsWideAndItsTurnIsTall() {
        XCTAssertEqual(PageShape(fitting: CGRect(x: 0, y: 0, width: 800, height: 400)), .wide)
        XCTAssertEqual(PageShape(fitting: CGRect(x: 0, y: 0, width: 400, height: 800)), .tall)
    }

    func testNearSquareDrawingsChangeNothing() {
        XCTAssertEqual(PageShape(fitting: CGRect(x: 0, y: 0, width: 500, height: 500)), .square)
        XCTAssertEqual(PageShape(fitting: CGRect(x: 0, y: 0, width: 600, height: 500)), .square)
        XCTAssertEqual(PageShape(fitting: CGRect(x: 0, y: 0, width: 500, height: 600)), .square)
    }

    func testTheLineIsFourToThreeInclusive() {
        XCTAssertEqual(PageShape(fitting: CGRect(x: 0, y: 0, width: 400, height: 300)), .wide)
        XCTAssertEqual(PageShape(fitting: CGRect(x: 0, y: 0, width: 300, height: 400)), .tall)
        XCTAssertEqual(PageShape(fitting: CGRect(x: 0, y: 0, width: 399, height: 300)), .square)
        XCTAssertEqual(PageShape(fitting: CGRect(x: 0, y: 0, width: 300, height: 399)), .square)
    }

    func testAnEmptyDrawingIsSquare() {
        XCTAssertEqual(PageShape(fitting: .zero), .square)
        XCTAssertEqual(PageShape(fitting: CGRect(x: 0, y: 0, width: 100, height: 0)), .square)
    }

    /// The two shipped lessons the rule was made for, read from the bundle the app
    /// ships: the car gets the wide page, the palm tree — upright, a little taller
    /// than it is wide once its fronds are counted — keeps the panel.
    func testTheCarIsWideAndThePalmTreeIsNot() throws {
        let tutorials = TutorialLoader.loadBundledTutorials(in: .appUnderTest).tutorials
        let car = try XCTUnwrap(tutorials.first { $0.tutorialID == "classic-red-car" })
        let palm = try XCTUnwrap(tutorials.first { $0.tutorialID == "palm-tree-4" })
        XCTAssertEqual(car.pageShape, .wide)
        XCTAssertNotEqual(palm.pageShape, .wide)
    }
}
