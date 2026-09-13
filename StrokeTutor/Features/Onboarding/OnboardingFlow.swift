import SwiftUI

/// `ob-splash` … `ob-ready` — the seven beats a learner sees once: what the app is,
/// how a lesson works, what they need, which path to take, whether Lina speaks, and
/// their first lesson.
///
/// Phase 1 stands in for all seven with one beat, so the flow can be walked. It
/// writes what the real flow writes — `hasCompletedOnboarding` and `currentPathId` —
/// and hands back the first lesson of the chosen path, which `AppRoot` opens as a
/// preview.
struct OnboardingFlow: View {
    /// Called once, with the lesson to open next, or nil to land on Home.
    let onFinished: (Lesson?) -> Void

    @Environment(AppModel.self) private var app
    @State private var selectedPathId: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.stackSpacing) {
            HStack(alignment: .top, spacing: Theme.stackSpacing) {
                LinaView(pose: .wave, size: 124)
                SpeechBubble(text: "I am Lina. I draw a step, you copy it on paper. That is the whole app.")
            }
            .padding(.top, Theme.sectionSpacing)

            Text("Choose a path")
                .textRole(.title2)
                .foregroundStyle(Theme.ink)

            ScrollView {
                VStack(spacing: Theme.stackSpacing) {
                    ForEach(app.paths.filter { !$0.isEmpty }) { path in
                        ChoiceRow(title: path.title,
                                  subtitle: path.lessonCount == 1 ? "1 drawing" : "\(path.lessonCount) drawings",
                                  systemImage: "circle.grid.2x2",
                                  isSelected: chosenPathId == path.id) {
                            selectedPathId = path.id
                        }
                    }
                }
            }

            Button("Start drawing", action: finish)
                .buttonStyle(.primary)
                .disabled(chosenPath == nil)
        }
        .padding(.horizontal, Theme.gutter)
        .padding(.bottom, Theme.stackSpacing)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Theme.page.ignoresSafeArea())
    }

    private var chosenPathId: String? {
        selectedPathId ?? app.paths.first { !$0.isEmpty }?.id
    }

    private var chosenPath: PathModel? {
        chosenPathId.flatMap { app.path(id: $0) }
    }

    private func finish() {
        guard let path = chosenPath else { return onFinished(nil) }
        app.select(path)
        onFinished(path.lessons.first)
    }
}
