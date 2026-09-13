import SwiftUI

/// `hp-path` — one path: where it leads drawn large at the top, what it is, how far
/// through it the learner is, and every lesson as a node.
///
/// Three states. **Default** shows the destination on white paper, the count and the
/// next lesson. **Locked** is the same screen with the sheet up, raised by tapping a
/// grey node (or handed over by Home). **Complete** turns the destination gold, says
/// so in one sentence, and offers somewhere to go next.
struct PathDetailView: View {
    let pathId: String

    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var lockedLesson: LockedLesson?

    var body: some View {
        Group {
            if let path = app.path(id: pathId), !path.isEmpty {
                content(for: path)
            } else {
                missingPath
            }
        }
        .background(Theme.page)
        .toolbar(.hidden, for: .navigationBar)
        .sheet(item: $lockedLesson) { locked in
            LockedLessonSheet(locked: locked.lesson,
                              blocking: locked.blocking,
                              position: locked.position,
                              onGo: { lesson in
                                  lockedLesson = nil
                                  app.showPreview(of: lesson)
                              },
                              onDismiss: { lockedLesson = nil })
        }
    }

    // MARK: - The screen

    private func content(for path: PathModel) -> some View {
        let drawn = app.progress.drawnCount(in: path)
        let isComplete = drawn == path.lessonCount

        return VStack(spacing: 0) {
            InlineNavBar(title: path.title) { dismiss() }

            ScrollView {
                VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                    destination(for: path, isComplete: isComplete)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(isComplete
                             ? "You have drawn every \(PathCopy.subject(of: path)) in this path."
                             : path.title)
                            .textRole(.title1)
                            .foregroundStyle(Theme.ink)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityAddTraits(.isHeader)

                        if let description = path.description {
                            Text(description)
                                .textRole(.subhead)
                                .foregroundStyle(Theme.ink55)
                                .lineSpacing(5)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }

                    if isComplete {
                        completeActions(for: path)
                    } else {
                        progressBlock(for: path, drawn: drawn)
                    }

                    PathNodesView(lessons: path.lessons,
                                  progress: app.progress,
                                  dateStyle: .long) { lesson in
                        open(lesson, in: path)
                    }

                    if !isComplete {
                        Text("Lessons open one after another. Each one reuses what the last one taught.")
                            .textRole(.footnote)
                            .foregroundStyle(Theme.ink40)
                            .multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.horizontal, 12)
                            .frame(maxWidth: .infinity)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Theme.gutter)
                .padding(.bottom, 16)
            }
        }
        .onAppear { raiseSheetIfHandedOver(in: path) }
    }

    /// Where the path leads, on a wide sheet of paper: the last lesson's drawing at
    /// 200 pt with a gold chip on it. Not tappable — it would land on a locked
    /// lesson, and the nodes below already offer everything that is open.
    private func destination(for path: PathModel, isComplete: Bool) -> some View {
        let last = path.lessons.last
        let position = path.lessonCount
        let drawnDate = last.flatMap { app.progress.progress(for: $0.id)?.completedAt }

        return RoundedRectangle(cornerRadius: Theme.canvasCornerRadius, style: .continuous)
            .fill(isComplete ? Theme.goldSoft : Theme.paper)
            .frame(height: 214)
            // The drawing is fitted to its own bounds, so unlike the mockup's
            // street scene it fills whatever box it is given right to the edges.
            // It therefore takes the band *between* the chip and the label rather
            // than the whole card, and nothing is ever drawn under either of them.
            .overlay {
                DrawingThumbnail(tutorial: last?.tutorial,
                                 strokeColor: isComplete ? Theme.goldDeep : Theme.ink)
                    .padding(.top, 44)
                    .padding(.bottom, 34)
                    .padding(.horizontal, 16)
            }
            .overlay(alignment: .topLeading) {
                Chip(text: isComplete
                     ? "\(path.lessonCount) of \(path.lessonCount) drawn"
                     : "Where this path leads",
                     systemImage: isComplete ? "checkmark" : nil,
                     style: .gold)
                    .padding(14)
            }
            .overlay(alignment: .bottomLeading) {
                Text(destinationLabel(for: last,
                                      position: position,
                                      isComplete: isComplete,
                                      drawnDate: drawnDate))
                    .textRole(.footnote)
                    .foregroundStyle(isComplete ? Theme.goldDeep : Theme.ink55)
                    .lineLimit(1)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 12)
            }
            .overlay {
                if !isComplete {
                    RoundedRectangle(cornerRadius: Theme.canvasCornerRadius, style: .continuous)
                        .strokeBorder(Theme.line, lineWidth: 2)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: Theme.canvasCornerRadius, style: .continuous))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(isComplete
                                ? "Every lesson drawn. \(last?.title ?? "")"
                                : "Where this path leads: \(last?.title ?? "")")
    }

    private func destinationLabel(for lesson: Lesson?,
                                  position: Int,
                                  isComplete: Bool,
                                  drawnDate: Date?) -> String {
        guard let lesson else { return "" }
        if isComplete, let drawnDate {
            return "\(lesson.title) · Drawn \(Self.longDate.string(from: drawnDate))"
        }
        return "Lesson \(position) · \(lesson.title)"
    }

    /// "2 of 10 drawn" with the next lesson beside it, over a 12 pt green bar. A
    /// count of finished drawings, never a percentage and never a target.
    private func progressBlock(for path: PathModel, drawn: Int) -> some View {
        let next = app.progress.nextLesson(in: path)
        return VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("\(drawn) of \(path.lessonCount) drawn")
                    .textRole(.headline)
                    .foregroundStyle(Theme.ink)
                Spacer(minLength: 0)
                if let next {
                    Text("Next: \(next.title)")
                        .textRole(.footnote)
                        .foregroundStyle(Theme.ink55)
                        .lineLimit(1)
                }
            }
            ProgressBar(value: Double(drawn) / Double(max(path.lessonCount, 1)))
                .accessibilityHidden(true)
        }
        .accessibilityElement(children: .combine)
    }

    /// The finished path: one green button somewhere new, one quiet way to look back.
    private func completeActions(for path: PathModel) -> some View {
        VStack(alignment: .leading, spacing: Theme.stackSpacing) {
            Button("Choose another path") { app.push(.paths) }
                .buttonStyle(.primary)

            Button {
                app.selectedTab = .sketchbook
            } label: {
                Label("See them in your sketchbook", systemImage: "book")
            }
            .buttonStyle(.quiet)
            .frame(maxWidth: .infinity)
            .padding(.top, -8)

            ProgressBar(value: 1, tint: Theme.gold)
                .accessibilityHidden(true)
        }
    }

    private var missingPath: some View {
        VStack(spacing: 0) {
            InlineNavBar(title: "Path") { dismiss() }
            Text("This path is no longer installed.")
                .textRole(.body)
                .foregroundStyle(Theme.ink55)
                .padding(Theme.gutter)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
    }

    // MARK: - Tapping a node

    private func open(_ lesson: Lesson, in path: PathModel) {
        guard !app.progress.isUnlocked(lesson, in: path) else {
            app.showPreview(of: lesson)
            return
        }
        raiseSheet(for: lesson, in: path)
    }

    private func raiseSheet(for lesson: Lesson, in path: PathModel) {
        guard let index = path.lessons.firstIndex(where: { $0.id == lesson.id }),
              let blocking = path.lessons.prefix(index).first(where: { !app.progress.isCompleted($0.id) })
        else { return }
        lockedLesson = LockedLesson(lesson: lesson, blocking: blocking, position: index + 1)
    }

    /// Home sends a locked node here with the sheet already up. The hand-over is
    /// cleared as it is read, so coming back later opens a plain screen.
    private func raiseSheetIfHandedOver(in path: PathModel) {
        guard let id = app.pendingLockedLessonId else { return }
        app.pendingLockedLessonId = nil
        guard let lesson = path.lesson(id: id) else { return }
        raiseSheet(for: lesson, in: path)
    }

    private static let longDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("d MMMM")
        return formatter
    }()
}
