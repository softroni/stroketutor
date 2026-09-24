import Foundation

/// How old a learner is, as one of six bands, or that they chose not to say. Asked
/// on `ob-age` and changed on the learner's page in Settings; kept on `Profile`.
///
/// The bands follow the lines that change what the app may do with a learner's
/// data, not school years: 13 (COPPA), 16 (the EU's highest age of digital
/// consent) and 18. Below 10 is split in two because that is where a younger
/// level would come from, if the curriculum ever grows one.
///
/// The raw values are the stored and reported keys. They never change when a
/// title does — rename `title` freely, never `rawValue`.
enum AgeGroup: String, Codable, CaseIterable, Identifiable {
    case under6 = "under6"
    case from6To9 = "6to9"
    case from10To12 = "10to12"
    case from13To15 = "13to15"
    case from16To17 = "16to17"
    case adult = "18plus"
    case preferNotToSay = "preferNotToSay"

    var id: String { rawValue }

    /// The six tiles, youngest first. "Prefer not to say" is offered as its own
    /// quiet button under them, not as a seventh tile.
    static let bands: [AgeGroup] = [.under6, .from6To9, .from10To12, .from13To15, .from16To17, .adult]

    var title: String {
        switch self {
        case .under6: return "Under 6"
        case .from6To9: return "6–9"
        case .from10To12: return "10–12"
        case .from13To15: return "13–15"
        case .from16To17: return "16–17"
        case .adult: return "18+"
        case .preferNotToSay: return "Prefer not to say"
        }
    }

    /// What VoiceOver reads: "6 to 9", not "6 dash 9".
    var spokenTitle: String {
        switch self {
        case .under6: return "Under 6"
        case .from6To9: return "6 to 9"
        case .from10To12: return "10 to 12"
        case .from13To15: return "13 to 15"
        case .from16To17: return "16 to 17"
        case .adult: return "18 or older"
        case .preferNotToSay: return "Prefer not to say"
        }
    }

    /// The catalog level `ob-level` opens on for this age: the youngest and anyone
    /// who did not say start at the beginning.
    var suggestedLevelId: String {
        switch self {
        case .under6, .from6To9, .preferNotToSay: return "starter"
        case .from10To12, .from13To15: return "core"
        case .from16To17, .adult: return "advanced"
        }
    }

    /// How carefully the learner's data is treated. Anyone who did not say is
    /// treated as a child: the careful default, and no reason to pick a false age.
    var privacyTier: PrivacyTier {
        switch self {
        case .under6, .from6To9, .from10To12, .preferNotToSay: return .child
        case .from13To15, .from16To17: return .teen
        case .adult: return .adult
        }
    }

    /// Whether moving a learner from `old` to `new` loosens how their data is
    /// treated — a child made an adult, say. That is the change the PIN guards,
    /// so a child cannot tap "18+" to get out of the protections. Moving within a
    /// tier (a child growing from 6–9 to 10–12) or to a stricter one is free. A
    /// learner never asked counts as a child.
    static func loosensPrivacy(from old: AgeGroup?, to new: AgeGroup) -> Bool {
        new.privacyTier > (old?.privacyTier ?? .child)
    }

    /// A key this build does not know is read as "prefer not to say" — the
    /// careful tier — rather than failing to read the whole profile.
    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = AgeGroup(rawValue: raw) ?? .preferNotToSay
    }
}

/// How much the app may collect about a learner, from least to most.
enum PrivacyTier: Int, Comparable {
    /// Under 13, or unknown. Anonymous events only.
    case child
    /// 13 to 17. Events, but no session replay.
    case teen
    /// 18 and over.
    case adult

    static func < (lhs: PrivacyTier, rhs: PrivacyTier) -> Bool {
        lhs.rawValue < rhs.rawValue
    }
}
