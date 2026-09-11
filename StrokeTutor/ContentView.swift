import SwiftUI
import UniformTypeIdentifiers

struct ContentView: View {
    @State private var library = TutorialLibrary()
    @State private var player = PlayerViewModel()
    @State private var selectedTutorialID: UUID?
    @State private var isShowingImporter = false
    @State private var isShowingProblems = false

    var body: some View {
        Group {
            if library.hasLoaded, library.tutorials.isEmpty {
                emptyState
            } else {
                mainLayout
            }
        }
        .background(Theme.pageBackground.ignoresSafeArea())
        .task {
            guard !library.hasLoaded else { return }
            library.loadBundledTutorials()
            // Acceptance: launch straight into the first tutorial, already drawing.
            if let first = library.tutorials.first {
                select(first)
            }
        }
        .fileImporter(isPresented: $isShowingImporter,
                      allowedContentTypes: [.json],
                      allowsMultipleSelection: false) { result in
            if let imported = library.importTutorial(from: result) {
                select(imported)
            } else {
                isShowingProblems = true
            }
        }
        .sheet(isPresented: $isShowingProblems) {
            TutorialProblemsView(failures: library.failures,
                                 isFullScreen: false,
                                 onDismiss: { isShowingProblems = false })
        }
    }

    // MARK: - Layout

    private var mainLayout: some View {
        VStack(spacing: 0) {
            topBar
            failureBanner
            GeometryReader { geometry in
                if geometry.size.width > geometry.size.height {
                    // iPad landscape: canvas beside the controls.
                    HStack(alignment: .top, spacing: 20) {
                        canvas
                            .frame(maxWidth: .infinity)
                        VStack(spacing: 16) {
                            stepHeader
                            actionArea
                            Spacer(minLength: 0)
                            controlBar
                        }
                        .frame(maxWidth: max(320, geometry.size.width * 0.36))
                    }
                    .padding(20)
                } else {
                    // iPhone portrait: canvas above the controls.
                    //
                    // The canvas is sized explicitly from the space left over,
                    // and the column scrolls. Instruction text comes from
                    // author-supplied JSON and can be any length, so a fixed
                    // layout would eventually clip the controls.
                    VStack(spacing: 0) {
                        ScrollView {
                            VStack(spacing: 14) {
                                canvas
                                    .frame(width: portraitCanvasSide(in: geometry.size),
                                           height: portraitCanvasSide(in: geometry.size))
                                stepHeader
                                actionArea
                            }
                            .frame(maxWidth: .infinity)
                            .padding(20)
                        }
                        .scrollBounceBehavior(.basedOnSize)

                        controlBar
                            .padding(.horizontal, 20)
                            .padding(.bottom, 12)
                    }
                    .animation(.easeInOut(duration: 0.25), value: isCardVisible)
                }
            }
        }
    }

    /// The square canvas edge in portrait: as large as fits once the step
    /// header, the card and the control bar have taken their share. Never
    /// smaller than 220pt, with the scroll view absorbing any overflow.
    private func portraitCanvasSide(in size: CGSize) -> CGFloat {
        let reservedForCard: CGFloat = isCardVisible ? 290 : 60
        let budget = size.height - 40 - 70 - 60 - 42 - reservedForCard
        return max(220, min(size.width - 40, budget))
    }

    /// True when the bottom card is on screen and the canvas must make room.
    private var isCardVisible: Bool {
        !player.isDebugMode && (player.isAwaitingUser || player.isFinished)
    }

