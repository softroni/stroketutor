import CoreGraphics
import SwiftUI

/// A lesson's finished drawing, all strokes at once, fitted to the drawing's own
/// bounds rather than to its square canvas — so a wide drawing fills the tile
/// instead of floating in it. Used everywhere v3 shows a drawing small: inside a
/// lesson node (60 pt), on the hero banner's white thumb (74 pt), on path cards and
/// in the reference sheet.
///
/// `strokeColor` overrides every stroke's own colour, which is how a done node draws
/// the lesson in white on gold. Pass nil to keep the lesson's colours.
struct DrawingThumbnail: View {
    let tutorial: PreparedTutorial?
    /// The square edge to draw in. Nil fills whatever space the parent gives.
    var size: CGFloat?
    /// One colour for every stroke, or nil for the lesson's own.
    var strokeColor: Color?
    /// Version 2 lessons carry colour; a thumbnail shows it only when asked.
    var showsFills: Bool = false
    /// Steps from this index on are drawn at 22 %, which is how `hp-preview`'s
    /// resume tile shows how far the learner got. Nil draws the whole lesson.
    var fadedFromStep: Int?
    /// With `fadedFromStep`, the lines of that step — the one the learner does next —
    /// are drawn at full strength in this color, on top of everything else, so the
    /// resume tile points at the line its "Next step" card describes.
    var nextStepColor: Color?

    init(tutorial: PreparedTutorial?,
         size: CGFloat? = nil,
         strokeColor: Color? = Theme.ink,
         showsFills: Bool = false,
         fadedFromStep: Int? = nil,
         nextStepColor: Color? = nil) {
        self.tutorial = tutorial
        self.size = size
        self.strokeColor = strokeColor
        self.showsFills = showsFills
        self.fadedFromStep = fadedFromStep
        self.nextStepColor = nextStepColor
    }

    var body: some View {
        Canvas { context, canvasSize in
            guard let tutorial else { return }
            let rect = CGRect(origin: .zero, size: canvasSize)
            let bounds = tutorial.drawingBounds
            guard bounds.width > 0, bounds.height > 0 else { return }
            let scale = min(rect.width / bounds.width, rect.height / bounds.height)
            let transform = CGAffineTransform(
                translationX: (rect.width - bounds.width * scale) / 2 - bounds.minX * scale,
                y: (rect.height - bounds.height * scale) / 2 - bounds.minY * scale
            ).scaledBy(x: scale, y: scale)

            // Nothing may vanish at thumbnail size: a hairline floor keeps a
            // detailed lesson legible without flattening its relative weights.
            let floor = max(0.6, min(rect.width, rect.height) / 70)

            // `.stroke.faded` in the mockup: what has not been drawn yet is still
            // on the page, at 22 %, so the tile shows the whole lesson and the
            // learner's place in it at the same time.
            func opacity(ofStep index: Int) -> Double {
                guard let fadedFromStep, index >= fadedFromStep else { return 1 }
                return 0.22
            }

            if showsFills {
                for (index, step) in tutorial.steps.enumerated() {
                    for fill in step.fills {
                        context.fill(fill.path.applying(transform),
                                     with: .color(fill.color.opacity(opacity(ofStep: index))),
                                     style: fill.style)
                    }
                }
            }

            let nextStep = nextStepColor.flatMap { _ in fadedFromStep }
            for (index, step) in tutorial.steps.enumerated() where index != nextStep {
                let alpha = opacity(ofStep: index)
                for stroke in step.strokes {
                    let width = max(floor, CGFloat(stroke.lineWidth) * scale)
                    let color = strokeColor ?? stroke.color ?? tutorial.strokeColor
                    context.stroke(stroke.path.applying(transform),
                                   with: .color(color.opacity(alpha)),
                                   style: StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round))
                }
            }

            if let nextStep, let nextStepColor, tutorial.steps.indices.contains(nextStep) {
                for stroke in tutorial.steps[nextStep].strokes {
                    let width = max(floor, CGFloat(stroke.lineWidth) * scale)
                    context.stroke(stroke.path.applying(transform),
                                   with: .color(nextStepColor),
                                   style: StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round))
                }
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}
