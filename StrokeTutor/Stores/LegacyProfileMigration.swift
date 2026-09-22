import Foundation
import OSLog

/// Moves a pre-profiles install into its first profile, without ever being the
/// only copy of the learner's work.
///
/// Before profiles, one learner's data lived at the top of Application Support
/// (`progress.json`, `Sketchbook/`) and their preferences in `UserDefaults`. The
/// migration runs at launch, before any store opens, in four steps:
///
/// 1. **Copy** the old files into a staging profile, and write the old
///    preferences there as `preferences.json`. The originals are not touched.
/// 2. **Verify** the copy: every file present, the same size, the two indexes
///    byte-for-byte, the preferences read back equal.
/// 3. **Commit** by renaming the staging folder into place (`ProfileStore.create`).
///    That rename is the single moment the migration becomes real.
/// 4. **Clean up** the originals — only now, and only after a flag records that
///    step 3 happened.
///
/// Killed during 1–2, the next launch sweeps the staging folder and starts again
/// from the untouched originals. Killed during 4, the next launch sees the
/// committed profile (or the flag) and finishes the clean-up instead of migrating
/// twice. If the copy cannot be made at all — a full disk, say — the app runs this
/// session on the old files where they are and tries again next launch.
@MainActor
enum LegacyProfileMigration {

    enum Outcome: Equatable {
        /// A fresh install, or a migration finished on an earlier launch.
        case notNeeded
        /// The old data is now this profile.
        case migrated(UUID)
        /// A previous run committed but was stopped before removing the originals.
        case finishedCleanUp
        /// Nothing was committed; the originals are intact and in use this session.
        case failed(String)
    }

    struct VerificationError: LocalizedError {
        let errorDescription: String?
        init(_ message: String) { errorDescription = message }
    }

    /// Set once the profile is committed, so an interrupted clean-up is finished
    /// rather than mistaken for data still waiting to move.
    static let committedKey = "legacyProfileMigrationCommitted"

    /// The name the first profile is given. The learner can rename it in Settings.
    static let migratedProfileName = "Me"

    private static let log = Logger(subsystem: "com.softroni.StrokeTutor", category: "migration")

    static func run(baseDirectory: URL,
                    defaults: UserDefaults,
                    profiles: ProfileStore,
                    fileManager: FileManager = .default,
                    beforeCommit: () throws -> Void = {}) -> Outcome {
        let legacy = LegacyFiles(baseDirectory: baseDirectory)
        let hasFiles = fileManager.fileExists(atPath: legacy.progress.path)
            || fileManager.fileExists(atPath: legacy.sketchbook.path)
        let hasPreferences = Settings.LegacyKey.all.contains { defaults.object(forKey: $0) != nil }
        guard hasFiles || hasPreferences else { return .notNeeded }

        if defaults.bool(forKey: committedKey) || profiles.profiles.contains(where: \.migratedFromLegacy) {
            defaults.set(true, forKey: committedKey)
            removeOriginals(legacy, defaults: defaults, fileManager: fileManager)
            return .finishedCleanUp
        }

        let preferences = ProfilePreferences.Values(legacy: defaults)
        do {
            let profile = try profiles.create(
                name: migratedProfileName,
                avatar: .fox,
                migratedFromLegacy: true,
                populate: { staging in
                    try copy(legacy, into: staging, preferences: preferences, fileManager: fileManager)
                    try verify(legacy, against: staging, preferences: preferences, fileManager: fileManager)
                },
                beforeCommit: beforeCommit)
            defaults.set(true, forKey: committedKey)
            removeOriginals(legacy, defaults: defaults, fileManager: fileManager)
            log.notice("Moved the existing learner into their first profile.")
            return .migrated(profile.id)
        } catch {
            log.error("Profile migration did not commit; the originals are untouched: \(error.localizedDescription, privacy: .public)")
            return .failed(error.localizedDescription)
        }
    }

    // MARK: - Steps

    struct LegacyFiles {
        let progress: URL
        let sketchbook: URL

        init(baseDirectory: URL) {
            progress = baseDirectory.appendingPathComponent("progress.json")
            sketchbook = baseDirectory.appendingPathComponent("Sketchbook", isDirectory: true)
        }
    }

