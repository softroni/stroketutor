import Foundation
import OSLog

/// Reads `Catalog/paths.json` and `Catalog/lessons.json` out of the bundle.
///
/// Lenient by design, like `TutorialLoader`: a missing file, a malformed entry or a
/// path that names a lesson nobody wrote is a logged warning and a smaller catalog,
/// never a crash and never an alert. An app with no catalog at all still launches
/// and says "No lessons are installed." (`hp-home`, empty state).
enum CatalogLoader {

    /// The bundle subdirectory holding the catalog. A folder reference, so adding a
    /// file to `shared/Catalog` needs no code change.
    static let bundleSubdirectory = "Catalog"

    private static let log = Logger(subsystem: "com.softroni.StrokeTutor", category: "catalog")

    /// What one load produced: the catalog, and everything that was skipped.
    struct Result {
        let catalog: Catalog
        let warnings: [String]

        static let empty = Result(catalog: .empty, warnings: [])
    }

    /// Reads both files. Only `approved` lessons are kept, and a path keeps only the
    /// lessons that survived, in its own order.
    static func load(from bundle: Bundle = .main) -> Result {
        var warnings: [String] = []

        let pathsFile: CatalogPathsFile? = decode("paths", in: bundle, warnings: &warnings)
        let lessonsFile: CatalogLessonsFile? = decode("lessons", in: bundle, warnings: &warnings)

        return join(pathsFile, lessonsFile, warnings: warnings)
    }

    /// The same load from two files already in hand rather than from a bundle, the
    /// way `TutorialLoader.prepare(data:fileName:source:)` is. Malformed JSON is a
    /// warning and an empty half, exactly as it is in a bundle.
    static func load(pathsJSON: Data?, lessonsJSON: Data?) -> Result {
        var warnings: [String] = []

        let pathsFile: CatalogPathsFile? = decode("paths", from: pathsJSON, warnings: &warnings)
        let lessonsFile: CatalogLessonsFile? = decode("lessons", from: lessonsJSON, warnings: &warnings)

        return join(pathsFile, lessonsFile, warnings: warnings)
    }

    // MARK: - Joining

    /// Turns the two decoded files into the catalog the app works with: approved
    /// lessons only, levels the paths can actually name, and paths that keep just
    /// the lessons that survived.
    private static func join(_ pathsFile: CatalogPathsFile?,
                             _ lessonsFile: CatalogLessonsFile?,
                             warnings: [String]) -> Result {
        var warnings = warnings

        let allLessons = lessonsFile?.lessons ?? []
        var approved: [CatalogLesson] = []
        for lesson in allLessons {
            guard lesson.status == .approved else {
                warnings.append("Lesson \"\(lesson.id)\" is \(lesson.status.rawValue); skipped.")
                continue
            }
            approved.append(lesson)
        }

        // A level named twice is a mistake in the file, not a choice: the first one
        // wins, so the order the paths are grouped in stays the file's order.
        var levels: [CatalogLevel] = []
        var levelIds: Set<String> = []
        for level in pathsFile?.levels ?? [] {
            guard levelIds.insert(level.id).inserted else {
                warnings.append("Level \"\(level.id)\" is named more than once; the first one was kept.")
                continue
            }
            levels.append(level)
        }

        let known = Set(approved.map(\.id))
        var paths: [CatalogPath] = []
        for path in pathsFile?.paths ?? [] {
            let kept = path.lessonIds.filter { id in
                if known.contains(id) { return true }
                warnings.append("Path \"\(path.id)\" names lesson \"\(id)\", which is not an approved lesson; skipped.")
                return false
            }
            // A path is never lost over its level: an id no level carries is
            // dropped and the path is listed with the ones that have no level.
            var level = path.level
            if let named = level, !levelIds.contains(named) {
                warnings.append("Path \"\(path.id)\" names level \"\(named)\", which is not in the catalog; the path is listed without a level.")
                level = nil
            }
            paths.append(CatalogPath(id: path.id,
                                     title: path.title,
                                     description: path.description,
                                     level: level,
                                     lessonIds: kept))
        }

        for warning in warnings { log.warning("\(warning, privacy: .public)") }
        return Result(catalog: Catalog(levels: levels, paths: paths, lessons: approved),
                      warnings: warnings)
    }

    // MARK: - Files

    private static func decode<T: Decodable>(_ name: String,
                                             in bundle: Bundle,
                                             warnings: inout [String]) -> T? {
        guard let url = url(for: name, in: bundle) else {
            warnings.append("Catalog/\(name).json is not in the bundle; no content was loaded from it.")
            return nil
        }
        do {
            return try JSONDecoder().decode(T.self, from: Data(contentsOf: url))
        } catch {
            warnings.append("Catalog/\(name).json could not be read: \(error.localizedDescription)")
            return nil
        }
    }

    private static func decode<T: Decodable>(_ name: String,
                                             from data: Data?,
                                             warnings: inout [String]) -> T? {
        guard let data else {
            warnings.append("Catalog/\(name).json was not supplied; no content was loaded from it.")
            return nil
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            warnings.append("Catalog/\(name).json could not be read: \(error.localizedDescription)")
            return nil
        }
    }

    private static func url(for name: String, in bundle: Bundle) -> URL? {
        if let url = bundle.url(forResource: name, withExtension: "json", subdirectory: bundleSubdirectory) {
            return url
        }
        // Fallback for build setups where the folder is copied without being
        // indexed as a resource subdirectory.
        guard let resourceURL = bundle.resourceURL else { return nil }
        let candidate = resourceURL
            .appendingPathComponent(bundleSubdirectory, isDirectory: true)
            .appendingPathComponent("\(name).json")
        return FileManager.default.fileExists(atPath: candidate.path) ? candidate : nil
    }
}
