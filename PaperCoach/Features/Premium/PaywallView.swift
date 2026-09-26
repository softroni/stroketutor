import SwiftUI

/// The paywall: one recommended plan, Yearly with its free week, and everything the
/// App Store asks of a sign-up screen in plain sight. The layout is `PaywallLayout`,
/// shared with the grown-up's paywall.
///
/// Apple, "Auto-renewable subscriptions" (https://developer.apple.com/app-store/subscriptions/),
/// read 2026-09-25:
/// - "In the purchase flow, the amount that will be billed must be the most prominent
///   pricing element in the layout." So the yearly price leads, in the largest type
///   on the screen; the free week sits under it, smaller. Breakdowns and savings are
///   "displayed in a subordinate position and size to the annual price": the weekly
///   equivalent lives in the plans sheet, smaller than the price it breaks down. The
///   buy button names the price too (README, M10: a trial button naming only the
///   free period is not enough).
/// - "In the purchase flow for a free trial, clearly indicate how long the free trial
///   lasts and the price billed once the free trial is over." The dated timeline
///   under the price says both (`TrialTimeline`).
/// - The sign-up screen carries the subscription's name and duration, the full
///   renewal price, a way to restore, and links to the Terms of Use and the Privacy
///   Policy.
///
/// Human Interface Guidelines › Modality
/// (https://developer.apple.com/design/human-interface-guidelines/modality), read
/// 2026-09-25: "Always give people an obvious way to dismiss a modal view." There is
/// no close button: the way out is
/// "Continue with free lessons", right under the buy button, which says exactly what
/// the learner keeps. "View more plans" opens the plans sheet. Once the free week
/// has been used, the same screen offers Yearly without it, and what Premium gives
/// takes the timeline's place.
///
/// Reached from a Premium lesson's drawer ("See Premium"), from "More coming" at the
/// end of the first run, and from Settings. From a lesson, that lesson leads the art.
struct PaywallView: View {
    let entry: OfferEntry
    let onOutcome: (PremiumStore.PurchaseOutcome) -> Void
    let onContinueFree: () -> Void

    @Environment(AppModel.self) private var app

    var body: some View {
        PaywallLayout(trialLine: "Your first \(PremiumStore.trialDays) days are free",
                      isForGrownUp: false,
                      trialButtonTitle: "Start my free week",
                      onOutcome: onOutcome,
                      onContinueFree: onContinueFree) {
            EmptyView()
        } art: {
            PaywallArt(leadLessonId: leadLessonId)
        }
        .onAppear { app.analytics.track(.offerScreenViewed("paywall", entry: entry.analyticsName)) }
    }

    /// The Premium lesson that was tapped, when the way to Premium began with one.
    private var leadLessonId: String? {
        if case let .premiumLesson(lessonId) = entry { return lessonId }
        return nil
    }
}

/// The one layout both paywalls share (`PaywallView`, `GrownUpPaywallView`), top to
/// bottom:
/// - the bar: Restore on the right, and the grown-up's chip on the left;
/// - the art, small and on the plain page;
/// - the price block, "$19.99 per year" the largest text on the screen;
/// - the free week as a dated timeline (`TrialTimeline`), or, with no free week to
///   offer, what Premium gives (`OfferBenefits`);
/// - at the foot: "View more plans", any error, the buy button naming the price it
///   bills, "Continue with free lessons" directly under it, and the legal links.
///
/// While the App Store has not answered, the buy button gives way to a spinner or a
/// retry (`OfferLoadingState`), and the space under the price stays empty rather
/// than showing what Premium gives only to swap it for the timeline a moment later;
/// the way out stays on screen either way. Why each piece is there, with Apple's
/// words, is on `PaywallView`.
struct PaywallLayout<Badge: View, Art: View>: View {
    /// "Your first 7 days are free", under the price while the free week can be named.
    let trialLine: String
    /// The grown-up's paywall: the timeline says where the reminder arrives rather
    /// than "we send" it (`TrialTimeline`).
    let isForGrownUp: Bool
    /// The buy button while the free week is on offer: "Start my free week". It
    /// always carries the price billed after it on a second line.
    let trialButtonTitle: String
    let onOutcome: (PremiumStore.PurchaseOutcome) -> Void
    let onContinueFree: () -> Void
    private let badge: () -> Badge
    private let art: () -> Art

    @Environment(AppModel.self) private var app
    @State private var isShowingPlans = false
    @State private var didFail = false
    /// Whether the free week was on offer when the purchase in hand began, kept
    /// until the flow moves on. StoreKit reports the free week used before the
    /// purchase returns, so without it the screen behind Apple's sheet would turn
    /// into "Subscribe" as the sheet slides away.
    @State private var trialAtPurchase: Bool?

