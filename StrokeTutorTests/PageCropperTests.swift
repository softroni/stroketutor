import UIKit
import XCTest
@testable import StrokeTutor

/// The corner geometry behind auto-crop and the corner editor, the perspective
/// correction, and Vision's detection on the screenshot harness's synthetic photo.
final class PageCropperTests: XCTestCase {

    // MARK: - Ordering and conversion

    func testOrderingNamesCornersByPositionWhateverOrderTheyComeIn() throws {
        let expected = PageCorners(topLeft: CGPoint(x: 0.1, y: 0.2),
                                   topRight: CGPoint(x: 0.9, y: 0.1),
                                   bottomRight: CGPoint(x: 0.8, y: 0.9),
                                   bottomLeft: CGPoint(x: 0.2, y: 0.8))
        let shuffles: [[CGPoint]] = [
            expected.points,
            expected.points.reversed(),
            [expected.bottomRight, expected.topLeft, expected.bottomLeft, expected.topRight],
            [expected.topRight, expected.bottomLeft, expected.topLeft, expected.bottomRight],
        ]
        for points in shuffles {
            XCTAssertEqual(PageCorners.ordered(points), expected, "\(points)")
        }
    }

    func testOrderingNeedsExactlyFourFinitePoints() {
        XCTAssertNil(PageCorners.ordered([.zero, CGPoint(x: 1, y: 0), CGPoint(x: 1, y: 1)]))
        XCTAssertNil(PageCorners.ordered([.zero, CGPoint(x: 1, y: 0), CGPoint(x: 1, y: 1),
                                          CGPoint(x: CGFloat.nan, y: 1)]))
    }

    func testVisionPointsAreFlippedIntoTopLeftSpace() throws {
        // Vision: origin bottom left, y up. Labels deliberately wrong, as they are
        // for a page photographed upside down.
        let vision = [CGPoint(x: 0.8, y: 0.1),  // "top left": really bottom right
                      CGPoint(x: 0.2, y: 0.15), // "top right": really bottom left
                      CGPoint(x: 0.25, y: 0.9), // "bottom right": really top left
                      CGPoint(x: 0.85, y: 0.85)] // "bottom left": really top right
        let corners = try XCTUnwrap(PageCorners.fromVision(vision))
        assertEqual(corners.topLeft, CGPoint(x: 0.25, y: 0.1))
        assertEqual(corners.topRight, CGPoint(x: 0.85, y: 0.15))
        assertEqual(corners.bottomRight, CGPoint(x: 0.8, y: 0.9))
        assertEqual(corners.bottomLeft, CGPoint(x: 0.2, y: 0.85))
    }

    func testVisionPointsOffThePhotoAreClamped() throws {
        let corners = try XCTUnwrap(PageCorners.fromVision([CGPoint(x: -0.1, y: 1.05),
                                                            CGPoint(x: 1.2, y: 1.0),
                                                            CGPoint(x: 1.0, y: -0.3),
                                                            CGPoint(x: 0.0, y: 0.0)]))
        XCTAssertEqual(corners, PageCorners(topLeft: CGPoint(x: 0, y: 0),
                                            topRight: CGPoint(x: 1, y: 0),
                                            bottomRight: CGPoint(x: 1, y: 1),
                                            bottomLeft: CGPoint(x: 0, y: 1)))
    }

    func testClampingKeepsEveryCornerOnThePhoto() {
        let wild = PageCorners(topLeft: CGPoint(x: -3, y: 0.5),
                               topRight: CGPoint(x: 1.4, y: -0.2),
                               bottomRight: CGPoint(x: 0.5, y: 7),
                               bottomLeft: CGPoint(x: 0.3, y: 0.4))
        let clamped = wild.clamped()
        XCTAssertEqual(clamped.topLeft, CGPoint(x: 0, y: 0.5))
        XCTAssertEqual(clamped.topRight, CGPoint(x: 1, y: 0))
        XCTAssertEqual(clamped.bottomRight, CGPoint(x: 0.5, y: 1))
        XCTAssertEqual(clamped.bottomLeft, CGPoint(x: 0.3, y: 0.4))
    }

    // MARK: - Is it a page?

    func testAKeystonedSheetAndTheInsetDefaultAreUsable() {
        XCTAssertTrue(PageCorners.inset().isUsable(aspectRatio: 0.75))
        XCTAssertTrue(PageCorners.inset(by: 0).isUsable(aspectRatio: 0.75))
        XCTAssertTrue(DebugScreenHarness.pagePhotoCorners.isUsable(aspectRatio: 0.75))
    }

