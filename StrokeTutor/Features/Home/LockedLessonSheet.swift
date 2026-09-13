import SwiftUI

/// A locked lesson and the one that stands in front of it, as one value, so it can
/// drive a `.sheet(item:)` from either `hp-home` or `hp-path`.
struct LockedLesson: Identifiable {
    /// The node the learner tapped.
    let lesson: Lesson
    /// The first lesson before it that is not finished — the one to go and draw.
    let blocking: Lesson
    /// The locked lesson's one-based place in its path, for "Lesson 4 · …".
    let position: Int

    var id: String { lesson.id }
}

/// The locked sheet of `hp-path`: the drawing greyed in a 72 pt tile, the lesson's
/// place, "Finish <previous> first.", one line on why, and two ways out.
///
/// There is no unlock offer and no price. Locking is a teaching decision — a lesson
/// reuses what the one before it taught — so the only honest answer is the lesson
/// that comes first (BRIEF §6).
struct LockedLessonSheet: View {
    let locked: Lesson
    let blocking: Lesson
    let position: Int
    let onGo: (Lesson) -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.stackSpacing) {
            HStack(alignment: .center, spacing: 14) {
                DrawingThumbnail(tutorial: locked.tutorial, size: 58, strokeColor: Theme.ink40)
                    .frame(width: 72, height: 72)
                    .background(
                        RoundedRectangle(cornerRadius: Theme.thumbCornerRadius, style: .continuous)
                            .fill(Theme.surface)
                    )

                VStack(alignment: .leading, spacing: 4) {
                    Text("Lesson \(position) · \(locked.title)".uppercased())
                        .textRole(.eyebrow)
                        .foregroundStyle(Theme.ink55)
                    Text("Finish \(blocking.title) first.")
                        .textRole(.title2)
                        .foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            // Why, in the lesson's own words: the catalog's objective is the single
            // new idea it teaches, which is exactly what the order protects.
            Text("Lessons build on each other. \(locked.objective)")
                .textRole(.bodyRegular)
                .foregroundStyle(Theme.ink55)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)

            Button("Go to \(blocking.title)") { onGo(blocking) }
                .buttonStyle(.primary)
                .padding(.top, 4)

            Button("Not now", action: onDismiss)
                .buttonStyle(.quiet)
                .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, Theme.gutter)
        .padding(.top, Theme.stackSpacing)
        .padding(.bottom, Theme.stackSpacing)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Theme.card)
        .presentationDetents([.height(340)])
        .presentationDragIndicator(.visible)
        .accessibilityAddTraits(.isModal)
    }
}
