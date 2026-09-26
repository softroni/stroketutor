import Foundation

/// Product analytics, behind one door. Screens call `track(_:)`; what happens next
/// is up to the `AnalyticsSink`: `PostHogSink` in the app (2026-09-26), sending
/// only the events named below, and `NoAnalyticsSink` in the tests and screenshot
/// launches. Superwall, which runs the paywall for learners 13 and over,
/// sends its own events to Superwall; a short allow-list of them is copied in here
/// too (`superwallTriggerFired`, `superwallPaywall`), so one funnel can hold both.
///
/// The learner's age group decides what a sink is allowed to do, and that decision
/// is made here, once, not in each sink:
///
/// - **child** (under 13, or never said): anonymous events only. The id is made
///   fresh every launch, one per learner, so a session's funnel can be read but a
///   child is never followed from one day to the next, nor mixed up with a
///   sibling; no person profile, no autocapture, no session replay.
/// - **teen** (13 to 17): events under the learner's own id, autocapture, but no
///   session replay.
/// - **adult**: everything a sink offers.
///
/// Whenever the id changes — another learner, or the same one moving in or out of
/// the child tier — the sink is told to `reset()` first, so it never links a
/// child's anonymous events to a person it can identify.
///
/// Nothing a learner typed — their name — is ever sent. The id is the profile's
/// random UUID, which names nothing.
@MainActor
final class Analytics {

    private let sink: AnalyticsSink
    /// The id each child-tier learner's events carry, made the first time they
    /// draw in this launch and forgotten when the app quits.
    private var sessionIds: [UUID: String] = [:]
    private var hasIdentified = false

    private(set) var policy = AnalyticsPolicy(tier: .child)
    private(set) var distinctId = UUID().uuidString
    private var ageGroup: AgeGroup?

    init(sink: AnalyticsSink) {
        self.sink = sink
    }

    /// Says who is drawing now. Called at launch, on every switch, and whenever the
    /// learner's age group changes.
    func identify(_ profile: Profile) {
        let newPolicy = AnalyticsPolicy(tier: profile.privacyTier)
        let newId = newPolicy.keepsPersonProfile ? profile.id.uuidString : sessionId(for: profile.id)
        if hasIdentified && newId != distinctId {
            sink.reset()
        }
        hasIdentified = true
        ageGroup = profile.ageGroup
        policy = newPolicy
        distinctId = newId
        sink.identify(distinctId: distinctId,
                      properties: [AnalyticsEvent.Key.ageGroup: ageGroupKey],
                      policy: policy)
    }

    func track(_ event: AnalyticsEvent) {
        var properties = event.properties
        properties[AnalyticsEvent.Key.ageGroup] = ageGroupKey
        sink.capture(AnalyticsEvent(name: event.name, properties: properties),
                     distinctId: distinctId,
                     policy: policy)
    }

    /// The app is going to the background: send what the sink is holding.
    func flush() {
        sink.flush()
    }

    private func sessionId(for profileId: UUID) -> String {
        if let existing = sessionIds[profileId] { return existing }
        let made = UUID().uuidString
        sessionIds[profileId] = made
        return made
    }

    /// The stored key, or `unanswered` for a learner never asked — distinct from
    /// one who chose "prefer not to say".
    private var ageGroupKey: String {
        ageGroup?.rawValue ?? "unanswered"
    }
}

/// What a sink may do for the learner who is drawing.
struct AnalyticsPolicy: Equatable {
    let tier: PrivacyTier

    /// Events carry the learner's own id and may build a person profile. Off for
    /// children, whose events carry an id that lasts one launch.
    var keepsPersonProfile: Bool { tier >= .teen }
    /// The sink may capture taps and screens on its own, beyond `track(_:)`.
    var allowsAutocapture: Bool { tier >= .teen }
    /// The sink may record the screen.
    var allowsSessionReplay: Bool { tier == .adult }
}

/// One thing that happened. Names and keys are snake_case and never change once
/// shipped, so a chart built on them keeps working.
struct AnalyticsEvent: Equatable {
    let name: String
    var properties: [String: String] = [:]

