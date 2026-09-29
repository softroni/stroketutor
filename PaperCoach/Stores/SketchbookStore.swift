import Foundation
import ImageIO
import Observation
import OSLog
import UIKit

/// One finished page: the photograph the learner took of their own drawing.
struct SketchbookPage: Codable, Identifiable, Hashable {
    let id: UUID
    let lessonId: String
    let pathId: String
    /// When the lesson was finished, which is the date shown on the page.
    let completedAt: Date
    /// The JPEG the sketchbook shows, inside `Application Support/Sketchbook/`: the
    /// page straightened and in its look. Renamed whenever the page is edited, so
    /// nothing cached under the old name is ever shown for the new picture.
    var imageFile: String
    /// The photo as taken, before straightening or any look, so the page can be
    /// edited again. Nil when `imageFile` is itself the photo as taken: a page kept
    /// without corners or a look, or kept before pages could be edited.
    var originalFile: String?
    /// Where the paper's corners are in the original, when the page was
    /// straightened from them.
    var corners: PageCorners?
    /// The light the page is shown in.
    var look: PageLook
    /// The learner's own note, if they wrote one.
    var note: String?

    init(id: UUID = UUID(),
         lessonId: String,
         pathId: String,
         completedAt: Date = Date(),
         imageFile: String,
         originalFile: String? = nil,
         corners: PageCorners? = nil,
         look: PageLook = .original,
         note: String? = nil) {
        self.id = id
        self.lessonId = lessonId
        self.pathId = pathId
        self.completedAt = completedAt
        self.imageFile = imageFile
        self.originalFile = originalFile
        self.corners = corners
        self.look = look
        self.note = note
    }

    private enum CodingKeys: String, CodingKey {
        case id, lessonId, pathId, completedAt, imageFile, originalFile, corners, look, note
    }

    /// Pages kept before they could be edited have no original, corners or look.
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        lessonId = try container.decode(String.self, forKey: .lessonId)
        pathId = try container.decode(String.self, forKey: .pathId)
        completedAt = try container.decode(Date.self, forKey: .completedAt)
        imageFile = try container.decode(String.self, forKey: .imageFile)
        originalFile = try container.decodeIfPresent(String.self, forKey: .originalFile)
        corners = try container.decodeIfPresent(PageCorners.self, forKey: .corners)
        look = try container.decodeIfPresent(PageLook.self, forKey: .look) ?? .original
        note = try container.decodeIfPresent(String.self, forKey: .note)
    }
}

/// The sketchbook (`sk-book`, `sk-entry`): a JSON index plus one JPEG per page in
/// `Application Support/Sketchbook/`.
///
/// Private by default. The pages stay on the device, are included in device backups,
/// and reach Photos only when the learner turns "Also save to Photos" on — which is
/// the caller's job, with the add-only usage string. Resetting progress never
/// deletes a page: the drawings are the learner's, not the app's.
@Observable
@MainActor
final class SketchbookStore {

    /// Newest first, which is the order `sk-book` shows.
    private(set) var pages: [SketchbookPage] = []

    /// JPEG quality and the longest side a saved photo is scaled to. Big enough to
    /// look like a photograph of a page, small enough that a full sketchbook is not
    /// a backup problem.
    nonisolated static let jpegQuality: CGFloat = 0.85
    nonisolated static let maximumPixelSize: CGFloat = 2048

    private let directory: URL
    private let indexURL: URL
    /// Small decoded copies for the grids, so an album of twenty pages does not
    /// hold twenty full-size photographs in memory. File names are unique per page,
    /// so an entry can never go stale.
    @ObservationIgnored private let thumbnails = NSCache<NSString, UIImage>()
    private nonisolated static let log = Logger(subsystem: "com.softroni.papercoach", category: "sketchbook")

    /// - Parameter baseDirectory: the folder that contains `Sketchbook/`. Defaults to
    ///   Application Support; a test passes a temporary directory.
    init(baseDirectory: URL? = nil) {
        let base = baseDirectory ?? AppStorageLocation.applicationSupport()
        directory = base.appendingPathComponent("Sketchbook", isDirectory: true)
        indexURL = directory.appendingPathComponent("pages.json")
        load()
    }

    // MARK: - Reading

    var isEmpty: Bool { pages.isEmpty }
    var count: Int { pages.count }

    func page(id: UUID) -> SketchbookPage? {
        pages.first { $0.id == id }
    }

    func pages(forLesson lessonId: String) -> [SketchbookPage] {
        pages.filter { $0.lessonId == lessonId }
    }

    /// The photograph itself. Nil when the file has gone missing, which the entry
    /// screen shows as a placeholder rather than an error.
    func image(for page: SketchbookPage) -> UIImage? {
        UIImage(contentsOfFile: directory.appendingPathComponent(page.imageFile).path)
    }

    /// The photo as taken, which editing starts from: the original when the page
    /// keeps one, otherwise the page itself.
    func original(for page: SketchbookPage) -> UIImage? {
        UIImage(contentsOfFile: directory.appendingPathComponent(page.originalFile ?? page.imageFile).path)
    }

