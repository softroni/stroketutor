import SwiftUI

/// `hp-path` — one path: the drawing it leads to, the description, the progress and
/// every node. A locked node opens the sheet that names the lesson that comes first.
struct PathDetailView: View {
    let pathId: String

    @Environment(AppModel.self) private var app

    var body: some View {
        Group {
            if let path = app.path(id: pathId) {
                ScrollView {
                    VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                        Text(path.description ?? "\(path.lessonCount) drawings, in order.")
                            .textRole(.body)
                            .foregroundStyle(Theme.ink55)
                        ProgressBar(value: progress(in: path))
                        PathNodesView(lessons: path.lessons, progress: app.progress) { lesson in
                            if app.progress.isUnlocked(lesson, in: path) {
                                app.showPreview(of: lesson)
                            }
                        }
                    }
                    .padding(.horizontal, Theme.gutter)
                    .padding(.vertical, Theme.stackSpacing)
                }
                .background(Theme.page)
                .navigationTitle(path.title)
            } else {
                PlaceholderScreen(title: "Path", line: "This path is no longer installed.")
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }

    private func progress(in path: PathModel) -> Double {
        guard path.lessonCount > 0 else { return 0 }
        return Double(app.progress.drawnCount(in: path)) / Double(path.lessonCount)
    }
}
