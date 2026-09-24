import CoreGraphics
import SwiftUI
import XCTest
@testable import PaperCoach

final class TutorialLoaderTests: XCTestCase {

    private func json(schemaVersion: Int = 1,
                      style: String = "\"style\": { \"strokeColor\": \"#2B2B2B\", \"backgroundColor\": \"#FAF7F0\" },",
                      d: String = "M 0 0 L 10 10",
                      duration: String = "1.0",
                      lineWidth: String = "8",
                      strokeExtras: String = "",
                      fills: String = "") -> Data {
        let text = """
        {
          "schemaVersion": \(schemaVersion),
          "id": "test",
          "title": "Test Drawing",
          "canvas": { "width": 1000, "height": 1000 },
          \(style)
          "steps": [
            {
              "id": "one",
              "title": "Step one",
              "instruction": "Draw a line.",
              "voiceover": null,
              "strokes": [
                { "d": "\(d)", "duration": \(duration), "lineWidth": \(lineWidth)\(strokeExtras) }
              ]\(fills)
            }
          ]
        }
        """
        return Data(text.utf8)
    }

    func testDecodesValidDocument() throws {
        let tutorial = try TutorialLoader.prepare(data: json(), fileName: "test.json", source: .bundled)
        XCTAssertEqual(tutorial.tutorialID, "test")
        XCTAssertEqual(tutorial.title, "Test Drawing")
        XCTAssertEqual(tutorial.canvas, CGSize(width: 1000, height: 1000))
        XCTAssertEqual(tutorial.schemaVersion, 1)
        XCTAssertEqual(tutorial.steps.count, 1)
        XCTAssertEqual(tutorial.totalStrokeCount, 1)
        XCTAssertTrue(tutorial.warnings.isEmpty)
    }

    // MARK: - Schema versions

    func testAcceptsSchemaVersionTwo() throws {
        let tutorial = try TutorialLoader.prepare(data: json(schemaVersion: 2),
                                                  fileName: "test.json",
                                                  source: .bundled)
        XCTAssertEqual(tutorial.schemaVersion, 2)
        XCTAssertEqual(tutorial.steps.count, 1)
    }

    func testRejectsSchemaVersionThree() {
        XCTAssertThrowsError(try TutorialLoader.prepare(data: json(schemaVersion: 3),
                                                        fileName: "test.json",
                                                        source: .bundled)) { error in
            guard case let TutorialLoadError.unsupportedSchemaVersion(found, supported) = error else {
                return XCTFail("Expected unsupportedSchemaVersion, got \(error)")
            }
            XCTAssertEqual(found, 3)
            XCTAssertEqual(supported, 2)
            let description = (error as? TutorialLoadError)?.errorDescription ?? ""
            XCTAssertTrue(description.contains("Unsupported schemaVersion 3"), description)
        }
    }

    func testOnlyVersionThreeAndUpCountAsNewerThanThisApp() {
        XCTAssertTrue(TutorialLoader.isForNewerApp(.unsupportedSchemaVersion(found: 3, supported: 2)))
        XCTAssertFalse(TutorialLoader.isForNewerApp(.unsupportedSchemaVersion(found: 2, supported: 2)))
        XCTAssertFalse(TutorialLoader.isForNewerApp(.unsupportedSchemaVersion(found: 0, supported: 2)))
        XCTAssertFalse(TutorialLoader.isForNewerApp(.noSteps))
    }

    // MARK: - Version 2: colour and fills

    private let fillsBlock = """
    ,
              "fills": [
                { "d": "M 0 0 L 100 0 L 100 100 L 0 100 Z", "color": "#E8C872", "duration": 1.5 },
                { "d": "M 20 20 L 80 20 L 80 80 L 20 80 Z", "color": "#C86C35CC", "duration": 1, "fillRule": "evenodd" }
              ]
    """

    func testDecodesFillsAndStrokeColourInVersionTwo() throws {
        let tutorial = try TutorialLoader.prepare(
            data: json(schemaVersion: 2, strokeExtras: ", \"color\": \"#1F3A5F\"", fills: fillsBlock),
            fileName: "test.json",
            source: .bundled
        )
        let step = try XCTUnwrap(tutorial.steps.first)
        XCTAssertEqual(step.fills.count, 2)
        XCTAssertEqual(tutorial.totalFillCount, 2)
        XCTAssertFalse(step.fills[0].usesEvenOddRule)
        XCTAssertTrue(step.fills[1].usesEvenOddRule)
        XCTAssertEqual(step.fills[0].duration, 1.5)
        XCTAssertFalse(step.fills[0].path.isEmpty)
        XCTAssertNotNil(step.strokes.first?.color, "A version 2 stroke keeps its own colour")
        XCTAssertTrue(tutorial.warnings.isEmpty)
    }

    func testVersionOneIgnoresFills() throws {
        let tutorial = try TutorialLoader.prepare(data: json(schemaVersion: 1, fills: fillsBlock),
                                                  fileName: "test.json",
                                                  source: .bundled)
        XCTAssertEqual(tutorial.totalFillCount, 0, "Version 1 plays outlines only")
    }

