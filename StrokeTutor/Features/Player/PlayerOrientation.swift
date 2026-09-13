import SwiftUI
import UIKit

/// Rotation is allowed on one screen only.
///
/// The app is portrait: every other screen is a column of cards and a tab bar, and
/// nothing is gained by turning them. The player is the exception — a wide subject
/// draws larger with the phone on its side (`pl-landscape`) — so `Info.plist` lists
/// landscape as *supported*, and this delegate narrows it back to portrait for the
/// rest of the app. `PlayerScreen` widens the mask while it is on screen and puts it
/// back, in portrait, when it leaves.
final class OrientationLockDelegate: NSObject, UIApplicationDelegate {

    /// What the app will rotate to right now. Portrait everywhere but the player.
    nonisolated(unsafe) static var supported: UIInterfaceOrientationMask = .portrait

    func application(_ application: UIApplication,
                     supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        Self.supported
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
