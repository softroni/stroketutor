import SwiftUI
import UIKit

// MARK: - Ask a grown-up

/// A child's way to Premium starts by handing the phone over. Lina says so, and
/// there are two ways on: the grown-up takes it from here, or the child goes back
/// to the free lessons. No price, no trial, nothing to buy on this screen.
struct GrownUpHandoffView: View {
    let entry: OfferEntry
    let onGrownUp: () -> Void
    let onKeepDrawing: () -> Void

    @Environment(AppModel.self) private var app

    var body: some View {
        OfferScreenFrame {
            Spacer(minLength: 0)

            LinaView(pose: .point, size: 200)
                .overlay(alignment: .trailing) {
                    Image(systemName: "iphone")
                        .font(.system(size: 34, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                        .frame(width: 64, height: 64)
                        .background(Circle().fill(Theme.blueSoft))
                        .overlay(Circle().strokeBorder(Theme.paper, lineWidth: 4))
                        .offset(x: 52, y: -30)
                        .accessibilityHidden(true)
                }

            Text("This part is for a grown-up.")
                .textRole(.title1)
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)

            Text("Pass the phone to a parent or another grown-up. They’ll know what to do.")
                .textRole(.bodyRegular)
                .foregroundStyle(Theme.ink55)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 0)
        } footer: {
            Button("I’m the grown-up", action: onGrownUp)
                .buttonStyle(.primary)
            Button("Keep drawing free lessons", action: onKeepDrawing)
                .buttonStyle(.quiet)
        }
        .onAppear { app.analytics.track(.offerScreenViewed("grown_up", entry: entry.analyticsName)) }
    }
}

// MARK: - The parental check

/// "Grown-ups only": a sum written in words, with the answer typed as a number —
/// easy for a grown-up, hard for a young child who cannot read it yet. A new
/// question every time, and after a wrong answer. It stands in front of every
/// purchase a child's profile could reach.
struct ParentalGateView: View {
    let entry: OfferEntry
    let onPass: () -> Void
    let onBack: () -> Void
    let onKeepDrawing: () -> Void

    @Environment(AppModel.self) private var app
    @State private var question = ParentalQuestion.random()
    @State private var answer = ""
    @State private var wasWrong = false
    @State private var pinRequest: PINGateRequest?
    @FocusState private var isFocused: Bool

    /// With the app's PIN set, the grown-ups already have a secret for exactly
    /// this: it guards Premium the way it guards deleting a learner. Without one,
    /// the question in words stands in for it.
    private var usesPIN: Bool { app.pin.isSet }

    var body: some View {
        OfferScreenFrame {
            HStack {
                Button(action: onBack) {
                    Image(systemName: "chevron.left")
                        .scaledFont(20, .bold, design: .default)
                        .foregroundStyle(Theme.ink)
                        .frame(width: Theme.navTapTarget, height: Theme.navTapTarget)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Back")
                Spacer()
            }
        } content: {
            Image(systemName: "checkmark.shield.fill")
                .font(.system(size: 40, weight: .semibold))
                .foregroundStyle(Theme.blue)
                .frame(width: 92, height: 92)
                .background(Circle().fill(Theme.blueSoft))
                .accessibilityHidden(true)

            VStack(spacing: 8) {
                Text("Grown-ups only")
                    .textRole(.title1)
                    .foregroundStyle(Theme.ink)
                    .accessibilityAddTraits(.isHeader)
                Text(usesPIN
                     ? "Enter the PIN to continue. It keeps little hands away from purchases."
                     : "Answer this to continue. It keeps little hands away from purchases.")
                    .textRole(.bodyRegular)
                    .foregroundStyle(Theme.ink55)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if !usesPIN {
                VStack(spacing: 12) {
                    Text(question.text)
                        .textRole(.title3)
                        .foregroundStyle(Theme.ink)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)

                    TextField("Type the number", text: $answer)
                        .keyboardType(.numberPad)
                        .focused($isFocused)
                        .scaledFont(24, .heavy)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 16)
                        .frame(minHeight: Theme.minimumTapTarget)
                        .background(
                            RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Theme.card)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .strokeBorder(wasWrong ? Theme.danger : Theme.lineStrong, lineWidth: 2)
                        )
                        .accessibilityLabel(question.text)
                        .onSubmit(check)

                    if wasWrong {
                        Text("That’s not it. Here’s another one.")
                            .textRole(.footnote)
                            .foregroundStyle(Theme.danger)
                    }
                }
                .padding(18)
                .background(
                    RoundedRectangle(cornerRadius: Theme.cardCornerRadius, style: .continuous)
                        .fill(Theme.surface)
                )
            }
        } footer: {
            if usesPIN {
                Button("Enter the PIN") {
                    pinRequest = PINGateRequest(reason: "Needed to see Paper Coach Premium.", onApproved: onPass)
                }
                .buttonStyle(.primary)
            } else {
                Button("Continue", action: check)
                    .buttonStyle(.primary)
                    .disabled(answer.isEmpty)
            }
            Button("Not a grown-up? Back to drawing", action: onKeepDrawing)
                .buttonStyle(.quiet)
        }
        .pinGate($pinRequest)
        .onAppear {
            app.analytics.track(.offerScreenViewed("parental_check", entry: entry.analyticsName))
        }
    }

    private func check() {
        guard !answer.isEmpty else { return }
        if Int(answer.trimmingCharacters(in: .whitespaces)) == question.answer {
            isFocused = false
            onPass()
        } else {
            wasWrong = true
            answer = ""
            question = ParentalQuestion.random(excluding: question)
        }
    }
}

