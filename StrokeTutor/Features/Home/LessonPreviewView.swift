import SwiftUI

/// `hp-preview` — the last screen before the pen moves, made for a child to take in
/// at a glance. Almost all of it is one big card in the lesson's path color
/// (`PathTint`, as on the Path screen): the drawing on a white sheet, drawing itself
/// once as a short "watch me draw" teaser, its name, and two short chips — "3 min"
/// and "10 steps". Under it Lina asks for a pen and paper, because the whole product
/// depends on a sheet being in front of the learner, and a new learner also sees the
/// three things that happen in every lesson — watch, draw, tap — as three colored
/// tiles. After three finished lessons the routine is known, the tiles go, and the
/// picture takes their room.
///
/// The picture takes whatever height is left above the pinned button (within a
/// sensible minimum and maximum), so the screen never ends in an empty gap. At
/// accessibility text sizes it keeps its minimum and the screen scrolls.
///
/// **Default** offers "Start drawing"; tapping the picture replays the teaser, and
/// Reduce Motion shows it finished. **Resume** — a run left through the player's
/// leave sheet — shows how far the drawing got (the rest faint, never animated), the
/// step bars, what the next step says, and offers to continue or start over.
struct LessonPreviewView: View {
    let lessonId: String

    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Bumped by a tap on the picture, which draws it again from the start.
    @State private var replayToken = 0
    /// True while the teaser is drawing; the replay badge waits until it is done.
    @State private var isDrawing = false
    /// Measured, so the picture can take exactly the height that is left over.
    @State private var contentHeight: CGFloat = 0
    @State private var paperHeight: CGFloat = 0
    @State private var bottomHeight: CGFloat = 0
    /// The "how it works" circles grow with the text, to a limit, so the symbol and
    /// its number badge stay inside them at every size.
    @ScaledMetric(relativeTo: .body) private var beatCircleSize: CGFloat = 58
    @ScaledMetric(relativeTo: .body) private var beatBadgeSize: CGFloat = 22

    /// Lessons finished before "how a lesson works" stops being shown.
    static let newLearnerLessonCount = 3

    var body: some View {
        Group {
            if let lesson = app.lesson(id: lessonId) {
                content(for: lesson)
            } else {
                missingLesson
            }
        }
        .background(Theme.page)
        .toolbar(.hidden, for: .navigationBar)
    }

    // MARK: - The screen

