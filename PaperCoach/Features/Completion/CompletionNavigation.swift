import SwiftUI

/// The one exit the completion and capture screens share. "Not now" on
/// `sk-complete`, "Not now" on the capture primer and "Done" on capture saved all
/// go to the same place in the mockup: `hp-path`, the path the lesson belongs to,
/// which is the root of the Path tab.
///
/// The one exception is a new learner's first rest: the first time they leave
/// after one of their early lessons, they land on `hp-paths` instead, with its
/// one-time welcome, so they see how much more there is to draw before settling
/// into a single path. "Next lesson", "Choose another path" and the capture flow
/// opened from the sketchbook are not ways to rest, and never show it.
///
/// An addition rather than a change: `AppModel` is Phase 1's file, and nothing in it
/// is touched. It is written here because both screens in this group need it and
/// neither owns the other.
extension AppModel {
    /// Leaves `sk-complete`, or the capture flow that followed it, to rest. Shows
    /// All paths' welcome when `shouldShowPathsWelcome` says it is due, and
    /// otherwise returns to the lesson's path (`returnToPathDetail(for:)`).
    ///
    /// The welcome is remembered as seen the moment it is shown, not when the
    /// learner reads it: a learner who taps straight past it has still had it.
    func leaveCompletion(for lesson: Lesson) {
        guard shouldShowPathsWelcome else {
            returnToPathDetail(for: lesson)
            return
        }
        dismissCover()
        if let lessonPath = path(id: lesson.pathId) {
            select(lessonPath)
        }
        pathsWelcomePending = true
        preferences.hasSeenPathsWelcome = true
        showAllPaths()
    }

    /// The rule for the welcome, in one place: this learner has not had it, and
    /// they are still new — no more than `ProgressStore.newLearnerLessonCount`
    /// lessons drawn, counting the one just finished. A learner who chains their
    /// first lessons with "Next lesson" still gets it at their first rest; one who
    /// is past their early lessons by then never does.
    var shouldShowPathsWelcome: Bool {
        !preferences.hasSeenPathsWelcome
            && progress.completedCount <= ProgressStore.newLearnerLessonCount
    }

    /// Closes whatever cover is up and leaves the learner looking at their path.
    /// The lesson's path is made current so the Path tab's root shows it, and that
    /// tab's stack is emptied so the root is what is on screen — not the preview
    /// the lesson was started from. A lesson the catalog no longer names leaves the
    /// current path alone.
    func returnToPathDetail(for lesson: Lesson) {
        dismissCover()
        if let lessonPath = path(id: lesson.pathId) {
            select(lessonPath)
        }
        popToRoot(.path)
        selectedTab = .path
    }
}
