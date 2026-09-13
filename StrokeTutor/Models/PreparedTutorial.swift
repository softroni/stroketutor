import CoreGraphics
import Foundation
import SwiftUI

/// Where a tutorial came from. Imported tutorials live for the session only.
enum TutorialSource: Equatable {
    case bundled
    case imported

    var label: String {
        switch self {
        case .bundled: return "Included"
        case .imported: return "Imported"
        }
    }
}

/// A tutorial with every `d` string already parsed into a `Path`.
///
/// Parsing happens once, here, at load time. The renderer never parses.
struct PreparedTutorial: Identifiable {
    /// Stable per-instance identity, so an imported file may reuse a bundled
    /// tutorial's `tutorialID` without breaking a picker.
    let id = UUID()
    let tutorialID: String
    let title: String
    let canvas: CGSize
    /// The document's version, kept because v2 documents may set colours and fills.
    let schemaVersion: Int
    /// The colour of a stroke that does not name its own.
    let strokeColor: Color
    /// White for every version 1 lesson (v3 draws on white paper); a version 2
    /// document that sets `style.backgroundColor` explicitly wins.
    let backgroundColor: Color
    let steps: [PreparedStep]
    /// The ink of the whole drawing: the union of every stroke box grown by half its
    /// line width and every fill box, plus a 6 % margin. Screens fit the paper to
    /// this rather than to the full square canvas, so a wide drawing fills the page.
    let drawingBounds: CGRect
    let source: TutorialSource
    let fileName: String
    /// Non-fatal problems found while preparing (clamped values, bad hex, ...).
    let warnings: [String]

    var totalStrokeCount: Int {
        steps.reduce(0) { $0 + $1.strokes.count }
    }

    var totalFillCount: Int {
        steps.reduce(0) { $0 + $1.fills.count }
    }

    /// Seconds of animation at 1x speed, strokes and fills together.
    var totalDuration: Double {
        steps.reduce(0) { $0 + $1.totalDuration }
    }
}

struct PreparedStep: Identifiable {
    let id: String
    let title: String
    let instruction: String
    let strokes: [PreparedStroke]
    /// Painted after this step's strokes, in order, beneath every stroke.
    let fills: [PreparedFill]

    var totalDuration: Double {
        strokes.reduce(0) { $0 + $1.duration } + fills.reduce(0) { $0 + $1.duration }
    }
}

struct PreparedStroke: Identifiable {
    let id = UUID()
    /// Already parsed, in canvas coordinates.
    let path: Path
    let duration: Double
    let lineWidth: Double
    /// This stroke's own colour (version 2). `nil` means the tutorial's stroke colour.
    let color: Color?
}

/// One shape of a version 2 lesson, painted in one colour under every stroke.
struct PreparedFill: Identifiable {
    let id = UUID()
    /// Already parsed, in canvas coordinates.
    let path: Path
    let color: Color
    /// Seconds to fade this fill in at 1x speed.
    let duration: Double
    /// `true` when the document asked for the even-odd rule.
    let usesEvenOddRule: Bool

    var style: FillStyle {
        FillStyle(eoFill: usesEvenOddRule)
    }
}
