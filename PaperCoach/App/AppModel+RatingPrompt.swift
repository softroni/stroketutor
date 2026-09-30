import Foundation

/// The App Store rating prompt (`RatingPromptPolicy`). `CompletionView` asks for
/// it a moment after a finished drawing lands; this decides, and records the ask.
extension AppModel {

    /// The version the app last asked for a rating in, on this device.
    static let ratingPromptVersionKey = "ratingPrompt.requestedVersion"

    /// The policy, filled in for the learner drawing now.
    var ratingPromptPolicy: RatingPromptPolicy {
        RatingPromptPolicy(isAllowed: asksForRatings,
                           tier: activeProfile.privacyTier,
                           finishedDrawings: progress.finishedDrawingCount,
                           isFirstSession: learnersNewThisSession.contains(activeProfile.id),
                           isInGuidedFirstRun: settings.firstRunStage != nil,
                           appVersion: appVersion,
                           lastRequestedVersion: settings.defaults.string(forKey: Self.ratingPromptVersionKey))
    }

    /// `lesson` was just finished and its completion screen has been up a moment:
    /// true when StoreKit should be asked for its rating prompt now. Never once
    /// that screen has been left, even while it is still sliding away. A yes is
    /// recorded before it is returned — the version, so this version never asks
    /// again on this device, and `rating_prompt_requested` — so the caller must ask.
    func claimRatingPrompt(after lesson: Lesson) -> Bool {
        guard cover == .completion(lessonId: lesson.id) else { return false }
        let policy = ratingPromptPolicy
        guard policy.shouldRequest else { return false }
        settings.defaults.set(policy.appVersion, forKey: Self.ratingPromptVersionKey)
        analytics.track(.ratingPromptRequested(lessonId: lesson.id,
                                               pathId: lesson.pathId,
                                               finishedDrawings: policy.finishedDrawings))
        return true
    }
}
