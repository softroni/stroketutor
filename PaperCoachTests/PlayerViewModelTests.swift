import SwiftUI
import XCTest
@testable import PaperCoach

/// The player's state machine. The rule these cover is the one a learner feels:
/// the primary button always does what its label says, whether or not Lina has
/// finished drawing the step.
@MainActor
final class PlayerViewModelTests: XCTestCase {

    /// Strokes long enough that a step stays in `.drawing` for the whole test.
    private func tutorial(steps stepCount: Int) -> PreparedTutorial {
        let steps = (0..<stepCount).map { index in
            PreparedStep(id: "s\(index)",
                         title: "step \(index)",
                         instruction: "",
                         strokes: [PreparedStroke(path: Path(), duration: 60, lineWidth: 8, color: nil)],
                         fills: [])
        }
        return PreparedTutorial(tutorialID: "t", title: "T", canvas: CGSize(width: 100, height: 100),
                                schemaVersion: 1, strokeColor: .black, backgroundColor: .white,
                                steps: steps, drawingBounds: CGRect(x: 0, y: 0, width: 100, height: 100),
                                source: .bundled, fileName: "t.json", warnings: [])
    }

    func testIDrewItMovesOnEvenWhileTheStepIsStillDrawing() {
        let player = PlayerViewModel()
        player.load(tutorial(steps: 3))
        XCTAssertEqual(player.phase, .drawing(stepIndex: 0))

        player.advanceToNextStep()

        XCTAssertEqual(player.phase, .drawing(stepIndex: 1),
                       "one tap on I drew it should reach the next step, not merely finish the ink")
    }

    func testIDrewItOnTheLastStepFinishesTheLessonWhileItIsStillDrawing() {
        let player = PlayerViewModel()
        player.load(tutorial(steps: 2), startingAt: 1)
        XCTAssertEqual(player.phase, .drawing(stepIndex: 1))

        player.advanceToNextStep()

        XCTAssertEqual(player.phase, .finished)
    }

    func testIDrewItStillMovesOnFromAStepThatHasFinishedDrawing() {
        let player = PlayerViewModel()
        player.load(tutorial(steps: 3))
        player.completeCurrentStep()
        XCTAssertEqual(player.phase, .awaitingUser(stepIndex: 0))

        player.advanceToNextStep()

        XCTAssertEqual(player.phase, .drawing(stepIndex: 1))
    }

    /// The step's ink is not left half drawn behind the learner: hurrying it puts
    /// every stroke of that step on the paper before the next step begins.
    func testHurryingAStepPutsAllOfItsInkDown() {
        let player = PlayerViewModel()
        player.load(tutorial(steps: 2))
        player.completeCurrentStep()

        XCTAssertEqual(player.strokeProgress, [1])
        XCTAssertNil(player.activeStrokeIndex)
    }

    func testTheIntroIsNotSkippedByTheSameTap() {
        let player = PlayerViewModel()
        player.load(tutorial(steps: 2), startImmediately: false)
        XCTAssertTrue(player.isAwaitingBegin)

        player.advanceToNextStep()

        XCTAssertTrue(player.isAwaitingBegin, "the intro is left by I’m ready, not by I drew it")
    }
}