    enum Key {
        static let ageGroup = "age_group"
        static let beat = "beat"
        static let startedLesson = "started_lesson"
        static let lessonId = "lesson_id"
        static let entry = "entry"
        static let screen = "screen"
        static let outcome = "outcome"
        static let plan = "plan"
        static let subscribed = "subscribed"
        static let placement = "placement"
        static let paywallId = "paywall_id"
        static let experimentId = "experiment_id"
        static let variantId = "variant_id"
        static let productId = "product_id"
        static let triggerResult = "trigger_result"
        static let pathId = "path_id"
        static let resumed = "resumed"
        static let premiumLesson = "premium_lesson"
        static let step = "step"
        static let totalSteps = "total_steps"
        static let added = "added"
    }

    // MARK: Drawing

    /// What learners choose to draw, for every age tier: which lessons they open,
    /// finish, leave, keep in the sketchbook and wish for. Ids only, never a name
    /// or a photo.

    /// A path was chosen, from Home or All paths.
    static func pathOpened(pathId: String) -> AnalyticsEvent {
        AnalyticsEvent(name: "path_opened", properties: [Key.pathId: pathId])
    }

    /// The player opened on a lesson. `resumed` when it picks up at a saved step;
    /// `premium_lesson` when the lesson needs Premium (so the learner has it).
    static func lessonStarted(lessonId: String, pathId: String, resumed: Bool, premiumLesson: Bool) -> AnalyticsEvent {
        AnalyticsEvent(name: "lesson_started",
                       properties: [Key.lessonId: lessonId,
                                    Key.pathId: pathId,
                                    Key.resumed: resumed ? "true" : "false",
                                    Key.premiumLesson: premiumLesson ? "true" : "false"])
    }

    /// The last step was drawn.
    static func lessonCompleted(lessonId: String, pathId: String) -> AnalyticsEvent {
        AnalyticsEvent(name: "lesson_completed", properties: [Key.lessonId: lessonId, Key.pathId: pathId])
    }

    /// The learner left the player before the end. `step` is the one on screen,
    /// counted from 1, or `intro` when step one never began.
    static func lessonLeft(lessonId: String, pathId: String, step: Int?, totalSteps: Int) -> AnalyticsEvent {
        AnalyticsEvent(name: "lesson_left",
                       properties: [Key.lessonId: lessonId,
                                    Key.pathId: pathId,
                                    Key.step: step.map(String.init) ?? "intro",
                                    Key.totalSteps: String(totalSteps)])
    }

    /// A photo of the finished drawing went into the sketchbook. The photo stays on
    /// the device; only the lesson is named.
    static func drawingSaved(lessonId: String, pathId: String) -> AnalyticsEvent {
        AnalyticsEvent(name: "drawing_saved", properties: [Key.lessonId: lessonId, Key.pathId: pathId])
    }

    /// A Premium lesson went on or came off a child's wish list.
    static func wishListChanged(lessonId: String, added: Bool) -> AnalyticsEvent {
        AnalyticsEvent(name: "wish_list_changed",
                       properties: [Key.lessonId: lessonId, Key.added: added ? "true" : "false"])
    }

    /// An onboarding beat came on screen. `beat` is its id: `ob-age`, `ob-level`…
    static func onboardingBeatViewed(_ beat: String) -> AnalyticsEvent {
        AnalyticsEvent(name: "ob_beat_viewed", properties: [Key.beat: beat])
    }

    /// The learner answered `ob-age`. The answer rides along as `age_group`, the
    /// way it does on every event.
    static let onboardingAgeAnswered = AnalyticsEvent(name: "ob_age_answered")

    /// Onboarding ended, straight into the first lesson or onto Home.
    static func onboardingFinished(startedLesson: Bool) -> AnalyticsEvent {
        AnalyticsEvent(name: "ob_finished", properties: [Key.startedLesson: startedLesson ? "true" : "false"])
    }

    /// A crowned lesson was tapped without Premium.
    static func premiumLessonTapped(lessonId: String) -> AnalyticsEvent {
        AnalyticsEvent(name: "premium_lesson_tapped", properties: [Key.lessonId: lessonId])
    }

    /// A screen of the way to Premium came up: `sketchbook_tour`, `more_coming`,
    /// `paywall`, `trial_started`, `grown_up`, `parental_check`, `grown_up_paywall`,
    /// `pending`. `entry` is where the way was opened from.
    static func offerScreenViewed(_ screen: String, entry: String) -> AnalyticsEvent {
        AnalyticsEvent(name: "offer_screen_viewed", properties: [Key.screen: screen, Key.entry: entry])
    }

