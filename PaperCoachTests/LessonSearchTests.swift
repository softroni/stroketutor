import SwiftUI
import XCTest
@testable import PaperCoach

/// The Lessons tab's search: what a learner types and what it finds.
final class LessonSearchTests: XCTestCase {

    // MARK: - Fixtures

    private static let tutorial = PreparedTutorial(tutorialID: "t", title: "T", canvas: CGSize(width: 100, height: 100),
                                                   schemaVersion: 1, strokeColor: .black, backgroundColor: .white,
                                                   steps: [], drawingBounds: CGRect(x: 0, y: 0, width: 100, height: 100),
                                                   source: .bundled, fileName: "t.json", warnings: [])

    private func path(_ id: String, _ title: String, _ lessons: [String]) -> PathModel {
        PathModel(id: id,
                  title: title,
                  description: nil,
                  level: nil,
                  lessons: lessons.map { lessonTitle in
                      Lesson(id: "\(id)/\(lessonTitle)", title: lessonTitle, pathId: id, tutorial: Self.tutorial,
                             objective: "", complexity: nil, reference: nil)
                  })
    }

    /// A small catalog in the shape of the real one, with a café, a tie between
    /// "Moon" and "Mountains", and two paths with "&" and "the" in their names.
    private lazy var catalog: [LessonsSection] = {
        let starter = CatalogLevel(id: "starter", title: "Starter", description: nil)
        let core = CatalogLevel(id: "core", title: "Core", description: nil)
        return [
            LessonsSection(level: starter, path: path("sky", "Sky & Weather", ["Sun", "Cloud", "Rain Cloud", "Crescent Moon"])),
            LessonsSection(level: starter, path: path("food", "Food & Treats", ["Donut", "Café Latte", "Ice Cream Cone"])),
            LessonsSection(level: core, path: path("water", "On the Water", ["Canoe", "Sailboat", "Fishing Boat", "Tugboat"])),
            LessonsSection(level: core, path: path("space", "Space", ["Comet", "Rocket", "Planet with Rings", "Space Shuttle"])),
            LessonsSection(level: nil, path: path("landscape", "Landscape", ["Mountains", "Mountain Valley", "Rolling Hills"])),
        ]
    }()

    private func titles(_ query: String) -> [String] {
        LessonSearch.filter(catalog, query: query).sections.flatMap { $0.entries.map(\.lesson.title) }
    }

    // MARK: - Matching

    func testTheStartOfAWordFindsIt() {
        XCTAssertEqual(titles("rock"), ["Rocket"])
        XCTAssertEqual(titles("sail"), ["Sailboat"])
    }

    func testCaseAccentsAndWidthDoNotMatter() {
        XCTAssertEqual(titles("ROCKET"), ["Rocket"])
        XCTAssertEqual(titles("cafe"), ["Café Latte"])
        XCTAssertEqual(titles("CAFÉ"), ["Café Latte"])
        XCTAssertEqual(titles("ｒｏｃｋｅｔ"), ["Rocket"]) // full-width letters
    }

    func testTwoLettersSwappedAreForgiven() {
        XCTAssertEqual(titles("rokcet"), ["Rocket"])
        XCTAssertEqual(titles("sialboat"), ["Sailboat"])
    }

    func testOneLetterWrongOrMissingIsForgivenInAWordOfFourOrMore() {
        XCTAssertEqual(titles("rocet"), ["Rocket"])     // one missing
        XCTAssertEqual(titles("comit"), ["Comet"])      // one wrong
        XCTAssertEqual(titles("dounut"), ["Donut"])     // one extra
    }

    func testAMisspelledWordStillBeingTypedIsForgiven() {
        // "rokc" is "rock" with two letters swapped: the start of "Rocket".
        XCTAssertEqual(titles("rokc"), ["Rocket"])
    }

    func testLongerWordsForgiveTwoTyposAndShorterOnesOnlyOne() {
        XCTAssertEqual(titles("shutlle"), ["Space Shuttle"])        // 7 letters, one swap
        XCTAssertEqual(titles("sailbaot"), ["Sailboat"])            // 8 letters, one swap
        XCTAssertEqual(titles("sialbaot"), ["Sailboat"])            // 8 letters, two swaps
        XCTAssertEqual(titles("sielbaot"), [])                      // 8 letters, three typos
        XCTAssertEqual(titles("rkcoet"), [])                        // 6 letters, two typos
    }

    func testShortWordsAreNotGuessedAt() {
        XCTAssertEqual(titles("sun"), ["Sun"])
        XCTAssertEqual(titles("snu"), [])
        XCTAssertEqual(titles("cna"), [])
        XCTAssertFalse(LessonSearch.matches(queryWord: "cra", textWord: "car"))
    }

    func testAWordThatStartsSomethingIsNotReadAsATypo() {
        // "moon" is one letter from the start of "mountains", but it is a word in
        // the list, so only the moon comes back.
        XCTAssertEqual(titles("moon"), ["Crescent Moon"])
    }