    func testVersionTwoStepMayHaveFillsAndNoStrokes() throws {
        let data = Data("""
        {
          "schemaVersion": 2,
          "id": "test",
          "title": "Colour only",
          "canvas": { "width": 100, "height": 100 },
          "steps": [
            {
              "id": "colour", "title": "Colour", "instruction": "Colour it.", "voiceover": null,
              "strokes": [],
              "fills": [ { "d": "M 0 0 L 50 0 L 50 50 Z", "color": "#E8C872", "duration": 1 } ]
            }
          ]
        }
        """.utf8)
        let tutorial = try TutorialLoader.prepare(data: data, fileName: "test.json", source: .bundled)
        XCTAssertEqual(tutorial.totalStrokeCount, 0)
        XCTAssertEqual(tutorial.totalFillCount, 1)
    }

    func testVersionTwoStepWithNeitherStrokesNorFillsIsRefused() {
        let data = Data("""
        {
          "schemaVersion": 2, "id": "test", "title": "Nothing",
          "canvas": { "width": 100, "height": 100 },
          "steps": [ { "id": "nothing", "title": "Nothing", "instruction": "Nothing.", "voiceover": null, "strokes": [] } ]
        }
        """.utf8)
        XCTAssertThrowsError(try TutorialLoader.prepare(data: data, fileName: "test.json", source: .bundled)) { error in
            guard case TutorialLoadError.stepWithoutStrokes = error else {
                return XCTFail("Expected stepWithoutStrokes, got \(error)")
            }
        }
    }

    func testFillWithoutColourIsRefused() {
        let data = Data("""
        {
          "schemaVersion": 2, "id": "test", "title": "No colour",
          "canvas": { "width": 100, "height": 100 },
          "steps": [ { "id": "colour", "title": "Colour", "instruction": "Colour it.", "voiceover": null,
                       "strokes": [], "fills": [ { "d": "M 0 0 L 50 0 L 50 50 Z", "duration": 1 } ] } ]
        }
        """.utf8)
        XCTAssertThrowsError(try TutorialLoader.prepare(data: data, fileName: "test.json", source: .bundled)) { error in
            let description = (error as? TutorialLoadError)?.errorDescription ?? ""
            XCTAssertTrue(description.contains("color"), "Expected the missing field named: \(description)")
        }
    }

    func testFillWithABadPathNamesTheFill() {
        let data = Data("""
        {
          "schemaVersion": 2, "id": "test", "title": "Bad fill",
          "canvas": { "width": 100, "height": 100 },
          "steps": [ { "id": "colour", "title": "Colour", "instruction": "Colour it.", "voiceover": null,
                       "strokes": [], "fills": [ { "d": "m 0 0 l 50 0 z", "color": "#E8C872", "duration": 1 } ] } ]
        }
        """.utf8)
        XCTAssertThrowsError(try TutorialLoader.prepare(data: data, fileName: "test.json", source: .bundled)) { error in
            guard let loadError = error as? TutorialLoadError else {
                return XCTFail("Expected TutorialLoadError, got \(error)")
            }
            XCTAssertEqual(loadError.offendingPathData, "m 0 0 l 50 0 z")
            XCTAssertTrue((loadError.errorDescription ?? "").contains("fill 1"))
        }
    }

    // MARK: - The white paper

    func testVersionOneBackgroundIsIgnoredInFavourOfWhitePaper() throws {
        let tutorial = try TutorialLoader.prepare(data: json(), fileName: "test.json", source: .bundled)
        XCTAssertEqual(tutorial.backgroundColor, Color(hex: "#FFFFFF"))
    }

    func testVersionTwoMaySetItsOwnBackground() throws {
        let style = "\"style\": { \"strokeColor\": \"#2B2B2B\", \"backgroundColor\": \"#101010\" },"
        let tutorial = try TutorialLoader.prepare(data: json(schemaVersion: 2, style: style),
                                                  fileName: "test.json",
                                                  source: .bundled)
        XCTAssertEqual(tutorial.backgroundColor, Color(hex: "#101010"))
    }

    // MARK: - Drawing bounds

    func testDrawingBoundsCoverTheInkPlusAMargin() throws {
        // One 8-wide stroke from (0,0) to (10,10) on a 1000 canvas: a 10 × 10 path
        // box grown by half the line width is 18 × 18, and the margin adds 6 % of
        // the larger side on every edge.
        let tutorial = try TutorialLoader.prepare(data: json(), fileName: "test.json", source: .bundled)
        let bounds = tutorial.drawingBounds
        XCTAssertEqual(bounds.minX, -4 - 18 * 0.06, accuracy: 0.01)
        XCTAssertEqual(bounds.width, 18 * 1.12, accuracy: 0.01)
        XCTAssertEqual(bounds.width, bounds.height, accuracy: 0.01)
        XCTAssertLessThan(bounds.width, 1000, "Bounds fit the drawing, not the canvas")
    }

