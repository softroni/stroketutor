import SwiftUI

/// `sk-complete` — the finished drawing on a white page with the gold "Drawn" chip,
/// one line from Lina, two honest facts, and the three ways on: add it to the
/// sketchbook, start the next lesson, or not now.
struct CompletionView: View {
    let lesson: Lesson

    @Environment(AppModel.self) private var app

    var body: some View {
        VStack(spacing: Theme.stackSpacing) {
            ScrollView {
                VStack(spacing: Theme.stackSpacing) {
                    PageThumb(tutorial: lesson.tutorial)
                        .frame(maxWidth: 240)
                        .overlay(alignment: .topTrailing) {
                            Chip(text: "Drawn \(Self.dayFormatter.string(from: Date()))", style: .gold)
                                .padding(10)
                        }

                    Text(headline)
                        .textRole(.title1)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(Theme.ink)

                    HStack(alignment: .top, spacing: 10) {
                        LinaFace(size: 48)
                        Text("Keep the page. Next time you will see how much steadier your hand is.")
                            .textRole(.body)
                            .foregroundStyle(Theme.ink70)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    HStack(spacing: Theme.stackSpacing) {
                        StatTile(value: "\(lesson.stepCount)", label: "steps")
                        StatTile(value: "\(lesson.estimatedMinutes)", label: "minutes drawn")
                    }
                }
                .padding(.vertical, Theme.stackSpacing)
            }

            Button("Add to sketchbook") { app.presentCapture(lesson) }
                .buttonStyle(.primary)

            if let next = app.nextLesson(after: lesson) {
                Button("Next lesson") {
                    app.dismissCover()
                    app.showPreview(of: next)
                }
                .buttonStyle(.secondary)
            }

            Button("Not now") { app.dismissCover() }
                .buttonStyle(.quiet)
                .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, Theme.gutter)
        .padding(.bottom, Theme.stackSpacing)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.page.ignoresSafeArea())
    }

    /// "Your palm tree is finished." — unless the title does not read as a subject
    /// in running text (a number in it, say), when the generic line is the honest one.
    private var headline: String {
        let subject = lesson.subject
        let readsAsSubject = subject.allSatisfy { $0.isLetter || $0.isWhitespace || $0 == "-" }
        return readsAsSubject ? "Your \(subject) is finished." : "Your drawing is finished."
    }

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("d MMM")
        return formatter
    }()
}
