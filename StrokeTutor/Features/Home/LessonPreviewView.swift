import SwiftUI

/// `hp-preview` — the last screen before the pen moves: the real thing and the
/// finished drawing side by side, how long it takes, and the one idea the lesson
/// teaches. Plus the honest line about paper, because the whole product depends on
/// a sheet being in front of the learner.
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
        // The primary owns the bottom of this screen, so the tab bar steps aside.
        .hidesTabBar()
    }

    // MARK: - The screen

    private func content(for lesson: Lesson) -> some View {
        let resumeStep = app.progress.resumeStep(for: lesson.id)

        return VStack(spacing: 0) {
            InlineNavBar(title: navTitle(for: lesson)) { dismiss() }

            ScrollView {
                VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                    pair(for: lesson, resumeStep: resumeStep)

                    if let credit = photoCredit(for: lesson) {
                        Text(credit)
                            .textRole(.footnote)
                            .foregroundStyle(Theme.ink40)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.top, -4)
                    }

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

                    objectiveCard(for: lesson, resumeStep: resumeStep)

                    needRow(isResuming: resumeStep != nil)

                    if resumeStep == nil {
                        tutorLine
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Theme.gutter)
                .padding(.bottom, 8)
            }

            bottomArea(for: lesson, resumeStep: resumeStep)
        }
    }

    /// "Houses · 3 of 10".
    private func navTitle(for lesson: Lesson) -> String {
        guard let path = app.path(id: lesson.pathId),
              let position = path.position(of: lesson.id) else { return lesson.title }
        return "\(path.title) · \(position) of \(path.lessonCount)"
    }

    // MARK: - The pair

    /// Reference left, the finished drawing right, two square tiles 12 pt apart. A
    /// lesson with no reference photo shows one full-width drawing and no credit
    /// line — an empty grey tile would say nothing.
    @ViewBuilder
    private func pair(for lesson: Lesson, resumeStep: Int?) -> some View {
        let drawingLabel = resumeStep == nil ? "What you will draw" : "Where you stopped"

        if lesson.reference == nil {
            tile(label: drawingLabel) { drawingTile(for: lesson, resumeStep: resumeStep) }
        } else if dynamicTypeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                tile(label: "The real thing") { referenceTile(for: lesson) }
                tile(label: drawingLabel) { drawingTile(for: lesson, resumeStep: resumeStep) }
            }
        } else {
            HStack(alignment: .top, spacing: Theme.stackSpacing) {
                tile(label: "The real thing") { referenceTile(for: lesson) }
                tile(label: drawingLabel) { drawingTile(for: lesson, resumeStep: resumeStep) }
            }
        }
    }

    private func tile<Content: View>(label: String,
                                     @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .textRole(.footnote)
                .foregroundStyle(Theme.ink55)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func referenceTile(for lesson: Lesson) -> some View {
        Color.clear
            .aspectRatio(1, contentMode: .fit)
            .overlay { ReferenceImageView(reference: lesson.reference, contentMode: .fill) }
            .clipShape(RoundedRectangle(cornerRadius: Theme.thumbCornerRadius, style: .continuous))
            .accessibilityElement()
            .accessibilityLabel("A photograph of the subject: \(lesson.title)")
    }

    private func drawingTile(for lesson: Lesson, resumeStep: Int?) -> some View {
        Color.clear
            .aspectRatio(1, contentMode: .fit)
            .overlay {
                DrawingThumbnail(tutorial: lesson.tutorial,
                                 showsFills: true,
                                 fadedFromStep: resumeStep)
                    .padding(14)
            }
            .background(
                RoundedRectangle(cornerRadius: Theme.thumbCornerRadius, style: .continuous)
                    .fill(Theme.paper)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Theme.thumbCornerRadius, style: .continuous)
                    .strokeBorder(Theme.line, lineWidth: 2)
            )
            .accessibilityElement()
            .accessibilityLabel(resumeStep == nil
                                ? "The finished pen drawing of \(lesson.subject)"
                                : "The drawing so far: \(resumeStep ?? 0) of \(lesson.stepCount) steps in ink, the rest faint")
    }

    /// "Photo: Pixabay · Free licence", from the catalog's own `source` and
    /// `license`. A source given as a link is credited by its site, so the line
    /// stays one line and still names where the photo came from.
    private func photoCredit(for lesson: Lesson) -> String? {
        guard let reference = lesson.reference else { return nil }
        let source = Self.creditName(for: reference.source)
        return "Photo: \(source) · \(reference.license)"
    }

    private static func creditName(for source: String) -> String {
        guard let host = URL(string: source)?.host else {
            return source.prefix(1).uppercased() + source.dropFirst()
        }
        return host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
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
                AnyView(Chip(text: "\(lesson.estimatedTimeText) · \(lesson.stepCountText)",
                             systemImage: "clock"))
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

    // MARK: - Objective, paper, tutor

    private func objectiveCard(for lesson: Lesson, resumeStep: Int?) -> some View {
        let isResuming = resumeStep != nil
        let text: String = {
            guard let resumeStep, lesson.tutorial.steps.indices.contains(resumeStep) else {
                return lesson.objective
            }
            return lesson.tutorial.steps[resumeStep].instruction
        }()

        return VStack(alignment: .leading, spacing: 4) {
            Text((isResuming ? "Next step" : "What this teaches").uppercased())
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

    private func needRow(isResuming: Bool) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "pencil")
                .scaledFont(19, .semibold, design: .default)
            Image(systemName: "doc")
                .scaledFont(19, .semibold, design: .default)
            Text(isResuming
                 ? "Same pen, same sheet of paper."
                 : "You need a pen and a sheet of paper.")
                .textRole(.subhead)
                .fixedSize(horizontal: false, vertical: true)
        }
        .foregroundStyle(Theme.ink70)
        .padding(.horizontal, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private var tutorLine: some View {
        HStack(alignment: .center, spacing: Theme.stackSpacing) {
            LinaView(pose: .pen, size: 76)
            SpeechBubble(text: "I draw one step, then wait. You copy it, then tap I drew it.")
        }
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
        .background(Theme.page)
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
