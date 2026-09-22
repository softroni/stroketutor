import Foundation

/// Everywhere the app can go. Pushed routes are the elements of a tab's stack;
/// covers are the three full-screen flows `AppRoot` presents. Ids travel, not
/// models: a route stays valid across a content reload, and a stack only ever
/// holds small hashable values.
enum AppRoute: Hashable {
    /// `hp-paths` — every path.
    case paths
    /// `hp-path` — one path, its drawing and all its nodes.
    case pathDetail(pathId: String)
    /// `hp-preview` — one lesson before it starts.
    case lessonPreview(lessonId: String)
    /// `sk-entry` — one page of the sketchbook.
    case sketchbookEntry(pageId: UUID)
    /// `st-voice` — narration and speed.
    case narrationSettings
    /// `st-reminder` — the practice reminder.
    case reminderSettings
    /// About & credits.
    case about
    /// One kid's name, picture and the parent-only actions.
    case profile(id: UUID)

    /// Whether the three-tab bar belongs under this screen.
    ///
    /// v3 keeps it on the tab roots and on the two browsing screens (`hp-paths`,
    /// `hp-path`), and drops it on the pushed screens that own the bottom of the
    /// screen themselves with a `.bottom-area`: `hp-preview`, `sk-entry`,
    /// `st-voice`, `st-reminder` (About is the same kind of page).
    ///
    /// It is a fact about the route rather than something the screen announces
    /// once it is on screen, so the bar steps aside in the very same state change
    /// that pushes the screen. A screen that said so itself — through a
    /// preference, say — would be laid out once with the bar still taking its
    /// height and again without it, and anything pinned to the bottom would jump.
    var hidesTabBar: Bool {
        switch self {
        case .paths, .pathDetail:
            return false
        case .lessonPreview, .sketchbookEntry, .narrationSettings, .reminderSettings, .about, .profile:
            return true
        }
    }
}

/// The flows that take the whole screen: onboarding on first run, the player,
/// completion and capture that follow a lesson, and the launch profile picker.
/// They are covers rather than pushes because none of them belongs to a tab's
/// back stack.
enum AppCover: Identifiable, Hashable {
    case onboarding
    /// `pl-player`. `resumeFrom` is the step a returning learner left off at.
    case player(lessonId: String, resumeFrom: Int?)
    /// `sk-complete`.
    case completion(lessonId: String)
    /// `sk-capture`.
    case capture(lessonId: String)
    /// "Who's drawing?", at launch when more than one kid uses the app.
    case profilePicker

    var id: String {
        switch self {
        case .onboarding:
            return "onboarding"
        case let .player(lessonId, resumeFrom):
            return "player-\(lessonId)-\(resumeFrom.map(String.init) ?? "start")"
        case let .completion(lessonId):
            return "completion-\(lessonId)"
        case let .capture(lessonId):
            return "capture-\(lessonId)"
        case .profilePicker:
            return "profile-picker"
        }
    }
}

/// The three tabs of `MainTabs`: Learn · Sketchbook · Settings.
enum MainTab: String, Hashable, CaseIterable, Identifiable {
    case learn
    case sketchbook
    case settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .learn: return "Learn"
        case .sketchbook: return "Sketchbook"
        case .settings: return "Settings"
        }
    }

    /// The SF Symbol shown in the tab's 56 × 30 pill.
    var symbol: String {
        switch self {
        case .learn: return "pencil"
        case .sketchbook: return "book"
        case .settings: return "gearshape"
        }
    }
}
