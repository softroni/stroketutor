import SwiftUI

/// The app under the covers: three tabs (Learn · Sketchbook · Settings) with the
/// custom v3 tab bar, and one `NavigationStack` per tab so a back stack survives a
/// tab switch. All three stay alive; the inactive ones are hidden rather than torn
/// down, so returning to a tab lands where it was left.
struct MainTabs: View {
    @Environment(AppModel.self) private var app

    /// Per tab, whether the screen on top of that tab's stack asked for the tab bar
    /// to step aside (`.hidesTabBar()`). Only the showing tab's answer is used, so a
    /// hidden bar in one stack cannot follow the learner into another.
    @State private var tabBarHidden: [MainTab: Bool] = [:]

    var body: some View {
        @Bindable var app = app

        VStack(spacing: 0) {
            ZStack {
                tab(.learn, path: $app.learnPath) { HomeView() }
                tab(.sketchbook, path: $app.sketchbookPath) { SketchbookView() }
                tab(.settings, path: $app.settingsPath) { SettingsView() }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            if tabBarHidden[app.selectedTab] != true {
                TabBar(selection: $app.selectedTab)
            }
        }
        .background(Theme.page)
    }

    @ViewBuilder
    private func tab<Root: View>(_ tab: MainTab,
                                 path: Binding<NavigationPath>,
                                 @ViewBuilder root: () -> Root) -> some View {
        let isActive = app.selectedTab == tab
        NavigationStack(path: path) {
            root()
                .navigationDestination(for: AppRoute.self) { route in
                    AppDestination(route: route)
                }
        }
        .onPreferenceChange(TabBarHiddenKey.self) { hidden in
            Task { @MainActor in tabBarHidden[tab] = hidden }
        }
        .opacity(isActive ? 1 : 0)
        .allowsHitTesting(isActive)
        .accessibilityHidden(!isActive)
    }
}
