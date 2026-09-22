import SwiftUI

/// `hp-home` — the Home tab, and the app's home. Told in pictures and colors, with
/// as few words as it can manage, because its learners are 8 to 16:
///
/// 1. **The hero** — *what do I draw next?* The next lesson, drawn large and in
///    color, with its path's name on a chip in the path's own tint, and one button.
/// 2. **Your paths** — one shelf per path the learner is drawing: the current path
///    first (even before anything in it is drawn), then every other path they have
///    started, most recently drawn first. Each shelf is a band in the path's tint
///    (`PathTint`, the same color it wears on All paths and the Path screen) with
///    its lessons as tiles scrolling sideways: done in gold, the next in green,
///    what is coming as a faded outline with a small lock.
/// 3. **Your drawings** — once the sketchbook has pages, the latest few photos in a
///    strip; a tap goes to the Sketchbook tab.
/// 4. **Try something new** — up to four paths not yet started, as picture cards
///    in their tints (the path's first lesson in color on white paper), and "See
///    all paths". Gone once every path is started.
///
/// Home only shows what a learner is doing and a few doors onward, so it stays
/// short however big the catalog grows; All paths is the full list. Level names
/// and descriptions, path descriptions and "Lesson 3 of 10" are not printed —
/// VoiceOver still reads the descriptions and the lesson's place.
///
/// Nothing on this screen can go down: no streak, no score, no goal. A shelf counts
/// finished drawings and nothing else. Lina, the tutor, is not on Home.
///
/// Each shelf opens already scrolled to its next lesson, so what is drawn sits to
/// the left, what is coming to the right, and the tile to tap is in the middle.
struct HomeView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var lockedLesson: LockedLesson?
    @State private var isShowingProfiles = false
    /// The learner picked in the switcher, handed over once the sheet has closed.
    @State private var chosenProfile: UUID?

    /// How many untouched paths "Try something new" offers.
    private static let suggestionCount = 4
    /// How many of the newest sketchbook pages the drawings strip shows.
    private static let recentPageCount = 6

    var body: some View {
        ScrollView {
            // Full bleed: the drawings strip scrolls edge to edge, so everything
            // else takes the gutter itself.
            LazyVStack(alignment: .leading, spacing: 0) {
                header
                    .padding(.horizontal, Theme.gutter)

                if shipped.isEmpty {
                    emptyCatalogCard
                        .padding(.horizontal, Theme.gutter)
                        .padding(.top, Theme.stackSpacing)
                } else {
                    hero
                        .padding(.horizontal, Theme.gutter)
                        .padding(.top, Theme.stackSpacing)

                    ForEach(shelves) { path in
                        PathShelf(path: path,
                                  tint: app.tint(for: path),
                                  progress: app.progress,
                                  onOpenPath: { app.open(path) },
                                  onOpenLesson: { open($0, in: path) })
                            .padding(.horizontal, Theme.gutter)
                            .padding(.top, 22)
                    }

                    if !recentPages.isEmpty {
                        drawingsStrip
                            .padding(.top, 34)
                    }

                    if !suggestions.isEmpty {
                        trySomethingNew
                            .padding(.horizontal, Theme.gutter)
                            .padding(.top, 34)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 6)
            .padding(.bottom, 24)
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

    // MARK: - Header

    /// "Home" and who is drawing. Nothing else: the drawings have their own strip
    /// further down.
    private var header: some View {
        HStack(alignment: .center, spacing: 8) {
            Text("Home")
                .textRole(.largeTitle)
                .foregroundStyle(Theme.ink)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: 0)
            profileButton
        }
    }

    /// Who is drawing, always in view — even with one learner, so a family finds
    /// out a second can be added. Opens the switcher.
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

    // MARK: - Hero

    /// The path the hero speaks for: the current one while it still has a lesson to
    /// offer, then the first shelf that does, then any path that does. Nil once
    /// every lesson of every path is drawn.
    private var heroPath: PathModel? {
        (shelves + shipped).first { app.progress.nextLesson(in: $0) != nil }
    }

    @ViewBuilder
    private var hero: some View {
        if let path = heroPath, let lesson = app.progress.nextLesson(in: path) {
            let position = path.position(of: lesson.id) ?? 1
            let isResuming = app.progress.resumeStep(for: lesson.id) != nil
            HeroCard(chip: path.title,
                     tint: app.tint(for: path),
                     title: lesson.title,
                     meta: "\(lesson.estimatedMinutes) min",
                     drawing: lesson.tutorial,
                     actionTitle: isResuming ? "Keep drawing" : "Start drawing",
                     accessibilityContext: "\(hasBegun(in: path) ? "Continue" : "Start here"), lesson \(position) of \(path.lessonCount)") {
                app.showPreview(of: lesson)
            }
        } else if let last = shipped.last?.lessons.last {
            // Every lesson of every path is drawn. The hero stops offering a lesson
            // and points at the one place that holds them all.
            let count = shipped.reduce(0) { $0 + $1.lessonCount }
            HeroCard(chip: "All done",
                     tint: nil,
                     title: "You drew every lesson!",
                     meta: "\(count) \(count == 1 ? "drawing" : "drawings")",
                     metaSystemImage: "checkmark",
                     drawing: last.tutorial,
                     actionTitle: "Open your sketchbook") {
                app.selectedTab = .sketchbook
            }
        }
    }

    /// Whether anything in this path has happened yet: a drawing finished, or the
    /// next lesson left paused part-way. VoiceOver hears "Continue" rather than
    /// "Start here" on the hero.
    private func hasBegun(in path: PathModel) -> Bool {
        guard let next = app.progress.nextLesson(in: path) else { return true }
        return app.progress.drawnCount(in: path) > 0
            || app.progress.resumeStep(for: next.id) != nil
    }

    // MARK: - What the screen lists

    /// Every path with lessons in the bundle, in catalog order. A path with nothing
    /// installed is never offered.
    private var shipped: [PathModel] {
        app.paths.filter { !$0.isEmpty }
    }

    /// The shelves: the current path first, always, then every other path with at
    /// least one drawing, most recently drawn first.
    private var shelves: [PathModel] {
        let current = app.currentPath.flatMap { current in shipped.first { $0.id == current.id } }
        let started = shipped
            .enumerated()
            .filter { $0.element.id != current?.id && app.progress.drawnCount(in: $0.element) > 0 }
            .sorted { lhs, rhs in
                let (left, right) = (lastDrawn(in: lhs.element), lastDrawn(in: rhs.element))
                return left == right ? lhs.offset < rhs.offset : left > right
            }
            .map(\.element)
        return (current.map { [$0] } ?? []) + started
    }

    /// Up to four paths without a shelf, the current path's level first — the next
    /// thing a learner at that level is likely to enjoy — then the catalog's order,
    /// easiest first.
    private var suggestions: [PathModel] {
        let shelved = Set(shelves.map(\.id))
        let fresh = shipped.filter { !shelved.contains($0.id) }
        let level = app.currentPath?.level
        let sameLevel = fresh.filter { level != nil && $0.level == level }
        let others = fresh.filter { level == nil || $0.level != level }
        return Array((sameLevel + others).prefix(Self.suggestionCount))
    }

    private var recentPages: [SketchbookPage] {
        Array(app.sketchbook.pages.prefix(Self.recentPageCount))
    }

    private func lastDrawn(in path: PathModel) -> Date {
        path.lessons
            .compactMap { app.progress.progress(for: $0.id)?.completedAt }
            .max() ?? .distantPast
    }

    // MARK: - Your drawings

    /// The newest pages of the sketchbook, small, in a row that scrolls sideways.
    /// The heading and every page go to the Sketchbook tab.
    private var drawingsStrip: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button {
                app.selectedTab = .sketchbook
            } label: {
                SectionTitle(text: "Your drawings", showsChevron: true)
            }
            .buttonStyle(.plain)
            .padding(.horizontal, Theme.gutter)
            .accessibilityLabel("Your drawings, \(app.sketchbook.count) in your sketchbook")
            .accessibilityHint("Opens your sketchbook")
            .accessibilityAddTraits(.isHeader)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(recentPages) { page in
                        let lesson = app.lesson(id: page.lessonId)
                        Button {
                            app.selectedTab = .sketchbook
                        } label: {
                            SketchbookPageThumb(page: page,
                                                tutorial: lesson?.tutorial,
                                                width: dynamicTypeSize.isAccessibilitySize ? 120 : 96)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Your \(lesson?.title ?? "drawing")")
                        .accessibilityHint("Opens your sketchbook")
                    }
                }
                .padding(.horizontal, Theme.gutter)
                .padding(.vertical, 2)
            }
        }
    }

    // MARK: - Try something new

    private var trySomethingNew: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionTitle(text: "Try something new", showsChevron: false)
                .accessibilityAddTraits(.isHeader)

            PictureGrid(columns: dynamicTypeSize.isAccessibilitySize ? 1 : 2,
                        spacing: 14,
                        centersLastRow: false) {
                ForEach(suggestions) { path in
                    NewPathCard(path: path, tint: app.tint(for: path)) {
                        app.open(path)
                    }
                }
            }

            Button {
                app.showAllPaths()
            } label: {
                Label("See all paths", systemImage: "square.grid.2x2")
            }
            .buttonStyle(.secondary)
            .padding(.top, 6)
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

