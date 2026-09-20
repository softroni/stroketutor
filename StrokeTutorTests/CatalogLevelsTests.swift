import UIKit
import XCTest
@testable import StrokeTutor

/// Levels group the paths on `hp-paths` and recommend an order to work through
/// them. They never lock anything, and a catalog without them is still a catalog —
/// so these tests guard both the grouping and everything it must not change.
final class CatalogLevelsTests: XCTestCase {

    // MARK: - Decoding

    func testDecodesLevelsAndThePathsThatNameThem() {
        let result = CatalogLoader.load(pathsJSON: Self.pathsJSON(levels: Self.twoLevels,
                                                                  paths: Self.threePaths),
                                        lessonsJSON: Self.lessonsJSON())

        XCTAssertEqual(result.catalog.levels.map(\.id), ["starter", "core"])
        XCTAssertEqual(result.catalog.level(id: "starter")?.title, "Starter")
        XCTAssertEqual(result.catalog.level(id: "starter")?.description,
                       "Shapes you already know.")
        XCTAssertNil(result.catalog.level(id: "core")?.description)
        XCTAssertEqual(result.catalog.path(id: "fruits")?.level, "starter")
        XCTAssertEqual(result.catalog.path(id: "plants")?.level, "core")
        XCTAssertNil(result.catalog.path(id: "lettering")?.level)
    }

    /// The shape every catalog had before levels existed: no `levels` key, no path
    /// naming one. It must load exactly as it always did, and warn about nothing.
    func testACatalogWithoutLevelsLoadsAsBefore() {
        let paths = """
        [{ "id": "plants", "title": "Plants", "lessonIds": ["palm-tree-4"] },
         { "id": "wheels", "title": "Wheels", "lessonIds": ["classic-red-car"] }]
        """
        let result = CatalogLoader.load(pathsJSON: Self.pathsJSON(levels: nil, paths: paths),
                                        lessonsJSON: Self.lessonsJSON())

        XCTAssertTrue(result.catalog.levels.isEmpty)
        XCTAssertEqual(result.catalog.paths.map(\.id), ["plants", "wheels"])
        XCTAssertEqual(result.catalog.paths.map(\.lessonIds), [["palm-tree-4"], ["classic-red-car"]])
        XCTAssertTrue(result.catalog.paths.allSatisfy { $0.level == nil })
        XCTAssertTrue(result.warnings.isEmpty, "\(result.warnings)")
        XCTAssertEqual(result.catalog.pathSections.count, 1)
        XCTAssertNil(result.catalog.pathSections.first?.level)
    }

    func testAPathNamingALevelTheCatalogDoesNotCarryKeepsThePathAndLosesTheLevel() {
        let paths = """
        [{ "id": "plants", "title": "Plants", "level": "made-up", "lessonIds": ["palm-tree-4"] }]
        """
        let result = CatalogLoader.load(pathsJSON: Self.pathsJSON(levels: Self.twoLevels, paths: paths),
                                        lessonsJSON: Self.lessonsJSON())

        XCTAssertEqual(result.catalog.paths.map(\.id), ["plants"])
        XCTAssertNil(result.catalog.path(id: "plants")?.level)
        XCTAssertTrue(result.warnings.contains { $0.contains("made-up") }, "\(result.warnings)")
        XCTAssertEqual(result.catalog.pathSections.count, 1)
        XCTAssertNil(result.catalog.pathSections.first?.level, "It is listed with the ungrouped paths.")
    }

    func testALevelNamedTwiceKeepsTheFirstOne() {
        let levels = """
        [{ "id": "core", "title": "Core" },
         { "id": "core", "title": "Core again" }]
        """
        let paths = """
        [{ "id": "plants", "title": "Plants", "level": "core", "lessonIds": ["palm-tree-4"] }]
        """
        let result = CatalogLoader.load(pathsJSON: Self.pathsJSON(levels: levels, paths: paths),
                                        lessonsJSON: Self.lessonsJSON())

        XCTAssertEqual(result.catalog.levels.map(\.title), ["Core"])
        XCTAssertTrue(result.warnings.contains { $0.contains("more than once") }, "\(result.warnings)")
        XCTAssertEqual(result.catalog.pathSections.count, 1)
    }

