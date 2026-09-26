import Foundation
import OSLog
import StoreKit
import SuperwallKit

/// Superwall, for learners 13 and over: remote paywalls that can be A/B tested
/// without an app update. The only file that imports SuperwallKit; everything else
/// goes through `RemotePaywalls`, and every rule it follows is `SuperwallGate`.
///
/// **Purchases stay in `PremiumStore`** (StoreKit 2). Superwall is given a purchase
/// controller (`SuperwallPurchaseController`) and is told Premium through
/// `subscriptionStatus`, set the moment it starts and on every change after. Superwall
/// docs, "Advanced Purchasing" (https://superwall.com/docs/ios/guides/advanced-configuration,
/// read 2026-09-25): with a purchase controller "you must set
/// `Superwall.shared.subscriptionStatus` every time the user's subscription status
/// changes"; while it is `.unknown` paywalls wait, and a placement then fails.
///
/// **Children never touch it.** It starts only once a learner 13 or over is drawing,
/// with event tracking off; tracking goes on once it has started and a 13+ learner
/// is still drawing, and off again whenever a child draws (`SuperwallGate`). It is
/// never told who anyone is: no `identify`, no user attributes (no age, band or
/// tier), no integration attributes, and AdSupport and AppTrackingTransparency are
/// not linked, so the SDK's runtime look-ups of the advertising identifier find
/// nothing. Superwall keeps its own random id for the install.
///
/// Once started it stays started for the process (the SDK has no stop). While a
/// child draws after that, it sends no events, but it may still refresh its
/// configuration and its cached paywalls, whose requests carry the install's
/// random id and the vendor id; the next launch with only children on it does not
/// start it at all.
///
/// **The trial reminder is the app's own** (`TrialReminder`). The dashboard's
/// paywall Notifications must stay empty: with a "trial started" notification set,
/// the SDK asks for notification permission straight after the purchase and
/// schedules a second reminder, before "Your free week has started" can ask the way
/// the app promises. A paywall that carries one is logged as a fault when it opens.
@MainActor
final class SuperwallPaywalls: RemotePaywalls {

    /// The project's public key (Superwall project 42098, iOS app 56531). Public by
    /// design, like every `pk_` key: it only identifies the app to Superwall.
    /// "Configure the SDK" (https://superwall.com/docs/ios/quickstart/configure).
    static let apiKey = "pk_hy9KyoEgHdfiSBAq7ZVLN"

    /// How long Superwall has to present a paywall, or say it will not, before the
    /// native paywall shows instead. The SDK's own wait for a subscription status is
    /// five seconds; the learner is looking at a blank page meanwhile.
    static let answerTimeout: Duration = .seconds(4)

    /// `Superwall.configure` runs once per process, whatever happens to the model
    /// that asked for it.
    private static var hasConfigured = false
    private static let log = Logger(subsystem: "com.softroni.papercoach", category: "superwall")

    private let premium: PremiumStore
    private let analytics: Analytics
    private let purchaseController: SuperwallPurchaseController
    private var gate = SuperwallGate(isAllowed: true)
    /// The paywall asked for last, until it has answered.
    private var session: PresentationSession?

    /// The door for this launch. In a debug build, a screenshot launch of the
    /// harness (`-STScreen`), `-STNativePaywall` and the unit tests get the native
    /// paywall only, and Superwall never starts.
    static func make(premium: PremiumStore, analytics: Analytics) -> RemotePaywalls {
        #if DEBUG
        let processInfo = ProcessInfo.processInfo
        let allowed = SuperwallGate.isAllowed(
            screenshotLaunch: DebugScreenHarness.isActive,
            forcesNativePaywall: processInfo.arguments.contains("-STNativePaywall"),
            runningTests: processInfo.environment["XCTestConfigurationFilePath"] != nil)
        guard allowed else { return NativePaywallsOnly() }
        #endif
        return SuperwallPaywalls(premium: premium, analytics: analytics)
    }

    /// Touches nothing of the SDK: `Superwall.shared` before `configure` is an
    /// assertion failure in the SDK's debug builds.
    private init(premium: PremiumStore, analytics: Analytics) {
        self.premium = premium
        self.analytics = analytics
        purchaseController = SuperwallPurchaseController(premium: premium, analytics: analytics)
        purchaseController.onPurchaseOutcome = { [weak self] outcome in
            self?.session?.lastPurchase = outcome
        }
        premium.onPremiumChange = { [weak self] in
            self?.syncSubscriptionStatus()
        }
    }

    // MARK: - RemotePaywalls

    func launch(tier: PrivacyTier, waitingForPicker: Bool) {
        run(gate.launch(tier: tier, waitingForPicker: waitingForPicker))
    }

    func learnerDidChange(tier: PrivacyTier) {
        // Whatever was being asked for belonged to the learner before.
        session?.abandonIfWaiting()
        run(gate.learnerChanged(to: tier))
    }

