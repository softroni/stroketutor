import SwiftUI

/// `hp-home` — the Learn tab, and the app's home. Two questions, answered in order.
/// *What do I draw next?* — the hero banner, one tap. *What else is there?* — every
/// path as a shelf: one row per path, its lessons as square tiles of the finished
/// drawings, scrolling sideways. A learner chooses by picture, not by reading.
///
/// Nothing on this screen can go down: no streak, no score, no goal. A shelf counts
/// finished drawings and nothing else.
///
/// Each shelf opens already scrolled to its next lesson, so what is drawn sits to
/// the left, what is coming to the right, and the tile to tap is in the middle.
/// Shelves keep the catalog's order on every visit — a learner finds a path where
/// they left it — and sit under the catalog's level headings when it has levels.
///
/// Two states. **In progress** carries the gold sketchbook chip. **First time** —
/// nothing drawn anywhere and an empty sketchbook, the state `ob-ready` hands over —
/// replaces the chip with one line under the title and ends with an honest
/// empty-sketchbook line.
struct HomeView: View {
    @Environment(AppModel.self) private var app
    @State private var lockedLesson: LockedLesson?
    @State private var isShowingProfiles = false
    /// The kid picked in the switcher, handed over once the sheet has closed.
    @State private var chosenProfile: UUID?

