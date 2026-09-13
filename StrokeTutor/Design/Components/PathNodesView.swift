import SwiftUI

/// The path itself (`.path` on `hp-home` and `hp-path`): the lessons as nodes on a
/// gentle zig-zag, rows offset ±40 pt, the label on the outer side. Progress is a
/// column of finished drawings rather than a number.
///
/// The state of each node is derived here from the store, so Home and the path
/// detail can never disagree: a lesson is unlocked when every earlier lesson in the
/// same list has been completed.
struct PathNodesView: View {

    /// How a finished lesson's date is written. Home has little room and says
    /// "Drawn 3 Sep"; the path detail has the width and says "Drawn 3 September".
    enum DateStyle {
        case short
        case long
    }

    let lessons: [Lesson]
    let progress: ProgressStore
    var dateStyle: DateStyle = .short
    let onTap: (Lesson) -> Void

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// Accessibility sizes need the width, so the zig-zag flattens.
    private var offset: CGFloat { dynamicTypeSize.isAccessibilitySize ? 0 : 40 }

    var body: some View {
        VStack(spacing: 22) {
            ForEach(Array(lessons.enumerated()), id: \.element.id) { index, lesson in
                row(for: lesson, at: index)
            }
        }
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func row(for lesson: Lesson, at index: Int) -> some View {
        let state = state(at: index)
        let isRight = index.isMultiple(of: 2) == false
        let node = Button {
            onTap(lesson)
        } label: {
            LessonNode(state: state, drawing: lesson.tutorial)
        }
        .buttonStyle(.plain)

        let label = VStack(alignment: isRight ? .trailing : .leading, spacing: 2) {
            Text(lesson.title)
                .scaledFont(16, .heavy)
                .tracking(-0.2)
                .foregroundStyle(state == .locked ? Theme.ink40 : Theme.ink)
            Text(subtitle(for: lesson, at: index, state: state))
                .textRole(.footnote)
                .foregroundStyle(state == .current ? Theme.green : Theme.ink55)
        }
        .multilineTextAlignment(isRight ? .trailing : .leading)
        .frame(maxWidth: 150, alignment: isRight ? .trailing : .leading)

        HStack(spacing: 14) {
            if isRight {
                label
                node
            } else {
                node
                label
            }
        }
        .offset(x: isRight ? offset : -offset)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel(for: lesson, at: index, state: state))
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Derived state

    private func state(at index: Int) -> LessonNode.State {
        let lesson = lessons[index]
        if progress.isCompleted(lesson.id) { return .done }
        let earlierAllDone = lessons.prefix(index).allSatisfy { progress.isCompleted($0.id) }
        return earlierAllDone ? .current : .locked
    }

    /// The node's own label, spoken with the lesson's place in the path and, when it
    /// is locked, the reason — so no one has to raise the sheet to learn it.
    private func accessibilityLabel(for lesson: Lesson,
                                    at index: Int,
                                    state: LessonNode.State) -> String {
        let place = "lesson \(index + 1) of \(lessons.count)"
        let detail = subtitle(for: lesson, at: index, state: state)
        switch state {
        case .done, .current:
            return "\(lesson.title), \(place). \(detail)."
        case .locked:
            return "\(lesson.title), \(place), locked. \(detail)."
        }
    }

    /// "Drawn 3 Sep" · "Paused at step 9" · "Next · 7 steps" · "After Small Cottage"
    /// · "Lesson 5".
    private func subtitle(for lesson: Lesson, at index: Int, state: LessonNode.State) -> String {
        switch state {
        case .done:
            if let date = progress.progress(for: lesson.id)?.completedAt {
                let formatter = dateStyle == .short ? Self.dayFormatter : Self.longDayFormatter
                return "Drawn \(formatter.string(from: date))"
            }
            return "Drawn"
        case .current:
            // A lesson left part-drawn says where it stopped, not where it starts:
            // "Start here" under a lesson the learner is nine steps into is wrong.
            if let resumeStep = progress.resumeStep(for: lesson.id) {
                return "Paused at step \(resumeStep + 1)"
            }
            let nothingDrawnYet = lessons.allSatisfy { !progress.isCompleted($0.id) }
            return "\(nothingDrawnYet ? "Start here" : "Next") · \(lesson.stepCountText)"
        case .locked:
            let previous = lessons[max(0, index - 1)]
            if index > 0, !progress.isCompleted(previous.id),
               lessons.prefix(index - 1).allSatisfy({ progress.isCompleted($0.id) }) {
                return "After \(previous.title)"
            }
            return "Lesson \(index + 1)"
        }
    }

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("d MMM")
        return formatter
    }()

    private static let longDayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("d MMMM")
        return formatter
    }()
}
