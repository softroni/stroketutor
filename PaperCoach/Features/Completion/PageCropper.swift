import CoreImage
import CoreImage.CIFilterBuiltins
import UIKit
@preconcurrency import Vision

/// The four corners of the paper in a photograph, in the photo's own upright space:
/// normalized 0…1, origin at the top left, y growing down. The same space the photo
/// is drawn in on screen, so the corner editor can place a handle by multiplying.
///
/// A phone photo of a sheet on a desk is keystoned, not rotated, so four corners fix
/// the crop and the straightening in one gesture (`sk-capture` notes). Everything
/// here is pure geometry, so it is tested without Vision or a screen.
struct PageCorners: Equatable, Sendable {
    var topLeft: CGPoint
    var topRight: CGPoint
    var bottomRight: CGPoint
    var bottomLeft: CGPoint

    enum Corner: Int, CaseIterable, Identifiable, Sendable {
        case topLeft, topRight, bottomRight, bottomLeft

        var id: Int { rawValue }

        /// What VoiceOver reads for the corner's handle.
        var accessibilityName: String {
            switch self {
            case .topLeft: return "Top-left corner"
            case .topRight: return "Top-right corner"
            case .bottomRight: return "Bottom-right corner"
            case .bottomLeft: return "Bottom-left corner"
            }
        }
    }

    subscript(corner: Corner) -> CGPoint {
        get {
            switch corner {
            case .topLeft: return topLeft
            case .topRight: return topRight
            case .bottomRight: return bottomRight
            case .bottomLeft: return bottomLeft
            }
        }
        set {
            switch corner {
            case .topLeft: topLeft = newValue
            case .topRight: topRight = newValue
            case .bottomRight: bottomRight = newValue
            case .bottomLeft: bottomLeft = newValue
            }
        }
    }

    /// Clockwise on screen, starting at the top left.
    var points: [CGPoint] { [topLeft, topRight, bottomRight, bottomLeft] }

    /// A rectangle `fraction` in from every edge of the photo: where the editor's
    /// handles start when nothing was detected, close enough to a page held up to
    /// the camera that the learner only has to nudge them.
    static func inset(by fraction: CGFloat = 0.08) -> PageCorners {
        let near = fraction, far = 1 - fraction
        return PageCorners(topLeft: CGPoint(x: near, y: near),
                           topRight: CGPoint(x: far, y: near),
                           bottomRight: CGPoint(x: far, y: far),
                           bottomLeft: CGPoint(x: near, y: far))
    }

    // MARK: - Ordering and conversion

    /// Names any four points by where they sit rather than by the order they came
    /// in: sorted clockwise around their centroid, then turned so the point nearest
    /// the photo's top-left corner (smallest x + y) comes first. Vision's own labels
    /// are not trusted, because they follow the page and not the screen: a sheet
    /// photographed upside down would otherwise come out upside down.
    static func ordered(_ points: [CGPoint]) -> PageCorners? {
        guard points.count == 4,
              points.allSatisfy({ $0.x.isFinite && $0.y.isFinite }) else { return nil }
        let center = CGPoint(x: points.map(\.x).reduce(0, +) / 4,
                             y: points.map(\.y).reduce(0, +) / 4)
        // With y growing down, increasing atan2 runs clockwise on screen.
        var clockwise = points.sorted {
            atan2($0.y - center.y, $0.x - center.x) < atan2($1.y - center.y, $1.x - center.x)
        }
        var first = 0
        for index in 1..<4 where clockwise[index].x + clockwise[index].y
            < clockwise[first].x + clockwise[first].y {
            first = index
        }
        clockwise = Array(clockwise[first...] + clockwise[..<first])
        return PageCorners(topLeft: clockwise[0], topRight: clockwise[1],
                           bottomRight: clockwise[2], bottomLeft: clockwise[3])
    }

    /// Vision reports normalized points with the origin at the bottom left; this
    /// flips them into the photo's top-left space, orders them and keeps them on
    /// the photo.
    static func fromVision(_ points: [CGPoint]) -> PageCorners? {
        ordered(points.map { CGPoint(x: $0.x, y: 1 - $0.y) })?.clamped()
    }

    /// Every corner kept on the photo.
    func clamped() -> PageCorners {
        func clamp(_ point: CGPoint) -> CGPoint {
            CGPoint(x: min(max(point.x, 0), 1), y: min(max(point.y, 0), 1))
        }
        return PageCorners(topLeft: clamp(topLeft), topRight: clamp(topRight),
                           bottomRight: clamp(bottomRight), bottomLeft: clamp(bottomLeft))
    }

