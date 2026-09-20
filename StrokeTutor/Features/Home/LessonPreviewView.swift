import SwiftUI

/// `hp-preview` — the last screen before the pen moves, made for a child to read
/// at a glance: one big picture of what they will draw, its name, how long it takes,
/// and Lina showing the three things that happen in every lesson — watch, draw, tap.
/// Her line asks for a pen and paper, because the whole product depends on a sheet
/// being in front of the learner.
///
/// **Default** offers "Start drawing". **Resume** — a run left through the player's
/// leave sheet — shows how far the drawing got, what the next step says, and offers
/// to continue from there or start over.
struct LessonPreviewView: View {
    let lessonId: String

    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

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

        return VStack(spacing: 0) {
            InlineNavBar(title: navTitle(for: lesson)) { dismiss() }

            ScrollView {
                VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                    hero(for: lesson, resumeStep: resumeStep)

                    Text(lesson.title)
                        .textRole(.title1)
                        .foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)

                    chips(for: lesson, resumeStep: resumeStep)
                        .padding(.top, -4)

                    if let resumeStep {
                        StepSegments(stepCount: lesson.stepCount, currentIndex: resumeStep)
                    }

                    if let resumeStep {
                        nextStepCard(for: lesson, resumeStep: resumeStep)
                        needRow
                    } else {
                        tutorLine(for: lesson)
                        howItWorks
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Theme.gutter)
                .padding(.bottom, 8)
            }
            // As a safe-area inset rather than a sibling, so the scroll view knows
            // how tall the pinned buttons are and every last line — "Same pen, same
            // sheet of paper." — can still be scrolled clear of them.
            .safeAreaInset(edge: .bottom, spacing: 0) {
                bottomArea(for: lesson, resumeStep: resumeStep)
            }
        }
    }

    /// "Houses · 3 of 10".
    private func navTitle(for lesson: Lesson) -> String {
        guard let path = app.path(id: lesson.pathId),
              let position = path.position(of: lesson.id) else { return lesson.title }
        return "\(path.title) · \(position) of \(path.lessonCount)"
    }

    // MARK: - The drawing

    /// The finished drawing, alone and as wide as the screen: the one thing a child
    /// wants to know is what they are about to make. A paused lesson says so above
    /// it, because its later steps are faint.
    private func hero(for lesson: Lesson, resumeStep: Int?) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if resumeStep != nil {
                Text("Where you stopped")
                    .textRole(.footnote)
                    .foregroundStyle(Theme.ink55)
            }
            Color.clear
                .aspectRatio(1.3, contentMode: .fit)
                .overlay {
                    DrawingThumbnail(tutorial: lesson.tutorial,
                                     showsFills: true,
                                     fadedFromStep: resumeStep)
                        .padding(16)
                }
                .background(
                    RoundedRectangle(cornerRadius: Theme.canvasCornerRadius, style: .continuous)
                        .fill(Theme.paper)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.canvasCornerRadius, style: .continuous)
                        .strokeBorder(Theme.line, lineWidth: 2)
                )
                .accessibilityElement()
                .accessibilityLabel(resumeStep == nil
                                    ? "The finished drawing of \(lesson.subject)"
                                    : "The drawing so far: \(resumeStep ?? 0) of \(lesson.stepCount) steps in ink, the rest faint")
        }
    }

    // MARK: - Chips

    private func chips(for lesson: Lesson, resumeStep: Int?) -> some View {
        let items: [AnyView]
        if let resumeStep {
            items = [
                AnyView(Chip(text: "Paused at step \(resumeStep + 1) of \(lesson.stepCount)", style: .green)),
                AnyView(Chip(text: "About \(minutesRemaining(of: lesson, from: resumeStep)) min left",
                             systemImage: "clock"))
            ]
        } else {
            // Complexity is shown only when the catalog states it: a made-up "1 of 5"
            // would read as a fact about the drawing that nobody wrote down.
            items = [
                AnyView(Chip(text: lesson.estimatedTimeText, systemImage: "clock", style: .blue)),
                AnyView(Chip(text: lesson.stepCountText, systemImage: "pencil.line", style: .gold))
            ] + (lesson.complexity.map { [AnyView(ComplexityChip(complexity: $0))] } ?? [])
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

    private func tutorLine(for lesson: Lesson) -> some View {
        HStack(alignment: .center, spacing: Theme.stackSpacing) {
            LinaView(pose: .pen, size: 76)
            SpeechBubble(text: "Grab a pen and paper. Let’s draw \(LessonBookend.subject(of: lesson.title))!")
        }
    }

    /// Every lesson in three pictures, so a child who skips the words still knows
    /// what to do. Side by side, or one under the other when the text is large.
    @ViewBuilder
    private var howItWorks: some View {
        let beats: [(symbol: String, text: String, style: Chip.Style)] = [
            ("eye", "Watch me draw", .blue),
            ("pencil", "Draw it on paper", .clay),
            ("hand.tap", "Tap I drew it", .green)
        ]

        if dynamicTypeSize.isAccessibilitySize {
            VStack(spacing: 8) {
                ForEach(beats.indices, id: \.self) { index in
                    HStack(spacing: Theme.stackSpacing) {
                        beatIcon(beats[index].symbol, number: index + 1, style: beats[index].style)
                        beatText(beats[index].text, alignment: .leading)
                    }
                    .padding(12)
                    .background(beatBackground)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(index + 1). \(beats[index].text)")
                }
            }
        } else {
            HStack(alignment: .top, spacing: 8) {
                ForEach(beats.indices, id: \.self) { index in
                    VStack(spacing: 8) {
                        beatIcon(beats[index].symbol, number: index + 1, style: beats[index].style)
                        beatText(beats[index].text, alignment: .center)
                    }
                    .padding(.vertical, 14)
                    .padding(.horizontal, 6)
                    .frame(maxHeight: .infinity, alignment: .top)
                    .background(beatBackground)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(index + 1). \(beats[index].text)")
                }
            }
            .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// The beat's symbol in a soft circle, its number on a small badge at the corner.
    private func beatIcon(_ symbol: String, number: Int, style: Chip.Style) -> some View {
        Circle()
            .fill(style.background)
            .frame(width: 52, height: 52)
            .overlay {
                Image(systemName: symbol)
                    .scaledFont(22, .bold, design: .default)
                    .foregroundStyle(style.foreground)
            }
            .overlay(alignment: .topLeading) {
                Text("\(number)")
                    .scaledFont(12, .bold)
                    .foregroundStyle(.white)
                    .frame(width: 20, height: 20)
                    .background(Circle().fill(style.foreground))
                    .offset(x: -8, y: -6)
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

    private var beatBackground: some View {
        RoundedRectangle(cornerRadius: Theme.controlCornerRadius, style: .continuous)
            .fill(Theme.surface)
    }

    // MARK: - Coming back to a paused lesson

    private func nextStepCard(for lesson: Lesson, resumeStep: Int) -> some View {
        let text = lesson.tutorial.steps.indices.contains(resumeStep)
            ? lesson.tutorial.steps[resumeStep].instruction
            : lesson.objective

        return VStack(alignment: .leading, spacing: 4) {
            Text("Next step".uppercased())
                .textRole(.eyebrow)
                .foregroundStyle(Theme.ink55)
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

/// The complexity chip (`.hp-pips`): five 6 × 12 pt bars, filled up to the lesson's
/// complexity, and the number in words beside them. It describes the drawing, never
/// the learner.
private struct ComplexityChip: View {
    let complexity: Int

    var body: some View {
        HStack(spacing: 6) {
            HStack(spacing: 3) {
                ForEach(1...5, id: \.self) { step in
                    RoundedRectangle(cornerRadius: 2, style: .continuous)
                        .fill(step <= complexity ? Theme.ink70 : Theme.ink12)
                        .frame(width: 6, height: 12)
                }
            }
            Text("Complexity \(complexity) of 5")
                .scaledFont(14, .bold)
        }
        .foregroundStyle(Theme.ink70)
        .padding(.vertical, 7)
        .padding(.horizontal, 12)
        .background(Capsule().fill(Theme.surface))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Complexity \(complexity) of 5")
    }
}

/// A row of chips that wraps instead of shrinking, so a long chip keeps its words at
/// every Dynamic Type size (`.hp-chips`).
private struct WrappingChips: View {
    let items: [AnyView]

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) {
                ForEach(items.indices, id: \.self) { items[$0] }
            }
            VStack(alignment: .leading, spacing: 8) {
                ForEach(items.indices, id: \.self) { items[$0] }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
