import CoreGraphics
import XCTest
@testable import PaperCoach

final class SVGPathParserTests: XCTestCase {

    // MARK: - Individual commands

    func testMoveAndLine() throws {
        let segments = try SVGPathParser.parseSegments("M 10 20 L 30 40")
        XCTAssertEqual(segments, [
            .move(CGPoint(x: 10, y: 20)),
            .line(CGPoint(x: 30, y: 40))
        ])
    }

    func testCubicCurve() throws {
        let segments = try SVGPathParser.parseSegments("M 0 0 C 1 2 3 4 5 6")
        XCTAssertEqual(segments, [
            .move(CGPoint(x: 0, y: 0)),
            .cubic(control1: CGPoint(x: 1, y: 2),
                   control2: CGPoint(x: 3, y: 4),
                   end: CGPoint(x: 5, y: 6))
        ])
    }

    func testQuadraticCurve() throws {
        let segments = try SVGPathParser.parseSegments("M 0 0 Q 10 20 30 40")
        XCTAssertEqual(segments, [
            .move(CGPoint(x: 0, y: 0)),
            .quad(control: CGPoint(x: 10, y: 20), end: CGPoint(x: 30, y: 40))
        ])
    }

    func testClosePath() throws {
        let segments = try SVGPathParser.parseSegments("M 0 0 L 10 0 L 10 10 Z")
        XCTAssertEqual(segments.last, .close)
        XCTAssertEqual(segments.count, 4)
    }

    func testLowercaseZIsAcceptedBecauseCloseHasNoDirection() throws {
        let segments = try SVGPathParser.parseSegments("M 0 0 L 10 0 z")
        XCTAssertEqual(segments.last, .close)
    }

    // MARK: - Separators and repetition

    func testCommaSeparators() throws {
        let segments = try SVGPathParser.parseSegments("M10,20L30,40")
        XCTAssertEqual(segments, [
            .move(CGPoint(x: 10, y: 20)),
            .line(CGPoint(x: 30, y: 40))
        ])
    }

    func testMixedSeparatorsAndNewlines() throws {
        let segments = try SVGPathParser.parseSegments("  M 10 , 20 \n\t L30 40  ")
        XCTAssertEqual(segments, [
            .move(CGPoint(x: 10, y: 20)),
            .line(CGPoint(x: 30, y: 40))
        ])
    }

    func testRepeatedCoordinatePairsAfterOneCommandLetter() throws {
        let segments = try SVGPathParser.parseSegments("M 0 0 L 10 10 20 20")
        XCTAssertEqual(segments, [
            .move(CGPoint(x: 0, y: 0)),
            .line(CGPoint(x: 10, y: 10)),
            .line(CGPoint(x: 20, y: 20))
        ])
    }

    func testRepeatedCubicSets() throws {
        let segments = try SVGPathParser.parseSegments("M 0 0 C 1 1 2 2 3 3 4 4 5 5 6 6")
        XCTAssertEqual(segments.count, 3)
        XCTAssertEqual(segments[2], .cubic(control1: CGPoint(x: 4, y: 4),
                                           control2: CGPoint(x: 5, y: 5),
                                           end: CGPoint(x: 6, y: 6)))
    }

    func testExtraPairsAfterMoveBecomeLines() throws {
        // Matches the SVG grammar: only the first pair of an M is a moveto.
        let segments = try SVGPathParser.parseSegments("M 0 0 10 10")
        XCTAssertEqual(segments, [
            .move(CGPoint(x: 0, y: 0)),
            .line(CGPoint(x: 10, y: 10))
        ])
    }

    func testNegativeDecimalAndExponentNumbers() throws {
        let segments = try SVGPathParser.parseSegments("M -1.5 +2.25 L 1e2 -3.5e-1")
        XCTAssertEqual(segments, [
            .move(CGPoint(x: -1.5, y: 2.25)),
            .line(CGPoint(x: 100, y: -0.35))
        ])
    }

    // MARK: - Multiple subpaths

    func testMultipleSubpaths() throws {
        let segments = try SVGPathParser.parseSegments("M 0 0 L 10 0 M 20 20 L 30 20 M 40 40 L 50 40")
        XCTAssertEqual(segments.count, 6)
        XCTAssertEqual(segments[0], .move(CGPoint(x: 0, y: 0)))
        XCTAssertEqual(segments[2], .move(CGPoint(x: 20, y: 20)))
        XCTAssertEqual(segments[4], .move(CGPoint(x: 40, y: 40)))
    }

