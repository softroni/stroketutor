import SwiftUI
import UIKit

/// A photographed page (`.sk-shot` in `40-completion-sketchbook.html`): a 3 : 4 card
/// with the learner's own photograph in it and the 2 pt `--line` edge every card in
/// v3 carries.
///
/// One shape for the whole group, because the learner has to recognise it: it is the
/// cell in the sketchbook grid, the "your page" half of the capture review, the
/// confirmation on `sk-capture` saved, and the full-width photograph on `sk-entry`.
///
/// The mockup cannot show a real photograph, so it draws one — a warm desk with a
/// white sheet lying askew on it and the lesson's strokes on the sheet. That drawing
/// is the *stand-in* for the picture, not a frame around it, so a real photograph
/// fills the card; the desk and the sheet are kept for the case the mockup was
/// really describing, a page with no photograph behind it (the file has gone
/// missing, or nothing has been taken yet).
struct SketchbookShot: View {
    /// The photograph the learner took, if it is still on the device.
    var image: UIImage?
    /// Drawn on the desk when there is no photograph.
    var tutorial: PreparedTutorial?
    var cornerRadius: CGFloat = 16

    /// `linear-gradient(160deg, #EADCC8, #CDAB80 55%, #A07F56)`.
    private static let desk = LinearGradient(
        stops: [
            .init(color: Color(hex: "#EADCC8") ?? .brown, location: 0),
            .init(color: Color(hex: "#CDAB80") ?? .brown, location: 0.55),
            .init(color: Color(hex: "#A07F56") ?? .brown, location: 1)
        ],
        startPoint: UnitPoint(x: 0.15, y: 0),
        endPoint: UnitPoint(x: 0.85, y: 1)
    )

    /// `linear-gradient(115deg, rgba(255,255,255,.32), transparent 34%, transparent 62%, rgba(0,0,0,.14))`.
    private static let sheen = LinearGradient(
        stops: [
            .init(color: .white.opacity(0.32), location: 0),
            .init(color: .white.opacity(0), location: 0.34),
            .init(color: .black.opacity(0), location: 0.62),
            .init(color: .black.opacity(0.14), location: 1)
        ],
        startPoint: UnitPoint(x: 0, y: 0.25),
        endPoint: UnitPoint(x: 1, y: 0.75)
    )

    private static let sheetPaper = Color(hex: "#FFFDF9") ?? .white

    var body: some View {
        Group {
            if let image {
                Color.clear
                    .overlay(
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFill()
                    )
            } else {
                standIn
            }
        }
        .aspectRatio(3.0 / 4.0, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .strokeBorder(Theme.line, lineWidth: 2)
        )
    }

    /// The mockup's own picture of a photographed page: the desk, the sheet at
    /// left 11 % · top 8 % · width 78 % · height 84 % rotated −1.6°, and the sheen.
    private var standIn: some View {
        GeometryReader { geometry in
            let size = geometry.size
            ZStack {
                Self.desk

                GeometryReader { paper in
                    DrawingThumbnail(tutorial: tutorial, strokeColor: Color(hex: "#2B2B2B") ?? Theme.ink)
                        .padding(min(paper.size.width, paper.size.height) * 0.08)
                        .frame(width: paper.size.width, height: paper.size.height)
                }
                .background(Self.sheetPaper)
                .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
                .frame(width: size.width * 0.78, height: size.height * 0.84)
                .rotationEffect(.degrees(-1.6))
                .shadow(color: Color(red: 0.196, green: 0.118, blue: 0.039).opacity(0.28), radius: 8, y: 6)
                .position(x: size.width * 0.5, y: size.height * 0.5)

                Self.sheen
            }
        }
    }
}
