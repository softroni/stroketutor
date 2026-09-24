import SwiftUI
import UIKit

/// The system camera, for photographing a finished page (`sk-capture`, camera).
///
/// `UIImagePickerController` in `.camera` mode rather than a hand-built
/// `AVCaptureSession`: the learner gets the shutter, the flash control and the
/// retake they already know from Camera, and the app gets one still image back.
///
/// Permission: the picker itself triggers the system prompt the first time, which is
/// why the primer is shown before this ever appears — so "Don't Allow" is an
/// informed choice. The purpose string is `NSCameraUsageDescription` in `Info.plist`,
/// written per Apple's current guidance (App Store Review Guidelines 5.1.1(ii),
/// https://developer.apple.com/app-store/review/guidelines/, read 2026-09-13:
/// "Ensure your purpose strings clearly and completely describe your use of the
/// data").
struct CameraPicker: UIViewControllerRepresentable {
    /// The photograph, or nil when the learner cancelled.
    let onFinish: (UIImage?) -> Void

    /// False in the simulator and on a device with no usable camera; the flow falls
    /// back to Photos rather than showing a picker that cannot take a picture.
    static var isAvailable: Bool {
        UIImagePickerController.isSourceTypeAvailable(.camera)
    }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.cameraCaptureMode = .photo
        picker.allowsEditing = false
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ picker: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onFinish: onFinish)
    }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        private let onFinish: (UIImage?) -> Void

        init(onFinish: @escaping (UIImage?) -> Void) {
            self.onFinish = onFinish
        }

        func imagePickerController(_ picker: UIImagePickerController,
                                   didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            onFinish(info[.originalImage] as? UIImage)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            onFinish(nil)
        }
    }
}
