import UIKit

/// "iPhone" or "iPad": the word for the device in the sentences that say where
/// pages and settings are kept ("Kept on this iPad only"). The app runs on both.
enum DeviceName {
    @MainActor static var current: String {
        UIDevice.current.userInterfaceIdiom == .pad ? "iPad" : "iPhone"
    }
}
