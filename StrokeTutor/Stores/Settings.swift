import Foundation
import Observation

/// The preferences that belong to the device rather than to a learner, in
/// `UserDefaults`, behind one observable object so a view reads
/// `settings.alsoSaveToPhotos` rather than repeating an `@AppStorage` key. The
/// defaults are the calm choice, and nothing is opted in for the learner.
///
/// What each learner chooses for themselves — their path, Lina's voice, speed and the
/// two accessibility switches — lives in their profile (`ProfilePreferences`).
/// Before profiles those five were kept here too; `LegacyKey` still names them so
/// `LegacyProfileMigration` can carry them into the first profile.
///
/// The screens that write these are `st-settings`, `st-reminder`, the player's
/// landscape layout and the end of onboarding.
@Observable
@MainActor
final class Settings {

    /// The `UserDefaults` keys, in one place so a test can clear them.
    enum Key {
        static let hasCompletedOnboarding = "hasCompletedOnboarding"
        static let alsoSaveToPhotos = "alsoSaveToPhotos"
        static let reminderEnabled = "reminderEnabled"
        static let reminderDays = "reminderDays"
        static let reminderTime = "reminderTime"
        static let landscapeWidePage = "landscapeWidePage"

        static let all = [
            hasCompletedOnboarding, alsoSaveToPhotos, reminderEnabled,
            reminderDays, reminderTime, landscapeWidePage
        ]
    }

    /// The per-learner keys a pre-profiles build wrote here. Read once, by the
    /// migration, then removed; nothing writes them any more.
    enum LegacyKey {
        static let currentPathId = "currentPathId"
        static let narrationEnabled = "narrationEnabled"
        static let defaultSpeed = "defaultSpeed"
        static let reduceMotionOverride = "reduceMotionOverride"
        static let leftHanded = "leftHanded"

        static let all = [currentPathId, narrationEnabled, defaultSpeed, reduceMotionOverride, leftHanded]
    }

    /// Shared with `AppPIN` and the migration, which keep their own keys here.
    let defaults: UserDefaults

    /// True once the learner has been through onboarding. `AppRoot` reads it first.
    var hasCompletedOnboarding: Bool { didSet { write(hasCompletedOnboarding, Key.hasCompletedOnboarding) } }
    /// Opt-in: a finished page is also written to the photo library.
    var alsoSaveToPhotos: Bool { didSet { write(alsoSaveToPhotos, Key.alsoSaveToPhotos) } }
    /// Off by default. Turning it on is what asks for notification permission.
    var reminderEnabled: Bool { didSet { write(reminderEnabled, Key.reminderEnabled) } }
    /// The weekdays of the reminder as digits, Monday = 1: "12345" is weekdays.
    var reminderDays: String { didSet { write(reminderDays, Key.reminderDays) } }
    /// The reminder time as "HH:mm", 24-hour, formatted for display at the point of use.
    var reminderTime: String { didSet { write(reminderTime, Key.reminderTime) } }
    /// How the player lays out a wide drawing with the phone on its side: true is
    /// the wide page (the paper alone, a bar along the bottom), false the panel.
    /// Nil until the learner first taps the paper to switch; the player treats it
    /// as the panel and, once, points at the tap. Set only by that tap, never by a
    /// step or a phase, so the layout holds still until the learner changes it.
    var landscapeWidePage: Bool? {
        didSet {
            if let landscapeWidePage {
                write(landscapeWidePage, Key.landscapeWidePage)
            } else {
                defaults.removeObject(forKey: Key.landscapeWidePage)
            }
        }
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        hasCompletedOnboarding = defaults.object(forKey: Key.hasCompletedOnboarding) as? Bool ?? false
        alsoSaveToPhotos = defaults.object(forKey: Key.alsoSaveToPhotos) as? Bool ?? false
        reminderEnabled = defaults.object(forKey: Key.reminderEnabled) as? Bool ?? false
        reminderDays = defaults.string(forKey: Key.reminderDays) ?? "12345"
        reminderTime = defaults.string(forKey: Key.reminderTime) ?? "07:30"
        landscapeWidePage = defaults.object(forKey: Key.landscapeWidePage) as? Bool
    }

    /// Puts every key back to its default. Used by tests and by nothing in the UI:
    /// "Reset progress" clears progress, not preferences.
    func resetToDefaults() {
        for key in Key.all { defaults.removeObject(forKey: key) }
        hasCompletedOnboarding = false
        alsoSaveToPhotos = false
        reminderEnabled = false
        reminderDays = "12345"
        reminderTime = "07:30"
        landscapeWidePage = nil
    }

    private func write(_ value: Any, _ key: String) {
        defaults.set(value, forKey: key)
    }
}
