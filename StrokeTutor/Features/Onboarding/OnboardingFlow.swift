import SwiftUI

/// `ob-splash` … `ob-ready` — the seven beats a learner sees once: what the app is,
/// what they will do, how a lesson works, what they need, which path to take,
/// whether Lina speaks, and their first lesson.
///
/// The flow owns the two answers onboarding collects — the path and the voice — and
/// nothing else. It writes `currentPathId` when the learner leaves the path beat and
/// `narrationEnabled` the moment the switch is touched; `hasCompletedOnboarding` is
/// written by `AppRoot` when `onFinished` is called, so a flow replayed from Settings
/// changes no stored value it was not asked to.
struct OnboardingFlow: View {

    /// Called once, with the lesson to open next, or nil to land on Home.
    let onFinished: (Lesson?) -> Void

    /// Where the flow opens. Nil starts at the launch beat, which is what the app
    /// does; a beat here is for previews and for walking the flow while building it.
    var initialBeat: Beat?

    @Environment(AppModel.self) private var app
    @Environment(\.accessibilityReduceMotion) private var systemReducesMotion

    @State private var beat: Beat?
    /// The path the learner has tapped, before Continue commits it.
    @State private var pendingPathId: String?

    init(onFinished: @escaping (Lesson?) -> Void, initialBeat: Beat? = nil) {
        self.onFinished = onFinished
        self.initialBeat = initialBeat
    }

    /// The seven beats, in order. `progress` is the rail's fill; the launch beat has
    /// no rail at all.
    enum Beat: String, CaseIterable, Hashable {
        case launch = "ob-splash"
        case intro = "ob-1"
        case method = "ob-2"
        case kit = "ob-3"
        case path = "ob-path"
        case voice = "ob-voice"
        case ready = "ob-ready"

        /// One of six rail positions: 16 %, 33 %, 50 %, 66 %, 83 %, 100 %.
        var step: Int {
            switch self {
            case .launch: return 0
            case .intro: return 1
            case .method: return 2
            case .kit: return 3
            case .path: return 4
            case .voice: return 5
            case .ready: return 6
            }
        }

        var progress: Double { Double(step) / 6 }

        var stepLabel: String { "Step \(step) of 6" }
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
            if beat == nil { beat = initialBeat ?? Self.launchArgumentBeat ?? .launch }
        }
    }

    // MARK: - The beats

    @ViewBuilder
    private var current: some View {
        switch beat {
        case .none:
            Color.clear

        case .launch:
            OnboardingLaunchBeat(lesson: firstLessonOfFirstPath) { go(.intro) }

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
                              onContinue: { go(.path) })

        case .path:
            OnboardingPathBeat(paths: visiblePaths,
                               selectedPathId: selectedPath?.id,
                               rail: rail(for: .path, back: .kit, skippable: false),
                               onSelect: { pendingPathId = $0.id },
                               onContinue: {
                                   if let path = selectedPath { app.select(path) }
                                   go(.voice)
                               })

        case .voice:
            OnboardingVoiceBeat(narrationEnabled: narrationBinding,
                                rail: rail(for: .voice, back: .path, skippable: false),
                                onContinue: { go(.ready) })

        case .ready:
            OnboardingReadyBeat(lesson: selectedPath?.lessons.first,
                                path: selectedPath,
                                rail: rail(for: .ready, back: .voice, skippable: false),
                                onStart: { onFinished(selectedPath?.lessons.first) },
                                onLookAround: { onFinished(nil) })
        }
    }

    /// The rail every beat but the launch shows. `back` is the beat the chevron
    /// returns to; nil hides the chevron but keeps its space.
    private func rail(for beat: Beat, back: Beat?, skippable: Bool = true) -> OnboardingRail {
        OnboardingRail(progress: beat.progress,
                       stepLabel: beat.stepLabel,
                       onBack: back.map { target in { go(target) } },
                       onSkip: skippable ? { go(.path) } : nil)
    }

    // MARK: - Moving

    private func go(_ target: Beat) {
        withAnimation(reducesMotion ? nil : .easeInOut(duration: 0.22)) {
            beat = target
        }
    }

    // MARK: - Content

    /// Only paths that have a lesson the learner can actually open. A path whose
    /// lessons are still being written is not offered.
    private var visiblePaths: [PathModel] {
        app.paths.filter { !$0.isEmpty }
    }

    /// The path the picker shows as chosen: what was tapped, else what Settings
    /// already holds, else the first path in the catalog.
    private var selectedPath: PathModel? {
        if let pendingPathId, let path = visiblePaths.first(where: { $0.id == pendingPathId }) {
            return path
        }
        if let stored = visiblePaths.first(where: { $0.id == app.settings.currentPathId }) {
            return stored
        }
        return visiblePaths.first
    }

    /// The drawing the launch and the first beats show, before a path is chosen.
    private var firstLessonOfFirstPath: Lesson? {
        visiblePaths.first?.lessons.first
    }

    private var narrationBinding: Binding<Bool> {
        Binding(get: { app.settings.narrationEnabled },
                set: { app.settings.narrationEnabled = $0 })
    }

    /// The system setting, or the app's own override in Settings.
    private var reducesMotion: Bool {
        systemReducesMotion || app.settings.reduceMotionOverride
    }

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
