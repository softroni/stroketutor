import Foundation

/// "Draw again tomorrow?" — the practice reminder, offered on a finished drawing's
/// screen (`ReminderOfferCard`) rather than left for a learner to find in Settings.
/// Kevin asked for it on 2026-10-03: in the week before, not one app open had the
/// reminder on, and few learners came back on a second day.
///
/// - **When:** on the screen of a finished drawing, the guided first run's too, from
///   the very first, for every age: a note to draw is not a purchase, and the child
///   rules (README › Premium › *Children*) are about buying. Until it is answered,
///   on at most `maximumShows` finished drawings, then never again on the device.
/// - **Never** once the reminder is on, once iOS has been told no (it would not ask
///   again, so the card could only fail), in a screenshot launch (but
///   `completion-reminder`) or in the unit tests.
/// - **What it sets:** every day, at the time the drawing was finished, down to the
///   quarter hour. Settings › Practice reminder changes either, as before.
/// - **The note itself is unchanged** (`PracticeReminder`): one calm question, no
///   streak, nothing counted, never a word about a missed day.
///
/// Plain values, so every rule is unit tested (`ReminderOfferTests`).
/// `AppModel.claimReminderOffer(after:notificationsDenied:)` fills it in.
struct ReminderOfferPolicy: Equatable {

    /// Shown on this many finished drawings at most, while unanswered.
    static let maximumShows = 3

    /// False for a launch that must never offer it (`AppModel.offersReminder`).
    var isAllowed: Bool
    /// The practice reminder is already on.
    var reminderEnabled: Bool
    /// iOS has been told not to allow Paper Coach's notifications.
    var notificationsDenied: Bool
    /// `Settings.reminderOfferAnswer`.
    var answer: ReminderOfferAnswer?
    /// `Settings.reminderOfferShownCount`.
    var timesShown: Int

    var shouldOffer: Bool {
        isAllowed
            && !reminderEnabled
            && !notificationsDenied
            && answer == nil
            && timesShown < Self.maximumShows
    }

    /// When the note would come: the time `date` shows, down to the quarter hour
    /// ("16:52" → 16:45), so the learner is reminded when they last drew.
    static func time(near date: Date, calendar: Calendar = .current) -> DateComponents {
        let parts = calendar.dateComponents([.hour, .minute], from: date)
        return DateComponents(hour: parts.hour ?? 7, minute: ((parts.minute ?? 0) / 15) * 15)
    }

    /// Every day: the note says "tomorrow", and the drawing it leads to is new each day.
    static let days = Set(1...7)
}

/// How "Draw again tomorrow?" was answered, as stored and as sent
/// (`reminder_offer_answered`).
enum ReminderOfferAnswer: String, Equatable {
    /// "Remind me", and notifications are allowed: the reminder is on.
    case yes
    /// "No thanks".
    case no
    /// "Remind me", then Don't Allow in iOS's own prompt.
    case refused
}
