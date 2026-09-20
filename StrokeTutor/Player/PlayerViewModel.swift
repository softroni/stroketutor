import Foundation
import Observation
import SwiftUI

/// Drives stroke-by-stroke playback of one tutorial.
///
/// State machine:
/// `.idle → .drawing(step) → .awaitingUser(step) → .drawing(step + 1) → … → .finished`
///
/// Playback never advances past a step on its own: a step is only left when the
/// learner taps the primary button, which moves on from `.drawing` as readily as
/// from `.awaitingUser`. Within a step the strokes are drawn strictly in order,
/// and a version 2 lesson's fills are painted after them.
@Observable
@MainActor
final class PlayerViewModel {

    enum Phase: Equatable {
        case idle
        case drawing(stepIndex: Int)
        case awaitingUser(stepIndex: Int)
        case finished
    }

    /// The speeds the player offers (the ⋯ menu and Settings both use this list).
    static let speedOptions: [Double] = [0.5, 1.0, 2.0, 4.0]

    private(set) var tutorial: PreparedTutorial?
    private(set) var phase: Phase = .idle

    /// Draw progress (0...1) for each stroke of the *current* step, by index.
    /// Strokes already finished within the step stay at 1.
    private(set) var strokeProgress: [Double] = []

    /// Paint progress (0...1) for each fill of the *current* step, by index.
    private(set) var fillProgress: [Double] = []

    /// Which stroke of the current step is animating right now, if any. Drives
    /// the pencil-tip dot.
    private(set) var activeStrokeIndex: Int?

    /// Which fill of the current step is being painted right now, if any.
    private(set) var activeFillIndex: Int?

    /// Playback speed. Set it at any time: the value is read again before each
    /// stroke, so a change applies from the next stroke without restarting the
    /// step the learner is watching.
    var speed: Double = 1.0 {
        didSet {
            let clamped = min(max(speed, 0.25), 3)
            if clamped != speed { speed = clamped }
        }
    }

    /// Debug mode renders the whole drawing at once and suspends playback.
    var isDebugMode: Bool = false {
        didSet {
            guard oldValue != isDebugMode else { return }
            if isDebugMode {
                playbackTask?.cancel()
                playbackTask = nil
                activeStrokeIndex = nil
                activeFillIndex = nil
            } else if tutorial != nil {
                replayCurrentStep()
            }
        }
    }

    private var playbackTask: Task<Void, Never>?

    /// The step `begin()` will play, set by `load(startImmediately: false)`.
    private var pendingStartIndex: Int?

    // MARK: - Derived state

    /// True while the lesson is loaded but has not started: the intro.
    var isAwaitingBegin: Bool {
        if case .idle = phase { return pendingStartIndex != nil }
        return false
    }

    var steps: [PreparedStep] { tutorial?.steps ?? [] }

    /// The step the UI should describe. Clamped so it is always addressable.
    var currentStepIndex: Int {
        switch phase {
        case .idle:
            return 0
        case let .drawing(index), let .awaitingUser(index):
            return index
        case .finished:
            return max(0, steps.count - 1)
        }
    }

    var currentStep: PreparedStep? {
        steps.indices.contains(currentStepIndex) ? steps[currentStepIndex] : nil
    }

    var isFinished: Bool { phase == .finished }

    var isAwaitingUser: Bool {
        if case .awaitingUser = phase { return true }
        return false
    }

    var isDrawing: Bool {
        if case .drawing = phase { return true }
        return false
    }

    var isOnLastStep: Bool {
        !steps.isEmpty && currentStepIndex == steps.count - 1
    }

    var canGoToPreviousStep: Bool {
        !steps.isEmpty && (currentStepIndex > 0 || isFinished)
    }

    var speedLabel: String {
        speed == 1 ? "1×" : String(format: "%g×", speed)
    }

    // MARK: - Lifecycle

    /// Loads a tutorial and begins the given step (step one by default).
    ///
    /// `startImmediately: false` loads without playing anything and stays `.idle`,
    /// which is the player's intro (`LessonIntro`): the drawing coming together,
    /// Lina's words before the lesson, and an **I’m ready** button that calls `begin()`.
    func load(_ tutorial: PreparedTutorial,
              startingAt stepIndex: Int = 0,
              startImmediately: Bool = true) {
        playbackTask?.cancel()
        playbackTask = nil
        self.tutorial = tutorial
        activeStrokeIndex = nil
        activeFillIndex = nil
        setProgressWithoutAnimation(strokes: [], fills: [])
        phase = .idle
        guard !tutorial.steps.isEmpty else {
            pendingStartIndex = nil
            phase = .finished
            return
        }
        let start = min(max(0, stepIndex), tutorial.steps.count - 1)
        guard startImmediately else {
            pendingStartIndex = start
            return
        }
        pendingStartIndex = nil
        guard !isDebugMode else {
            phase = .awaitingUser(stepIndex: start)
            return
        }
        beginStep(start)
    }

    /// "I’m ready" — leaves the intro and plays the step the lesson was
    /// loaded on. Does nothing once the lesson is under way.
    func begin() {
        guard case .idle = phase, let start = pendingStartIndex else { return }
        pendingStartIndex = nil
        guard !isDebugMode else {
            phase = .awaitingUser(stepIndex: start)
            return
        }
        beginStep(start)
    }

