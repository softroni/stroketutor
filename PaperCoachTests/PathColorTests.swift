import XCTest
@testable import PaperCoach

/// A path's color comes from the catalog, so the app and the Studio's lesson videos
/// paint a path alike. A path that names none, or one this build does not know,
/// still wears a color, by its place, and never costs the catalog anything else.
final class PathColorTests: XCTestCase {

    func testTheCatalogCarriesAPathsColor() {
        let result = CatalogLoader.load(pathsJSON: Self.paths(color: "\"leaf\""), lessonsJSON: Self.lessons)
        XCTAssertEqual(result.catalog.path(id: "plants")?.color, "leaf")
        XCTAssertEqual(result.warnings, [])
    }

    func testAColorANewerCatalogNamesCostsNothingElse() {
        let result = CatalogLoader.load(pathsJSON: Self.paths(color: "\"teal\""), lessonsJSON: Self.lessons)
        let path = result.catalog.path(id: "plants")
        XCTAssertEqual(path?.lessonIds, ["palm-tree-4"])
        XCTAssertEqual(path?.color, "teal")
        XCTAssertEqual(PathTint.forPath(named: "teal", at: 3), PathTint.palette[3])
    }

    func testAPathWithNoColorTakesOneByItsPlace() {
        let result = CatalogLoader.load(pathsJSON: Self.paths(color: nil), lessonsJSON: Self.lessons)
        XCTAssertNil(result.catalog.path(id: "plants")?.color)
        XCTAssertEqual(PathTint.forPath(named: nil, at: 11), PathTint.palette[1])
    }

    /// The names `catalog.schema.json` allows, in palette order.
    func testEveryNameTheCatalogCanUseIsAPaletteColor() {
        let names = ["sky", "peach", "pink", "butter", "leaf", "lavender", "aqua", "indigo", "orchid", "sand"]
        XCTAssertEqual(names.count, PathTint.palette.count)
        for (index, name) in names.enumerated() {
            XCTAssertEqual(PathTint.named(name), PathTint.palette[index], name)
        }
        XCTAssertNil(PathTint.named("teal"))
    }

    @MainActor
    func testTheShippedPathsWearTheColorsTheyName() throws {
        let model = AppModel(bundle: .appUnderTest,
                             settings: Settings(defaults: CatalogLoaderTests.scratchDefaults()),
                             storeDirectory: CatalogLoaderTests.temporaryDirectory())
        model.loadContent()
        XCTAssertFalse(model.paths.isEmpty)
        for path in model.paths {
            let name = try XCTUnwrap(path.color, "\(path.id) names no color.")
            let tint = try XCTUnwrap(PathTint.named(name), "\(path.id) names \(name), which this build does not know.")
            XCTAssertEqual(model.tint(for: path), tint)
        }
        let plants = try XCTUnwrap(model.path(id: "plants"))
        XCTAssertEqual(model.tint(for: plants), PathTint.named("leaf"))
        // While the palette has room, no two paths look alike.
        XCTAssertEqual(Set(model.paths.compactMap(\.color)).count, min(model.paths.count, PathTint.palette.count))
    }

    // MARK: - Fixtures

    private static func paths(color: String?) -> Data {
        let key = color.map { "\"color\": \($0)," } ?? ""
        return Data("""
        { "catalogVersion": 1, "paths": [{ "id": "plants", "title": "Plants", \(key) "lessonIds": ["palm-tree-4"] }] }
        """.utf8)
    }

    private static let lessons = Data("""
    { "catalogVersion": 1, "lessons": [{ "id": "palm-tree-4", "status": "approved", "objective": "A palm tree." }] }
    """.utf8)
}
