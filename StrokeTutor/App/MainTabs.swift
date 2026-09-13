import SwiftUI

/// The app under the covers: three tabs (Learn · Sketchbook · Settings) with the
/// custom v3 tab bar, and one `NavigationStack` per tab so a back stack survives a
/// tab switch. All three stay alive; the inactive ones are hidden rather than torn
/// down, so returning to a tab lands where it was left.
struct MainTabs: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        @Bindable var app = app

        VStack(spacing: 0) {
            ZStack {
                tab(.learn, path: $app.learnPath) { HomeView() }
                tab(.sketchbook, path: $app.sketchbookPath) { SketchbookView() }
                tab(.settings, path: $app.settingsPath) { SettingsView() }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            TabBar(selection: $app.selectedTab)
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
        .opacity(isActive ? 1 : 0)
        .allowsHitTesting(isActive)
        .accessibilityHidden(!isActive)
    }
}
