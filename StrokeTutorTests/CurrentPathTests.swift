import XCTest
@testable import StrokeTutor

/// `hp-paths`: "Tapping a card does *not* change `currentPathId`; starting a lesson
/// does." Home and the green outline on the path cards both read `currentPath`, so
/// a learner who leaves one path and draws in another has to see the app follow
/// them — otherwise Home keeps offering the path they left.
@MainActor
final class CurrentPathTests: XCTestCase {

    func testStartingALessonMakesItsPathCurrent() throws {
        let model = makeModel()
        model.select(try XCTUnwrap(model.path(id: "cars")))
        XCTAssertEqual(model.currentPath?.id, "cars")

        model.presentPlayer(try XCTUnwrap(model.lesson(id: "palm-tree-4")))

        XCTAssertEqual(model.currentPath?.id, "trees",
                       "Drawing a tree should move Home and the path cards to Trees.")
        XCTAssertEqual(model.settings.currentPathId, "trees")
    }

    /// The same when the lesson is picked up part-way, which is how a learner comes
    /// back to a path they left through the player's leave sheet.
    func testResumingALessonMakesItsPathCurrent() throws {
        let model = makeModel()
        model.select(try XCTUnwrap(model.path(id: "cars")))

        model.presentPlayer(try XCTUnwrap(model.lesson(id: "palm-tree-4")), resumeFrom: 1)

        XCTAssertEqual(model.currentPath?.id, "trees")
        XCTAssertEqual(model.progress.resumeStep(for: "palm-tree-4"), 1)
    }

    /// Browsing is not choosing: opening another path's lesson preview leaves Home
    /// where it was until the pen actually moves.
    func testOpeningAPreviewLeavesTheCurrentPathAlone() throws {
        let model = makeModel()
        model.select(try XCTUnwrap(model.path(id: "cars")))

        model.showPreview(of: try XCTUnwrap(model.lesson(id: "palm-tree-4")))

        XCTAssertEqual(model.currentPath?.id, "cars")
    }

    private func makeModel() -> AppModel {
        let model = AppModel(bundle: .appUnderTest,
                             settings: Settings(defaults: CatalogLoaderTests.scratchDefaults()),
                             storeDirectory: CatalogLoaderTests.temporaryDirectory())
        model.loadContent()
        return model
    }
}
