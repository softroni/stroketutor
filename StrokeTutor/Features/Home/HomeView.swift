import SwiftUI

/// `hp-home` — the Learn tab, and the app's home. One question, one answer: what do
/// I draw next? The hero banner answers it in one tap; the path underneath shows
/// where it leads, as a column of finished drawings.
///
/// Phase 1 builds the real thing from the real catalog — title and sketchbook chip,
/// hero, path header, nodes — so the components and the content join are proven.
/// Phase 2 finishes the details against `v3.html#hp-home`.
struct HomeView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                header

                if let path = app.currentPath, !path.isEmpty {
                    hero(for: path)
                    pathHeader(for: path)
                    PathNodesView(lessons: path.lessons, progress: app.progress) { lesson in
                        open(lesson, in: path)
                    }
                    Button("See the whole path") {
                        app.push(.pathDetail(pathId: path.id))
                    }
                    .buttonStyle(.quiet)
                    .frame(maxWidth: .infinity)
                } else {
                    emptyCatalogCard
                }
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.top, 6)
            .padding(.bottom, 16)
        }
        .background(Theme.page)
        .toolbar(.hidden, for: .navigationBar)
    }

    // MARK: - Parts

    private var header: some View {
        HStack {
            Text("Learn")
                .textRole(.largeTitle)
                .foregroundStyle(Theme.ink)
            Spacer(minLength: 8)
            Button {
                app.selectedTab = .sketchbook
            } label: {
                Chip(text: drawingsText, systemImage: "book", style: .gold)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(drawingsText) in your sketchbook")
        }
    }

    private var drawingsText: String {
        let count = app.sketchbook.count
        return count == 1 ? "1 drawing" : "\(count) drawings"
    }

    @ViewBuilder
    private func hero(for path: PathModel) -> some View {
        let drawn = app.progress.drawnCount(in: path)
        if let lesson = app.progress.nextLesson(in: path) {
            HeroCard(eyebrow: "\(drawn > 0 ? "Continue" : "Start here") · \(path.title)",
                     title: lesson.title,
                     meta: "Lesson \(path.position(of: lesson.id) ?? 1) of \(path.lessonCount) · \(lesson.estimatedTimeText)",
                     drawing: lesson.tutorial,
                     actionTitle: "Start drawing") {
                app.showPreview(of: lesson)
            }
        } else if let last = path.lessons.last {
            HeroCard(eyebrow: "Finished · \(path.title)",
                     title: "You have drawn every lesson in this path.",
                     meta: "Choose another path, or draw one again.",
                     drawing: last.tutorial,
                     actionTitle: "Choose another path") {
                app.push(.paths)
            }
        }
    }

    private func pathHeader(for path: PathModel) -> some View {
        HStack {
            Text("\(path.title) · \(app.progress.drawnCount(in: path)) of \(path.lessonCount) drawn".uppercased())
                .textRole(.eyebrow)
                .foregroundStyle(Theme.ink55)
            Spacer(minLength: 8)
            Button("All paths") { app.push(.paths) }
                .buttonStyle(.quietLink)
        }
        .padding(.horizontal, 4)
        .padding(.top, 8)
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

    /// A locked lesson opens the path, where the sheet says what comes first.
    private func open(_ lesson: Lesson, in path: PathModel) {
        if app.progress.isUnlocked(lesson, in: path) {
            app.showPreview(of: lesson)
        } else {
            app.push(.pathDetail(pathId: path.id))
        }
    }
}