    /// What came of a tap on a buy button: `purchased`, `pending`, `cancelled`,
    /// `failed`.
    static func purchaseAttempted(plan: String, outcome: String) -> AnalyticsEvent {
        AnalyticsEvent(name: "purchase_attempted", properties: [Key.plan: plan, Key.outcome: outcome])
    }

    /// The way to Premium closed, with or without a subscription.
    static func offerFinished(entry: String, subscribed: Bool) -> AnalyticsEvent {
        AnalyticsEvent(name: "offer_finished",
                       properties: [Key.entry: entry, Key.subscribed: subscribed ? "true" : "false"])
    }

    // MARK: Superwall

    /// A placement was registered and Superwall decided what to do with it:
    /// `trigger_result` is `paywall`, `holdout`, `no_audience_match`,
    /// `placement_not_found` or `error`, and an experiment's id and variant ride
    /// along when there is one. Forwarded from Superwall's own events, for learners
    /// 13 and over only (`SuperwallPaywalls`).
    static func superwallTriggerFired(placement: String,
                                      result: String,
                                      experimentId: String?,
                                      variantId: String?) -> AnalyticsEvent {
        var properties = [Key.placement: placement, Key.triggerResult: result]
        properties[Key.experimentId] = experimentId
        properties[Key.variantId] = variantId
        return AnalyticsEvent(name: "superwall_trigger_fire", properties: properties)
    }

    /// Something that happened on a Superwall paywall, with the paywall, its
    /// experiment and variant, and the product when there is one. Never a price,
    /// never an error's text. For learners 13 and over only.
    static func superwallPaywall(_ kind: SuperwallPaywallEvent,
                                 context: SuperwallPaywallContext,
                                 productId: String? = nil) -> AnalyticsEvent {
        var properties: [String: String] = [:]
        properties[Key.placement] = context.placement
        properties[Key.paywallId] = context.paywallId
        properties[Key.experimentId] = context.experimentId
        properties[Key.variantId] = context.variantId
        properties[Key.productId] = productId
        return AnalyticsEvent(name: kind.rawValue, properties: properties)
    }
}

/// The Superwall events forwarded to `Analytics`: the allow-list. Everything else
/// the SDK reports stays with the SDK.
enum SuperwallPaywallEvent: String, CaseIterable {
    case paywallOpen = "superwall_paywall_open"
    case paywallClose = "superwall_paywall_close"
    case paywallDecline = "superwall_paywall_decline"
    case transactionStart = "superwall_transaction_start"
    case transactionComplete = "superwall_transaction_complete"
    case transactionFail = "superwall_transaction_fail"
    case transactionAbandon = "superwall_transaction_abandon"
    case transactionRestore = "superwall_transaction_restore"
    case freeTrialStart = "superwall_free_trial_start"
}

/// Which Superwall paywall an event came from, read off its `PaywallInfo`.
struct SuperwallPaywallContext: Equatable {
    var placement: String?
    var paywallId: String?
    var experimentId: String?
    var variantId: String?
}

/// Where events go. A sink must honour `policy` — it is the sink that knows how
/// to turn off its own session replay or person profiles.
@MainActor
protocol AnalyticsSink: AnyObject {
    func identify(distinctId: String, properties: [String: String], policy: AnalyticsPolicy)
    func capture(_ event: AnalyticsEvent, distinctId: String, policy: AnalyticsPolicy)
    /// Forget whoever was drawing: the next `identify` is someone new, never to be
    /// merged with them. PostHog's `reset()`.
    func reset()
    /// Send what is waiting now: the app is going to the background.
    func flush()
}

extension AnalyticsSink {
    func flush() {}
}

/// Sends nothing: the tests, screenshot launches, and any build without a sink.
final class NoAnalyticsSink: AnalyticsSink {
    func identify(distinctId: String, properties: [String: String], policy: AnalyticsPolicy) {}
    func capture(_ event: AnalyticsEvent, distinctId: String, policy: AnalyticsPolicy) {}
    func reset() {}
}
