import SwiftUI

/// One kid who draws in the app. Each profile owns a folder under
/// `Application Support/Profiles/<id>/` holding its own progress, sketchbook and
/// personal preferences; `profile.json` in that folder is this struct.
///
/// No account and no sign-in: a profile is a name and a picture, nothing more, and
/// it never leaves the device.
struct Profile: Codable, Identifiable, Hashable {
    let id: UUID
    /// What the kid typed. May be empty — a small child can pick a picture and go —
    /// in which case the picture's own name is shown (`displayName`).
    var name: String
    var avatar: ProfileAvatar
    let createdAt: Date
    /// Bumped on every switch, so the most recent kid is the one a relaunch opens.
    /// A kid who has been added but never switched to has `neverUsed`, so adding
    /// Maya from Settings does not make her the one the next launch opens.
    var lastUsedAt: Date
    /// True for the one profile made from a pre-profiles install's data. The
    /// migration reads it to know it has already committed.
    var migratedFromLegacy: Bool

    init(id: UUID = UUID(),
         name: String,
         avatar: ProfileAvatar,
         createdAt: Date = Date(),
         lastUsedAt: Date = Profile.neverUsed,
         migratedFromLegacy: Bool = false) {
        self.id = id
        self.name = name
        self.avatar = avatar
        self.createdAt = createdAt
        self.lastUsedAt = lastUsedAt
        self.migratedFromLegacy = migratedFromLegacy
    }

    static let neverUsed = Date(timeIntervalSince1970: 0)

    var displayName: String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? avatar.name : trimmed
    }

    /// Names are short on purpose: they sit under a tile in a grid.
    static let maximumNameLength = 20

    static func cleaned(_ name: String) -> String {
        String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(maximumNameLength))
    }
}

/// The picture a kid picks. A fixed set of animals, so a child who cannot read yet
/// can still find their own tile, and nothing has to be uploaded or drawn.
enum ProfileAvatar: String, Codable, CaseIterable, Identifiable {
    case fox, bear, panda, tiger, frog, octopus, owl, turtle, unicorn, whale, bee, lion

    var id: String { rawValue }

    var emoji: String {
        switch self {
        case .fox: return "🦊"
        case .bear: return "🐻"
        case .panda: return "🐼"
        case .tiger: return "🐯"
        case .frog: return "🐸"
        case .octopus: return "🐙"
        case .owl: return "🦉"
        case .turtle: return "🐢"
        case .unicorn: return "🦄"
        case .whale: return "🐳"
        case .bee: return "🐝"
        case .lion: return "🦁"
        }
    }

    /// Also the name shown when the kid left theirs blank.
    var name: String { rawValue.capitalized }

    /// The soft disc behind the animal, from the app's own palette.
    var tint: Color {
        switch self {
        case .fox, .tiger, .octopus: return Theme.claySoft
        case .bear, .lion, .bee: return Theme.goldSoft
        case .panda, .owl: return Theme.surface2
        case .frog, .turtle: return Theme.greenSoft
        case .unicorn, .whale: return Theme.blueSoft
        }
    }

    /// The first picture not already taken, so a new kid starts on a different animal.
    static func firstUnused(by profiles: [Profile]) -> ProfileAvatar {
        let taken = Set(profiles.map(\.avatar))
        return allCases.first { !taken.contains($0) } ?? .fox
    }

    /// A picture this build no longer has falls back to the fox rather than
    /// failing to read the whole profile.
    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = ProfileAvatar(rawValue: raw) ?? .fox
    }
}
