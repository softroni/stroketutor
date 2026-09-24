import SwiftUI

/// `ob-splash` … `ob-ready` — the ten beats a learner sees once: what the app is,
/// what they will do, how a lesson works, what they need, who is drawing, how old
/// they are, how much they have drawn before, which path to take, whether Lina
/// speaks, and their first lesson. A beat with nothing to ask is passed over:
/// `ob-level` when the catalog has no levels, and `ob-path` when the level chosen
/// has a single path.
///
/// The flow owns the four answers onboarding collects — the learner's name and
/// picture, their age group, the path and the voice — and nothing else; the level
/// only narrows the paths offered and is never stored. It writes the profile when
/// the learner leaves the who beat and again when they leave the age beat,
/// `currentPathId` when they leave the path beat (or the level beat, when that
/// level's one path is the answer) and `narrationEnabled` the moment the
/// switch is touched, all to the learner who is drawing; `hasCompletedOnboarding`
/// is written by `AppRoot` when `onFinished` is called, so a flow replayed from
/// Settings changes no stored value it was not asked to.
struct OnboardingFlow: View {

    /// Called once, with the lesson to open next, or nil to land on Home.
    let onFinished: (Lesson?) -> Void

    /// Where the flow opens. Nil starts at the launch beat, which is what the app
    /// does; a beat here is for previews and for walking the flow while building it.
    var initialBeat: Beat?

    @Environment(AppModel.self) private var app
    @Environment(\.accessibilityReduceMotion) private var systemReducesMotion

    @State private var beat: Beat?
    /// The level the learner has tapped. Never stored: it only chooses which paths
    /// `ob-path` offers.
    @State private var pendingLevelId: String?
    /// The path the learner has tapped, before Continue commits it.
    @State private var pendingPathId: String?

    init(onFinished: @escaping (Lesson?) -> Void, initialBeat: Beat? = nil) {
        self.onFinished = onFinished
        self.initialBeat = initialBeat
    }

    /// The ten beats, in order. `progress` is the rail's fill; the launch beat has
    /// no rail at all.
    enum Beat: String, CaseIterable, Hashable {
        case launch = "ob-splash"
        case intro = "ob-1"
        case method = "ob-2"
        case kit = "ob-3"
        case who = "ob-who"
        case age = "ob-age"
        case level = "ob-level"
        case path = "ob-path"
        case voice = "ob-voice"
        case ready = "ob-ready"

        /// One of nine rail positions, from 1/9 to 100 %. A beat the flow passes
        /// over leaves its step unfilled, so the bar jumps ahead rather than lying
        /// about how far there is to go.
        var step: Int {
            switch self {
            case .launch: return 0
            case .intro: return 1
            case .method: return 2
            case .kit: return 3
            case .who: return 4
            case .age: return 5
            case .level: return 6
            case .path: return 7
            case .voice: return 8
            case .ready: return 9
            }
        }

        static let railSteps = 9

        var progress: Double { Double(step) / Double(Self.railSteps) }

        var stepLabel: String { "Step \(step) of \(Self.railSteps)" }
    }

    var body: some View {
        ZStack {
            Theme.page.ignoresSafeArea()

            current
                .id(beat)
                .transition(.opacity)
        }
        .environment(\.onboardingReducesMotion, reducesMotion)
        .onAppear {
            if beat == nil {
                let first = initialBeat ?? Self.launchArgumentBeat ?? .launch
                beat = first
                app.analytics.track(.onboardingBeatViewed(first.rawValue))
            }
        }
    }

    // MARK: - The beats

    @ViewBuilder
    private var current: some View {
        switch beat {
        case .none:
            Color.clear

        case .launch:
            OnboardingLaunchBeat { go(.intro) }

        case .intro:
            OnboardingIntroBeat(lesson: firstLessonOfFirstPath,
                                rail: rail(for: .intro, back: nil),
                                onContinue: { go(.method) })

        case .method:
            OnboardingMethodBeat(lesson: firstLessonOfFirstPath,
                                 rail: rail(for: .method, back: .intro),
                                 onContinue: { go(.kit) })

        case .kit:
            OnboardingKitBeat(rail: rail(for: .kit, back: .method),
                              onContinue: { go(.who) })

        case .who:
            OnboardingWhoBeat(rail: rail(for: .who, back: .kit, skippable: false),
                              onContinue: { go(.age) })

        case .age:
            OnboardingAgeBeat(rail: rail(for: .age, back: .who, skippable: false),
                              onContinue: {
                                  // A new age means a new suggested level, so an
                                  // earlier tap no longer stands in its way.
                                  pendingLevelId = nil
                                  pendingPathId = nil
                                  go(choices.asksForLevel ? .level : .path)
                              })

        case .level:
            OnboardingLevelBeat(levels: choices.levels,
                                selectedLevelId: selectedLevel?.id,
                                rail: rail(for: .level, back: .age, skippable: false),
                                onSelect: choose,
                                onContinue: {
                                    // A level with one path has nothing to pick
                                    // between, so that path is the answer.
                                    if let only = selectedLevel?.onlyPath {
                                        app.select(only)
                                        go(.voice)
                                    } else {
                                        go(.path)
                                    }
                                })

        case .path:
            OnboardingPathBeat(paths: pathsForSelectedLevel,
                               selectedPathId: selectedPath?.id,
                               rail: rail(for: .path,
                                          back: choices.asksForLevel ? .level : .age,
                                          skippable: false),
                               onSelect: { pendingPathId = $0.id },
                               onContinue: {
                                   if let path = selectedPath { app.select(path) }
                                   go(.voice)
                               })

        case .voice:
            OnboardingVoiceBeat(narrationEnabled: narrationBinding,
                                rail: rail(for: .voice, back: voiceBack, skippable: false),
                                onContinue: { go(.ready) })

        case .ready:
            OnboardingReadyBeat(lesson: selectedPath?.lessons.first,
                                path: selectedPath,
                                rail: rail(for: .ready, back: .voice, skippable: false),
                                onStart: { finish(with: selectedPath?.lessons.first) },
                                onLookAround: { finish(with: nil) })
        }
    }

