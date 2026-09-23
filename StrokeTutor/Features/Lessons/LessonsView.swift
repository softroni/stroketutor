import SwiftUI

/// The Lessons tab: every lesson the app ships, two to a row, grouped under its
/// path. Home keeps to what a learner is drawing and a few doors onward, which can
/// make a big catalog look small; this screen shows all of it at once, so how
/// much there is to draw is never in doubt.
///
/// From the top: "Lessons" and one line of counts ("100 lessons · 10 paths · 7
/// drawn"), a row of path chips that jump to a path, then one section per path in
/// the catalog's order — easiest level first. A path's header (its level, its name,
/// "3/10") stays pinned while its lessons scroll under it, so a learner deep in the
/// list always knows whose lessons they are looking at.
///
/// The tiles are Home's (`LessonTile`), and so is the rule for tapping one: a drawn
/// or next lesson opens its preview on this tab's stack, a locked one raises the
/// sheet that names the lesson to draw first. Locked tiles show their drawing in
/// full color, so the long list reads as things to look forward to, not a wall of
/// locks. Nothing is dimmed or hidden by level: a level only groups.
struct LessonsView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var lockedLesson: LockedLesson?

    private static let columnSpacing: CGFloat = 16
    private static let rowSpacing: CGFloat = 22
    private static let topId = "lessons-top"

    var body: some View {
        // The screen's width sizes the tiles to their columns.
        GeometryReader { geometry in
            ScrollViewReader { proxy in
                VStack(spacing: 0) {
                    // A scroll view that touches the top safe area grows under the
                    // status bar, and its pinned headers stick there, behind the
                    // clock. One point of page between them keeps the headers below.
                    Theme.page.frame(height: 1)

                    ScrollView {
                        // One lazy stack for everything: `scrollTo` finds the header
                        // and the sections by id only as its direct children.
                        LazyVStack(alignment: .leading, spacing: 0, pinnedViews: [.sectionHeaders]) {
                            header
                                .padding(.horizontal, Theme.gutter)
                                .id(Self.topId)

                            if sections.isEmpty {
                                emptyCatalogCard
                                    .padding(.horizontal, Theme.gutter)
                                    .padding(.top, Theme.stackSpacing)
                            } else {
                                jumpChips(proxy)
                                    .padding(.top, 14)
                                    .padding(.bottom, 10)

                                // The ForEach's ids are the path ids, which is what the
                                // chips scroll to, found even before a section is built.
                                ForEach(sections) { section in
                                    Section {
                                        grid(for: section.path, tileSize: tileSize(in: geometry.size.width))
                                            .padding(.bottom, 18)
                                    } header: {
                                        PathSectionHeader(path: section.path,
                                                          level: section.level,
                                                          paint: paint(for: section.path),
                                                          drawn: app.progress.drawnCount(in: section.path)) {
                                            app.open(section.path)
                                        }
                                    }
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 6)
                        .padding(.bottom, 24)
                    }
                }
                .onChange(of: app.lessonsScrollToTop) {
                    proxy.scrollTo(Self.topId, anchor: .top)
                }
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

    // MARK: - Header

    /// "Lessons" and the whole catalog in numbers. Only counts that go up.
    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Lessons")
                .textRole(.largeTitle)
                .foregroundStyle(Theme.ink)
                .accessibilityAddTraits(.isHeader)
            if !sections.isEmpty {
                Text(countLine)
                    .textRole(.headline)
                    .foregroundStyle(Theme.ink55)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, minHeight: Theme.navTapTarget, alignment: .leading)
    }

    private var countLine: String {
        let lessons = sections.reduce(0) { $0 + $1.path.lessonCount }
        let drawn = sections.reduce(0) { $0 + app.progress.drawnCount(in: $1.path) }
        var parts = ["\(lessons) \(lessons == 1 ? "lesson" : "lessons")",
                     "\(sections.count) \(sections.count == 1 ? "path" : "paths")"]
        if drawn > 0 { parts.append("\(drawn) drawn") }
        return parts.joined(separator: " · ")
    }

    // MARK: - Jump chips

    /// One chip per path, in the order of the sections below: its name and count on
    /// its own tint. A tap brings that path's section to the top.
    private func jumpChips(_ proxy: ScrollViewProxy) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(sections) { section in
                    PathJumpChip(path: section.path,
                                 paint: paint(for: section.path),
                                 drawn: app.progress.drawnCount(in: section.path)) {
                        withAnimation(.easeInOut(duration: 0.35)) {
                            proxy.scrollTo(section.id, anchor: .top)
                        }
                    }
                }
            }
            .padding(.horizontal, Theme.gutter)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Jump to a path")
    }

    // MARK: - Grid

    /// Two columns on a phone; one at the accessibility text sizes, where two
    /// names side by side would not fit.
    private var columnCount: Int { dynamicTypeSize.isAccessibilitySize ? 1 : 2 }

    /// Each tile is as wide as its column. One column is kept to a size that still
    /// leaves the next row peeking in.
    private func tileSize(in width: CGFloat) -> CGFloat {
        let available = width - Theme.gutter * 2 - Self.columnSpacing * CGFloat(columnCount - 1)
        guard available > 0 else { return LessonTile.defaultSize }
        let size = (available / CGFloat(columnCount)).rounded(.down)
        return columnCount == 1 ? min(size, 240) : size
    }

    private func grid(for path: PathModel, tileSize: CGFloat) -> some View {
        let nextId = app.progress.nextLesson(in: path)?.id
        let columns = Array(repeating: GridItem(.flexible(), spacing: Self.columnSpacing, alignment: .topLeading),
                            count: columnCount)
        return LazyVGrid(columns: columns, alignment: .leading, spacing: Self.rowSpacing) {
            ForEach(Array(path.lessons.enumerated()), id: \.element.id) { index, lesson in
                LessonTile(lesson: lesson,
                           position: index + 1,
                           state: state(of: lesson, nextId: nextId),
                           size: tileSize) {
                    open(lesson, in: path)
                }
            }
        }
        .padding(.horizontal, Theme.gutter)
        // Room for the "Next" flag and the check badge on the first row's top edge.
        .padding(.top, 14)
    }

    private func state(of lesson: Lesson, nextId: String?) -> LessonTile.State {
        if app.progress.isCompleted(lesson.id) { return .done }
        return lesson.id == nextId ? .next : .locked
    }

    /// The same rule as Home: an open lesson shows its preview, a locked one says
    /// which lesson comes first.
    private func open(_ lesson: Lesson, in path: PathModel) {
        guard !app.progress.isUnlocked(lesson, in: path) else {
            app.showPreview(of: lesson)
            return
        }
        lockedLesson = LockedLesson(lesson: lesson, in: path, progress: app.progress)
    }

    // MARK: - Content

    /// Every path with a lesson in the bundle, in the catalog's order, each with the
    /// level it sits under. Unlike All paths, started paths are not moved up: the
    /// order here never changes, so a learner finds a path where they left it.
    private var sections: [LessonsSection] {
        app.catalog.pathSections.flatMap { section in
            section.paths
                .compactMap { app.path(id: $0.id) }
                .filter { !$0.isEmpty }
                .map { LessonsSection(level: section.level, path: $0) }
        }
    }

    /// A path's tint, or gold once every lesson in it is drawn — as on Home.
    private func paint(for path: PathModel) -> PathTint {
        let drawn = app.progress.drawnCount(in: path)
        return drawn == path.lessonCount && path.lessonCount > 0 ? .complete : app.tint(for: path)
    }

    /// Nothing installed. Honest, and it does not pretend a lesson is coming.
    private var emptyCatalogCard: some View {
        Text("No lessons are installed.")
            .textRole(.body)
            .foregroundStyle(Theme.ink55)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.cardPadding)
            .cardBackground()
    }
}