    func testClosedSubpathFollowedByAnother() throws {
        let segments = try SVGPathParser.parseSegments("M 0 0 L 10 0 L 10 10 Z M 50 50 L 60 60 Z")
        XCTAssertEqual(segments.filter { $0 == .close }.count, 2)
        XCTAssertEqual(segments[4], .move(CGPoint(x: 50, y: 50)))
    }

    // MARK: - Malformed input

    func testRelativeCommandThrowsRatherThanMisrendering() {
        assertThrows(try SVGPathParser.parseSegments("M 0 0 l 10 10")) { error in
            XCTAssertEqual(error, .relativeCommandUnsupported("l", index: 6))
        }
    }

    func testUnsupportedCommandThrows() {
        assertThrows(try SVGPathParser.parseSegments("M 0 0 A 5 5 0 0 1 10 10")) { error in
            XCTAssertEqual(error, .unsupportedCommand("A", index: 6))
        }
    }

    func testTruncatedCommandThrowsWithCounts() {
        assertThrows(try SVGPathParser.parseSegments("M 0 0 L 10")) { error in
            XCTAssertEqual(error, .truncatedCommand("L", index: 6, expected: 2, found: 1))
        }
    }

    func testGarbageCharacterThrowsWithIndex() {
        assertThrows(try SVGPathParser.parseSegments("M 0 0 L 10 10 $ 5")) { error in
            XCTAssertEqual(error, .unexpectedCharacter("$", index: 14))
        }
    }

    func testPathNotStartingWithMoveThrows() {
        assertThrows(try SVGPathParser.parseSegments("L 10 10")) { error in
            XCTAssertEqual(error, .missingInitialMove(index: 0))
        }
    }

    func testEmptyStringThrows() {
        assertThrows(try SVGPathParser.parseSegments("   ")) { error in
            XCTAssertEqual(error, .emptyPath)
        }
    }

    func testEveryErrorHasAReadableDescription() {
        let errors: [SVGPathError] = [
            .unexpectedCharacter("$", index: 3),
            .relativeCommandUnsupported("l", index: 2),
            .unsupportedCommand("A", index: 1),
            .missingInitialMove(index: 0),
            .invalidNumber("--", index: 4),
            .truncatedCommand("C", index: 7, expected: 6, found: 2),
            .emptyPath
        ]
        for error in errors {
            let description = error.errorDescription ?? ""
            XCTAssertFalse(description.isEmpty, "Missing description for \(error)")
        }
    }

    // MARK: - Path building

    func testBuildsPathElementsInOrder() throws {
        let path = try SVGPathParser.parse("M 0 0 L 10 0 Q 15 5 10 10 C 8 12 4 12 0 10 Z")
        var kinds: [String] = []
        path.forEach { element in
            switch element {
            case .move: kinds.append("move")
            case .line: kinds.append("line")
            case .quadCurve: kinds.append("quad")
            case .curve: kinds.append("curve")
            case .closeSubpath: kinds.append("close")
            }
        }
        XCTAssertEqual(kinds, ["move", "line", "quad", "curve", "close"])
    }

    func testParsedPathHasExpectedBounds() throws {
        let path = try SVGPathParser.parse("M 250 480 L 750 480 L 750 850 L 250 850 Z")
        XCTAssertEqual(path.boundingRect.minX, 250, accuracy: 0.001)
        XCTAssertEqual(path.boundingRect.minY, 480, accuracy: 0.001)
        XCTAssertEqual(path.boundingRect.maxX, 750, accuracy: 0.001)
        XCTAssertEqual(path.boundingRect.maxY, 850, accuracy: 0.001)
    }

    func testEmptyPathIsNotProducedForValidInput() throws {
        let path = try SVGPathParser.parse("M 0 0 L 1 1")
        XCTAssertFalse(path.isEmpty)
    }

    // MARK: - Helper

    private func assertThrows(_ expression: @autoclosure () throws -> [SVGPathSegment],
                              file: StaticString = #filePath,
                              line: UInt = #line,
                              _ check: (SVGPathError) -> Void) {
        do {
            _ = try expression()
            XCTFail("Expected the parser to throw", file: file, line: line)
        } catch let error as SVGPathError {
            check(error)
        } catch {
            XCTFail("Expected SVGPathError but got \(error)", file: file, line: line)
        }
    }
}
