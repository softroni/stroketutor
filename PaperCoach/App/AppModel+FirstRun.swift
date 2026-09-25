import Foundation

/// The guided first run: what follows onboarding for a new learner, in three stops
/// they can only leave forward (`FirstRunStage`).
///
/// 1. **The first lesson** — the one `ob-ready` started. The player has no close
///    button or ⋯ menu; completion has no "Next lesson"; the photo is optional, and
///    either way leads on.
/// 2. **The sketchbook tour** — the album of that lesson's path, so the learner
///    sees their page in its slot and the nine still to fill.
/// 3. **The offer** — "More coming", then the paywall (or, for a child, the way to
///    a grown-up), and "trial started" if a free week begins (`OfferFlow`). It ends
///    only there, on the subscription or "Continue with free lessons".
///
/// The stage is saved (`Settings.firstRunStage`), so closing the app mid-way comes
/// back to the same stop.
extension AppModel {

    /// The lesson the first run is built around, if it is still installed.
    var firstRunLesson: Lesson? {
        settings.firstRunLessonId.flatMap { lesson(id: $0) }
    }

    /// True while `lesson` is the first run's lesson and the run is still on it —
    /// through the player, completion and the photo of the page.
    func isGuidedFirstRun(_ lesson: Lesson) -> Bool {
        settings.firstRunStage == .lesson && settings.firstRunLessonId == lesson.id
    }

    /// `ob-ready`'s "Start drawing": the first run begins with this lesson. Only
    /// recorded here; the player opens once the onboarding cover has closed
    /// (`finishOnboarding(startingWith:)`), and is guided because of this record.
    func markFirstRunStarted(with lesson: Lesson) {
        settings.firstRunLessonId = lesson.id
        settings.firstRunStage = .lesson
    }

    /// From completion or the photo: the sketchbook tour.
    func showFirstRunSketchbook() {
        settings.firstRunStage = .sketchbook
        cover = .firstRunSketchbook
    }

    /// The tour's "Continue": the offer — or, for an Apple account that already
    /// has Premium (Family Sharing, a reinstall), the end of the first run.
    func startFirstRunOffer() {
        guard !premium.isPremium else {
            finishOffer(.onboarding, subscribed: true)
            return
        }
        settings.firstRunStage = .offer
        cover = .offer(.onboarding)
    }

    /// The first run is over, however it ended.
    func finishFirstRun() {
        settings.firstRunStage = nil
        settings.firstRunLessonId = nil
    }

    /// At launch: back to the stop the learner was at when the app closed. A
    /// lesson already finished goes on to the tour; a lesson no longer installed
    /// ends the run rather than trapping anyone.
    func resumeFirstRun() {
        guard let stage = settings.firstRunStage else { return }
        switch stage {
        case .lesson:
            guard let lesson = firstRunLesson else {
                finishFirstRun()
                return
            }
            if progress.isCompleted(lesson.id) {
                showFirstRunSketchbook()
            } else {
                presentPlayer(lesson, resumeFrom: progress.resumeStep(for: lesson.id))
            }
        case .sketchbook:
            cover = .firstRunSketchbook
        case .offer:
            startFirstRunOffer()
        }
    }
}