    private var canvas: some View {
        Group {
            if let tutorial = player.tutorial {
                DrawingCanvasView(tutorial: tutorial,
                                  phase: player.phase,
                                  strokeProgress: player.strokeProgress,
                                  activeStrokeIndex: player.activeStrokeIndex,
                                  isDebugMode: player.isDebugMode)
            } else {
                RoundedRectangle(cornerRadius: Theme.canvasCornerRadius, style: .continuous)
                    .fill(.white)
                    .overlay(ProgressView())
            }
        }
        .aspectRatio(1, contentMode: .fit)
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(player.tutorial?.title ?? "StrokeTutor")
                    .font(Theme.rounded(24, .heavy))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                if let tutorial = player.tutorial, tutorial.source == .imported {
                    Text("Imported")
                        .font(Theme.rounded(12, .semibold))
                        .foregroundStyle(Theme.accent)
                }
            }

            Spacer(minLength: 8)

            tutorialPicker

            iconButton(systemName: "folder.badge.plus", label: "Import a tutorial from Files") {
                isShowingImporter = true
            }

            iconButton(systemName: player.isDebugMode ? "eye.fill" : "eye",
                       label: "Debug mode",
                       tint: player.isDebugMode ? Theme.accent : Theme.ink) {
                player.isDebugMode.toggle()
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(Color.white.opacity(0.7))
    }

