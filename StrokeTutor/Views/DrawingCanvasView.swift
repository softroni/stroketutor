import CoreGraphics
import SwiftUI

/// The paper. Three layers over the tutorial's background colour:
///
/// 1. strokes from completed steps, faded
/// 2. the current step's strokes, animating in array order
/// 3. a pencil-tip dot at the head of the stroke being drawn
///
/// Strokes from steps that have not been reached yet are not drawn at all.
struct DrawingCanvasView: View {
    let tutorial: PreparedTutorial
    let phase: PlayerViewModel.Phase
    let strokeProgress: [Double]
    let activeStrokeIndex: Int?
    let isDebugMode: Bool

    /// Opacity of strokes the child has already copied.
    private let completedOpacity: Double = 0.3

    var body: some View {
        GeometryReader { geometry in
            let rect = CGRect(origin: .zero, size: geometry.size)
            let scale = StrokeShape.scale(canvas: tutorial.canvas, in: rect)

            ZStack {
                tutorial.backgroundColor

                if isDebugMode {
                    debugLayer(scale: scale)
                } else {
                    // Finished: the whole drawing is the reward, so it is shown
                    // at full strength rather than as faded history.
                    completedStepsLayer(scale: scale,
                                        opacity: phase == .finished ? 1 : completedOpacity)
                    currentStepLayer(scale: scale, rect: rect)
                }
            }
            .frame(width: geometry.size.width, height: geometry.size.height)
        }
        .clipShape(RoundedRectangle(cornerRadius: Theme.canvasCornerRadius, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Theme.canvasCornerRadius, style: .continuous)
                .strokeBorder(tutorial.strokeColor.opacity(0.12), lineWidth: 2)
        }
        .accessibilityLabel(Text(accessibilityLabel))
    }

    // MARK: - Layers

    /// Layer 1 — everything drawn in earlier steps, faded so the current step
    /// stands out but the child can still see the whole picture.
    @ViewBuilder
    private func completedStepsLayer(scale: CGFloat, opacity: Double) -> some View {
        let upperBound = completedStepUpperBound
        ForEach(Array(tutorial.steps.prefix(upperBound).enumerated()), id: \.offset) { _, step in
            ForEach(step.strokes) { stroke in
                StrokeShape(basePath: stroke.path, canvas: tutorial.canvas)
                    .stroke(tutorial.strokeColor.opacity(opacity),
                            style: StrokeShape.style(lineWidth: stroke.lineWidth * scale))
            }
        }
    }

    /// Layer 2 + 3 — the step being drawn (or just finished), plus the pencil tip.
    @ViewBuilder
    private func currentStepLayer(scale: CGFloat, rect: CGRect) -> some View {
        if case .finished = phase {
            // Nothing extra: `completedStepUpperBound` already covers every step.
            EmptyView()
        } else if let step = activeStep {
            ForEach(Array(step.strokes.enumerated()), id: \.element.id) { index, stroke in
                let progress = progressForStroke(at: index)

                AnimatableValue(progress) { value in
                    ZStack {
                        StrokeShape(basePath: stroke.path, canvas: tutorial.canvas)
                            .trim(from: 0, to: value)
                            .stroke(tutorial.strokeColor,
                                    style: StrokeShape.style(lineWidth: stroke.lineWidth * scale))

                        if index == activeStrokeIndex,
                           value > 0.0001,
                           let tip = pencilTip(for: stroke, progress: value, in: rect) {
                            pencilDot(diameter: max(10, stroke.lineWidth * scale * 1.7))
                                .position(tip)
                        }
                    }
                }
            }
        }
    }

    /// Debug — the entire drawing at once, no animation, so exported
    /// coordinates can be checked in one glance.
    @ViewBuilder
    private func debugLayer(scale: CGFloat) -> some View {
        ForEach(Array(tutorial.steps.enumerated()), id: \.offset) { _, step in
            ForEach(step.strokes) { stroke in
                StrokeShape(basePath: stroke.path, canvas: tutorial.canvas)
                    .stroke(tutorial.strokeColor,
                            style: StrokeShape.style(lineWidth: stroke.lineWidth * scale))
            }
        }
    }

    private func pencilDot(diameter: CGFloat) -> some View {
        Circle()
            .fill(tutorial.strokeColor)
            .frame(width: diameter, height: diameter)
            .overlay {
                Circle()
                    .fill(tutorial.backgroundColor.opacity(0.55))
                    .frame(width: diameter * 0.34, height: diameter * 0.34)
            }
            .allowsHitTesting(false)
    }

    // MARK: - Geometry

    /// The head of the partially drawn stroke, in view coordinates.
    private func pencilTip(for stroke: PreparedStroke, progress: Double, in rect: CGRect) -> CGPoint? {
        let transformed = stroke.path.applying(StrokeShape.transform(canvas: tutorial.canvas, in: rect))
        let clamped = min(max(progress, 0), 1)
        return transformed.trimmedPath(from: 0, to: clamped).currentPoint
    }

    // MARK: - Phase-derived state

    /// How many steps are fully drawn and faded behind the current one.
    private var completedStepUpperBound: Int {
        switch phase {
        case .idle:
            return 0
        case let .drawing(index), let .awaitingUser(index):
            return min(index, tutorial.steps.count)
        case .finished:
            return tutorial.steps.count
        }
    }

    /// The step currently rendered at full opacity, if any.
    private var activeStep: PreparedStep? {
        switch phase {
        case .idle, .finished:
            return nil
        case let .drawing(index), let .awaitingUser(index):
            return tutorial.steps.indices.contains(index) ? tutorial.steps[index] : nil
        }
    }

    private func progressForStroke(at index: Int) -> Double {
        // While awaiting the user the step is complete, even if the progress
        // array has since been reset.
        if case .awaitingUser = phase, !strokeProgress.indices.contains(index) {
            return 1
        }
        return strokeProgress.indices.contains(index) ? strokeProgress[index] : 0
    }

    private var accessibilityLabel: String {
        if isDebugMode { return "Debug view of the complete drawing: \(tutorial.title)." }
        switch phase {
        case .finished:
            return "Finished drawing of \(tutorial.title)."
        case let .drawing(index), let .awaitingUser(index):
            let title = tutorial.steps.indices.contains(index) ? tutorial.steps[index].title : ""
            return "Drawing canvas. Step \(index + 1) of \(tutorial.steps.count): \(title)."
        case .idle:
            return "Drawing canvas."
        }
    }
}
