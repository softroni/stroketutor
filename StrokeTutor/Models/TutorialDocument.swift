import CoreGraphics
import Foundation

/// The on-disk JSON contract (schema v1). This mirrors exactly what the web
/// authoring tool will emit — nothing here is derived or defaulted at decode
/// time except `style`, which the schema marks optional.
struct TutorialDocument: Codable {
    let schemaVersion: Int
    let id: String
    let title: String
    let canvas: CanvasSpec
    let style: StyleSpec?
    let steps: [StepSpec]

    static let supportedSchemaVersion = 1
}

struct CanvasSpec: Codable {
    let width: Double
    let height: Double
}

struct StyleSpec: Codable {
    let strokeColor: String?
    let backgroundColor: String?
}

struct StepSpec: Codable {
    let id: String
    let title: String
    let instruction: String
    /// Always `null` in v1. Decoded so the contract round-trips, then ignored:
    /// there is no audio in this prototype.
    let voiceover: String?
    let strokes: [StrokeSpec]
}

struct StrokeSpec: Codable {
    /// SVG path data, absolute M/L/C/Q/Z only.
    let d: String
    /// Seconds to draw this one stroke at 1x speed.
    let duration: Double
    /// Line width in canvas units; scales with the canvas.
    let lineWidth: Double
}
