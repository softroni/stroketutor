import XCTest
@testable import StrokeTutor

final class PathSuggestionsTests: XCTestCase {

    func testSameDayGivesTheSameCards() {
        let first = PathSuggestions.pick(sameLevel: [1, 2, 3, 4, 5, 6], others: [7, 8], count: 4, day: 12)
        let again = PathSuggestions.pick(sameLevel: [1, 2, 3, 4, 5, 6], others: [7, 8], count: 4, day: 12)
        XCTAssertEqual(first, again)
    }

    func testNextDayStartsWhereTheLastLeftOff() {
        let level = [1, 2, 3, 4, 5, 6, 7, 8]
        XCTAssertEqual(PathSuggestions.pick(sameLevel: level, others: [], count: 4, day: 0), [1, 2, 3, 4])
        XCTAssertEqual(PathSuggestions.pick(sameLevel: level, others: [], count: 4, day: 1), [5, 6, 7, 8])
        XCTAssertEqual(PathSuggestions.pick(sameLevel: level, others: [], count: 4, day: 2), [1, 2, 3, 4])
    }

    func testCurrentLevelComesFirstThenTheRestFill() {
        let cards = PathSuggestions.pick(sameLevel: [1, 2], others: [10, 11, 12, 13, 14], count: 4, day: 1)
        XCTAssertEqual(Array(cards.prefix(2)).sorted(), [1, 2])
        XCTAssertEqual(cards.count, 4)
        XCTAssertTrue(cards.suffix(2).allSatisfy { $0 >= 10 })
    }

    func testFewerPathsThanCards() {
        XCTAssertEqual(PathSuggestions.pick(sameLevel: [], others: [3], count: 4, day: 99), [3])
        XCTAssertEqual(PathSuggestions.pick(sameLevel: [Int](), others: [], count: 4, day: 5), [])
    }

    func testDayNumberChangesAtMidnight() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/New_York")!
        let evening = calendar.date(from: DateComponents(year: 2026, month: 9, day: 22, hour: 23, minute: 59))!
        let morning = calendar.date(from: DateComponents(year: 2026, month: 9, day: 23, hour: 0, minute: 1))!
        let noon = calendar.date(from: DateComponents(year: 2026, month: 9, day: 22, hour: 12))!
        XCTAssertEqual(PathSuggestions.dayNumber(of: noon, calendar: calendar),
                       PathSuggestions.dayNumber(of: evening, calendar: calendar))
        XCTAssertEqual(PathSuggestions.dayNumber(of: morning, calendar: calendar),
                       PathSuggestions.dayNumber(of: evening, calendar: calendar) + 1)
    }
}
