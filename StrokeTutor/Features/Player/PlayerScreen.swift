import SwiftUI
import UIKit

/// `pl-player` — the flagship screen: one step draws itself on white paper, the app
/// stops, the learner copies it with a real pen and decides when to go on.
///
/// One anatomy for every state (`v3.html#pl-player`): a 56 pt header, full-bleed
/// white paper, and a white sheet with one sentence and one green button. Nothing
/// moves between states; only the strokes, the chip and the primary's fill change.
/// There is no countdown and no auto-advance: `.awaitingUser` is left only by the
/// primary.
///
/// Turned on its side the same parts become `pl-landscape`: the paper takes the full
/// height on the left, the sheet becomes a 312 pt panel on the right. Rotation is
/// allowed here and nowhere else (`PlayerOrientation`).
struct PlayerScreen: View {
    let lesson: Lesson
    /// The step a returning learner left off at, if any. Resuming skips the
    /// orientation beat: they have already been told what they are drawing.
    var resumeFrom: Int?
    #if DEBUG
    /// Screenshot-harness only (`DebugScreenHarness`, via `AppRoot`): jumps
    /// straight to an exact step and phase instead of the one `resumeFrom` and a
    /// tap sequence would produce. Nil on every real launch.
    var harnessState: PlayerHarnessState?
    #endif

