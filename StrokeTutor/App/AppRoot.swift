import SwiftUI

/// The root of the app. Loads the content once, shows the tabs, and presents the
/// four full-screen flows on top of them: onboarding on first run, then the player,
/// completion and capture that follow a lesson.
///
/// Covers rather than pushes, because none of these belongs to a tab's back stack
/// (`v3.html`: `ob-*`, `pl-player`, `sk-complete`, `sk-capture`).
struct AppRoot: View {
    @State private var app = AppModel()

    var body: some View {
        @Bindable var app = app

        MainTabs()
            .environment(app)
            .background(Theme.page.ignoresSafeArea())
            .task {
                guard !app.hasLoadedContent else { return }
                app.loadContent()
                if !app.settings.hasCompletedOnboarding {
                    app.presentOnboarding()
                }
            }
            .fullScreenCover(item: $app.cover) { cover in
                content(for: cover)
                    .environment(app)
            }
    }

    @ViewBuilder
    private func content(for cover: AppCover) -> some View {
        switch cover {
        case .onboarding:
            OnboardingFlow(onFinished: { lesson in
                app.finishOnboarding()
                if let lesson { app.showPreview(of: lesson) }
            })

        case let .player(lessonId, resumeFrom):
            if let lesson = app.lesson(id: lessonId) {
                PlayerScreen(lesson: lesson, resumeFrom: resumeFrom)
            } else {
                missingLesson
            }

        case let .completion(lessonId):
            if let lesson = app.lesson(id: lessonId) {
                CompletionView(lesson: lesson)
            } else {
                missingLesson
            }

        case let .capture(lessonId):
            if let lesson = app.lesson(id: lessonId) {
                CaptureFlow(lesson: lesson)
            } else {
                missingLesson
            }
        }
    }

    /// Only reachable if the content changed under a cover — a reinstall with a
    /// different catalog, say. Calm, and it always lets the learner out.
    private var missingLesson: some View {
        VStack(spacing: Theme.stackSpacing) {
            Text("That lesson is no longer installed.")
                .textRole(.title3)
                .multilineTextAlignment(.center)
            Button("Close") { app.dismissCover() }
                .buttonStyle(.secondary)
        }
        .padding(Theme.gutter)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.page.ignoresSafeArea())
    }
}