    /// The rail every beat but the launch shows. `back` is the beat the chevron
    /// returns to; nil hides the chevron but keeps its space.
    private func rail(for beat: Beat, back: Beat?, skippable: Bool = true) -> OnboardingRail {
        OnboardingRail(progress: beat.progress,
                       stepLabel: beat.stepLabel,
                       onBack: back.map { target in { go(target) } },
                       onSkip: skippable ? { go(.who) } : nil)
    }

    /// Where the voice beat's chevron returns to: the path beat, or the level beat
    /// when the path beat was passed over.
    private var voiceBack: Beat {
        choices.asksForLevel && selectedLevel?.onlyPath != nil ? .level : .path
    }

    // MARK: - Moving

    private func go(_ target: Beat) {
        withAnimation(reducesMotion ? nil : .easeInOut(duration: 0.22)) {
            beat = target
        }
        app.analytics.track(.onboardingBeatViewed(target.rawValue))
    }

    private func finish(with lesson: Lesson?) {
        app.analytics.track(.onboardingFinished(startedLesson: lesson != nil))
        onFinished(lesson)
    }

    /// Moves the level selection. A path tapped earlier that the new level does
    /// not offer is forgotten, so the path beat opens on one it can show.
    private func choose(_ level: OnboardingPathChoices.Level) {
        pendingLevelId = level.id
        if let pendingPathId, !level.paths.contains(where: { $0.id == pendingPathId }) {
            self.pendingPathId = nil
        }
    }

    // MARK: - Content

    /// Only paths that have a lesson the learner can actually open. A path whose
    /// lessons are still being written is not offered.
    private var visiblePaths: [PathModel] {
        app.paths.filter { !$0.isEmpty }
    }

    /// The levels and the paths under them, from the catalog.
    private var choices: OnboardingPathChoices {
        OnboardingPathChoices(levels: app.catalog.levels, paths: visiblePaths)
    }

    /// The level the level beat shows as chosen: what was tapped, else the level
    /// the learner's age suggests, else the level of the path chosen so far, else
    /// the first. Nil when there are no levels.
    private var selectedLevel: OnboardingPathChoices.Level? {
        choices.chosenLevel(tapped: pendingLevelId,
                            tappedPath: pendingPathId,
                            ageGroup: app.activeProfile.ageGroup,
                            storedPath: app.preferences.currentPathId)
    }

    /// What the path beat offers: the chosen level's paths, or the first paths in
    /// the catalog when there is no level to choose.
    private var pathsForSelectedLevel: [PathModel] {
        choices.paths(in: selectedLevel)
    }

    /// The path the picker shows as chosen, always one it offers: what was tapped,
    /// else the first path offered.
    private var selectedPath: PathModel? {
        choices.chosenPath(in: selectedLevel, tapped: pendingPathId)
    }

    /// The drawing the launch and the first beats show, before a path is chosen.
    private var firstLessonOfFirstPath: Lesson? {
        visiblePaths.first?.lessons.first
    }

    private var narrationBinding: Binding<Bool> {
        Binding(get: { app.preferences.narrationEnabled },
                set: { app.preferences.narrationEnabled = $0 })
    }

    /// The system's Reduce Motion setting.
    private var reducesMotion: Bool { systemReducesMotion }

    /// `-onboardingBeat ob-2` on the scheme or on `simctl launch`, so a beat in the
    /// middle of the flow can be reached and compared with `v3.html` without tapping
    /// through the ones before it. Debug builds only; it changes nothing else.
    private static var launchArgumentBeat: Beat? {
        #if DEBUG
        guard let raw = UserDefaults.standard.string(forKey: "onboardingBeat") else { return nil }
        return Beat(rawValue: raw)
        #else
        return nil
        #endif
    }
}