    @Environment(AppModel.self) private var app
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.verticalSizeClass) private var verticalSizeClass
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    @State private var player = PlayerViewModel()
    @State private var narration = NarrationPlayer()
    @State private var showLeave = false
    @State private var showReference = false
    @State private var confirmRestart = false
    /// How far the orientation beat's ghost has drawn itself on, 0...1.
    @State private var ghostProgress: Double = 0
    @State private var hasLoaded = false
    @State private var leaveOpenedAt: Date?

    /// The height the paper is never squeezed below (`pl-player` accessibility note:
    /// "the sheet grows and the paper yields down to 300 pt, then the column
    /// scrolls"). Everything left over is what the sentence may use.
    @State private var availableHeight: CGFloat = 0

    var body: some View {
        GeometryReader { proxy in
            Group {
                if isLandscape {
                    landscape
                } else {
                    portrait
                }
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .onAppear { availableHeight = proxy.size.height }
            .onChange(of: proxy.size.height) { _, new in availableHeight = new }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.paper.ignoresSafeArea())
        .interactiveDismissDisabled(true)
        .accessibilityHidden(showLeave)
        .sheet(isPresented: $showReference) {
            ReferenceSheet(lesson: lesson) { showReference = false }
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
                .presentationBackground(Theme.card)
                .presentationCornerRadius(28)
        }
        .sheet(isPresented: $showLeave) {
            LeaveSheet(stepNumber: player.currentStepIndex + 1,
                       onKeepDrawing: keepDrawing,
                       onLeave: leave)
                .presentationDetents(dynamicTypeSize.isAccessibilitySize ? [.medium] : [.fraction(0.4)])
                .presentationDragIndicator(.visible)
                .presentationBackground(Theme.card)
                .presentationCornerRadius(28)
        }
        .confirmationDialog("Start this lesson over?",
                            isPresented: $confirmRestart,
                            titleVisibility: .visible) {
            Button("Start over") { restart() }
            Button("Cancel", role: .cancel) {}
        }
        .onAppear(perform: appear)
        .onDisappear(perform: disappear)
        .onChange(of: player.phase) { _, phase in phaseChanged(to: phase) }
    }

    // MARK: - Portrait

    private var portrait: some View {
        VStack(spacing: 0) {
            header(isCompact: false)

            PlayerPaper(tutorial: lesson.tutorial,
                        phase: player.phase,
                        strokeProgress: player.strokeProgress,
                        fillProgress: player.fillProgress,
                        activeStrokeIndex: player.activeStrokeIndex,
                        ghostProgress: isOrientation ? ghostProgress : nil,
                        showsPencilTip: true,
                        drawingInsets: EdgeInsets(top: 96, leading: 0, bottom: 6, trailing: 0),
                        accessibilityText: canvasAccessibilityText) {
                chipBand
            }
            .accessibilitySortPriority(80)

            PlayerSheet(instruction: instruction,
                        hint: hint,
                        actions: actions,
                        textMaxHeight: portraitTextCap)
                .layoutPriority(1)
        }
    }

    /// Header 56 + the paper's 380 pt floor + the action row 78 + the sheet's own
    /// padding. What is left is the sentence's ceiling: on an iPhone 17 about 210 pt,
    /// nine lines of body text, past which the words scroll and the paper keeps
    /// roughly half the screen.
    private var portraitTextCap: CGFloat {
        max(84, availableHeight - 56 - 380 - 78 - 56)
    }

    /// The 96 pt band at the top of the paper: narration on one side, the reference
    /// on the other. Left-handed swaps them, so the drawing hand covers neither.
    private var chipBand: some View {
        // Two overlays rather than a reordered row, so the thumbnail keeps its view
        // identity — and its loaded picture — when the handedness setting changes.
        Color.clear
            .allowsHitTesting(false)
            .frame(height: 84)
            .overlay(alignment: isLeftHanded ? .topTrailing : .topLeading) { narrationChip }
            .overlay(alignment: isLeftHanded ? .topLeading : .topTrailing) { referenceThumb }
            .padding(.horizontal, 16)
            .padding(.top, 12)
    }

    // MARK: - Landscape

    private var landscape: some View {
        HStack(spacing: 0) {
            PlayerPaper(tutorial: lesson.tutorial,
                        phase: player.phase,
                        strokeProgress: player.strokeProgress,
                        fillProgress: player.fillProgress,
                        activeStrokeIndex: player.activeStrokeIndex,
                        ghostProgress: isOrientation ? ghostProgress : nil,
                        showsPencilTip: true,
                        drawingInsets: landscapeDrawingInsets,
                        accessibilityText: canvasAccessibilityText) {
                EmptyView()
            }
            .accessibilitySortPriority(80)

            PlayerPanel(instruction: instruction,
                        hint: hint,
                        actions: actions,
                        textMaxHeight: max(80, availableHeight - 44 - 64 - 78 - 44),
                        header: { header(isCompact: true) },
                        chips: {
                            Color.clear
                                .allowsHitTesting(false)
                                .frame(height: 64)
                                .overlay(alignment: isLeftHanded ? .trailing : .leading) { narrationChip }
                                .overlay(alignment: isLeftHanded ? .leading : .trailing) {
                                    ReferenceThumb(reference: lesson.reference, side: 64) {
                                        showReference = true
                                    }
                                }
                        })
        }
        .ignoresSafeArea(.container, edges: .horizontal)
    }

    /// The drawing keeps clear of the Dynamic Island: 62 pt in on the island side, or
    /// the real safe inset when the device asks for more. 10 pt on the panel side.
    private var landscapeDrawingInsets: EdgeInsets {
        EdgeInsets(top: 16, leading: max(62, safeAreaLeading), bottom: 16, trailing: 10)
    }

    private var safeAreaLeading: CGFloat {
        guard let window = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first?.keyWindow else { return 0 }
        return window.safeAreaInsets.left
    }

    // MARK: - Shared parts

    private func header(isCompact: Bool) -> some View {
        PlayerHeader(stepIndex: isOrientation ? nil : player.currentStepIndex,
                     stepCount: max(lesson.stepCount, 1),
                     isCompact: isCompact,
                     onClose: close) {
            moreMenu
        }
        .accessibilitySortPriority(10)
    }

    @ViewBuilder
    private var moreMenu: some View {
        Section("Speed") {
            ForEach(PlayerViewModel.speedOptions, id: \.self) { option in
                Button {
                    setSpeed(option)
                } label: {
                    if option == player.speed {
                        Label(speedLabel(option), systemImage: "checkmark")
                    } else {
                        Text(speedLabel(option))
                    }
                }
            }
        }

        Button("Start over", systemImage: "arrow.counterclockwise") {
            confirmRestart = true
        }

        Button(app.settings.narrationEnabled ? "Mute narration" : "Unmute narration",
               systemImage: app.settings.narrationEnabled ? "speaker.slash" : "speaker.wave.2") {
            toggleNarration()
        }
    }

    /// The chip is on the paper only when narration is on *and* this step has a
    /// recorded line — a greyed chip for a step that has no voice would read as
    /// broken (`pl-player` notes). A lesson the Studio has not narrated therefore
    /// plays exactly as it did before any audio shipped: silently, chipless.
    @ViewBuilder
    private var narrationChip: some View {
        if showsNarrationChip {
            NarrationChip(state: narration.isSpeaking ? .speaking : .idle) {
                toggleNarration()
            }
            .accessibilitySortPriority(50)
        }
    }

    private var referenceThumb: some View {
        ReferenceThumb(reference: lesson.reference) { showReference = true }
            .accessibilitySortPriority(45)
    }

    private var actions: PlayerActionRow {
        PlayerActionRow(primaryTitle: primaryTitle,
                        isPending: player.isDrawing,
                        canGoBack: player.canGoToPreviousStep,
                        showsQuietControls: !isOrientation,
                        isLeftHanded: isLeftHanded,
                        primaryFontSize: isLandscape ? 19 : nil,
                        onBack: goBack,
                        onReplay: replay,
                        onPrimary: primaryTapped)
    }

    // MARK: - Words

    private var isOrientation: Bool { player.isAwaitingBegin }

    private var instruction: String {
        if isOrientation { return lesson.objective }
        return player.currentStep?.instruction ?? lesson.objective
    }

    /// One line under the sentence. Facts before the lesson starts, then the "how":
    /// what to look at while Lina draws, and what to do once she has stopped.
    private var hint: String {
        if isOrientation {
            return "\(lesson.stepCountText) · \(lesson.estimatedTimeText) · Pen and paper ready"
        }
        return player.isDrawing ? "Watch the line, then draw it." : "Tap when your line is on the paper."
    }

    private var primaryTitle: String {
        if isOrientation { return "Begin" }
        return player.isOnLastStep ? "Finish" : "I drew it"
    }

    /// The canvas is one VoiceOver element: which step, what it is, and whether it is
    /// still being drawn.
    private var canvasAccessibilityText: String {
        guard !isOrientation else {
            return "The finished \(lesson.subject), shown faintly. \(lesson.stepCountText)."
        }
        let index = player.currentStepIndex
        let title = player.currentStep?.title ?? lesson.title
        let state = player.isDrawing ? "drawing" : "drawn"
        return "Step \(index + 1) of \(lesson.stepCount), \(title), \(state)"
    }

    private func speedLabel(_ value: Double) -> String {
        value == 1 ? "1×" : String(format: "%g×", value)
    }

    // MARK: - State

    private var isLeftHanded: Bool { app.settings.leftHanded }

    private var reduceMotion: Bool {
        systemReduceMotion || app.settings.reduceMotionOverride
    }

    /// The side panel needs a 312 pt column beside a useful paper; at accessibility
    /// type sizes the stack cannot hold, so portrait wins whatever the phone does.
    private var isLandscape: Bool {
        verticalSizeClass == .compact && !dynamicTypeSize.isAccessibilitySize
    }

    private var showsNarrationChip: Bool {
        guard app.settings.narrationEnabled, let step = player.currentStep else { return false }
        return narration.hasAudio(lessonId: lesson.id, stepId: step.id)
    }

    // MARK: - Lifecycle

    private func appear() {
        PlayerOrientation.allowRotation()
        guard !hasLoaded else { return }
        hasLoaded = true
        player.speed = app.settings.defaultSpeed
        #if DEBUG
        if let harnessState {
            applyHarnessState(harnessState)
            return
        }
        #endif
        // Resuming skips the orientation beat and lands on the saved step, with the
        // earlier ones already faded.
        player.load(lesson.tutorial,
                    startingAt: resumeFrom ?? 0,
                    startImmediately: resumeFrom != nil)
        app.progress.markOpened(lesson.id, pathId: lesson.pathId, step: resumeFrom)
        if isOrientation { runGhost() }
    }

    #if DEBUG
    /// Drives the player straight to `state`'s step: mid-stroke at a crawl if
    /// `isDrawing`, else settled into `.awaitingUser` via the same
    /// `completeCurrentStep()` the "skip ahead" tap uses, so the ink is exactly
    /// what a learner would see rather than an unfilled debug stand-in.
    private func applyHarnessState(_ state: PlayerHarnessState) {
        if state.isDrawing { player.speed = 0.05 }
        player.load(lesson.tutorial, startingAt: state.stepIndex, startImmediately: true)
        if !state.isDrawing { player.completeCurrentStep() }
        app.progress.markOpened(lesson.id, pathId: lesson.pathId, step: state.stepIndex)
        if state.showsReference { showReference = true }
        if state.showsLeaveSheet { showLeave = true }
    }
    #endif

    private func disappear() {
        player.stop()
        narration.deactivate()
        PlayerOrientation.lockToPortrait()
    }

    /// The whole drawing draws itself on at 20 %, once, before step one.
    private func runGhost() {
        ghostProgress = 0
        guard !reduceMotion else {
            ghostProgress = 1
            return
        }
        let duration = min(max(lesson.tutorial.totalDuration * 0.35, 1.6), 3.2)
        withAnimation(.linear(duration: duration)) { ghostProgress = 1 }
    }

    private func phaseChanged(to phase: PlayerViewModel.Phase) {
        switch phase {
        case let .drawing(index):
            app.progress.markOpened(lesson.id, pathId: lesson.pathId, step: index)
            speak(stepAt: index)
        case let .awaitingUser(index):
            app.progress.markOpened(lesson.id, pathId: lesson.pathId, step: index)
            UIAccessibility.post(notification: .announcement,
                                 argument: "Step drawn. Draw it on your paper, then tap I drew it.")
        case .idle, .finished:
            break
        }
    }

    private func speak(stepAt index: Int) {
        narration.stop()
        guard app.settings.narrationEnabled,
              lesson.tutorial.steps.indices.contains(index) else { return }
        narration.play(lessonId: lesson.id, stepId: lesson.tutorial.steps[index].id)
    }

    // MARK: - Actions

    private func primaryTapped() {
        if isOrientation {
            player.begin()
            return
        }
        if player.isDrawing {
            // Skip ahead: finish the ink, stop the voice, and settle where the
            // animation would have left us. Never refused.
            narration.stop()
            player.completeCurrentStep()
            haptic(.light)
            return
        }
        if player.isOnLastStep {
            narration.stop()
            player.stop()
            successHaptic()
            // `AppModel.presentCompletion` records the finished lesson (and clears
            // the resume point) before it shows `sk-complete`.
            app.presentCompletion(lesson)
        } else {
            haptic(.light)
            player.advanceToNextStep()
        }
    }

    private func goBack() {
        narration.stop()
        player.goToPreviousStep()
    }

    private func replay() {
        narration.stop()
        player.replayCurrentStep()
    }

    private func restart() {
        narration.stop()
        player.restart()
    }

    private func setSpeed(_ value: Double) {
        // The running stroke keeps its pace; the next one takes the new speed, so a
        // learner never loses their place to a setting.
        player.speed = value
        app.settings.defaultSpeed = value
    }

    private func toggleNarration() {
        app.settings.narrationEnabled.toggle()
        if app.settings.narrationEnabled {
            if case let .drawing(index) = player.phase { speak(stepAt: index) }
        } else {
            narration.stop()
        }
    }

    private func close() {
        narration.stop()
        leaveOpenedAt = Date()
        showLeave = true
    }

    /// Back to the step. If the ink has been sitting still under the sheet for a
    /// while, play it again so the line and the voice start together.
    private func keepDrawing() {
        showLeave = false
        let waited = leaveOpenedAt.map { Date().timeIntervalSince($0) } ?? 0
        leaveOpenedAt = nil
        if player.isDrawing, waited > 1.5 {
            player.replayCurrentStep()
        }
    }

    private func leave() {
        showLeave = false
        app.progress.markOpened(lesson.id, pathId: lesson.pathId, step: player.currentStepIndex)
        player.stop()
        narration.deactivate()
        app.dismissPlayer()
    }

    private func haptic(_ style: UIImpactFeedbackGenerator.FeedbackStyle) {
        guard !reduceMotion else { return }
        UIImpactFeedbackGenerator(style: style).impactOccurred()
    }

    private func successHaptic() {
        guard !reduceMotion else { return }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
}

// MARK: - Previews

/// A tiny two-step house, so the player can be looked at without the bundle.
private func previewLesson() -> Lesson {
    func stroke(_ build: (inout Path) -> Void, width: Double) -> PreparedStroke {
        var path = Path()
        build(&path)
        return PreparedStroke(path: path, duration: 1.4, lineWidth: width, color: nil)
    }
    let walls = stroke({ $0.addRect(CGRect(x: 250, y: 480, width: 500, height: 370)) }, width: 16)
    let roof = stroke({ path in
        path.move(to: CGPoint(x: 200, y: 480))
        path.addLine(to: CGPoint(x: 500, y: 260))
        path.addLine(to: CGPoint(x: 800, y: 480))
        path.closeSubpath()
    }, width: 16)
    let door = stroke({ path in
        path.move(to: CGPoint(x: 440, y: 850))
        path.addLine(to: CGPoint(x: 440, y: 690))
        path.addLine(to: CGPoint(x: 560, y: 690))
        path.addLine(to: CGPoint(x: 560, y: 850))
    }, width: 12)

    let tutorial = PreparedTutorial(
        tutorialID: "simple-house",
        title: "Simple House",
        canvas: CGSize(width: 1000, height: 1000),
        schemaVersion: 1,
        strokeColor: Theme.ink,
        backgroundColor: Theme.paper,
        steps: [
            PreparedStep(id: "walls", title: "the walls", instruction: "Draw a wide rectangle for the walls.", strokes: [walls], fills: []),
            PreparedStep(id: "roof", title: "the roof", instruction: "Put a triangle on top for the roof.", strokes: [roof], fills: []),
            PreparedStep(id: "door", title: "the door", instruction: "Draw a tall rectangle at the bottom for the door.", strokes: [door], fills: [])
        ],
        drawingBounds: CGRect(x: 152, y: 152, width: 696, height: 746),
        source: .bundled,
        fileName: "simple-house.json",
        warnings: []
    )

    return Lesson(id: "simple-house",
                  title: "Simple House",
                  pathId: "houses",
                  tutorial: tutorial,
                  objective: "A house is a box with a triangle on top.",
                  complexity: 1,
                  reference: nil)
}

#Preview("Player · orientation") {
    PlayerScreen(lesson: previewLesson())
        .environment(AppModel())
}

#Preview("Player · step 2") {
    PlayerScreen(lesson: previewLesson(), resumeFrom: 1)
        .environment(AppModel())
}

#Preview("Player · landscape", traits: .landscapeLeft) {
    PlayerScreen(lesson: previewLesson(), resumeFrom: 1)
        .environment(AppModel())
}
