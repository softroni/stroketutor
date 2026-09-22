import SwiftUI

/// The one row under the wide page (`PlayerScreen.wideLandscape`): everything the
/// panel held, on a 64 pt white bar along the bottom of a full-height paper, so a
/// wide drawing keeps the rest of the screen to itself while the learner copies it.
///
/// Reading left to right: close, the ⋯ menu, the step label — which is a button,
/// the way back to the words — and the narration chip; then, on the far side, the
/// reference thumbnail and the same action row as the sheet, small.
struct PlayerWideBar<Menu: View, Chip: View, Reference: View>: View {
    /// The step in play, zero-based. Nil before the lesson starts.
    let stepIndex: Int?
    let stepCount: Int
    let actions: PlayerActionRow
    /// The screen's horizontal safe insets: the paper runs under the island, the
    /// bar's white with it, but its buttons stay clear.
    var leadingInset: CGFloat = 0
    var trailingInset: CGFloat = 0
    let onClose: () -> Void
    /// Brings the panel — and the sentence — back over the paper.
    let onWords: () -> Void
    @ViewBuilder let menu: () -> Menu
    @ViewBuilder let chip: () -> Chip
    @ViewBuilder let reference: () -> Reference

    /// 48 pt controls with their 4 pt edge, 6 pt above and below.
    static var height: CGFloat { 64 }

    var body: some View {
        HStack(spacing: 10) {
            closeButton
            menuButton
            stepButton
            chip()
            Spacer(minLength: 8)
            actionCluster
        }
        .padding(.leading, 12 + leadingInset)
        .padding(.trailing, 12 + trailingInset)
        .frame(height: Self.height)
        .frame(maxWidth: .infinity)
        // The bar's own white swallows a tap between its buttons, so it never
        // reaches the paper underneath and brings the panel back by accident.
        .contentShape(Rectangle())
        .onTapGesture {}
        .background {
            Theme.card
                .overlay(alignment: .top) { Theme.line.frame(height: 2) }
                .shadow(color: .black.opacity(0.10), radius: 15, y: -10)
                // The white runs under the home indicator, as the sheet's does.
                .ignoresSafeArea(edges: .bottom)
        }
    }

    private var actionCluster: some View {
        HStack(spacing: 10) {
            reference()
            actions
        }
    }

    private var closeButton: some View {
        Button(action: onClose) {
            Image(systemName: "xmark")
                .scaledFont(19, .bold, design: .default)
                .foregroundStyle(Theme.ink)
                .frame(width: Theme.navTapTarget, height: Theme.navTapTarget)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Close lesson")
        .accessibilitySortPriority(10)
    }

    private var menuButton: some View {
        SwiftUI.Menu {
            menu()
        } label: {
            Image(systemName: "ellipsis")
                .scaledFont(19, .bold, design: .default)
                .foregroundStyle(Theme.ink)
                .frame(width: Theme.navTapTarget, height: Theme.navTapTarget)
                .contentShape(Rectangle())
        }
        .accessibilityLabel("More options. Speed, narration, start over")
        .accessibilitySortPriority(10)
    }

    /// "Step 3 of 9" with a small text glyph: tapping it is how the sentence comes
    /// back, and for VoiceOver the one place the words are reachable from the bar.
    private var stepButton: some View {
        Button(action: onWords) {
            HStack(spacing: 6) {
                Text(label)
                    .textRole(.subhead)
                    .lineLimit(1)
                Image(systemName: "text.quote")
                    .scaledFont(13, .bold, design: .default)
            }
            .foregroundStyle(Theme.ink55)
            .frame(minHeight: Theme.navTapTarget)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(label). Double tap to read the instruction.")
        .accessibilitySortPriority(65)
    }

    /// The header's words, as `PlayerHeader` writes them.
    private var label: String {
        guard let stepIndex else { return "Before you start" }
        return "Step \(min(stepIndex + 1, max(stepCount, 1))) of \(max(stepCount, 1))"
    }
}