    // MARK: - Is it a page?

    /// The smallest corner angle a page may have, and (as its supplement) the
    /// flattest. Anything sharper or flatter is three corners in a line, not paper.
    static let minimumCornerAngle: CGFloat = 5 * .pi / 180
    /// The shortest side, as a fraction of the photo's long edge.
    static let minimumSideLength: CGFloat = 0.05
    /// The smallest page, as a fraction of the photo's area.
    static let minimumArea: CGFloat = 0.03

    /// True for a quad that can be straightened into a page: convex, wound
    /// top-left → top-right → bottom-right → bottom-left, with no corner flattened
    /// or pinched and not too small to be the sheet. `aspectRatio` is the photo's
    /// width over its height, so angles and lengths are judged as they look rather
    /// than in the squashed unit square.
    func isUsable(aspectRatio: CGFloat) -> Bool {
        guard aspectRatio.isFinite, aspectRatio > 0 else { return false }
        let longEdge = max(aspectRatio, 1)
        // Photo space, scaled so the long edge is 1.
        let scaled = points.map { CGPoint(x: $0.x * aspectRatio / longEdge, y: $0.y / longEdge) }
        guard scaled.allSatisfy({ $0.x.isFinite && $0.y.isFinite }) else { return false }

        let minimumSine = sin(Self.minimumCornerAngle)
        for index in 0..<4 {
            let previous = scaled[(index + 3) % 4]
            let current = scaled[index]
            let next = scaled[(index + 1) % 4]
            let incoming = CGVector(dx: current.x - previous.x, dy: current.y - previous.y)
            let outgoing = CGVector(dx: next.x - current.x, dy: next.y - current.y)
            let incomingLength = hypot(incoming.dx, incoming.dy)
            let outgoingLength = hypot(outgoing.dx, outgoing.dy)
            guard incomingLength >= Self.minimumSideLength,
                  outgoingLength >= Self.minimumSideLength else { return false }
            // Every turn must go the same way (clockwise with y down): four such
            // turns can only add up to one full turn, so the quad is convex and
            // cannot cross itself. The sine of the turn is the sine of the corner.
            let cross = incoming.dx * outgoing.dy - incoming.dy * outgoing.dx
            guard cross / (incomingLength * outgoingLength) >= minimumSine else { return false }
        }
        return area >= Self.minimumArea
    }

    /// The shoelace area in the unit square: the fraction of the photo inside.
    var area: CGFloat {
        let p = points
        var twice: CGFloat = 0
        for index in 0..<4 {
            let a = p[index], b = p[(index + 1) % 4]
            twice += a.x * b.y - b.x * a.y
        }
        return abs(twice) / 2
    }

    /// One corner moved toward `target`, kept on the photo, and stopped at the last
    /// point where the quad is still a page. A drag that would fold the quad does
    /// not jump back or freeze in place: the handle slides as far as it may go and
    /// waits there. (The positions that keep one corner valid, with the other three
    /// fixed, form a convex region, so a bisection along the drag finds its edge.)
    func moving(_ corner: Corner, toward target: CGPoint, aspectRatio: CGFloat) -> PageCorners {
        let goal = CGPoint(x: min(max(target.x, 0), 1), y: min(max(target.y, 0), 1))
        var candidate = self
        candidate[corner] = goal
        if candidate.isUsable(aspectRatio: aspectRatio) { return candidate }
        // Nothing to hold on to: let the learner pull a bad quad back into shape.
        guard isUsable(aspectRatio: aspectRatio) else { return candidate }

        let start = self[corner]
        var reachable: CGFloat = 0, blocked: CGFloat = 1
        for _ in 0..<16 {
            let middle = (reachable + blocked) / 2
            candidate[corner] = CGPoint(x: start.x + (goal.x - start.x) * middle,
                                        y: start.y + (goal.y - start.y) * middle)
            if candidate.isUsable(aspectRatio: aspectRatio) {
                reachable = middle
            } else {
                blocked = middle
            }
        }
        candidate[corner] = CGPoint(x: start.x + (goal.x - start.x) * reachable,
                                    y: start.y + (goal.y - start.y) * reachable)
        return candidate
    }
}

/// Finds the paper in a photograph and straightens it. Two jobs, both off the main
/// thread, and neither ever changes a color: no enhancement, no filters (`sk-capture`
/// notes: "Only two edits exist … No filters."). A failure here only means the
/// learner keeps the photo as it was taken; Keep never waits on it.
enum PageCropper {

