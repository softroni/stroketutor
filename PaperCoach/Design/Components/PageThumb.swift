import SwiftUI

/// A 3:4 page of white paper with a drawing on it (`.page-thumb`): the shape a
/// finished sketch takes on `sk-complete` and in the sketchbook grid before a photo
/// replaces it. The drawing sits inside a 10 % margin, as in the mockup.
struct PageThumb: View {
    let tutorial: PreparedTutorial?
    var cornerRadius: CGFloat = 16
    var strokeColor: Color = Theme.ink
    /// Paint the lesson's colour under the lines. A finished page shows it; the
    /// ghost of a lesson not yet drawn does not.
    var showsFills: Bool = false

    var body: some View {
        GeometryReader { geometry in
            DrawingThumbnail(tutorial: tutorial, strokeColor: strokeColor, showsFills: showsFills)
                .padding(min(geometry.size.width, geometry.size.height) * 0.1)
                .frame(width: geometry.size.width, height: geometry.size.height)
        }
        .aspectRatio(3.0 / 4.0, contentMode: .fit)
        .background(
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous).fill(Theme.paper)
        )
        .overlay(
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .strokeBorder(Theme.line, lineWidth: 2)
        )
    }
}
