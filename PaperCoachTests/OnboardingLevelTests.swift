import XCTest
@testable import PaperCoach

/// `ob-level` asks how much the learner has drawn, and `ob-path` then offers at most
/// four paths of that level. Both are worked out from the catalog alone, so these
/// tests guard the grouping, the cap, the order, and the flat list a catalog
/// without levels falls back to.
@MainActor
final class OnboardingLevelTests: XCTestCase {

    // MARK: - The bundled catalog

    func testEveryPathCarriesTheLevelTheCatalogGivesIt() {
        let model = makeModel()
        XCTAssertFalse(model.paths.isEmpty)

        for path in model.paths {
            XCTAssertEqual(path.level, model.catalog.path(id: path.id)?.level,
                           "\(path.id) should carry its catalog level.")
        }
        XCTAssertTrue(model.paths.contains { $0.level != nil },
                      "The bundled catalog groups its paths into levels.")
    }

    func testTheBundledCatalogOffersItsLevelsInOrder() throws {
        let model = makeModel()
        let choices = OnboardingPathChoices(levels: model.catalog.levels, paths: model.paths)

        XCTAssertTrue(choices.asksForLevel)
        XCTAssertEqual(choices.levels.map(\.id), ["starter", "core", "advanced"])

        let starter = try XCTUnwrap(choices.level(id: "starter"))
        XCTAssertEqual(starter.paths.map(\.id), ["sky-weather", "fruits", "food-treats"])
        XCTAssertNil(starter.onlyPath)

        let core = try XCTUnwrap(choices.level(id: "core"))
        XCTAssertEqual(core.paths.map(\.id), ["forms", "plants", "wheels", "on-the-water"],
                       "Core ships six paths; the first four, in catalog order, are offered.")

        let advanced = try XCTUnwrap(choices.level(id: "advanced"))
        XCTAssertEqual(advanced.onlyPath?.id, "landscape",
                       "A level with one path is the answer on its own.")
    }

    // MARK: - Grouping

    func testALevelOffersAtMostFourPathsInCatalogOrder() throws {
        let paths = try ["a", "b", "c", "d", "e", "f"].map { try Self.path($0, level: "core") }
        let choices = OnboardingPathChoices(levels: [Self.level("core")], paths: paths)

        let core = try XCTUnwrap(choices.level(id: "core"))
        XCTAssertEqual(core.paths.map(\.id), ["a", "b", "c", "d"])
        XCTAssertEqual(choices.paths(in: core).map(\.id), ["a", "b", "c", "d"])
    }

    func testALevelWithNothingShippedIsNotAsked() throws {
        let choices = OnboardingPathChoices(
            levels: [Self.level("starter"), Self.level("core")],
            paths: [try Self.path("plants", level: "core"),
                    try Self.path("fruits", level: "starter", lessons: 0)])

        XCTAssertEqual(choices.levels.map(\.id), ["core"],
                       "A path with no lesson in the bundle cannot stand for its level.")
    }

    func testACatalogWithoutLevelsOffersTheFirstFourPaths() throws {
        let paths = try ["a", "b", "c", "d", "e"].map { try Self.path($0, level: nil) }
        let choices = OnboardingPathChoices(levels: [], paths: paths)

        XCTAssertFalse(choices.asksForLevel)
        XCTAssertTrue(choices.levels.isEmpty)
        XCTAssertNil(choices.chosenLevel(tapped: nil, tappedPath: nil, storedPath: nil))
        XCTAssertEqual(choices.paths(in: nil).map(\.id), ["a", "b", "c", "d"])
    }

    func testLevelsNoShippedPathNamesAreNotAsked() throws {
        let paths = try ["a", "b"].map { try Self.path($0, level: nil) }
        let choices = OnboardingPathChoices(levels: [Self.level("starter")], paths: paths)

        XCTAssertFalse(choices.asksForLevel)
        XCTAssertEqual(choices.paths(in: nil).map(\.id), ["a", "b"])
    }

    // MARK: - What is shown as chosen