    // MARK: - Grouping

    func testSectionsFollowTheLevelOrderAndKeepTheirPathsInCatalogOrder() {
        let catalog = Catalog(levels: [Self.level("starter"), Self.level("core"), Self.level("advanced")],
                              paths: [Self.path("plants", level: "core"),
                                      Self.path("fruits", level: "starter"),
                                      Self.path("wheels", level: "core"),
                                      Self.path("lettering", level: "advanced")],
                              lessons: [])

        let sections = catalog.pathSections
        XCTAssertEqual(sections.map { $0.level?.id }, ["starter", "core", "advanced"])
        XCTAssertEqual(sections.map { $0.paths.map(\.id) },
                       [["fruits"], ["plants", "wheels"], ["lettering"]])
    }

    func testALevelWithNoPathsIsNotASection() {
        let catalog = Catalog(levels: [Self.level("starter"), Self.level("core")],
                              paths: [Self.path("plants", level: "core")],
                              lessons: [])

        XCTAssertEqual(catalog.pathSections.map { $0.level?.id }, ["core"])
    }

    func testThePathsWithNoLevelCloseTheList() {
        let catalog = Catalog(levels: [Self.level("core")],
                              paths: [Self.path("lettering", level: nil),
                                      Self.path("plants", level: "core"),
                                      Self.path("wheels", level: "gone")],
                              lessons: [])

        let sections = catalog.pathSections
        XCTAssertEqual(sections.map { $0.level?.id }, ["core", nil])
        XCTAssertEqual(sections.last?.paths.map(\.id), ["lettering", "wheels"],
                       "A level the catalog does not carry is no level at all.")
    }

    func testACatalogWithNoLevelsIsOneUnheadedSection() {
        let catalog = Catalog(paths: [Self.path("plants", level: nil), Self.path("wheels", level: nil)],
                              lessons: [])

        XCTAssertEqual(catalog.pathSections.count, 1)
        XCTAssertNil(catalog.pathSections.first?.level)
        XCTAssertEqual(catalog.pathSections.first?.paths.map(\.id), ["plants", "wheels"])
    }

    func testAnEmptyCatalogHasNoSections() {
        XCTAssertTrue(Catalog.empty.pathSections.isEmpty)
    }

    // MARK: - Lesson status

    /// A status written after this build must cost that one lesson, never the file.
    func testAnUnknownStatusSkipsOneLessonAndKeepsTheRest() {
        let lessons = """
        [{ "id": "palm-tree-4", "status": "approved", "objective": "A palm tree." },
         { "id": "from-the-future", "status": "sparkling", "objective": "Who knows." },
         { "id": "classic-red-car", "status": "approved", "objective": "A red car." }]
        """
        let result = CatalogLoader.load(pathsJSON: Self.pathsJSON(levels: nil, paths: Self.threePaths),
                                        lessonsJSON: Self.lessonsJSON(lessons))

        XCTAssertEqual(result.catalog.lessons.map(\.id), ["palm-tree-4", "classic-red-car"],
                       "The two approved lessons must survive the one this app cannot read.")
        XCTAssertTrue(result.warnings.contains { $0.contains("from-the-future") && $0.contains("sparkling") },
                      "The warning should name the lesson and the state it read. \(result.warnings)")
    }

