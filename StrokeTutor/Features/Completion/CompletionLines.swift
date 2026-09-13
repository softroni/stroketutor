import Foundation

/// The eight things Lina says at the end of a lesson (`sk-complete`): four for the
/// ordinary end of a lesson, four for the end of a whole path. Which one is said is
/// decided by the lesson's place in its path, so a learner working through a path
/// does not read the same sentence every time. Nothing here grades the drawing.
///
/// This is a plain function rather than a computed property on the screen because
/// the same choice now picks two things that must not disagree: the sentence on
/// screen and the recording of that sentence in `Voice/app/`. The ids are the fixed
/// ones the Studio publishes under (`APP_LINE_IDS`): `lesson-1`…`lesson-4` and
/// `path-1`…`path-4`, in the order the lines are written below.
enum CompletionLines {

    /// One line and the recording that says it.
    struct Line: Equatable {
        /// The id in `Voice/app/`, e.g. `lesson-3`.
        let id: String
        let text: String
    }

    static let lesson = [
        "That is the whole shape, in your hand. The next one starts from here.",
        "The part you found hard is the part you can now do. That is how it goes.",
        "Look at it whole. The lines you hesitated over are the ones holding it up.",
        "Same marks, your own hand. That is all drawing ever is."
    ]

    static let pathDone = [
        "You know how these are put together now. Try one from life, wherever you find it.",
        "The method carries over. The next path will feel familiar from the first step.",
        "Every one of them finished. None of that was luck.",
        "You have the shape of the subject now. The rest is time with a pen."
    ]

    /// The line for a lesson finished at `position` in its path, counting from 1 as
    /// `PathModel.position(of:)` does. A lesson the catalog no longer places — it
    /// was reordered or removed under the learner — gets the first line rather than
    /// no line at all.
    static func line(isPathDone: Bool, position: Int?) -> Line {
        let texts = isPathDone ? pathDone : lesson
        let index = abs((position ?? 1) - 1) % texts.count
        return Line(id: "\(isPathDone ? "path" : "lesson")-\(index + 1)", text: texts[index])
    }
}
