import CoreGraphics
import Foundation
import SwiftUI

/// Everything that can go wrong turning a file into a `PreparedTutorial`.
///
/// Each case carries enough context to name the file and, for path problems,
/// the exact `d` string that failed — the app shows this on screen instead of
/// crashing or drawing a blank canvas.
enum TutorialLoadError: Error, LocalizedError {
    case unreadableFile(reason: String)
    case decodingFailed(reason: String)
    case unsupportedSchemaVersion(found: Int, supported: Int)
    case invalidCanvas(width: Double, height: Double)
    case noSteps
    case stepWithoutStrokes(stepID: String)
    case pathParsingFailed(stepID: String, strokeIndex: Int, d: String, reason: String)
    case fillPathParsingFailed(stepID: String, fillIndex: Int, d: String, reason: String)

    var errorDescription: String? {
        switch self {
        case let .unreadableFile(reason):
            return "The file could not be read: \(reason)"
        case let .decodingFailed(reason):
            return "The JSON did not match the schema. \(reason)"
        case let .unsupportedSchemaVersion(found, _):
            let known = TutorialDocument.supportedSchemaVersions
                .map(String.init)
                .joined(separator: " and ")
            return "Unsupported schemaVersion \(found). This app understands version \(known)."
        case let .invalidCanvas(width, height):
            return "Canvas size must be positive, but was \(width) x \(height)."
        case .noSteps:
            return "The tutorial contains no steps."
        case let .stepWithoutStrokes(stepID):
            return "Step \"\(stepID)\" contains no strokes."
        case let .pathParsingFailed(stepID, strokeIndex, _, reason):
            return "Step \"\(stepID)\", stroke \(strokeIndex + 1): \(reason)"
        case let .fillPathParsingFailed(stepID, fillIndex, _, reason):
            return "Step \"\(stepID)\", fill \(fillIndex + 1): \(reason)"
        }
    }

    /// The offending path data, shown verbatim for path errors.
    var offendingPathData: String? {
        switch self {
        case let .pathParsingFailed(_, _, d, _): return d
        case let .fillPathParsingFailed(_, _, d, _): return d
        default: return nil
        }
    }
}

/// A file that failed to load, kept so the UI can report it rather than
/// silently dropping the tutorial.
struct TutorialLoadFailure: Identifiable {
    let id = UUID()
    let fileName: String
    let error: TutorialLoadError
}

/// Turns JSON files into `PreparedTutorial`s. Stateless.
///
/// Lenient on purpose: a clampable mistake (a zero duration, an unparseable colour)
/// becomes a warning and a documented fallback, because a bad export should not
/// strand a learner mid-lesson. `shared/conformance/` records where that differs
/// from the authoring tool, which refuses the same file.
enum TutorialLoader {

    /// Documented fallback when `style.strokeColor` is absent or unparseable.
    static let defaultStrokeHex = "#2B2B2B"
    /// The paper is white in v3; a version 2 lesson may override it.
    static let defaultBackgroundHex = "#FFFFFF"
    /// The drawing's ink is grown by this share of its larger side before a screen
    /// fits the paper to it.
    static let drawingBoundsMargin: CGFloat = 0.06

    /// The bundle subdirectory holding shipped tutorials. It is a folder
    /// reference, so dropping a new `.json` in requires no code change.
    static let bundleSubdirectory = "Tutorials"

    // MARK: - Discovery

