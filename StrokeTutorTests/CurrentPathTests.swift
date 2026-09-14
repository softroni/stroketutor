import XCTest
@testable import StrokeTutor

/// Home and the green outline on the path cards both read `currentPath`. Choosing a
/// path must update that value before its detail screen opens, so Back returns to a
/// Home screen that reflects the learner's new choice.
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

    func testOpeningAPathMakesItCurrentBeforeShowingItsDetail() throws {
        let model = makeModel()
        model.select(try XCTUnwrap(model.path(id: "cars")))

        model.open(try XCTUnwrap(model.path(id: "trees")))

        XCTAssertEqual(model.currentPath?.id, "trees")
        XCTAssertEqual(model.settings.currentPathId, "trees")
        XCTAssertEqual(model.learnPath.count, 1)
    }

    private func makeModel() -> AppModel {
        let model = AppModel(bundle: .appUnderTest,
                             settings: Settings(defaults: CatalogLoaderTests.scratchDefaults()),
                             storeDirectory: CatalogLoaderTests.temporaryDirectory())
        model.loadContent()
        return model
    }
}
