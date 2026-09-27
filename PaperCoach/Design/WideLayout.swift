import SwiftUI

/// Whether a screen has the room of a big window — an iPad, full screen or in a
/// large window — and lays itself out in columns instead of the phone's single one.
///
/// Measured, not read from the size class or the device: a screen beside the iPad's
/// sidebar has 260 pt less than the window, and an iPad window can be any size (no
/// `UIRequiresFullScreen`, see `Info.plist`). `MainTabs` provides it for the tabs and
/// `AppRoot` for the covers; each screen reads `\.isWideLayout`.
enum WideLayout {
    /// The width from which a screen goes to columns: comfortably more than any
    /// phone held upright (440 pt) and than two phone columns side by side.
    static let threshold: CGFloat = 700
    /// The width from which the tabs become a sidebar: enough to keep the screen
    /// beside it wide (`threshold`) as well.
    static let sidebarThreshold: CGFloat = 960
    /// What a single column of words is kept to on a wide screen, so a line of text
    /// or a row of buttons never runs the whole width of an iPad.
    static let readableWidth: CGFloat = 640
}

private struct IsWideLayoutKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    /// True when the screen has the width of a big window (`WideLayout.threshold`).
    var isWideLayout: Bool {
        get { self[IsWideLayoutKey.self] }
        set { self[IsWideLayoutKey.self] = newValue }
    }
}

extension View {
    /// Measures this view's width and tells everything inside it whether it is wide.
    func providesWideLayout() -> some View {
        modifier(WideLayoutProvider())
    }

    /// On a wide screen, keeps a single column to a readable width, centred.
    /// Nothing changes on a phone.
    func readableColumn(_ isWide: Bool, maxWidth: CGFloat = WideLayout.readableWidth) -> some View {
        frame(maxWidth: isWide ? maxWidth : .infinity)
            .frame(maxWidth: .infinity)
    }
}

private struct WideLayoutProvider: ViewModifier {
    @State private var width: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .environment(\.isWideLayout, width >= WideLayout.threshold)
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
    }
}