/// A section's name on Home, big and bold like the level titles on All paths,
/// with a chevron when the whole title is a button.
private struct SectionTitle: View {
    let text: String
    let showsChevron: Bool

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(text)
                .textRole(.title2)
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
            if showsChevron {
                Image(systemName: "chevron.right")
                    .scaledFont(17, .heavy, relativeTo: .title3, design: .default)
                    .foregroundStyle(Theme.ink40)
            }
        }
        .frame(minHeight: Theme.navTapTarget)
        .contentShape(Rectangle())
    }
}

/// One path as a shelf: a band in the path's tint (gold once every lesson is drawn)
/// with a 5 pt deeper edge, the path's name and a chevron on top — the name is the
/// button that opens the path — and its lessons as tiles in a row that scrolls
/// sideways inside the band.
private struct PathShelf: View {
    let path: PathModel
    let tint: PathTint
    let progress: ProgressStore
    let onOpenPath: () -> Void
    let onOpenLesson: (Lesson) -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var paint: PathTint { isComplete ? .complete : tint }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Theme.canvasCornerRadius, style: .continuous)
        VStack(alignment: .leading, spacing: 0) {
            header
            ScrollViewReader { proxy in
                ScrollView(.horizontal, showsIndicators: false) {
                    // Not lazy: ten tiles, and `scrollTo` must find the next one
                    // before it has ever been on screen. The shelves themselves
                    // are built lazily by Home's outer stack.
                    HStack(alignment: .top, spacing: 14) {
                        ForEach(Array(path.lessons.enumerated()), id: \.element.id) { index, lesson in
                            LessonTile(lesson: lesson,
                                       position: index + 1,
                                       state: state(of: lesson),
                                       tint: paint) {
                                onOpenLesson(lesson)
                            }
                            .id(lesson.id)
                        }
                    }
                    .padding(.horizontal, 16)
                    // Room for the "Next" flag and the check badge, which sit on
                    // the tile's top edge.
                    .padding(.top, 12)
                    .padding(.bottom, 10)
                }
                .onAppear { center(proxy, animated: false) }
                .onChange(of: nextLessonId) { center(proxy, animated: !reduceMotion) }
            }
        }
        .background(paint.soft)
        .clipShape(shape)
        .background(alignment: .bottom) {
            shape.fill(paint.edge).offset(y: 5)
        }
        .padding(.bottom, 5)
    }

    private var header: some View {
        Button(action: onOpenPath) {
            HStack(alignment: .center, spacing: 8) {
                Text(path.title)
                    .textRole(.title2)
                    .foregroundStyle(Theme.ink)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                Image(systemName: "chevron.right")
                    .scaledFont(17, .heavy, relativeTo: .title3, design: .default)
                    .foregroundStyle(paint.deep)
                Spacer(minLength: 8)
                count
            }
            .padding(.horizontal, 18)
            .padding(.top, 10)
            .frame(minHeight: Theme.navTapTarget + 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint("Opens the whole path")
        .accessibilityAddTraits([.isButton, .isHeader])
    }

    /// "2/10" in the path's deep color on white, or a gold check and "10/10".
    /// A count of finished drawings, never a percentage and never a target.
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
        .background(Capsule().fill(Theme.paper))
        .fixedSize()
    }

    private var drawn: Int { progress.drawnCount(in: path) }
    private var isComplete: Bool { drawn == path.lessonCount && path.lessonCount > 0 }
    private var nextLessonId: String? { progress.nextLesson(in: path)?.id }

    /// The name, what the path is about (no longer printed), and the count.
    private var accessibilityLabel: String {
        var parts = [path.title]
        if let description = path.description { parts.append(description) }
        if isComplete {
            parts.append("all \(path.lessonCount) drawn")
        } else {
            parts.append("\(drawn) of \(path.lessonCount) drawn")
        }
        return parts.joined(separator: ", ")
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

/// A path not yet started, offered under "Try something new": the path's soft tint
/// with a 4 pt deeper edge, its first lesson drawn in color on white paper, and its
/// name. The same card as All paths, minus the count. The description is read by
/// VoiceOver only.
private struct NewPathCard: View {
    let path: PathModel
    let tint: PathTint
    let action: () -> Void

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Theme.cardCornerRadius, style: .continuous)
        Button(action: action) {
            VStack(spacing: 8) {
                DrawingThumbnail(tutorial: path.lessons.first?.tutorial,
                                 strokeColor: nil,
                                 showsFills: true)
                    .frame(maxWidth: 100)
                    .frame(height: 96)
                    .padding(10)
                    .frame(maxWidth: .infinity)
                    .background(
                        RoundedRectangle(cornerRadius: Theme.thumbCornerRadius, style: .continuous)
                            .fill(Theme.paper)
                    )

                Text(path.title)
                    .scaledFont(18, .heavy, relativeTo: .headline)
                    .tracking(-0.2)
                    .foregroundStyle(Theme.ink)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity)

                Spacer(minLength: 0)
            }
            .padding(.init(top: 10, leading: 10, bottom: 12, trailing: 10))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(shape.fill(tint.soft))
            .background(alignment: .bottom) {
                shape.fill(tint.edge).offset(y: 4)
            }
            .padding(.bottom, 4)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel([path.title, path.description, "\(path.lessonCount) \(path.lessonCount == 1 ? "lesson" : "lessons")"]
            .compactMap { $0 }
            .joined(separator: ", "))
        .accessibilityHint("Starts this path")
        .accessibilityAddTraits(.isButton)
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
