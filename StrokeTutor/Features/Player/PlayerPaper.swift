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
    /// The chip band. Empty in landscape.
    @ViewBuilder let chips: () -> Chips

    var body: some View {
        ZStack(alignment: .top) {
            Theme.paper

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
                .padding(drawingInsets)

            chips()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipped()
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
