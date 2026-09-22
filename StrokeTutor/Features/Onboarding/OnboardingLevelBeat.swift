import SwiftUI

/// `ob-level` — "How much have you drawn before?" One card per level the catalog
/// has something shipped for, in the catalog's order, each showing the first
/// drawing of its first path. The first level is preselected so Continue is never
/// blocked, and there is no Skip: Skip lands on the who beat just before this one.
///
/// A tap moves the selection and never advances. The level is only a way into
/// `ob-path` and is never stored; Continue hands it back to the flow, which decides
/// whether there is a path left to ask about.
struct OnboardingLevelBeat: View {

    let levels: [OnboardingPathChoices.Level]
    let selectedLevelId: String?
    let rail: OnboardingRail
    let onSelect: (OnboardingPathChoices.Level) -> Void
    let onContinue: () -> Void

    @Environment(\.onboardingReducesMotion) private var reducesMotion

    var body: some View {
        OnboardingBeatFrame(rail: rail) {
            TutorSays(pose: .neutral, text: "How much have you drawn before?")

            VStack(spacing: Theme.stackSpacing) {
                ForEach(levels) { level in
                    ChoiceRow(title: level.level.title,
                              subtitle: level.level.onboardingLine,
                              isSelected: level.id == selectedLevelId,
                              action: { onSelect(level) }) {
                        thumbnail(for: level)
                    }
                }
            }
            .animation(reducesMotion ? nil : .spring(response: 0.2, dampingFraction: 0.85),
                       value: selectedLevelId)
        } footer: {
            Button("Continue", action: onContinue)
                .buttonStyle(.primary)
        }
    }

    /// A level is introduced the way `hp-paths` introduces a path: by the first
    /// thing the learner would draw in it.
    private func thumbnail(for level: OnboardingPathChoices.Level) -> some View {
        PaperTile {
            DrawingThumbnail(tutorial: level.paths.first?.lessons.first?.tutorial, size: 58)
                .frame(width: 68, height: 68)
        }
    }
}
