import SwiftUI
import XCTest
@testable import PaperCoach

/// The intro before step one keeps the timeline of `web/src/player/intro.ts` and the
/// words of `web/src/voice/bookends.ts`, so the app and the Studio agree.
final class LessonIntroTests: XCTestCase {

    private func tutorial(stepDurations: [[Double]]) -> PreparedTutorial {
        let steps = stepDurations.enumerated().map { index, durations in
            PreparedStep(id: "s\(index)",
                         title: "step \(index)",
                         instruction: "",
                         strokes: durations.map { PreparedStroke(path: Path(), duration: $0, lineWidth: 8, color: nil) },
                         fills: [])
        }
        return PreparedTutorial(tutorialID: "t", title: "T", canvas: CGSize(width: 100, height: 100),
                                schemaVersion: 1, strokeColor: .black, backgroundColor: .white,
                                steps: steps, drawingBounds: CGRect(x: 0, y: 0, width: 100, height: 100),
                                source: .bundled, fileName: "t.json", warnings: [])
    }

    func testTheIntroIsLongerForALessonWithMoreStepsWithinItsLimits() {
        XCTAssertEqual(LessonIntro.seconds(for: tutorial(stepDurations: [[1]])), 8)
        XCTAssertEqual(LessonIntro.seconds(for: tutorial(stepDurations: Array(repeating: [1], count: 10))), 11)
        XCTAssertEqual(LessonIntro.seconds(for: tutorial(stepDurations: Array(repeating: [1], count: 30))), 14)
    }

    func testTheIntroRunsForAsLongAsLinaSpeaks() {
        let lesson = tutorial(stepDurations: [[1]])
        XCTAssertEqual(LessonIntro.total(for: lesson, spoken: 7.12), 7.12)
        XCTAssertEqual(LessonIntro.total(for: lesson, spoken: 2), 4)
        XCTAssertEqual(LessonIntro.total(for: lesson, spoken: nil), 8)
    }

    func testTheGoalThenEveryStepInItsShareOfTheTimeThenTheWholeDrawing() {
        // total 10: goal 2.2 s, rest 1.2 s, build 6.6 s over 1 + 3 seconds of strokes.
        let lesson = tutorial(stepDurations: [[1], [2, 1]])
        XCTAssertEqual(LessonIntro.frame(for: lesson, elapsed: 0, total: 10), .goal)
        XCTAssertEqual(LessonIntro.frame(for: lesson, elapsed: 2.1, total: 10), .goal)

        guard case let .build(step, item, progress) = LessonIntro.frame(for: lesson, elapsed: 2.2 + 0.825, total: 10) else {
            return XCTFail("expected the first step half drawn")
        }
        XCTAssertEqual(step, 0)
        XCTAssertEqual(item, 0)
        XCTAssertEqual(progress, 0.5, accuracy: 0.0001)

        guard case let .build(laterStep, laterItem, _) = LessonIntro.frame(for: lesson, elapsed: 2.2 + 6.0, total: 10) else {
            return XCTFail("expected the second step's last stroke")
        }
        XCTAssertEqual(laterStep, 1)
        XCTAssertEqual(laterItem, 1)

        XCTAssertEqual(LessonIntro.frame(for: lesson, elapsed: 8.8, total: 10), .rest)
        XCTAssertEqual(LessonIntro.frame(for: lesson, elapsed: 60, total: 10), .rest)
    }

    func testALessonWithNothingToDrawRests() {
        XCTAssertEqual(LessonIntro.frame(for: tutorial(stepDurations: []), elapsed: 5, total: 10), .rest)
    }

    func testTheSubjectReadsAsRunningText() {
        XCTAssertEqual(LessonBookend.subject(of: "Apple"), "an apple")
        XCTAssertEqual(LessonBookend.subject(of: "Cherries"), "cherries")
        XCTAssertEqual(LessonBookend.subject(of: "Watermelon Slice"), "a watermelon slice")
        XCTAssertEqual(LessonBookend.subject(of: "Compass"), "a compass")
    }

    /// The indices `pick` in `bookends.ts` gives for the same ids (salt 7, four intros).
    func testALessonPicksTheIntroTheStudioPicks() {
        XCTAssertEqual(LessonBookend.pick(4, lessonId: "apple", salt: 7), 3)
        XCTAssertEqual(LessonBookend.pick(4, lessonId: "palm-tree-4", salt: 7), 1)
        XCTAssertEqual(LessonBookend.pick(4, lessonId: "classic-red-car", salt: 7), 2)
        XCTAssertEqual(LessonBookend.pick(4, lessonId: "watermelon-slice", salt: 7), 0)
        XCTAssertEqual(LessonBookend.defaultIntro(lessonId: "watermelon-slice", title: "Watermelon Slice"),
                       "Hi, it’s Lina. Today we’re drawing a watermelon slice. Watch how it comes together, then it’s your turn.")
    }
}