/// One path's worth of the list, and the level it is listed under.
private struct LessonsSection: Identifiable {
    let level: CatalogLevel?
    let path: PathModel

    var id: String { path.id }
}

/// A path's pinned header: its level in small capitals, its name with a chevron
/// (the whole row opens the path on the Path tab), and "3/10" on the path's tint.
/// It sits on the page color so tiles scrolling under it disappear cleanly, with a
/// line in the path's edge color underneath.
private struct PathSectionHeader: View {
    let path: PathModel
    let level: CatalogLevel?
    let paint: PathTint
    let drawn: Int
    let action: () -> Void

    private var isComplete: Bool { drawn == path.lessonCount && path.lessonCount > 0 }

    var body: some View {
        Button(action: action) {
            HStack(alignment: .center, spacing: 8) {
                VStack(alignment: .leading, spacing: 0) {
                    if let level {
                        Text(level.title.uppercased())
                            .textRole(.eyebrow)
                            .foregroundStyle(paint.deep)
                    }
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(path.title)
                            .textRole(.title2)
                            .foregroundStyle(Theme.ink)
                            .lineLimit(2)
                            .fixedSize(horizontal: false, vertical: true)
                        Image(systemName: "chevron.right")
                            .scaledFont(17, .heavy, relativeTo: .title3, design: .default)
                            .foregroundStyle(paint.deep)
                    }
                }
                Spacer(minLength: 8)
                count
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.vertical, 8)
            .frame(minHeight: Theme.navTapTarget)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.page)
            .overlay(alignment: .bottom) {
                Rectangle()
                    .fill(paint.edge)
                    .frame(height: 2)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint("Opens the whole path")
        .accessibilityAddTraits([.isButton, .isHeader])
    }

    /// "2/10" in the path's deep color on its soft tint, or a gold check and "10/10".
    private var count: some View {
        HStack(spacing: 4) {
            if isComplete {
                Image(systemName: "checkmark")
                    .scaledFont(12, .heavy, relativeTo: .footnote, design: .default)
            }
            Text("\(drawn)/\(path.lessonCount)")
                .scaledFont(15, .heavy, relativeTo: .footnote)
                .monospacedDigit()
        }
        .foregroundStyle(paint.deep)
        .padding(.vertical, 5)
        .padding(.horizontal, 10)
        .background(Capsule().fill(paint.soft))
        .fixedSize()
    }

    private var accessibilityLabel: String {
        var parts = [path.title]
        if let level { parts.append(level.title) }
        if let description = path.description { parts.append(description) }
        parts.append(isComplete ? "all \(path.lessonCount) drawn" : "\(drawn) of \(path.lessonCount) drawn")
        return parts.joined(separator: ", ")
    }
}

/// A path's chip in the jump row: its name and "3/10" on its soft tint.
private struct PathJumpChip: View {
    let path: PathModel
    let paint: PathTint
    let drawn: Int
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text(path.title)
                    .scaledFont(15, .heavy, relativeTo: .subheadline)
                    .foregroundStyle(Theme.ink)
                Text("\(drawn)/\(path.lessonCount)")
                    .scaledFont(13, .heavy, relativeTo: .footnote)
                    .monospacedDigit()
                    .foregroundStyle(paint.deep)
            }
            .lineLimit(1)
            .padding(.horizontal, 14)
            .frame(minHeight: Theme.navTapTarget)
            .background(Capsule().fill(paint.soft))
            .overlay(Capsule().strokeBorder(paint.edge, lineWidth: 2))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(path.title), \(drawn) of \(path.lessonCount) drawn")
        .accessibilityHint("Scrolls to its lessons")
    }
}
