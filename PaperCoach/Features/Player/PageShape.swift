import CoreGraphics

/// Which way a drawing wants the page turned: the sketchbook rule behind the player's
/// two landscape layouts and its rotate nudge.
///
/// A lesson's ink (`PreparedTutorial.drawingBounds`) is either clearly wider than it
/// is tall, clearly taller, or near enough square. A wide drawing — the car — draws
/// largest with the phone on its side and the paper to itself (`PlayerScreen`'s wide
/// page); a tall one — the palm tree — is fitted by height whatever the phone does,
/// so it keeps the side panel and is better off upright. The dividing line is 4:3
/// either way, so a subject has to be plainly oblong before the app changes anything.
enum PageShape: Equatable {
    /// Wider than 4:3. Landscape gets the wide page; portrait suggests turning.
    case wide
    /// Taller than 3:4. Portrait is its page; landscape keeps the panel.
    case tall
    /// Anything in between. Both orientations keep the designed anatomy.
    case square

    /// Width over height at which a drawing counts as wide (and its inverse, tall).
    static let threshold: CGFloat = 4.0 / 3.0

    init(fitting bounds: CGRect) {
        guard bounds.width > 0, bounds.height > 0 else {
            self = .square
            return
        }
        let ratio = bounds.width / bounds.height
        if ratio >= Self.threshold {
            self = .wide
        } else if ratio <= 1 / Self.threshold {
            self = .tall
        } else {
            self = .square
        }
    }
}

extension PreparedTutorial {
    /// The page this drawing asks for, from the ink it actually has.
    var pageShape: PageShape {
        PageShape(fitting: drawingBounds)
    }
}
