import SwiftUI
import UIKit

/// A small 3 : 4 thumbnail of a sketchbook page, for places that show a few pages at
/// a glance (Home's "Your drawings" strip) rather than the sketchbook itself.
///
/// The photograph is the store's cached small copy, so a strip of pages costs a
/// thumbnail's worth of memory, not a 2048 px photo each. Until it arrives — or if the file has gone missing — the page
/// shows the lesson's drawing in color on white paper.
struct SketchbookPageThumb: View {
    let page: SketchbookPage
    /// Drawn on white paper while the photo loads, or when there is none.
    let tutorial: PreparedTutorial?
    let width: CGFloat
    var cornerRadius: CGFloat = 14

    @Environment(AppModel.self) private var app
    @Environment(\.displayScale) private var displayScale
    @State private var thumbnail: UIImage?

    private var height: CGFloat { (width * 4 / 3).rounded() }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        return ZStack {
            Theme.paper
            if let thumbnail {
                Image(uiImage: thumbnail)
                    .resizable()
                    .scaledToFill()
                    .frame(width: width, height: height)
            } else {
                DrawingThumbnail(tutorial: tutorial, strokeColor: nil, showsFills: true)
                    .padding(width * 0.14)
            }
        }
        .frame(width: width, height: height)
        .clipShape(shape)
        .overlay(shape.strokeBorder(Theme.line, lineWidth: 2))
        .task(id: page.id) { await load() }
    }

    /// The store makes and caches the small copy (`SketchbookStore.thumbnail(for:maxPixelSize:)`),
    /// the same one the Sketchbook's own grids draw.
    private func load() async {
        let pixels = Int((max(width, height) * displayScale).rounded(.up))
        thumbnail = app.sketchbook.thumbnail(for: page, maxPixelSize: pixels)
    }
}
