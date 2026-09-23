import Foundation

/// Product analytics, behind one door. Screens call `track(_:)`; what happens next
/// is up to the `AnalyticsSink`, which today is `NoAnalyticsSink` — nothing leaves
/// the device. A PostHog (or Superwall) sink plugs in here later without any screen
/// changing.
///
/// The learner's age group decides what a sink is allowed to do, and that decision
/// is made here, once, not in each sink:
///
/// - **child** (under 13, or never said): anonymous events only. The id is made
///   fresh every launch, so a session's funnel can be read but a child is never
///   followed from one day to the next; no person profile, no autocapture, no
///   session replay.
/// - **teen** (13 to 17): events under the learner's own id, autocapture, but no
///   session replay.
/// - **adult**: everything a sink offers.
///
/// Nothing a learner typed — their name — is ever sent. The id is the profile's
/// random UUID, which names nothing.
@MainActor
final class Analytics {

    private let sink: AnalyticsSink
    /// Made once per launch: the id every child-tier event carries.
    private let sessionId: String

    private(set) var policy = AnalyticsPolicy(tier: .child)
    private(set) var distinctId: String
    private var ageGroup: AgeGroup?

    init(sink: AnalyticsSink) {
        self.sink = sink
        let sessionId = UUID().uuidString
        self.sessionId = sessionId
        distinctId = sessionId
    }

    /// Says who is drawing now. Called at launch, on every switch, and whenever the
    /// learner's age group changes.
    func identify(_ profile: Profile) {
        ageGroup = profile.ageGroup
        policy = AnalyticsPolicy(tier: profile.privacyTier)
        distinctId = policy.keepsPersonProfile ? profile.id.uuidString : sessionId
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
}

/// Where events go. A sink must honour `policy` — it is the sink that knows how
/// to turn off its own session replay or person profiles.
@MainActor
protocol AnalyticsSink: AnyObject {
    func identify(distinctId: String, properties: [String: String], policy: AnalyticsPolicy)
    func capture(_ event: AnalyticsEvent, distinctId: String, policy: AnalyticsPolicy)
}

/// Sends nothing. The app's sink until an analytics service is chosen.
final class NoAnalyticsSink: AnalyticsSink {
    func identify(distinctId: String, properties: [String: String], policy: AnalyticsPolicy) {}
    func capture(_ event: AnalyticsEvent, distinctId: String, policy: AnalyticsPolicy) {}
}
