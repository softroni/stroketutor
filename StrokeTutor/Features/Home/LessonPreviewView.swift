import SwiftUI

/// `hp-preview` — the lesson before it starts: the reference and the finished
/// drawing side by side, the time and the steps, the objective, and the one button.
/// A lesson left part-way offers "Continue from step n" and "Start over".
struct LessonPreviewView: View {
    let lessonId: String

    @Environment(AppModel.self) private var app

    var body: some View {
        Group {
            if let lesson = app.lesson(id: lessonId) {
                PlaceholderScreen(
                    title: lesson.title,
                    line: "\(lesson.estimatedTimeText) · \(lesson.stepCountText). \(lesson.objective)",
                    actionTitle: resumeStep(for: lesson) == nil
                        ? "Start drawing"
                        : "Continue from step \((resumeStep(for: lesson) ?? 0) + 1)",
                    action: { app.presentPlayer(lesson, resumeFrom: resumeStep(for: lesson)) },
                    secondaryTitle: resumeStep(for: lesson) == nil ? nil : "Start over",
                    secondaryAction: resumeStep(for: lesson) == nil ? nil : {
                        app.progress.clearResume(lesson.id)
                        app.presentPlayer(lesson)
                    }
                ) {
                    HStack(alignment: .top, spacing: Theme.stackSpacing) {
                        ReferenceImageView(reference: lesson.reference)
                            .frame(height: 150)
                            .frame(maxWidth: .infinity)
                            .clipShape(RoundedRectangle(cornerRadius: Theme.thumbCornerRadius, style: .continuous))
                        DrawingThumbnail(tutorial: lesson.tutorial)
                            .frame(height: 150)
                            .frame(maxWidth: .infinity)
                            .cardBackground(cornerRadius: Theme.thumbCornerRadius)
                    }
                }
            } else {
                PlaceholderScreen(title: "Lesson", line: "This lesson is no longer installed.")
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }

    private func resumeStep(for lesson: Lesson) -> Int? {
        app.progress.resumeStep(for: lesson.id)
    }
}