    var body: some View {
        ScrollView {
            // Full bleed: the shelves scroll edge to edge, so everything else takes
            // the gutter itself.
            LazyVStack(alignment: .leading, spacing: Theme.stackSpacing) {
                if sections.isEmpty {
                    title(for: nil).padding(.horizontal, Theme.gutter)
                    emptyCatalogCard.padding(.horizontal, Theme.gutter)
                } else {
                    title(for: app.currentPath).padding(.horizontal, Theme.gutter)
                    hero.padding(.horizontal, Theme.gutter)

                    ForEach(sections) { section in
                        if let level = section.level {
                            levelHeader(level)
                        }
                        ForEach(section.paths) { path in
                            PathShelf(path: path,
                                      progress: app.progress,
                                      onOpenPath: { app.push(.pathDetail(pathId: path.id)) },
                                      onOpenLesson: { open($0, in: path) })
                        }
                    }

                    footer
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 6)
            .padding(.bottom, 16)
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
        #if DEBUG
        .onAppear {
            guard DebugScreenHarness.raiseProfileSwitcher else { return }
            DebugScreenHarness.raiseProfileSwitcher = false
            isShowingProfiles = true
        }
        #endif
        .sheet(isPresented: $isShowingProfiles, onDismiss: {
            guard let chosen = chosenProfile else { return }
            chosenProfile = nil
            app.switchProfile(to: chosen)
        }) {
            ProfileSwitcherSheet(onChoose: { chosenProfile = $0 })
        }
    }

    // MARK: - Title

    /// "Learn", with the gold sketchbook chip beside it — or, the first time, one
    /// line of context under it instead, because there is nothing to count yet.
    @ViewBuilder
    private func title(for path: PathModel?) -> some View {
        if isFirstTime, let path {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .center, spacing: 8) {
                    learnTitle
                    Spacer(minLength: 0)
                    profileButton
                }
                if !hasBegun(in: path) {
                    Text("You chose \(path.title). Start there, or pick any picture you like.")
                        .textRole(.bodyRegular)
                        .foregroundStyle(Theme.ink55)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        } else {
            HStack(alignment: .center, spacing: 8) {
                learnTitle
                Spacer(minLength: 0)
                Button {
                    app.selectedTab = .sketchbook
                } label: {
                    Chip(text: drawingsText, systemImage: "book", style: .gold)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(drawingsText) in your sketchbook")
                .accessibilityAddTraits(.isButton)
                profileButton
            }
        }
    }

    /// Who is drawing, always in view — even with one kid, so a family finds out a
    /// second can be added. Opens the switcher.
    private var profileButton: some View {
        Button {
            isShowingProfiles = true
        } label: {
            ProfileAvatarView(avatar: app.activeProfile.avatar, size: 44)
                .frame(width: Theme.navTapTarget, height: Theme.navTapTarget)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(app.activeProfile.displayName) is drawing")
        .accessibilityHint("Switch who’s drawing, or add someone")
    }

    private var learnTitle: some View {
        Text("Learn")
            .textRole(.largeTitle)
            .foregroundStyle(Theme.ink)
            .accessibilityAddTraits(.isHeader)
    }

    private var drawingsText: String {
        let count = app.sketchbook.count
        return count == 1 ? "1 drawing" : "\(count) drawings"
    }

    /// Straight out of onboarding: nothing drawn in any path, and no page saved.
    private var isFirstTime: Bool {
        app.sketchbook.count == 0
            && app.paths.allSatisfy { app.progress.drawnCount(in: $0) == 0 }
    }

    /// Whether anything in this path has happened yet: a drawing finished, or the
    /// next lesson left paused part-way. "Continue" rather than "Start here" on the
    /// hero, and no "start there" line under the title.
    private func hasBegun(in path: PathModel) -> Bool {
        guard let next = app.progress.nextLesson(in: path) else { return true }
        return app.progress.drawnCount(in: path) > 0
            || app.progress.resumeStep(for: next.id) != nil
    }

    // MARK: - Hero

    /// The path the hero speaks for: the current one while it still has a lesson to
    /// offer, then the first shelf that does. Nil once every shelf is drawn.
    private var heroPath: PathModel? {
        if let current = app.currentPath, app.progress.nextLesson(in: current) != nil {
            return current
        }
        return shelves.first { app.progress.nextLesson(in: $0) != nil }
    }

    @ViewBuilder
    private var hero: some View {
        if let path = heroPath, let lesson = app.progress.nextLesson(in: path) {
            let position = path.position(of: lesson.id) ?? 1
            HeroCard(eyebrow: "\(hasBegun(in: path) ? "Continue" : "Start here") · \(path.title)",
                     title: lesson.title,
                     meta: "Lesson \(position) of \(path.lessonCount) · \(lesson.estimatedTimeText)",
                     drawing: lesson.tutorial,
                     actionTitle: "Start drawing") {
                app.showPreview(of: lesson)
            }
        } else if let last = shelves.last?.lessons.last {
            // Every lesson of every path is drawn. The hero stops offering a lesson
            // and points at the one place that holds them all.
            let count = shelves.reduce(0) { $0 + $1.lessonCount }
            HeroCard(eyebrow: "Finished",
                     title: "You have drawn every lesson.",
                     meta: "\(count) \(count == 1 ? "drawing" : "drawings"), all yours.",
                     drawing: last.tutorial,
                     actionTitle: "Open your sketchbook") {
                app.selectedTab = .sketchbook
            }
        }
    }

    // MARK: - The shelves

    /// The shelves, in the order and the groups the screen draws them: the catalog's
    /// level sections, then a last section without a heading for the paths that
    /// belong to no level. A path with no lessons in the bundle is not offered.
    private var sections: [HomeSection] {
        app.catalog.pathSections.compactMap { section in
            let shipped = section.paths.compactMap { app.path(id: $0.id) }.filter { !$0.isEmpty }
            guard !shipped.isEmpty else { return nil }
            return HomeSection(level: section.level, paths: shipped)
        }
    }

    private var shelves: [PathModel] {
        sections.flatMap(\.paths)
    }

    /// A level's name with its one line underneath. One accessibility element, read
    /// as a heading, so VoiceOver announces the group before the shelves in it.
    private func levelHeader(_ level: CatalogLevel) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(level.title.uppercased())
                .textRole(.eyebrow)
                .foregroundStyle(Theme.green)

            if let description = level.description {
                Text(description)
                    .textRole(.footnote)
                    .foregroundStyle(Theme.ink55)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Theme.gutter)
        .padding(.top, 14)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }

    @ViewBuilder
    private var footer: some View {
        if isFirstTime {
            Text("Your sketchbook is empty. Your first finished page goes there.")
                .textRole(.footnote)
                .foregroundStyle(Theme.ink40)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, Theme.gutter + 16)
                .padding(.top, 8)
                .frame(maxWidth: .infinity)
        }
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

    // MARK: - Tapping a tile

    /// A drawn or next tile opens the lesson. A locked one raises the sheet that
    /// names the lesson that has to come first, right here — the learner asked
    /// "why not this one yet", and the answer does not need another screen.
    private func open(_ lesson: Lesson, in path: PathModel) {
        guard !app.progress.isUnlocked(lesson, in: path) else {
            app.showPreview(of: lesson)
            return
        }
        guard let index = path.lessons.firstIndex(where: { $0.id == lesson.id }),
              let blocking = path.lessons.prefix(index).first(where: { !app.progress.isCompleted($0.id) })
        else { return }
        lockedLesson = LockedLesson(lesson: lesson, blocking: blocking, position: index + 1)
    }
}

/// One heading's worth of Home: a level and the shelves under it, or no level at
/// all for the paths the catalog does not group.
private struct HomeSection: Identifiable {
    let level: CatalogLevel?
    let paths: [PathModel]

    /// A level id is never empty, so the unheaded section cannot collide with one.
    var id: String { level?.id ?? "" }
}

/// One path as a shelf: its name and "2 of 10" on a header that opens the path, then
/// its lessons as tiles in a row that scrolls sideways, edge to edge.
private struct PathShelf: View {
    let path: PathModel
    let progress: ProgressStore
    let onOpenPath: () -> Void
    let onOpenLesson: (Lesson) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            header
            ScrollViewReader { proxy in
                ScrollView(.horizontal, showsIndicators: false) {
                    // Not lazy: ten tiles, and `scrollTo` must find the next one
                    // before it has ever been on screen. The shelves themselves
                    // are built lazily by Home's outer stack.
                    HStack(alignment: .top, spacing: 12) {
                        ForEach(Array(path.lessons.enumerated()), id: \.element.id) { index, lesson in
                            LessonTile(lesson: lesson,
                                       position: index + 1,
                                       state: state(of: lesson)) {
                                onOpenLesson(lesson)
                            }
                            .id(lesson.id)
                        }
                    }
                    .padding(.horizontal, Theme.gutter)
                    .padding(.top, 2)
                }
                .onAppear { center(proxy, animated: false) }
                .onChange(of: nextLessonId) { center(proxy, animated: true) }
            }
        }
        .padding(.top, 10)
    }

    private var header: some View {
        Button(action: onOpenPath) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(path.title)
                    .textRole(.title3)
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                Spacer(minLength: 0)
                Text(countText)
                    .textRole(.footnote)
                    .foregroundStyle(isComplete ? Theme.goldDeep : Theme.ink55)
                Image(systemName: "chevron.right")
                    .scaledFont(13, .bold, design: .default)
                    .foregroundStyle(Theme.ink25)
            }
            .padding(.horizontal, Theme.gutter)
            .frame(minHeight: Theme.navTapTarget)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(path.title), \(countText)")
        .accessibilityHint("Opens the whole path")
        .accessibilityAddTraits([.isButton, .isHeader])
    }

