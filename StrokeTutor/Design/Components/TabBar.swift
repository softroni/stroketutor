import SwiftUI

/// The tab bar of v3 (`.tabbar`): white, a 2 pt top line, glyphs in a 56 × 30 pill,
/// 11.5/heavy labels. Home · Path · Lessons · Sketchbook · Settings, in that order,
/// everywhere.
///
/// Every tab wears its own color (`MainTab.tint`) so the bar is bright for a child
/// and each icon is easy to tell apart: a filled glyph shaded light to deep, always
/// in color. The active tab adds a pill in its soft color, a label in its deep
/// color and a little bounce when it is picked; the others keep 40 % ink labels.
/// Only the tab being picked moves: the one it replaces drops its pill and size
/// at once, with no bounce.
///
/// Five tabs at 375 pt leave each one about 70 pt, which holds the 56 pt pill.
/// "Sketchbook" is the widest label and runs close to its column even at the
/// default size, so a label shrinks to fit on one line rather than wrapping under
/// the glyph or being cut to an ellipsis.
struct TabBar: View {
    @Binding var selection: MainTab
    /// How many times each tab has been picked. The bounce keys off this count
    /// rather than `isActive`, which also changes on the tab being left.
    @State private var bounces: [MainTab: Int] = [:]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(MainTab.allCases) { tab in
                Button {
                    selection = tab
                } label: {
                    tabLabel(tab)
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity)
                .accessibilityLabel(tab.title)
                .accessibilityAddTraits(tab == selection ? [.isButton, .isSelected] : .isButton)
            }
        }
        .padding(.top, 8)
        .padding(.horizontal, 12)
        .background(Theme.card)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Theme.line)
                .frame(height: 2)
        }
        .onChange(of: selection) { _, picked in
            bounces[picked, default: 0] += 1
        }
    }

    /// The bar drawn as a stationary overlay is never part of a screen's own
    /// layout, so a screen that shows it reserves its height like this. The spacer
    /// is a hidden copy of the bar itself rather than a number, so the two cannot
    /// drift apart at any Dynamic Type size.
    static var spacer: some View {
        TabBar(selection: .constant(.home))
            .hidden()
            .accessibilityHidden(true)
    }

    private func tabLabel(_ tab: MainTab) -> some View {
        let isActive = tab == selection
        let tint = tab.tint
        return VStack(spacing: 2) {
            Image(systemName: tab.symbol)
                .scaledFont(isActive ? 24 : 22, .semibold, design: .default)
                .foregroundStyle(
                    LinearGradient(colors: [tint.deep.opacity(0.7), tint.deep],
                                   startPoint: .top, endPoint: .bottom)
                )
                .symbolEffect(.bounce, value: bounces[tab, default: 0])
                .frame(width: 56, height: 30)
                .background(
                    Capsule().fill(isActive ? tint.soft : .clear)
                )
            Text(tab.title)
                .scaledFont(11.5, .heavy)
                .tracking(0.2)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .foregroundStyle(isActive ? tint.deep : Theme.ink40)
        }
        .animation(isActive ? .spring(response: 0.3, dampingFraction: 0.6) : nil, value: isActive)
        .frame(maxWidth: .infinity)
        .contentShape(Rectangle())
    }
}

extension View {
    /// Keeps a screen's content clear of the tab bar, for the screens that show it.
    /// See `TabBar.spacer` for why the room is reserved rather than measured.
    ///
    /// The inset is always there and only folds to nothing when the room is not
    /// wanted: `reserves` changes while a screen is up (the keyboard takes the bar
    /// away), and swapping the modifier in and out would give the screen a new
    /// identity, throwing away its state mid-search.
    func reservesTabBarSpace(_ reserves: Bool = true) -> some View {
        safeAreaInset(edge: .bottom, spacing: 0) {
            TabBar.spacer
                .frame(height: reserves ? nil : 0)
                .clipped()
        }
    }
}
