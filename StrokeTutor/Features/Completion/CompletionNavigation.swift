import SwiftUI

/// The one exit the completion and capture screens share. "Not now" on
/// `sk-complete`, "Not now" on the capture primer and "Done" on capture saved all
/// go to the same place in the mockup: `hp-path`, the path the lesson belongs to,
/// which is the root of the Path tab.
///
/// An addition rather than a change: `AppModel` is Phase 1's file, and nothing in it
/// is touched. It is written here because both screens in this group need it and
/// neither owns the other.
extension AppModel {
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
