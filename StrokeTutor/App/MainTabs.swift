import SwiftUI

/// The app under the covers: three tabs (Learn · Sketchbook · Settings) with the
/// custom v3 tab bar, and one `NavigationStack` per tab so a back stack survives a
/// tab switch. All three stay alive; the inactive ones are hidden rather than torn
/// down, so returning to a tab lands where it was left.
struct MainTabs: View {
    @Environment(AppModel.self) private var app

    /// Whether the screen on top of the showing tab's stack owns the bottom of the
    /// screen itself (`AppRoute.hidesTabBar`). Read straight from the stack rather
    /// than announced by the screen once it is up, so the bar steps aside in the
    /// same state change that pushes the screen: the incoming screen is laid out
    /// once, at its full height, and its pinned buttons do not jump. Only the
    /// showing tab is asked, so a hidden bar in one stack cannot follow the learner
    /// into another.
    private var tabBarHidden: Bool {
        app.topRoute(of: app.selectedTab)?.hidesTabBar ?? false
    }

    var body: some View {
        @Bindable var app = app

        VStack(spacing: 0) {
            ZStack {
                tab(.learn, path: $app.learnPath) { HomeView() }
                tab(.sketchbook, path: $app.sketchbookPath) { SketchbookView() }
                tab(.settings, path: $app.settingsPath) { SettingsView() }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            if !tabBarHidden {
                TabBar(selection: $app.selectedTab)
            }
        }
        .background(Theme.page)
    }

    @ViewBuilder
    private func tab<Root: View>(_ tab: MainTab,
                                 path: Binding<[AppRoute]>,
                                 @ViewBuilder root: () -> Root) -> some View {
        let isActive = app.selectedTab == tab
        NavigationStack(path: path) {
            root()
                .navigationDestination(for: AppRoute.self) { route in
                    AppDestination(route: route)
                }
        }
        .opacity(isActive ? 1 : 0)
        .allowsHitTesting(isActive)
        .accessibilityHidden(!isActive)
    }
}
