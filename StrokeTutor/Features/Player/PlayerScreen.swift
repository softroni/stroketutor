import SwiftUI

/// `pl-player` — the flagship screen: one step draws itself on white paper, the app
/// stops, the learner copies it with a real pen and taps to go on.
///
/// Phase 1 wraps the existing player core (`PlayerViewModel`, `DrawingCanvasView`)
/// in the plainest shell that plays a whole lesson: the canvas, the instruction and
/// the primary. Phase 2 builds the real anatomy — the 56 pt header with segments and
/// the ⋯ menu, the narration chip, the reference thumbnail, the bottom sheet, the
/// leave sheet and landscape.
struct PlayerScreen: View {
    let lesson: Lesson
    /// The step a returning learner left off at, if any.
    var resumeFrom: Int?

    @Environment(AppModel.self) private var app
    @State private var player = PlayerViewModel()

    var body: some View {
        VStack(spacing: Theme.stackSpacing) {
            header

            DrawingCanvasView(tutorial: lesson.tutorial,
                              phase: player.phase,
                              strokeProgress: player.strokeProgress,
                              fillProgress: player.fillProgress,
                              activeStrokeIndex: player.activeStrokeIndex,
                              isDebugMode: player.isDebugMode)
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            VStack(spacing: Theme.stackSpacing) {
                Text(player.currentStep?.instruction ?? lesson.objective)
                    .textRole(.instruction)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: Theme.stackSpacing) {
                    Button {
                        player.replayCurrentStep()
                    } label: {
                        Image(systemName: "arrow.counterclockwise")
                    }
                    .buttonStyle(.roundIcon)
                    .accessibilityLabel("Watch this step again")

                    Button(primaryTitle) { primaryAction() }
                        .buttonStyle(player.isDrawing ? .pending : .primary)
                }
            }
        }
        .padding(.horizontal, Theme.gutter)
        .padding(.bottom, Theme.stackSpacing)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.paper.ignoresSafeArea())
        .onAppear {
            player.speed = app.settings.defaultSpeed
            player.load(lesson.tutorial, startingAt: resumeFrom ?? 0)
        }
        .onDisappear { player.stop() }
        .onChange(of: player.phase) { _, phase in
            if case let .awaitingUser(index) = phase {
                app.progress.markOpened(lesson.id, pathId: lesson.pathId, step: index)
            }
        }
    }

    private var header: some View {
        HStack(spacing: Theme.stackSpacing) {
            Button {
                leave()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Theme.ink)
                    .frame(width: Theme.navTapTarget, height: Theme.navTapTarget)
            }
            .accessibilityLabel("Close lesson")

            VStack(spacing: 6) {
                Text("Step \(player.currentStepIndex + 1) of \(max(1, player.steps.count))")
                    .textRole(.subhead)
                    .foregroundStyle(Theme.ink55)
                StepSegments(stepCount: player.steps.count, currentIndex: player.currentStepIndex)
            }

            Color.clear.frame(width: Theme.navTapTarget, height: Theme.navTapTarget)
        }
        .frame(height: 56)
    }

    private var primaryTitle: String {
        player.isOnLastStep ? "Finish" : "I drew it"
    }

    private func primaryAction() {
        if player.isOnLastStep, player.isAwaitingUser || player.isDrawing {
            app.presentCompletion(lesson)
        } else {
            player.advanceToNextStep()
        }
    }

    /// Leaving stores the step, so the preview can offer to continue.
    private func leave() {
        app.progress.markOpened(lesson.id, pathId: lesson.pathId, step: player.currentStepIndex)
        app.dismissPlayer()
    }
}
