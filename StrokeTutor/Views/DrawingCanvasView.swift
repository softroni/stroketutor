import CoreGraphics
import SwiftUI

/// The paper (`.canvas-frame` in v3, and the full-bleed white paper of `pl-player`).
/// Layers, bottom to top:
///
/// 1. the paper itself — white, unless a version 2 lesson set a background
/// 2. fills: every fill already painted, beneath all ink, the current step's fading in
/// 3. strokes from completed steps, faded
/// 4. the current step's strokes, animating in array order
/// 5. a pencil-tip dot at the head of the stroke being drawn
///
/// Strokes from steps that have not been reached yet are not drawn at all.
///
/// The drawing is fitted to `source` — a region of canvas coordinates. The player
/// passes the lesson's `drawingBounds` so the ink fills the page; callers that want
/// the whole authored canvas leave it nil.
struct DrawingCanvasView: View {
    let tutorial: PreparedTutorial
    let phase: PlayerViewModel.Phase
    let strokeProgress: [Double]
    let fillProgress: [Double]
    let activeStrokeIndex: Int?
    let isDebugMode: Bool
    /// The canvas-space region fitted into the view. Nil is the whole canvas.
    var source: CGRect?
    /// Set to draw the *whole* lesson faintly instead of the current step: the
    /// orientation beat before step one (`pl-player` variant *orientation*). The
    /// value is how far along that ghost is, 0...1, so it can draw itself on.
    var ghostProgress: Double?
    /// The opacity of that ghost (`.pl-ghost` is 20 %).
    var ghostOpacity: Double = 0.2
    /// The rounded frame and hairline of `.canvas-frame`. The player's paper is
    /// full-bleed white with no border, so it turns this off.
    var showsFrame: Bool = true
    /// The green pencil tip at the head of the live stroke.
    var showsPencilTip: Bool = true
    /// What VoiceOver reads for the whole canvas. Nil derives one from the phase.
    var accessibilityText: String?

    init(tutorial: PreparedTutorial,
         phase: PlayerViewModel.Phase,
         strokeProgress: [Double],
         fillProgress: [Double] = [],
         activeStrokeIndex: Int?,
         isDebugMode: Bool,
         source: CGRect? = nil,
         ghostProgress: Double? = nil,
         ghostOpacity: Double = 0.2,
         showsFrame: Bool = true,
         showsPencilTip: Bool = true,
         accessibilityText: String? = nil) {
        self.tutorial = tutorial
        self.phase = phase
        self.strokeProgress = strokeProgress
        self.fillProgress = fillProgress
        self.activeStrokeIndex = activeStrokeIndex
        self.isDebugMode = isDebugMode
        self.source = source
        self.ghostProgress = ghostProgress
        self.ghostOpacity = ghostOpacity
        self.showsFrame = showsFrame
        self.showsPencilTip = showsPencilTip
        self.accessibilityText = accessibilityText
    }

    /// Opacity of strokes the learner has already copied.
    private let completedOpacity: Double = 0.22

