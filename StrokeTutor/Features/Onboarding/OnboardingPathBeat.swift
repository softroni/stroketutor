import SwiftUI

/// `ob-path` — "What would you like to draw first?" The only question onboarding
/// asks. Single-choice rows straight from the catalog, the first path preselected so
/// Continue is never blocked, and no Skip: this is where Skip lands.
///
/// A tap moves the selection and never advances. Continue writes `currentPathId`.
struct OnboardingPathBeat: View {

    let paths: [PathModel]
    let selectedPathId: String?
    let rail: OnboardingRail
    let onSelect: (PathModel) -> Void
    let onContinue: () -> Void

    @Environment(\.onboardingReducesMotion) private var reducesMotion

    var body: some View {
        OnboardingBeatFrame(rail: rail) {
            TutorSays(pose: .neutral,
                      text: "What would you like to draw first? You can change this any time.")

            if paths.isEmpty {
                emptyCatalog
            } else {
                VStack(spacing: Theme.stackSpacing) {
                    ForEach(paths) { path in
                        ChoiceRow(title: path.title,
                                  subtitle: subtitle(for: path),
                                  systemImage: path.onboardingSymbol,
                                  isSelected: path.id == selectedPathId) {
                            onSelect(path)
                        }
                    }
                }
                .animation(reducesMotion ? nil : .spring(response: 0.2, dampingFraction: 0.85),
                           value: selectedPathId)
            }
        } footer: {
            Button("Continue", action: onContinue)
                .buttonStyle(.primary)
        }
    }

    /// "10 lessons · starts with a simple house" — the count and the first lesson,
    /// both from the catalog. Nothing here is written into the app.
    private func subtitle(for path: PathModel) -> String {
        let count = path.lessonCount == 1 ? "1 lesson" : "\(path.lessonCount) lessons"
        guard let first = path.lessons.first else { return count }
        return "\(count) · starts with \(first.title)"
    }

    private var emptyCatalog: some View {
        Text("No lessons are installed.")
            .textRole(.headline)
            .foregroundStyle(Theme.ink55)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.cardPadding)
            .cardBackground()
    }

}
