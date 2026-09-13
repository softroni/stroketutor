import SwiftUI

/// `hp-home` — the Learn tab, and the app's home. One question, one answer: what do
/// I draw next? The hero banner answers it in one tap; the path underneath shows
/// where it leads, as a column of finished drawings.
///
/// Nothing on this screen can go down: no streak, no score, no goal. The only thing
/// that moves is the current node's halo, and that stops under Reduce Motion.
///
/// Two states, as in the mockup. **In progress** carries the gold sketchbook chip
/// and ends with "See the whole path". **First time** — nothing drawn anywhere and
/// an empty sketchbook, the state `ob-ready` hands over — replaces the chip with one
/// line under the title and ends with an honest empty-sketchbook line instead.
struct HomeView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                if let path = app.currentPath, !path.isEmpty {
                    title(for: path)
                    hero(for: path)
                    pathHeader(for: path)
                    PathNodesView(lessons: path.lessons,
                                  progress: app.progress) { lesson in
                        open(lesson, in: path)
                    }
                    footer(for: path)
                } else {
                    title(for: nil)
                    emptyCatalogCard
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Theme.gutter)
            .padding(.top, 6)
            .padding(.bottom, 16)
        }
        .background(Theme.page)
        .toolbar(.hidden, for: .navigationBar)
    }

    // MARK: - Title

    /// "Learn", with the gold sketchbook chip beside it — or, the first time, one
    /// line of context under it instead, because there is nothing to count yet.
    @ViewBuilder
    private func title(for path: PathModel?) -> some View {
        if isFirstTime, let path {
            VStack(alignment: .leading, spacing: 6) {
                learnTitle
                Text("You chose \(path.title). Here is where it starts.")
                    .textRole(.bodyRegular)
                    .foregroundStyle(Theme.ink55)
                    .fixedSize(horizontal: false, vertical: true)
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
            }
        }
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

    // MARK: - Hero

    @ViewBuilder
    private func hero(for path: PathModel) -> some View {
        if let lesson = app.progress.nextLesson(in: path) {
            let drawn = app.progress.drawnCount(in: path)
            let position = path.position(of: lesson.id) ?? 1
            HeroCard(eyebrow: "\(drawn > 0 ? "Continue" : "Start here") · \(path.title)",
                     title: lesson.title,
                     meta: "Lesson \(position) of \(path.lessonCount) · \(lesson.estimatedTimeText)",
                     drawing: lesson.tutorial,
                     actionTitle: "Start drawing") {
                app.showPreview(of: lesson)
            }
        } else if let last = path.lessons.last {
            // Every lesson of the path is drawn. The hero stops offering a lesson
            // and points somewhere the learner can still go (`hp-path`, complete).
            HeroCard(eyebrow: "Finished · \(path.title)",
                     title: "You have drawn every \(PathCopy.subject(of: path)) in this path.",
                     meta: "\(path.lessonCount) \(path.lessonCount == 1 ? "drawing" : "drawings"), all yours.",
                     drawing: last.tutorial,
                     actionTitle: "Choose another path") {
                app.push(.paths)
            }
        }
    }

    // MARK: - The path

    private func pathHeader(for path: PathModel) -> some View {
        HStack(alignment: .center, spacing: 8) {
            Text(pathEyebrow(for: path).uppercased())
                .textRole(.eyebrow)
                .foregroundStyle(Theme.ink55)
            Spacer(minLength: 0)
            HomeLink(title: "All paths", tint: Theme.blue) { app.push(.paths) }
        }
        .padding(.horizontal, 4)
        .padding(.top, 8)
    }

    /// "Houses · 2 of 10 drawn", or "Houses · Ten drawings" before anything is drawn.
    private func pathEyebrow(for path: PathModel) -> String {
        let drawn = app.progress.drawnCount(in: path)
        guard drawn > 0 else {
            let count = path.lessonCount
            return "\(path.title) · \(PathCopy.spelled(count)) \(count == 1 ? "drawing" : "drawings")"
        }
        return "\(path.title) · \(drawn) of \(path.lessonCount) drawn"
    }

    @ViewBuilder
    private func footer(for path: PathModel) -> some View {
        if isFirstTime {
            Text("Your sketchbook is empty. Your first finished page goes there.")
                .textRole(.footnote)
                .foregroundStyle(Theme.ink40)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 16)
                .frame(maxWidth: .infinity)
        } else {
            HomeLink(title: "See the whole path", tint: Theme.ink70) {
                app.push(.pathDetail(pathId: path.id))
            }
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

    // MARK: - Tapping a node

    /// A done or current node opens the lesson. A locked one opens the path, where
    /// the sheet names the lesson that has to come first — the whole path is the
    /// answer to "why not this one yet", so the learner is taken to it.
    private func open(_ lesson: Lesson, in path: PathModel) {
        if app.progress.isUnlocked(lesson, in: path) {
            app.showPreview(of: lesson)
        } else {
            app.pendingLockedLessonId = lesson.id
            app.push(.pathDetail(pathId: path.id))
        }
    }
}

/// A quiet 15 pt link (`.hp-link`): the size of a caption, the hit area of a
/// control. "All paths" and "See the whole path".
private struct HomeLink: View {
    let title: String
    let tint: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundStyle(tint)
                .frame(minHeight: Theme.navTapTarget)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
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
