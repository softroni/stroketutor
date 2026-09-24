import CoreGraphics
import Foundation

/// The on-disk JSON contract. This mirrors what the web authoring tool emits for
/// `shared/tutorial.schema.json` (version 1) and `shared/tutorial.v2.schema.json`
/// (version 2, which adds a colour per stroke and a list of fills per step).
/// Nothing here is derived or defaulted at decode time except the fields the schemas
/// mark optional.
struct TutorialDocument: Codable {
    let schemaVersion: Int
    let id: String
    let title: String
    let canvas: CanvasSpec
    let style: StyleSpec?
    let steps: [StepSpec]

    /// The versions this app plays. A file in a newer version is refused by name.
    static let supportedSchemaVersions = [1, 2]
    /// The newest version understood, quoted in the error message.
    static var maxSupportedSchemaVersion: Int { supportedSchemaVersions.max() ?? 1 }
}

struct CanvasSpec: Codable {
    let width: Double
    let height: Double
}

struct StyleSpec: Codable {
    let strokeColor: String?
    /// Ignored for version 1 documents: v3 draws on white paper. A version 2 document
    /// that sets it explicitly is a colour lesson and wins.
    let backgroundColor: String?
}

struct StepSpec: Codable {
    let id: String
    let title: String
    let instruction: String
    /// Always `null` today. Decoded so the contract round-trips, then ignored: the
    /// narration pipeline ships no audio yet.
    let voiceover: String?
    let strokes: [StrokeSpec]
    /// Version 2 only: shapes painted after this step's strokes, beneath every stroke
    /// of the lesson. A step needs at least one stroke or one fill.
    let fills: [FillSpec]?
}

struct StrokeSpec: Codable {
    /// SVG path data, absolute M/L/C/Q/Z only.
    let d: String
    /// Seconds to draw this one stroke at 1x speed.
    let duration: Double
    /// Line width in canvas units; scales with the canvas.
    let lineWidth: Double
    /// Version 2 only: this stroke's colour instead of `style.strokeColor`.
    let color: String?
}

/// Version 2 only: one shape painted in one colour, under every stroke.
struct FillSpec: Codable {
    /// The shape as SVG path data, absolute M/L/C/Q/Z only; several subpaths make
    /// one shape, holes included.
    let d: String
    /// Required by the schema: a fill with no colour is a bad export, not a default.
    let color: String
    /// Seconds to paint this fill at 1x speed.
    let duration: Double
    /// `nonzero` (the default) or `evenodd`, as in SVG.
    let fillRule: String?
}
