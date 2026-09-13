import SwiftUI

@main
struct StrokeTutorApp: App {
    /// The app is portrait everywhere but the player, which may be turned on its
    /// side (`pl-landscape`). `Info.plist` therefore lists landscape as supported and
    /// `OrientationLockDelegate` narrows it back to portrait for every other screen.
    @UIApplicationDelegateAdaptor(OrientationLockDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            AppRoot()
        }
    }
}
