import SwiftUI

/// Whether the three-tab bar belongs under whatever is on top of a tab's stack.
///
/// v3 keeps it on the tab roots and on the two browsing screens (`hp-paths`,
/// `hp-path`), and drops it on the pushed screens that own the bottom of the screen
/// themselves with a `.bottom-area`: `hp-preview`, `sk-entry`, `st-voice`,
/// `st-reminder`. A screen says so with `.hidesTabBar()`; `MainTabs` reads the value
/// for the tab that is showing and leaves every other tab's answer alone.
struct TabBarHiddenKey: PreferenceKey {
    static let defaultValue = false

    static func reduce(value: inout Bool, nextValue: () -> Bool) {
        value = value || nextValue()
    }
}

extension View {
    /// Hides `MainTabs`' tab bar while this screen is the top of its stack.
    func hidesTabBar(_ hidden: Bool = true) -> some View {
        preference(key: TabBarHiddenKey.self, value: hidden)
    }
}
