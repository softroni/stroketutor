import Foundation
import Observation
import OSLog

/// The preferences that belong to a learner rather than to the device: which path Home
/// shows, whether Lina speaks, how fast a lesson starts, and the two accessibility
/// choices. Two siblings on one iPad can want different answers to every one of
/// these, so each profile keeps its own `preferences.json`.
///
/// Device-wide choices — onboarding, the reminder, "Also save to Photos", the
/// landscape layout — stay in `Settings`.
@Observable
@MainActor
final class ProfilePreferences {

    /// The stored shape. Every key is optional on the way in, so a file written by
    /// an older build still reads, and a missing key takes its calm default.
    struct Values: Codable, Equatable {
        var currentPathId = ""
        var narrationEnabled = true
        var defaultSpeed = 1.0
        var reduceMotionOverride = false
        var leftHanded = false

        init() {}

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            let defaults = Values()
            currentPathId = try container.decodeIfPresent(String.self, forKey: .currentPathId) ?? defaults.currentPathId
            narrationEnabled = try container.decodeIfPresent(Bool.self, forKey: .narrationEnabled) ?? defaults.narrationEnabled
            defaultSpeed = Self.validSpeed(try container.decodeIfPresent(Double.self, forKey: .defaultSpeed))
            reduceMotionOverride = try container.decodeIfPresent(Bool.self, forKey: .reduceMotionOverride) ?? defaults.reduceMotionOverride
            leftHanded = try container.decodeIfPresent(Bool.self, forKey: .leftHanded) ?? defaults.leftHanded
        }

        /// The values a pre-profiles build kept in `UserDefaults`, for the migration.
        init(legacy defaults: UserDefaults) {
            self.init()
            currentPathId = defaults.string(forKey: Settings.LegacyKey.currentPathId) ?? currentPathId
            narrationEnabled = defaults.object(forKey: Settings.LegacyKey.narrationEnabled) as? Bool ?? narrationEnabled
            defaultSpeed = Self.validSpeed(defaults.object(forKey: Settings.LegacyKey.defaultSpeed) as? Double)
            reduceMotionOverride = defaults.object(forKey: Settings.LegacyKey.reduceMotionOverride) as? Bool ?? reduceMotionOverride
            leftHanded = defaults.object(forKey: Settings.LegacyKey.leftHanded) as? Bool ?? leftHanded
        }

        /// A speed the player no longer offers (1.5× was one) falls back to 1×
        /// rather than leaving the control with nothing selected.
        static func validSpeed(_ stored: Double?) -> Double {
            guard let stored, PlayerViewModel.speedOptions.contains(stored) else { return 1.0 }
            return stored
        }
    }

    static let fileName = "preferences.json"

    /// The path Home shows. Empty until a path is chosen; the first path then wins.
    var currentPathId: String { didSet { save() } }
    /// Whether Lina speaks. A lesson with no recordings is silent either way.
    var narrationEnabled: Bool { didSet { save() } }
    /// The speed a lesson starts at: 0.5, 1, 2 or 4.
    var defaultSpeed: Double { didSet { save() } }
    /// Turns the app's own motion off even when the system setting is on.
    var reduceMotionOverride: Bool { didSet { save() } }
    /// Moves the player's controls to the left.
    var leftHanded: Bool { didSet { save() } }

    /// Nil keeps everything in memory — the fallback when a profile has no folder.
    private let fileURL: URL?
    private static let log = Logger(subsystem: "com.softroni.StrokeTutor", category: "preferences")

    init(directory: URL?) {
        fileURL = directory?.appendingPathComponent(Self.fileName)
        let values = fileURL.flatMap(Self.read) ?? Values()
        currentPathId = values.currentPathId
        narrationEnabled = values.narrationEnabled
        defaultSpeed = values.defaultSpeed
        reduceMotionOverride = values.reduceMotionOverride
        leftHanded = values.leftHanded
    }

    /// An in-memory set, for the migration's fallback session.
    convenience init(values: Values) {
        self.init(directory: nil)
        apply(values)
    }

    var values: Values {
        var values = Values()
        values.currentPathId = currentPathId
        values.narrationEnabled = narrationEnabled
        values.defaultSpeed = defaultSpeed
        values.reduceMotionOverride = reduceMotionOverride
        values.leftHanded = leftHanded
        return values
    }

    /// Every preference back to its default, for this learner only.
    func resetToDefaults() {
        apply(Values())
    }

    private func apply(_ values: Values) {
        currentPathId = values.currentPathId
        narrationEnabled = values.narrationEnabled
        defaultSpeed = values.defaultSpeed
        reduceMotionOverride = values.reduceMotionOverride
        leftHanded = values.leftHanded
    }

    static func write(_ values: Values, to directory: URL) throws {
        let data = try JSONEncoder.storeEncoder.encode(values)
        try AppStorageLocation.writeAtomically(data, to: directory.appendingPathComponent(fileName))
    }

    private static func read(_ url: URL) -> Values? {
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        do {
            return try JSONDecoder.storeDecoder.decode(Values.self, from: Data(contentsOf: url))
        } catch {
            log.error("preferences.json could not be read: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }

    private func save() {
        guard let fileURL else { return }
        do {
            try Self.write(values, to: fileURL.deletingLastPathComponent())
        } catch {
            Self.log.error("preferences.json could not be written: \(error.localizedDescription, privacy: .public)")
        }
    }
}
