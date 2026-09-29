import XCTest
@testable import PaperCoach

/// `sk-complete`'s "Drawing time": the clock the player runs from step one, and the
/// words the tile shows.
@MainActor
final class DrawingClockTests: XCTestCase {

    private let start = Date(timeIntervalSince1970: 1_000_000)

    // MARK: - The clock

    func testTheClockCountsFromTheFirstTapToTheStop() {
        var clock = DrawingClock()
        XCTAssertFalse(clock.isRunning)

        clock.tap(at: start)
        clock.tap(at: start.addingTimeInterval(40))
        clock.stop(at: start.addingTimeInterval(95))

        XCTAssertEqual(clock.seconds, 95)
        XCTAssertFalse(clock.isRunning)
    }

    /// A lesson left open over dinner does not say it took two hours: each stretch
    /// between two taps counts for ten minutes at most.
    func testALongStretchCountsForTenMinutesAtMost() {
        var clock = DrawingClock()
        clock.tap(at: start)
        clock.tap(at: start.addingTimeInterval(60))
        clock.stop(at: start.addingTimeInterval(60 + 2 * 60 * 60))

        XCTAssertEqual(clock.seconds, 60 + DrawingClock.longestStretch)
    }

    /// "Continue from step 4" picks up the seconds of the first visit, and the time
    /// between the two visits is not counted.
    func testAContinuedLessonStartsFromTheTimeAlreadySpent() {
        var clock = DrawingClock(seconds: 150)
        XCTAssertEqual(clock.seconds, 150)

        clock.tap(at: start)
        clock.stop(at: start.addingTimeInterval(30))

        XCTAssertEqual(clock.seconds, 180)
    }

    func testStoppingAClockThatNeverStartedCountsNothing() {
        var clock = DrawingClock()
        clock.stop(at: start)
        XCTAssertEqual(clock.seconds, 0)
    }

    /// A clock set back (the device's time changed mid-lesson) never takes time away.
    func testTimeGoingBackwardsCountsNothing() {
        var clock = DrawingClock()
        clock.tap(at: start)
        clock.stop(at: start.addingTimeInterval(-30))
        XCTAssertEqual(clock.seconds, 0)
    }

    // MARK: - The words

    func testUnderAMinuteReadsInSeconds() {
        XCTAssertEqual(DrawingClock.text(for: 0), "1 sec")
        XCTAssertEqual(DrawingClock.text(for: 42.4), "42 sec")
        XCTAssertEqual(DrawingClock.text(for: 59.4), "59 sec")
    }

    func testAMinuteOrMoreReadsInWholeMinutes() {
        XCTAssertEqual(DrawingClock.text(for: 59.6), "1 min")
        XCTAssertEqual(DrawingClock.text(for: 89), "1 min")
        XCTAssertEqual(DrawingClock.text(for: 90), "2 min")
        XCTAssertEqual(DrawingClock.text(for: 4 * 60 + 12), "4 min")
        XCTAssertEqual(DrawingClock.text(for: 59 * 60 + 20), "59 min")
    }

    func testAnHourOrMoreReadsInHoursAndMinutes() {
        XCTAssertEqual(DrawingClock.text(for: 60 * 60), "1 hr")
        XCTAssertEqual(DrawingClock.text(for: 65 * 60), "1 hr 5 min")
    }

    // MARK: - The estimate beside it

    /// One step with a one-second stroke: three seconds for the animation and eight
    /// for copying it, which the preview rounds up to a minute.
    func testTheEstimateIsTheAnimationThreeTimesOverPlusEightSecondsAStep() throws {
        let lesson = try ProgressStoreTests.makePath(lessonCount: 1).lessons[0]

        XCTAssertEqual(lesson.estimatedSeconds, 11)
        XCTAssertEqual(lesson.estimatedMinutes, 1)
        XCTAssertEqual(Lesson.minutes(Lesson.estimatedSeconds(of: lesson.tutorial.steps.dropFirst())), 1)
    }

    /// `lesson_completed` carries the real time, when it was measured, beside the
    /// estimate, both in whole seconds.
    func testLessonCompletedCarriesTheRealTimeBesideTheEstimate() {
        let measured = AnalyticsEvent.lessonCompleted(lessonId: "sun", pathId: "sky",
                                                      drawingSeconds: 94.6, estimatedSeconds: 79.2)
        XCTAssertEqual(measured.properties["drawing_seconds"], "95")
        XCTAssertEqual(measured.properties["estimated_seconds"], "79")

        let unmeasured = AnalyticsEvent.lessonCompleted(lessonId: "sun", pathId: "sky", estimatedSeconds: 79.2)
        XCTAssertNil(unmeasured.properties["drawing_seconds"])
        XCTAssertEqual(unmeasured.properties["lesson_id"], "sun")
    }
}
