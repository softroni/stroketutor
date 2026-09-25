import SwiftUI

/// The way to Premium, as one full-screen cover that walks its own steps.
///
/// **After the first run** (`OfferEntry.onboarding`):
/// "More coming" → the free week → the reminder promise → the paywall. With the
/// free week already used, "More coming" goes straight to the paywall.
///
/// **From a Premium lesson's drawer, or Settings**: the paywall alone.
///
/// **For a child** (under 13, or never said) the free week and the paywall are
/// replaced by the way to a grown-up: "Ask a grown-up" → the parental check → the
/// grown-up's paywall. A child never sees a price or a buy button.
///
/// No step has a close button. Every one of them either leads on or ends the flow
/// on "Continue with free lessons" (or the child's "Keep drawing free lessons"),
/// which is the one way out and keeps everything free. Ask to Buy ends on the
/// waiting screen.
struct OfferFlow: View {
    let entry: OfferEntry

    @Environment(AppModel.self) private var app
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var step: Step?
    @State private var isFinishing = false

    enum Step: Hashable {
        case moreComing, freeWeek, reminder, paywall
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
            if step == nil { step = firstStep }
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
            MoreComingView(onContinue: {
                if app.learnerIsChild {
                    go(.grownUp)
                } else {
                    // The free week is only offered beside its price; with the App
                    // Store unreachable the paywall says so and offers a retry.
                    go(app.premium.canNameFreeWeek ? .freeWeek : .paywall)
                }
            })

        case .freeWeek:
            FreeWeekView(onContinue: { go(.reminder) })

        case .reminder:
            TrialReminderPromiseView(onContinue: { go(.paywall) })

        case .paywall:
            PaywallView(entry: entry,
                        onOutcome: handle,
                        onContinueFree: { finish(subscribed: false) })

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

    /// Where the flow opens: "More coming" after the first run, the paywall (or the
    /// way to a grown-up) from anywhere else.
    private var firstStep: Step {
        switch entry {
        case .onboarding:
            return .moreComing
        case .premiumLesson, .settings:
            return app.learnerIsChild ? .grownUp : .paywall
        }
    }

    private func go(_ target: Step) {
        withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.22)) {
            step = target
        }
    }

    /// A purchase's outcome. Bought (or restored): the reminder is scheduled — its
    /// permission asked, if it never was — and the flow ends. Ask to Buy: the
    /// waiting screen. Cancelled or failed: the paywall stays, to try again or leave.
    private func handle(_ outcome: PremiumStore.PurchaseOutcome) {
        switch outcome {
        case .purchased:
            Task {
                await TrialReminder.requestAndSchedule(trialEndsAt: app.premium.trialEndsAt)
                finish(subscribed: true)
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
