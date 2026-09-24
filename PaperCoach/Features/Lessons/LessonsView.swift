import SwiftUI

/// The Lessons tab: every lesson the app ships, three to a row on a phone and six
/// on an iPad, grouped under its path. Home keeps to what a learner is drawing and a few doors onward, which can
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
///
/// A round magnifying glass leads the chip row, and it does not scroll with the
/// chips, so search is one tap away wherever the list is. Tapping it turns the same
/// band into a search field — same height, same white, same rule under it, so
/// nothing below moves — and brings up the keyboard. The list filters in place as
/// the learner types (`LessonSearch` says what matches): the same headers and the
/// same tiles, each lesson at its real place in its path and in its real state, with
/// "2 found" where a header's "3/10" was. The chips are gone while the field is up,
/// so nothing claims to be "the path on show" in a list that only has pieces of
/// paths. A search that finds nothing says so with the words that were typed and
/// offers a few paths to jump to instead of a blank page. Cancel puts everything back.
struct LessonsView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
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
    /// True while the band holds the search field instead of the chips. The field
    /// can be up with nothing typed yet, and then the whole list shows.
    @State private var isSearching = false
    /// What the learner has typed into the search field.
    @State private var query = ""
    @FocusState private var isQueryFocused: Bool

    private static let columnSpacing: CGFloat = 16
    private static let rowSpacing: CGFloat = 22
    private static let topId = "lessons-top"
    /// A chip's id, kept apart from its path's section id: one `ScrollViewReader`
    /// stands over both scroll views, and an id in two of them scrolls the wrong one.
    private static func chipId(_ pathId: String) -> String { "chip-\(pathId)" }
    /// How far into the list a section has to reach to be the one on show: a few
    /// points, enough that a header landing exactly on the top still counts.
    private static let activeProbe: CGFloat = 8
    /// How many paths a search that found nothing offers instead.
    private static let suggestionCount = 4

    var body: some View {
        let catalog = sections
        let shown = LessonSearch.filter(catalog, query: query)

        // The screen's width sizes the tiles to their columns.
        GeometryReader { geometry in
            VStack(spacing: 0) {
                // The band sits above the list rather than over it: it is opaque
                // either way, and a list that starts under it is one `scrollTo` puts
                // a path's header exactly where the eye expects it. Its own reader
                // is the row's; a reader over both scroll views drives the wrong one,
                // so a chip asks for its jump through `jump` instead of a proxy.
                if !catalog.isEmpty { band(catalog) }

                ScrollViewReader { proxy in
                    // One lazy stack for everything: `scrollTo` finds the header and
                    // the sections by id only as its direct children.
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 0) {
                            header(catalog: catalog, shown: shown)
                                .padding(.horizontal, Theme.gutter)
                                .padding(.bottom, 8)
                                .id(Self.topId)

                            if catalog.isEmpty {
                                emptyCatalogCard
                                    .padding(.horizontal, Theme.gutter)
                                    .padding(.top, Theme.stackSpacing)
                            } else if shown.sections.isEmpty {
                                noMatchesCard(suggesting: Array(catalog.prefix(Self.suggestionCount)))
                                    .padding(.horizontal, Theme.gutter)
                                    .padding(.top, Theme.stackSpacing)
                            } else {
                                ForEach(shown.sections) { section in
                                    VStack(alignment: .leading, spacing: 0) {
                                        PathSectionHeader(path: section.path,
                                                          level: section.level,
                                                          paint: paint(for: section.path),
                                                          drawn: app.progress.drawnCount(in: section.path),
                                                          found: shown.isFiltered ? section.entries.count : nil) {
                                            app.open(section.path)
                                        }
                                        grid(for: section.path,
                                             entries: section.entries,
                                             tileSize: tileSize(in: geometry.size.width))
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
                    // Scrolling the results is reading them: the keyboard goes, the
                    // field and what is typed in it stay.
                    .scrollDismissesKeyboard(.immediately)
                    .background(listTopReporter)
                    .onChange(of: jump) {
                        guard let jump else { return }
                        withAnimation(.easeInOut(duration: 0.35)) {
                            proxy.scrollTo(jump.pathId, anchor: .top)
                        }
                    }
                    // Home's "See all lessons" promises the whole catalog, so a search
                    // left open here is closed on the way in.
                    .onChange(of: app.lessonsScrollToTop) {
                        endSearch()
                        proxy.scrollTo(Self.topId, anchor: .top)
                    }
                    // Every change of the words is a new list, read from its top.
                    .onChange(of: query) {
                        proxy.scrollTo(Self.topId, anchor: .top)
                    }
                    #if DEBUG
                    // The screenshot harness cannot scroll a list or type; this lets
                    // it ask for either, once, on the launch that opens this tab.
                    // Every tab is built at launch, before AppRoot's harness has
                    // run, and built again when the harness resets the learner, so
                    // the ask is read a beat after appearing and left in place for
                    // the rebuilt tab; the harness clears it on its next run.
                    .task {
                        try? await Task.sleep(for: .milliseconds(300))
                        if let text = DebugScreenHarness.pendingLessonsSearch {
                            isSearching = true
                            query = text
                        }
                        guard let id = DebugScreenHarness.pendingLessonsJump else { return }
                        activePathId = id
                        try? await Task.sleep(for: .milliseconds(700))
                        proxy.scrollTo(id, anchor: .top)
                    }
                    #endif
                }
            }
            .onPreferenceChange(ListTopKey.self) { listTop = $0 }
            .onPreferenceChange(SectionSpanKey.self) { spans in
                // A filtered list holds pieces of paths and the chips are away, so
                // there is no path on show to track until the search is closed.
                guard !isFiltering else { return }
                // Mid-jump the list flies past other paths; the chip asked for
                // stays filled rather than flickering through them.
                guard !isJumping else { return }
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

    /// "Lessons" and the whole catalog in numbers — only counts that go up — or,
    /// while a search is filtering, how many lessons it found.
    private func header(catalog: [LessonsSection], shown: LessonsSearchResult) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Lessons")
                .textRole(.largeTitle)
                .foregroundStyle(Theme.ink)
                .accessibilityAddTraits(.isHeader)
            if let line = countLine(catalog: catalog, shown: shown) {
                Text(line)
                    .textRole(.headline)
                    .foregroundStyle(Theme.ink55)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, minHeight: Theme.navTapTarget, alignment: .leading)
    }

    /// "100 lessons · 10 paths · 7 drawn", or "5 lessons found". Nothing when there
    /// is nothing to count: the card below says so in words.
    private func countLine(catalog: [LessonsSection], shown: LessonsSearchResult) -> String? {
        guard !catalog.isEmpty else { return nil }
        if shown.isFiltered {
            let found = shown.matchCount
            guard found > 0 else { return nil }
            return "\(found) \(found == 1 ? "lesson" : "lessons") found"
        }
        let lessons = catalog.reduce(0) { $0 + $1.path.lessonCount }
        let drawn = catalog.reduce(0) { $0 + app.progress.drawnCount(in: $1.path) }
        var parts = ["\(lessons) \(lessons == 1 ? "lesson" : "lessons")",
                     "\(catalog.count) \(catalog.count == 1 ? "path" : "paths")"]
        if drawn > 0 { parts.append("\(drawn) drawn") }
        return parts.joined(separator: " · ")
    }

    // MARK: - Band

    /// The strip above the list: the chips, or the search field in their place. The
    /// two trade places with a short fade (and a small slide, unless Reduce Motion is
    /// on) inside the same padding and background, so the list never moves. The band
    /// carries its white up behind the clock, so it reads as one piece with the
    /// status bar.
    private func band(_ catalog: [LessonsSection]) -> some View {
        ZStack {
            if isSearching {
                searchBar
                    .transition(swapTransition(from: 16))
            } else {
                jumpChips(catalog)
                    .transition(swapTransition(from: -16))
            }
        }
        .frame(maxWidth: .infinity)
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
    }

    private func swapTransition(from offset: CGFloat) -> AnyTransition {
        reduceMotion ? .opacity : .opacity.combined(with: .offset(x: offset))
    }

    private var swapAnimation: Animation { .easeInOut(duration: 0.2) }

    // MARK: - Jump chips

    /// The search button, then one chip per path, in the order of the sections
    /// below: its name and count on its own tint, the path being looked at filled
    /// in. A tap brings that path's section to the top. The chips scroll sideways
    /// under a short fade beside the button, which stays put.
    private func jumpChips(_ catalog: [LessonsSection]) -> some View {
        HStack(spacing: 0) {
            searchChip
                .padding(.leading, Theme.gutter)

            ScrollViewReader { chips in
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(catalog) { section in
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
                    .padding(.leading, Self.chipFade)
                    .padding(.trailing, Theme.gutter)
                }
                // Chips slide out of sight beside the button instead of being cut
                // off at its edge. The fade is as wide as the gap before the first
                // chip, so a row at rest shows every chip whole.
                .mask {
                    HStack(spacing: 0) {
                        LinearGradient(colors: [.clear, .black], startPoint: .leading, endPoint: .trailing)
                            .frame(width: Self.chipFade)
                        Color.black
                    }
                }
                // Crossing into a path brings its chip back to the middle of the row —
                // once per path, not on every point of the scroll.
                .onChange(of: activePathId) {
                    guard !isJumping, let activePathId else { return }
                    withAnimation(.easeInOut(duration: 0.3)) {
                        chips.scrollTo(Self.chipId(activePathId), anchor: .center)
                    }
                }
                // Back from a search, the row starts where the list is.
                .onAppear {
                    guard let activePathId else { return }
                    chips.scrollTo(Self.chipId(activePathId), anchor: .center)
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Jump to a path")
        }
    }

    /// The gap between the search button and the first chip, which is also the
    /// width of the fade the chips scroll out under.
    private static let chipFade: CGFloat = 8

    /// A plain round button in the chips' weight: ink on white inside the page's
    /// gray line, so it sits with the chips without looking like one more path.
    private var searchChip: some View {
        Button(action: startSearch) {
            Image(systemName: "magnifyingglass")
                .scaledFont(17, .heavy, relativeTo: .subheadline, design: .default)
                .foregroundStyle(Theme.ink)
                .frame(width: Theme.navTapTarget, height: Theme.navTapTarget)
                .background(Circle().fill(Theme.page))
                .overlay(Circle().strokeBorder(Theme.line, lineWidth: 2))
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Search lessons")
    }

    // MARK: - Search

    /// True while there is something to search for — what filters the list and
    /// puts "found" on the headers.
    private var isFiltering: Bool {
        !LessonSearch.searchWords(in: query).isEmpty
    }

    /// A capsule field and a Cancel beside it, in the chips' place. It takes the
    /// keyboard as soon as it appears. Autocorrect and capitals are off: the search
    /// forgives typos itself, and a word "corrected" into another would find the
    /// wrong lessons.
    private var searchBar: some View {
        HStack(spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .scaledFont(15, .heavy, relativeTo: .subheadline, design: .default)
                    .foregroundStyle(Theme.ink55)
                    .accessibilityHidden(true)
                TextField("Search lessons",
                          text: $query,
                          prompt: Text("Search lessons").foregroundStyle(Theme.ink55))
                    .scaledFont(17, .bold, relativeTo: .body)
                    .foregroundStyle(Theme.ink)
                    .tint(Theme.green)
                    .focused($isQueryFocused)
                    .submitLabel(.search)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .onSubmit { isQueryFocused = false }
                if !query.isEmpty {
                    Button {
                        query = ""
                        isQueryFocused = true
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .scaledFont(18, .regular, relativeTo: .body, design: .default)
                            .foregroundStyle(Theme.ink40)
                            .frame(width: 36, height: Theme.navTapTarget)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Clear search")
                }
            }
            .padding(.leading, 16)
            .padding(.trailing, query.isEmpty ? 16 : 4)
            .frame(minHeight: Theme.navTapTarget)
            .background(Capsule().fill(Theme.surface))
            .overlay(Capsule().strokeBorder(Theme.line, lineWidth: 2))

            Button(action: endSearch) {
                Text("Cancel")
                    .scaledFont(17, .bold, relativeTo: .body)
                    .foregroundStyle(Theme.ink)
                    .frame(minHeight: Theme.navTapTarget)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .fixedSize()
        }
        .padding(.horizontal, Theme.gutter)
        .task { isQueryFocused = true }
    }

    private func startSearch() {
        withAnimation(swapAnimation) { isSearching = true }
    }

    /// Clears the words, drops the keyboard and brings the chips back over the
    /// whole list.
    private func endSearch() {
        query = ""
        isQueryFocused = false
        guard isSearching else { return }
        withAnimation(swapAnimation) { isSearching = false }
    }

    /// A suggested path from the no-results card: close the search, then travel to
    /// the path once the whole list is back for `scrollTo` to find it in.
    private func jumpFromSearch(to pathId: String) {
        endSearch()
        isJumping = true
        activePathId = pathId
        let token = (jump?.token ?? 0) + 1
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(100))
            jump = Jump(pathId: pathId, token: token)
            try? await Task.sleep(for: .milliseconds(500))
            isJumping = false
        }
    }

    /// Nothing matched. The card repeats the words, so a typo can be seen, says
    /// "yet" because the catalog grows, and offers the first few paths as chips —
    /// something to tap rather than a dead end.
    private func noMatchesCard(suggesting suggestions: [LessonsSection]) -> some View {
        let words = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return VStack(alignment: .leading, spacing: 12) {
            Text("No lessons called \u{201C}\(words)\u{201D} yet.")
                .textRole(.title3)
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
            Text("Try one of these:")
                .textRole(.body)
                .foregroundStyle(Theme.ink55)
            ChipFlow(spacing: 8) {
                ForEach(suggestions) { section in
                    PathJumpChip(path: section.path,
                                 paint: paint(for: section.path),
                                 drawn: app.progress.drawnCount(in: section.path),
                                 isActive: false) {
                        jumpFromSearch(to: section.id)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.cardPadding)
        .cardBackground()
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

    /// Three columns on a phone, six on an iPad (or any regular-width window). The
    /// biggest text sizes take fewer, so the names under the tiles still fit.
    private var columnCount: Int {
        let isWide = horizontalSizeClass == .regular
        if dynamicTypeSize.isAccessibilitySize { return isWide ? 3 : 1 }
        if dynamicTypeSize > .xLarge { return isWide ? 4 : 2 }
        return isWide ? 6 : 3
    }

    /// Each tile is as wide as its column. One column is kept to a size that still
    /// leaves the next row peeking in.
    private func tileSize(in width: CGFloat) -> CGFloat {
        let available = width - Theme.gutter * 2 - Self.columnSpacing * CGFloat(columnCount - 1)
        guard available > 0 else { return LessonTile.defaultSize }
        let size = (available / CGFloat(columnCount)).rounded(.down)
        return columnCount == 1 ? min(size, 240) : size
    }

    /// The lessons on show from one path — all of them, or a search's matches —
    /// each at its real place, so its state and what a tap does are the real ones.
    private func grid(for path: PathModel, entries: [LessonsEntry], tileSize: CGFloat) -> some View {
        let nextId = app.progress.nextLesson(in: path)?.id
        let columns = Array(repeating: GridItem(.flexible(), spacing: Self.columnSpacing, alignment: .topLeading),
                            count: columnCount)
        return LazyVGrid(columns: columns, alignment: .leading, spacing: Self.rowSpacing) {
            ForEach(entries) { entry in
                LessonTile(lesson: entry.lesson,
                           position: entry.position,
                           state: state(of: entry.lesson, nextId: nextId),
                           size: tileSize) {
                    open(entry.lesson, in: path)
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

/// A path's pinned header: its level in small capitals, its name with a chevron
/// (the whole row opens the path on the Path tab), and "3/10" on the path's tint.
/// It sits on the page color so tiles scrolling under it disappear cleanly, with a
/// line in the path's edge color underneath.
///
/// While a search is filtering, `found` is how many of the path's lessons matched,
/// and the capsule reads "2 found" instead: a count of drawn lessons over a handful
/// of tiles would not add up.
private struct PathSectionHeader: View {
    let path: PathModel
    let level: CatalogLevel?
    let paint: PathTint
    let drawn: Int
    var found: Int? = nil
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

    /// "2/10" in the path's deep color on its soft tint, or a gold check and "10/10";
    /// "2 found" while searching.
    private var count: some View {
        HStack(spacing: 4) {
            if let found {
                Text("\(found) found")
                    .scaledFont(15, .heavy, relativeTo: .footnote)
                    .monospacedDigit()
            } else {
                if isComplete {
                    Image(systemName: "checkmark")
                        .scaledFont(12, .heavy, relativeTo: .footnote, design: .default)
                }
                Text("\(drawn)/\(path.lessonCount)")
                    .scaledFont(15, .heavy, relativeTo: .footnote)
                    .monospacedDigit()
            }
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
        if let found {
            parts.append("\(found) \(found == 1 ? "lesson" : "lessons") found")
            return parts.joined(separator: ", ")
        }
        if let description = path.description { parts.append(description) }
        parts.append(isComplete ? "all \(path.lessonCount) drawn" : "\(drawn) of \(path.lessonCount) drawn")
        return parts.joined(separator: ", ")
    }
}

/// A path's chip in the jump row: its name and "3/10" on its soft tint, or the
/// whole capsule in the path's deep color while its lessons are the ones on show.
/// The filled chip is what names the path once its header has scrolled away, so it
/// carries the count the pinned header used to. A search that finds nothing offers
/// a few of these too, never filled.
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

/// Chips laid out left to right, wrapping to a new row when the next one would not
/// fit — for the no-results card, where a sideways scroll inside a card would hide
/// the very suggestions it is there to offer. A chip wider than the row gets the
/// row's width.
private struct ChipFlow: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        arrange(subviews, in: proposal.width ?? .infinity).size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let frames = arrange(subviews, in: bounds.width).frames
        for (subview, frame) in zip(subviews, frames) {
            subview.place(at: CGPoint(x: bounds.minX + frame.minX, y: bounds.minY + frame.minY),
                          anchor: .topLeading,
                          proposal: ProposedViewSize(frame.size))
        }
    }

    private func arrange(_ subviews: Subviews, in width: CGFloat) -> (frames: [CGRect], size: CGSize) {
        var frames: [CGRect] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var widest: CGFloat = 0

        for subview in subviews {
            let ideal = subview.sizeThatFits(.unspecified)
            let size = CGSize(width: min(ideal.width, width), height: ideal.height)
            if x > 0, x + size.width > width {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            frames.append(CGRect(origin: CGPoint(x: x, y: y), size: size))
            widest = max(widest, x + size.width)
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return (frames, CGSize(width: widest, height: frames.isEmpty ? 0 : y + rowHeight))
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
