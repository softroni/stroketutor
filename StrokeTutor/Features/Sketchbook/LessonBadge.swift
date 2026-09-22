import SwiftUI

/// The lesson a photograph was drawn from, small and in its own colors, on a white
/// rounded tile that sits in a corner of the photo — so a learner sees what was
/// taught right next to what they drew, without a word. Used on every photo the
/// Sketchbook shows: the album slots, the date cards and the entry screen.
///
/// Decoration only: the photo's own accessibility label already names the lesson.
struct LessonBadge: View {
    let tutorial: PreparedTutorial?
    /// The tile's edge, border included.
    var size: CGFloat = 40

    var body: some View {
        let radius = size * 0.26
        DrawingThumbnail(tutorial: tutorial, strokeColor: nil, showsFills: true)
            .padding(size * 0.13)
            .frame(width: size, height: size)
            .background(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .fill(Theme.paper)
            )
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .strokeBorder(Theme.line, lineWidth: 1.5)
            )
            .shadow(color: .black.opacity(0.16), radius: 4, y: 2)
            .accessibilityHidden(true)
    }
}

extension View {
    /// Pins a `LessonBadge` into the bottom-trailing corner of a photo. The tile is
    /// a third of the photo's width (never under 34 pt or over 84 pt), so it reads
    /// the same on a small album slot and on the full-width entry photo. Nothing is
    /// drawn when the lesson is gone from the catalog.
    func lessonBadge(_ tutorial: PreparedTutorial?) -> some View {
        overlay {
            if let tutorial {
                GeometryReader { geometry in
                    let size = min(max(geometry.size.width * 0.33, 34), 84)
                    let inset = max(5, size * 0.14)
                    LessonBadge(tutorial: tutorial, size: size)
                        .padding(inset)
                        .frame(width: geometry.size.width, height: geometry.size.height,
                               alignment: .bottomTrailing)
                }
            }
        }
    }
}
