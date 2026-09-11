import CoreGraphics
import XCTest
@testable import StrokeTutor

final class TutorialLoaderTests: XCTestCase {

    private func json(schemaVersion: Int = 1,
                      style: String = "\"style\": { \"strokeColor\": \"#2B2B2B\", \"backgroundColor\": \"#FAF7F0\" },",
                      d: String = "M 0 0 L 10 10",
                      duration: String = "1.0",
                      lineWidth: String = "8") -> Data {
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
                { "d": "\(d)", "duration": \(duration), "lineWidth": \(lineWidth) }
              ]
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
        XCTAssertEqual(tutorial.steps.count, 1)
        XCTAssertEqual(tutorial.totalStrokeCount, 1)
        XCTAssertTrue(tutorial.warnings.isEmpty)
    }

    func testRejectsUnsupportedSchemaVersion() {
        XCTAssertThrowsError(try TutorialLoader.prepare(data: json(schemaVersion: 2),
                                                        fileName: "test.json",
                                                        source: .bundled)) { error in
            guard case let TutorialLoadError.unsupportedSchemaVersion(found, supported) = error else {
                return XCTFail("Expected unsupportedSchemaVersion, got \(error)")
            }
            XCTAssertEqual(found, 2)
            XCTAssertEqual(supported, 1)
        }
    }

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
        // Guards the shipped samples: any bad coordinate breaks this test.
        let bundle = Bundle(for: type(of: self))
        let appBundle = Bundle.main.bundleURL.pathExtension == "app" ? Bundle.main : bundle
        let result = TutorialLoader.loadBundledTutorials(in: appBundle)
        XCTAssertTrue(result.failures.isEmpty, "Bundled tutorials failed to load: \(result.failures.map(\.fileName))")
        XCTAssertGreaterThanOrEqual(result.tutorials.count, 2)

        for tutorial in result.tutorials {
            XCTAssertFalse(tutorial.steps.isEmpty, "\(tutorial.fileName) has no steps")
            XCTAssertTrue(tutorial.warnings.isEmpty, "\(tutorial.fileName): \(tutorial.warnings)")
            for step in tutorial.steps {
                XCTAssertFalse(step.strokes.isEmpty, "\(tutorial.fileName)/\(step.id) has no strokes")
                for stroke in step.strokes {
                    XCTAssertFalse(stroke.path.isEmpty, "\(tutorial.fileName)/\(step.id) produced an empty path")
                }
            }
        }
    }

    func testSimpleHouseHasFiveStepsAndCatFaceSix() {
        let bundle = Bundle(for: type(of: self))
        let appBundle = Bundle.main.bundleURL.pathExtension == "app" ? Bundle.main : bundle
        let result = TutorialLoader.loadBundledTutorials(in: appBundle)
        let byID = Dictionary(uniqueKeysWithValues: result.tutorials.map { ($0.tutorialID, $0) })
        XCTAssertEqual(byID["simple-house"]?.steps.count, 5)
        XCTAssertEqual(byID["cat-face"]?.steps.count, 6)
    }
}
