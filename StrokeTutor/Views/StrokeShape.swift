import CoreGraphics
import SwiftUI

/// Draws one already-parsed stroke, mapping canvas coordinates into the view
/// rect with uniform aspect-fit scaling.
struct StrokeShape: Shape {
    /// Parsed once at load time; never re-parsed per frame.
    let basePath: Path
    let canvas: CGSize

    func path(in rect: CGRect) -> Path {
        basePath.applying(Self.transform(canvas: canvas, in: rect))
    }

    /// The uniform scale factor from canvas units to points.
    static func scale(canvas: CGSize, in rect: CGRect) -> CGFloat {
        guard canvas.width > 0, canvas.height > 0 else { return 1 }
        return min(rect.width / canvas.width, rect.height / canvas.height)
    }

    /// Aspect-fit and centre the canvas inside `rect`.
    ///
    /// Shared with the pencil-dot maths so the dot always sits exactly on the
    /// stroke it is tracking.
    static func transform(canvas: CGSize, in rect: CGRect) -> CGAffineTransform {
        let scale = scale(canvas: canvas, in: rect)
        let offsetX = rect.minX + (rect.width - canvas.width * scale) / 2
        let offsetY = rect.minY + (rect.height - canvas.height * scale) / 2
        return CGAffineTransform(translationX: offsetX, y: offsetY)
            .scaledBy(x: scale, y: scale)
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