    /// `sk-capture` notes: "Auto-crop (VNDetectDocumentSegmentationRequest, 300 ms
    /// budget, confidence > 0.8) pre-fills the crop and never blocks saving."
    static let detectionBudget: TimeInterval = 0.3
    static let minimumConfidence: Float = 0.8
    /// Vision finds a sheet as well in a 1024 px copy as in 12 MP, much faster; the
    /// corners are normalized, so they carry straight back to the full photo.
    static let detectionPixelLength: CGFloat = 1024

    /// The detected corners and the page straightened from them.
    struct AutoCrop {
        let corners: PageCorners
        let image: UIImage
    }

    /// Detection and correction together, for a photo that has just arrived. Nil
    /// when no page was found in time, or confidently enough.
    static func autoCrop(_ image: UIImage) async -> AutoCrop? {
        guard let corners = await detectPage(in: image),
              let corrected = await correct(image, to: corners) else { return nil }
        return AutoCrop(corners: corners, image: corrected)
    }

    // MARK: - Detection

    /// The page's corners, or nil when Vision is slower than `budget`, less sure
    /// than `minimumConfidence`, finds nothing, or finds a shape that is not a page.
    /// The budget covers the Vision request alone; the small upright copy it reads
    /// is made first, outside it.
    static func detectPage(in image: UIImage,
                           budget: TimeInterval = detectionBudget,
                           minimumConfidence: Float = minimumConfidence) async -> PageCorners? {
        let aspectRatio = image.size.height > 0 ? image.size.width / image.size.height : 0
        guard let input = await Task.detached(priority: .userInitiated, operation: {
            detectionImage(from: image)
        }).value else { return nil }

        return await withCheckedContinuation { continuation in
            let answer = ResumeOnce(continuation)
            let request = makePageRequest()
            DispatchQueue.global(qos: .userInitiated).async {
                let started = DispatchTime.now().uptimeNanoseconds
                let handler = VNImageRequestHandler(cgImage: input, orientation: .up, options: [:])
                do {
                    try handler.perform([request])
                } catch {
                    answer.resume(nil)
                    return
                }
                let elapsed = TimeInterval(DispatchTime.now().uptimeNanoseconds - started) / 1_000_000_000
                let found = (request.results ?? []).compactMap { $0 as? VNRectangleObservation }
                guard elapsed <= budget,
                      let best = found.max(by: { $0.confidence < $1.confidence }),
                      best.confidence > minimumConfidence,
                      let corners = PageCorners.fromVision([best.topLeft, best.topRight,
                                                            best.bottomRight, best.bottomLeft]),
                      corners.isUsable(aspectRatio: aspectRatio)
                else {
                    answer.resume(nil)
                    return
                }
                answer.resume(corners)
            }
            // Over budget is "not detected", whether or not Vision would have
            // finished a moment later.
            DispatchQueue.global(qos: .userInitiated).asyncAfter(deadline: .now() + budget) {
                request.cancel()
                answer.resume(nil)
            }
        }
    }

    /// Loads Vision's segmentation model on a blank image, so the learner's first
    /// photo is not the one that pays for it and misses the 300 ms budget.
    static func prewarm() {
        DispatchQueue.global(qos: .utility).async {
            let size = CGSize(width: 64, height: 64)
            let format = UIGraphicsImageRendererFormat()
            format.scale = 1
            guard let blank = UIGraphicsImageRenderer(size: size, format: format).image(actions: { context in
                UIColor.darkGray.setFill()
                context.fill(CGRect(origin: .zero, size: size))
            }).cgImage else { return }
            try? VNImageRequestHandler(cgImage: blank, orientation: .up, options: [:])
                .perform([makePageRequest()])
        }
    }

    /// The request that finds the sheet: document segmentation, as the notes
    /// specify, on every device.
    ///
    /// Not in the simulator, though. There the segmentation model answers every
    /// image with the same full-width band along the bottom at 0.99 confidence,
    /// while the very same image run through Vision on a Mac comes back with the
    /// sheet's true corners. So the simulator, and with it the screenshot harness
    /// and the unit tests, uses Vision's rectangle detector, which finds a flat
    /// sheet on a desk as well and exercises every step after it unchanged.
    private static func makePageRequest() -> VNImageBasedRequest {
        #if targetEnvironment(simulator)
        let request = VNDetectRectanglesRequest()
        request.minimumAspectRatio = 0.3
        request.maximumAspectRatio = 1
        request.minimumSize = 0.2
        request.maximumObservations = 1
        return request
        #else
        return VNDetectDocumentSegmentationRequest()
        #endif
    }

