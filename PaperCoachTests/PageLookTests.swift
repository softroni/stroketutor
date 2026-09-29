import CoreImage
import UIKit
import XCTest
@testable import PaperCoach

/// The looks on a kept page: what they read from a photo of paper, and what
/// Bright and Scan then do to it.
final class PageLookTests: XCTestCase {

    /// White paper as a dim, blue-grey room photographs it.
    private static let dimPaper = SIMD3<Float>(0.55, 0.60, 0.70)

    // MARK: - Measuring

    func testMeasuringFindsThePaperAndTheInkUnderTheRoomsLight() throws {
        let light = try XCTUnwrap(Self.measure(Self.page()))
        assertEqual(light.paper, Self.dimPaper, accuracy: 0.02)
        XCTAssertLessThan(light.inkLuminance, 0.2)
    }

    /// A bright crayon can outshine paper in shadow, but it is far more colorful
    /// than paper, so the paper's color is still read from the paper.
    func testABrightYellowCrayonIsNotTakenForThePaper() throws {
        let light = try XCTUnwrap(Self.measure(Self.page(yellowCrayon: true)))
        assertEqual(light.paper, Self.dimPaper, accuracy: 0.02)
    }

    func testMeasuringNeedsAnImage() {
        XCTAssertNil(PageLight.measure(rgba: [], width: 0, height: 0))
        XCTAssertNil(PageLight.measure(rgba: [UInt8](repeating: 200, count: 4 * 16), width: 4, height: 4))
    }

    // MARK: - The looks

    func testOriginalIsThePhotoItself() async {
        let photo = Self.page()
        let kept = await PageLook.original.rendered(photo)
        XCTAssertTrue(kept === photo)
    }

    func testBrightTurnsDimPaperNearlyWhiteAndTakesOutTheTint() async throws {
        let rendered = await PageLook.bright.rendered(Self.page())
        let bright = try XCTUnwrap(rendered)
        let paper = try XCTUnwrap(Self.pixel(of: bright, atX: 0.5, y: 0.05))
        for channel in [paper.x, paper.y, paper.z] {
            XCTAssertEqual(channel, 0.95, accuracy: 0.04)
        }
        XCTAssertLessThan(paper.max() - paper.min(), 0.03, "The blue cast is gone.")
        let ink = try XCTUnwrap(Self.pixel(of: bright, atX: 0.5, y: 0.757))
        XCTAssertLessThan(PageLight.luminance(ink), 0.2, "The line stays dark.")
    }

    /// Scan evens out the light cell by cell: paper in shadow comes out as white
    /// as paper in the light. (A gain map upside down would leave the shadow.)
    func testScanTakesAShadowOffThePaper() async throws {
        let rendered = await PageLook.scan.rendered(Self.page(shadowedBottom: true))
        let scan = try XCTUnwrap(rendered)
        for y in [0.03, 0.5, 0.97] {
            let paper = try XCTUnwrap(Self.pixel(of: scan, atX: 0.9, y: y))
            XCTAssertGreaterThan(paper.min(), 0.97, "Paper at y \(y) should be white.")
        }
        let ink = try XCTUnwrap(Self.pixel(of: scan, atX: 0.5, y: 0.757))
        XCTAssertLessThan(PageLight.luminance(ink), 0.2)
    }

    func testTheLooksNeverDarkenAWellLitPage() async throws {
        let lit = Self.page(paper: SIMD3(repeating: 0.97))
        for look in [PageLook.bright, .scan] {
            let rendered = await look.rendered(lit)
            let result = try XCTUnwrap(rendered)
            let paper = try XCTUnwrap(Self.pixel(of: result, atX: 0.5, y: 0.05))
            XCTAssertGreaterThanOrEqual(paper.min(), 0.96, "\(look)")
        }
    }

    /// Keep saves the look at the photo's full size, upright, from a camera shot
    /// stored sideways.
    func testTheKeptLookIsTheWholePhotoUpright() async throws {
        let photo = DebugScreenHarness.pagePhoto(isDim: true)
        let rendered = await PageLook.scan.rendered(photo)
        let scan = try XCTUnwrap(rendered)
        XCTAssertEqual(scan.imageOrientation, .up)
        XCTAssertEqual(scan.size, CGSize(width: 1200, height: 1600))
    }

    func testPreviewsAreScreenSizedForEveryLookButOriginal() async throws {
        let previews = await PageLook.previews(of: Self.page(size: CGSize(width: 1800, height: 2400)))
        XCTAssertEqual(Set(previews.keys), [.bright, .scan])
        for preview in previews.values {
            XCTAssertLessThanOrEqual(max(preview.size.width, preview.size.height) * preview.scale,
                                     PageLook.previewPixelLength + 1)
        }
    }

    // MARK: - Helpers

    /// A sheet filling the photo: `paper` everywhere, a dark pencil line across
    /// it three quarters of the way down, and on request a bright yellow crayon
    /// patch (about 6 % of the photo, lit brighter than the paper) or a shadow
    /// deepening toward the bottom to 60 % of the light.
    private static func page(paper: SIMD3<Float> = dimPaper,
                             yellowCrayon: Bool = false,
                             shadowedBottom: Bool = false,
                             size: CGSize = CGSize(width: 600, height: 800)) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        format.preferredRange = .standard
        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            let cg = context.cgContext
            UIColor(red: CGFloat(paper.x), green: CGFloat(paper.y), blue: CGFloat(paper.z), alpha: 1).setFill()
            cg.fill(CGRect(origin: .zero, size: size))
            if yellowCrayon {
                UIColor(red: 0.80, green: 0.74, blue: 0.10, alpha: 1).setFill()
                cg.fill(CGRect(x: size.width * 0.1, y: size.height * 0.15,
                               width: size.width * 0.25, height: size.height * 0.24))
            }
            UIColor(white: 0.1, alpha: 1).setFill()
            cg.fill(CGRect(x: size.width * 0.07, y: size.height * 0.75,
                           width: size.width * 0.86, height: size.height * 0.015))
            if shadowedBottom {
                cg.setBlendMode(.multiply)
                let shade = [UIColor.white.cgColor, UIColor(white: 0.6, alpha: 1).cgColor]
                if let gradient = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB),
                                            colors: shade as CFArray, locations: [0, 1]) {
                    cg.drawLinearGradient(gradient, start: .zero,
                                          end: CGPoint(x: 0, y: size.height), options: [])
                }
            }
        }
    }

    private static func measure(_ image: UIImage) -> PageLight? {
        PageCropper.uprightCIImage(image).flatMap { PageLight.measure($0, context: PageCropper.context) }
    }

    /// One pixel of an upright image, 0…1, read by drawing the image into a known
    /// sRGB buffer so the answer does not depend on the image's own format.
    private static func pixel(of image: UIImage, atX x: Double, y: Double) -> SIMD3<Float>? {
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
        let column = min(width - 1, Int(x * Double(width)))
        let row = min(height - 1, Int(y * Double(height)))
        let offset = (row * width + column) * 4
        return SIMD3(Float(data[offset]), Float(data[offset + 1]), Float(data[offset + 2])) / 255
    }

    private func assertEqual(_ a: SIMD3<Float>, _ b: SIMD3<Float>, accuracy: Float,
                             file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertEqual(a.x, b.x, accuracy: accuracy, file: file, line: line)
        XCTAssertEqual(a.y, b.y, accuracy: accuracy, file: file, line: line)
        XCTAssertEqual(a.z, b.z, accuracy: accuracy, file: file, line: line)
    }
}
