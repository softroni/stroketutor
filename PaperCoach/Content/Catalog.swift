import Foundation

/// The curriculum as the shared files describe it: which lesson belongs to which
/// path, in what order, and how far through authoring it is. These types mirror
/// `shared/catalog.schema.json` exactly — `Catalog/paths.json` is the `pathsFile`
/// definition and `Catalog/lessons.json` the `lessonsFile` — and nothing else. The
/// app never hardcodes a lesson: what these files say is what `hp-home`, `hp-paths`
/// and `hp-path` show.
struct Catalog {
    /// The levels the paths are grouped under, easiest first. Empty for a
    /// curriculum that is one flat list of paths.
    let levels: [CatalogLevel]
    let paths: [CatalogPath]
    let lessons: [CatalogLesson]

    init(levels: [CatalogLevel] = [], paths: [CatalogPath], lessons: [CatalogLesson]) {
        self.levels = levels
        self.paths = paths
        self.lessons = lessons
    }

    static let empty = Catalog(paths: [], lessons: [])

    func lesson(id: String) -> CatalogLesson? {
        lessons.first { $0.id == id }
    }

    func path(id: String) -> CatalogPath? {
        paths.first { $0.id == id }
    }

    func level(id: String) -> CatalogLevel? {
        levels.first { $0.id == id }
    }

    /// The paths grouped the way `hp-paths` lists them: one section per level, in
    /// the catalog's level order, each holding its paths in catalog order, then one
    /// last section without a level for the paths that name none (or name one this
    /// catalog does not carry). A section with no paths is left out, so a level that
    /// nothing has been written for yet never shows as an empty heading.
    var pathSections: [CatalogPathSection] {
        var byLevel: [String: [CatalogPath]] = [:]
        var unlevelled: [CatalogPath] = []
        let known = Set(levels.map(\.id))

        for path in paths {
            if let level = path.level, known.contains(level) {
                byLevel[level, default: []].append(path)
            } else {
                unlevelled.append(path)
            }
        }

        var sections: [CatalogPathSection] = []
        var seen: Set<String> = []
        for level in levels where !seen.contains(level.id) {
            seen.insert(level.id)
            guard let paths = byLevel[level.id], !paths.isEmpty else { continue }
            sections.append(CatalogPathSection(level: level, paths: paths))
        }
        if !unlevelled.isEmpty {
            sections.append(CatalogPathSection(level: nil, paths: unlevelled))
        }
        return sections
    }
}

/// One level: a name for a group of paths and a line on what they teach. A level
/// only groups and recommends — it never locks a path, and the learner is free to
/// draw anything in any of them.
struct CatalogLevel: Codable, Identifiable, Hashable {
    let id: String
    /// A name, not a number: "Starter", not "Level 1".
    let title: String
    /// One line on what the paths of this level teach.
    let description: String?
}

/// The paths of one level, ready for a screen to draw under a heading. `level` is
/// nil for the trailing section: the paths that belong to no level.
struct CatalogPathSection: Identifiable, Hashable {
    let level: CatalogLevel?
    let paths: [CatalogPath]

    /// A level id can never be empty, so the trailing section cannot collide.
    var id: String { level?.id ?? "" }
}

/// One subject path, in the order the learner sees it.
struct CatalogPath: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let description: String?
    /// The id of the level this path belongs to, when the catalog has levels. The
    /// loader clears a level no `levels` entry names, so this is either nil or a
    /// level the catalog carries.
    let level: String?
    /// Lessons in unlock order. Each must exist in `lessons.json`.
    let lessonIds: [String]
}

/// One lesson's place in the curriculum. The drawing itself lives in
/// `Tutorials/<id>.json`; this is everything around it.
struct CatalogLesson: Codable, Identifiable, Hashable {
    let id: String
    let status: LessonStatus
    /// The lesson's name while it is planned, before a tutorial exists. Once one
    /// does, the tutorial's title is the lesson's name and this is dropped — so no
    /// screen reads it: a planned lesson never reaches a learner.
    let title: String?
    /// One line: the single new idea this lesson teaches.
    let objective: String
    /// Relative difficulty inside the path, 1 to 5.
    let complexity: Int?
    /// Authoring notes for the creator. Never shown to a learner.
    let notes: String?
    let reference: LessonReference?
}

/// Authoring state. Only `approved` lessons reach learners.
///
/// A state this app does not know is kept as `unknown` rather than thrown: a newer
/// catalog that names a state written after this build must cost that one lesson,
/// never the whole file. An unknown state is not `approved`, so the loader skips it
/// exactly as it skips a draft.
enum LessonStatus: Codable, Hashable {
    /// A place held in the curriculum before its tutorial exists. Never published.
    case planned
    case draft
    case needsReview
    case approved
    case unknown(String)

    init(rawValue: String) {
        switch rawValue {
        case "planned": self = .planned
        case "draft": self = .draft
        case "needs-review": self = .needsReview
        case "approved": self = .approved
        default: self = .unknown(rawValue)
        }
    }

    /// The string the catalog file carries, an unknown one included, so a warning
    /// can name what it actually read.
    var rawValue: String {
        switch self {
        case .planned: return "planned"
        case .draft: return "draft"
        case .needsReview: return "needs-review"
        case .approved: return "approved"
        case .unknown(let name): return name
        }
    }

    init(from decoder: Decoder) throws {
        self.init(rawValue: try decoder.singleValueContainer().decode(String.self))
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
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
    /// Optional: a curriculum without levels is one flat list of paths.
    let levels: [CatalogLevel]?
    let paths: [CatalogPath]
}

/// The shape of `Catalog/lessons.json`.
struct CatalogLessonsFile: Codable {
    let catalogVersion: Int
    let lessons: [CatalogLesson]
}
