import XCTest
@testable import StrokeTutor

/// Home, the green outline on the path cards and the Path tab's root all read
/// `currentPath`. Choosing a path must update that value and bring the Path tab
/// forward at its root, so the screen showing is the path just chosen.
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
        XCTAssertEqual(model.preferences.currentPathId, treePath.id)
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

    func testOpeningAPathMakesItCurrentAndShowsThePathTab() throws {
        let model = makeModel()
        let carPath = try XCTUnwrap(model.path(forLesson: Self.carLessonId))
        let treePath = try XCTUnwrap(model.path(forLesson: Self.treeLessonId))

        model.select(carPath)

        model.open(treePath)

        XCTAssertEqual(model.currentPath?.id, treePath.id)
        XCTAssertEqual(model.preferences.currentPathId, treePath.id)
        XCTAssertEqual(model.selectedTab, .path)
        XCTAssertTrue(model.pathStack.isEmpty, "The tab's root shows the current path; nothing is pushed.")
        XCTAssertTrue(model.homeStack.isEmpty)
    }

    /// Choosing a card on All paths — pushed on the Path tab from its title — lands
    /// back on that tab's root, now showing the path chosen.
    func testOpeningAPathFromAllPathsReturnsToThePathRoot() throws {
        let model = makeModel()
        let carPath = try XCTUnwrap(model.path(forLesson: Self.carLessonId))
        let treePath = try XCTUnwrap(model.path(forLesson: Self.treeLessonId))

        model.open(carPath)
        model.push(.paths)
        XCTAssertEqual(model.pathStack, [.paths])

        model.open(treePath)

        XCTAssertEqual(model.currentPath?.id, treePath.id)
        XCTAssertEqual(model.selectedTab, .path)
        XCTAssertTrue(model.pathStack.isEmpty)
    }

    // MARK: - Previews

    /// Home browses lessons too, so a preview opened there stays on Home's stack and
    /// Back returns to the shelves.
    func testAPreviewFromHomeIsPushedOnHome() throws {
        let model = makeModel()
        let lesson = try XCTUnwrap(model.lesson(id: Self.treeLessonId))
        model.selectedTab = .home

        model.showPreview(of: lesson)

        XCTAssertEqual(model.selectedTab, .home)
        XCTAssertEqual(model.homeStack, [.lessonPreview(lessonId: lesson.id)])
        XCTAssertTrue(model.pathStack.isEmpty)
    }

    /// The Lessons tab browses every lesson, so its previews stay on its own stack
    /// and Back returns to the grid, not to the Path tab.
    func testAPreviewFromLessonsIsPushedOnLessons() throws {
        let model = makeModel()
        let lesson = try XCTUnwrap(model.lesson(id: Self.treeLessonId))
        model.selectedTab = .lessons

        model.showPreview(of: lesson)

        XCTAssertEqual(model.selectedTab, .lessons)
        XCTAssertEqual(model.lessonsStack, [.lessonPreview(lessonId: lesson.id)])
        XCTAssertTrue(model.pathStack.isEmpty)
    }

    /// Home's "See all lessons" lands on the Lessons tab's root, even when a preview
    /// was left open there.
    func testSeeAllLessonsShowsTheLessonsRoot() throws {
        let model = makeModel()
        let lesson = try XCTUnwrap(model.lesson(id: Self.treeLessonId))
        model.selectedTab = .lessons
        model.showPreview(of: lesson)
        model.selectedTab = .home

        model.showAllLessons()

        XCTAssertEqual(model.selectedTab, .lessons)
        XCTAssertTrue(model.lessonsStack.isEmpty)
    }

    /// Anywhere else — here the sketchbook's "Draw the next one" — a preview goes to
    /// the Path tab, and the sketchbook's stack is left as it was.
    func testAPreviewFromTheSketchbookLandsOnThePathTab() throws {
        let model = makeModel()
        let lesson = try XCTUnwrap(model.lesson(id: Self.treeLessonId))
        model.selectedTab = .sketchbook

        model.showPreview(of: lesson)

        XCTAssertEqual(model.selectedTab, .path)
        XCTAssertEqual(model.pathStack, [.lessonPreview(lessonId: lesson.id)])
        XCTAssertTrue(model.sketchbookStack.isEmpty)
    }

    // MARK: - After a lesson

    /// "Not now" and "Done" after a lesson return to the lesson's path at the Path
    /// tab's root — not to the preview the lesson was started from.
    func testReturningAfterALessonShowsItsPathAtThePathRoot() throws {
        let model = makeModel()
        let carPath = try XCTUnwrap(model.path(forLesson: Self.carLessonId))
        let treePath = try XCTUnwrap(model.path(forLesson: Self.treeLessonId))
        let tree = try XCTUnwrap(model.lesson(id: Self.treeLessonId))

        model.open(carPath)
        model.showPreview(of: tree)
        model.presentCompletion(tree)
        model.select(carPath)

        model.returnToPathDetail(for: tree)

        XCTAssertNil(model.cover)
        XCTAssertEqual(model.selectedTab, .path)
        XCTAssertTrue(model.pathStack.isEmpty)
        XCTAssertEqual(model.currentPath?.id, treePath.id)
    }

    // MARK: - All paths' welcome

    /// A new learner's first rest after a lesson lands on All paths, pushed on the
    /// Path tab over the lesson's path, with the one-time welcome waiting — and the
    /// welcome is remembered as seen at once.
    func testTheFirstRestAfterALessonShowsAllPathsWithTheWelcome() throws {
        let model = makeModel()
        let carPath = try XCTUnwrap(model.path(forLesson: Self.carLessonId))
        let treePath = try XCTUnwrap(model.path(forLesson: Self.treeLessonId))
        let tree = try XCTUnwrap(model.lesson(id: Self.treeLessonId))

        model.open(carPath)
        model.showPreview(of: tree)
        model.presentCompletion(tree)
        model.select(carPath)
        XCTAssertTrue(model.shouldShowPathsWelcome)

        model.leaveCompletion(for: tree)

        XCTAssertNil(model.cover)
        XCTAssertEqual(model.selectedTab, .path)
        XCTAssertEqual(model.pathStack, [.paths], "Back from All paths returns to the lesson's path.")
        XCTAssertEqual(model.currentPath?.id, treePath.id)
        XCTAssertTrue(model.pathsWelcomePending)
        XCTAssertTrue(model.preferences.hasSeenPathsWelcome)
        XCTAssertFalse(model.shouldShowPathsWelcome)
    }

    /// The welcome is once per learner: the next rest, after another lesson, goes to
    /// the lesson's path as it always did.
    func testTheNextRestReturnsToThePathRoot() throws {
        let model = makeModel()
        let treePath = try XCTUnwrap(model.path(forLesson: Self.treeLessonId))
        let tree = try XCTUnwrap(model.lesson(id: Self.treeLessonId))
        let car = try XCTUnwrap(model.lesson(id: Self.carLessonId))

        model.presentCompletion(tree)
        model.leaveCompletion(for: tree)
        // All paths goes away, as it does when the learner leaves it.
        model.pathsWelcomePending = false

        model.presentCompletion(car)
        model.leaveCompletion(for: car)

        XCTAssertNil(model.cover)
        XCTAssertEqual(model.selectedTab, .path)
        XCTAssertTrue(model.pathStack.isEmpty)
        XCTAssertEqual(model.currentPath?.id, car.pathId)
        XCTAssertNotEqual(model.currentPath?.id, treePath.id)
        XCTAssertFalse(model.pathsWelcomePending)
    }

    /// A learner already past their early lessons — here four drawn, from before
    /// the welcome existed — is not welcomed as if they were new.
    func testALearnerPastTheirEarlyLessonsIsNotWelcomed() throws {
        let model = makeModel()
        let lessons = model.paths.flatMap(\.lessons)
        let count = ProgressStore.newLearnerLessonCount + 1
        XCTAssertGreaterThanOrEqual(lessons.count, count)
        for lesson in lessons.prefix(count - 1) {
            model.progress.markCompleted(lesson.id, pathId: lesson.pathId)
        }
        let last = lessons[count - 1]
        model.presentCompletion(last)
        XCTAssertEqual(model.progress.completedCount, count)

        model.leaveCompletion(for: last)

        XCTAssertEqual(model.selectedTab, .path)
        XCTAssertTrue(model.pathStack.isEmpty)
        XCTAssertEqual(model.currentPath?.id, last.pathId)
        XCTAssertFalse(model.pathsWelcomePending)
        XCTAssertFalse(model.preferences.hasSeenPathsWelcome,
                       "Nothing was shown, so nothing is remembered as seen.")
    }

    /// "Next lesson" is not a rest: a learner who chains two lessons still gets the
    /// welcome when they first stop.
    func testChainingLessonsStillShowsTheWelcomeAtTheFirstRest() throws {
        let model = makeModel()
        let tree = try XCTUnwrap(model.lesson(id: Self.treeLessonId))
        let car = try XCTUnwrap(model.lesson(id: Self.carLessonId))

        model.presentCompletion(tree)
        model.dismissCover()
        model.showPreview(of: car)
        model.presentPlayer(car)
        model.presentCompletion(car)
        XCTAssertEqual(model.progress.completedCount, 2)

        model.leaveCompletion(for: car)

        XCTAssertEqual(model.pathStack, [.paths])
        XCTAssertEqual(model.currentPath?.id, car.pathId)
        XCTAssertTrue(model.pathsWelcomePending)
        XCTAssertTrue(model.preferences.hasSeenPathsWelcome)
    }

    /// Handing the app to another learner never carries the welcome with it.
    func testSwitchingLearnerClearsThePendingWelcome() throws {
        let model = makeModel()
        let tree = try XCTUnwrap(model.lesson(id: Self.treeLessonId))
        let second = try XCTUnwrap(model.addProfile(name: "Maya", avatar: .owl))

        model.presentCompletion(tree)
        model.leaveCompletion(for: tree)
        XCTAssertTrue(model.pathsWelcomePending)

        model.switchProfile(to: second.id)

        XCTAssertFalse(model.pathsWelcomePending)
        XCTAssertTrue(model.pathStack.isEmpty)
        XCTAssertFalse(model.preferences.hasSeenPathsWelcome, "The second learner has their own first time.")
    }

    private static let treeLessonId = "pine-tree"
    private static let carLessonId = "car"

    private func makeModel() -> AppModel {
        let model = AppModel(bundle: .appUnderTest,
                             settings: Settings(defaults: CatalogLoaderTests.scratchDefaults()),
                             storeDirectory: CatalogLoaderTests.temporaryDirectory())
        model.loadContent()
        return model
    }
}
