import OSLog
import Photos
import UIKit

/// Writing a kept page to the learner's own photo library — and only ever that.
///
/// The sketchbook is private by default; this runs solely when "Also save to Photos"
/// is on in Settings (`alsoSaveToPhotos`). Add-only authorisation is requested, so
/// the app can write one photo and can never read the library — hence
/// `NSPhotoLibraryAddUsageDescription` in `Info.plist` and no read key at all
/// (https://developer.apple.com/documentation/bundleresources/information-property-list/nsphotolibraryaddusagedescription,
/// read 2026-09-13).
///
/// Failing is quiet on purpose: the page is already safe in the sketchbook, which is
/// what the learner asked for, so a refused library is a log line and not an alert.
enum PhotoLibraryWriter {
    private static let log = Logger(subsystem: "com.softroni.papercoach", category: "photos")

    /// Whether iOS has already refused (or a restriction blocks) adding to the library.
    /// Settings reads this so the toggle never claims to be on when nothing can be saved.
    static var isRefused: Bool {
        let status = PHPhotoLibrary.authorizationStatus(for: .addOnly)
        return status == .denied || status == .restricted
    }

    /// Asks for add-only access at the moment the learner turns the option on, so the
    /// system prompt comes with an obvious reason. Returns whether pages can be added.
    static func requestAccess() async -> Bool {
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        return status == .authorized || status == .limited
    }

    static func save(_ image: UIImage) {
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else {
                log.notice("Also save to Photos is on, but the library is not available to add to.")
                return
            }
            PHPhotoLibrary.shared().performChanges {
                PHAssetChangeRequest.creationRequestForAsset(from: image)
            } completionHandler: { success, error in
                if !success {
                    log.error("A page could not be added to Photos: \(error?.localizedDescription ?? "unknown", privacy: .public)")
                }
            }
        }
    }
}