    func testEveryWordHasToMatch() {
        XCTAssertEqual(titles("rain cloud"), ["Rain Cloud"])
        XCTAssertEqual(titles("cloud rain"), ["Rain Cloud"])
        XCTAssertEqual(titles("cloud"), ["Cloud", "Rain Cloud"])
        XCTAssertEqual(titles("rocket boat"), [])
    }

    func testAPathsNameFindsTheWholePath() {
        let result = LessonSearch.filter(catalog, query: "space")
        XCTAssertEqual(result.sections.map(\.path.id), ["space"])
        XCTAssertEqual(result.sections.first?.entries.map(\.lesson.title),
                       ["Comet", "Rocket", "Planet with Rings", "Space Shuttle"])
        XCTAssertEqual(result.matchCount, 4)
    }

    func testAPathWordAndALessonWordNarrowTogether() {
        XCTAssertEqual(titles("weather moon"), ["Crescent Moon"])
        XCTAssertEqual(titles("water boat"), ["Fishing Boat"])
    }

    func testJoiningWordsAreSkippedUnlessTheyAreAllThereIs() {
        XCTAssertEqual(LessonSearch.searchWords(in: "on the water"), ["water"])
        XCTAssertEqual(titles("the canoe"), ["Canoe"])
        XCTAssertEqual(titles("sky and weather").count, 4)
        XCTAssertEqual(titles("Sky & Weather").count, 4)
        // Typed alone, "the" is searched for, and finds "On the Water".
        XCTAssertEqual(LessonSearch.searchWords(in: "the"), ["the"])
        XCTAssertEqual(LessonSearch.filter(catalog, query: "the").sections.map(\.path.id), ["water"])
    }

    func testPunctuationAndApostrophesSplitWords() {
        XCTAssertEqual(LessonSearch.words(in: "Lina's Café & Crème-Brûlée!"), ["lina", "s", "cafe", "creme", "brulee"])
    }

    // MARK: - What comes back

    func testEachLessonKeepsItsPlaceInItsPath() {
        let result = LessonSearch.filter(catalog, query: "cloud")
        XCTAssertEqual(result.sections.map(\.path.id), ["sky"])
        let entries = result.sections[0].entries
        XCTAssertEqual(entries.map(\.lesson.title), ["Cloud", "Rain Cloud"])
        XCTAssertEqual(entries.map(\.position), [2, 3])
        // Words match from their start: "boat" is the fishing boat, third on its path.
        let boat = LessonSearch.filter(catalog, query: "boat").sections.flatMap(\.entries)
        XCTAssertEqual(boat.map(\.lesson.title), ["Fishing Boat"])
        XCTAssertEqual(boat.map(\.position), [3])
    }

    func testSectionsStayInTheCatalogsOrderAndCountEveryMatch() {
        let result = LessonSearch.filter(catalog, query: "mo")
        XCTAssertEqual(result.sections.map(\.path.id), ["sky", "landscape"])
        XCTAssertEqual(result.sections.map(\.level?.id), ["starter", nil])
        XCTAssertEqual(result.matchCount, 3)
        XCTAssertEqual(result.sections[1].entries.map(\.position), [1, 2])
        XCTAssertTrue(result.isFiltered)
    }

    func testABlankQueryReturnsEverything() {
        for query in ["", "   ", " & "] {
            let result = LessonSearch.filter(catalog, query: query)
            XCTAssertFalse(result.isFiltered, "'\(query)'")
            XCTAssertEqual(result.sections.map(\.path.id), catalog.map(\.path.id))
            XCTAssertEqual(result.matchCount, 18)
            XCTAssertEqual(result.sections[2].entries.map(\.position), [1, 2, 3, 4])
        }
    }

    func testNothingMatchingReturnsNoSections() {
        let result = LessonSearch.filter(catalog, query: "dragon")
        XCTAssertTrue(result.sections.isEmpty)
        XCTAssertEqual(result.matchCount, 0)
        XCTAssertTrue(result.isFiltered)
    }

    // MARK: - Distance

    func testTheDistanceCountsASwapAsOneEdit() {
        func distance(_ a: String, _ b: String) -> Int { LessonSearch.distance(Array(a), Array(b)) }
        XCTAssertEqual(distance("rocket", "rocket"), 0)
        XCTAssertEqual(distance("rokcet", "rocket"), 1)
        XCTAssertEqual(distance("rocet", "rocket"), 1)
        XCTAssertEqual(distance("rackot", "rocket"), 2)
        XCTAssertEqual(distance("", "sun"), 3)
        XCTAssertEqual(distance("kitten", "sitting"), 3)
        // Past the limit it stops counting.
        XCTAssertEqual(LessonSearch.distance(Array("kitten"), Array("sitting"), limit: 1), 2)
        XCTAssertEqual(LessonSearch.distance(Array("sun"), Array("rocket"), limit: 1), 2)
    }
}
