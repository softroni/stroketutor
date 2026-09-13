import SwiftUI

/// The one exit the completion and capture screens share. "Not now" on
/// `sk-complete`, "Not now" on the capture primer and "Done" on capture saved all
/// go to the same place in the mockup: `hp-path`, the path the lesson belongs to.
///
/// An addition rather than a change: `AppModel` is Phase 1's file, and nothing in it
/// is touched. It is written here because both screens in this group need it and
/// neither owns the other.
extension AppModel {
    /// Closes whatever cover is up and leaves the learner looking at their path.
    /// The Learn stack is taken back to its root first, so finishing a lesson can
    /// never pile a second path detail on top of the one already behind the player.
    func returnToPathDetail(for lesson: Lesson) {
        dismissCover()
        selectedTab = .learn
        popToRoot(.learn)
        push(.pathDetail(pathId: lesson.pathId))
    }
}
