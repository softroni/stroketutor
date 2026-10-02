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
    /// The guided first run's sketchbook tour: the album of the path just started,
    /// with one way on.
    case firstRunSketchbook
    /// The way to Premium: "More coming", the free week and the paywall after the
    /// first run, or the paywall alone (a grown-up's check first, for a child)
    /// from a tap on a Premium lesson or from Settings.
    case offer(OfferEntry)

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
        case .firstRunSketchbook:
            return "first-run-sketchbook"
        case let .offer(entry):
            return "offer-\(entry.id)"
        }
    }
}

/// Where the way to Premium was opened from, which decides where it starts and
/// where it leaves the learner.
enum OfferEntry: Hashable, Identifiable {
    /// The end of the guided first run: "More coming" first, then the paywall.
    case onboarding
    /// A tap on a Premium lesson (a crowned tile or node, or the gold "Next"
    /// card): straight to the paywall, or for a child to the way to a grown-up
    /// (`OfferRoute.firstStep`).
    case premiumLesson(lessonId: String)
    /// The Premium row in Settings.
    case settings
    /// "For grown-ups" under a child's sketchbook: straight to the parental check,
    /// since the button already says who it is for (`OfferRoute.firstStep`).
    case sketchbook

    var id: String {
        switch self {
        case .onboarding: return "onboarding"
        case let .premiumLesson(lessonId): return "lesson-\(lessonId)"
        case .settings: return "settings"
        case .sketchbook: return "sketchbook"
        }
    }

    /// The name analytics knows it by.
    var analyticsName: String {
        switch self {
        case .onboarding: return "onboarding"
        case .premiumLesson: return "premium_lesson"
        case .settings: return "settings"
        case .sketchbook: return "sketchbook"
        }
    }
}

/// The five tabs of `MainTabs`: Home · Path · Lessons · Sketchbook · Settings.
///
/// Home is for browsing — every path's shelf — and Path is the one path the learner
/// is working through. They are two tabs rather than one stack so the path a
/// learner is on is always one tap away, never buried under whatever they browsed.
/// Lessons is the whole catalog at once, every lesson under its path, so how much
/// there is to draw is never hidden behind the few paths Home has room for.
enum MainTab: String, Hashable, CaseIterable, Identifiable {
    case home
    case path
    case lessons
    case sketchbook
    case settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: return "Home"
        case .path: return "Path"
        case .lessons: return "Lessons"
        case .sketchbook: return "Sketchbook"
        case .settings: return "Settings"
        }
    }

    /// The SF Symbol shown in the tab's 56 × 30 pill. Filled, so the tab's color
    /// has a shape to fill rather than a thin outline.
    var symbol: String {
        switch self {
        case .home: return "house.fill"
        case .path: return "map.fill"
        case .lessons: return "square.grid.2x2.fill"
        case .sketchbook: return "book.fill"
        case .settings: return "gearshape.fill"
        }
    }

    /// The tab's own color, so each icon in the bar is bright and easy to tell
    /// apart. Drawn from the path palette (`PathTint`) and Lina's clay. No tab
    /// wears the app's green, which means "the way forward", or gold, whose deep
    /// shade reads brown at glyph size.
    var tint: PathTint {
        switch self {
        case .home: return PathTint(soft: Theme.claySoft, edge: "#F7C9B6", deep: Theme.clay)
        case .path: return PathTint.palette[0]        // sky
        case .lessons: return PathTint.palette[5]     // lavender
        case .sketchbook: return PathTint.palette[2]  // pink
        case .settings: return PathTint.palette[6]    // aqua
        }
    }
}