    private static func copy(_ legacy: LegacyFiles,
                             into staging: URL,
                             preferences: ProfilePreferences.Values,
                             fileManager: FileManager) throws {
        if fileManager.fileExists(atPath: legacy.progress.path) {
            try fileManager.copyItem(at: legacy.progress,
                                     to: staging.appendingPathComponent(legacy.progress.lastPathComponent))
        }
        if fileManager.fileExists(atPath: legacy.sketchbook.path) {
            // A copy, not a move: on APFS this is a clone, so it is quick and
            // takes no extra space, and the original stays put until commit.
            try fileManager.copyItem(at: legacy.sketchbook,
                                     to: staging.appendingPathComponent(legacy.sketchbook.lastPathComponent,
                                                                        isDirectory: true))
        }
        try ProfilePreferences.write(preferences, to: staging)
    }

    /// Every original file has a copy of the same size, and the two indexes — the
    /// files that say what everything else is — match byte for byte.
    static func verify(_ legacy: LegacyFiles,
                       against staging: URL,
                       preferences: ProfilePreferences.Values,
                       fileManager: FileManager = .default) throws {
        let stagedProgress = staging.appendingPathComponent(legacy.progress.lastPathComponent)
        if fileManager.fileExists(atPath: legacy.progress.path),
           !fileManager.contentsEqual(atPath: legacy.progress.path, andPath: stagedProgress.path) {
            throw VerificationError("progress.json did not copy intact")
        }

        let stagedSketchbook = staging.appendingPathComponent(legacy.sketchbook.lastPathComponent, isDirectory: true)
        if fileManager.fileExists(atPath: legacy.sketchbook.path) {
            let originals = try relativeFiles(under: legacy.sketchbook, fileManager: fileManager)
            for relative in originals {
                let original = legacy.sketchbook.appendingPathComponent(relative)
                let copy = stagedSketchbook.appendingPathComponent(relative)
                guard fileManager.fileExists(atPath: copy.path),
                      size(of: original, fileManager) == size(of: copy, fileManager) else {
                    throw VerificationError("Sketchbook file \(relative) did not copy intact")
                }
            }
            let index = "pages.json"
            if originals.contains(index),
               !fileManager.contentsEqual(atPath: legacy.sketchbook.appendingPathComponent(index).path,
                                          andPath: stagedSketchbook.appendingPathComponent(index).path) {
                throw VerificationError("The sketchbook index did not copy intact")
            }
        }

        let stagedPreferences = try JSONDecoder.storeDecoder.decode(
            ProfilePreferences.Values.self,
            from: Data(contentsOf: staging.appendingPathComponent(ProfilePreferences.fileName)))
        guard stagedPreferences == preferences else {
            throw VerificationError("Preferences did not copy intact")
        }
    }

    private static func removeOriginals(_ legacy: LegacyFiles, defaults: UserDefaults, fileManager: FileManager) {
        // Each is retried on the next launch if it fails, so failures are only logged.
        for url in [legacy.progress, legacy.sketchbook] where fileManager.fileExists(atPath: url.path) {
            do {
                try fileManager.removeItem(at: url)
            } catch {
                log.error("An original could not be removed yet: \(error.localizedDescription, privacy: .public)")
            }
        }
        for key in Settings.LegacyKey.all { defaults.removeObject(forKey: key) }
    }

    // MARK: - Helpers

    private static func relativeFiles(under directory: URL, fileManager: FileManager) throws -> [String] {
        let base = directory.resolvingSymlinksInPath().path
        guard let enumerator = fileManager.enumerator(at: directory,
                                                      includingPropertiesForKeys: [.isRegularFileKey]) else {
            throw VerificationError("The sketchbook could not be listed")
        }
        var files: [String] = []
        for case let url as URL in enumerator {
            guard (try? url.resourceValues(forKeys: [.isRegularFileKey]))?.isRegularFile == true else { continue }
            let path = url.resolvingSymlinksInPath().path
            files.append(String(path.dropFirst(base.count + 1)))
        }
        return files
    }

    private static func size(of url: URL, _ fileManager: FileManager) -> Int64? {
        (try? fileManager.attributesOfItem(atPath: url.path)[.size] as? NSNumber)?.int64Value
    }
}