    private func content(for lesson: Lesson) -> some View {
        let resumeStep = app.progress.resumeStep(for: lesson.id)
        let tint = tint(for: lesson)
        let showsHowItWorks = resumeStep == nil
            && app.progress.completedCount < Self.newLearnerLessonCount

        return VStack(spacing: 0) {
            InlineNavBar(title: navTitle(for: lesson)) { dismiss() }

            GeometryReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        hero(for: lesson,
                             resumeStep: resumeStep,
                             tint: tint,
                             pictureHeight: pictureHeight(in: proxy.size))

                        if let resumeStep {
                            StepSegments(stepCount: lesson.stepCount, currentIndex: resumeStep)
                                .padding(.horizontal, 4)
                            nextStepCard(for: lesson, resumeStep: resumeStep, tint: tint)
                            needRow
                        } else {
                            tutorLine(for: lesson)
                            if showsHowItWorks { howItWorks }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, Theme.gutter)
                    .padding(.top, 4)
                    // Clear of the soft fade above the pinned button.
                    .padding(.bottom, 16)
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: {
                        contentHeight = $0
                    }
                }
                .scrollBounceBehavior(.basedOnSize)
                // As a safe-area inset rather than a sibling, so the scroll view knows
                // how tall the pinned buttons are and every last line — "Same pen, same
                // sheet of paper." — can still be scrolled clear of them.
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    bottomArea(for: lesson, resumeStep: resumeStep)
                        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: {
                            bottomHeight = $0
                        }
                }
            }
        }
    }

    /// "In the Air · 1 of 10".
    private func navTitle(for lesson: Lesson) -> String {
        guard let path = app.path(id: lesson.pathId),
              let position = path.position(of: lesson.id) else { return lesson.title }
        return "\(path.title) · \(position) of \(path.lessonCount)"
    }

    private func tint(for lesson: Lesson) -> PathTint {
        app.path(id: lesson.pathId).map { app.tint(for: $0) } ?? PathTint.forPath(at: 0)
    }

    /// The picture's height: everything else on the screen is measured, and the
    /// picture takes what is left above the pinned button — never smaller than a
    /// comfortable half its width, never taller than 1.25 times it (or 540 pt on
    /// an iPad), so a wide drawing does not float in a tall empty sheet.
    private func pictureHeight(in size: CGSize) -> CGFloat {
        let width = max(size.width - 2 * Theme.gutter - 20, 1)
        let minimum = max(160, (width * 0.5).rounded())
        let maximum = max(minimum, min(width * 1.25, 540))
        guard contentHeight > 0 else { return minimum }
        let others = contentHeight - paperHeight
        let visible = size.height - bottomHeight
        return min(max((visible - others).rounded(.down), minimum), maximum)
    }

    // MARK: - The hero

    /// The lesson as one card in its path's color, like the Path screen's hero: the
    /// drawing on a white sheet inset in the tint, a 4 pt deeper edge under it, and
    /// the lesson's name and chips on the tint below the sheet.
    private func hero(for lesson: Lesson,
                      resumeStep: Int?,
                      tint: PathTint,
                      pictureHeight: CGFloat) -> some View {
        let shape = RoundedRectangle(cornerRadius: Theme.canvasCornerRadius, style: .continuous)

        return VStack(spacing: 12) {
            paper(for: lesson, resumeStep: resumeStep, tint: tint)
                .frame(height: pictureHeight)
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: {
                    paperHeight = $0
                }

            VStack(spacing: 10) {
                Text(lesson.title)
                    .textRole(.title1)
                    .foregroundStyle(Theme.ink)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity)
                    .accessibilityAddTraits(.isHeader)

                chips(for: lesson, resumeStep: resumeStep, tint: tint)
            }
            .padding(.horizontal, 8)
        }
        .padding(.init(top: 10, leading: 10, bottom: 16, trailing: 10))
        .background(shape.fill(tint.soft))
        .background(alignment: .bottom) {
            shape.fill(tint.edge).offset(y: 4)
        }
        .padding(.bottom, 4)
    }

    /// The white sheet. By default the drawing draws itself once, in its own colors,
    /// and a tap replays it (a small replay badge says so once it has landed). A
    /// paused lesson shows its drawing still, the steps not yet drawn faint.
    @ViewBuilder
    private func paper(for lesson: Lesson, resumeStep: Int?, tint: PathTint) -> some View {
        let panel = RoundedRectangle(cornerRadius: Theme.canvasCornerRadius - 10, style: .continuous)

        if let resumeStep {
            DrawingThumbnail(tutorial: lesson.tutorial,
                             strokeColor: nil,
                             showsFills: true,
                             fadedFromStep: resumeStep)
                .padding(20)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(panel.fill(Theme.paper))
                .accessibilityElement()
                .accessibilityLabel("The drawing so far: \(resumeStep) of \(lesson.stepCount) steps in ink, the rest faint")
        } else {
            let canReplay = !reduceMotion
            teaser(for: lesson)
                .padding(20)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(panel.fill(Theme.paper))
                .overlay(alignment: .bottomTrailing) {
                    if canReplay && !isDrawing {
                        replayBadge(tint: tint)
                            .padding(10)
                            .transition(.opacity)
                    }
                }
                .animation(.easeOut(duration: 0.25), value: isDrawing)
                .contentShape(panel)
                .onTapGesture { if canReplay { replayToken += 1 } }
                .task(id: replayToken) { await trackDrawing(of: lesson) }
                .accessibilityElement()
                .accessibilityLabel("The finished drawing of \(lesson.subject)")
                .accessibilityHint(canReplay ? "Double-tap to watch it draw itself again." : "")
                .accessibilityAddTraits(canReplay ? .isButton : [])
                .accessibilityAction { if canReplay { replayToken += 1 } }
        }
    }

    /// The lesson drawing itself: a short pause, then the lines over a couple of
    /// seconds whatever the lesson's length (1.5 s for a handful of strokes, never
    /// more than 3 s), each step's color washing in as its last line lands.
    private func teaserDrawing(for lesson: Lesson) -> SelfDrawingView {
        let strokeCount = lesson.tutorial.steps.reduce(0) { $0 + $1.strokes.count }
        let seconds = min(3, max(1.5, Double(strokeCount) * 0.12))
        return SelfDrawingView.coloredLesson(lesson.tutorial,
                                             duration: seconds,
                                             delay: 0.35,
                                             replayToken: replayToken)
    }

    @ViewBuilder
    private func teaser(for lesson: Lesson) -> some View {
        teaserDrawing(for: lesson)
            .environment(\.onboardingReducesMotion, reduceMotion)
    }

    /// Mirrors the teaser's own timeline, so the replay badge appears as it lands.
    private func trackDrawing(of lesson: Lesson) async {
        guard !reduceMotion else {
            isDrawing = false
            return
        }
        isDrawing = true
        try? await Task.sleep(for: .seconds(teaserDrawing(for: lesson).totalDuration))
        guard !Task.isCancelled else { return }
        isDrawing = false
    }

    private func replayBadge(tint: PathTint) -> some View {
        Image(systemName: "arrow.counterclockwise")
            .scaledFont(15, .heavy, design: .default)
            .foregroundStyle(tint.deep)
            .frame(width: 36, height: 36)
            .background(Circle().fill(tint.soft))
            .accessibilityHidden(true)
    }

    // MARK: - Chips

    /// Two short facts in the path's color: "3 min" and "10 steps", or for a paused
    /// lesson "Step 6 of 10" and "2 min left". Complexity joins them only when the
    /// catalog states it: a made-up "1 of 5" would read as a fact about the drawing
    /// that nobody wrote down.
    private func chips(for lesson: Lesson, resumeStep: Int?, tint: PathTint) -> some View {
        let items: [AnyView]
        if let resumeStep {
            let left = minutesRemaining(of: lesson, from: resumeStep)
            items = [
                AnyView(TintChip(text: "Step \(resumeStep + 1) of \(lesson.stepCount)",
                                 systemImage: "pause.fill",
                                 tint: tint,
                                 accessibilityText: "Paused at step \(resumeStep + 1) of \(lesson.stepCount)")),
                AnyView(TintChip(text: "\(left) min left",
                                 systemImage: "clock.fill",
                                 tint: tint,
                                 accessibilityText: "About \(left) \(left == 1 ? "minute" : "minutes") left"))
            ]
        } else {
            let minutes = lesson.estimatedMinutes
            items = [
                AnyView(TintChip(text: "\(minutes) min",
                                 systemImage: "clock.fill",
                                 tint: tint,
                                 accessibilityText: "About \(minutes) \(minutes == 1 ? "minute" : "minutes")")),
                AnyView(TintChip(text: lesson.stepCountText,
                                 systemImage: "pencil.line",
                                 tint: tint))
            ] + (lesson.complexity.map { [AnyView(ComplexityChip(complexity: $0, tint: tint))] } ?? [])
        }
        return WrappingChips(items: items)
    }

    /// The same estimate as `Lesson.estimatedMinutes`, over the steps that are left.
    private func minutesRemaining(of lesson: Lesson, from stepIndex: Int) -> Int {
        let remaining = lesson.tutorial.steps.dropFirst(stepIndex)
        let drawing = remaining.reduce(0.0) { total, step in
            total + step.strokes.reduce(0.0) { $0 + $1.duration }
        }
        let seconds = drawing * 3 + 8 * Double(remaining.count)
        return max(1, Int(ceil(seconds / 60)))
    }

    // MARK: - Lina and how a lesson works

    /// Lina's one line, which asks for the pen and paper.
    private func tutorLine(for lesson: Lesson) -> some View {
        HStack(alignment: .center, spacing: Theme.stackSpacing + 2) {
            LinaView(pose: .pen, size: dynamicTypeSize.isAccessibilitySize ? 56 : 68)
            SpeechBubble(text: "Grab a pen and paper. Let’s draw \(LessonBookend.subject(of: lesson.title))!")
        }
        .padding(.leading, 2)
    }

    /// Every lesson in three pictures, each on its own soft color, so a child who
    /// skips the words still knows what to do. Shown only to a new learner (fewer
    /// than `newLearnerLessonCount` lessons finished). Side by side, or one under the
    /// other when the text is large.
    @ViewBuilder
    private var howItWorks: some View {
        let beats: [(symbol: String, text: String, spoken: String, style: Chip.Style)] = [
            ("eye.fill", "Watch", "Watch me draw", .blue),
            ("pencil", "Draw on paper", "Draw it on paper", .clay),
            ("hand.tap.fill", "I drew it!", "Tap I drew it", .green)
        ]

        if dynamicTypeSize.isAccessibilitySize {
            VStack(spacing: 8) {
                ForEach(beats.indices, id: \.self) { index in
                    HStack(spacing: Theme.stackSpacing) {
                        beatIcon(beats[index].symbol, number: index + 1, style: beats[index].style)
                        beatText(beats[index].text, alignment: .leading)
                    }
                    .padding(12)
                    .background(beatBackground(beats[index].style))
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(index + 1). \(beats[index].spoken)")
                }
            }
        } else {
            HStack(alignment: .top, spacing: 8) {
                ForEach(beats.indices, id: \.self) { index in
                    VStack(spacing: 8) {
                        beatIcon(beats[index].symbol, number: index + 1, style: beats[index].style)
                        beatText(beats[index].text, alignment: .center)
                    }
                    .padding(.top, 14)
                    .padding(.bottom, 12)
                    .padding(.horizontal, 6)
                    .frame(maxHeight: .infinity, alignment: .top)
                    .background(beatBackground(beats[index].style))
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(index + 1). \(beats[index].spoken)")
                }
            }
            .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// The beat's symbol in a white circle on the tile's soft color, its number on a
    /// badge in the tile's own color at the corner.
    private func beatIcon(_ symbol: String, number: Int, style: Chip.Style) -> some View {
        let circle = min(beatCircleSize, 88)
        let badge = min(beatBadgeSize, 34)
        return Circle()
            .fill(Theme.paper)
            .frame(width: circle, height: circle)
            .overlay {
                Image(systemName: symbol)
                    .font(.system(size: circle * 0.45, weight: .bold))
                    .foregroundStyle(style.foreground)
            }
            .overlay(alignment: .topLeading) {
                Text("\(number)")
                    .font(.system(size: badge * 0.6, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
                    .frame(width: badge, height: badge)
                    .background(Circle().fill(style.foreground))
                    .offset(x: -badge * 0.27, y: -badge * 0.18)
            }
    }

    private func beatText(_ text: String, alignment: Alignment) -> some View {
        Text(text)
            .scaledFont(15, .bold)
            .foregroundStyle(Theme.ink)
            .multilineTextAlignment(alignment == .center ? .center : .leading)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: alignment)
    }

    private func beatBackground(_ style: Chip.Style) -> some View {
        RoundedRectangle(cornerRadius: Theme.controlCornerRadius, style: .continuous)
            .fill(style.background)
    }

    // MARK: - Coming back to a paused lesson

    private func nextStepCard(for lesson: Lesson, resumeStep: Int, tint: PathTint) -> some View {
        let text = lesson.tutorial.steps.indices.contains(resumeStep)
            ? lesson.tutorial.steps[resumeStep].instruction
            : lesson.objective

        return VStack(alignment: .leading, spacing: 4) {
            Text("Next step".uppercased())
                .textRole(.eyebrow)
                .foregroundStyle(tint.deep)
            Text(text)
                .textRole(.body)
                .foregroundStyle(Theme.ink)
                .lineSpacing(7)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 16)
        .padding(.horizontal, 18)
        .background(
            RoundedRectangle(cornerRadius: Theme.cardCornerRadius, style: .continuous)
                .fill(Theme.surface)
        )
        .accessibilityElement(children: .combine)
    }

    private var needRow: some View {
        HStack(spacing: 10) {
            Image(systemName: "pencil")
                .scaledFont(19, .semibold, design: .default)
            Image(systemName: "doc")
                .scaledFont(19, .semibold, design: .default)
            Text("Same pen, same sheet of paper.")
                .textRole(.subhead)
                .fixedSize(horizontal: false, vertical: true)
        }
        .foregroundStyle(Theme.ink70)
        .padding(.horizontal, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    // MARK: - The bottom

    /// The primary never scrolls: on the smallest phone it is still on screen.
    private func bottomArea(for lesson: Lesson, resumeStep: Int?) -> some View {
        VStack(spacing: Theme.stackSpacing) {
            if let resumeStep {
                Button("Continue from step \(resumeStep + 1)") {
                    app.presentPlayer(lesson, resumeFrom: resumeStep)
                }
                .buttonStyle(.primary)

                Button("Start over") {
                    app.progress.clearResume(lesson.id)
                    app.presentPlayer(lesson)
                }
                .buttonStyle(.quiet)
                .frame(maxWidth: .infinity)
            } else {
                Button("Start drawing") { app.presentPlayer(lesson) }
                    .buttonStyle(.primary)
            }
        }
        .padding(.horizontal, Theme.gutter)
        .padding(.top, Theme.stackSpacing)
        .padding(.bottom, Theme.stackSpacing)
        .background(alignment: .top) {
            Theme.page
                // A soft edge above the buttons, so a line scrolling under them
                // fades out rather than being cut off in mid-word.
                .overlay(alignment: .top) {
                    LinearGradient(colors: [Theme.page.opacity(0), Theme.page],
                                   startPoint: .top,
                                   endPoint: .bottom)
                        .frame(height: 16)
                        .offset(y: -16)
                }
                // Down past the home indicator too, so a page scrolled under the
                // buttons never shows through beneath them.
                .ignoresSafeArea(edges: .bottom)
        }
    }

    private var missingLesson: some View {
        VStack(spacing: 0) {
            InlineNavBar(title: "Lesson") { dismiss() }
            Text("This lesson is no longer installed.")
                .textRole(.body)
                .foregroundStyle(Theme.ink55)
                .padding(Theme.gutter)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
    }
}

/// A short fact on the hero's tint: a white capsule with an icon and a few words in
/// the path's deep color. 15/bold, a touch bigger than `Chip`, since these are the
/// only words on the card besides the title.
private struct TintChip: View {
    let text: String
    let systemImage: String
    let tint: PathTint
    /// What VoiceOver reads, when "3 min" deserves full words.
    var accessibilityText: String?

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: systemImage)
                .scaledFont(14, .heavy, design: .default)
            Text(text)
                .scaledFont(15, .heavy)
        }
        .foregroundStyle(tint.deep)
        .padding(.vertical, 8)
        .padding(.horizontal, 14)
        .background(Capsule().fill(Theme.paper))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText ?? text)
    }
}

/// The complexity chip (`.hp-pips`): five 6 × 12 pt bars, filled up to the lesson's
/// complexity, on the same white capsule as the other chips. Only VoiceOver hears the
/// number in words. It describes the drawing, never the learner.
private struct ComplexityChip: View {
    let complexity: Int
    let tint: PathTint

    var body: some View {
        HStack(spacing: 3) {
            ForEach(1...5, id: \.self) { step in
                RoundedRectangle(cornerRadius: 2, style: .continuous)
                    .fill(step <= complexity ? tint.deep : tint.edge)
                    .frame(width: 6, height: 12)
            }
        }
        .padding(.vertical, 11)
        .padding(.horizontal, 14)
        .background(Capsule().fill(Theme.paper))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Complexity \(complexity) of 5")
    }
}

/// A row of chips that wraps instead of shrinking, so a chip keeps its words at
/// every Dynamic Type size (`.hp-chips`). Centered under the lesson's name.
private struct WrappingChips: View {
    let items: [AnyView]

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) {
                ForEach(items.indices, id: \.self) { items[$0] }
            }
            VStack(alignment: .center, spacing: 8) {
                ForEach(items.indices, id: \.self) { items[$0] }
            }
        }
        .frame(maxWidth: .infinity, alignment: .center)
    }
}
