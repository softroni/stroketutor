import SwiftUI

/// The path itself (`.path` on `hp-home` and `hp-path`): the lessons as nodes on a
/// gentle zig-zag, rows offset ±40 pt, the label on the outer side. Progress is a
/// column of finished drawings rather than a number.
///
/// The state of each node is derived here from the store, so Home and the path
/// detail can never disagree: a lesson is unlocked when every earlier lesson in the
/// same list has been completed.
struct PathNodesView: View {
    let lessons: [Lesson]
    let progress: ProgressStore
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
                .font(.system(size: 16, weight: .heavy, design: .rounded))
                .tracking(-0.2)
                .foregroundStyle(state == .locked ? Theme.ink40 : Theme.ink)
            Text(subtitle(for: lesson, at: index, state: state))
                .font(.system(size: 13, weight: .semibold, design: .rounded))
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
        .accessibilityLabel("\(lesson.title). \(subtitle(for: lesson, at: index, state: state))")
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Derived state

    private func state(at index: Int) -> LessonNode.State {
        let lesson = lessons[index]
        if progress.isCompleted(lesson.id) { return .done }
        let earlierAllDone = lessons.prefix(index).allSatisfy { progress.isCompleted($0.id) }
        return earlierAllDone ? .current : .locked
    }

    /// "Drawn 3 Sep" · "Next · 7 steps" · "After Small Cottage" · "Lesson 5".
    private func subtitle(for lesson: Lesson, at index: Int, state: LessonNode.State) -> String {
        switch state {
        case .done:
            if let date = progress.progress(for: lesson.id)?.completedAt {
                return "Drawn \(Self.dayFormatter.string(from: date))"
            }
            return "Drawn"
        case .current:
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
}