    var canPresent: Bool { gate.mayPresent }

    /// Registers the placement with a presentation handler and no `feature` block:
    /// a skipped paywall (a holdout, no audience match, a placement on no campaign)
    /// must never unlock anything, it only means the native paywall. Superwall docs,
    /// `register()` (https://superwall.com/docs/ios/sdk-reference/register) and
    /// `PaywallPresentationHandler`
    /// (https://superwall.com/docs/ios/sdk-reference/PaywallPresentationHandler),
    /// read 2026-09-25.
    func present(_ placement: PaywallPlacement, completion: @escaping (RemotePaywallResult) -> Void) {
        guard gate.mayPresent, !premium.isPremium else {
            completion(.unavailable)
            return
        }
        session?.abandonIfWaiting()
        let session = PresentationSession(placement: placement, completion: completion)
        self.session = session

        // The handler's closures are called on the main queue; each hops onto the
        // main actor to reach this object.
        let handler = PaywallPresentationHandler()
        handler.onPresent { [weak self] info in
            Task { @MainActor in self?.paywallDidPresent(info, in: session) }
        }
        handler.onDismiss { [weak self] info, result in
            Task { @MainActor in self?.paywallDidDismiss(info, result: result, in: session) }
        }
        handler.onSkip { [weak self] reason in
            let why = reason.description
            Task { @MainActor in self?.fallBack(session, because: why) }
        }
        handler.onError { [weak self] error in
            let why = error.localizedDescription
            Task { @MainActor in self?.fallBack(session, because: why) }
        }

        Superwall.shared.register(placement: placement.name,
                                  params: placement.params.isEmpty ? nil : placement.params,
                                  handler: handler)

        session.watchdog = Task { [weak self] in
            try? await Task.sleep(for: Self.answerTimeout)
            guard !Task.isCancelled else { return }
            self?.fallBack(session, because: "no answer within \(Self.answerTimeout)")
        }
    }

    // MARK: - Starting

    private func run(_ commands: [SuperwallGate.Command]) {
        for command in commands {
            switch command {
            case .configure:
                configure()
            case let .trackEvents(isOn):
                // Superwall docs, `Superwall` (https://superwall.com/docs/ios/sdk-reference/Superwall),
                // read 2026-09-25: `eventTrackingBehavior` "updates the SDK's event
                // queue and the currently displayed paywall". `.none` also drops
                // anything already queued.
                Superwall.shared.eventTrackingBehavior = isOn ? .all : .none
            }
        }
    }

    /// Starts the SDK with tracking off. Superwall docs, `SuperwallOptions`
    /// (https://superwall.com/docs/ios/sdk-reference/SuperwallOptions), read
    /// 2026-09-25: `.none` "Sends no SDK events to Superwall. Install-attribution
    /// matching is also skipped" — the one-time match on IP address and device
    /// fingerprint, which the SDK decides inside `configure`, so it has to be off
    /// from the start. Test mode is off too (`testModeBehavior = .never`): it fakes
    /// purchases without calling the purchase controller, and must never reach a
    /// real learner (https://superwall.com/docs/ios/guides/test-mode).
    private func configure() {
        guard !Self.hasConfigured else { return }
        Self.hasConfigured = true

        let options = SuperwallOptions()
        options.eventTrackingBehavior = .none
        options.testModeBehavior = .never
        Superwall.configure(apiKey: Self.apiKey,
                            purchaseController: purchaseController,
                            options: options) { [weak self] in
            Task { @MainActor in self?.configureDidFinish() }
        }
        // Straight away, so it is never `.unknown` when a placement registers.
        syncSubscriptionStatus()
        Superwall.shared.delegate = self
        // The app is light on every phone (Info.plist, `UIUserInterfaceStyle`), and
        // so are its paywalls ("Runtime Interface Style Configuration", on the
        // `SuperwallOptions` page above).
        Superwall.shared.setInterfaceStyle(to: .light)
    }

    private func configureDidFinish() {
        run(gate.configureFinished())
    }

    /// Premium as `PremiumStore` has it, in Superwall's words: the `premium`
    /// entitlement, active or not. Superwall docs, `subscriptionStatus`
    /// (https://superwall.com/docs/ios/sdk-reference/subscriptionStatus).
    private func syncSubscriptionStatus() {
        guard gate.phase != .notStarted, Self.hasConfigured else { return }
        switch RemoteSubscriptionStatus(isPremium: premium.isPremium) {
        case let .active(entitlements):
            Superwall.shared.subscriptionStatus = .active(Set(entitlements.map { Entitlement(id: $0) }))
        case .inactive:
            Superwall.shared.subscriptionStatus = .inactive
        }
    }

    // MARK: - A paywall's answers

