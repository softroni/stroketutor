import SwiftUI

/// `ob-ready` — "Your first lesson is ready." The end of the flow: the chosen path's
/// first lesson draws itself, and there is one way in.
///
/// Not a congratulation — the learner has not done anything yet. One line from Lina,
/// one lesson, one button. There is no way around it: the first lesson is where the
/// guided first run begins (`AppModel.beginFirstRun(with:)`). Only when no lesson is
/// installed does the button become "Continue", so the flow can still end.
struct OnboardingReadyBeat: View {

    let lesson: Lesson?
    let path: PathModel?
    let rail: OnboardingRail
    let onStart: () -> Void
    /// The way out when there is no lesson to start.
    let onContinueWithoutLesson: () -> Void

    @Environment(\.dynamicTypeSize) private var typeSize

    /// 172 pt, down to a 120 pt floor before the body starts scrolling.
    private var canvasHeight: CGFloat { typeSize.isAccessibilitySize ? 120 : 172 }

    var body: some View {
        OnboardingBeatFrame(rail: rail) {
            TutorSays(pose: .pen,
                      text: "Your first lesson is ready. Get your paper, and I'll meet you there.")

            if let lesson {
                lessonCard(lesson)
            } else {
                Text("No lessons are installed.")
                    .textRole(.headline)
                    .foregroundStyle(Theme.ink55)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(Theme.cardPadding)
                    .cardBackground()
            }
        } footer: {
            if lesson != nil {
                Button("Start drawing", action: onStart)
                    .buttonStyle(.primary)
            } else {
                Button("Continue", action: onContinueWithoutLesson)
                    .buttonStyle(.primary)
            }
        }
    }

    // MARK: - The lesson

    private func lessonCard(_ lesson: Lesson) -> some View {
        VStack(alignment: .leading, spacing: Theme.stackSpacing) {
            chipRow {
                Chip(text: path?.title ?? "Lessons",
                     systemImage: path?.onboardingSymbol ?? "scribble",
                     style: .green)
                Chip(text: positionText(for: lesson))
            }

            SelfDrawingView.lesson(lesson.tutorial, duration: 5.3, delay: 0.3)
                .padding(canvasHeight * 0.08)
                .frame(maxWidth: .infinity)
                .frame(height: canvasHeight)
                .background(
                    RoundedRectangle(cornerRadius: Theme.canvasCornerRadius, style: .continuous)
                        .fill(Theme.paper)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.canvasCornerRadius, style: .continuous)
                        .strokeBorder(Theme.line, lineWidth: 2)
                )

            VStack(alignment: .leading, spacing: 4) {
                Text(lesson.title)
                    .textRole(.title2)
                    .foregroundStyle(Theme.ink)
                Text(lesson.objective)
                    .textRole(.subhead)
                    .foregroundStyle(Theme.ink55)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            chipRow {
                Chip(text: lesson.estimatedTimeText, systemImage: "clock")
                Chip(text: lesson.stepCountText)
            }
        }
        .padding(Theme.cardPadding)
        .cardBackground()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(summary(for: lesson))
    }

    /// Two chips side by side, stacked instead when the text will not fit across.
    @ViewBuilder
    private func chipRow<Content: View>(@ViewBuilder _ content: @escaping () -> Content) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) { content() }
            VStack(alignment: .leading, spacing: 8) { content() }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func positionText(for lesson: Lesson) -> String {
        guard let path, let position = path.position(of: lesson.id) else { return "Lesson 1" }
        return "Lesson \(position) of \(path.lessonCount)"
    }

    /// The whole card as one sentence, in the order it is read on screen.
    private func summary(for lesson: Lesson) -> String {
        var parts: [String] = []
        if let path { parts.append(path.title) }
        parts.append(positionText(for: lesson).lowercased())
        return "\(parts.joined(separator: ", ")). \(lesson.title). \(lesson.objective) "
            + "\(lesson.estimatedTimeText), \(lesson.stepCountText)."
    }
}
