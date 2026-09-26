import Foundation

/// Paywalls that come from Superwall, so their design can be A/B tested without an
/// app update, behind one small door that knows nothing of the SDK. `AppModel` tells
/// it who is drawing; `OfferFlow` asks it for a paywall and is told what came of it.
/// `SuperwallPaywalls` is the one type that talks to SuperwallKit.
///
/// The native paywall (`PaywallView`) is never taken away: it is what a learner sees
/// whenever Superwall cannot answer, and it is the control of every experiment (a
/// holdout is shown the native paywall, not nothing).
///
/// **Children never touch Superwall.** A child (`PrivacyTier.child`: under 13,
/// "prefer not to say", or never asked) is never shown a Superwall paywall, and a
/// launch with only children on it never starts the SDK at all (`SuperwallGate`).
@MainActor
protocol RemotePaywalls: AnyObject {
    /// Launch is over and the learner who is drawing is known — unless "Who's
    /// drawing?" is about to ask, in which case the answer comes through
    /// `learnerDidChange(tier:)`. Called once, by `AppRoot`.
    func launch(tier: PrivacyTier, waitingForPicker: Bool)

    /// Another learner is drawing, or the same one's age group changed. Also called
    /// when "Who's drawing?" is answered with the learner already active.
    func learnerDidChange(tier: PrivacyTier)

    /// Whether a paywall may be asked of Superwall right now: it is running, it has
    /// finished starting, and the learner is 13 or over.
    var canPresent: Bool { get }

    /// Asks Superwall for the paywall of `placement`, and says what came of it,
    /// once, on the main actor. `.unavailable` means "show the native paywall".
    func present(_ placement: PaywallPlacement, completion: @escaping (RemotePaywallResult) -> Void)
}

/// The door when Superwall is not allowed in this launch: the screenshot harness,
/// `-STNativePaywall`, and the unit tests (`SuperwallGate.isAllowed`). It never
/// starts the SDK, and every paywall is the native one.
@MainActor
final class NativePaywallsOnly: RemotePaywalls {
    func launch(tier: PrivacyTier, waitingForPicker: Bool) {}
    func learnerDidChange(tier: PrivacyTier) {}
    var canPresent: Bool { false }
    func present(_ placement: PaywallPlacement, completion: @escaping (RemotePaywallResult) -> Void) {
        completion(.unavailable)
    }
}

// MARK: - Placements

/// The three moments a Superwall paywall may be asked for, all for learners 13 and
/// over, all on the way to Premium (`OfferFlow`). The names are what the dashboard's
/// campaigns route; like analytics names, they never change once shipped.
enum PaywallPlacement: Equatable {
    /// "More coming"'s Continue at the end of the guided first run.
    case onboardingOffer
    /// "See Premium" in a Premium lesson's drawer.
    case premiumLesson(lessonId: String)
    /// Settings › Premium.
    case settingsPremium

    init(entry: OfferEntry) {
        switch entry {
        case .onboarding: self = .onboardingOffer
        case let .premiumLesson(lessonId): self = .premiumLesson(lessonId: lessonId)
        case .settings: self = .settingsPremium
        }
    }

    var name: String {
        switch self {
        case .onboardingOffer: return "onboarding_offer"
        case .premiumLesson: return "premium_lesson"
        case .settingsPremium: return "settings_premium"
        }
    }

    /// What the campaign's audience rules can read. The lesson's id names a
    /// drawing, never the learner.
    var params: [String: String] {
        switch self {
        case let .premiumLesson(lessonId): return ["lesson_id": lessonId]
        case .onboardingOffer, .settingsPremium: return [:]
        }
    }
}

// MARK: - What came of a Superwall paywall

/// How a Superwall paywall closed, as the SDK reports it (`PaywallResult` and
/// `PaywallInfo.closeReason`), in words that need no SDK.
enum RemotePaywallClose: Equatable {
    case purchased
    case restored
    /// Closed without buying or restoring.
    case declined
    /// Closed because its page could not load: nothing was shown to decline.
    case failedToLoad
}

/// What a request for a Superwall paywall came to, for `OfferFlow`
/// (`OfferRoute.next(afterRemotePaywall:isPremium:)`).
enum RemotePaywallResult: Equatable {
    /// It closed after a purchase went through.
    case purchased
    /// It closed after a restore found Premium.
    case restored
    /// An Ask to Buy request is waiting for a family organizer. The SDK keeps its
    /// paywall up after one, so this is known only from the purchase itself
    /// (`SuperwallPurchaseController`), once the paywall is closed.
    case pending
    /// It was closed without buying.
    case declined
    /// No Superwall paywall: skipped (a holdout, no audience match, a placement on
    /// no campaign), an error, Superwall not running, a page that failed to load, or
    /// no answer in time. The native paywall shows instead.
    case unavailable

    /// What a closed paywall came to. The SDK closes it with "declined" after an Ask
    /// to Buy, and could after a purchase that asked not to close it, so the last
    /// purchase made from it decides.
    init(closedBy close: RemotePaywallClose, lastPurchase: PremiumStore.PurchaseOutcome?) {
        switch (close, lastPurchase) {
        case (.purchased, _), (.declined, .purchased?):
            self = .purchased
        case (.restored, _):
            self = .restored
        case (.declined, .pending?):
            self = .pending
        case (.declined, _):
            self = .declined
        case (.failedToLoad, _):
            self = .unavailable
        }
    }
}

// MARK: - When Superwall starts, and what it may send