    func testANonConvexQuadIsRejected() {
        var dart = PageCorners.inset()
        dart.bottomRight = CGPoint(x: 0.4, y: 0.4) // pushed in past the diagonal
        XCTAssertFalse(dart.isUsable(aspectRatio: 0.75))
    }

    func testASelfIntersectingQuadIsRejected() {
        var bowtie = PageCorners.inset()
        swap(&bowtie.bottomLeft, &bowtie.bottomRight)
        XCTAssertFalse(bowtie.isUsable(aspectRatio: 0.75))
    }

    func testAMirroredWindingIsRejected() {
        let square = PageCorners.inset()
        let mirrored = PageCorners(topLeft: square.topRight, topRight: square.topLeft,
                                   bottomRight: square.bottomLeft, bottomLeft: square.bottomRight)
        XCTAssertFalse(mirrored.isUsable(aspectRatio: 1))
    }

    func testAFlattenedCornerIsRejected() {
        // Top right almost on the line from top left to bottom right.
        let flat = PageCorners(topLeft: CGPoint(x: 0.1, y: 0.1),
                               topRight: CGPoint(x: 0.5, y: 0.49),
                               bottomRight: CGPoint(x: 0.9, y: 0.9),
                               bottomLeft: CGPoint(x: 0.1, y: 0.9))
        XCTAssertFalse(flat.isUsable(aspectRatio: 1))
    }

    func testATinyQuadIsRejected() {
        let tiny = PageCorners(topLeft: CGPoint(x: 0.5, y: 0.5),
                               topRight: CGPoint(x: 0.53, y: 0.5),
                               bottomRight: CGPoint(x: 0.53, y: 0.53),
                               bottomLeft: CGPoint(x: 0.5, y: 0.53))
        XCTAssertFalse(tiny.isUsable(aspectRatio: 1))
    }

    // MARK: - Moving a corner

    func testAFreeMoveGoesAllTheWay() {
        let moved = PageCorners.inset().moving(.topLeft, toward: CGPoint(x: 0.02, y: 0.03),
                                               aspectRatio: 0.75)
        XCTAssertEqual(moved.topLeft, CGPoint(x: 0.02, y: 0.03))
    }

    func testAMoveOffThePhotoStopsAtItsEdge() {
        let moved = PageCorners.inset().moving(.bottomRight, toward: CGPoint(x: 1.3, y: 1.6),
                                               aspectRatio: 0.75)
        XCTAssertEqual(moved.bottomRight, CGPoint(x: 1, y: 1))
    }

    func testAMoveThatWouldFoldThePageStopsShortOfIt() {
        let start = PageCorners.inset()
        // Drag the bottom right up past the top left.
        let moved = start.moving(.bottomRight, toward: CGPoint(x: 0.0, y: 0.0), aspectRatio: 0.75)
        XCTAssertTrue(moved.isUsable(aspectRatio: 0.75))
        XCTAssertNotEqual(moved.bottomRight, start.bottomRight, "The dot should travel as far as it may.")
        XCTAssertGreaterThan(moved.bottomRight.x, 0.08)
        XCTAssertEqual(moved.topLeft, start.topLeft)
        XCTAssertEqual(moved.topRight, start.topRight)
        XCTAssertEqual(moved.bottomLeft, start.bottomLeft)
    }

    // MARK: - Correction

    func testCorrectionStraightensTheSheetAndKeepsItUpright() throws {
        // An upright 600 × 800 picture: red above the middle, blue below, stored
        // sideways and tagged `.right` the way the camera stores it.
        let upright = Self.twoTonePhoto(size: CGSize(width: 600, height: 800))
        let photo = DebugScreenHarness.sensorOriented(upright)
        XCTAssertEqual(photo.imageOrientation, .right)
        XCTAssertEqual(photo.cgImage?.width, 800, "The buffer should be the sideways one.")

        let corners = PageCorners(topLeft: CGPoint(x: 0.1, y: 0.1),
                                  topRight: CGPoint(x: 0.9, y: 0.1),
                                  bottomRight: CGPoint(x: 0.9, y: 0.9),
                                  bottomLeft: CGPoint(x: 0.1, y: 0.9))
        let page = try XCTUnwrap(PageCropper.perspectiveCorrected(photo, to: corners))
        XCTAssertEqual(page.imageOrientation, .up)
        XCTAssertEqual(page.size.width, 480, accuracy: 3)
        XCTAssertEqual(page.size.height, 640, accuracy: 3)

        let top = try XCTUnwrap(Self.pixel(of: page, atX: 0.5, y: 0.2))
        let bottom = try XCTUnwrap(Self.pixel(of: page, atX: 0.5, y: 0.8))
        XCTAssertGreaterThan(top.red, 200); XCTAssertLessThan(top.blue, 60)
        XCTAssertGreaterThan(bottom.blue, 200); XCTAssertLessThan(bottom.red, 60)
    }

