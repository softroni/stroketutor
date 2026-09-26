import SwiftUI

// MARK: - The frame

/// The shape of every screen on the way to Premium: an optional 56 pt bar, a body
/// centred in the space left and scrolling only when it has to, and the buttons
/// pinned to the bottom. Like `OnboardingBeatFrame`, without the rail — these
/// screens are one message each, not steps of a questionnaire.
///
/// `contentSpacing` is the air between the body's groups: 18 pt on the one-message
/// screens, more on the paywalls, whose art, price and timeline each need room to
/// read as their own group.
struct OfferScreenFrame<Top: View, Content: View, Footer: View>: View {
    private let top: () -> Top
    private let content: () -> Content
    private let footer: () -> Footer
    private let hasTop: Bool
    private let contentSpacing: CGFloat

    init(contentSpacing: CGFloat = 18,
         @ViewBuilder top: @escaping () -> Top,
         @ViewBuilder content: @escaping () -> Content,
         @ViewBuilder footer: @escaping () -> Footer) {
        self.top = top
        self.content = content
        self.footer = footer
        self.contentSpacing = contentSpacing
        hasTop = true
    }

    var body: some View {
        VStack(spacing: 0) {
            if hasTop {
                top()
                    .padding(.horizontal, 8)
                    .frame(height: 56)
            }

            GeometryReader { geometry in
                ScrollView {
                    VStack(spacing: contentSpacing) {
                        content()
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, Theme.gutter)
                    .padding(.vertical, 12)
                    .frame(minHeight: geometry.size.height)
                }
                .scrollBounceBehavior(.basedOnSize)
            }

            VStack(spacing: Theme.stackSpacing) {
                footer()
            }
            .padding(.top, Theme.stackSpacing)
            .padding(.horizontal, Theme.gutter)
            .padding(.bottom, Theme.stackSpacing)
            .background(Theme.page)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.page.ignoresSafeArea())
    }
}

extension OfferScreenFrame where Top == EmptyView {
    init(contentSpacing: CGFloat = 18,
         @ViewBuilder content: @escaping () -> Content,
         @ViewBuilder footer: @escaping () -> Footer) {
        self.top = { EmptyView() }
        self.content = content
        self.footer = footer
        self.contentSpacing = contentSpacing
        hasTop = false
    }
}

// MARK: - Small shared pieces

/// A green check and one line: what Premium gives.
struct OfferBenefitRow: View {
    let text: String

    init(_ text: String) { self.text = text }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: "checkmark")
                .scaledFont(15, .heavy, design: .default)
                .foregroundStyle(Theme.green)
            Text(text)
                .textRole(.headline)
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
    }
}

/// The three things Premium gives. The paywalls show them in place of the
/// timeline when there is no free week to lay out (`TrialTimeline`).
struct OfferBenefits: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            OfferBenefitRow("\(lessonCount) lessons across \(pathCount) paths")
            OfferBenefitRow("Lina coaching every stroke")
            OfferBenefitRow("Cancel anytime in Settings")
        }
    }

    private var lessonCount: Int {
        app.paths.reduce(0) { $0 + $1.lessonCount }
    }

    private var pathCount: Int {
        app.paths.filter { !$0.isEmpty }.count
    }
}

/// The free week, day by day, under the price on both paywalls: today, the day the
/// reminder comes, and the day the price starts, each with its real date, worked out
/// when the screen shows it ("Tue, Sep 29", in the device's own format).
///
/// Apple, "Auto-renewable subscriptions"
/// (https://developer.apple.com/app-store/subscriptions/), read 2026-09-25: "In the
/// purchase flow for a free trial, clearly indicate how long the free trial lasts and
/// the price billed once the free trial is over." The last row says both, with a date.
/// Breakdowns and extras are "displayed in a subordinate position and size to the
/// annual price", so nothing here is larger than 15 pt: the price above stays the
/// largest pricing element (README, M10). Shown only while the free week can be named
/// beside its price (`PremiumStore.canNameFreeWeek`).
///
/// Every row is a promise, so each one says only what will happen:
/// - the last row gives the day the price starts and says to cancel "at least a day
///   before", not "before then": Apple (https://support.apple.com/en-us/118428, read
///   2026-09-25) tells people to cancel a trial "at least 24 hours before the trial
///   ends", since the renewal can be charged in the day before it;
/// - the reminder row follows this device's notification setting. The reminder is
///   scheduled only with permission (`TrialReminder.sync`), asked for once the free
///   week has started (`TrialStartedView`), so the row says "if you allow
///   notifications" until it is given, and says how to get the reminder when it was
///   refused. An Ask to Buy approval, or a purchase the app is closed straight after,
///   never reaches that screen; the row's condition keeps it true then too.
struct TrialTimeline: View {
    /// On the grown-up's paywall: the reminder "arrives on this device", which may be
    /// the child's, rather than "we send" it to the one reading.
    let isForGrownUp: Bool

    @Environment(AppModel.self) private var app
    /// This device's notification setting; nil for the moment it takes to ask.
    @State private var authorization: PracticeReminderScheduler.Authorization?

