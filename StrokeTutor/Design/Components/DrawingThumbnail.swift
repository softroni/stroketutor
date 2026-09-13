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

    init(tutorial: PreparedTutorial?,
         size: CGFloat? = nil,
         strokeColor: Color? = Theme.ink,
         showsFills: Bool = false) {
        self.tutorial = tutorial
        self.size = size
        self.strokeColor = strokeColor
        self.showsFills = showsFills
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

            if showsFills {
                for step in tutorial.steps {
                    for fill in step.fills {
                        context.fill(fill.path.applying(transform),
                                     with: .color(fill.color),
                                     style: fill.style)
                    }
                }
            }

            for step in tutorial.steps {
                for stroke in step.strokes {
                    let width = max(floor, CGFloat(stroke.lineWidth) * scale)
                    context.stroke(stroke.path.applying(transform),
                                   with: .color(strokeColor ?? stroke.color ?? tutorial.strokeColor),
                                   style: StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round))
                }
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}
