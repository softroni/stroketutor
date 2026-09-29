import SwiftUI
import UIKit

/// A page being made or remade: the photo as taken, the corners of the paper in
/// it once auto-crop or the learner has set them, the page straightened from them,
/// and that page in each look. The capture review makes one from a new photo; the
/// sketchbook's editor from a kept page's original.
struct PageDraft: Equatable {
    /// Tells one draft from the next, so slow work started for one never lands on
    /// another.
    let id = UUID()
    let original: UIImage
    /// What auto-crop found, kept for the corner editor's Reset.
    var detectedCorners: PageCorners?
    /// The corners the page was straightened from; nil while it is the photo as
    /// taken.
    var corners: PageCorners?
    /// The page as straightened, in no look: what the looks are made from.
    var displayed: UIImage {
        didSet { looks = [:] }
    }
    /// `displayed` in Bright and Scan, screen-sized; empty until they are made,
    /// and again whenever `displayed` changes.
    var looks: [PageLook: UIImage] = [:]

    /// A draft of `original` as taken, or already straightened to `displayed`
    /// from `corners`.
    init(original: UIImage, corners: PageCorners? = nil, displayed: UIImage? = nil) {
        self.original = original
        self.corners = corners
        self.displayed = displayed ?? original
    }

    /// What the page shows: `look`, or the page as it is until that look is ready.
    func shown(in look: PageLook) -> UIImage {
        looks[look] ?? displayed
    }

    /// The page in `look` at full size, for saving; the screen-sized one if it
    /// cannot be made.
    func rendered(in look: PageLook) async -> UIImage {
        await look.rendered(displayed) ?? shown(in: look)
    }
}

/// The light under a page, on the capture review and in the sketchbook's editor:
/// Original · Bright · Scan, and a line saying what the chosen one does.
struct LightPicker: View {
    @Binding var look: PageLook

    var body: some View {
        VStack(spacing: Theme.stackSpacing) {
            SegmentedPicker(options: PageLook.allCases, title: \.title, selection: $look)
                .accessibilityElement(children: .contain)
                .accessibilityLabel("Light")

            Text(look.note)
                .textRole(.subhead)
                .foregroundStyle(Theme.ink55)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
