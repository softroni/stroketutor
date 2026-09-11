import Foundation
import Observation
import SwiftUI

/// Drives stroke-by-stroke playback of one tutorial.
///
/// State machine:
/// `.idle → .drawing(step) → .awaitingUser(step) → .drawing(step + 1) → … → .finished`
///
/// Playback never advances past a step on its own: `.awaitingUser` is only left
/// when the child taps a button.
@Observable
@MainActor
final class PlayerViewModel {

    enum Phase: Equatable {
        case idle
        case drawing(stepIndex: Int)
        case awaitingUser(stepIndex: Int)
        case finished
    }

    /// The speeds the toggle cycles through.
    static let speedOptions: [Double] = [0.5, 1.0, 1.5]

    private(set) var tutorial: PreparedTutorial?
    private(set) var phase: Phase = .idle

    /// Draw progress (0...1) for each stroke of the *current* step, by index.
    /// Strokes already finished within the step stay at 1.
    private(set) var strokeProgress: [Double] = []

    /// Which stroke of the current step is animating right now, if any. Drives
    /// the pencil-tip dot.
    private(set) var activeStrokeIndex: Int?

    private(set) var speedMultiplier: Double = 1.0

    /// Debug mode renders the whole drawing at once and suspends playback.
    var isDebugMode: Bool = false {
        didSet {
            guard oldValue != isDebugMode else { return }
            if isDebugMode {
                playbackTask?.cancel()
                playbackTask = nil
                activeStrokeIndex = nil
            } else if tutorial != nil {
                replayCurrentStep()
            }
        }
    }

    private var playbackTask: Task<Void, Never>?

    // MARK: - Derived state

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

    var canGoToPreviousStep: Bool {
        !steps.isEmpty && (currentStepIndex > 0 || isFinished)
    }

    var speedLabel: String {
        speedMultiplier == 1 ? "1×" : String(format: "%g×", speedMultiplier)
    }

    // MARK: - Lifecycle

    /// Loads a tutorial and begins step one immediately.
    func load(_ tutorial: PreparedTutorial) {
        playbackTask?.cancel()
        playbackTask = nil
        self.tutorial = tutorial
        activeStrokeIndex = nil
        setProgressWithoutAnimation([])
        phase = .idle
        guard !tutorial.steps.isEmpty else {
            phase = .finished
            return
        }
        guard !isDebugMode else {
            phase = .awaitingUser(stepIndex: 0)
            return
        }
        beginStep(0)
    }

    func stop() {
        playbackTask?.cancel()
        playbackTask = nil
        activeStrokeIndex = nil
    }

    // MARK: - Transitions

    /// "I drew it!" — move to the next step, or finish.
    func advanceToNextStep() {
        guard case let .awaitingUser(index) = phase else { return }
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

    func cycleSpeed() {
        let options = Self.speedOptions
        let currentIndex = options.firstIndex(of: speedMultiplier) ?? 1
        speedMultiplier = options[(currentIndex + 1) % options.count]
        // Restart the current step so the new speed is immediately visible
        // rather than applying only to the next one.
        if isDrawing { replayCurrentStep() }
    }

    // MARK: - Playback

    private func finish() {
        playbackTask?.cancel()
        playbackTask = nil
        activeStrokeIndex = nil
        setProgressWithoutAnimation([])
        phase = .finished
    }

    private func beginStep(_ index: Int) {
        playbackTask?.cancel()
        guard steps.indices.contains(index) else { return }

        guard !isDebugMode else {
            // Debug mode shows everything at once; just park the state machine.
            activeStrokeIndex = nil
            phase = .awaitingUser(stepIndex: index)
            return
        }

        // Enter .drawing synchronously. If this were deferred into the task
        // below, a fast double tap on "I drew it!" would still observe
        // .awaitingUser and advance twice, skipping a step.
        phase = .drawing(stepIndex: index)
        activeStrokeIndex = nil
        // Snap every stroke back to zero without animating, so a replay does not
        // visibly rewind.
        setProgressWithoutAnimation(Array(repeating: 0, count: steps[index].strokes.count))

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
            let duration = max(0.05, stroke.duration / speedMultiplier)

            activeStrokeIndex = strokeIndex
            withAnimation(.linear(duration: duration)) {
                if strokeProgress.indices.contains(strokeIndex) {
                    strokeProgress[strokeIndex] = 1
                }
            }
            // Strokes are strictly sequential: N + 1 starts only once N is done.
            do { try await Task.sleep(for: .seconds(duration)) } catch { return }
        }

        if Task.isCancelled { return }
        activeStrokeIndex = nil
        phase = .awaitingUser(stepIndex: index)
    }

    /// Writes progress values with animation explicitly disabled, which also
    /// interrupts any in-flight animation on those values.
    private func setProgressWithoutAnimation(_ values: [Double]) {
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) {
            strokeProgress = values
        }
    }
}
