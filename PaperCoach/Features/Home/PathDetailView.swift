import SwiftUI

/// `hp-path` — one path, told in pictures: a big hero in the path's own color
/// (`PathTint`) with the last lesson drawn in color, where the path leads; a short
/// count over a chunky bar; then every lesson as a big, colorful node. The path's name
/// is the nav title and its description is left to VoiceOver, so the screen itself
/// carries almost no words.
///
/// Three states. **Default** shows the "Goal" hero and "2 of 10 drawn". **Locked** is
/// the same screen with the sheet up, raised by tapping a gray node (or handed over
/// by Home). **Complete** turns the hero gold ("All 10 drawn"), says "Path complete!"
/// and offers somewhere to go next.
///
/// It is the root of the Path tab, showing whichever path is current, so it has no
/// back button. Its title is the way to another path instead: "Landscape ⌄" pushes
/// All paths, and choosing a card there makes that path current and comes back to
/// this root showing it (`AppModel.open(_:)`).
struct PathDetailView: View {
    /// The current path's id; nil before a path has been chosen.
    let pathId: String?

    @Environment(AppModel.self) private var app
    @State private var lockedLesson: LockedLesson?

    var body: some View {
        Group {
            if let pathId, let path = app.path(id: pathId), !path.isEmpty {
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
            InlineNavBar(title: path.title,
                         titleAction: NavBarTitleAction(name: "choose another path") {
                             app.push(.paths)
                         })

            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    destination(for: path, isComplete: isComplete)

                    if isComplete {
                        completeActions(for: path)
                    } else {
                        progressBlock(for: path, drawn: drawn)
                    }

                    PathNodesView(lessons: path.lessons,
                                  progress: app.progress,
                                  dateStyle: .short,
                                  nodeSize: 100,
                                  isPremium: { app.needsPremium($0) }) { lesson in
                        open(lesson, in: path)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Theme.gutter)
                .padding(.top, 4)
                .padding(.bottom, 20)
            }
        }
        // On appear for a hand-over that arrives with a new path (the root is keyed
        // by it, so it appears afresh), and on change for one that arrives while
        // this path is already the root — the tab root does not appear again.
        .onAppear { raiseSheetIfHandedOver(in: path) }
        .onChange(of: app.pendingLockedLessonId) { raiseSheetIfHandedOver(in: path) }
    }