    func testCorrectionOfAKeystoneComesOutPortraitAndPageSized() throws {
        let photo = DebugScreenHarness.pagePhoto()
        let page = try XCTUnwrap(PageCropper.perspectiveCorrected(photo, to: DebugScreenHarness.pagePhotoCorners))
        XCTAssertEqual(page.imageOrientation, .up)
        XCTAssertGreaterThan(page.size.height, page.size.width, "A portrait sheet stays portrait.")
        XCTAssertGreaterThan(page.size.width, 600)
        XCTAssertLessThanOrEqual(page.size.height, 1600)
        // The straightened sheet is paper right to its corners, not desk.
        for (x, y) in [(0.03, 0.03), (0.97, 0.03), (0.97, 0.97), (0.03, 0.97)] {
            let pixel = try XCTUnwrap(Self.pixel(of: page, atX: x, y: y))
            XCTAssertGreaterThan(pixel.red, 180, "Corner (\(x), \(y)) should be paper.")
        }
    }

    // MARK: - Detection

    /// Vision on the harness's photo: a keystoned sheet on dark wood, stored
    /// sideways. The budget is loosened here because a cold simulator can be slow
    /// to load the model; the 300 ms rule is the app's, not what this checks.
    ///
    /// In the simulator this runs Vision's rectangle detector, not document
    /// segmentation (see `PageCropper.makePageRequest`), so it checks the
    /// orientation fix, the conversion and the ordering around the request, not
    /// the segmentation model itself.
    func testDetectionFindsTheSheetInTheHarnessPhoto() async throws {
        let photo = DebugScreenHarness.pagePhoto()
        let detected = await PageCropper.detectPage(in: photo, budget: 10)
        let corners = try XCTUnwrap(detected)
        let truth = DebugScreenHarness.pagePhotoCorners
        for corner in PageCorners.Corner.allCases {
            XCTAssertEqual(corners[corner].x, truth[corner].x, accuracy: 0.03, "\(corner)")
            XCTAssertEqual(corners[corner].y, truth[corner].y, accuracy: 0.03, "\(corner)")
        }
    }

    func testDetectionFindsNothingOnABareDesk() async {
        let desk = DebugScreenHarness.pagePhoto(showsPage: false)
        let corners = await PageCropper.detectPage(in: desk, budget: 10)
        XCTAssertNil(corners)
    }

    // MARK: - Helpers

    private func assertEqual(_ a: CGPoint, _ b: CGPoint, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertEqual(a.x, b.x, accuracy: 1e-9, file: file, line: line)
        XCTAssertEqual(a.y, b.y, accuracy: 1e-9, file: file, line: line)
    }

    private static func twoTonePhoto(size: CGSize) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            UIColor.red.setFill()
            context.fill(CGRect(x: 0, y: 0, width: size.width, height: size.height / 2))
            UIColor.blue.setFill()
            context.fill(CGRect(x: 0, y: size.height / 2, width: size.width, height: size.height / 2))
        }
    }

    /// One pixel of an upright image, read by drawing the image into a known
    /// RGBA buffer so the answer does not depend on the image's own format.
    private static func pixel(of image: UIImage, atX x: Double, y: Double)
        -> (red: UInt8, green: UInt8, blue: UInt8)? {
        guard let cgImage = image.cgImage else { return nil }
        let width = cgImage.width, height = cgImage.height
        var data = [UInt8](repeating: 0, count: width * height * 4)
        let drawn = data.withUnsafeMutableBytes { buffer -> Bool in
            guard let context = CGContext(data: buffer.baseAddress, width: width, height: height,
                                          bitsPerComponent: 8, bytesPerRow: width * 4,
                                          space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
            else { return false }
            context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
            return true
        }
        guard drawn else { return nil }
        // CGContext rows run top to bottom in memory for a drawn image.
        let column = min(width - 1, Int(x * Double(width)))
        let row = min(height - 1, Int(y * Double(height)))
        let offset = (row * width + column) * 4
        return (data[offset], data[offset + 1], data[offset + 2])
    }
}