    func testAPlannedLessonIsSkippedLikeAnyUnapprovedOne() {
        let lessons = """
        [{ "id": "palm-tree-4", "status": "approved", "objective": "A palm tree." },
         { "id": "coconut", "status": "planned", "title": "A coconut", "objective": "Ellipses." }]
        """
        let paths = """
        [{ "id": "plants", "title": "Plants", "lessonIds": ["palm-tree-4", "coconut"] }]
        """
        let result = CatalogLoader.load(pathsJSON: Self.pathsJSON(levels: nil, paths: paths),
                                        lessonsJSON: Self.lessonsJSON(lessons))

        XCTAssertEqual(result.catalog.lessons.map(\.id), ["palm-tree-4"])
        XCTAssertNil(result.catalog.lesson(id: "coconut"))
        XCTAssertEqual(result.catalog.path(id: "plants")?.lessonIds, ["palm-tree-4"],
                       "A path keeps only the lessons a learner can actually open.")
        XCTAssertTrue(result.warnings.contains { $0.contains("coconut") && $0.contains("planned") },
                      "\(result.warnings)")
    }

    func testAPlannedLessonCarriesItsTitle() throws {
        let lessons = """
        [{ "id": "coconut", "status": "planned", "title": "A coconut", "objective": "Ellipses." }]
        """
        let file = try JSONDecoder().decode(CatalogLessonsFile.self, from: Self.lessonsJSON(lessons))
        let lesson = try XCTUnwrap(file.lessons.first)

        XCTAssertEqual(lesson.status, .planned)
        XCTAssertEqual(lesson.title, "A coconut")
    }

    // MARK: - Path icons

    /// Every path of the curriculum wears a real SF Symbol in onboarding, not the
    /// empty square a misspelt name draws.
    func testEveryCurriculumPathHasASymbolThatExists() {
        let ids = ["sky-weather", "fruits", "food-treats",
                   "forms", "plants", "wheels", "on-the-water", "in-the-air", "space", "buildings",
                   "gear", "fantasy-objects", "lettering",
                   "trees", "cars"]
        for id in ids {
            let path = PathModel(id: id, title: id, description: nil, lessons: [])
            XCTAssertNotEqual(path.onboardingSymbol, "scribble", "\(id) has no symbol of its own.")
            XCTAssertNotNil(UIImage(systemName: path.onboardingSymbol),
                            "\(path.onboardingSymbol) is not an SF Symbol on this system.")
        }
    }

    func testAPathTheCatalogAddsLaterGetsTheNeutralMark() {
        let path = PathModel(id: "something-new", title: "Something new", description: nil, lessons: [])
        XCTAssertEqual(path.onboardingSymbol, "scribble")
    }

    // MARK: - Fixtures

    private static let twoLevels = """
    [{ "id": "starter", "title": "Starter", "description": "Shapes you already know." },
     { "id": "core", "title": "Core" }]
    """

    private static let threePaths = """
    [{ "id": "fruits", "title": "Fruits", "level": "starter", "lessonIds": [] },
     { "id": "plants", "title": "Plants", "level": "core", "lessonIds": ["palm-tree-4"] },
     { "id": "lettering", "title": "Lettering", "lessonIds": ["classic-red-car"] }]
    """

    private static func pathsJSON(levels: String?, paths: String) -> Data {
        let levelsKey = levels.map { "\"levels\": \($0)," } ?? ""
        return Data("""
        { "catalogVersion": 1, \(levelsKey) "paths": \(paths) }
        """.utf8)
    }

    private static func lessonsJSON(_ lessons: String = """
        [{ "id": "palm-tree-4", "status": "approved", "objective": "A palm tree." },
         { "id": "classic-red-car", "status": "approved", "objective": "A red car." }]
        """) -> Data {
        Data("""
        { "catalogVersion": 1, "lessons": \(lessons) }
        """.utf8)
    }

    private static func level(_ id: String) -> CatalogLevel {
        CatalogLevel(id: id, title: id.capitalized, description: nil)
    }

    private static func path(_ id: String, level: String?) -> CatalogPath {
        CatalogPath(id: id, title: id.capitalized, description: nil, level: level, lessonIds: [])
    }
}