/// "What is twelve times eight?" — six to twelve times six to nine, written out.
struct ParentalQuestion: Equatable {
    let left: Int
    let right: Int

    var answer: Int { left * right }

    var text: String {
        "What is \(Self.word(left)) times \(Self.word(right))?"
    }

    static func random(excluding previous: ParentalQuestion? = nil) -> ParentalQuestion {
        var question: ParentalQuestion
        repeat {
            question = ParentalQuestion(left: Int.random(in: 6...12), right: Int.random(in: 6...9))
        } while question == previous
        return question
    }

    private static func word(_ number: Int) -> String {
        spellOut.string(from: NSNumber(value: number)) ?? "\(number)"
    }

    private static let spellOut: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .spellOut
        return formatter
    }()
}

// MARK: - The grown-up's paywall

/// The paywall written for the parent the phone was handed to. The free week, the
/// reminder and the price on one page: the child's own drawing and the lessons on
/// their wish list, the price (first and largest, as on `PaywallView`, which cites
/// Apple's rule), "Their first 7 days are free", and Today → Day 5 → Day 7.
/// The button also asks for notification permission, since the reminder comes to
/// this device (`TrialReminder`). "Continue with free lessons" is the way out.
struct GrownUpPaywallView: View {
    let entry: OfferEntry
    let onOutcome: (PremiumStore.PurchaseOutcome) -> Void
    let onContinueFree: () -> Void

    @Environment(AppModel.self) private var app
    @State private var isShowingPlans = false
    @State private var didFail = false