    private var drawn: Int { progress.drawnCount(in: path) }
    private var isComplete: Bool { drawn == path.lessonCount }
    private var nextLessonId: String? { progress.nextLesson(in: path)?.id }

    /// "2 of 10", "All 10 drawn", or "10 drawings" before anything is drawn. A count
    /// of finished work, never a percentage and never a target.
    private var countText: String {
        if isComplete { return "All \(path.lessonCount) drawn" }
        guard drawn > 0 else {
            return "\(path.lessonCount) \(path.lessonCount == 1 ? "drawing" : "drawings")"
        }
        return "\(drawn) of \(path.lessonCount) drawn"
    }

    private func state(of lesson: Lesson) -> LessonTile.State {
        if progress.isCompleted(lesson.id) { return .done }
        return lesson.id == nextLessonId ? .next : .locked
    }

    /// Puts the next lesson in the middle of the shelf. A shelf that has not been
    /// started stays at its beginning, and a finished one too.
    private func center(_ proxy: ScrollViewProxy, animated: Bool) {
        guard let nextLessonId, drawn > 0 else { return }
        if animated {
            withAnimation(.easeInOut(duration: 0.35)) { proxy.scrollTo(nextLessonId, anchor: .center) }
        } else {
            proxy.scrollTo(nextLessonId, anchor: .center)
        }
    }
}

/// Wording shared by Home and the path detail, so the two never disagree about what
/// a finished path is called.
enum PathCopy {

    /// The path's subject in running text: "You have drawn every **house** in this
    /// path." Paths are named in the plural ("Houses", "Trees", "Cars"), so dropping
    /// a trailing "s" is the whole rule; a title that is already singular is left be.
    static func subject(of path: PathModel) -> String {
        let title = path.title.lowercased()
        guard title.count > 1, title.hasSuffix("s"), !title.hasSuffix("ss") else { return title }
        return String(title.dropLast())
    }

    /// "Ten", for "Houses · Ten drawings". A count nobody has started reads better
    /// as a word than as a digit; a count of finished work is always a digit.
    static func spelled(_ count: Int) -> String {
        guard let word = spellOut.string(from: NSNumber(value: count)) else { return "\(count)" }
        return word.prefix(1).uppercased() + word.dropFirst()
    }

    private static let spellOut: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .spellOut
        return formatter
    }()
}