    init(trialLine: String,
         isForGrownUp: Bool,
         trialButtonTitle: String,
         onOutcome: @escaping (PremiumStore.PurchaseOutcome) -> Void,
         onContinueFree: @escaping () -> Void,
         @ViewBuilder badge: @escaping () -> Badge,
         @ViewBuilder art: @escaping () -> Art) {
        self.trialLine = trialLine
        self.isForGrownUp = isForGrownUp
        self.trialButtonTitle = trialButtonTitle
        self.onOutcome = onOutcome
        self.onContinueFree = onContinueFree
        self.badge = badge
        self.art = art
    }

    var body: some View {
        OfferScreenFrame(contentSpacing: 28) {
            HStack {
                badge()
                Spacer()
                RestoreButton { onOutcome(.restored) }
            }
        } content: {
            art()

            PriceBlock(trialLine: trialLine, namesFreeWeek: isTrial)
                .frame(maxWidth: .infinity)

            if isTrial {
                TrialTimeline(isForGrownUp: isForGrownUp)
            } else if app.premium.yearlyPrice != nil || app.premium.loadState == .failed {
                // No free week to lay out: what Premium gives. Not while the App
                // Store is still answering, when the timeline may be what comes.
                OfferBenefits()
            }
        } footer: {
            if app.premium.loadState == .loaded, app.premium.yearly != nil {
                Button("View more plans") { isShowingPlans = true }
                    .buttonStyle(.quiet)
                    .underline()
                    .padding(.bottom, -6)

                if didFail {
                    Text("That did not go through. Please try again.")
                        .textRole(.footnote)
                        .foregroundStyle(Theme.danger)
                }

                Button { buy(.yearly) } label: {
                    PurchaseLabel(title: isTrial ? trialButtonTitle : "Subscribe",
                                  price: app.premium.yearlyPrice.map { isTrial ? "then \($0)/year" : "\($0)/year" })
                }
                .buttonStyle(.primary)
                .disabled(app.premium.isPurchasing)
            } else {
                OfferLoadingState()
            }

            Button("Continue with free lessons", action: onContinueFree)
                .buttonStyle(.quiet)
                .underline()

            LegalLinksRow()
        }
        .onAppear {
            #if DEBUG
            // The `offer-plans` screenshot opens the sheet by itself.
            if DebugScreenHarness.takeOpensPlans() { isShowingPlans = true }
            #endif
        }
        .sheet(isPresented: $isShowingPlans) {
            PaywallPlansSheet { plan in
                isShowingPlans = false
                buy(plan)
            }
            .environment(app)
        }
    }

    /// The free week is on offer and its price is known: the button names both.
    /// During a purchase, what it was when the purchase began.
    private var isTrial: Bool { trialAtPurchase ?? app.premium.canNameFreeWeek }

    private func buy(_ plan: PremiumStore.Plan) {
        didFail = false
        trialAtPurchase = isTrial
        OfferPurchase.buy(plan, app: app) { outcome in
            switch outcome {
            case .failed:
                didFail = true
                trialAtPurchase = nil
            case .cancelled:
                trialAtPurchase = nil
            case .purchased, .pending, .restored:
                break // The flow moves on; the screen holds still until it has.
            }
            onOutcome(outcome)
        }
    }
}

/// The prices, in the order Apple asks for: the amount billed first and largest —
/// "$19.99 per year" — then the free week, then the plan's name and length and
/// Family Sharing. The weekly equivalent is not here: it is a breakdown, and it
/// lives in the plans sheet beside the plan it breaks down (`PaywallPlansSheet`).
///
/// Until the App Store answers there is no price, so the block names the plan and
/// nothing else: no free week (`PremiumStore.canNameFreeWeek`).
struct PriceBlock: View {
    /// "Your first 7 days are free", said only while the free week is on offer and
    /// its price is on screen.
    let trialLine: String
    /// Whether to say it: `PremiumStore.canNameFreeWeek`, held by the paywall while
    /// a purchase lands (`PaywallLayout`).
    let namesFreeWeek: Bool

    @Environment(AppModel.self) private var app

    var body: some View {
        VStack(spacing: 4) {
            if let yearly = app.premium.yearlyPrice {
                Text("\(yearly) per year")
                    .scaledFont(32, .heavy, relativeTo: .largeTitle)
                    .tracking(-0.8)
                    .foregroundStyle(Theme.ink)
                    .multilineTextAlignment(.center)
            } else {
                Text("Paper Coach Premium")
                    .textRole(.title1)
                    .foregroundStyle(Theme.ink)
            }
            if namesFreeWeek, app.premium.yearlyPrice != nil {
                Text(trialLine)
                    .scaledFont(18, .heavy, relativeTo: .headline)
                    .foregroundStyle(Theme.greenDeep)
                    .multilineTextAlignment(.center)
            }
            // Without a price the title above already names the plan.
            Text(app.premium.yearlyPrice == nil ? "Renews yearly" : "Paper Coach Premium · renews yearly")
                .textRole(.footnote)
                .foregroundStyle(Theme.ink55)
                .padding(.top, 2)
            FamilySharingChip()
                .padding(.top, 6)
        }
        .accessibilityElement(children: .combine)
    }
}

