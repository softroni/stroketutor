import Foundation

/// Today's drawing (`DailyDrawing`), as the screens ask about it.
extension AppModel {

    /// The day has (perhaps) turned: today's drawing follows `date`. `AppRoot` calls
    /// it at launch and on every return from the background.
    func startDay(_ date: Date = Date()) {
        dailyDrawingDay = date
    }

    /// The lesson every learner may draw today, Premium or not. Nil before the day
    /// is set, and when the catalog has no Premium lesson.
    var dailyDrawing: Lesson? {
        guard let day = dailyDrawingDay else { return nil }
        return DailyDrawing.lesson(on: day, paths: paths)
    }

    func isDailyDrawing(_ lesson: Lesson) -> Bool {
        dailyDrawing?.id == lesson.id
    }

    /// Whether today is what opens `lesson` to this learner: it is today's drawing,
    /// a Premium lesson, and Premium is not active. The card says "Free today" then
    /// (never to a child, who is not told what anything costs).
    func isFreeToday(_ lesson: Lesson) -> Bool {
        guard isDailyDrawing(lesson), !premium.isPremium, let path = path(id: lesson.pathId) else { return false }
        return PremiumAccess.isPremiumLesson(lesson, in: path)
    }

    /// Home's "Today's drawing" card: its preview, straight away. The order lock of
    /// its path does not stand in the way, as "Try it anyway" would not: the card is
    /// an invitation to this one drawing.
    func openDailyDrawing() {
        guard let lesson = dailyDrawing else { return }
        analytics.track(.dailyDrawingOpened(lessonId: lesson.id,
                                            pathId: lesson.pathId,
                                            freeToday: isFreeToday(lesson)))
        showPreview(of: lesson)
    }
}
