import SwiftUI

/// `hp-paths` — every path, as cards with a drawing tile, a progress bar and the
/// current path outlined in green.
struct PathsView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        PlaceholderScreen(
            title: "All paths",
            line: "Every path, with what you have drawn in each. Choosing one changes what Home offers."
        ) {
            ListCard {
                ForEach(Array(app.paths.enumerated()), id: \.element.id) { index, path in
                    if index > 0 { RowDivider() }
                    SettingsRow(title: path.title,
                                subtitle: "\(app.progress.drawnCount(in: path)) of \(path.lessonCount) drawn",
                                value: path.id == app.currentPath?.id ? "Current" : nil,
                                systemImage: "circle.grid.2x2",
                                tint: .green) {
                        app.select(path)
                        app.push(.pathDetail(pathId: path.id))
                    }
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }
}
