import Foundation

/// When to ask the App Store for a rating (docs/next-builds.md item 4): after a
/// finished drawing, from a learner 13 or over who has finished at least three and
/// is past their first session, at most once per app version on the device. iOS
/// rations `requestReview` further and may show nothing at all, so this decides
/// when the app *asks*, never whether a prompt appeared.
///
/// - **Never the child tier** (under 13, "prefer not to say", or never asked): a
///   child is not asked for anything on the App Store's behalf, and the Apple
///   account under them is usually a grown-up's (README › Premium › *Children*).
/// - **Never in the guided first run**, a screenshot launch (`DebugScreenHarness`)
///   or the unit tests (`isAllowed(…)`).
/// - **A session** is a launch, or a return from the background: the moments
///   `app_opened` counts. The first is the one the learner was added in
///   (`AppModel.startNewSession()`).
/// - **Once per version, per device**: a rating belongs to the Apple account, not
///   to the learner, so a second learner is not asked again in the same version.
///
/// Plain values, so every rule is unit tested (`RatingPromptTests`).
/// `AppModel.claimRatingPrompt(after:)` fills it in, and `CompletionView` asks.
struct RatingPromptPolicy: Equatable {

    /// "From their third finished drawing on."
    static let minimumFinishedDrawings = 3

    /// False for a launch that must never ask (`isAllowed(…)`).
    var isAllowed: Bool
    var tier: PrivacyTier
    /// Every drawing the learner has finished, repeats included, the one just
    /// finished too (`ProgressStore.finishedDrawingCount`).
    var finishedDrawings: Int
    /// The learner was added in the session that is running now.
    var isFirstSession: Bool
    /// The guided first run is under way, at any of its stops (`Settings.firstRunStage`).
    var isInGuidedFirstRun: Bool
    /// This build's `CFBundleShortVersionString`.
    var appVersion: String
    /// The version the app last asked in on this device; nil if it never has.
    var lastRequestedVersion: String?

    var shouldRequest: Bool {
        isAllowed
            && tier >= .teen
            && !isInGuidedFirstRun
            && !isFirstSession
            && finishedDrawings >= Self.minimumFinishedDrawings
            && lastRequestedVersion != appVersion
    }

    /// Never in a screenshot launch (`-STScreen`), which must stay deterministic,
    /// nor inside the unit tests. The two flags are read in debug builds only
    /// (`AppModel.init`).
    static func isAllowed(screenshotLaunch: Bool, runningTests: Bool) -> Bool {
        !screenshotLaunch && !runningTests
    }
}
