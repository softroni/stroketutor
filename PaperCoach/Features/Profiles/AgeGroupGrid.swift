import SwiftUI

/// The six age bands as tiles, two to a row, youngest first. `ob-age` and a
/// learner's page in Settings both use it; "Prefer not to say" is each caller's
/// own quiet button underneath.
///
/// Every tile looks the same and none is chosen until someone taps: the question
/// has to be neutral, with no hint that one answer gets more than another.
struct AgeGroupGrid: View {
    let selection: AgeGroup?
    let onSelect: (AgeGroup) -> Void

    @Environment(\.onboardingReducesMotion) private var onboardingReducesMotion
    @Environment(\.accessibilityReduceMotion) private var systemReducesMotion

    /// Onboarding resolves Reduce Motion itself; Settings does not, so ask both.
    private var reducesMotion: Bool { onboardingReducesMotion || systemReducesMotion }

    var body: some View {
        PictureGrid(columns: 2, spacing: Theme.stackSpacing) {
            ForEach(AgeGroup.bands) { group in
                AgeGroupTile(group: group, isSelected: group == selection) {
                    onSelect(group)
                }
            }
        }
        .animation(reducesMotion ? nil : .spring(response: 0.2, dampingFraction: 0.85),
                   value: selection)
    }
}

/// One band: its range in large type on a choice card, with the check once chosen.
private struct AgeGroupTile: View {
    let group: AgeGroup
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(group.title)
                .scaledFont(24, .heavy)
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.vertical, 16)
                .padding(.horizontal, 12)
                .frame(minHeight: 76)
                .overlay(alignment: .topTrailing) {
                    if isSelected {
                        ChoiceCheck()
                            .padding(8)
                    }
                }
                .choiceSurface(isSelected: isSelected, cornerRadius: 20)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(group.spokenTitle)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}