    /// A small upright copy of the photo for Vision, so its normalized answer is
    /// in the same space the photo is drawn in.
    static func detectionImage(from image: UIImage) -> CGImage? {
        guard let upright = uprightCIImage(image) else { return nil }
        let longEdge = max(upright.extent.width, upright.extent.height)
        guard longEdge > 0 else { return nil }
        let scale = min(1, detectionPixelLength / longEdge)
        let small = scale < 1
            ? upright.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
            : upright
        return context.createCGImage(small, from: small.extent.integral)
    }

    // MARK: - Correction

    /// The page inside `corners`, straightened to a rectangle at the photo's full
    /// resolution, on a background task.
    static func correct(_ image: UIImage, to corners: PageCorners) async -> UIImage? {
        await Task.detached(priority: .userInitiated) {
            perspectiveCorrected(image, to: corners)
        }.value
    }

    /// `CIPerspectiveCorrection` over the upright photo. Core Image counts y up
    /// from the bottom, so each corner's y is flipped on the way in. The context
    /// does no color management and the output is tagged with the photo's own
    /// color space, so pixels are resampled and never recolored.
    static func perspectiveCorrected(_ image: UIImage, to corners: PageCorners) -> UIImage? {
        guard let upright = uprightCIImage(image) else { return nil }
        let extent = upright.extent
        func coreImagePoint(_ point: CGPoint) -> CGPoint {
            CGPoint(x: extent.minX + point.x * extent.width,
                    y: extent.minY + (1 - point.y) * extent.height)
        }
        let filter = CIFilter.perspectiveCorrection()
        filter.inputImage = upright
        filter.topLeft = coreImagePoint(corners.topLeft)
        filter.topRight = coreImagePoint(corners.topRight)
        filter.bottomRight = coreImagePoint(corners.bottomRight)
        filter.bottomLeft = coreImagePoint(corners.bottomLeft)
        filter.crop = true

        guard let output = filter.outputImage else { return nil }
        let rect = output.extent.integral
        guard !rect.isInfinite, rect.width >= 1, rect.height >= 1 else { return nil }

        let colorSpace = image.cgImage?.colorSpace.flatMap { $0.model == .rgb ? $0 : nil }
            ?? CGColorSpace(name: CGColorSpace.sRGB)!
        guard let cgImage = context.createCGImage(output, from: rect,
                                                  format: .RGBA8, colorSpace: colorSpace) else {
            return nil
        }
        return UIImage(cgImage: cgImage, scale: 1, orientation: .up)
    }

    // MARK: - Orientation

    /// The photo as a Core Image image with its orientation applied and its origin
    /// at zero. A camera photo arrives as a sideways sensor buffer tagged `.right`;
    /// Vision and Core Image both read raw pixels, so without this every corner
    /// would be a quarter turn out.
    static func uprightCIImage(_ image: UIImage) -> CIImage? {
        let base: CIImage
        if let cgImage = image.cgImage {
            base = CIImage(cgImage: cgImage)
        } else if let ciImage = image.ciImage {
            base = ciImage
        } else {
            return nil
        }
        let oriented = base.oriented(CGImagePropertyOrientation(image.imageOrientation))
        return oriented.transformed(by: CGAffineTransform(translationX: -oriented.extent.minX,
                                                          y: -oriented.extent.minY))
    }

    /// No working color space: pixel values pass through untouched.
    private static let context = CIContext(options: [.workingColorSpace: NSNull(),
                                                     .cacheIntermediates: false])
}

/// Hands a continuation exactly one answer, whichever of Vision and the budget
/// timer speaks first.
private final class ResumeOnce: @unchecked Sendable {
    private var continuation: CheckedContinuation<PageCorners?, Never>?
    private let lock = NSLock()

    init(_ continuation: CheckedContinuation<PageCorners?, Never>) {
        self.continuation = continuation
    }

    func resume(_ corners: PageCorners?) {
        lock.lock()
        let pending = continuation
        continuation = nil
        lock.unlock()
        pending?.resume(returning: corners)
    }
}

extension CGImagePropertyOrientation {
    /// The two enums name the same eight orientations; only the raw values differ.
    init(_ orientation: UIImage.Orientation) {
        switch orientation {
        case .up: self = .up
        case .down: self = .down
        case .left: self = .left
        case .right: self = .right
        case .upMirrored: self = .upMirrored
        case .downMirrored: self = .downMirrored
        case .leftMirrored: self = .leftMirrored
        case .rightMirrored: self = .rightMirrored
        @unknown default: self = .up
        }
    }
}
