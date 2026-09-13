import SwiftUI

/// Turns a pushed `AppRoute` into its screen. One place, shared by all three tab
/// stacks, so a route means the same thing wherever it is pushed from.
struct AppDestination: View {
    let route: AppRoute

    var body: some View {
        switch route {
        case .paths:
            PathsView()
        case let .pathDetail(pathId):
            PathDetailView(pathId: pathId)
        case let .lessonPreview(lessonId):
            LessonPreviewView(lessonId: lessonId)
        case let .sketchbookEntry(pageId):
            SketchbookEntryView(pageId: pageId)
        case .narrationSettings:
            NarrationSettingsView()
        case .reminderSettings:
            ReminderSettingsView()
        case .about:
            AboutView()
        }
    }
}
