import SwiftUI

/// The player's bottom sheet: the instruction 24/800 in a two-line slot, one muted
/// hint line, then the action row — back a step, watch again, and the wide primary.
/// White, radius 28 on top, a 2 pt line and a soft upward shadow, so it reads as
/// floating over the paper.
struct PlayerSheet: View {
    let instruction: String
    var hint: String?
    let primaryTitle: String
    /// True while the step is still drawing: the primary is outlined, not filled,
    /// and tapping it skips ahead rather than being refused.
    var isPending: Bool = false
    var canGoBack: Bool = true
    let onBack: () -> Void
    let onReplay: () -> Void
    let onPrimary: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            Text(instruction)
                .textRole(.instruction)
                .multilineTextAlignment(.center)
                .frame(minHeight: 60)
                .fixedSize(horizontal: false, vertical: true)

            if let hint {
                Text(hint)
                    .textRole(.subhead)
                    .foregroundStyle(Theme.ink55)
                    .multilineTextAlignment(.center)
            }

            HStack(spacing: Theme.stackSpacing) {
                Button(action: onBack) {
                    Image(systemName: "backward.end.fill")
                }
                .buttonStyle(.roundIcon)
                .frame(width: 64)
                .opacity(canGoBack ? 1 : 0.4)
                .disabled(!canGoBack)
                .accessibilityLabel("Previous step")

                Button(action: onReplay) {
                    Image(systemName: "arrow.counterclockwise")
                }
                .buttonStyle(.roundIcon)
                .frame(width: 64)
                .accessibilityLabel("Watch this step again")

                Button(primaryTitle, action: onPrimary)
                    .buttonStyle(isPending ? .pending : .primary)
            }
            .padding(.top, 10)
        }
        .padding(.top, 22)
        .padding(.horizontal, Theme.gutter)
        .padding(.bottom, Theme.stackSpacing)
        .frame(maxWidth: .infinity)
        .background(
            UnevenRoundedRectangle(topLeadingRadius: 28, topTrailingRadius: 28, style: .continuous)
                .fill(Theme.card)
                .shadow(color: .black.opacity(0.10), radius: 15, y: -10)
        )
    }
}