/// A buy button's label: what it does, and under it the price it bills —
/// "Start my free week / then $19.99/year".
struct PurchaseLabel: View {
    let title: String
    let price: String?

    var body: some View {
        VStack(spacing: 2) {
            Text(title)
            if let price {
                Text(price)
                    .scaledFont(15, .bold)
                    .opacity(0.9)
            }
        }
        .padding(.vertical, 6)
    }
}

/// Lina and three of the path's drawings, one of them Premium: what the
/// subscription is for, without a word. Small, and straight on the page, so the
/// price under it is what the eye lands on.
///
/// Opened from a Premium lesson, that lesson comes first, with two more from its
/// path beside it.
struct PaywallArt: View {
    /// The Premium lesson that was tapped, if the way to Premium began with one.
    var leadLessonId: String?

    @Environment(AppModel.self) private var app

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            LinaView(pose: .wave, size: 104)
                // Lina's frame is wider than her figure on the left; without this
                // the row looks about 10 pt right of the centered price under it.
                .padding(.leading, -20)
            HStack(spacing: 8) {
                ForEach(lessons) { lesson in
                    DrawingThumbnail(tutorial: lesson.tutorial, strokeColor: nil, showsFills: true)
                        .padding(8)
                        .frame(width: 64, height: 78)
                        .background(
                            RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Theme.paper)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .strokeBorder(Theme.line, lineWidth: 2)
                        )
                        .overlay(alignment: .topTrailing) {
                            if app.needsPremium(lesson) {
                                CrownBadge(size: 22).offset(x: 6, y: -6)
                            }
                        }
                }
            }
            .padding(.bottom, 4)
        }
        .frame(maxWidth: .infinity)
        .accessibilityHidden(true)
    }

    /// The tapped lesson first, when there is one, then the first, fourth and sixth
    /// lessons of its path (or of the current path) that are not already shown.
    private var lessons: [Lesson] {
        let lead = leadLessonId.flatMap { app.lesson(id: $0) }
        guard let path = lead.flatMap({ app.path(id: $0.pathId) }) ?? app.currentPath else {
            return lead.map { [$0] } ?? []
        }
        let picks = [0, 3, 5].compactMap { path.lessons.indices.contains($0) ? path.lessons[$0] : nil }
        guard let lead else { return picks }
        return [lead] + picks.filter { $0.id != lead.id }.prefix(2)
    }
}

/// "Family Sharing: up to 6 people" — one purchase covers the family.
struct FamilySharingChip: View {
    var body: some View {
        Chip(text: "Family Sharing: up to 6 people", systemImage: "person.3.fill", style: .green)
    }
}

/// "View more plans": Yearly (with the free week, when there is one) and Weekly,
/// Yearly chosen. The button says what the chosen plan does.
///
/// This sheet can buy on its own, so it keeps the paywall's rule (Apple,
/// "Auto-renewable subscriptions", https://developer.apple.com/app-store/subscriptions/,
/// read 2026-09-25: "the amount that will be billed must be the most prominent
/// pricing element in the layout"): each row's billed price, "$19.99/year", is set
/// at 24 pt, larger than the 20 pt "Start my free week" on the button, and both
/// scale with the same text style, so the price stays ahead at every text size.
/// The weekly equivalent and "Save 80%" sit smaller beside it.
struct PaywallPlansSheet: View {
    let onBuy: (PremiumStore.Plan) -> Void

    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var plan: PremiumStore.Plan = .yearly

    var body: some View {
        // Scrolls, so the buy button and the legal links stay reachable at the
        // medium detent and with large text.
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                HStack {
                    // The subscription's name sits over its plans: this sheet can buy
                    // one on its own, so it names what is bought (App Review
                    // Guidelines 3.1.2).
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Choose a plan")
                            .textRole(.title2)
                            .foregroundStyle(Theme.ink)
                            .accessibilityAddTraits(.isHeader)
                        Text("Paper Coach Premium · auto-renewing")
                            .textRole(.footnote)
                            .foregroundStyle(Theme.ink55)
                    }
                    Spacer()
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .scaledFont(17, .bold, design: .default)
                            .foregroundStyle(Theme.ink55)
                            .frame(width: Theme.navTapTarget, height: Theme.navTapTarget)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Close plans")
                }

