import CryptoKit
import Foundation
import Observation

/// An optional four-digit PIN, set by whichever grown-up looks after the app — a
/// parent, or an adult learning alone — which guards the two actions that destroy
/// someone's work: deleting a profile and resetting progress. Renaming and
/// changing a picture are not guarded — they lose nothing.
///
/// Off by default. When it is off, those two actions still ask for confirmation, as
/// they always did. The PIN itself is never stored: only a salted SHA-256 of it,
/// in `UserDefaults`. That is proportionate to what it guards against — a sibling
/// with the iPad, not someone with the device's files.
@Observable
@MainActor
final class AppPIN {

    enum Key {
        // The stored names predate the rename to `AppPIN`. They stay as they are
        // so a PIN already set keeps working.
        static let hash = "parentPINHash"
        static let salt = "parentPINSalt"
    }

    static let length = 4
    /// Wrong guesses in a row before the pad pauses, and for how long.
    static let attemptsBeforePause = 5
    static let pauseDuration: TimeInterval = 30

    private(set) var isSet: Bool
    /// When the pad accepts guesses again, after too many wrong ones. In memory
    /// only: relaunching the app to reset it takes longer than waiting.
    private(set) var pausedUntil: Date?

    private var wrongAttempts = 0
    private let defaults: UserDefaults

    init(defaults: UserDefaults) {
        self.defaults = defaults
        isSet = defaults.string(forKey: Key.hash) != nil
    }

    static func isWellFormed(_ pin: String) -> Bool {
        pin.count == length && pin.allSatisfy(\.isASCII) && pin.allSatisfy(\.isNumber)
    }

    func set(_ pin: String) {
        guard Self.isWellFormed(pin) else { return }
        let salt = UUID().uuidString
        defaults.set(salt, forKey: Key.salt)
        defaults.set(Self.digest(pin, salt: salt), forKey: Key.hash)
        isSet = true
        wrongAttempts = 0
        pausedUntil = nil
    }

    func remove() {
        defaults.removeObject(forKey: Key.hash)
        defaults.removeObject(forKey: Key.salt)
        isSet = false
    }

    func isPaused(at now: Date = Date()) -> Bool {
        guard let pausedUntil else { return false }
        return now < pausedUntil
    }

    /// True when `pin` is the stored one. A paused pad refuses every guess.
    func verify(_ pin: String, at now: Date = Date()) -> Bool {
        guard !isPaused(at: now),
              let hash = defaults.string(forKey: Key.hash),
              let salt = defaults.string(forKey: Key.salt) else { return false }
        if Self.digest(pin, salt: salt) == hash {
            wrongAttempts = 0
            pausedUntil = nil
            return true
        }
        wrongAttempts += 1
        if wrongAttempts >= Self.attemptsBeforePause {
            wrongAttempts = 0
            pausedUntil = now.addingTimeInterval(Self.pauseDuration)
        }
        return false
    }

    private static func digest(_ pin: String, salt: String) -> String {
        SHA256.hash(data: Data((salt + pin).utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }
}
