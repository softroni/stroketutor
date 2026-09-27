import SwiftUI
import UIKit

/// On a phone, rotation is allowed on one screen only.
///
/// The phone app is portrait: every other screen is a column of cards and a tab
/// bar, and nothing is gained by turning them. The player is the exception — a wide
/// subject draws larger with the phone on its side (`pl-landscape`) — so
/// `Info.plist` lists landscape as *supported*, and this delegate narrows it back to
/// portrait for the rest of the app. `PlayerScreen` widens the mask while it is on
/// screen and puts it back, in portrait, when it leaves.
///
/// An iPad turns everywhere, every way up. It stands in a case or on a keyboard
/// whichever way the learner set it down, its windows can be any shape (there is no
/// `UIRequiresFullScreen` any more), and iPadOS does not honour an app's lock in a
/// window anyway; every screen lays itself out for the size it is given.
final class OrientationLockDelegate: NSObject, UIApplicationDelegate {

    /// What a phone will rotate to right now: portrait everywhere but the player.
    nonisolated(unsafe) static var supported: UIInterfaceOrientationMask = .portrait

    func application(_ application: UIApplication,
                     supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        UIDevice.current.userInterfaceIdiom == .pad ? .all : Self.supported
    }
}

@MainActor
enum PlayerOrientation {

    /// The player is up: allow the phone to be turned either way.
    static func allowRotation() {
        apply(.allButUpsideDown, snapBackTo: nil)
    }

    /// The player is gone: portrait only, and turn the phone back if it was on its
    /// side, so the screen behind never appears rotated.
    static func lockToPortrait() {
        apply(.portrait, snapBackTo: .portrait)
    }

    private static func apply(_ mask: UIInterfaceOrientationMask,
                              snapBackTo geometry: UIInterfaceOrientationMask?) {
        // The iPad is never locked, so there is nothing to widen or snap back.
        guard UIDevice.current.userInterfaceIdiom != .pad else { return }
        OrientationLockDelegate.supported = mask
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive })
            ?? UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first
        else { return }

        scene.keyWindow?.rootViewController?.setNeedsUpdateOfSupportedInterfaceOrientations()
        if let geometry {
            scene.requestGeometryUpdate(.iOS(interfaceOrientations: geometry))
        }
    }
}