    var body: some View {
        GeometryReader { geometry in
            let rect = CGRect(origin: .zero, size: geometry.size)
            let region = source ?? CGRect(origin: .zero, size: tutorial.canvas)
            let scale = StrokeShape.scale(source: region, in: rect)

            ZStack {
                tutorial.backgroundColor

                if let ghostProgress {
                    ghostLayer(progress: ghostProgress, source: region, scale: scale)
                } else if isDebugMode {
                    debugFillsLayer(source: region)
                    debugLayer(source: region, scale: scale)
                } else {
                    // Colour first: a fill never covers a line.
                    completedFillsLayer(source: region)
                    currentFillsLayer(source: region)
                    // Finished: the whole drawing is the reward, so it is shown
                    // at full strength rather than as faded history.
                    completedStepsLayer(source: region,
                                        scale: scale,
                                        opacity: phase == .finished ? 1 : completedOpacity)
                    currentStepLayer(source: region, scale: scale, rect: rect)
                }
            }
            .frame(width: geometry.size.width, height: geometry.size.height)
        }
        .modifier(CanvasFrame(isVisible: showsFrame))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(accessibilityText ?? derivedAccessibilityLabel))
    }

    // MARK: - The orientation ghost

    /// The whole drawing at 20 %, drawing itself on stroke by stroke: every stroke
    /// gets an equal slice of one 0...1 timeline, so the lesson previews its own
    /// shape before the learner commits to it.
    @ViewBuilder
    private func ghostLayer(progress: Double, source: CGRect, scale: CGFloat) -> some View {
        let strokes = allStrokes
        let count = max(strokes.count, 1)
        AnimatableValue(progress) { value in
            ZStack {
                ForEach(Array(strokes.enumerated()), id: \.element.id) { index, stroke in
                    let slice = min(max((value * Double(count)) - Double(index), 0), 1)
                    StrokeShape(basePath: stroke.path, source: source)
                        .trim(from: 0, to: slice)
                        .stroke(color(of: stroke).opacity(ghostOpacity),
                                style: StrokeShape.style(lineWidth: stroke.lineWidth * scale))
                }
            }
        }
    }

    private var allStrokes: [PreparedStroke] {
        tutorial.steps.flatMap(\.strokes)
    }

    // MARK: - Fills

    /// Colour painted in earlier steps. Kept at full strength: a fill sits under the
    /// ink already, and fading it would read as a rendering fault rather than history.
    @ViewBuilder
    private func completedFillsLayer(source: CGRect) -> some View {
        ForEach(Array(tutorial.steps.prefix(completedStepUpperBound).enumerated()), id: \.offset) { _, step in
            ForEach(step.fills) { fill in
                FillShape(basePath: fill.path, source: source)
                    .fill(fill.color, style: fill.style)
            }
        }
    }

    /// The current step's colour, fading in one shape at a time.
    @ViewBuilder
    private func currentFillsLayer(source: CGRect) -> some View {
        if let step = activeStep {
            ForEach(Array(step.fills.enumerated()), id: \.element.id) { index, fill in
                FillShape(basePath: fill.path, source: source)
                    .fill(fill.color, style: fill.style)
                    .opacity(progressForFill(at: index))
            }
        }
    }

    @ViewBuilder
    private func debugFillsLayer(source: CGRect) -> some View {
        ForEach(Array(tutorial.steps.enumerated()), id: \.offset) { _, step in
            ForEach(step.fills) { fill in
                FillShape(basePath: fill.path, source: source)
                    .fill(fill.color, style: fill.style)
            }
        }
    }

    // MARK: - Strokes

    /// Everything drawn in earlier steps, faded so the current step stands out but
    /// the whole picture stays visible.
    @ViewBuilder
    private func completedStepsLayer(source: CGRect, scale: CGFloat, opacity: Double) -> some View {
        let upperBound = completedStepUpperBound
        ForEach(Array(tutorial.steps.prefix(upperBound).enumerated()), id: \.offset) { _, step in
            ForEach(step.strokes) { stroke in
                StrokeShape(basePath: stroke.path, source: source)
                    .stroke(color(of: stroke).opacity(opacity),
                            style: StrokeShape.style(lineWidth: stroke.lineWidth * scale))
            }
        }
    }

    /// The step being drawn (or just finished), plus the pencil tip.
    @ViewBuilder
    private func currentStepLayer(source: CGRect, scale: CGFloat, rect: CGRect) -> some View {
        if case .finished = phase {
            // Nothing extra: `completedStepUpperBound` already covers every step.
            EmptyView()
        } else if let step = activeStep {
            ForEach(Array(step.strokes.enumerated()), id: \.element.id) { index, stroke in
                let progress = progressForStroke(at: index)

                AnimatableValue(progress) { value in
                    ZStack {
                        StrokeShape(basePath: stroke.path, source: source)
                            .trim(from: 0, to: value)
                            .stroke(color(of: stroke),
                                    style: StrokeShape.style(lineWidth: stroke.lineWidth * scale))

                        if showsPencilTip,
                           index == activeStrokeIndex,
                           value > 0.0001,
                           let tip = pencilTip(for: stroke, source: source, progress: value, in: rect) {
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
    private func debugLayer(source: CGRect, scale: CGFloat) -> some View {
        ForEach(Array(tutorial.steps.enumerated()), id: \.offset) { _, step in
            ForEach(step.strokes) { stroke in
                StrokeShape(basePath: stroke.path, source: source)
                    .stroke(color(of: stroke),
                            style: StrokeShape.style(lineWidth: stroke.lineWidth * scale))
            }
        }
    }

    /// The pencil tip of v3: a green dot with a white core, at the head of the line.
    private func pencilDot(diameter: CGFloat) -> some View {
        Circle()
            .fill(Theme.green)
            .frame(width: diameter, height: diameter)
            .overlay {
                Circle()
                    .fill(Color.white)
                    .frame(width: diameter * 0.34, height: diameter * 0.34)
            }
            .allowsHitTesting(false)
    }

    // MARK: - Geometry

    /// The head of the partially drawn stroke, in view coordinates.
    private func pencilTip(for stroke: PreparedStroke,
                           source: CGRect,
                           progress: Double,
                           in rect: CGRect) -> CGPoint? {
        let transformed = stroke.path.applying(StrokeShape.transform(source: source, in: rect))
        let clamped = min(max(progress, 0), 1)
        return transformed.trimmedPath(from: 0, to: clamped).currentPoint
    }

    private func color(of stroke: PreparedStroke) -> Color {
        stroke.color ?? tutorial.strokeColor
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
        // While awaiting the learner the step is complete, even if the progress
        // array has since been reset.
        if case .awaitingUser = phase, !strokeProgress.indices.contains(index) {
            return 1
        }
        return strokeProgress.indices.contains(index) ? strokeProgress[index] : 0
    }

    private func progressForFill(at index: Int) -> Double {
        if case .awaitingUser = phase, !fillProgress.indices.contains(index) {
            return 1
        }
        return fillProgress.indices.contains(index) ? fillProgress[index] : 0
    }

    private var derivedAccessibilityLabel: String {
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

/// The rounded canvas frame, applied only where the paper is a card. The player's
/// paper runs edge to edge and takes neither the clip nor the hairline.
private struct CanvasFrame: ViewModifier {
    let isVisible: Bool

    func body(content: Content) -> some View {
        if isVisible {
            content
                .clipShape(RoundedRectangle(cornerRadius: Theme.canvasCornerRadius, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: Theme.canvasCornerRadius, style: .continuous)
                        .strokeBorder(Theme.line, lineWidth: 2)
                }
        } else {
            content
        }
    }
}
