import SwiftUI

/// `ob-path` — "Pick one to start." The paths of the level chosen on `ob-level`, at
/// most four, as pictures of what the learner will draw first: two to a row, a
/// third on its own row centered under the first two. One column at the
/// accessibility text sizes, so a title has the width to wrap in. The first path is
/// preselected so Continue is never blocked, and there is no Skip: Skip lands on
/// the who beat, before the level was asked.
///
/// A tap moves the selection and never advances. Continue writes `currentPathId`.
struct OnboardingPathBeat: View {

    let paths: [PathModel]
    let selectedPathId: String?
    let rail: OnboardingRail
    let onSelect: (PathModel) -> Void
    let onContinue: () -> Void

    @Environment(\.onboardingReducesMotion) private var reducesMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        OnboardingBeatFrame(rail: rail) {
            TutorSays(pose: .neutral,
                      text: "Pick one to start. The rest are waiting in Paths.")

            if paths.isEmpty {
                emptyCatalog
            } else {
                PictureGrid(columns: dynamicTypeSize.isAccessibilitySize ? 1 : 2,
                            spacing: Theme.stackSpacing) {
                    ForEach(paths) { path in
                        PathPictureCard(path: path, isSelected: path.id == selectedPathId) {
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

    private var emptyCatalog: some View {
        Text("No lessons are installed.")
            .textRole(.headline)
            .foregroundStyle(Theme.ink55)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.cardPadding)
            .cardBackground()
    }

}