    var body: some View {
        let schedule = TrialSchedule(startingAt: Date())
        let price = app.premium.yearlyPrice.map { "\($0)/year" } ?? "Paper Coach Premium"
        VStack(alignment: .leading, spacing: 16) {
            row(symbol: "lock.open.fill", fill: Theme.green,
                when: "Today", spokenWhen: "Today",
                what: "Every lesson unlocks. No payment now.")
            row(symbol: "bell.fill", fill: Theme.gold,
                when: Self.shortDay(schedule.reminder), spokenWhen: Self.longDay(schedule.reminder),
                what: reminderLine)
            // A card, not a calendar: at this size `calendar` reads as a keyboard,
            // and this row is about the payment.
            row(symbol: "creditcard.fill", fill: Theme.ink55,
                when: Self.shortDay(schedule.end), spokenWhen: Self.longDay(schedule.end),
                what: "\(price) starts. Cancel at least a day before to pay nothing.")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .task {
            authorization = await PracticeReminderScheduler.authorization()
        }
    }

    /// Row two, as true as this device's notification setting lets it be.
    private var reminderLine: String {
        switch authorization {
        case .allowed:
            return isForGrownUp ? "A reminder arrives on this device." : "We send a reminder to this device."
        case .denied:
            return "Turn on notifications to get a reminder."
        case .notDetermined, .none:
            return isForGrownUp
                ? "A reminder arrives on this device if notifications are allowed."
                : "We send a reminder to this device if you allow notifications."
        }
    }

    private func row(symbol: String, fill: Color, when: String, spokenWhen: String, what: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: symbol)
                .scaledFont(14, .bold, relativeTo: .subheadline, design: .default)
                .foregroundStyle(.white)
                .frame(width: 32, height: 32)
                .background(Circle().fill(fill))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(when)
                    .scaledFont(15, .heavy, relativeTo: .subheadline)
                    .foregroundStyle(Theme.ink)
                Text(what)
                    .textRole(.subhead)
                    .foregroundStyle(Theme.ink55)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(spokenWhen). \(what)")
    }

    /// "Tue, Sep 29".
    private static func shortDay(_ date: Date) -> String {
        date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
    }

    /// "Tuesday, September 29", for VoiceOver.
    private static func longDay(_ date: Date) -> String {
        date.formatted(.dateTime.weekday(.wide).month(.wide).day())
    }
}

/// Restore, and the two links a subscription screen must carry: the terms of use
/// (Apple's standard licence) and the privacy policy.
enum LegalLinks {
    static let terms = URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!
    static let privacy = URL(string: "https://softroni.com/privacy-policy.html")!
}

struct LegalLinksRow: View {
    var body: some View {
        HStack(spacing: 20) {
            Link("Terms of Use", destination: LegalLinks.terms)
            Link("Privacy", destination: LegalLinks.privacy)
        }
        .scaledFont(13, .semibold)
        .foregroundStyle(Theme.ink55)
        .tint(Theme.ink55)
        .frame(maxWidth: .infinity)
    }
}

/// "Restore" in the top bar: asks the App Store for this account's purchases.
struct RestoreButton: View {
    let onRestored: () -> Void

    @Environment(AppModel.self) private var app
    @State private var isRestoring = false
    @State private var failure: RestoreFailure?

    private enum RestoreFailure {
        case nothingFound, unreachable
    }

    var body: some View {
        Button {
            guard !isRestoring else { return }
            isRestoring = true
            Task {
                let outcome = await app.premium.restore()
                isRestoring = false
                switch outcome {
                case .restored:
                    app.analytics.track(.purchaseAttempted(plan: "restore", outcome: "restored"))
                    onRestored()
                case .nothingToRestore:
                    app.analytics.track(.purchaseAttempted(plan: "restore", outcome: "nothing_found"))
                    failure = .nothingFound
                case .failed:
                    app.analytics.track(.purchaseAttempted(plan: "restore", outcome: "failed"))
                    failure = .unreachable
                }
            }
        } label: {
            Group {
                if isRestoring {
                    ProgressView()
                } else {
                    Text("Restore")
                }
            }
            .scaledFont(15, .bold)
            .foregroundStyle(Theme.ink55)
            .padding(.horizontal, 8)
            .frame(minHeight: Theme.navTapTarget)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Restore purchases")
        .alert(failure == .unreachable ? "Could not restore" : "Nothing to restore",
               isPresented: Binding(get: { failure != nil }, set: { if !$0 { failure = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(failure == .unreachable
                 ? "The App Store could not be reached. Check the connection and try again."
                 : "This Apple Account has no Paper Coach Premium to restore.")
        }
    }
}

/// What the paywalls do with a purchase: buy the plan, report the outcome for
/// analytics, and hand it to the flow.
@MainActor
enum OfferPurchase {
    static func buy(_ plan: PremiumStore.Plan,
                    app: AppModel,
                    onOutcome: @escaping (PremiumStore.PurchaseOutcome) -> Void) {
        guard let product = app.premium.product(for: plan) else { return }
        Task {
            let outcome = await app.premium.purchase(product)
            app.analytics.track(.purchaseAttempted(plan: plan.rawValue, outcome: "\(outcome)"))
            onOutcome(outcome)
        }
    }
}

/// While the App Store has not answered, or could not be reached: a quiet line,
/// and a way to try again. The way out stays on screen either way.
struct OfferLoadingState: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        switch app.premium.loadState {
        case .failed:
            VStack(spacing: 8) {
                Text("The App Store could not be reached.")
                    .textRole(.subhead)
                    .foregroundStyle(Theme.ink55)
                    .multilineTextAlignment(.center)
                Button("Try again") {
                    Task { await app.premium.loadProducts() }
                }
                .buttonStyle(.quietLink)
            }
        default:
            ProgressView()
                .frame(minHeight: 64)
        }
    }
}
