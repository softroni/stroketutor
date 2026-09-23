import Foundation
import Observation
import OSLog

/// What the app remembers about one lesson. Nothing here can go down: there is no
/// score, no streak and no goal (`v3.html#hp-home`, "nothing that counts against
/// the learner").
struct LessonProgress: Codable, Identifiable, Hashable {
    let lessonId: String
    let pathId: String
    /// Set the first time the lesson is finished, and kept.
    var completedAt: Date?
    var timesCompleted: Int
    /// Where the learner left off, so the preview can offer "Continue from step 4".
    var lastStepIndex: Int?
    var lastOpenedAt: Date?

    var id: String { lessonId }
    var isCompleted: Bool { completedAt != nil }

    init(lessonId: String,
         pathId: String,
         completedAt: Date? = nil,
         timesCompleted: Int = 0,
         lastStepIndex: Int? = nil,
         lastOpenedAt: Date? = nil) {
        self.lessonId = lessonId
        self.pathId = pathId
        self.completedAt = completedAt
        self.timesCompleted = timesCompleted
        self.lastStepIndex = lastStepIndex
        self.lastOpenedAt = lastOpenedAt
    }
}

/// Lesson progress and the unlock rule, as a JSON array in Application Support.
///
/// A path unlocks in order: a lesson is available when every earlier lesson in its
/// path has been completed at least once (`v3.html#hp-path`, the locked sheet).
/// The lock recommends an order and does not enforce it: the sheet's "Try it anyway"
/// opens a locked lesson, and finishing it counts like any other.
/// "Reset progress" clears this store and nothing else — sketchbook pages are the
/// learner's own work and are never deleted by it (`st-settings`).
@Observable
@MainActor
final class ProgressStore {

    private(set) var records: [LessonProgress] = []

    /// How many finished lessons still count as a new learner's early ones. One
    /// number for the two places that ask: `hp-preview` shows "how a lesson works"
    /// while fewer than this are drawn, and leaving `sk-complete` after one of the
    /// first this-many lessons may land on `hp-paths`' one-time welcome
    /// (`AppModel.shouldShowPathsWelcome`).
    static let newLearnerLessonCount = 3

    private let fileURL: URL
    private static let log = Logger(subsystem: "com.softroni.papercoach", category: "progress")

    /// - Parameter baseDirectory: where `progress.json` lives. Defaults to
    ///   Application Support; a test passes a temporary directory.
    init(baseDirectory: URL? = nil) {
        let base = baseDirectory ?? AppStorageLocation.applicationSupport()
        fileURL = base.appendingPathComponent("progress.json")
        load()
    }

    // MARK: - Reading

    func progress(for lessonId: String) -> LessonProgress? {
        records.first { $0.lessonId == lessonId }
    }

    func isCompleted(_ lessonId: String) -> Bool {
        progress(for: lessonId)?.isCompleted ?? false
    }

    /// Every earlier lesson in the path has been completed. The first lesson of a
    /// path is always unlocked.
    func isUnlocked(_ lesson: Lesson, in path: PathModel) -> Bool {
        guard let index = path.lessons.firstIndex(where: { $0.id == lesson.id }) else { return false }
        return path.lessons.prefix(index).allSatisfy { isCompleted($0.id) }
    }

    /// The lesson Home offers: the first one not yet completed. Nil when the whole
    /// path is drawn.
    func nextLesson(in path: PathModel) -> Lesson? {
        path.lessons.first { !isCompleted($0.id) }
    }

    /// How many lessons of the path have been drawn, for "Trees · 2 of 8 drawn".
    func drawnCount(in path: PathModel) -> Int {
        path.lessons.filter { isCompleted($0.id) }.count
    }

    /// How many lessons have been drawn to the end, across every path. `hp-preview`
    /// shows "how a lesson works" only while this is small.
    var completedCount: Int {
        records.filter(\.isCompleted).count
    }

    /// The step to resume from, if the learner left a lesson part-way.
    func resumeStep(for lessonId: String) -> Int? {
        progress(for: lessonId)?.lastStepIndex
    }

    // MARK: - Writing

    /// Records that a lesson was opened, and where the learner is in it. Called on
    /// each step boundary and when the player is left.
    func markOpened(_ lessonId: String, pathId: String, step: Int? = nil) {
        update(lessonId, pathId: pathId) { record in
            record.lastOpenedAt = Date()
            if let step { record.lastStepIndex = step }
        }
    }

    /// Records a finished lesson: the date the first time, the count every time, and
    /// no resume point, because there is nothing left to resume.
    func markCompleted(_ lessonId: String, pathId: String, at date: Date = Date()) {
        update(lessonId, pathId: pathId) { record in
            if record.completedAt == nil { record.completedAt = date }
            record.timesCompleted += 1
            record.lastStepIndex = nil
            record.lastOpenedAt = date
        }
    }

    /// Forgets where the learner was, without forgetting that they finished it.
    func clearResume(_ lessonId: String) {
        guard let index = records.firstIndex(where: { $0.lessonId == lessonId }) else { return }
        records[index].lastStepIndex = nil
        save()
    }

    /// "Reset progress" in Settings. Sketchbook pages are untouched.
    func resetAll() {
        records = []
        save()
    }

    // MARK: - Persistence

    private func update(_ lessonId: String, pathId: String, _ change: (inout LessonProgress) -> Void) {
        if let index = records.firstIndex(where: { $0.lessonId == lessonId }) {
            change(&records[index])
        } else {
            var record = LessonProgress(lessonId: lessonId, pathId: pathId)
            change(&record)
            records.append(record)
        }
        save()
    }

    private func load() {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return }
        do {
            let data = try Data(contentsOf: fileURL)
            records = try JSONDecoder.storeDecoder.decode([LessonProgress].self, from: data)
        } catch {
            // A corrupt file must not stop the app from opening: start empty and
            // say so in the log. Losing progress is bad; a launch loop is worse.
            Self.log.error("progress.json could not be read: \(error.localizedDescription, privacy: .public)")
            records = []
        }
    }

    private func save() {
        do {
            let data = try JSONEncoder.storeEncoder.encode(records)
            try AppStorageLocation.writeAtomically(data, to: fileURL)
        } catch {
            Self.log.error("progress.json could not be written: \(error.localizedDescription, privacy: .public)")
        }
    }
}
