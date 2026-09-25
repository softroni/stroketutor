import SwiftUI

/// The way to Premium, as one full-screen cover that walks its own steps. Where it
/// starts and where each step leads is `OfferRoute`.
///
/// **After the first run** (`OfferEntry.onboarding`): "More coming" → the paywall.
/// No screen before the paywall names the free week or asks for anything.
///
/// **From a Premium lesson's drawer ("See Premium"), or Settings**: the paywall alone.
///
/// **For a child** (under 13, or never said) the paywall is behind a grown-up: "This
/// part is for a grown-up" → the parental check → the grown-up's paywall. A child
/// never sees a price or a buy button. The child's drawer reaches this only through
/// its "For grown-ups" link.
///
/// **Once a free week has really started** (`PremiumStore.trialEndsAt` is set after
/// the purchase), from either paywall: "Your free week has started"
/// (`TrialStartedView`), which gives the reminder's real dates and asks for
/// notification permission, if it never was, before the flow ends. A purchase
/// without a free week (Weekly, or Yearly once the free week is used) ends the flow
/// straight away.
///
/// That step lives only in this flow's state, and it is not brought back: not when
/// the app is closed between the purchase and its button, nor when an Ask to Buy
/// approval arrives later through `Transaction.updates`. Shown at some later launch
/// it could put the price in front of a child now holding the phone, and after the
/// first run it would land on top of whatever the relaunch shows. The reminder then
/// follows the notification permission the device already has (`TrialReminder.sync`
/// runs on every entitlement refresh), and the paywall's timeline promises it on
/// exactly that condition ("if you allow notifications", `TrialTimeline`), so what
/// was promised still holds.
///
/// No step has a close button. Every one of them either leads on or ends the flow
/// on "Continue with free lessons" (or the child's "Keep drawing free lessons"),
/// which is the one way out and keeps everything free. Ask to Buy ends on the
/// waiting screen; a free week ends on "trial started".
struct OfferFlow: View {
    let entry: OfferEntry

    @Environment(AppModel.self) private var app
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var step: Step?
    @State private var isFinishing = false
    /// The free week was started on the grown-up's paywall, so "trial started"
    /// speaks of the child's week ("Their free week has started").
    @State private var startedByGrownUp = false

    enum Step: Hashable {
        case moreComing, paywall, trialStarted
        case grownUp, parentalCheck, grownUpPaywall
        case pending
    }

    var body: some View {
        ZStack {
            Theme.page.ignoresSafeArea()
            current
                .id(step)
                .transition(.opacity)
        }
        .interactiveDismissDisabled(true)
        .onAppear {
            if step == nil { step = openingStep }
        }
        .task {
            if app.premium.loadState != .loaded {
                await app.premium.loadProducts()
            }
        }
    }

    @ViewBuilder
    private var current: some View {
        switch step {
        case .none:
            Color.clear

        case .moreComing:
            MoreComingView(entry: entry, onContinue: {
                go(OfferRoute.stepAfterMoreComing(isChild: app.learnerIsChild))
            })

        case .paywall:
            PaywallView(entry: entry,
                        onOutcome: handle,
                        onContinueFree: { finish(subscribed: false) })

        case .trialStarted:
            if let trialEndsAt {
                TrialStartedView(entry: entry,
                                 isForGrownUp: startedByGrownUp,
                                 trialEndsAt: trialEndsAt,
                                 onFinish: { finish(subscribed: true) })
            } else {
                // Only reachable if the trial vanished between the purchase and
                // this screen (a refund, say): nothing to promise, so the flow ends.
                Color.clear.onAppear { finish(subscribed: true) }
            }

        case .grownUp:
            GrownUpHandoffView(entry: entry,
                               onGrownUp: { go(.parentalCheck) },
                               onKeepDrawing: { finish(subscribed: false) })

        case .parentalCheck:
            ParentalGateView(entry: entry,
                             onPass: { go(.grownUpPaywall) },
                             onBack: { go(.grownUp) },
                             onKeepDrawing: { finish(subscribed: false) })

        case .grownUpPaywall:
            GrownUpPaywallView(entry: entry,
                               onOutcome: handle,
                               onContinueFree: { finish(subscribed: false) })

        case .pending:
            PurchasePendingView(entry: entry,
                                onContinue: { finish(subscribed: false) })
        }
    }

    /// Where the flow opens (`OfferRoute.firstStep`). A screenshot launch of the
    /// debug harness can ask for another step instead.
    private var openingStep: Step {
        #if DEBUG
        if let step = DebugScreenHarness.takeOfferStep() { return step }
        #endif
        return OfferRoute.firstStep(for: entry, isChild: app.learnerIsChild)
    }

    /// When the free week that has just started ends. The debug harness can supply
    /// one for the `offer-trial-started` screenshot, where nothing was bought.
    private var trialEndsAt: Date? {
        #if DEBUG
        return app.premium.trialEndsAt ?? DebugScreenHarness.pendingTrialEndsAt
        #else
        return app.premium.trialEndsAt
        #endif
    }

    private func go(_ target: Step) {
        withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.22)) {
            step = target
        }
    }

    /// A purchase's outcome. Bought with a free week: "trial started", which asks
    /// for the reminder's permission. Bought without one, or restored: the flow
    /// ends. Ask to Buy: the waiting screen. Cancelled or failed: the paywall stays,
    /// to try again or leave.
    private func handle(_ outcome: PremiumStore.PurchaseOutcome) {
        switch outcome {
        case .purchased:
            if let next = OfferRoute.stepAfterPurchase(trialEndsAt: app.premium.trialEndsAt) {
                startedByGrownUp = step == .grownUpPaywall
                go(next)
            } else {
                Task {
                    // No free week, nothing to remind about: clear any old reminder
                    // and never ask for a permission this purchase does not need.
                    await TrialReminder.sync(trialEndsAt: nil)
                    finish(subscribed: true)
                }
            }
        case .restored:
            finish(subscribed: true)
        case .pending:
            go(.pending)
        case .cancelled, .failed:
            break
        }
    }

    private func finish(subscribed: Bool) {
        guard !isFinishing else { return }
        isFinishing = true
        app.finishOffer(entry, subscribed: subscribed)
    }
}

/// Where the way to Premium goes, as plain rules with no view behind them, so the
/// tests read the same answers as `OfferFlow`.
enum OfferRoute {

    /// The step the flow opens on: "More coming" after the first run; from a
    /// Premium lesson or Settings, the paywall, or for a child the way to a grown-up.
    static func firstStep(for entry: OfferEntry, isChild: Bool) -> OfferFlow.Step {
        switch entry {
        case .onboarding:
            return .moreComing
        case .premiumLesson, .settings:
            return isChild ? .grownUp : .paywall
        }
    }

    /// "More coming"'s Continue: the paywall, or for a child the way to a grown-up.
    /// Never a screen about the free week first: the paywall names it beside its
    /// price.
    static func stepAfterMoreComing(isChild: Bool) -> OfferFlow.Step {
        isChild ? .grownUp : .paywall
    }

    /// After a purchase went through: "trial started" when a free week really began
    /// (`PremiumStore.trialEndsAt`), else nil — the flow ends.
    static func stepAfterPurchase(trialEndsAt: Date?) -> OfferFlow.Step? {
        trialEndsAt == nil ? nil : .trialStarted
    }
}
