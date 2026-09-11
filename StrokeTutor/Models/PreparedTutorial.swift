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
    /// tutorial's `tutorialID` without breaking the picker.
    let id = UUID()
    let tutorialID: String
    let title: String
    let canvas: CGSize
    let strokeColor: Color
    let backgroundColor: Color
    let steps: [PreparedStep]
    let source: TutorialSource
    let fileName: String
    /// Non-fatal problems found while preparing (clamped values, bad hex, ...).
    let warnings: [String]

    var totalStrokeCount: Int {
        steps.reduce(0) { $0 + $1.strokes.count }
    }
}

struct PreparedStep: Identifiable {
    let id: String
    let title: String
    let instruction: String
    let strokes: [PreparedStroke]

    var totalDuration: Double {
        strokes.reduce(0) { $0 + $1.duration }
    }
}

struct PreparedStroke: Identifiable {
    let id = UUID()
    /// Already parsed, in canvas coordinates.
    let path: Path
    let duration: Double
    let lineWidth: Double
}
