import SwiftUI

/// The paywall: one recommended plan, Yearly with its free week, and everything the
/// App Store asks of a sign-up screen in plain sight.
///
/// Apple, "Auto-renewable subscriptions" (https://developer.apple.com/app-store/subscriptions/),
/// read 2026-09-24:
/// - "In the purchase flow, the amount that will be billed must be the most prominent
///   pricing element in the layout." So the yearly price leads, in the largest type;
///   the free week and the monthly equivalent sit under it, smaller. The buy button
///   names the price too (README, M10: a trial button naming only the free period is
///   not enough).
/// - "In the purchase flow for a free trial, clearly indicate how long the free trial
///   lasts and the price billed once the free trial is over."
/// - The sign-up screen carries the subscription's name and duration, the full
///   renewal price, a way to restore, and links to the Terms of Use and the Privacy
///   Policy.
///
/// "No payment now" sits right over the button. "View more plans" opens the plan
/// sheet. There is no close button: the one way out is the text link "Continue with
/// free lessons", which says exactly what the learner keeps. Once the free week has
/// been used, the same screen offers Yearly without it.
struct PaywallView: View {
    let entry: OfferEntry
    let onOutcome: (PremiumStore.PurchaseOutcome) -> Void
    let onContinueFree: () -> Void

    @Environment(AppModel.self) private var app
    @State private var isShowingPlans = false
    @State private var didFail = false

    var body: some View {
        OfferScreenFrame {
            HStack {
                Spacer()
                RestoreButton { onOutcome(.purchased) }
            }
        } content: {
            PaywallArt()

            PriceBlock(trialLine: "Your first \(PremiumStore.trialDays) days are free")
                .frame(maxWidth: .infinity)

            OfferBenefits()
                .padding(.horizontal, 8)
        } footer: {
            if app.premium.loadState == .loaded, app.premium.yearly != nil {
                Button("View more plans") { isShowingPlans = true }
                    .buttonStyle(.quiet)
                    .underline()
                    .padding(.bottom, -6)

                if isTrial {
                    Label("No payment now", systemImage: "checkmark")
                        .textRole(.headline)
                        .foregroundStyle(Theme.ink)
                }
                if didFail {
                    Text("That did not go through. Please try again.")
                        .textRole(.footnote)
                        .foregroundStyle(Theme.danger)
                }

                Button { buy(.yearly) } label: {
                    PurchaseLabel(title: isTrial ? "Start my free week" : "Subscribe",
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
        .sheet(isPresented: $isShowingPlans) {
            PaywallPlansSheet { plan in
                isShowingPlans = false
                buy(plan)
            }
            .environment(app)
        }
        .onAppear { app.analytics.track(.offerScreenViewed("paywall", entry: entry.analyticsName)) }
    }

    private var isTrial: Bool { app.premium.isEligibleForTrial }

    private func buy(_ plan: PremiumStore.Plan) {
        didFail = false
        OfferPurchase.buy(plan, app: app) { outcome in
            if outcome == .failed { didFail = true }
            onOutcome(outcome)
        }
    }
}

/// The prices, in the order Apple asks for: the amount billed first and largest —
/// "$39.99 per year" — then the free week, then what it comes to a month, then the
/// plan's name and length and Family Sharing.
struct PriceBlock: View {
    /// "Your first 7 days are free", said only while the free week is on offer.
    let trialLine: String

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
            if app.premium.isEligibleForTrial {
                Text(trialLine)
                    .scaledFont(18, .heavy, relativeTo: .headline)
                    .foregroundStyle(Theme.greenDeep)
                    .multilineTextAlignment(.center)
            }
            if let perMonth = app.premium.yearlyPricePerMonth {
                Text("That’s about \(perMonth) a month")
                    .textRole(.subhead)
                    .foregroundStyle(Theme.ink55)
            }
            Text("Paper Coach Premium · renews yearly")
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
/// "Start my free week / then $39.99/year".
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
/// subscription is for, without a word.
struct PaywallArt: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            LinaView(pose: .wave, size: 132)
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
            .padding(.bottom, 8)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: Theme.cardCornerRadius, style: .continuous)
                .fill(Theme.greenTint)
        )
        .accessibilityHidden(true)
    }

    /// The first, fourth and sixth lessons of the current path, when it has them.
    private var lessons: [Lesson] {
        guard let path = app.currentPath else { return [] }
        return [0, 3, 5].compactMap { path.lessons.indices.contains($0) ? path.lessons[$0] : nil }
    }
}

/// "Family Sharing: up to 6 people" — one purchase covers the family.
struct FamilySharingChip: View {
    var body: some View {
        Chip(text: "Family Sharing: up to 6 people", systemImage: "person.3.fill", style: .green)
    }
}

/// "View more plans": Yearly (with the free week, when there is one) and Monthly,
/// Yearly chosen. The button says what the chosen plan does.
struct PaywallPlansSheet: View {
    let onBuy: (PremiumStore.Plan) -> Void

    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var plan: PremiumStore.Plan = .yearly

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.stackSpacing) {
            HStack {
                Text("Choose a plan")
                    .textRole(.title2)
                    .foregroundStyle(Theme.ink)
                    .accessibilityAddTraits(.isHeader)
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
                        detail: isTrial ? "\(PremiumStore.trialDays) days free, then billed yearly" : "Billed every year",
                        price: app.premium.yearlyPrice.map { "\($0)/year" } ?? "",
                        tag: "Best value")
            }
            if app.premium.monthly != nil {
                planRow(.monthly,
                        title: "Monthly",
                        detail: "Billed every month",
                        price: app.premium.monthlyPrice.map { "\($0)/month" } ?? "",
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
        }
        .padding(.horizontal, Theme.gutter)
        .padding(.top, Theme.stackSpacing)
        .padding(.bottom, Theme.stackSpacing)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Theme.card)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private var isTrial: Bool { app.premium.isEligibleForTrial }

