import CoreGraphics

/// The sheet of paper the big-screen player draws under the lesson: the learner's
/// page, outlined, with the drawing where it belongs on it.
///
/// A 13-inch iPad's screen is close to an A4 or Letter page, an 11-inch one to A5,
/// so on an iPad the screen can show the page nearly as it will be on the table.
/// Beginners tend to draw small, in a corner; a page with the drawing centred on it
/// and filling it to its margins says how big and where, without a word.
///
/// A wide drawing (`PageShape.wide`) gets the sheet on its side, as the sketchbook
/// rule already turns the phone for it. Everything else is upright.
struct PageSheet: Equatable {
    /// Long side over short side of an A-series sheet. Letter is 1.29, near enough
    /// that one outline serves both.
    static let ratio: CGFloat = 2.squareRoot()
    /// The space between the sheet's edge and the drawing, as a share of the
    /// sheet's short side.
    static let margin: CGFloat = 0.08

    let isLandscape: Bool

    init(shape: PageShape) {
        isLandscape = shape == .wide
    }

    /// The sheet, as large as `area` holds, centred in it.
    func sheetRect(in area: CGRect) -> CGRect {
        guard area.width > 0, area.height > 0 else { return .zero }
        let aspect = isLandscape ? Self.ratio : 1 / Self.ratio // width over height
        var size = CGSize(width: area.width, height: area.width / aspect)
        if size.height > area.height {
            size = CGSize(width: area.height * aspect, height: area.height)
        }
        return CGRect(x: area.midX - size.width / 2,
                      y: area.midY - size.height / 2,
                      width: size.width,
                      height: size.height)
    }

    /// Where the drawing is fitted on `sheet`: inside the margin on every side.
    func drawingRect(in sheet: CGRect) -> CGRect {
        let inset = min(sheet.width, sheet.height) * Self.margin
        return sheet.insetBy(dx: inset, dy: inset)
    }
}
