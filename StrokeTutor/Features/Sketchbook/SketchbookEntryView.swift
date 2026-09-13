import SwiftUI

/// `sk-entry` — one page: the photograph large, the lesson, the path and the date,
/// the learner's note, and the three actions (draw it again, share, delete).
struct SketchbookEntryView: View {
    let pageId: UUID

    @Environment(AppModel.self) private var app

    var body: some View {
        Group {
            if let page = app.sketchbook.page(id: pageId) {
                PlaceholderScreen(
                    title: app.lesson(id: page.lessonId)?.title ?? "Your page",
                    line: page.completedAt.formatted(date: .long, time: .omitted),
                    actionTitle: "Draw it again",
                    action: {
                        if let lesson = app.lesson(id: page.lessonId) {
                            app.showPreview(of: lesson)
                        }
                    }
                ) {
                    if let image = app.sketchbook.image(for: page) {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFit()
                            .clipShape(RoundedRectangle(cornerRadius: Theme.thumbCornerRadius, style: .continuous))
                    }
                }
            } else {
                PlaceholderScreen(title: "Your page", line: "This page is no longer in your sketchbook.")
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }
}
