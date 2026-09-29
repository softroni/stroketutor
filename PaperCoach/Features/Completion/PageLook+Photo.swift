import CoreImage
import UIKit

/// The looks on the learner's photographs: small copies to choose between on
/// review, and the chosen one at full size for Keep. Both off the main thread, and
/// like straightening, with the photo's values read and written as they are.
extension PageLook {

    /// The previews' long edge: sharp in the review card on any screen, and quick
    /// to make three of.
    static let previewPixelLength: CGFloat = 1200

    /// `image` in every look but Original, no longer than `previewPixelLength`,
    /// from one measurement of its light. Empty when the photo cannot be read.
    static func previews(of image: UIImage) async -> [PageLook: UIImage] {
        await Task.detached(priority: .userInitiated) {
            guard let upright = PageCropper.uprightCIImage(image) else { return [:] }
            let longEdge = max(upright.extent.width, upright.extent.height)
            let scale = longEdge > previewPixelLength ? previewPixelLength / longEdge : 1
            let small = scale < 1
                ? upright.applyingFilter("CILanczosScaleTransform", parameters: [kCIInputScaleKey: scale,
                                                                                 kCIInputAspectRatioKey: 1])
                : upright
            guard let light = PageLight.measure(small, context: PageCropper.context) else { return [:] }
            var previews: [PageLook: UIImage] = [:]
            for look in allCases where look != .original {
                previews[look] = PageCropper.render(look.applied(to: small, light: light), inColorSpaceOf: image)
            }
            return previews
        }.value
    }

    /// `image` in this look at its full size: what Keep saves. The photo itself
    /// for Original; nil when it cannot be read or rendered.
    func rendered(_ image: UIImage) async -> UIImage? {
        guard self != .original else { return image }
        return await Task.detached(priority: .userInitiated) {
            guard let upright = PageCropper.uprightCIImage(image),
                  let light = PageLight.measure(upright, context: PageCropper.context) else { return nil }
            return PageCropper.render(applied(to: upright, light: light), inColorSpaceOf: image)
        }.value
    }
}