                if app.premium.yearly != nil {
                    planRow(.yearly,
                            title: "Yearly",
                            detail: yearlyDetail,
                            price: app.premium.yearlyPrice.map { "\($0)/year" } ?? "",
                            tag: app.premium.yearlySavingsPercent.map { "Save \($0)%" } ?? "Best value")
                }
                if app.premium.weekly != nil {
                    planRow(.weekly,
                            title: "Weekly",
                            detail: "Billed every week",
                            price: app.premium.weeklyPrice.map { "\($0)/week" } ?? "",
                            tag: nil)
                }

                Text(terms)
                    .textRole(.footnote)
                    .foregroundStyle(Theme.ink70)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .fixedSize(horizontal: false, vertical: true)

                Button { onBuy(plan) } label: {
                    PurchaseLabel(title: buttonTitle, price: buttonPrice)
                }
                .buttonStyle(.primary)
                .disabled(app.premium.product(for: plan) == nil || app.premium.isPurchasing)

                LegalLinksRow()
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.top, Theme.stackSpacing)
            .padding(.bottom, Theme.stackSpacing)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Theme.card)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private var isTrial: Bool { app.premium.isEligibleForTrial }

    /// "7 days free, then billed yearly · about $0.38 a week". The weekly figure is a
    /// breakdown of the yearly price, so it sits here in the row's small print, under
    /// and smaller than the "$19.99/year" the row bills (Apple, "Auto-renewable
    /// subscriptions", read 2026-09-25: "a subordinate position and size to the
    /// annual price").
    private var yearlyDetail: String {
        let billing = isTrial ? "\(PremiumStore.trialDays) days free, then billed yearly" : "Billed every year"
        guard let perWeek = app.premium.yearlyPricePerWeek else { return billing }
        return "\(billing) · about \(perWeek) a week"
    }

    private var buttonTitle: String {
        switch plan {
        case .yearly: return isTrial ? "Start my free week" : "Subscribe yearly"
        case .weekly: return "Subscribe weekly"
        }
    }

    /// The amount the chosen plan bills, on the button itself.
    private var buttonPrice: String? {
        switch plan {
        case .yearly: return app.premium.yearlyPrice.map { isTrial ? "then \($0)/year" : "\($0)/year" }
        case .weekly: return app.premium.weeklyPrice.map { "\($0)/week" }
        }
    }

    private var terms: String {
        switch plan {
        case .yearly:
            let price = app.premium.yearlyPrice ?? ""
            return isTrial
                ? "Nothing to pay today. Then \(price)/year. Cancel anytime."
                : "\(price)/year. Cancel anytime."
        case .weekly:
            return "\(app.premium.weeklyPrice ?? "")/week, starting today. Cancel anytime."
        }
    }

    private func planRow(_ option: PremiumStore.Plan,
                         title: String,
                         detail: String,
                         price: String,
                         tag: String?) -> some View {
        let isChosen = plan == option
        let shape = RoundedRectangle(cornerRadius: Theme.controlCornerRadius, style: .continuous)
        let name = HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(title)
                .scaledFont(17, .heavy)
                .foregroundStyle(Theme.ink)
            if let tag {
                Text(tag)
                    .scaledFont(12, .heavy)
                    .foregroundStyle(Theme.greenDeep)
            }
        }
        // The billed amount: larger than the button's 20 pt title (see the type's
        // comment), relative to the same text style.
        let billed = Text(price)
            .scaledFont(24, .heavy)
            .tracking(-0.4)
            .foregroundStyle(Theme.ink)
        return Button {
            plan = option
        } label: {
            HStack(alignment: .top, spacing: 12) {
                Circle()
                    .strokeBorder(isChosen ? Theme.green : Theme.lineStrong, lineWidth: isChosen ? 7 : 2)
                    .frame(width: 24, height: 24)
                    .padding(.top, 4)
                VStack(alignment: .leading, spacing: 4) {
                    // The name and the price on one line when they fit; with large
                    // text, the price on a line of its own.
                    ViewThatFits(in: .horizontal) {
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            name
                            Spacer(minLength: 8)
                            billed
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            name
                            billed
                        }
                    }
                    Text(detail)
                        .textRole(.footnote)
                        .foregroundStyle(Theme.ink55)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(16)
            .frame(minHeight: Theme.minimumTapTarget)
            .background(shape.fill(isChosen ? Theme.greenTint : Theme.card))
            .overlay(shape.strokeBorder(isChosen ? Theme.green : Theme.line, lineWidth: 2))
            .contentShape(shape)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isChosen ? [.isButton, .isSelected] : .isButton)
    }
}