    var body: some View {
        OfferScreenFrame {
            HStack {
                Chip(text: "For grown-ups", style: .blue)
                    .padding(.leading, 12)
                Spacer()
                RestoreButton { onOutcome(.restored) }
            }
        } content: {
            childCard

            PriceBlock(trialLine: "Their first \(PremiumStore.trialDays) days are free")
                .frame(maxWidth: .infinity)

            if isTrial { timeline }
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
                    PurchaseLabel(title: isTrial ? "Start the free week" : "Subscribe",
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
        .onAppear { app.analytics.track(.offerScreenViewed("grown_up_paywall", entry: entry.analyticsName)) }
    }

    private var isTrial: Bool { app.premium.isEligibleForTrial }

    /// The child's latest drawing — their photo if they took one, else the lesson —
    /// beside what they starred for later.
    private var childCard: some View {
        HStack(spacing: 14) {
            latestDrawing
                .frame(width: 100, height: 100)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

            let wishes = Array(app.wishedLessons.prefix(3))
            if wishes.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text(latestLesson.map { "They drew \(LessonBookend.subject(of: $0.title)) today." }
                         ?? "Their drawings live in their sketchbook.")
                        .textRole(.headline)
                        .foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("From their sketchbook")
                        .textRole(.footnote)
                        .foregroundStyle(Theme.ink55)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    Text("On their wish list".uppercased())
                        .textRole(.eyebrow)
                        .foregroundStyle(Theme.goldDeep)
                    HStack(alignment: .top, spacing: 10) {
                        ForEach(wishes) { lesson in
                            VStack(spacing: 4) {
                                DrawingThumbnail(tutorial: lesson.tutorial, strokeColor: nil, showsFills: true)
                                    .padding(6)
                                    .frame(width: 50, height: 50)
                                    .background(
                                        RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Theme.paper)
                                    )
                                    .overlay(alignment: .topTrailing) {
                                        Image(systemName: "star.fill")
                                            .font(.system(size: 10, weight: .bold))
                                            .foregroundStyle(Theme.gold)
                                            .frame(width: 20, height: 20)
                                            .background(Circle().fill(Theme.goldSoft))
                                            .offset(x: 6, y: -6)
                                    }
                                Text(lesson.title)
                                    .scaledFont(12, .bold)
                                    .foregroundStyle(Theme.ink)
                                    .lineLimit(1)
                                    .frame(width: 58)
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("On their wish list: \(wishes.map(\.title).joined(separator: ", "))")
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: Theme.cardCornerRadius, style: .continuous)
                .strokeBorder(Theme.line, lineWidth: 2)
        )
    }

    /// The lesson finished most recently.
    private var latestLesson: Lesson? {
        app.progress.records
            .filter(\.isCompleted)
            .max { ($0.completedAt ?? .distantPast) < ($1.completedAt ?? .distantPast) }
            .flatMap { app.lesson(id: $0.lessonId) }
    }

    @ViewBuilder
    private var latestDrawing: some View {
        if let page = app.sketchbook.pages.first, let image = app.sketchbook.thumbnail(for: page) {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
                .accessibilityLabel("Their latest page")
        } else {
            DrawingThumbnail(tutorial: latestLesson?.tutorial, strokeColor: nil, showsFills: true)
                .padding(10)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Theme.surface)
                .accessibilityHidden(true)
        }
    }

    /// Today → Day 5 → Day 7, one line each.
    private var timeline: some View {
        let reminderDay = PremiumStore.trialDays - PremiumStore.reminderDaysBeforeTrialEnds
        let price = app.premium.yearlyPrice.map { "\($0)/year" } ?? "Premium"
        return VStack(alignment: .leading, spacing: 10) {
            timelineRow(badge: "1", fill: Theme.green, when: "Today",
                        what: "Every lesson unlocks. No payment now.")
            timelineRow(badge: "\(reminderDay)", fill: Theme.gold, when: "Day \(reminderDay)",
                        what: "A reminder arrives on this device.")
            timelineRow(badge: "\(PremiumStore.trialDays)", fill: Theme.ink55, when: "Day \(PremiumStore.trialDays)",
                        what: "\(price) starts. Cancel before then and pay nothing.")
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Theme.cardCornerRadius, style: .continuous).fill(Theme.surface)
        )
    }

    private func timelineRow(badge: String, fill: Color, when: String, what: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text(badge)
                .scaledFont(13, .heavy)
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(Circle().fill(fill))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text(when)
                    .textRole(.headline)
                    .foregroundStyle(Theme.ink)
                Text(what)
                    .textRole(.footnote)
                    .foregroundStyle(Theme.ink55)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func buy(_ plan: PremiumStore.Plan) {
        didFail = false
        OfferPurchase.buy(plan, app: app) { outcome in
            if outcome == .failed { didFail = true }
            onOutcome(outcome)
        }
    }
}

// MARK: - Waiting for approval

/// Ask to Buy: the purchase went to the family organizer, and nothing happens until
/// they answer on their own device. The learner keeps drawing the free lessons;
/// when the approval comes, `PremiumStore` hears it and every crown goes.
struct PurchasePendingView: View {
    let entry: OfferEntry
    let onContinue: () -> Void

    @Environment(AppModel.self) private var app

    var body: some View {
        OfferScreenFrame {
            Spacer(minLength: 0)

            LinaView(pose: .neutral, size: 180)
                .overlay(alignment: .topTrailing) {
                    Image(systemName: "hourglass")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(Theme.goldDeep)
                        .frame(width: 60, height: 60)
                        .background(Circle().fill(Theme.goldSoft))
                        .overlay(Circle().strokeBorder(Theme.paper, lineWidth: 4))
                        .offset(x: 30, y: 0)
                        .accessibilityHidden(true)
                }

            Chip(text: "Request sent", systemImage: "clock", style: .gold)

            Text("Waiting for a grown-up to say yes")
                .textRole(.title1)
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)

            Text("We asked your family organizer to approve Premium. When they do, every lesson unlocks right here. If they say no, nothing is charged.")
                .textRole(.bodyRegular)
                .foregroundStyle(Theme.ink55)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 0)
        } footer: {
            Button("Keep drawing free lessons", action: onContinue)
                .buttonStyle(.primary)
        }
        .onAppear { app.analytics.track(.offerScreenViewed("pending", entry: entry.analyticsName)) }
    }
}
