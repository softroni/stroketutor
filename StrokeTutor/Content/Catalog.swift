import Foundation

/// The curriculum as the shared files describe it: which lesson belongs to which
/// path, in what order, and how far through authoring it is. These types mirror
/// `shared/catalog.schema.json` exactly — `Catalog/paths.json` is the `pathsFile`
/// definition and `Catalog/lessons.json` the `lessonsFile` — and nothing else. The
/// app never hardcodes a lesson: what these files say is what `hp-home`, `hp-paths`
/// and `hp-path` show.
struct Catalog {
    let paths: [CatalogPath]
    let lessons: [CatalogLesson]

    static let empty = Catalog(paths: [], lessons: [])

    func lesson(id: String) -> CatalogLesson? {
        lessons.first { $0.id == id }
    }

    func path(id: String) -> CatalogPath? {
        paths.first { $0.id == id }
    }
}

/// One subject path, in the order the learner sees it.
struct CatalogPath: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let description: String?
    /// Lessons in unlock order. Each must exist in `lessons.json`.
    let lessonIds: [String]
}

/// One lesson's place in the curriculum. The drawing itself lives in
/// `Tutorials/<id>.json`; this is everything around it.
struct CatalogLesson: Codable, Identifiable, Hashable {
    let id: String
    let status: LessonStatus
    /// One line: the single new idea this lesson teaches.
    let objective: String
    /// Relative difficulty inside the path, 1 to 5.
    let complexity: Int?
    /// Authoring notes for the creator. Never shown to a learner.
    let notes: String?
    let reference: LessonReference?
}

/// Authoring state. Only `approved` lessons reach learners.
enum LessonStatus: String, Codable, Hashable {
    case draft
    case needsReview = "needs-review"
    case approved
}

/// The real-world photo a lesson simplifies, with where it came from and the terms
/// it may be used under. `file` is a bare name inside `References/` in the bundle,
/// so it can never point outside that folder.
struct LessonReference: Codable, Hashable {
    let file: String
    let source: String
    let license: String

    /// True for a file the reference view has to render as vector art.
    var isVector: Bool {
        file.lowercased().hasSuffix(".svg")
    }
}

/// The shape of `Catalog/paths.json`.
struct CatalogPathsFile: Codable {
    let catalogVersion: Int
    let paths: [CatalogPath]
}

/// The shape of `Catalog/lessons.json`.
struct CatalogLessonsFile: Codable {
    let catalogVersion: Int
    let lessons: [CatalogLesson]
}
