import CoreGraphics
import SwiftUI

/// The paper: white, edge to edge, no border, everything between the header and the
/// sheet (`pl-player` `.pl-paper`). The drawing is fitted to the lesson's own ink,
/// not to its square canvas, so a wide subject fills the page.
///
/// In portrait the top 96 pt is the chip band — the narration chip at the top left,
/// the reference thumbnail at the top right — and the drawing sits below it. In
/// landscape the chips move into the side panel and the drawing takes the paper
/// beside it, inset 62 pt on the island side so no stroke hides behind it; on the
/// wide page (`PlayerScreen`) the insets open up and the drawing grows into the
/// whole paper above `PlayerWideBar`. The insets are what a caller animates.
///
/// On a big screen (`PlayerLayout.isRoomy`) the paper is a sheet: a white page with
/// a 2 pt line on the grey of the table, as large as the insets hold, and the
/// drawing fitted inside its margins (`PageSheet`), so the learner sees how big to
/// draw and where on their own page.
struct PlayerPaper<Chips: View>: View {
    let tutorial: PreparedTutorial
    let phase: PlayerViewModel.Phase
    let strokeProgress: [Double]
    let fillProgress: [Double]
    let activeStrokeIndex: Int?
    var showsPencilTip: Bool = true
    /// The area the drawing is fitted into, inside the paper.
    var drawingInsets: EdgeInsets
    let accessibilityText: String
    /// The sheet the drawing sits on, on a big screen. Nil is the phone's paper,
    /// white from edge to edge.
    var page: PageSheet? = nil
    /// The chip band. Empty in landscape.
    @ViewBuilder let chips: () -> Chips

    var body: some View {
        ZStack(alignment: .top) {
            if let page {
                Theme.surface

                GeometryReader { proxy in
                    let sheet = page.sheetRect(in: CGRect(origin: .zero, size: proxy.size))
                    let drawing = page.drawingRect(in: sheet)
                    let shape = RoundedRectangle(cornerRadius: 8, style: .continuous)

                    shape
                        .fill(Theme.paper)
                        .overlay(shape.strokeBorder(Theme.line, lineWidth: 2))
                        .chipShadow()
                        .frame(width: sheet.width, height: sheet.height)
                        .position(x: sheet.midX, y: sheet.midY)
                        .accessibilityHidden(true)

                    canvas
                        .frame(width: drawing.width, height: drawing.height)
                        .position(x: drawing.midX, y: drawing.midY)
                }
                .padding(drawingInsets)
            } else {
                Theme.paper

                canvas
                    .padding(drawingInsets)
            }

            chips()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipped()
    }

    private var canvas: some View {
        DrawingCanvasView(tutorial: tutorial,
                          phase: phase,
                          strokeProgress: strokeProgress,
                          fillProgress: fillProgress,
                          activeStrokeIndex: activeStrokeIndex,
                          isDebugMode: false,
                          source: drawingSource,
                          showsFrame: false,
                          showsPencilTip: showsPencilTip,
                          accessibilityText: accessibilityText)
    }

    /// The union of every stroke and fill plus a 6 % margin, computed once at load.
    private var drawingSource: CGRect {
        let bounds = tutorial.drawingBounds
        guard bounds.width > 0, bounds.height > 0 else {
            return CGRect(origin: .zero, size: tutorial.canvas)
        }
        return bounds
    }
}