    func testDrawingBoundsIncludeFills() throws {
        let tutorial = try TutorialLoader.prepare(
            data: json(schemaVersion: 2, fills: fillsBlock),
            fileName: "test.json",
            source: .bundled
        )
        // The first fill reaches (100, 100); the stroke alone would stop near 14.
        XCTAssertGreaterThan(tutorial.drawingBounds.maxX, 100)
    }

    // MARK: - Leniency

    func testMissingStyleFallsBackWithoutWarning() throws {
        let tutorial = try TutorialLoader.prepare(data: json(style: ""), fileName: "test.json", source: .bundled)
        XCTAssertTrue(tutorial.warnings.isEmpty)
    }

    func testInvalidHexProducesWarningNotFailure() throws {
        let style = "\"style\": { \"strokeColor\": \"not-a-colour\", \"backgroundColor\": \"#FAF7F0\" },"
        let tutorial = try TutorialLoader.prepare(data: json(style: style), fileName: "test.json", source: .bundled)
        XCTAssertEqual(tutorial.warnings.count, 1)
        XCTAssertTrue(tutorial.warnings[0].contains("strokeColor"))
    }

    func testMalformedPathSurfacesFileAndPathData() {
        XCTAssertThrowsError(try TutorialLoader.prepare(data: json(d: "M 0 0 L 10"),
                                                        fileName: "broken.json",
                                                        source: .bundled)) { error in
            guard let loadError = error as? TutorialLoadError else {
                return XCTFail("Expected TutorialLoadError, got \(error)")
            }
            XCTAssertEqual(loadError.offendingPathData, "M 0 0 L 10")
            let description = loadError.errorDescription ?? ""
            XCTAssertTrue(description.contains("one"), "Should name the step: \(description)")
            XCTAssertTrue(description.contains("stroke 1"), "Should name the stroke: \(description)")
        }
    }

    func testNonPositiveDurationAndLineWidthAreClamped() throws {
        let tutorial = try TutorialLoader.prepare(data: json(duration: "0", lineWidth: "-4"),
                                                  fileName: "test.json",
                                                  source: .bundled)
        let stroke = try XCTUnwrap(tutorial.steps.first?.strokes.first)
        XCTAssertGreaterThan(stroke.duration, 0)
        XCTAssertGreaterThan(stroke.lineWidth, 0)
        XCTAssertEqual(tutorial.warnings.count, 2)
    }

    func testMissingRequiredFieldNamesTheField() {
        let data = Data("""
        { "schemaVersion": 1, "id": "x", "canvas": { "width": 10, "height": 10 }, "steps": [] }
        """.utf8)
        XCTAssertThrowsError(try TutorialLoader.prepare(data: data, fileName: "test.json", source: .bundled)) { error in
            let description = (error as? TutorialLoadError)?.errorDescription ?? ""
            XCTAssertTrue(description.contains("title"), "Expected the missing field name in: \(description)")
        }
    }

    // MARK: - Bundled content

    func testBundledTutorialsAllLoad() {
        // Guards the shipped lessons: any bad coordinate breaks this test. Version 2
        // lessons are included now that the player reads them.
        let result = TutorialLoader.loadBundledTutorials(in: .appUnderTest)
        XCTAssertTrue(result.failures.isEmpty, "Bundled tutorials failed to load: \(result.failures.map(\.fileName))")
        XCTAssertGreaterThanOrEqual(result.tutorials.count, 2)

        for tutorial in result.tutorials {
            XCTAssertFalse(tutorial.steps.isEmpty, "\(tutorial.fileName) has no steps")
            XCTAssertTrue(tutorial.warnings.isEmpty, "\(tutorial.fileName): \(tutorial.warnings)")
            XCTAssertGreaterThan(tutorial.drawingBounds.width, 0, "\(tutorial.fileName) has no measurable ink")
            for step in tutorial.steps {
                XCTAssertFalse(step.strokes.isEmpty && step.fills.isEmpty,
                               "\(tutorial.fileName)/\(step.id) draws nothing")
                for stroke in step.strokes {
                    XCTAssertFalse(stroke.path.isEmpty, "\(tutorial.fileName)/\(step.id) produced an empty path")
                }
            }
        }
    }

    func testTheBundledVersionTwoLessonsCarryColour() throws {
        let result = TutorialLoader.loadBundledTutorials(in: .appUnderTest)
        let versionTwo = result.tutorials.filter { $0.schemaVersion == 2 }
        try XCTSkipIf(versionTwo.isEmpty, "No version 2 lesson is bundled.")
        for tutorial in versionTwo {
            XCTAssertGreaterThan(tutorial.totalFillCount, 0, "\(tutorial.fileName) is v2 but has no fills")
        }
    }
}

/// The bundle the app's resources live in. Unit tests are hosted by the app, so
/// `Bundle.main` is the app bundle; the test bundle is the fallback.
extension Bundle {
    static var appUnderTest: Bundle {
        Bundle.main.bundleURL.pathExtension == "app" ? .main : Bundle(for: TutorialLoaderTests.self)
    }
}
