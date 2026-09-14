import Foundation
import Observation

/// Every preference the app keeps, in `UserDefaults`, behind one observable object
/// so a view reads `settings.narrationEnabled` rather than repeating an
/// `@AppStorage` key. The keys and their defaults are the ones the handbook lists
/// (`src/handbook.html`, "On-device data"); the defaults are the calm choice, and
/// nothing is opted in for the learner.
///
/// The screens that write these are `st-settings`, `st-voice`, `st-reminder` and the
/// onboarding beats `ob-path` and `ob-voice`.
@Observable
@MainActor
final class Settings {

    /// The `UserDefaults` keys, in one place so a test can clear them.
    enum Key {
        static let hasCompletedOnboarding = "hasCompletedOnboarding"
        static let currentPathId = "currentPathId"
        static let narrationEnabled = "narrationEnabled"
        static let defaultSpeed = "defaultSpeed"
        static let reduceMotionOverride = "reduceMotionOverride"
        static let leftHanded = "leftHanded"
        static let alsoSaveToPhotos = "alsoSaveToPhotos"
        static let reminderEnabled = "reminderEnabled"
        static let reminderDays = "reminderDays"
        static let reminderTime = "reminderTime"
        static let landscapeWidePage = "landscapeWidePage"

        static let all = [
            hasCompletedOnboarding, currentPathId, narrationEnabled, defaultSpeed,
            reduceMotionOverride, leftHanded, alsoSaveToPhotos, reminderEnabled,
            reminderDays, reminderTime, landscapeWidePage
        ]
    }

    private let defaults: UserDefaults

    /// True once the learner has been through onboarding. `AppRoot` reads it first.
    var hasCompletedOnboarding: Bool { didSet { write(hasCompletedOnboarding, Key.hasCompletedOnboarding) } }
    /// The path Home shows. Empty until a path is chosen; the first path then wins.
    var currentPathId: String { didSet { write(currentPathId, Key.currentPathId) } }
    /// Whether Lina speaks. A lesson with no recordings is silent either way, and
    /// hides its chip rather than greying it.
    var narrationEnabled: Bool { didSet { write(narrationEnabled, Key.narrationEnabled) } }
    /// The speed a lesson starts at: 0.5, 1, 2 or 4.
    var defaultSpeed: Double { didSet { write(defaultSpeed, Key.defaultSpeed) } }
    /// Turns the app's own motion off even when the system setting is on.
    var reduceMotionOverride: Bool { didSet { write(reduceMotionOverride, Key.reduceMotionOverride) } }
    /// Moves the player's controls to the left.
    var leftHanded: Bool { didSet { write(leftHanded, Key.leftHanded) } }
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
        currentPathId = defaults.string(forKey: Key.currentPathId) ?? ""
        narrationEnabled = defaults.object(forKey: Key.narrationEnabled) as? Bool ?? true
        // A speed the player no longer offers (1.5× was one) falls back to 1×
        // rather than leaving the control with nothing selected.
        let storedSpeed = defaults.object(forKey: Key.defaultSpeed) as? Double ?? 1.0
        defaultSpeed = PlayerViewModel.speedOptions.contains(storedSpeed) ? storedSpeed : 1.0
        reduceMotionOverride = defaults.object(forKey: Key.reduceMotionOverride) as? Bool ?? false
        leftHanded = defaults.object(forKey: Key.leftHanded) as? Bool ?? false
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
        currentPathId = ""
        narrationEnabled = true
        defaultSpeed = 1.0
        reduceMotionOverride = false
        leftHanded = false
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