    /// Shown only when a file failed to load, so a bad export is never silent.
    @ViewBuilder
    private var failureBanner: some View {
        if !library.failures.isEmpty {
            Button {
                isShowingProblems = true
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: "exclamationmark.triangle.fill")
                    Text("\(library.failures.count) file\(library.failures.count == 1 ? "" : "s") could not be loaded")
                        .font(Theme.rounded(15, .semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    Spacer(minLength: 0)
                    Text("Details")
                        .font(Theme.rounded(15, .bold))
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .bold))
                }
                .foregroundStyle(Theme.warning)
                .padding(.horizontal, 20)
                .frame(maxWidth: .infinity, minHeight: Theme.minimumTapTarget)
                .background(Theme.warning.opacity(0.12))
            }
            .accessibilityLabel("\(library.failures.count) files could not be loaded. Show details.")
        }
    }

    private var tutorialPicker: some View {
        Menu {
            Section("Included") {
                ForEach(library.tutorials.filter { $0.source == .bundled }) { tutorial in
                    tutorialMenuButton(tutorial)
                }
            }
            let imported = library.tutorials.filter { $0.source == .imported }
            if !imported.isEmpty {
                Section("Imported") {
                    ForEach(imported) { tutorial in
                        tutorialMenuButton(tutorial)
                    }
                }
            }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "square.grid.2x2.fill")
                Image(systemName: "chevron.down")
                    .font(.system(size: 12, weight: .bold))
            }
            .font(.system(size: 22, weight: .semibold))
            .foregroundStyle(Theme.ink)
            .frame(minWidth: Theme.minimumTapTarget, minHeight: Theme.minimumTapTarget)
            .background(
                RoundedRectangle(cornerRadius: Theme.controlCornerRadius, style: .continuous)
                    .fill(.white)
            )
        }
        .accessibilityLabel("Choose a drawing")
    }

    private func tutorialMenuButton(_ tutorial: PreparedTutorial) -> some View {
        Button {
            select(tutorial)
        } label: {
            if tutorial.id == selectedTutorialID {
                Label(tutorial.title, systemImage: "checkmark")
            } else {
                Text(tutorial.title)
            }
        }
    }

    private func iconButton(systemName: String,
                            label: String,
                            tint: Color = Theme.ink,
                            action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: Theme.minimumTapTarget, height: Theme.minimumTapTarget)
                .background(
                    RoundedRectangle(cornerRadius: Theme.controlCornerRadius, style: .continuous)
                        .fill(.white)
                )
        }
        .accessibilityLabel(label)
    }

    // MARK: - Step header

    private var stepHeader: some View {
        VStack(spacing: 12) {
            Text(stepHeaderTitle)
                .font(Theme.rounded(22, .bold))
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.8)

            StepProgressDots(stepCount: player.steps.count,
                             currentIndex: player.currentStepIndex,
                             isFinished: player.isFinished)
        }
        .frame(maxWidth: .infinity)
    }

    private var stepHeaderTitle: String {
        if player.isDebugMode { return "Debug: whole drawing" }
        if player.isFinished { return "Finished!" }
        return player.currentStep?.title ?? ""
    }

    // MARK: - Action area

    @ViewBuilder
    private var actionArea: some View {
        if player.isDebugMode {
            if let tutorial = player.tutorial {
                DebugOverlay(tutorial: tutorial)
            }
        } else if player.isFinished {
            StepInstructionCard(mode: .finished(title: player.tutorial?.title ?? "the drawing"),
                                onPrimary: { player.restart() },
                                onSecondary: nil)
                .transition(.move(edge: .bottom).combined(with: .opacity))
        } else if player.isAwaitingUser, let step = player.currentStep {
            StepInstructionCard(mode: .awaitingUser(stepNumber: player.currentStepIndex + 1,
                                                    stepCount: player.steps.count,
                                                    instruction: step.instruction),
                                onPrimary: { player.advanceToNextStep() },
                                onSecondary: { player.replayCurrentStep() })
                .transition(.move(edge: .bottom).combined(with: .opacity))
        } else {
            // Keep the layout from jumping while a step draws.
            Text("Watch carefully…")
                .font(Theme.rounded(20, .semibold))
                .foregroundStyle(Theme.ink.opacity(0.45))
                .frame(maxWidth: .infinity)
                .frame(minHeight: Theme.minimumTapTarget)
        }
    }

    // MARK: - Control bar

    private var controlBar: some View {
        HStack(spacing: 12) {
            Button {
                player.goToPreviousStep()
            } label: {
                Label("Back", systemImage: "arrow.uturn.backward")
            }
            .buttonStyle(BigSecondaryButtonStyle())
            .disabled(!player.canGoToPreviousStep)
            .opacity(player.canGoToPreviousStep ? 1 : 0.4)
            .accessibilityLabel("Previous step")

            Button {
                player.replayCurrentStep()
            } label: {
                Label("Replay", systemImage: "play.circle.fill")
            }
            .buttonStyle(BigSecondaryButtonStyle())
            .disabled(player.isDebugMode || player.steps.isEmpty)
            .opacity(player.isDebugMode || player.steps.isEmpty ? 0.4 : 1)
            .accessibilityLabel("Replay this step")

            Button {
                player.cycleSpeed()
            } label: {
                Label(player.speedLabel, systemImage: "gauge.with.dots.needle.50percent")
            }
            .buttonStyle(BigSecondaryButtonStyle())
            .accessibilityLabel("Speed \(player.speedLabel). Tap to change.")
        }
    }

    // MARK: - Empty state

    private var emptyState: some View {
        Group {
            if library.failures.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "doc.questionmark")
                        .font(.system(size: 56, weight: .light))
                        .foregroundStyle(Theme.ink.opacity(0.4))
                    Text("No tutorials found")
                        .font(Theme.rounded(26, .heavy))
                        .foregroundStyle(Theme.ink)
                    Text("Add a .json file to the Tutorials folder, or import one from Files.")
                        .font(Theme.rounded(16, .medium))
                        .foregroundStyle(Theme.ink.opacity(0.6))
                        .multilineTextAlignment(.center)
                    Button("Import from Files") { isShowingImporter = true }
                        .buttonStyle(BigSecondaryButtonStyle())
                        .frame(maxWidth: 320)
                }
                .padding(32)
            } else {
                VStack(spacing: 0) {
                    TutorialProblemsView(failures: library.failures, isFullScreen: true)
                    Button("Import from Files") { isShowingImporter = true }
                        .buttonStyle(BigSecondaryButtonStyle())
                        .padding(20)
                }
            }
        }
    }

    // MARK: - Actions

    private func select(_ tutorial: PreparedTutorial) {
        selectedTutorialID = tutorial.id
        player.load(tutorial)
    }
}

#Preview {
    ContentView()
}
