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

    var errorDescription: String? {
        switch self {
        case let .unreadableFile(reason):
            return "The file could not be read: \(reason)"
        case let .decodingFailed(reason):
            return "The JSON did not match the schema. \(reason)"
        case let .unsupportedSchemaVersion(found, supported):
            return "Unsupported schemaVersion \(found). This app understands version \(supported) only."
        case let .invalidCanvas(width, height):
            return "Canvas size must be positive, but was \(width) x \(height)."
        case .noSteps:
            return "The tutorial contains no steps."
        case let .stepWithoutStrokes(stepID):
            return "Step \"\(stepID)\" contains no strokes."
        case let .pathParsingFailed(stepID, strokeIndex, _, reason):
            return "Step \"\(stepID)\", stroke \(strokeIndex + 1): \(reason)"
        }
    }

    /// The offending path data, shown verbatim for path errors.
    var offendingPathData: String? {
        if case let .pathParsingFailed(_, _, d, _) = self { return d }
        return nil
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
enum TutorialLoader {

    /// Documented fallbacks when `style` is absent or unparseable.
    static let defaultStrokeHex = "#2B2B2B"
    static let defaultBackgroundHex = "#FAF7F0"

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
                failures.append(TutorialLoadFailure(fileName: url.lastPathComponent, error: error))
            } catch {
                failures.append(TutorialLoadFailure(fileName: url.lastPathComponent,
                                                    error: .unreadableFile(reason: error.localizedDescription)))
            }
        }

        tutorials.sort { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
        return (tutorials, failures)
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

    /// Reads a file that lives outside the sandbox (a Files app import), taking
    /// the security-scoped resource for the duration of the read.
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

        guard document.schemaVersion == TutorialDocument.supportedSchemaVersion else {
            throw TutorialLoadError.unsupportedSchemaVersion(found: document.schemaVersion,
                                                             supported: TutorialDocument.supportedSchemaVersion)
        }
        guard document.canvas.width > 0, document.canvas.height > 0 else {
            throw TutorialLoadError.invalidCanvas(width: document.canvas.width, height: document.canvas.height)
        }
        guard !document.steps.isEmpty else { throw TutorialLoadError.noSteps }

        var warnings: [String] = []

        let strokeColor = resolveColor(document.style?.strokeColor,
                                       fallbackHex: defaultStrokeHex,
                                       label: "strokeColor",
                                       warnings: &warnings)
        let backgroundColor = resolveColor(document.style?.backgroundColor,
                                           fallbackHex: defaultBackgroundHex,
                                           label: "backgroundColor",
                                           warnings: &warnings)

        var steps: [PreparedStep] = []
        steps.reserveCapacity(document.steps.count)

        for step in document.steps {
            guard !step.strokes.isEmpty else {
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

                strokes.append(PreparedStroke(path: path, duration: duration, lineWidth: lineWidth))
            }

            steps.append(PreparedStep(id: step.id,
                                      title: step.title,
                                      instruction: step.instruction,
                                      strokes: strokes))
        }

        return PreparedTutorial(
            tutorialID: document.id,
            title: document.title,
            canvas: CGSize(width: document.canvas.width, height: document.canvas.height),
            strokeColor: strokeColor,
            backgroundColor: backgroundColor,
            steps: steps,
            source: source,
            fileName: fileName,
            warnings: warnings
        )
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
