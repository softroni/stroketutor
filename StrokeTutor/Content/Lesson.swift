import CoreGraphics
import Foundation

/// One lesson as the app uses it: the catalog entry joined to the drawing it plays.
/// Everything a screen shows about a lesson before it opens — the title, the time,
/// the number of steps, the objective, the reference credit — is read from here, so
/// `hp-home`, `hp-path` and `hp-preview` cannot disagree with each other.
struct Lesson: Identifiable, Hashable {
    let id: String
    let title: String
    let pathId: String
    let tutorial: PreparedTutorial
    /// One line: the single new idea this lesson teaches (`hp-preview`'s objective card).
    let objective: String
    /// Relative difficulty inside the path, 1 to 5, shown as dots. Nil when unstated.
    let complexity: Int?
    let reference: LessonReference?

    var stepCount: Int { tutorial.steps.count }

    /// The ink of the drawing, for a paper fitted to the lesson rather than to the
    /// square canvas.
    var drawingBounds: CGRect { tutorial.drawingBounds }

    /// How long the lesson takes, in minutes, rounded up: the animation is roughly a
    /// third of the work, and copying a step onto paper costs about eight seconds.
    /// Shown as "About 4 min"; never as a countdown, and never as a target.
    var estimatedMinutes: Int {
        let drawing = tutorial.steps.reduce(0.0) { total, step in
            total + step.strokes.reduce(0.0) { $0 + $1.duration }
        }
        let seconds = drawing * 3 + 8 * Double(stepCount)
        return max(1, Int(ceil(seconds / 60)))
    }

    /// "About 4 min".
    var estimatedTimeText: String {
        "About \(estimatedMinutes) min"
    }

    /// "7 steps" / "1 step".
    var stepCountText: String {
        stepCount == 1 ? "1 step" : "\(stepCount) steps"
    }

    /// The lesson's subject in running text: "Your palm tree is finished."
    var subject: String {
        title.lowercased()
    }

    static func == (lhs: Lesson, rhs: Lesson) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

/// A path with its lessons already loaded and ordered, which is what every screen
/// works with. Built by `AppModel` from `CatalogPath` plus the tutorials that
/// actually shipped: a lesson whose tutorial is missing simply is not here.
struct PathModel: Identifiable, Hashable {
    let id: String
    let title: String
    let description: String?
    let lessons: [Lesson]

    var lessonCount: Int { lessons.count }

    var isEmpty: Bool { lessons.isEmpty }

    func lesson(id: String) -> Lesson? {
        lessons.first { $0.id == id }
    }

    /// The lesson's one-based position, for "Lesson 3 of 10".
    func position(of lessonId: String) -> Int? {
        lessons.firstIndex { $0.id == lessonId }.map { $0 + 1 }
    }

    static func == (lhs: PathModel, rhs: PathModel) -> Bool {
        lhs.id == rhs.id && lhs.lessons.map(\.id) == rhs.lessons.map(\.id)
    }

    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
