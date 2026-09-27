import UIKit

/// "iPhone" or "iPad": the word for the device in the sentences that say where
/// pages and settings are kept ("Kept on this iPad only"). The app runs on both.
enum DeviceName {
    @MainActor static var current: String {
        UIDevice.current.userInterfaceIdiom == .pad ? "iPad" : "iPhone"
    }

    /// True on an iPad, for the few settings that only mean something there.
    @MainActor static var isPad: Bool {
        UIDevice.current.userInterfaceIdiom == .pad
    }
}