    func testTheChosenLevelFollowsTheTapThenThePathThenTheFirst() throws {
        let choices = try Self.twoLevels()

        XCTAssertEqual(choices.chosenLevel(tapped: nil, tappedPath: nil, storedPath: nil)?.id, "starter")
        XCTAssertEqual(choices.chosenLevel(tapped: nil, tappedPath: nil, storedPath: "plants")?.id, "core",
                       "A replayed flow opens on the level of the learner's own path.")
        XCTAssertEqual(choices.chosenLevel(tapped: nil, tappedPath: "fruits", storedPath: "plants")?.id,
                       "starter")
        XCTAssertEqual(choices.chosenLevel(tapped: "core", tappedPath: "fruits", storedPath: nil)?.id, "core")
        XCTAssertEqual(choices.chosenLevel(tapped: "gone", tappedPath: nil, storedPath: nil)?.id, "starter")
    }

    /// A path past the fourth is not on `ob-path`, but its level still is the
    /// learner's; the picker then opens on the first path it can show.
    func testAPathPastTheFourthStillChoosesItsLevel() throws {
        let paths = try ["a", "b", "c", "d", "e"].map { try Self.path($0, level: "core") }
        let choices = OnboardingPathChoices(levels: [Self.level("starter"), Self.level("core")],
                                            paths: [try Self.path("fruits", level: "starter")] + paths)

        let level = choices.chosenLevel(tapped: nil, tappedPath: nil, storedPath: "e")
        XCTAssertEqual(level?.id, "core")
        XCTAssertEqual(choices.chosenPath(in: level, tapped: nil, storedPath: "e")?.id, "a")
    }

    func testTheChosenPathIsAlwaysOneTheLevelOffers() throws {
        let choices = try Self.twoLevels()
        let core = try XCTUnwrap(choices.level(id: "core"))

        XCTAssertEqual(choices.chosenPath(in: core, tapped: nil, storedPath: nil)?.id, "plants")
        XCTAssertEqual(choices.chosenPath(in: core, tapped: nil, storedPath: "wheels")?.id, "wheels")
        XCTAssertEqual(choices.chosenPath(in: core, tapped: "plants", storedPath: "wheels")?.id, "plants")
        XCTAssertEqual(choices.chosenPath(in: core, tapped: "fruits", storedPath: "fruits")?.id, "plants",
                       "A path of another level is never shown as chosen.")
    }

    // MARK: - The line under each level

    func testTheCurriculumLevelsHaveALineAndANewOneHasNone() {
        XCTAssertEqual(Self.level("starter").onboardingLine, "New to drawing")
        XCTAssertEqual(Self.level("core").onboardingLine, "Some practice")
        XCTAssertEqual(Self.level("advanced").onboardingLine, "Ready for more")
        XCTAssertNil(Self.level("something-new").onboardingLine)
    }

    // MARK: - Fixtures

    private func makeModel() -> AppModel {
        let model = AppModel(bundle: .appUnderTest,
                             settings: Settings(defaults: CatalogLoaderTests.scratchDefaults()),
                             storeDirectory: CatalogLoaderTests.temporaryDirectory())
        model.loadContent()
        return model
    }

    /// Starter holds fruits; Core holds plants and wheels.
    private static func twoLevels() throws -> OnboardingPathChoices {
        OnboardingPathChoices(levels: [level("starter"), level("core")],
                              paths: [try path("fruits", level: "starter"),
                                      try path("plants", level: "core"),
                                      try path("wheels", level: "core")])
    }

    private static func level(_ id: String) -> CatalogLevel {
        CatalogLevel(id: id, title: id.capitalized, description: nil)
    }

    /// A path of one-step lessons, or of none when `lessons` is zero.
    private static func path(_ id: String, level: String?, lessons: Int = 1) throws -> PathModel {
        let fixture = try ProgressStoreTests.makePath(lessonCount: 1)
        return PathModel(id: id,
                         title: id.capitalized,
                         description: nil,
                         level: level,
                         lessons: lessons == 0 ? [] : fixture.lessons)
    }
}
