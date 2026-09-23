import Foundation
import Observation
import OSLog

/// Every learner on this device, one folder each:
///
///     Application Support/Profiles/<id>/profile.json      who they are
///     Application Support/Profiles/<id>/preferences.json  their own choices
///     Application Support/Profiles/<id>/progress.json     how far they are
///     Application Support/Profiles/<id>/Sketchbook/       their pages
///
/// **The folder is the commit.** A profile is built in full under a hidden
/// `.staging-<id>` folder and only becomes real when that folder is renamed to
/// `<id>` — a single rename on one volume, which the file system does atomically.
/// So there is no separate list to keep in step with the folders: the list *is*
/// the set of committed folders, and an interruption at any earlier point leaves
/// nothing but a hidden staging folder, which the next launch sweeps away.
/// Deleting works the same way in reverse: rename to `.deleting-<id>` first, so a
/// half-deleted folder is never read as a profile.
@Observable
@MainActor
final class ProfileStore {

    /// Oldest first, so the picker keeps the same order every time.
    private(set) var profiles: [Profile] = []

    let rootDirectory: URL
    private let fileManager: FileManager
    private static let log = Logger(subsystem: "com.softroni.StrokeTutor", category: "profiles")

    static let folderName = "Profiles"
    static let profileFileName = "profile.json"
    private static let stagingPrefix = ".staging-"
    private static let deletingPrefix = ".deleting-"

    /// - Parameter baseDirectory: the folder that contains `Profiles/`. Defaults to
    ///   Application Support; a test passes a temporary directory.
    init(baseDirectory: URL? = nil, fileManager: FileManager = .default) {
        let base = baseDirectory ?? AppStorageLocation.applicationSupport()
        rootDirectory = base.appendingPathComponent(Self.folderName, isDirectory: true)
        self.fileManager = fileManager
        reload()
    }

    func directory(for id: UUID) -> URL {
        rootDirectory.appendingPathComponent(id.uuidString, isDirectory: true)
    }

    func profile(id: UUID) -> Profile? {
        profiles.first { $0.id == id }
    }

    /// The learner who drew last, which is who a relaunch opens.
    var mostRecentlyUsed: Profile? {
        profiles.max { $0.lastUsedAt < $1.lastUsedAt }
    }

    // MARK: - Encoding

    /// ISO 8601 like every other store, but to the millisecond: "who drew last"
    /// and the picker's order compare these, and two switches can land in the same
    /// second. Plain ISO 8601 still reads, for a file written without fractions.
    private static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        encoder.dateEncodingStrategy = .custom { date, encoder in
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            var container = encoder.singleValueContainer()
            try container.encode(formatter.string(from: date))
        }
        return encoder
    }()

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let text = try container.decode(String.self)
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: text) { return date }
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: text) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Not an ISO 8601 date: \(text)")
        }
        return decoder
    }()

    // MARK: - Reading

    /// Sweeps away anything an interrupted create or delete left behind, then reads
    /// every committed folder.
    func reload() {
        let entries = (try? fileManager.contentsOfDirectory(at: rootDirectory,
                                                            includingPropertiesForKeys: nil)) ?? []
        var found: [Profile] = []
        for url in entries {
            let name = url.lastPathComponent
            if name.hasPrefix(Self.stagingPrefix) || name.hasPrefix(Self.deletingPrefix) {
                try? fileManager.removeItem(at: url)
                continue
            }
            guard UUID(uuidString: name) != nil else { continue }
            let file = url.appendingPathComponent(Self.profileFileName)
            do {
                let profile = try Self.decoder.decode(Profile.self, from: Data(contentsOf: file))
                found.append(profile)
            } catch {
                // Left on disk, never deleted: the learner's pages are still in there.
                Self.log.error("A profile folder could not be read: \(error.localizedDescription, privacy: .public)")
            }
        }
        profiles = found.sorted(by: Self.creationOrder)
    }

    /// Oldest first; two learners made in the same instant keep a stable order.
    private static func creationOrder(_ a: Profile, _ b: Profile) -> Bool {
        (a.createdAt, a.id.uuidString) < (b.createdAt, b.id.uuidString)
    }

    // MARK: - Writing

    /// Builds a profile in a staging folder and commits it with one rename.
    ///
    /// - Parameters:
    ///   - populate: fills the staging folder before `profile.json` is written —
    ///     the migration copies the old data in here. Throwing abandons the profile.
    ///   - beforeCommit: runs after the staging folder is complete and before the
    ///     rename. Tests throw here to stand in for the app being killed.
    @discardableResult
    func create(name: String,
                avatar: ProfileAvatar,
                migratedFromLegacy: Bool = false,
                populate: (URL) throws -> Void = { _ in },
                beforeCommit: () throws -> Void = {}) throws -> Profile {
        let profile = Profile(name: Profile.cleaned(name),
                              avatar: avatar,
                              createdAt: nextStamp(after: profiles.map(\.createdAt)),
                              migratedFromLegacy: migratedFromLegacy)
        let staging = rootDirectory.appendingPathComponent(Self.stagingPrefix + profile.id.uuidString,
                                                           isDirectory: true)
        do {
            try fileManager.createDirectory(at: staging, withIntermediateDirectories: true)
            try populate(staging)
            try write(profile, in: staging)
            try beforeCommit()
            try fileManager.moveItem(at: staging, to: directory(for: profile.id))
        } catch {
            try? fileManager.removeItem(at: staging)
            throw error
        }
        profiles.append(profile)
        profiles.sort(by: Self.creationOrder)
        return profile
    }

    /// Name, picture or age group. Written in place: `profile.json` is replaced atomically, so
    /// a rename interrupted halfway leaves the old name, never a broken file.
    func update(_ profile: Profile) {
        guard let index = profiles.firstIndex(where: { $0.id == profile.id }) else { return }
        var updated = profile
        updated.name = Profile.cleaned(profile.name)
        do {
            try write(updated, in: directory(for: profile.id))
            profiles[index] = updated
        } catch {
            Self.log.error("A profile could not be saved: \(error.localizedDescription, privacy: .public)")
        }
    }

    func markUsed(_ id: UUID) {
        guard var profile = profile(id: id) else { return }
        profile.lastUsedAt = nextStamp(after: profiles.map(\.lastUsedAt))
        update(profile)
    }

    /// Now, to the millisecond the file keeps, and always later than every date in
    /// `others` — so the learner switched to last really is the latest, and a
    /// learner added second really is second, however fast the taps (or a test)
    /// come.
    private func nextStamp(after others: [Date]) -> Date {
        let now = (Date().timeIntervalSince1970 * 1000).rounded(.down)
        let latest = others.map { ($0.timeIntervalSince1970 * 1000).rounded(.down) }.max() ?? 0
        return Date(timeIntervalSince1970: max(now, latest + 1) / 1000)
    }

    /// Removes a learner and everything in their folder. The caller has already asked
    /// for the PIN; this does not ask again.
    func delete(_ id: UUID) throws {
        let folder = directory(for: id)
        let doomed = rootDirectory.appendingPathComponent(Self.deletingPrefix + id.uuidString,
                                                          isDirectory: true)
        try fileManager.moveItem(at: folder, to: doomed)
        profiles.removeAll { $0.id == id }
        // If this fails the folder is already hidden, and the next launch retries.
        try? fileManager.removeItem(at: doomed)
    }

    private func write(_ profile: Profile, in folder: URL) throws {
        let data = try Self.encoder.encode(profile)
        try AppStorageLocation.writeAtomically(data, to: folder.appendingPathComponent(Self.profileFileName))
    }
}