    private func paywallDidPresent(_ info: PaywallInfo, in session: PresentationSession) {
        guard session.phase == .waiting else {
            // Too late: the native paywall has already taken its place, or the
            // learner changed. Close it rather than stack it on top.
            if session.phase == .done {
                Task { await Superwall.shared.dismiss() }
            }
            return
        }
        session.didPresent()
        if !info.localNotifications.isEmpty {
            Self.log.fault("Paywall \(info.identifier, privacy: .public) carries local notifications. Remove them in the dashboard: the app schedules its own trial reminder and asks for permission itself.")
        }
    }

    private func paywallDidDismiss(_ info: PaywallInfo, result: PaywallResult, in session: PresentationSession) {
        guard session.phase == .presented else { return }
        let close: RemotePaywallClose
        switch result {
        case .purchased:
            close = .purchased
        case .restored:
            close = .restored
        case .declined:
            close = info.closeReason == .webViewFailedToLoad ? .failedToLoad : .declined
        }
        session.finish(RemotePaywallResult(closedBy: close, lastPurchase: session.lastPurchase))
    }

    /// Skipped, an error, or no answer in time, before anything was shown: the
    /// native paywall.
    private func fallBack(_ session: PresentationSession, because reason: String) {
        guard session.phase == .waiting else { return }
        Self.log.info("No Superwall paywall for \(session.placement.name, privacy: .public): \(reason, privacy: .public)")
        session.finish(.unavailable)
    }
}

// MARK: - Superwall's own events, forwarded

/// Superwall docs, `SuperwallDelegate` (https://superwall.com/docs/ios/sdk-reference/SuperwallDelegate)
/// and `SuperwallEvent` (https://superwall.com/docs/ios/sdk-reference/SuperwallEvent),
/// read 2026-09-25: `handleSuperwallEvent(withInfo:)` receives every event the SDK
/// tracks. A short allow-list goes into `Analytics`, and only while a learner 13 or
/// over is drawing.
extension SuperwallPaywalls: SuperwallDelegate {

    func handleSuperwallEvent(withInfo eventInfo: SuperwallEventInfo) {
        guard gate.forwardsEvents, let event = Self.analyticsEvent(for: eventInfo.event) else { return }
        analytics.track(event)
    }

    private static func analyticsEvent(for event: SuperwallEvent) -> AnalyticsEvent? {
        switch event {
        case let .triggerFire(placementName, result):
            let outcome: String
            var experiment: Experiment?
            switch result {
            case let .paywall(assigned):
                outcome = "paywall"
                experiment = assigned
            case let .holdout(assigned):
                outcome = "holdout"
                experiment = assigned
            case .noAudienceMatch:
                outcome = "no_audience_match"
            case .placementNotFound:
                outcome = "placement_not_found"
            case .error:
                outcome = "error"
            }
            return .superwallTriggerFired(placement: placementName,
                                          result: outcome,
                                          experimentId: experiment?.id,
                                          variantId: experiment?.variant.id)
        case let .paywallOpen(info):
            return .superwallPaywall(.paywallOpen, context: context(of: info))
        case let .paywallClose(info):
            return .superwallPaywall(.paywallClose, context: context(of: info))
        case let .paywallDecline(info):
            return .superwallPaywall(.paywallDecline, context: context(of: info))
        case let .transactionStart(product, info):
            return .superwallPaywall(.transactionStart, context: context(of: info), productId: product.productIdentifier)
        case let .transactionComplete(_, product, _, info):
            return .superwallPaywall(.transactionComplete, context: context(of: info), productId: product.productIdentifier)
        case let .transactionFail(_, info):
            return .superwallPaywall(.transactionFail, context: context(of: info))
        case let .transactionAbandon(product, info):
            return .superwallPaywall(.transactionAbandon, context: context(of: info), productId: product.productIdentifier)
        case let .transactionRestore(_, info):
            return .superwallPaywall(.transactionRestore, context: context(of: info))
        case let .freeTrialStart(product, info):
            return .superwallPaywall(.freeTrialStart, context: context(of: info), productId: product.productIdentifier)
        default:
            return nil
        }
    }

    private static func context(of info: PaywallInfo) -> SuperwallPaywallContext {
        SuperwallPaywallContext(placement: info.presentedByPlacementWithName,
                                paywallId: info.identifier,
                                experimentId: info.experiment?.id,
                                variantId: info.experiment?.variant.id)
    }
}

// MARK: - One request for a paywall

/// One placement registered, from the request until its answer. Answers once;
/// anything Superwall says after that is ignored.
@MainActor
private final class PresentationSession {
    enum Phase {
        /// Registered; nothing shown yet. The watchdog is running.
        case waiting
        /// A Superwall paywall is up.
        case presented
        /// Answered, or given up on.
        case done
    }

