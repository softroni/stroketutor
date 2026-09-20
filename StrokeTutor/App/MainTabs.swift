import SwiftUI

/// The app under the covers: three tabs (Learn · Sketchbook · Settings) with the
/// custom v3 tab bar, and one `NavigationStack` per tab so a back stack survives a
/// tab switch. All three stay alive; the inactive ones are hidden rather than torn
/// down, so returning to a tab lands where it was left.
///
/// The tab bar is drawn over the stacks rather than under them, and the screens
/// that show it reserve its height themselves (`reservesTabBarSpace`). That keeps
/// the stacks the full height of the screen at every moment: a screen that takes
/// the bar down with it no longer makes its container grow mid-push, which UIKit
/// cannot pass on to a view controller whose transition is already in flight — the
/// arriving screen would be laid out short, and anything pinned to its bottom cut
/// off, until the push finished.
struct MainTabs: View {
    @Environment(AppModel.self) private var app

    /// Whether the screen on top of the showing tab's stack owns the bottom of the
    /// screen itself (`AppRoute.hidesTabBar`). Read straight from the stack rather
    /// than announced by the screen once it is up, so the bar steps aside in the
    /// same state change that pushes the screen. Only the showing tab is asked, so
    /// a hidden bar in one stack cannot follow the learner into another.
    private var tabBarHidden: Bool {
        app.topRoute(of: app.selectedTab)?.hidesTabBar ?? false
    }

    var body: some View {
        @Bindable var app = app

        ZStack(alignment: .bottom) {
            ZStack {
                tab(.learn, path: $app.learnPath) { HomeView() }
                tab(.sketchbook, path: $app.sketchbookPath) { SketchbookView() }
                tab(.settings, path: $app.settingsPath) { SettingsView() }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            if !tabBarHidden {
                // Down and out of the way, rather than gone between one frame and
                // the next, so it leaves with the screen that sent it away.
                TabBar(selection: $app.selectedTab)
                    .transition(.move(edge: .bottom))
            }
        }
        .animation(.easeInOut(duration: 0.3), value: tabBarHidden)
        .background(Theme.page)
    }

    @ViewBuilder
    private func tab<Root: View>(_ tab: MainTab,
                                 path: Binding<[AppRoute]>,
                                 @ViewBuilder root: () -> Root) -> some View {
        let isActive = app.selectedTab == tab
        NavigationStack(path: path) {
            root()
                // A tab's root always sits above the bar; a pushed screen says so
                // through its route.
                .reservesTabBarSpace()
                .navigationDestination(for: AppRoute.self) { route in
                    AppDestination(route: route)
                        .reservesTabBarSpace(!route.hidesTabBar)
                }
        }
        .opacity(isActive ? 1 : 0)
        .allowsHitTesting(isActive)
        .accessibilityHidden(!isActive)
    }
}
