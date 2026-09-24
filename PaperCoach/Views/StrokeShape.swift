import CoreGraphics
import SwiftUI

/// Draws one already-parsed stroke, mapping a region of canvas coordinates into
/// the view rect with uniform aspect-fit scaling.
///
/// The region is a `CGRect` rather than the canvas size, because v3 fits the paper
/// to the drawing's own ink (`PreparedTutorial.drawingBounds`) and not to the square
/// canvas it was authored in: a wide subject then fills the page instead of floating
/// in the middle of it. Passing `canvas:` keeps the old behaviour — the whole canvas
/// is the region.
struct StrokeShape: Shape {
    /// Parsed once at load time; never re-parsed per frame.
    let basePath: Path
    /// The region of canvas coordinates fitted into the view.
    let source: CGRect

    init(basePath: Path, source: CGRect) {
        self.basePath = basePath
        self.source = source
    }

    init(basePath: Path, canvas: CGSize) {
        self.init(basePath: basePath, source: CGRect(origin: .zero, size: canvas))
    }

    func path(in rect: CGRect) -> Path {
        basePath.applying(Self.transform(source: source, in: rect))
    }

    /// The uniform scale factor from canvas units to points.
    static func scale(source: CGRect, in rect: CGRect) -> CGFloat {
        guard source.width > 0, source.height > 0 else { return 1 }
        return min(rect.width / source.width, rect.height / source.height)
    }

    static func scale(canvas: CGSize, in rect: CGRect) -> CGFloat {
        scale(source: CGRect(origin: .zero, size: canvas), in: rect)
    }

    /// Aspect-fit and centre `source` inside `rect`.
    ///
    /// Shared with the pencil-dot maths so the dot always sits exactly on the
    /// stroke it is tracking.
    static func transform(source: CGRect, in rect: CGRect) -> CGAffineTransform {
        let scale = scale(source: source, in: rect)
        let offsetX = rect.minX + (rect.width - source.width * scale) / 2 - source.minX * scale
        let offsetY = rect.minY + (rect.height - source.height * scale) / 2 - source.minY * scale
        return CGAffineTransform(translationX: offsetX, y: offsetY)
            .scaledBy(x: scale, y: scale)
    }

    static func transform(canvas: CGSize, in rect: CGRect) -> CGAffineTransform {
        transform(source: CGRect(origin: .zero, size: canvas), in: rect)
    }

    /// The stroke style used everywhere, so faded, animating and debug strokes
    /// all have identical geometry.
    static func style(lineWidth: CGFloat) -> StrokeStyle {
        StrokeStyle(lineWidth: max(0.5, lineWidth), lineCap: .round, lineJoin: .round)
    }
}

/// Exposes SwiftUI's interpolated animation value to its content closure.
///
/// `.trim` alone animates the drawing, but the pencil-tip dot needs the *same*
/// per-frame value to position itself. Conforming a view to `Animatable` is the
/// supported way to read an in-flight animated `Double`.
struct AnimatableValue<Content: View>: View, Animatable {
    var value: Double
    var content: (Double) -> Content

    init(_ value: Double, @ViewBuilder content: @escaping (Double) -> Content) {
        self.value = value
        self.content = content
    }

    var animatableData: Double {
        get { value }
        set { value = newValue }
    }

    var body: some View {
        content(value)
    }
}