    /// Jumps the ink to the end of the step — nothing is skipped, only hurried —
    /// and settles into `.awaitingUser`, exactly where the animation would have
    /// left it. Used by the screenshot harness; a learner's tap on the primary
    /// goes through `advanceToNextStep()`, which hurries the ink *and* moves on.
    func completeCurrentStep() {
        guard case let .drawing(index) = phase else { return }
        playbackTask?.cancel()
        playbackTask = nil
        activeStrokeIndex = nil
        activeFillIndex = nil
        guard steps.indices.contains(index) else { return }
        setProgressWithoutAnimation(strokes: Array(repeating: 1, count: steps[index].strokes.count),
                                    fills: Array(repeating: 1, count: steps[index].fills.count))
        phase = .awaitingUser(stepIndex: index)
    }

    func stop() {
        playbackTask?.cancel()
        playbackTask = nil
        activeStrokeIndex = nil
        activeFillIndex = nil
    }

    // MARK: - Transitions

    /// "I drew it" — move to the next step, or finish.
    ///
    /// Tapped while the step is still drawing it means the same thing: the ink
    /// jumps to the end of the step, so the strokes are on the paper and nothing
    /// is lost from the picture, and the player goes straight on to the next
    /// step. A learner who already knows the line should not have to tap twice,
    /// and a tap on a button that says "I drew it" must never leave them where
    /// they were.
    func advanceToNextStep() {
        let index: Int
        switch phase {
        case let .awaitingUser(stepIndex):
            index = stepIndex
        case let .drawing(stepIndex):
            completeCurrentStep()
            index = stepIndex
        case .idle, .finished:
            return
        }
        let next = index + 1
        if steps.indices.contains(next) {
            beginStep(next)
        } else {
            finish()
        }
    }

    /// "Watch again" — replay only the current step.
    func replayCurrentStep() {
        guard !steps.isEmpty else { return }
        beginStep(min(currentStepIndex, steps.count - 1))
    }

    func goToPreviousStep() {
        guard !steps.isEmpty else { return }
        let target = isFinished ? steps.count - 1 : max(0, currentStepIndex - 1)
        beginStep(target)
    }

    /// "Start over" — back to step one.
    func restart() {
        guard !steps.isEmpty else { return }
        beginStep(0)
    }

    /// Jumps to a step, used when a learner resumes a lesson they left.
    func jump(to index: Int) {
        guard !steps.isEmpty else { return }
        beginStep(min(max(0, index), steps.count - 1))
    }

    /// Steps through the offered speeds. The new speed applies from the next
    /// stroke: interrupting the drawing to restart it would lose the learner's
    /// place, which is worse than a step that changes pace halfway.
    func cycleSpeed() {
        let options = Self.speedOptions
        let currentIndex = options.firstIndex(of: speed) ?? 1
        speed = options[(currentIndex + 1) % options.count]
    }

    // MARK: - Playback

    private func finish() {
        playbackTask?.cancel()
        playbackTask = nil
        activeStrokeIndex = nil
        activeFillIndex = nil
        setProgressWithoutAnimation(strokes: [], fills: [])
        phase = .finished
    }

    private func beginStep(_ index: Int) {
        playbackTask?.cancel()
        guard steps.indices.contains(index) else { return }

        guard !isDebugMode else {
            // Debug mode shows everything at once; just park the state machine.
            activeStrokeIndex = nil
            activeFillIndex = nil
            phase = .awaitingUser(stepIndex: index)
            return
        }

        // Enter .drawing synchronously. If this were deferred into the task
        // below, a fast double tap on the primary would still observe
        // .awaitingUser and advance twice, skipping a step.
        phase = .drawing(stepIndex: index)
        activeStrokeIndex = nil
        activeFillIndex = nil
        // Snap every stroke and fill back to zero without animating, so a replay
        // does not visibly rewind.
        setProgressWithoutAnimation(strokes: Array(repeating: 0, count: steps[index].strokes.count),
                                    fills: Array(repeating: 0, count: steps[index].fills.count))

        playbackTask = Task { [weak self] in
            await self?.runStep(index)
        }
    }

    private func runStep(_ index: Int) async {
        guard steps.indices.contains(index) else { return }
        let step = steps[index]

        // Let the reset commit before the first stroke starts animating,
        // otherwise SwiftUI coalesces "0 then 1" into no visible movement.
        do { try await Task.sleep(for: .milliseconds(32)) } catch { return }
        if Task.isCancelled { return }

        for strokeIndex in step.strokes.indices {
            if Task.isCancelled { return }
            let stroke = step.strokes[strokeIndex]
            // Read the speed here, not once per step: a change made while this
            // step plays takes effect from the next stroke.
            let duration = max(0.05, stroke.duration / speed)

            activeStrokeIndex = strokeIndex
            withAnimation(.linear(duration: duration)) {
                if strokeProgress.indices.contains(strokeIndex) {
                    strokeProgress[strokeIndex] = 1
                }
            }
            // Strokes are strictly sequential: N + 1 starts only once N is done.
            do { try await Task.sleep(for: .seconds(duration)) } catch { return }
        }

        activeStrokeIndex = nil

        // The step's colour, painted after its outlines and under every stroke.
        for fillIndex in step.fills.indices {
            if Task.isCancelled { return }
            let fill = step.fills[fillIndex]
            let duration = max(0.05, fill.duration / speed)

            activeFillIndex = fillIndex
            withAnimation(.easeOut(duration: duration)) {
                if fillProgress.indices.contains(fillIndex) {
                    fillProgress[fillIndex] = 1
                }
            }
            do { try await Task.sleep(for: .seconds(duration)) } catch { return }
        }

        if Task.isCancelled { return }
        activeFillIndex = nil
        phase = .awaitingUser(stepIndex: index)
    }

    /// Writes progress values with animation explicitly disabled, which also
    /// interrupts any in-flight animation on those values.
    private func setProgressWithoutAnimation(strokes: [Double], fills: [Double]) {
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) {
            strokeProgress = strokes
            fillProgress = fills
        }
    }
}