    let placement: PaywallPlacement
    private(set) var phase: Phase = .waiting
    /// The last purchase made from this paywall, if any: an Ask to Buy is known
    /// only from this.
    var lastPurchase: PremiumStore.PurchaseOutcome?
    var watchdog: Task<Void, Never>?
    private let completion: (RemotePaywallResult) -> Void

    init(placement: PaywallPlacement, completion: @escaping (RemotePaywallResult) -> Void) {
        self.placement = placement
        self.completion = completion
    }

    func didPresent() {
        phase = .presented
        watchdog?.cancel()
    }

    func finish(_ result: RemotePaywallResult) {
        guard phase != .done else { return }
        phase = .done
        watchdog?.cancel()
        completion(result)
    }

    /// Gives up on a request that has shown nothing yet, without an answer. A
    /// paywall already up is left to the learner.
    func abandonIfWaiting() {
        guard phase == .waiting else { return }
        phase = .done
        watchdog?.cancel()
    }
}

// MARK: - Buying for Superwall

/// Buys and restores for Superwall's paywalls through `PremiumStore`, so StoreKit 2,
/// the trial reminder's bookkeeping and the entitlement all stay in one place.
///
/// Superwall docs, `PurchaseController` (https://superwall.com/docs/ios/sdk-reference/PurchaseController)
/// and "Overriding Introductory Offer Eligibility"
/// (https://superwall.com/docs/ios/guides/intro-offer-eligibility-override), read
/// 2026-09-25: a controller that buys with StoreKit 2 passes the product's
/// `introOfferToken` as `.introductoryOfferEligibility(compactJWS:)`, and on iOS
/// 26.4 and later its `billingPlanType` as `.billingPlanType`. Both are passed
/// whenever the product carries them, so the free week Superwall's paywall shows is
/// the one StoreKit grants.
///
/// `PremiumStore` refreshes the entitlement before it returns, so Superwall's
/// subscription status is already right when the SDK reads it: a restore counts as
/// successful only with an active entitlement in place.
@MainActor
final class SuperwallPurchaseController: PurchaseController {

    /// Told of every purchase's outcome.
    var onPurchaseOutcome: ((PremiumStore.PurchaseOutcome) -> Void)?

    private let premium: PremiumStore
    private let analytics: Analytics
    private static let log = Logger(subsystem: "com.softroni.papercoach", category: "superwall")

    init(premium: PremiumStore, analytics: Analytics) {
        self.premium = premium
        self.analytics = analytics
    }

    func purchase(product: StoreProduct) async -> PurchaseResult {
        guard let storeKitProduct = product.sk2Product else {
            // A product sold outside the App Store. Paper Couch sells none.
            Self.log.error("Superwall asked to buy \(product.productIdentifier, privacy: .public), which is not an App Store product.")
            return .failed(SuperwallPurchaseError.notAnAppStoreProduct)
        }

        var options: Set<Product.PurchaseOption> = []
        if let token = product.introOfferToken {
            options.insert(.introductoryOfferEligibility(compactJWS: token.token))
        }
        if #available(iOS 26.4, *), let plan = product.billingPlanType {
            switch plan {
            case .upFront: options.insert(.billingPlanType(.upFront))
            case .monthly: options.insert(.billingPlanType(.monthly))
            }
        }

        let outcome = await premium.purchase(storeKitProduct, options: options)
        onPurchaseOutcome?(outcome)
        analytics.track(.purchaseAttempted(plan: PremiumStore.Plan(productId: storeKitProduct.id)?.rawValue ?? storeKitProduct.id,
                                           outcome: "\(outcome)"))

        switch RemotePurchaseAnswer(outcome) {
        case .purchased: return .purchased
        case .pending: return .pending
        case .cancelled: return .cancelled
        case .failed: return .failed(SuperwallPurchaseError.purchaseFailed)
        }
    }

    func restorePurchases() async -> RestorationResult {
        let outcome = await premium.restore()
        let reported: String
        switch outcome {
        case .restored: reported = "restored"
        case .nothingToRestore: reported = "nothing_found"
        case .failed: reported = "failed"
        }
        analytics.track(.purchaseAttempted(plan: "restore", outcome: reported))

        switch RemoteRestoreAnswer(outcome) {
        case .restored: return .restored
        case .failed: return .failed(SuperwallPurchaseError.appStoreUnreachable)
        }
    }
}

/// What Superwall shows when a purchase or a restore through `PremiumStore` does
/// not go through. The words match the native paywall's.
enum SuperwallPurchaseError: LocalizedError {
    case notAnAppStoreProduct
    case purchaseFailed
    case appStoreUnreachable

    var errorDescription: String? {
        switch self {
        case .notAnAppStoreProduct, .purchaseFailed:
            return "That did not go through. Please try again."
        case .appStoreUnreachable:
            return "The App Store could not be reached. Check the connection and try again."
        }
    }
}
