import UIKit
import XCTest
@testable import PaperCoach

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

    /// The album grids draw scaled-down copies: no longer than asked on the long
    /// side, still upright and portrait, and nil once the photo is gone.
    func testAThumbnailIsSmallAndUpright() throws {
        let store = SketchbookStore(baseDirectory: directory)
        let page = try XCTUnwrap(store.add(image: Self.image(size: CGSize(width: 900, height: 1200)),
                                           lessonId: "l", pathId: "p"))

        let thumbnail = try XCTUnwrap(store.thumbnail(for: page, maxPixelSize: 300))
        let pixels = CGSize(width: thumbnail.size.width * thumbnail.scale,
                            height: thumbnail.size.height * thumbnail.scale)
        XCTAssertEqual(max(pixels.width, pixels.height), 300, accuracy: 1)
        XCTAssertLessThan(pixels.width, pixels.height, "A portrait page stays portrait.")

        // A camera photo is stored sideways and tagged to draw upright; so is its thumbnail.
        let camera = DebugScreenHarness.sensorOriented(Self.image(size: CGSize(width: 900, height: 1200)))
        let shot = try XCTUnwrap(store.add(image: camera, lessonId: "l", pathId: "p"))
        let upright = try XCTUnwrap(store.thumbnail(for: shot, maxPixelSize: 300))
        XCTAssertLessThan(upright.size.width, upright.size.height)

        let missing = SketchbookPage(lessonId: "l", pathId: "p", imageFile: "gone.jpg")
        XCTAssertNil(store.thumbnail(for: missing))
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

    // MARK: - Editing

    /// A sketchbook written before pages could be edited still reads: each page is
    /// its own photo as taken, in no look.
    func testPagesKeptBeforeEditingStillRead() throws {
        let folder = directory.appendingPathComponent("Sketchbook", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let id = UUID()
        let json = """
        [{"id":"\(id.uuidString)","lessonId":"palm-tree-4","pathId":"trees",\
        "completedAt":"2026-09-20T10:00:00Z","imageFile":"\(id.uuidString).jpg","note":"Windy"}]
        """
        try Data(json.utf8).write(to: folder.appendingPathComponent("pages.json"))

        let page = try XCTUnwrap(SketchbookStore(baseDirectory: directory).page(id: id))
        XCTAssertEqual(page.note, "Windy")
        XCTAssertNil(page.originalFile)
        XCTAssertNil(page.corners)
        XCTAssertEqual(page.look, .original)
    }

    /// A page straightened or in a look keeps the photo as taken beside it, and
    /// how it was made from it.
    func testAPageKeepsItsOriginalCornersAndLook() async throws {
        let store = SketchbookStore(baseDirectory: directory)
        let corners = PageCorners.inset(by: 0.1)
        let added = await store.addPage(image: Self.image(), original: Self.image(size: CGSize(width: 60, height: 80)),
                                        corners: corners, look: .bright, lessonId: "l", pathId: "p")
        let page = try XCTUnwrap(added)

        let restored = try XCTUnwrap(SketchbookStore(baseDirectory: directory).page(id: page.id))
        XCTAssertEqual(restored.corners, corners)
        XCTAssertEqual(restored.look, .bright)
        let originalFile = try XCTUnwrap(restored.originalFile)
        XCTAssertTrue(FileManager.default.fileExists(atPath: file(originalFile).path))
        XCTAssertEqual(store.original(for: restored)?.size, CGSize(width: 60, height: 80))
    }

    /// Kept as taken, the page is its own original: no second copy.
    func testAPageKeptAsTakenStoresNoSecondCopy() async throws {
        let store = SketchbookStore(baseDirectory: directory)
        let added = await store.addPage(image: Self.image(), original: Self.image(), lessonId: "l", pathId: "p")
        let page = try XCTUnwrap(added)
        XCTAssertNil(page.originalFile)
        XCTAssertNotNil(store.original(for: page))
    }

    /// Editing gives the page a new picture under a new name and removes the old
    /// one. A page with no original first keeps its old picture as the original,
    /// byte for byte, and later edits start from that, not from each other.
    func testEditingReplacesThePictureAndKeepsTheOriginal() async throws {
        let store = SketchbookStore(baseDirectory: directory)
        let page = try XCTUnwrap(store.add(image: Self.image(), lessonId: "l", pathId: "p"))
        let before = try Data(contentsOf: file(page.imageFile))

        let corners = PageCorners.inset(by: 0.05)
        let edited = await store.edit(pageId: page.id, image: Self.image(size: CGSize(width: 30, height: 40)),
                                      corners: corners, look: .scan)
        XCTAssertTrue(edited)

        let first = try XCTUnwrap(store.page(id: page.id))
        XCTAssertNotEqual(first.imageFile, page.imageFile)
        XCTAssertFalse(FileManager.default.fileExists(atPath: file(page.imageFile).path), "The old picture is gone.")
        XCTAssertEqual(store.image(for: first)?.size, CGSize(width: 30, height: 40))
        let originalFile = try XCTUnwrap(first.originalFile)
        XCTAssertEqual(try Data(contentsOf: file(originalFile)), before)
        XCTAssertEqual(first.corners, corners)
        XCTAssertEqual(first.look, .scan)

        let again = await store.edit(pageId: page.id, image: Self.image(), corners: nil, look: .bright)
        XCTAssertTrue(again)
        let second = try XCTUnwrap(SketchbookStore(baseDirectory: directory).page(id: page.id))
        XCTAssertEqual(second.originalFile, originalFile)
        XCTAssertEqual(try Data(contentsOf: file(originalFile)), before, "The original is never rewritten.")
        XCTAssertNil(second.corners)
        XCTAssertEqual(second.look, .bright)
        XCTAssertFalse(FileManager.default.fileExists(atPath: file(first.imageFile).path))
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: folder.path).count, 3,
                       "The index, the picture and the original: nothing left behind.")
    }

    func testEditingAPageThatIsGoneChangesNothing() async {
        let store = SketchbookStore(baseDirectory: directory)
        let edited = await store.edit(pageId: UUID(), image: Self.image(), corners: nil, look: .scan)
        XCTAssertFalse(edited)
        XCTAssertTrue(store.isEmpty)
    }

    func testDeletingAnEditedPageRemovesItsOriginalToo() async throws {
        let store = SketchbookStore(baseDirectory: directory)
        let page = try XCTUnwrap(store.add(image: Self.image(), lessonId: "l", pathId: "p"))
        _ = await store.edit(pageId: page.id, image: Self.image(), corners: nil, look: .bright)
        let edited = try XCTUnwrap(store.page(id: page.id))

        store.delete(page)
        XCTAssertTrue(store.isEmpty)
        for name in [edited.imageFile, edited.originalFile].compactMap({ $0 }) {
            XCTAssertFalse(FileManager.default.fileExists(atPath: file(name).path), name)
        }
    }

    private var folder: URL { directory.appendingPathComponent("Sketchbook", isDirectory: true) }

    private func file(_ name: String) -> URL { folder.appendingPathComponent(name) }

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