    /// The photograph scaled down so its longest side is at most `maxPixelSize`
    /// pixels, decoded once and cached — what the sketchbook's grids draw. Nil when
    /// the file has gone missing, as with `image(for:)`.
    func thumbnail(for page: SketchbookPage, maxPixelSize: Int = 600) -> UIImage? {
        let key = "\(page.imageFile)@\(maxPixelSize)" as NSString
        if let cached = thumbnails.object(forKey: key) { return cached }
        let url = directory.appendingPathComponent(page.imageFile)
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixelSize
        ]
        guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
            return nil
        }
        let image = UIImage(cgImage: cgImage)
        thumbnails.setObject(image, forKey: key)
        return image
    }

    // MARK: - Writing

    /// Saves a photograph as a new page. Returns nil only when the file could not be
    /// written, so the caller can tell the learner rather than pretend it worked.
    /// `original`, `corners` and `look` are what `image` was made from, as in
    /// `addPage`.
    @discardableResult
    func add(image: UIImage,
             original: UIImage? = nil,
             corners: PageCorners? = nil,
             look: PageLook = .original,
             lessonId: String,
             pathId: String,
             completedAt: Date = Date()) -> SketchbookPage? {
        let id = UUID()
        let files = Self.files(for: id, keepsOriginal: Self.keepsOriginal(corners: corners, look: look))
        let written = Self.writePage(image, original: original, files: files, in: directory)
        guard written.page else { return nil }
        return insertPage(Self.page(id: id, lessonId: lessonId, pathId: pathId, completedAt: completedAt,
                                    imageFile: files.image, originalFile: written.originalFile,
                                    corners: corners, look: look))
    }

    /// The same, with the JPEGs encoded and written off the main thread — the
    /// capture flow's Keep. The page lands in *this* store's folder however long it
    /// takes: if the learner is switched meanwhile, it is still their sketchbook it
    /// goes into, and `AppModel` keeps this store alive so the switch back sees it.
    ///
    /// `image` is the page as shown; `original` the photo as taken, and `corners`
    /// and `look` how the page was made from it, so it can be edited later. The
    /// original is only kept when it differs from the page. A page whose original
    /// could not be written is still kept: editing it later starts from the page.
    func addPage(image: UIImage,
                 original: UIImage? = nil,
                 corners: PageCorners? = nil,
                 look: PageLook = .original,
                 lessonId: String,
                 pathId: String,
                 completedAt: Date = Date()) async -> SketchbookPage? {
        let id = UUID()
        let files = Self.files(for: id, keepsOriginal: Self.keepsOriginal(corners: corners, look: look))
        let directory = directory
        let written = await Task.detached(priority: .userInitiated) {
            Self.writePage(image, original: original, files: files, in: directory)
        }.value
        guard written.page else { return nil }
        return insertPage(Self.page(id: id, lessonId: lessonId, pathId: pathId, completedAt: completedAt,
                                    imageFile: files.image, originalFile: written.originalFile,
                                    corners: corners, look: look))
    }

    /// Gives a page a new picture: `image`, made from the page's original with
    /// `corners` and `look`. Written off the main thread under a new name, and the
    /// old picture removed once the new one is safe. A page with no original of its
    /// own first keeps its old picture as the original, byte for byte, so the photo
    /// as taken is never lost. False when nothing could be written, and the page is
    /// then as it was.
    func edit(pageId: UUID, image: UIImage, corners: PageCorners?, look: PageLook) async -> Bool {
        guard let page = page(id: pageId) else { return false }
        let directory = directory
        let imageFile = "\(page.id.uuidString)-\(UUID().uuidString.prefix(8)).jpg"
        let originalFile = page.originalFile ?? "\(page.id.uuidString)-original.jpg"
        let copiesOriginal = page.originalFile == nil
        let shownFile = page.imageFile
        let written = await Task.detached(priority: .userInitiated) { () -> Bool in
            let fileManager = FileManager.default
            let originalURL = directory.appendingPathComponent(originalFile)
            if copiesOriginal {
                try? fileManager.removeItem(at: originalURL)
                do {
                    try fileManager.copyItem(at: directory.appendingPathComponent(shownFile), to: originalURL)
                } catch {
                    Self.log.error("A sketchbook original could not be kept: \(error.localizedDescription, privacy: .public)")
                    return false
                }
            }
            guard Self.writePhoto(image, to: directory.appendingPathComponent(imageFile)) else {
                if copiesOriginal { try? fileManager.removeItem(at: originalURL) }
                return false
            }
            return true
        }.value
        guard written else { return false }

        // Deleted while the files were being written: take them away again.
        guard let index = pages.firstIndex(where: { $0.id == pageId }) else {
            try? FileManager.default.removeItem(at: directory.appendingPathComponent(imageFile))
            if copiesOriginal {
                try? FileManager.default.removeItem(at: directory.appendingPathComponent(originalFile))
            }
            return false
        }
        let oldImageFile = pages[index].imageFile
        pages[index].imageFile = imageFile
        pages[index].originalFile = originalFile
        pages[index].corners = corners
        pages[index].look = look
        sortAndSave()
        try? FileManager.default.removeItem(at: directory.appendingPathComponent(oldImageFile))
        return true
    }

    /// A new page's record. Without its original the page is its own photo as
    /// taken, so it keeps no corners or look: editing it starts from the page, and
    /// must not straighten it or change its light a second time.
    private static func page(id: UUID, lessonId: String, pathId: String, completedAt: Date,
                             imageFile: String, originalFile: String?,
                             corners: PageCorners?, look: PageLook) -> SketchbookPage {
        SketchbookPage(id: id, lessonId: lessonId, pathId: pathId, completedAt: completedAt,
                       imageFile: imageFile, originalFile: originalFile,
                       corners: originalFile == nil ? nil : corners,
                       look: originalFile == nil ? .original : look)
    }

    /// The files one page is written to.
    private struct PageFiles: Sendable {
        let image: String
        /// Nil when the page needs no original of its own.
        let original: String?
    }

    private nonisolated static func files(for id: UUID, keepsOriginal: Bool) -> PageFiles {
        PageFiles(image: "\(id.uuidString).jpg",
                  original: keepsOriginal ? "\(id.uuidString)-original.jpg" : nil)
    }

    /// A page straightened or in a look is no longer the photo as taken, so it
    /// keeps that photo beside it; otherwise the page is its own original.
    private nonisolated static func keepsOriginal(corners: PageCorners?, look: PageLook) -> Bool {
        corners != nil || look != .original
    }

    /// Writes the page, then its original when there is one to keep: whether the
    /// page was written, and the original's file name if it was too.
    private nonisolated static func writePage(_ image: UIImage, original: UIImage?, files: PageFiles,
                                              in directory: URL) -> (page: Bool, originalFile: String?) {
        guard writePhoto(image, to: directory.appendingPathComponent(files.image)) else { return (false, nil) }
        guard let original, let originalFile = files.original,
              writePhoto(original, to: directory.appendingPathComponent(originalFile)) else { return (true, nil) }
        return (true, originalFile)
    }

    private nonisolated static func writePhoto(_ image: UIImage, to url: URL) -> Bool {
        guard let data = jpegData(from: image) else {
            log.error("A sketchbook photo could not be encoded as JPEG.")
            return false
        }
        do {
            try AppStorageLocation.writeAtomically(data, to: url)
            return true
        } catch {
            log.error("A sketchbook photo could not be saved: \(error.localizedDescription, privacy: .public)")
            return false
        }
    }

    private func insertPage(_ page: SketchbookPage) -> SketchbookPage {
        pages.insert(page, at: 0)
        sortAndSave()
        return page
    }

    /// Writes the learner's note. An empty note is stored as no note.
    func update(note: String?, for pageId: UUID) {
        guard let index = pages.firstIndex(where: { $0.id == pageId }) else { return }
        let trimmed = note?.trimmingCharacters(in: .whitespacesAndNewlines)
        pages[index].note = (trimmed?.isEmpty ?? true) ? nil : trimmed
        sortAndSave()
    }

    /// Deletes a page, its photograph and the original it was made from. Only ever
    /// called from the entry screen, behind a confirmation.
    func delete(_ page: SketchbookPage) {
        let current = self.page(id: page.id) ?? page
        pages.removeAll { $0.id == page.id }
        for file in [current.imageFile, current.originalFile].compactMap({ $0 }) {
            try? FileManager.default.removeItem(at: directory.appendingPathComponent(file))
        }
        sortAndSave()
    }

    // MARK: - Images

    /// A JPEG at quality 0.85, scaled so the longest side is at most 2048 px.
    nonisolated static func jpegData(from image: UIImage) -> Data? {
        scaled(image).jpegData(compressionQuality: jpegQuality)
    }

    private nonisolated static func scaled(_ image: UIImage) -> UIImage {
        let longest = max(image.size.width, image.size.height) * image.scale
        guard longest > maximumPixelSize, longest > 0 else { return image }
        let factor = maximumPixelSize / longest
        let size = CGSize(width: (image.size.width * image.scale * factor).rounded(),
                          height: (image.size.height * image.scale * factor).rounded())
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
    }

    // MARK: - Persistence

    private func sortAndSave() {
        pages.sort { $0.completedAt > $1.completedAt }
        save()
    }

    private func load() {
        guard FileManager.default.fileExists(atPath: indexURL.path) else { return }
        do {
            let data = try Data(contentsOf: indexURL)
            pages = try JSONDecoder.storeDecoder.decode([SketchbookPage].self, from: data)
                .sorted { $0.completedAt > $1.completedAt }
        } catch {
            Self.log.error("The sketchbook index could not be read: \(error.localizedDescription, privacy: .public)")
            pages = []
        }
    }

    private func save() {
        do {
            let data = try JSONEncoder.storeEncoder.encode(pages)
            try AppStorageLocation.writeAtomically(data, to: indexURL)
        } catch {
            Self.log.error("The sketchbook index could not be written: \(error.localizedDescription, privacy: .public)")
        }
    }
}
