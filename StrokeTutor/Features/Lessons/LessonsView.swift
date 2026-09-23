import SwiftUI

/// The Lessons tab: every lesson the app ships, two to a row, grouped under its
/// path. Home keeps to what a learner is drawing and a few doors onward, which can
/// make a big catalog look small; this screen shows all of it at once, so how
/// much there is to draw is never in doubt.
///
/// A row of path chips sits above the list and stays there, so any path is one tap
/// away however deep the scroll has gone — 20 paths of 10 lessons is a long way back
/// to the top. The chip of the path being looked at is filled in its own color and
/// kept in view, which is also how a learner deep in the list knows whose lessons
/// these are; the path headers below scroll away with their lessons rather than
/// pinning, so only one band is ever held back from the drawings.
///
/// Under the chips: "Lessons" and one line of counts ("100 lessons · 10 paths · 7
/// drawn"), then one section per path in the catalog's order — easiest level first,
/// each under its own header (its level, its name, "3/10").
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
    /// The path whose lessons fill the top of the list: the chip that is filled in.
    @State private var activePathId: String?
    /// Where the list starts, under the chip band — the line a section has to have
    /// passed for its lessons to be the ones on show.
    @State private var listTop: CGFloat = 0
    /// Set while a chip's jump is in flight, so the chip row does not chase the
    /// sections the scroll flies past on its way.
    @State private var isJumping = false
    /// The last chip tapped, with a token, so tapping the same chip twice still asks
    /// the list to travel.
    @State private var jump: Jump?

    private static let columnSpacing: CGFloat = 16
    private static let rowSpacing: CGFloat = 22
    private static let topId = "lessons-top"
    /// A chip's id, kept apart from its path's section id: one `ScrollViewReader`
    /// stands over both scroll views, and an id in two of them scrolls the wrong one.
    private static func chipId(_ pathId: String) -> String { "chip-\(pathId)" }
    /// How far into the list a section has to reach to be the one on show: a few
    /// points, enough that a header landing exactly on the top still counts.
    private static let activeProbe: CGFloat = 8

    var body: some View {
        // The screen's width sizes the tiles to their columns.
        GeometryReader { geometry in
            VStack(spacing: 0) {
                // The band sits above the list rather than over it: it is opaque
                // either way, and a list that starts under it is one `scrollTo` puts
                // a path's header exactly where the eye expects it. Its own reader
                // is the row's; a reader over both scroll views drives the wrong one,
                // so a chip asks for its jump through `jump` instead of a proxy.
                if !sections.isEmpty { jumpChips() }

                ScrollViewReader { proxy in
                    // One lazy stack for everything: `scrollTo` finds the header and
                    // the sections by id only as its direct children.
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 0) {
                            header
                                .padding(.horizontal, Theme.gutter)
                                .padding(.bottom, 8)
                                .id(Self.topId)

                            if sections.isEmpty {
                                emptyCatalogCard
                                    .padding(.horizontal, Theme.gutter)
                                    .padding(.top, Theme.stackSpacing)
                            } else {
                                ForEach(sections) { section in
                                    VStack(alignment: .leading, spacing: 0) {
                                        PathSectionHeader(path: section.path,
                                                          level: section.level,
                                                          paint: paint(for: section.path),
                                                          drawn: app.progress.drawnCount(in: section.path)) {
                                            app.open(section.path)
                                        }
                                        grid(for: section.path, tileSize: tileSize(in: geometry.size.width))
                                            .padding(.bottom, 18)
                                    }
                                    // A section spans its header and every one of its
                                    // lessons, so the one holding the top of the list is
                                    // always on screen and always reports its place.
                                    .background(spanReporter(for: section.id))
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 6)
                        .padding(.bottom, 24)
                    }
                    .background(listTopReporter)
                    .onChange(of: jump) {
                        guard let jump else { return }
                        withAnimation(.easeInOut(duration: 0.35)) {
                            proxy.scrollTo(jump.pathId, anchor: .top)
                        }
                    }
                    .onChange(of: app.lessonsScrollToTop) {
                        proxy.scrollTo(Self.topId, anchor: .top)
                    }
                    #if DEBUG
                    // The screenshot harness cannot scroll a list; this lets it ask
                    // for one, once, on the launch that opens this tab.
                    .onAppear {
                        guard let id = DebugScreenHarness.pendingLessonsJump else { return }
                        DebugScreenHarness.pendingLessonsJump = nil
                        activePathId = id
                        Task { @MainActor in
                            try? await Task.sleep(for: .milliseconds(700))
                            proxy.scrollTo(id, anchor: .top)
                        }
                    }
                    #endif
                }
            }
            .onPreferenceChange(ListTopKey.self) { listTop = $0 }
            .onPreferenceChange(SectionSpanKey.self) { spans in
                let active = activePath(from: spans)
                if active != activePathId {
                    activePathId = active
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
    /// its own tint, the path being looked at filled in. A tap brings that path's
    /// section to the top. The row keeps its place above the list and carries its
    /// white up behind the clock, so the band reads as one piece with the status bar.
    private func jumpChips() -> some View {
        ScrollViewReader { chips in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(sections) { section in
                        PathJumpChip(path: section.path,
                                     paint: paint(for: section.path),
                                     drawn: app.progress.drawnCount(in: section.path),
                                     isActive: section.id == activePathId) {
                            // The tapped chip is on screen already, so nothing has to
                            // chase it while the list travels.
                            isJumping = true
                            activePathId = section.id
                            jump = Jump(pathId: section.id, token: (jump?.token ?? 0) + 1)
                            Task {
                                try? await Task.sleep(for: .seconds(0.5))
                                isJumping = false
                            }
                        }
                        .id(Self.chipId(section.id))
                    }
                }
                .padding(.horizontal, Theme.gutter)
            }
            // Crossing into a path brings its chip back to the middle of the row —
            // once per path, not on every point of the scroll.
            .onChange(of: activePathId) {
                guard !isJumping, let activePathId else { return }
                withAnimation(.easeInOut(duration: 0.3)) {
                    chips.scrollTo(Self.chipId(activePathId), anchor: .center)
                }
            }
        }
        .padding(.vertical, 10)
        .background {
            Theme.page
                .ignoresSafeArea(edges: .top)
                .overlay(alignment: .bottom) {
                    Rectangle()
                        .fill(Theme.line)
                        .frame(height: 1)
                }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Jump to a path")
    }

    // MARK: - Which path is on show

    /// Reports where the list starts — its own top, just under the band.
    private var listTopReporter: some View {
        GeometryReader { proxy in
            Color.clear.preference(key: ListTopKey.self,
                                   value: proxy.frame(in: .global).minY)
        }
    }

    /// Reports one section's place, in the same space.
    private func spanReporter(for id: String) -> some View {
        GeometryReader { proxy in
            Color.clear.preference(key: SectionSpanKey.self,
                                   value: [id: proxy.frame(in: .global)])
        }
    }

    /// The last path to have passed under the chip band — the one whose lessons fill
    /// the top of the list. Before any has (the list is at its very top, under
    /// "Lessons"), the first path on screen stands in, so a chip is always filled.
    private func activePath(from spans: [String: CGRect]) -> String? {
        let onScreen = sections.compactMap { section in
            spans[section.id].map { (id: section.id, frame: $0) }
        }
        guard !onScreen.isEmpty else { return nil }
        let line = listTop + Self.activeProbe
        return onScreen.last(where: { $0.frame.minY <= line })?.id ?? onScreen.first?.id
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

/// A chip's ask for the list to travel to its path. The token makes a second tap
/// on the same chip a change `onChange` can see.
private struct Jump: Equatable {
    let pathId: String
    let token: Int
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

/// A path's chip in the jump row: its name and "3/10" on its soft tint, or the
/// whole capsule in the path's deep color while its lessons are the ones on show.
/// The filled chip is what names the path once its header has scrolled away, so it
/// carries the count the pinned header used to.
private struct PathJumpChip: View {
    let path: PathModel
    let paint: PathTint
    let drawn: Int
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text(path.title)
                    .scaledFont(15, .heavy, relativeTo: .subheadline)
                    .foregroundStyle(isActive ? Theme.page : Theme.ink)
                Text("\(drawn)/\(path.lessonCount)")
                    .scaledFont(13, .heavy, relativeTo: .footnote)
                    .monospacedDigit()
                    .foregroundStyle(isActive ? paint.soft : paint.deep)
            }
            .lineLimit(1)
            .padding(.horizontal, 14)
            .frame(minHeight: Theme.navTapTarget)
            .background(Capsule().fill(isActive ? paint.deep : paint.soft))
            .overlay(Capsule().strokeBorder(isActive ? paint.deep : paint.edge, lineWidth: 2))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.2), value: isActive)
        .accessibilityLabel("\(path.title), \(drawn) of \(path.lessonCount) drawn")
        .accessibilityHint("Scrolls to its lessons")
        .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
    }
}

/// Where the list starts, under the chip band.
private struct ListTopKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

/// Each on-screen path section's place in that same space, by path id.
private struct SectionSpanKey: PreferenceKey {
    static let defaultValue: [String: CGRect] = [:]
    static func reduce(value: inout [String: CGRect], nextValue: () -> [String: CGRect]) {
        value.merge(nextValue()) { _, next in next }
    }
}