/// When Superwall is started and what it may send, as plain rules with no SDK
/// behind them, so the tests read the same answers as `SuperwallPaywalls`.
///
/// - Superwall starts at most once per process, and only once a learner 13 or over
///   is drawing: at launch if the active learner is 13+ (after "Who's drawing?" has
///   been answered, when it is asked), otherwise the first time a 13+ learner
///   becomes active — a switch, or an age group changed. A launch with only
///   children on it never starts it.
/// - It always starts with event tracking off (`.none`), which also skips the SDK's
///   one-time install-attribution match (IP address and device fingerprint). Once it
///   has finished starting, tracking is on while a 13+ learner draws and off again
///   whenever a child does, for the rest of the process.
/// - A paywall is asked for only once it has finished starting, and only for 13+.
struct SuperwallGate: Equatable {

    /// What `SuperwallPaywalls` is to do.
    enum Command: Equatable {
        /// `Superwall.configure`, with event tracking off.
        case configure
        /// Event tracking on (`.all`) or off (`.none`).
        case trackEvents(Bool)
    }

    enum Phase: Equatable {
        case notStarted, starting, started
    }

    private enum Launch: Equatable {
        case notYet, waitingForPicker, done
    }

    /// False for a launch that must never start Superwall (`isAllowed(…)`).
    let isAllowed: Bool
    private(set) var phase: Phase = .notStarted
    private(set) var tier: PrivacyTier = .child
    private var launchState: Launch = .notYet
    /// The tracking last asked for, so the same answer is not sent twice.
    private var tracking: Bool?

    init(isAllowed: Bool) {
        self.isAllowed = isAllowed
    }

    /// Launch is over (`RemotePaywalls.launch`).
    mutating func launch(tier: PrivacyTier, waitingForPicker: Bool) -> [Command] {
        self.tier = tier
        launchState = waitingForPicker ? .waitingForPicker : .done
        return evaluate()
    }

    /// Another learner, or another age group. Before launch it is only noted; while
    /// "Who's drawing?" is up, this is its answer.
    mutating func learnerChanged(to tier: PrivacyTier) -> [Command] {
        self.tier = tier
        guard launchState != .notYet else { return [] }
        launchState = .done
        return evaluate()
    }

    /// `Superwall.configure` has called back.
    mutating func configureFinished() -> [Command] {
        guard phase == .starting else { return [] }
        phase = .started
        return trackingCommand()
    }

    /// A paywall may be asked for.
    var mayPresent: Bool {
        isAllowed && phase == .started && launchState == .done && tier >= .teen
    }

    /// Superwall's own events may be forwarded to `Analytics`.
    var forwardsEvents: Bool {
        phase != .notStarted && tier >= .teen
    }

    private mutating func evaluate() -> [Command] {
        guard isAllowed, launchState == .done else { return [] }
        switch phase {
        case .notStarted:
            guard tier >= .teen else { return [] }
            phase = .starting
            tracking = false
            return [.configure]
        case .starting:
            // The configure callback decides, with whoever is drawing by then.
            return []
        case .started:
            return trackingCommand()
        }
    }

    private mutating func trackingCommand() -> [Command] {
        let wanted = tier >= .teen
        guard tracking != wanted else { return [] }
        tracking = wanted
        return [.trackEvents(wanted)]
    }

    /// Whether this launch may start Superwall at all: never for a screenshot launch
    /// of the debug harness (`-STScreen`), which must stay deterministic; never with
    /// `-STNativePaywall`, which forces the native paywall; never inside the unit
    /// tests. The three flags are read in debug builds only (`SuperwallPaywalls.make`).
    static func isAllowed(screenshotLaunch: Bool, forcesNativePaywall: Bool, runningTests: Bool) -> Bool {
        !screenshotLaunch && !forcesNativePaywall && !runningTests
    }
}

// MARK: - Premium, as Superwall is told it

/// Premium as Superwall's `subscriptionStatus` carries it. There is no "unknown":
/// the status is set the moment Superwall starts, from what `PremiumStore` knows,
/// because a placement registered while it is unknown waits and then fails.
enum RemoteSubscriptionStatus: Equatable {
    case active(entitlements: Set<String>)
    case inactive

    /// The entitlement both plans unlock, as named on the Superwall dashboard.
    static let premiumEntitlement = "premium"

    init(isPremium: Bool) {
        self = isPremium ? .active(entitlements: [Self.premiumEntitlement]) : .inactive
    }
}

/// What `SuperwallPurchaseController` tells Superwall about a purchase or a restore
/// made through `PremiumStore`.
enum RemotePurchaseAnswer: Equatable {
    case purchased, pending, cancelled, failed

    init(_ outcome: PremiumStore.PurchaseOutcome) {
        switch outcome {
        // `restored` never comes from a purchase; were it to, the account holds
        // Premium, which is what a purchase means to Superwall.
        case .purchased, .restored: self = .purchased
        case .pending: self = .pending
        case .cancelled: self = .cancelled
        case .failed: self = .failed
        }
    }
}

/// Superwall's two answers to a restore. "Restored" means only that the App Store
/// answered: with nothing to restore the SDK sees an inactive status and says so
/// itself. "Failed" is for an App Store that could not be asked.
enum RemoteRestoreAnswer: Equatable {
    case restored, failed

    init(_ outcome: PremiumStore.RestoreOutcome) {
        switch outcome {
        case .restored, .nothingToRestore: self = .restored
        case .failed: self = .failed
        }
    }
}
