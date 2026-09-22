import Foundation

/// Everywhere the app can go. Pushed routes are the elements of a tab's stack;
/// covers are the three full-screen flows `AppRoot` presents. Ids travel, not
/// models: a route stays valid across a content reload, and a stack only ever
/// holds small hashable values.
enum AppRoute: Hashable {
    /// `hp-paths` — every path. The one path itself (`hp-path`) is not a route:
    /// it is the root of the Path tab, and choosing a path swaps what that root
    /// shows rather than pushing another copy of it.
    case paths
    /// `hp-preview` — one lesson before it starts.
    case lessonPreview(lessonId: String)
    /// `sk-entry` — one page of the sketchbook.
    case sketchbookEntry(pageId: UUID)
    /// `st-voice` — narration and speed.
    case narrationSettings
    /// `st-reminder` — the practice reminder.
    case reminderSettings
    /// One learner's name, picture and the PIN-guarded delete.
    case profile(id: UUID)

    /// Whether the tab bar belongs under this screen.
    ///
    /// v3 keeps it on the tab roots (`hp-path` among them) and on the one pushed
    /// browsing screen, `hp-paths`, and drops it on the pushed screens that own the bottom of the
    /// screen themselves with a `.bottom-area`: `hp-preview`, `sk-entry`,
    /// `st-voice`, `st-reminder`.
    ///
    /// It is a fact about the route rather than something the screen announces
    /// once it is on screen, so the bar steps aside in the very same state change
    /// that pushes the screen. A screen that said so itself — through a
    /// preference, say — would be laid out once with the bar still taking its
    /// height and again without it, and anything pinned to the bottom would jump.
    var hidesTabBar: Bool {
        switch self {
        case .paths:
            return false
        case .lessonPreview, .sketchbookEntry, .narrationSettings, .reminderSettings, .profile:
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
    /// `sk-capture`. `fromSketchbook` is a photo added later from a Sketchbook
    /// slot, so leaving goes back there rather than to the path.
    case capture(lessonId: String, fromSketchbook: Bool = false)
    /// "Who's drawing?", at launch when more than one learner uses the app.
    case profilePicker

    var id: String {
        switch self {
        case .onboarding:
            return "onboarding"
        case let .player(lessonId, resumeFrom):
            return "player-\(lessonId)-\(resumeFrom.map(String.init) ?? "start")"
        case let .completion(lessonId):
            return "completion-\(lessonId)"
        case let .capture(lessonId, fromSketchbook):
            return "capture-\(lessonId)\(fromSketchbook ? "-sketchbook" : "")"
        case .profilePicker:
            return "profile-picker"
        }
    }
}

/// The four tabs of `MainTabs`: Home · Path · Sketchbook · Settings.
///
/// Home is for browsing — every path's shelf — and Path is the one path the learner
/// is working through. They are two tabs rather than one stack so the path a
/// learner is on is always one tap away, never buried under whatever they browsed.
enum MainTab: String, Hashable, CaseIterable, Identifiable {
    case home
    case path
    case sketchbook
    case settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: return "Home"
        case .path: return "Path"
        case .sketchbook: return "Sketchbook"
        case .settings: return "Settings"
        }
    }

    /// The SF Symbol shown in the tab's 56 × 30 pill.
    var symbol: String {
        switch self {
        case .home: return "house"
        case .path: return "map"
        case .sketchbook: return "book"
        case .settings: return "gearshape"
        }
    }
}
