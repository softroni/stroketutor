import UIKit
import XCTest
@testable import StrokeTutor

/// The sketchbook writes real files, so every test here works in a temporary
/// directory and cleans up after itself.
@MainActor
final class SketchbookStoreTests: XCTestCase {

    private var directory: URL!

    override func setUp() {
        super.setUp()
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("SketchbookStoreTests-\(UUID().uuidString)", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: directory)
        directory = nil
        super.tearDown()
    }

    func testAPageRoundTripsThroughDisk() throws {
        let store = SketchbookStore(baseDirectory: directory)
        XCTAssertTrue(store.isEmpty)

        let page = try XCTUnwrap(store.add(image: Self.image(), lessonId: "palm-tree-4", pathId: "trees"))
        XCTAssertEqual(store.count, 1)
        XCTAssertNotNil(store.image(for: page), "The JPEG should be readable straight back.")

        let reloaded = SketchbookStore(baseDirectory: directory)
        let restored = try XCTUnwrap(reloaded.page(id: page.id))
        XCTAssertEqual(restored.lessonId, "palm-tree-4")
        XCTAssertEqual(restored.pathId, "trees")
        XCTAssertEqual(restored.imageFile, page.imageFile)
        XCTAssertNotNil(reloaded.image(for: restored))
    }

    func testPagesComeBackNewestFirst() throws {
        let store = SketchbookStore(baseDirectory: directory)
        let old = Date(timeIntervalSince1970: 1_000_000)
        _ = store.add(image: Self.image(), lessonId: "older", pathId: "trees", completedAt: old)
        _ = store.add(image: Self.image(), lessonId: "newer", pathId: "trees", completedAt: old.addingTimeInterval(86_400))

        XCTAssertEqual(store.pages.map(\.lessonId), ["newer", "older"])
    }

    func testANoteIsStoredAndAnEmptyNoteIsNot() throws {
        let store = SketchbookStore(baseDirectory: directory)
        let page = try XCTUnwrap(store.add(image: Self.image(), lessonId: "l", pathId: "p"))

        store.update(note: "  Second try, steadier.  ", for: page.id)
        XCTAssertEqual(store.page(id: page.id)?.note, "Second try, steadier.")

        store.update(note: "   ", for: page.id)
        XCTAssertNil(store.page(id: page.id)?.note)

        XCTAssertEqual(SketchbookStore(baseDirectory: directory).page(id: page.id)?.note, nil)
    }

    func testDeletingAPageRemovesItsFile() throws {
        let store = SketchbookStore(baseDirectory: directory)
        let page = try XCTUnwrap(store.add(image: Self.image(), lessonId: "l", pathId: "p"))
        let file = directory.appendingPathComponent("Sketchbook").appendingPathComponent(page.imageFile)
        XCTAssertTrue(FileManager.default.fileExists(atPath: file.path))

        store.delete(page)

        XCTAssertTrue(store.isEmpty)
        XCTAssertFalse(FileManager.default.fileExists(atPath: file.path))
        XCTAssertTrue(SketchbookStore(baseDirectory: directory).isEmpty)
    }

    func testALargePhotoIsScaledDownBeforeItIsSaved() throws {
        let big = Self.image(size: CGSize(width: 4000, height: 3000))
        let data = try XCTUnwrap(SketchbookStore.jpegData(from: big))
        let saved = try XCTUnwrap(UIImage(data: data))
        XCTAssertLessThanOrEqual(max(saved.size.width, saved.size.height) * saved.scale,
                                 SketchbookStore.maximumPixelSize + 1)
    }

    /// Resetting progress must never touch the learner's own pages.
    func testResettingProgressLeavesTheSketchbookAlone() throws {
        let sketchbook = SketchbookStore(baseDirectory: directory)
        _ = sketchbook.add(image: Self.image(), lessonId: "l", pathId: "p")
        let progress = ProgressStore(baseDirectory: directory)
        progress.markCompleted("l", pathId: "p")

        progress.resetAll()

        XCTAssertEqual(SketchbookStore(baseDirectory: directory).count, 1)
    }

    // MARK: - Fixtures

    static func image(size: CGSize = CGSize(width: 40, height: 60)) -> UIImage {
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            UIColor.black.setStroke()
            context.cgContext.strokeEllipse(in: CGRect(origin: .zero, size: size).insetBy(dx: 4, dy: 4))
        }
    }
}
