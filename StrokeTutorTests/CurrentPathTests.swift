import XCTest
@testable import StrokeTutor

/// Home and the green outline on the path cards both read `currentPath`. Choosing a
/// path must update that value before its detail screen opens, so Back returns to a
/// Home screen that reflects the learner's new choice.
///
/// The two paths are taken from the lessons they hold rather than named by id: a
/// path may be renamed in the catalog, a lesson is what a learner actually draws.
@MainActor
final class CurrentPathTests: XCTestCase {

    func testStartingALessonMakesItsPathCurrent() throws {
        let model = makeModel()
        let carPath = try XCTUnwrap(model.path(forLesson: Self.carLessonId))
        let treePath = try XCTUnwrap(model.path(forLesson: Self.treeLessonId))

        model.select(carPath)
        XCTAssertEqual(model.currentPath?.id, carPath.id)

        model.presentPlayer(try XCTUnwrap(model.lesson(id: Self.treeLessonId)))

        XCTAssertEqual(model.currentPath?.id, treePath.id,
                       "Drawing a tree should move Home and the path cards to the tree's path.")
        XCTAssertEqual(model.settings.currentPathId, treePath.id)
    }

    /// The same when the lesson is picked up part-way, which is how a learner comes
    /// back to a path they left through the player's leave sheet.
    func testResumingALessonMakesItsPathCurrent() throws {
        let model = makeModel()
        let carPath = try XCTUnwrap(model.path(forLesson: Self.carLessonId))
        let treePath = try XCTUnwrap(model.path(forLesson: Self.treeLessonId))

        model.select(carPath)

        model.presentPlayer(try XCTUnwrap(model.lesson(id: Self.treeLessonId)), resumeFrom: 1)

        XCTAssertEqual(model.currentPath?.id, treePath.id)
        XCTAssertEqual(model.progress.resumeStep(for: Self.treeLessonId), 1)
    }

    func testOpeningAPathMakesItCurrentBeforeShowingItsDetail() throws {
        let model = makeModel()
        let carPath = try XCTUnwrap(model.path(forLesson: Self.carLessonId))
        let treePath = try XCTUnwrap(model.path(forLesson: Self.treeLessonId))

        model.select(carPath)

        model.open(treePath)

        XCTAssertEqual(model.currentPath?.id, treePath.id)
        XCTAssertEqual(model.settings.currentPathId, treePath.id)
        XCTAssertEqual(model.learnPath.count, 1)
    }

    private static let treeLessonId = "palm-tree-4"
    private static let carLessonId = "classic-red-car"

    private func makeModel() -> AppModel {
        let model = AppModel(bundle: .appUnderTest,
                             settings: Settings(defaults: CatalogLoaderTests.scratchDefaults()),
                             storeDirectory: CatalogLoaderTests.temporaryDirectory())
        model.loadContent()
        return model
    }
}
