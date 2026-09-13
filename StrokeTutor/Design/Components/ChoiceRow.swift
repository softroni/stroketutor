import SwiftUI

/// A single-choice row (`.choice`): the shape onboarding's "choose a path" uses.
/// White with a 2 pt border and a 3 pt edge; selected turns green-tint with a
/// 2.5 pt green border and a check.
struct ChoiceRow: View {
    let title: String
    var subtitle: String?
    var systemImage: String?
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                if let systemImage {
                    Image(systemName: systemImage)
                        .scaledFont(22, .semibold, design: .default)
                        .foregroundStyle(isSelected ? Theme.green : Theme.ink)
                        .frame(width: 44, height: 44)
                        .background(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(isSelected ? Theme.greenSoft : Theme.surface)
                        )
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .textRole(.headline)
                        .foregroundStyle(Theme.ink)
                    if let subtitle {
                        Text(subtitle)
                            .textRole(.footnote)
                            .foregroundStyle(Theme.ink55)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                if isSelected {
                    Image(systemName: "checkmark")
                        .scaledFont(13, .heavy, design: .default)
                        .foregroundStyle(.white)
                        .frame(width: 26, height: 26)
                        .background(Circle().fill(Theme.green))
                }
            }
            .padding(.vertical, 12)
            .padding(.horizontal, 16)
            .frame(minHeight: 68)
            .background(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(isSelected ? Theme.greenTint : Theme.card)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .strokeBorder(isSelected ? Theme.green : Theme.line,
                                  lineWidth: isSelected ? 2.5 : 2)
            )
            .background(alignment: .bottom) {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(isSelected ? Theme.greenSoft : Theme.line)
                    .offset(y: 3)
            }
            .padding(.bottom, 3)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}
