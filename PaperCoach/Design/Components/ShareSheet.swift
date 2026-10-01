import LinkPresentation
import SwiftUI
import UIKit

/// The system share sheet, presented from UIKit rather than through `ShareLink`, for
/// the two things `ShareLink` cannot do: wait for a grown-up first, and say which app
/// a share went to. On iPad the sheet is a popover pointing at the control that
/// opened it (`ShareAnchor`).
@MainActor
enum ShareSheet {
    /// Presents `items` once nothing else is coming on or going off the screen: an
    /// alert that has just been answered, or a PIN pad on its way out. `completion`
    /// gets the activity the person chose, or nil when they closed the sheet
    /// without sharing.
    static func present(_ items: [Any],
                        from anchor: ShareAnchor,
                        completion: @escaping (UIActivity.ActivityType?) -> Void) {
        Task { @MainActor in
            // An alert's button may run while the alert is still leaving, and UIKit
            // refuses to present over a controller in transition (or takes the
            // sheet away with the alert): wait it out, for at most two seconds.
            for _ in 0..<40 {
                if let host = anchor.host(), !host.isBeingDismissed, !host.isBeingPresented,
                   !(host is UIAlertController) {
                    present(items, on: host, anchor: anchor, completion: completion)
                    return
                }
                try? await Task.sleep(for: .milliseconds(50))
            }
        }
    }

    private static func present(_ items: [Any],
                                on host: UIViewController,
                                anchor: ShareAnchor,
                                completion: @escaping (UIActivity.ActivityType?) -> Void) {
        let sheet = UIActivityViewController(activityItems: items, applicationActivities: nil)
        sheet.completionWithItemsHandler = { activity, completed, _, _ in
            completion(completed ? activity : nil)
        }
        if let popover = sheet.popoverPresentationController {
            if let view = anchor.view, view.window != nil {
                popover.sourceView = view
                popover.sourceRect = view.bounds
            } else {
                popover.sourceView = host.view
                popover.sourceRect = CGRect(x: host.view.bounds.midX, y: host.view.bounds.midY, width: 0, height: 0)
                popover.permittedArrowDirections = []
            }
        }
        host.present(sheet, animated: true)
    }
}

/// What a share sheet points at on iPad, where it is a popover: a plain view laid
/// behind the control that opens it (`.shareAnchor(_:)`).
@MainActor
final class ShareAnchor {
    fileprivate weak var view: UIView?

    /// The controller on top, which the sheet is presented from: a cover or a sheet
    /// when one is up, else the window's root. An alert still on its way out is on
    /// top too, so `ShareSheet` waits for it to go.
    fileprivate func host() -> UIViewController? {
        let window = view?.window
            ?? UIApplication.shared.connectedScenes
                .compactMap { ($0 as? UIWindowScene)?.keyWindow }
                .first
        var top = window?.rootViewController
        while let presented = top?.presentedViewController {
            top = presented
        }
        return top
    }
}

private struct ShareAnchorView: UIViewRepresentable {
    let anchor: ShareAnchor

    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        view.isUserInteractionEnabled = false
        view.backgroundColor = .clear
        anchor.view = view
        return view
    }

    func updateUIView(_ view: UIView, context: Context) {
        anchor.view = view
    }
}

extension View {
    /// Marks this control as the place its share sheet points at on iPad.
    func shareAnchor(_ anchor: ShareAnchor) -> some View {
        background(ShareAnchorView(anchor: anchor))
    }
}

/// A picture for the share sheet, as a JPEG file (named after what it shows, which
/// AirDrop and Files keep), with the title and thumbnail the sheet shows at its top.
final class SharedImageItem: NSObject, UIActivityItemSource {
    let fileURL: URL
    let title: String
    let preview: UIImage

    init(fileURL: URL, title: String, preview: UIImage) {
        self.fileURL = fileURL
        self.title = title
        self.preview = preview
    }

    func activityViewControllerPlaceholderItem(_ controller: UIActivityViewController) -> Any {
        fileURL
    }

    func activityViewController(_ controller: UIActivityViewController,
                                itemForActivityType activityType: UIActivity.ActivityType?) -> Any? {
        fileURL
    }

    func activityViewControllerLinkMetadata(_ controller: UIActivityViewController) -> LPLinkMetadata? {
        let metadata = LPLinkMetadata()
        metadata.title = title
        metadata.imageProvider = NSItemProvider(object: preview)
        return metadata
    }
}

/// The words that go with a share, for the apps that take words: Messages, Mail,
/// WhatsApp and the like. Left out where they would only get in the way: saved
/// with the picture to Photos or Files, printed, or sent by AirDrop, which would
/// hand the other device a note beside the picture.
final class SharedTextItem: NSObject, UIActivityItemSource {
    let text: String
    /// Mail's subject line.
    let subject: String?

    init(text: String, subject: String? = nil) {
        self.text = text
        self.subject = subject
    }

    static let wordless: Set<UIActivity.ActivityType> = [
        .airDrop, .saveToCameraRoll, .assignToContact, .print, .addToReadingList,
        UIActivity.ActivityType("com.apple.DocumentManagerUICore.SaveToFiles")
    ]

    func activityViewControllerPlaceholderItem(_ controller: UIActivityViewController) -> Any {
        text
    }

    func activityViewController(_ controller: UIActivityViewController,
                                itemForActivityType activityType: UIActivity.ActivityType?) -> Any? {
        Self.carriesText(activityType) ? text : nil
    }

    func activityViewController(_ controller: UIActivityViewController,
                                subjectForActivityType activityType: UIActivity.ActivityType?) -> String {
        subject ?? ""
    }

    /// Whether the words go along on `activityType`.
    static func carriesText(_ activityType: UIActivity.ActivityType?) -> Bool {
        guard let activityType else { return true }
        return !wordless.contains(activityType)
    }
}
