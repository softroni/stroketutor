import SwiftUI

/// `sk-book` — the Sketchbook tab: the learner's own pages, two to a row, grouped by
/// month, with the lesson and the date under each.
struct SketchbookView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        PlaceholderScreen(
            title: "Sketchbook",
            line: app.sketchbook.isEmpty
                ? "Nothing here yet. The page you photograph after a lesson goes in the sketchbook."
                : "\(app.sketchbook.count) pages, newest first."
        ) {
            ListCard {
                ForEach(Array(app.sketchbook.pages.enumerated()), id: \.element.id) { index, page in
                    if index > 0 { RowDivider() }
                    SettingsRow(title: app.lesson(id: page.lessonId)?.title ?? page.lessonId,
                                subtitle: page.completedAt.formatted(date: .abbreviated, time: .omitted),
                                systemImage: "photo",
                                tint: .gold) {
                        app.push(.sketchbookEntry(pageId: page.id))
                    }
                }
            }
        }
        .toolbar(.hidden, for: .navigationBar)
    }
}