    /// Where the path leads: a hero card in the path's soft tint (gold once every
    /// lesson is drawn) with a 5 pt deeper edge, the last lesson drawn in its own
    /// colors on a white panel, a "Goal" chip on the panel and the lesson's name under
    /// it. Not tappable — it would land on a locked lesson, and the nodes below
    /// already offer everything that is open.
    private func destination(for path: PathModel, isComplete: Bool) -> some View {
        let last = path.lessons.last
        let tint = isComplete ? PathTint.complete : app.tint(for: path)
        let shape = RoundedRectangle(cornerRadius: Theme.canvasCornerRadius, style: .continuous)
        let panel = RoundedRectangle(cornerRadius: Theme.canvasCornerRadius - 10, style: .continuous)

        return VStack(spacing: 10) {
            // The drawing is fitted to its own bounds, so it fills whatever box it
            // is given right to the edges. It therefore sits below the chip's band
            // rather than under it.
            DrawingThumbnail(tutorial: last?.tutorial, strokeColor: nil, showsFills: true)
                .padding(.top, 50)
                .padding(.bottom, 16)
                .padding(.horizontal, 18)
                .frame(maxWidth: .infinity)
                .frame(height: 236)
                .background(panel.fill(Theme.paper))
                .overlay(alignment: .topLeading) {
                    goalChip(isComplete: isComplete, count: path.lessonCount)
                        .padding(12)
                }

            Text(last?.title ?? "")
                .textRole(.title3)
                .foregroundStyle(isComplete ? Theme.goldDeep : Theme.ink)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 8)
        }
        .padding(.init(top: 10, leading: 10, bottom: 12, trailing: 10))
        .background(shape.fill(tint.soft))
        .background(alignment: .bottom) {
            shape.fill(tint.edge).offset(y: 5)
        }
        .padding(.bottom, 5)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(destinationAccessibilityLabel(for: path, last: last, isComplete: isComplete))
    }

    /// "Goal" with a flag, or "All 10 drawn" with a check: white on gold, so it
    /// reads on every tint and on the gold of a finished path alike.
    private func goalChip(isComplete: Bool, count: Int) -> some View {
        HStack(spacing: 6) {
            Image(systemName: isComplete ? "checkmark" : "flag.fill")
                .scaledFont(14, .heavy, relativeTo: .footnote, design: .default)
            Text(isComplete ? "All \(count) drawn" : "Goal")
                .scaledFont(15, .heavy, relativeTo: .footnote)
        }
        .foregroundStyle(.white)
        .padding(.vertical, 7)
        .padding(.horizontal, 12)
        .background(Capsule().fill(Theme.gold))
    }

    /// The path's name and description, which the screen no longer prints, lead the
    /// hero's label so VoiceOver still hears what the path is about.
    private func destinationAccessibilityLabel(for path: PathModel,
                                               last: Lesson?,
                                               isComplete: Bool) -> String {
        var parts = [path.title]
        if let description = path.description { parts.append(description) }
        let lastTitle = last?.title ?? ""
        parts.append(isComplete
                     ? "Every lesson drawn. \(lastTitle)"
                     : "Where this path leads: \(lastTitle)")
        return parts.joined(separator: ". ")
    }

    /// "2 of 10 drawn" over a chunky bar in the path's deep color. A count of
    /// finished drawings, never a percentage and never a target; the next lesson is
    /// named by its node, so it is not repeated here.
    private func progressBlock(for path: PathModel, drawn: Int) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("\(drawn) of \(path.lessonCount) drawn")
                .textRole(.headline)
                .foregroundStyle(Theme.ink)
            ProgressBar(value: Double(drawn) / Double(max(path.lessonCount, 1)),
                        tint: app.tint(for: path).deep)
                .accessibilityHidden(true)
        }
        .accessibilityElement(children: .combine)
    }

    /// The finished path: one short cheer, one green button somewhere new, one quiet
    /// way to look back.
    private func completeActions(for path: PathModel) -> some View {
        VStack(alignment: .leading, spacing: Theme.stackSpacing) {
            Text("Path complete!")
                .textRole(.title1)
                .foregroundStyle(Theme.ink)
                .frame(maxWidth: .infinity)
                .accessibilityAddTraits(.isHeader)

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
        }
    }

    /// No path chosen yet, or the current one has nothing installed. A tab root
    /// cannot send the learner back, so it offers the way forward instead.
    private var missingPath: some View {
        VStack(spacing: 0) {
            InlineNavBar(title: "Path")
            VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                Text("Pick a path to start")
                    .textRole(.title1)
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                Button("See all paths") { app.push(.paths) }
                    .buttonStyle(.primary)
            }
            .padding(Theme.gutter)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
    }

    // MARK: - Tapping a node

    private func open(_ lesson: Lesson, in path: PathModel) {
        if app.offerPremiumIfNeeded(for: lesson) { return }
        guard !app.progress.isUnlocked(lesson, in: path) else {
            app.showPreview(of: lesson)
            return
        }
        raiseSheet(for: lesson, in: path)
    }

    private func raiseSheet(for lesson: Lesson, in path: PathModel) {
        lockedLesson = LockedLesson(lesson: lesson, in: path, progress: app.progress)
    }

    /// A locked node handed over with the sheet already up (`pendingLockedLessonId`).
    /// The hand-over is cleared as it is read, so coming back later opens a plain
    /// screen.
    private func raiseSheetIfHandedOver(in path: PathModel) {
        guard let id = app.pendingLockedLessonId else { return }
        app.pendingLockedLessonId = nil
        guard let lesson = path.lesson(id: id) else { return }
        raiseSheet(for: lesson, in: path)
    }
}
