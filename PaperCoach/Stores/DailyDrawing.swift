import Foundation

/// Today's drawing: one Premium lesson a day, the same for every learner on that
/// date, and open to everyone until their midnight (`AppModel.needsPremium(_:)`).
/// Home shows it as a card under the hero (`DailyDrawingCard`). For a learner
/// without Premium it is a reason to open the app each day and a taste of what
/// Premium holds; for a subscriber, simply something to draw today. Kevin asked for
/// it on 2026-10-03, after the first free week: its learner drew nine Premium
/// lessons in an afternoon and cancelled, and nothing in the app was new the next day.
///
/// The order is the one the social videos post Premium lessons in (docs/ops/social-plan.md,
/// *Decisions*: "Premium in path order, like the app"): lesson 4 of every path in
/// catalog order, then lesson 5 of every path, and so on, round again after the
/// last. So two days running never share a path, and the order levels up as the
/// app does. Day 0 is `firstDay`; the day turns at the learner's own midnight.
///
/// Plain values and no clock of its own, so it is unit tested (`DailyDrawingTests`)
/// and the same date gives the same lesson anywhere. The catalog decides the
/// rotation: a version that adds lessons moves it on.
enum DailyDrawing {

    /// The first day of the rotation, which draws the first lesson of `order(of:)`.
    static let firstDay = DateComponents(year: 2026, month: 10, day: 5)

    /// Every Premium lesson, in the order the days take them: the first Premium
    /// lesson of each path, then the second of each, and so on. A path with fewer
    /// lessons simply drops out of the later rounds.
    static func order(of paths: [PathModel]) -> [Lesson] {
        let premium = paths.map { path in
            path.lessons.filter { PremiumAccess.isPremiumLesson($0, in: path) }
        }
        let rounds = premium.map(\.count).max() ?? 0
        return (0..<rounds).flatMap { round in
            premium.compactMap { $0.indices.contains(round) ? $0[round] : nil }
        }
    }

    /// Whole days from `firstDay` to `date`, counted on the Gregorian calendar in
    /// the learner's time zone, whatever calendar the phone shows: the date is the
    /// one the social schedule uses. Negative before `firstDay`.
    static func dayNumber(of date: Date, timeZone: TimeZone = .current) -> Int {
        let calendar = gregorian(in: timeZone)
        guard let start = calendar.date(from: firstDay) else { return 0 }
        return calendar.dateComponents([.day], from: start, to: calendar.startOfDay(for: date)).day ?? 0
    }

    /// The lesson for the day `date` falls on. Nil when the catalog has no Premium
    /// lesson at all.
    static func lesson(on date: Date, paths: [PathModel], timeZone: TimeZone = .current) -> Lesson? {
        let lessons = order(of: paths)
        guard !lessons.isEmpty else { return nil }
        let count = lessons.count
        return lessons[((dayNumber(of: date, timeZone: timeZone) % count) + count) % count]
    }

    /// Noon on the first day, from `firstDay` on, whose drawing is `lessonId`: for
    /// the screenshot harness, which shows a chosen lesson as today's. Nil for a
    /// lesson that is not Premium.
    static func firstDate(showing lessonId: String, paths: [PathModel], timeZone: TimeZone = .current) -> Date? {
        guard let index = order(of: paths).firstIndex(where: { $0.id == lessonId }) else { return nil }
        let calendar = gregorian(in: timeZone)
        guard let start = calendar.date(from: firstDay),
              let day = calendar.date(byAdding: .day, value: index, to: start) else { return nil }
        return calendar.date(byAdding: .hour, value: 12, to: day)
    }

    private static func gregorian(in timeZone: TimeZone) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        return calendar
    }
}
