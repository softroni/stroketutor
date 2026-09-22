import Foundation
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
    /// The JPEG's file name inside `Application Support/Sketchbook/`.
    let imageFile: String
    /// The learner's own note, if they wrote one.
    var note: String?

    init(id: UUID = UUID(),
         lessonId: String,
         pathId: String,
         completedAt: Date = Date(),
         imageFile: String,
         note: String? = nil) {
        self.id = id
        self.lessonId = lessonId
        self.pathId = pathId
        self.completedAt = completedAt
        self.imageFile = imageFile
        self.note = note
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
    private nonisolated static let log = Logger(subsystem: "com.softroni.StrokeTutor", category: "sketchbook")

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

    // MARK: - Writing

    /// Saves a photograph as a new page. Returns nil only when the file could not be
    /// written, so the caller can tell the learner rather than pretend it worked.
    @discardableResult
    func add(image: UIImage,
             lessonId: String,
             pathId: String,
             completedAt: Date = Date()) -> SketchbookPage? {
        let id = UUID()
        guard Self.writePhoto(image, to: directory.appendingPathComponent(Self.fileName(for: id))) else {
            return nil
        }
        return insertPage(id: id, lessonId: lessonId, pathId: pathId, completedAt: completedAt)
    }

    /// The same, with the JPEG encoded and written off the main thread — the capture
    /// flow's Keep. The page lands in *this* store's folder however long it takes:
    /// if the kid is switched meanwhile, it is still their sketchbook it goes into,
    /// and `AppModel` keeps this store alive so the switch back sees it.
    func addPage(image: UIImage,
                 lessonId: String,
                 pathId: String,
                 completedAt: Date = Date()) async -> SketchbookPage? {
        let id = UUID()
        let url = directory.appendingPathComponent(Self.fileName(for: id))
        let written = await Task.detached(priority: .userInitiated) {
            Self.writePhoto(image, to: url)
        }.value
        guard written else { return nil }
        return insertPage(id: id, lessonId: lessonId, pathId: pathId, completedAt: completedAt)
    }

    private nonisolated static func fileName(for id: UUID) -> String {
        "\(id.uuidString).jpg"
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

    private func insertPage(id: UUID, lessonId: String, pathId: String, completedAt: Date) -> SketchbookPage {
        let page = SketchbookPage(id: id,
                                  lessonId: lessonId,
                                  pathId: pathId,
                                  completedAt: completedAt,
                                  imageFile: Self.fileName(for: id))
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

    /// Deletes a page and its photograph. Only ever called from the entry screen,
    /// behind a confirmation.
    func delete(_ page: SketchbookPage) {
        pages.removeAll { $0.id == page.id }
        try? FileManager.default.removeItem(at: directory.appendingPathComponent(page.imageFile))
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
