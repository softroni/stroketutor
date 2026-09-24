import SwiftUI
import UIKit

/// A kept page's photograph, full screen on black, opened by tapping it on
/// `sk-entry`: nothing around it but a close button. Pinch or double-tap to look
/// closer; drag it down, or ✕, to go back to the page.
///
/// Presented with a clear background, so the entry shows through as the black
/// fades while the photo is dragged away.
struct SketchbookPhotoViewer: View {
    let image: UIImage
    let accessibilityLabel: String

    @Environment(\.dismiss) private var dismiss
    /// 1 at rest, falling towards 0 as the photo is dragged down.
    @State private var backdrop: CGFloat = 1

    var body: some View {
        ZStack(alignment: .topLeading) {
            Color.black
                .opacity(backdrop)
                .ignoresSafeArea()

            ZoomablePhoto(image: image,
                          accessibilityLabel: accessibilityLabel,
                          onDragProgress: { backdrop = 1 - $0 },
                          onDismiss: { dismiss() })
                .ignoresSafeArea()

            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    // A fixed glyph in a fixed circle, like the badges; dark, so it
                    // still shows over a pale page zoomed in behind it.
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: Theme.navTapTarget, height: Theme.navTapTarget)
                    .background(Circle().fill(.black.opacity(0.45)))
                    .contentShape(Circle())
            }
            .accessibilityLabel("Close")
            .padding(.leading, Theme.gutter)
            .padding(.top, 8)
            .opacity(backdrop)
        }
        .statusBarHidden()
        .accessibilityAction(.escape) { dismiss() }
    }
}

/// The photo in a `UIScrollView`, for the pinch, pan, bounce and double-tap zoom a
/// photo is expected to have, plus a pan of its own that drags it down to close
/// while it is not zoomed in.
private struct ZoomablePhoto: UIViewRepresentable {
    let image: UIImage
    let accessibilityLabel: String
    /// 0 at rest to 1 far enough down to close.
    var onDragProgress: (CGFloat) -> Void
    var onDismiss: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> PhotoScrollView {
        let view = PhotoScrollView(image: image)
        view.delegate = context.coordinator
        view.imageView.isAccessibilityElement = true
        view.imageView.accessibilityLabel = accessibilityLabel
        view.imageView.accessibilityTraits = .image

        let doubleTap = UITapGestureRecognizer(target: context.coordinator,
                                               action: #selector(Coordinator.doubleTapped(_:)))
        doubleTap.numberOfTapsRequired = 2
        view.addGestureRecognizer(doubleTap)

        let drag = UIPanGestureRecognizer(target: context.coordinator,
                                          action: #selector(Coordinator.dragged(_:)))
        drag.delegate = context.coordinator
        view.addGestureRecognizer(drag)
        // Zoomed in, the drag declines at once and the scroll view pans as usual.
        view.panGestureRecognizer.require(toFail: drag)
        return view
    }

    func updateUIView(_ view: PhotoScrollView, context: Context) {
        context.coordinator.parent = self
    }

    final class Coordinator: NSObject, UIScrollViewDelegate, UIGestureRecognizerDelegate {
        var parent: ZoomablePhoto

        /// How far down, in points, counts as all the way.
        private let dragDistance: CGFloat = 320

        init(_ parent: ZoomablePhoto) {
            self.parent = parent
        }

        func viewForZooming(in scrollView: UIScrollView) -> UIView? {
            (scrollView as? PhotoScrollView)?.imageView
        }

        func scrollViewDidZoom(_ scrollView: UIScrollView) {
            (scrollView as? PhotoScrollView)?.centerImage()
        }

        /// In to 2.5× around the tapped point, or back out.
        @objc func doubleTapped(_ gesture: UITapGestureRecognizer) {
            guard let view = gesture.view as? PhotoScrollView else { return }
            if view.zoomScale > view.minimumZoomScale {
                view.setZoomScale(view.minimumZoomScale, animated: true)
                return
            }
            let point = gesture.location(in: view.imageView)
            let scale = min(2.5, view.maximumZoomScale)
            let size = CGSize(width: view.bounds.width / scale, height: view.bounds.height / scale)
            view.zoom(to: CGRect(x: point.x - size.width / 2, y: point.y - size.height / 2,
                                 width: size.width, height: size.height),
                      animated: true)
        }

        @objc func dragged(_ gesture: UIPanGestureRecognizer) {
            guard let view = gesture.view as? PhotoScrollView else { return }
            let translation = gesture.translation(in: view)
            let progress = min(1, max(0, translation.y) / dragDistance)

            switch gesture.state {
            case .changed:
                view.imageView.transform = CGAffineTransform(translationX: translation.x, y: translation.y)
                    .scaledBy(x: 1 - progress * 0.25, y: 1 - progress * 0.25)
                parent.onDragProgress(progress)
            case .ended, .cancelled:
                let velocity = gesture.velocity(in: view).y
                if gesture.state == .ended && (translation.y > 120 || velocity > 900) {
                    parent.onDismiss()
                } else {
                    UIView.animate(withDuration: 0.25, delay: 0,
                                   usingSpringWithDamping: 0.85, initialSpringVelocity: 0) {
                        view.imageView.transform = .identity
                    }
                    withAnimation(.easeOut(duration: 0.25)) { parent.onDragProgress(0) }
                }
            default:
                break
            }
        }

        /// Only a mostly-downward drag, and only while the photo is not zoomed in.
        func gestureRecognizerShouldBegin(_ gesture: UIGestureRecognizer) -> Bool {
            guard let pan = gesture as? UIPanGestureRecognizer,
                  let view = pan.view as? UIScrollView else { return true }
            guard view.zoomScale <= view.minimumZoomScale + 0.01 else { return false }
            let velocity = pan.velocity(in: view)
            return velocity.y > 0 && velocity.y > abs(velocity.x)
        }
    }
}

/// A scroll view holding one image fitted to its bounds at zoom 1 and kept centered
/// at every zoom.
private final class PhotoScrollView: UIScrollView {
    let imageView: UIImageView
    private var fittedBounds: CGSize = .zero

    init(image: UIImage) {
        imageView = UIImageView(image: image)
        super.init(frame: .zero)
        imageView.contentMode = .scaleAspectFit
        addSubview(imageView)
        backgroundColor = .clear
        showsHorizontalScrollIndicator = false
        showsVerticalScrollIndicator = false
        contentInsetAdjustmentBehavior = .never
        decelerationRate = .fast
        minimumZoomScale = 1
        maximumZoomScale = 4
        bouncesZoom = true
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layoutSubviews() {
        super.layoutSubviews()
        // Refit on the first layout and on rotation, not on every scroll.
        if bounds.size != fittedBounds, bounds.width > 0, bounds.height > 0 {
            fittedBounds = bounds.size
            zoomScale = 1
            let imageSize = imageView.image?.size ?? bounds.size
            let fit = min(bounds.width / max(imageSize.width, 1), bounds.height / max(imageSize.height, 1))
            imageView.frame = CGRect(x: 0, y: 0,
                                     width: imageSize.width * fit, height: imageSize.height * fit)
            contentSize = imageView.frame.size
        }
        centerImage()
    }

    /// Insets that keep the image in the middle while it is smaller than the view.
    func centerImage() {
        let horizontal = max(0, (bounds.width - imageView.frame.width) / 2)
        let vertical = max(0, (bounds.height - imageView.frame.height) / 2)
        contentInset = UIEdgeInsets(top: vertical, left: horizontal, bottom: vertical, right: horizontal)
    }
}