    private var buttonTitle: String {
        switch plan {
        case .yearly: return isTrial ? "Start my free week" : "Subscribe yearly"
        case .monthly: return "Subscribe monthly"
        }
    }

    /// The amount the chosen plan bills, on the button itself.
    private var buttonPrice: String? {
        switch plan {
        case .yearly: return app.premium.yearlyPrice.map { isTrial ? "then \($0)/year" : "\($0)/year" }
        case .monthly: return app.premium.monthlyPrice.map { "\($0)/month" }
        }
    }

    private var terms: String {
        switch plan {
        case .yearly:
            let price = app.premium.yearlyPrice ?? ""
            return isTrial
                ? "Nothing to pay today. Then \(price)/year. Cancel anytime."
                : "\(price)/year. Cancel anytime."
        case .monthly:
            return "\(app.premium.monthlyPrice ?? "")/month, starting today. Cancel anytime."
        }
    }

    private func planRow(_ option: PremiumStore.Plan,
                         title: String,
                         detail: String,
                         price: String,
                         tag: String?) -> some View {
        let isChosen = plan == option
        let shape = RoundedRectangle(cornerRadius: Theme.controlCornerRadius, style: .continuous)
        return Button {
            plan = option
        } label: {
            HStack(spacing: 12) {
                Circle()
                    .strokeBorder(isChosen ? Theme.green : Theme.lineStrong, lineWidth: isChosen ? 7 : 2)
                    .frame(width: 24, height: 24)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .scaledFont(17, .heavy)
                        .foregroundStyle(Theme.ink)
                    Text(detail)
                        .textRole(.footnote)
                        .foregroundStyle(Theme.ink55)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .trailing, spacing: 2) {
                    Text(price)
                        .scaledFont(18, .heavy)
                        .foregroundStyle(Theme.ink)
                    if let tag {
                        Text(tag)
                            .scaledFont(12, .heavy)
                            .foregroundStyle(Theme.greenDeep)
                    }
                }
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