    /// Finds every bundled tutorial and loads it. Never throws: a single bad
    /// file yields a failure entry, and the rest still load.
    static func loadBundledTutorials(in bundle: Bundle = .main) -> (tutorials: [PreparedTutorial], failures: [TutorialLoadFailure]) {
        let urls = bundledTutorialURLs(in: bundle)
        var tutorials: [PreparedTutorial] = []
        var failures: [TutorialLoadFailure] = []

        for url in urls {
            do {
                tutorials.append(try loadTutorial(at: url, source: .bundled))
            } catch let error as TutorialLoadError {
                if isForNewerApp(error) { continue }
                failures.append(TutorialLoadFailure(fileName: url.lastPathComponent, error: error))
            } catch {
                failures.append(TutorialLoadFailure(fileName: url.lastPathComponent,
                                                    error: .unreadableFile(reason: error.localizedDescription)))
            }
        }

        tutorials.sort { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
        return (tutorials, failures)
    }

    /// A bundled file in a newer `schemaVersion` than this app reads — version 3 and
    /// up, now that versions 1 and 2 both play. It is skipped rather than reported:
    /// the Studio may author ahead of the app, and a learner can do nothing about it.
    /// A file the learner imports still reports the version by name.
    static func isForNewerApp(_ error: TutorialLoadError) -> Bool {
        if case let .unsupportedSchemaVersion(found, _) = error {
            return found > TutorialDocument.maxSupportedSchemaVersion
        }
        return false
    }

    /// Discovers `.json` files in the `Tutorials` folder without hardcoding names.
    static func bundledTutorialURLs(in bundle: Bundle = .main) -> [URL] {
        if let urls = bundle.urls(forResourcesWithExtension: "json", subdirectory: bundleSubdirectory),
           !urls.isEmpty {
            return urls.sorted { $0.lastPathComponent < $1.lastPathComponent }
        }
        // Fallback for build setups where the folder is copied without being
        // indexed as a resource subdirectory.
        guard let resourceURL = bundle.resourceURL else { return [] }
        let directory = resourceURL.appendingPathComponent(bundleSubdirectory, isDirectory: true)
        let contents = try? FileManager.default.contentsOfDirectory(at: directory,
                                                                    includingPropertiesForKeys: nil)
        return (contents ?? [])
            .filter { $0.pathExtension.lowercased() == "json" }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
    }

    // MARK: - Loading

    /// Reads and prepares a single tutorial file.
    static func loadTutorial(at url: URL, source: TutorialSource) throws -> PreparedTutorial {
        let data: Data
        do {
            data = try Data(contentsOf: url)
        } catch {
            throw TutorialLoadError.unreadableFile(reason: error.localizedDescription)
        }
        return try prepare(data: data, fileName: url.lastPathComponent, source: source)
    }

    /// Reads a file that lives outside the sandbox, taking the security-scoped
    /// resource for the duration of the read.
    static func loadImportedTutorial(at url: URL) throws -> PreparedTutorial {
        let needsScope = url.startAccessingSecurityScopedResource()
        defer { if needsScope { url.stopAccessingSecurityScopedResource() } }
        return try loadTutorial(at: url, source: .imported)
    }

    /// Decodes and validates JSON, parsing every `d` string exactly once.
    static func prepare(data: Data, fileName: String, source: TutorialSource) throws -> PreparedTutorial {
        let document: TutorialDocument
        do {
            document = try JSONDecoder().decode(TutorialDocument.self, from: data)
        } catch let error as DecodingError {
            throw TutorialLoadError.decodingFailed(reason: describe(error))
        } catch {
            throw TutorialLoadError.decodingFailed(reason: error.localizedDescription)
        }

        guard TutorialDocument.supportedSchemaVersions.contains(document.schemaVersion) else {
            throw TutorialLoadError.unsupportedSchemaVersion(
                found: document.schemaVersion,
                supported: TutorialDocument.maxSupportedSchemaVersion
            )
        }
        guard document.canvas.width > 0, document.canvas.height > 0 else {
            throw TutorialLoadError.invalidCanvas(width: document.canvas.width, height: document.canvas.height)
        }
        guard !document.steps.isEmpty else { throw TutorialLoadError.noSteps }

        // Colour belongs to version 2. A version 1 document that happens to carry the
        // keys is played as version 1 — outlines only, the documented behaviour the
        // shared conformance corpus asserts.
        let readsColour = document.schemaVersion >= 2

        var warnings: [String] = []

        let strokeColor = resolveColor(document.style?.strokeColor,
                                       fallbackHex: defaultStrokeHex,
                                       label: "strokeColor",
                                       warnings: &warnings)
        // The white paper wins unless a version 2 lesson sets a background on purpose.
        let backgroundColor = resolveColor(readsColour ? document.style?.backgroundColor : nil,
                                           fallbackHex: defaultBackgroundHex,
                                           label: "backgroundColor",
                                           warnings: &warnings)

        var steps: [PreparedStep] = []
        steps.reserveCapacity(document.steps.count)

        for step in document.steps {
            let fillSpecs = readsColour ? (step.fills ?? []) : []
            guard !step.strokes.isEmpty || !fillSpecs.isEmpty else {
                throw TutorialLoadError.stepWithoutStrokes(stepID: step.id)
            }

            var strokes: [PreparedStroke] = []
            strokes.reserveCapacity(step.strokes.count)

            for (index, stroke) in step.strokes.enumerated() {
                let path: Path
                do {
                    path = try SVGPathParser.parse(stroke.d)
                } catch let error as SVGPathError {
                    throw TutorialLoadError.pathParsingFailed(
                        stepID: step.id,
                        strokeIndex: index,
                        d: stroke.d,
                        reason: error.errorDescription ?? String(describing: error)
                    )
                }

                // Clamp rather than reject: a zero duration or width is a bad
                // export, not a broken drawing.
                var duration = stroke.duration
                if !(duration.isFinite) || duration <= 0 {
                    warnings.append("Step \"\(step.id)\" stroke \(index + 1): duration \(stroke.duration) replaced with 0.8s.")
                    duration = 0.8
                }
                var lineWidth = stroke.lineWidth
                if !(lineWidth.isFinite) || lineWidth <= 0 {
                    warnings.append("Step \"\(step.id)\" stroke \(index + 1): lineWidth \(stroke.lineWidth) replaced with 8.")
                    lineWidth = 8
                }

                var color: Color?
                if readsColour, let hex = stroke.color {
                    if let parsed = Color(hex: hex) {
                        color = parsed
                    } else {
                        warnings.append("Step \"\(step.id)\" stroke \(index + 1): colour \"\(hex)\" is not a valid hex colour; using the lesson's stroke colour.")
                    }
                }

                strokes.append(PreparedStroke(path: path,
                                              duration: duration,
                                              lineWidth: lineWidth,
                                              color: color))
            }

            var fills: [PreparedFill] = []
            fills.reserveCapacity(fillSpecs.count)

            for (index, fill) in fillSpecs.enumerated() {
                let path: Path
                do {
                    path = try SVGPathParser.parse(fill.d)
                } catch let error as SVGPathError {
                    throw TutorialLoadError.fillPathParsingFailed(
                        stepID: step.id,
                        fillIndex: index,
                        d: fill.d,
                        reason: error.errorDescription ?? String(describing: error)
                    )
                }

                var duration = fill.duration
                if !(duration.isFinite) || duration <= 0 {
                    warnings.append("Step \"\(step.id)\" fill \(index + 1): duration \(fill.duration) replaced with 0.8s.")
                    duration = 0.8
                }

                var color = Color(hex: fill.color)
                if color == nil {
                    warnings.append("Step \"\(step.id)\" fill \(index + 1): colour \"\(fill.color)\" is not a valid hex colour; using the lesson's stroke colour.")
                    color = strokeColor
                }

                fills.append(PreparedFill(path: path,
                                          color: color ?? strokeColor,
                                          duration: duration,
                                          usesEvenOddRule: fill.fillRule?.lowercased() == "evenodd"))
            }

            steps.append(PreparedStep(id: step.id,
                                      title: step.title,
                                      instruction: step.instruction,
                                      strokes: strokes,
                                      fills: fills))
        }

        let canvas = CGSize(width: document.canvas.width, height: document.canvas.height)

        return PreparedTutorial(
            tutorialID: document.id,
            title: document.title,
            canvas: canvas,
            schemaVersion: document.schemaVersion,
            strokeColor: strokeColor,
            backgroundColor: backgroundColor,
            steps: steps,
            drawingBounds: drawingBounds(of: steps, canvas: canvas),
            source: source,
            fileName: fileName,
            warnings: warnings
        )
    }

    // MARK: - Geometry

    /// The union of every stroke's box grown by half its line width and every fill's
    /// box, then grown by 6 % of the larger side. Falls back to the whole canvas for
    /// a drawing with no measurable ink, so a caller never divides by zero.
    static func drawingBounds(of steps: [PreparedStep], canvas: CGSize) -> CGRect {
        var union: CGRect?

        func add(_ rect: CGRect) {
            guard rect.isFinite, !rect.isNull else { return }
            union = union.map { $0.union(rect) } ?? rect
        }

        for step in steps {
            for stroke in step.strokes {
                add(stroke.path.boundingRect.insetBy(dx: -CGFloat(stroke.lineWidth) / 2,
                                                     dy: -CGFloat(stroke.lineWidth) / 2))
            }
            for fill in step.fills {
                add(fill.path.boundingRect)
            }
        }

        guard var bounds = union, bounds.width > 0 || bounds.height > 0 else {
            return CGRect(origin: .zero, size: canvas)
        }
        let margin = max(bounds.width, bounds.height) * drawingBoundsMargin
        bounds = bounds.insetBy(dx: -margin, dy: -margin)
        return bounds
    }

    // MARK: - Helpers

    private static func resolveColor(_ hex: String?,
                                     fallbackHex: String,
                                     label: String,
                                     warnings: inout [String]) -> Color {
        guard let hex else {
            return Color(hex: fallbackHex) ?? .black
        }
        if let color = Color(hex: hex) { return color }
        warnings.append("style.\(label) \"\(hex)\" is not a valid hex colour; using \(fallbackHex).")
        return Color(hex: fallbackHex) ?? .black
    }

    /// Turns a `DecodingError` into something an author can act on.
    private static func describe(_ error: DecodingError) -> String {
        func path(_ context: DecodingError.Context) -> String {
            let parts = context.codingPath.map { key -> String in
                if let index = key.intValue { return "[\(index)]" }
                return key.stringValue
            }
            return parts.isEmpty ? "the root object" : parts.joined(separator: ".")
        }

        switch error {
        case let .keyNotFound(key, context):
            return "Missing required field \"\(key.stringValue)\" in \(path(context))."
        case let .typeMismatch(type, context):
            return "Field \(path(context)) has the wrong type; expected \(type)."
        case let .valueNotFound(type, context):
            return "Field \(path(context)) was null but a \(type) is required."
        case let .dataCorrupted(context):
            return "Malformed JSON at \(path(context)): \(context.debugDescription)"
        @unknown default:
            return error.localizedDescription
        }
    }
}

private extension CGRect {
    var isFinite: Bool {
        origin.x.isFinite && origin.y.isFinite && size.width.isFinite && size.height.isFinite
    }
}
