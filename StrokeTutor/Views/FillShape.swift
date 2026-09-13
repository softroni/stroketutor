import CoreGraphics
import SwiftUI

/// Draws one already-parsed fill shape of a version 2 lesson, mapped from canvas
/// coordinates into the view rect with the same aspect-fit transform `StrokeShape`
/// uses, so a fill and the outline over it can never drift apart. The even-odd rule
/// travels with the `FillStyle` at the call site, not with the shape.
struct FillShape: Shape {
    /// Parsed once at load time; never re-parsed per frame.
    let basePath: Path
    let canvas: CGSize

    func path(in rect: CGRect) -> Path {
        basePath.applying(StrokeShape.transform(canvas: canvas, in: rect))
    }
}
