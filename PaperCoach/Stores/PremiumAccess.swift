import Foundation

/// Which lessons are free and which need Premium, as plain rules with no store
/// behind them, so the screens and the tests read the same answer.
///
/// Every path is open to everyone, and the first `freeLessonsPerPath` lessons of
/// each are free. From the next one on, a lesson is Premium: it wears a crown on
/// its tile and node, and tapping it opens the Premium drawer instead of the lesson.
/// A subscriber sees no crowns at all.
///
/// The crown says nothing about order. A lesson can be Premium and still locked
/// behind the one before it; the lock keeps teaching the order, the crown says
/// what it costs.
enum PremiumAccess {

    /// Lessons 1 to 3 of every path.
    static let freeLessonsPerPath = 3

    /// True when the lesson sits past the free lessons of its path. A lesson the
    /// path does not list is never Premium.
    static func isPremiumLesson(_ lesson: Lesson, in path: PathModel) -> Bool {
        guard let position = path.position(of: lesson.id) else { return false }
        return position > freeLessonsPerPath
    }

    /// A free lesson to offer beside a Premium "next lesson", so a learner who is
    /// not subscribing still has something to draw. A path not yet started comes
    /// first (its first lesson), then the next free lesson of any other path, in
    /// catalog order. Nil when every free lesson outside `pathId` is drawn.
    @MainActor
    static func freeLessonSuggestion(excludingPath pathId: String,
                                     paths: [PathModel],
                                     progress: ProgressStore) -> Lesson? {
        let others = paths.filter { $0.id != pathId && !$0.isEmpty }
        if let untouched = others.first(where: { progress.drawnCount(in: $0) == 0 }),
           let first = untouched.lessons.first {
            return first
        }
        for path in others {
            if let next = progress.nextLesson(in: path), !isPremiumLesson(next, in: path) {
                return next
            }
        }
        return nil
    }

    /// The free lesson a child's Premium drawer offers instead of `lesson`. A crown
    /// can be tapped long before its path's free lessons are drawn, so the path the
    /// child is on comes first: its next lesson, while that is still free. Past
    /// them, `freeLessonSuggestion(excludingPath:paths:progress:)`.
    @MainActor
    static func freeLessonInstead(of lesson: Lesson,
                                  paths: [PathModel],
                                  progress: ProgressStore) -> Lesson? {
        if let path = paths.first(where: { $0.id == lesson.pathId }),
           let next = progress.nextLesson(in: path),
           !isPremiumLesson(next, in: path) {
            return next
        }
        return freeLessonSuggestion(excludingPath: lesson.pathId, paths: paths, progress: progress)
    }
}
