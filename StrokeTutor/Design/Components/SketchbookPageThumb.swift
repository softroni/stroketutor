import SwiftUI
import UIKit

/// A small 3 : 4 thumbnail of a sketchbook page, for places that show a few pages at
/// a glance (Home's "Your drawings" strip) rather than the sketchbook itself.
///
/// The photograph comes from the same place the Sketchbook reads it
/// (`SketchbookStore.image(for:)`), but is scaled down off the main thread and kept
/// in a small cache, so a strip of pages costs a thumbnail's worth of memory, not a
/// 2048 px photo each. Until it arrives — or if the file has gone missing — the page
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

    private func load() async {
        let key = "\(page.id.uuidString)-\(Int(width))" as NSString
        if let cached = Self.cache.object(forKey: key) {
            thumbnail = cached
            return
        }
        guard let photo = app.sketchbook.image(for: page) else { return }
        let target = CGSize(width: width * displayScale, height: height * displayScale)
        guard let small = await photo.byPreparingThumbnail(ofSize: aspectFill(photo.size, into: target)),
              !Task.isCancelled else { return }
        Self.cache.setObject(small, forKey: key)
        thumbnail = small
    }

    /// The size that covers `target` while keeping the photo's proportions, so the
    /// thumbnail is never scaled back up when it fills the frame.
    private func aspectFill(_ size: CGSize, into target: CGSize) -> CGSize {
        guard size.width > 0, size.height > 0 else { return target }
        let scale = max(target.width / size.width, target.height / size.height)
        return CGSize(width: (size.width * scale).rounded(.up), height: (size.height * scale).rounded(.up))
    }

    /// Keyed by page and width. A page's photo never changes once saved, so an
    /// entry can only go stale by being deleted, and then nothing asks for it.
    private static let cache: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.countLimit = 40
        return cache
    }()
}
