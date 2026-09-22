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
/// Before step one the lesson shows what it is going to make (`LessonIntro`): the
/// finished drawing, a quick build of every step, the finished drawing again, while
/// Lina says her few words before the lesson (`LessonBookend.introId`). "I’m ready"
/// can be tapped at any moment; a returning learner skips all of it.
///
/// Turned on its side the same parts become `pl-landscape`: the paper takes the full
/// height on the left, the sheet becomes a 312 pt panel on the right. Rotation is
/// allowed here and nowhere else (`PlayerOrientation`).
///
/// A wide drawing (`PageShape.wide`) has a second landscape layout, the wide page:
/// the panel gone, a bar along the bottom edge (`PlayerWideBar`) and the ink grown
/// into the whole paper — on an iPhone about 600 pt of car instead of 425. Which of
/// the two the learner sees is their own choice, `Settings.landscapeWidePage`: a tap
/// on the paper switches between them and the choice is kept, and nothing else —
/// no step, no phase — ever switches it, so the page holds still while they draw.
/// Until they have chosen, the panel shows and a pill on the paper points at the
/// tap. Held upright, the same drawing shows a one-line nudge to turn the phone,
/// the sketchbook rule made visible.
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
    /// When the intro on screen started, and whether it has run to its end (so the
    /// paper stops redrawing itself once the drawing is whole again).
    @State private var introStartedAt = Date()
    @State private var introEnded = false
    @State private var introTask: Task<Void, Never>?
    @State private var hasLoaded = false
    @State private var leaveOpenedAt: Date?

    /// The height the paper is never squeezed below (`pl-player` accessibility note:
    /// "the sheet grows and the paper yields down to 300 pt, then the column
    /// scrolls"). Everything left over is what the sentence may use.
    @State private var availableHeight: CGFloat = 0
    @State private var availableWidth: CGFloat = 0
    /// True once the screen has changed between upright and on its side while the
    /// lesson was open: the learner knows the phone turns, so the nudge is done.
    @State private var hasTurned = false
    @State private var nudgeDismissed = false
    /// The "tap the drawing" pill was tapped away this visit, before any tap on the
    /// paper itself settled the choice for good.
    @State private var tapHintDismissed = false

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
            .onAppear {
                availableHeight = proxy.size.height
                availableWidth = proxy.size.width
            }
            .onChange(of: proxy.size) { old, new in
                availableHeight = new.height
                availableWidth = new.width
                if (old.width > old.height) != (new.width > new.height) { hasTurned = true }
            }
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

            paper(insets: EdgeInsets(top: 96, leading: 0, bottom: 6, trailing: 0)) {
                chipBand
            }
            .accessibilitySortPriority(80)
            // A wide drawing is fitted by width upright, so the bottom of the paper
            // is always clear of ink: the nudge sits there, touching nothing.
            .overlay(alignment: .bottom) {
                if showsRotateNudge {
                    rotateNudge
                        .padding(.bottom, 14)
                        .transition(.opacity)
                }
            }
            .animation(reduceMotion ? nil : .easeOut(duration: 0.25), value: showsRotateNudge)

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

    /// The paper spans the whole width and the panel lies over its trailing 312 pt;
    /// the drawing is fitted beside the panel by its insets. On the wide page the
    /// panel is gone, the bar is along the bottom, and the same insets open up — so
    /// the ink grows in place rather than being swapped for a different paper.
    private var landscape: some View {
        ZStack(alignment: .trailing) {
            paper(insets: isWidePage ? wideDrawingInsets : landscapeDrawingInsets) {
                EmptyView()
            }
            .accessibilitySortPriority(80)
            .contentShape(Rectangle())
            .onTapGesture { paperTapped() }
            .overlay(alignment: .bottom) {
                if isWidePage {
                    wideBar
                        .transition(.move(edge: .bottom))
                }
            }
            // The paper runs under the panel; the pill is centred on the part
            // that shows. A wide drawing beside the panel is fitted by width, so
            // the bottom of that part is clear of ink.
            .overlay(alignment: .bottom) {
                if showsTapHint {
                    HStack {
                        Spacer(minLength: 0)
                        tapHint
                        Spacer(minLength: 0)
                    }
                    .padding(.leading, islandClearance(safeAreaInsets.left))
                    .padding(.trailing, PlayerPanel<EmptyView, EmptyView>.width)
                    .padding(.bottom, 14)
                    .transition(.opacity)
                }
            }
            .animation(reduceMotion ? nil : .easeOut(duration: 0.25), value: showsTapHint)

            if !isWidePage {
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
                    .transition(.move(edge: .trailing))
            }
        }
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.45), value: isWidePage)
        .ignoresSafeArea(.container, edges: .horizontal)
    }

    /// The drawing keeps clear of the Dynamic Island: 62 pt in on the island side, or
    /// the real safe inset when the device asks for more. 10 pt on the panel side,
    /// beyond the panel itself.
    private var landscapeDrawingInsets: EdgeInsets {
        EdgeInsets(top: 16,
                   leading: islandClearance(safeAreaInsets.left),
                   bottom: 16,
                   trailing: PlayerPanel<EmptyView, EmptyView>.width + 10)
    }

    /// The wide page: 16 pt all round, the island's clearance on whichever side it
    /// is, and the bar's height along the bottom.
    private var wideDrawingInsets: EdgeInsets {
        EdgeInsets(top: 16,
                   leading: islandClearance(safeAreaInsets.left),
                   bottom: PlayerWideBar<EmptyView, EmptyView, EmptyView>.height + 12,
                   trailing: islandClearance(safeAreaInsets.right))
    }

    /// 62 pt on a side that has an island or notch (or the real inset when the
    /// device asks for more), a plain 16 pt margin on a side that has not.
    private func islandClearance(_ safeInset: CGFloat) -> CGFloat {
        safeInset > 0 ? max(62, safeInset) : 16
    }

    private var safeAreaInsets: UIEdgeInsets {
        guard let window = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first?.keyWindow else { return .zero }
        return window.safeAreaInsets
    }

    // MARK: - The wide page

    /// A wide drawing, on its side, laid out the way the learner last chose. Until
    /// they choose, the panel: the words are on it, and the pill says where the
    /// wide page is. The choice is theirs alone — no step or phase touches it.
    private var isWidePage: Bool {
        isLandscape
            && lesson.tutorial.pageShape == .wide
            && (app.settings.landscapeWidePage ?? false)
    }

    private var wideBar: some View {
        PlayerWideBar(stepIndex: isOrientation ? nil : player.currentStepIndex,
                      stepCount: max(lesson.stepCount, 1),
                      actions: actions,
                      isLeftHanded: isLeftHanded,
                      leadingInset: safeAreaInsets.left,
                      trailingInset: safeAreaInsets.right,
                      onClose: close,
                      onWords: { choosePage(wide: false) },
                      menu: { moreMenu },
                      chip: { narrationChip },
                      reference: {
                          ReferenceThumb(reference: lesson.reference, side: 48) {
                              showReference = true
                          }
                      })
            .accessibilitySortPriority(70)
    }

    /// On a wide drawing's side the paper itself is the switch: a tap on the paper
    /// beside the panel opens the wide page, a tap on the wide page brings the
    /// panel back. Nowhere else does the paper answer a tap.
    private func paperTapped() {
        guard isLandscape, lesson.tutorial.pageShape == .wide else { return }
        choosePage(wide: !isWidePage)
    }

    /// Remembered across lessons and launches, so the page is the way the learner
    /// left it the next time the phone goes on its side.
    private func choosePage(wide: Bool) {
        tapHintDismissed = true
        app.settings.landscapeWidePage = wide
    }

    /// Shown beside the panel until the learner has switched once, or tapped the
    /// pill away for this visit.
    private var showsTapHint: Bool {
        isLandscape
            && lesson.tutorial.pageShape == .wide
            && app.settings.landscapeWidePage == nil
            && !tapHintDismissed
    }

    private var tapHint: some View {
        nudge(icon: "hand.tap",
              text: "Tap the drawing for a bigger page",
              accessibilityLabel: "The drawing can have the whole screen. Tap the drawing to switch, and again to come back. Double tap to dismiss.") {
            tapHintDismissed = true
        }
    }

    // MARK: - The rotate nudge

    /// A wide drawing held upright is fitted by width, so a sideways phone would
    /// show it much larger. Say so once: through the beat before the lesson and
    /// step one, until the phone turns, the learner taps it away, or step two
    /// starts — a returning learner deep in the lesson is never told. Not at
    /// accessibility type sizes, where the layout stays upright whatever the phone
    /// does. The phone's own rotation lock is not knowable here; the tap covers it.
    private var showsRotateNudge: Bool {
        availableWidth < availableHeight
            && lesson.tutorial.pageShape == .wide
            && !hasTurned
            && !nudgeDismissed
            && !dynamicTypeSize.isAccessibilitySize
            && (isOrientation || player.currentStepIndex == 0)
    }

    private var rotateNudge: some View {
        nudge(icon: "rotate.right",
              text: "Turn sideways to draw it bigger",
              accessibilityLabel: "This drawing is wide. Turn the phone sideways to draw it bigger. Double tap to dismiss.") {
            nudgeDismissed = true
        }
    }

    /// One quiet pill on the paper: a glyph and a line, white with the 2 pt line
    /// and the chip shadow. Tapping it is how it goes away.
    private func nudge(icon: String,
                       text: String,
                       accessibilityLabel: String,
                       action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .scaledFont(14, .bold, design: .default)
                Text(text)
                    .scaledFont(14, .heavy)
                    .lineLimit(1)
            }
            .foregroundStyle(Theme.ink70)
            .padding(.vertical, 9)
            .padding(.horizontal, 14)
            .background(Capsule().fill(Theme.card))
            .overlay(Capsule().strokeBorder(Theme.line, lineWidth: 2))
            .chipShadow()
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
        .accessibilitySortPriority(40)
    }

    // MARK: - Shared parts

    /// The paper of a step, or, before step one, the paper of the intro: the same
    /// canvas, handed the step and the progress the intro's timeline is at.
    @ViewBuilder
    private func paper<Chips: View>(insets: EdgeInsets,
                                    @ViewBuilder chips: @escaping () -> Chips) -> some View {
        if isOrientation {
            TimelineView(.animation(paused: introEnded)) { context in
                introPaper(introFrame(at: context.date), insets: insets, chips: chips)
            }
        } else {
            PlayerPaper(tutorial: lesson.tutorial,
                        phase: player.phase,
                        strokeProgress: player.strokeProgress,
                        fillProgress: player.fillProgress,
                        activeStrokeIndex: player.activeStrokeIndex,
                        showsPencilTip: true,
                        drawingInsets: insets,
                        accessibilityText: canvasAccessibilityText,
                        chips: chips)
        }
    }

    /// The whole drawing at full strength for `goal` and `rest`; for `build`, the
    /// step being drawn over the faded steps before it, with no pencil tip — this is
    /// a look at the drawing, not yet a line to copy.
    private func introPaper<Chips: View>(_ frame: LessonIntro.Frame,
                                         insets: EdgeInsets,
                                         @ViewBuilder chips: @escaping () -> Chips) -> some View {
        var phase = PlayerViewModel.Phase.finished
        var strokes: [Double] = []
        var fills: [Double] = []
        if case let .build(stepIndex, itemIndex, progress) = frame,
           lesson.tutorial.steps.indices.contains(stepIndex) {
            let step = lesson.tutorial.steps[stepIndex]
            func amount(_ item: Int) -> Double { item < itemIndex ? 1 : item == itemIndex ? progress : 0 }
            phase = .drawing(stepIndex: stepIndex)
            strokes = step.strokes.indices.map { amount($0) }
            fills = step.fills.indices.map { amount(step.strokes.count + $0) }
        }
        return PlayerPaper(tutorial: lesson.tutorial,
                           phase: phase,
                           strokeProgress: strokes,
                           fillProgress: fills,
                           activeStrokeIndex: nil,
                           showsPencilTip: false,
                           drawingInsets: insets,
                           accessibilityText: canvasAccessibilityText,
                           chips: chips)
    }

    @ViewBuilder
    private func header(isCompact: Bool) -> some View {
        if isOrientation {
            // The caption follows the build a few times a second; the paper beside
            // it is what needs every frame.
            TimelineView(.periodic(from: introStartedAt, by: 0.2)) { context in
                playerHeader(isCompact: isCompact, caption: introCaption(at: context.date))
            }
        } else {
            playerHeader(isCompact: isCompact, caption: nil)
        }
    }

    private func playerHeader(isCompact: Bool, caption: String?) -> some View {
        PlayerHeader(stepIndex: isOrientation ? nil : player.currentStepIndex,
                     stepCount: max(lesson.stepCount, 1),
                     caption: caption,
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

        Button(app.preferences.narrationEnabled ? "Mute narration" : "Unmute narration",
               systemImage: app.preferences.narrationEnabled ? "speaker.slash" : "speaker.wave.2") {
            toggleNarration()
        }
    }

    /// The chip is on the paper whenever this step has a recorded line: speaking,
    /// idle, or muted when narration is off — because the chip is also the way to
    /// turn Lina back on without leaving the lesson (`pl-player` variant `muted`).
    /// A step with no voice gets no chip at all: a greyed chip for a step that has
    /// no line would read as broken, and a lesson the Studio has not narrated plays
    /// exactly as it did before any audio shipped, silently and chipless.
    @ViewBuilder
    private var narrationChip: some View {
        if showsNarrationChip {
            NarrationChip(state: chipState) {
                toggleNarration()
            }
            .accessibilitySortPriority(50)
        }
    }

    private var chipState: NarrationChip.State {
        guard app.preferences.narrationEnabled else { return .muted }
        return narration.isSpeaking ? .speaking : .idle
    }

    private var referenceThumb: some View {
        ReferenceThumb(reference: lesson.reference) { showReference = true }
            .accessibilitySortPriority(45)
    }

    private var actions: PlayerActionRow {
        PlayerActionRow(primaryTitle: primaryTitle,
                        isPending: player.isDrawing,
                        canGoBack: player.canGoToPreviousStep,
                        showsBack: !isOrientation,
                        replayLabel: isOrientation ? "Watch it come together again" : "Watch this step again",
                        isLeftHanded: isLeftHanded,
                        primaryFontSize: isLandscape ? 19 : nil,
                        isCompact: isWidePage,
                        onBack: goBack,
                        onReplay: replay,
                        onPrimary: primaryTapped)
    }

    // MARK: - Words

    private var isOrientation: Bool { player.isAwaitingBegin }

    /// Before step one the sentence is what Lina is saying: the line published for
    /// this lesson's intro, or the words the Studio would have recorded for it.
    private var instruction: String {
        if isOrientation {
            return narration.lineText(lessonId: lesson.id, stepId: LessonBookend.introId)
                ?? LessonBookend.defaultIntro(lessonId: lesson.id, title: lesson.title)
        }
        return player.currentStep?.instruction ?? lesson.objective
    }

    /// One line under the sentence: the "how". Nothing to do yet during the intro,
    /// then what to look at while Lina draws, and what to do once she has stopped.
    private var hint: String {
        if isOrientation { return "Just watch for now. Tap I’m ready whenever you like." }
        return player.isDrawing ? "Watch the line, then draw it." : "Tap when your line is on the paper."
    }

    private var primaryTitle: String {
        if isOrientation { return "I’m ready" }
        return player.isOnLastStep ? "Finish" : "I drew it"
    }

    /// The canvas is one VoiceOver element: which step, what it is, and whether it is
    /// still being drawn.
    private var canvasAccessibilityText: String {
        guard !isOrientation else {
            return "The finished \(lesson.subject), coming together step by step. \(lesson.stepCountText)."
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

    private var isLeftHanded: Bool { app.preferences.leftHanded }

    private var reduceMotion: Bool {
        systemReduceMotion || app.preferences.reduceMotionOverride
    }

    /// The side panel needs a 312 pt column beside a useful paper; at accessibility
    /// type sizes the stack cannot hold, so portrait wins whatever the phone does.
    private var isLandscape: Bool {
        verticalSizeClass == .compact && !dynamicTypeSize.isAccessibilitySize
    }

    private var showsNarrationChip: Bool {
        if isOrientation { return narration.hasAudio(lessonId: lesson.id, stepId: LessonBookend.introId) }
        guard let step = player.currentStep else { return false }
        return narration.hasAudio(lessonId: lesson.id, stepId: step.id)
    }

    // MARK: - Lifecycle

    private func appear() {
        PlayerOrientation.allowRotation()
        // A profile switch calls this first, so the step is saved to this kid.
        app.sessionSaver = saveSession
        guard !hasLoaded else { return }
        hasLoaded = true
        player.speed = app.preferences.defaultSpeed
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
        if isOrientation { startIntro() }
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
        introTask?.cancel()
        player.stop()
        narration.deactivate()
        PlayerOrientation.lockToPortrait()
    }

    // MARK: - The intro

    /// The intro lasts as long as Lina's words before the lesson, when they were
    /// recorded, so the drawing is whole again as she hands over.
    private var introTotal: Double {
        LessonIntro.total(for: lesson.tutorial,
                          spoken: narration.lineSeconds(lessonId: lesson.id, stepId: LessonBookend.introId))
    }

    /// With motion reduced nothing builds: the finished drawing holds still while
    /// Lina speaks.
    private func introFrame(at date: Date) -> LessonIntro.Frame {
        guard !reduceMotion, !introEnded else { return .rest }
        return LessonIntro.frame(for: lesson.tutorial,
                                 elapsed: date.timeIntervalSince(introStartedAt),
                                 total: introTotal)
    }

    private func introCaption(at date: Date) -> String {
        if case let .build(stepIndex, _, _) = introFrame(at: date),
           lesson.tutorial.steps.indices.contains(stepIndex) {
            return "Coming up · \(lesson.tutorial.steps[stepIndex].title)"
        }
        return "Here is what we are going to draw"
    }

    /// From the top: on arriving, and on "watch again". The line and the drawing
    /// start together.
    private func startIntro() {
        introTask?.cancel()
        introStartedAt = Date()
        introEnded = reduceMotion
        narration.stop()
        if app.preferences.narrationEnabled {
            narration.play(lessonId: lesson.id, stepId: LessonBookend.introId)
        }
        guard !reduceMotion else { return }
        let total = introTotal
        introTask = Task {
            try? await Task.sleep(for: .seconds(total))
            if !Task.isCancelled { introEnded = true }
        }
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
        guard app.preferences.narrationEnabled,
              lesson.tutorial.steps.indices.contains(index) else { return }
        narration.play(lessonId: lesson.id, stepId: lesson.tutorial.steps[index].id)
    }

    // MARK: - Actions

    private func primaryTapped() {
        if isOrientation {
            introTask?.cancel()
            narration.stop()
            haptic(.light)
            player.begin()
            return
        }
        // The same tap whether or not the line has finished drawing: mid-stroke
        // the ink jumps to the end of the step first (`advanceToNextStep()`), so
        // "I drew it" always means the next step. Never refused.
        narration.stop()
        if player.isOnLastStep {
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
        if isOrientation {
            startIntro()
            return
        }
        narration.stop()
        player.replayCurrentStep()
    }

    /// Step one, not the intro: they have already been shown what they are drawing.
    private func restart() {
        introTask?.cancel()
        narration.stop()
        player.restart()
    }

    private func setSpeed(_ value: Double) {
        // The running stroke keeps its pace; the next one takes the new speed, so a
        // learner never loses their place to a setting.
        player.speed = value
        app.preferences.defaultSpeed = value
    }

    private func toggleNarration() {
        app.preferences.narrationEnabled.toggle()
        if app.preferences.narrationEnabled {
            if isOrientation {
                startIntro()
            } else if case let .drawing(index) = player.phase {
                speak(stepAt: index)
            }
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
        if isOrientation {
            // The close button stopped her; the intro starts again with her.
            if waited > 1.5 { startIntro() }
        } else if player.isDrawing, waited > 1.5 {
            player.replayCurrentStep()
        }
    }

    private func leave() {
        showLeave = false
        saveSession()
        app.dismissPlayer()
    }

    /// Records where the learner is and stops everything that makes a sound. Used by
    /// Leave and by `AppModel.switchProfile(to:)` before it closes the player.
    private func saveSession() {
        app.progress.markOpened(lesson.id, pathId: lesson.pathId, step: player.currentStepIndex)
        player.stop()
        narration.deactivate()
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

/// A tiny two-step house, so the player can be looked at without the bundle. `wide`
/// declares the ink oblong, which is enough to see the wide page and the nudge.
private func previewLesson(wide: Bool = false) -> Lesson {
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
        drawingBounds: wide
            ? CGRect(x: 100, y: 260, width: 800, height: 400)
            : CGRect(x: 152, y: 152, width: 696, height: 746),
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

#Preview("Player · wide page", traits: .landscapeLeft) {
    PlayerScreen(lesson: previewLesson(wide: true), resumeFrom: 1)
        .environment(AppModel())
}

#Preview("Player · rotate nudge") {
    PlayerScreen(lesson: previewLesson(wide: true))
        .environment(AppModel())
}
