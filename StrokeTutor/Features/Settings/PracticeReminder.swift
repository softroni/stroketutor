import Foundation
import UserNotifications

/// The practice reminder: the days and the time the learner picked, the words the
/// one notification is allowed to say, and the scheduling that follows from both.
///
/// §30 of the plan forbids streaks, so nothing here counts anything. There is one
/// note per selected day, it never mentions a day that was missed, and no "last
/// opened" date is stored anywhere — there is nothing from which a streak could be
/// computed even by accident.
enum PracticeReminder {

    /// The identifier of the request for one weekday, Monday = 1. Everything the
    /// app schedules starts with this prefix, so cancelling is exact rather than
    /// "remove all", which would take somebody else's requests with it one day.
    static func identifier(weekday: Int) -> String { "reminder.weekday.\(weekday)" }

    static let allIdentifiers = (1...7).map(identifier(weekday:))

    // MARK: - The stored strings

    /// `settings.reminderDays` is digits, Monday = 1: "12345" is the weekdays.
    static func days(from string: String) -> Set<Int> {
        Set(string.compactMap { Int(String($0)) }.filter { (1...7).contains($0) })
    }

    static func string(from days: Set<Int>) -> String {
        days.sorted().map(String.init).joined()
    }

    /// `settings.reminderTime` is "HH:mm", 24-hour, so it is stable across locales.
    static func time(from string: String) -> DateComponents {
        let parts = string.split(separator: ":").compactMap { Int($0) }
        let hour = parts.count == 2 ? min(max(parts[0], 0), 23) : 7
        let minute = parts.count == 2 ? min(max(parts[1], 0), 59) : 30
        return DateComponents(hour: hour, minute: minute)
    }

    static func string(from time: DateComponents) -> String {
        String(format: "%02d:%02d", time.hour ?? 7, time.minute ?? 30)
    }

    /// The stored time as a `Date` today, for a `DatePicker`.
    static func date(from string: String, calendar: Calendar = .current) -> Date {
        let time = time(from: string)
        return calendar.date(bySettingHour: time.hour ?? 7,
                             minute: time.minute ?? 30,
                             second: 0,
                             of: Date()) ?? Date()
    }

    static func string(from date: Date, calendar: Calendar = .current) -> String {
        let parts = calendar.dateComponents([.hour, .minute], from: date)
        return string(from: parts)
    }

    // MARK: - The schedule in words

    /// The time as this iPhone writes times: "7:30", "07:30" or "7:30 AM".
    static func timeText(_ stored: String, calendar: Calendar = .current) -> String {
        date(from: stored, calendar: calendar)
            .formatted(.dateTime.hour().minute())
    }

    /// "Weekdays", "Weekends", "Every day", or the days themselves.
    static func daysPhrase(_ days: Set<Int>, calendar: Calendar = .current) -> String {
        if days.isEmpty { return "No days" }
        if days == Set(1...7) { return "Every day" }
        if days == Set(1...5) { return "Weekdays" }
        if days == Set([6, 7]) { return "Weekends" }
        return days.sorted().map { shortName($0, calendar: calendar) }.joined(separator: ", ")
    }

    /// The row's subtitle and the root screen's value: "Off" or "Weekdays at 7:30".
    /// Never a raw date.
    @MainActor
    static func summary(for settings: Settings) -> String {
        let days = days(from: settings.reminderDays)
        guard settings.reminderEnabled, !days.isEmpty else { return "Off" }
        return "\(daysPhrase(days)) at \(timeText(settings.reminderTime))"
    }

    // MARK: - Weekday names

    /// The calendar's weekday number (Sunday = 1) for our Monday = 1.
    static func calendarWeekday(_ day: Int) -> Int { (day % 7) + 1 }

    /// "M", "T", … for the pills. The calendar's own letters, so a non-English
    /// device gets its own.
    static func initial(_ day: Int, calendar: Calendar = .current) -> String {
        let symbols = calendar.veryShortWeekdaySymbols
        let index = calendarWeekday(day) - 1
        return symbols.indices.contains(index) ? symbols[index] : ""
    }

    /// "Mon", for the schedule in words.
    static func shortName(_ day: Int, calendar: Calendar = .current) -> String {
        let symbols = calendar.shortWeekdaySymbols
        let index = calendarWeekday(day) - 1
        return symbols.indices.contains(index) ? symbols[index] : ""
    }

    /// "Monday", for VoiceOver.
    static func fullName(_ day: Int, calendar: Calendar = .current) -> String {
        let symbols = calendar.weekdaySymbols
        let index = calendarWeekday(day) - 1
        return symbols.indices.contains(index) ? symbols[index] : ""
    }

    // MARK: - What the note says

    /// The only sentence the app is allowed to send. One question, no urgency, no
    /// exclamation mark.
    static let title = "A few quiet minutes with a pen?"

    /// "Your next house is ready." — from the path, never from the lesson title, so
    /// the note never spoils the drawing. "Your sketchbook is waiting." when every
    /// path is finished.
    static func body(subject: String?) -> String {
        guard let subject, !subject.isEmpty else { return "Your sketchbook is waiting." }
        return "Your next \(subject) is ready."
    }

    /// The subject of a path in running text: "Houses" → "house". Only the plural
    /// "s" is undone; anything else is left as the creator wrote it.
    static func subject(fromPathTitle title: String) -> String {
        let lower = title.lowercased()
        if lower.count > 3, lower.hasSuffix("s"), !lower.hasSuffix("ss") {
            return String(lower.dropLast())
        }
        return lower
    }
}
