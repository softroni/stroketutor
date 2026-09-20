import SwiftUI

/// The three-tab bar of v3 (`.tabbar`): white, a 2 pt top line, 26 pt glyphs in a
/// 56 × 30 pill that turns green-soft when the tab is active, 11.5/heavy labels at
/// 40 % ink otherwise. Learn · Sketchbook · Settings, in that order, everywhere.
struct TabBar: View {
    @Binding var selection: MainTab

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
    }

    /// The bar drawn as a stationary overlay is never part of a screen's own
    /// layout, so a screen that shows it reserves its height like this. The spacer
    /// is a hidden copy of the bar itself rather than a number, so the two cannot
    /// drift apart at any Dynamic Type size.
    static var spacer: some View {
        TabBar(selection: .constant(.learn))
            .hidden()
            .accessibilityHidden(true)
    }

    private func tabLabel(_ tab: MainTab) -> some View {
        let isActive = tab == selection
        return VStack(spacing: 2) {
            Image(systemName: tab.symbol)
                .scaledFont(22, .semibold, design: .default)
                .frame(width: 56, height: 30)
                .background(
                    Capsule().fill(isActive ? Theme.greenSoft : .clear)
                )
            Text(tab.title)
                .scaledFont(11.5, .heavy)
                .tracking(0.2)
        }
        .foregroundStyle(isActive ? Theme.green : Theme.ink40)
        .frame(maxWidth: .infinity)
        .contentShape(Rectangle())
    }
}

extension View {
    /// Keeps a screen's content clear of the tab bar, for the screens that show it.
    /// See `TabBar.spacer` for why the room is reserved rather than measured.
    @ViewBuilder
    func reservesTabBarSpace(_ reserves: Bool = true) -> some View {
        if reserves {
            safeAreaInset(edge: .bottom, spacing: 0) { TabBar.spacer }
        } else {
            self
        }
    }
}
