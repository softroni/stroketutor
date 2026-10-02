import SwiftUI
import UIKit

// MARK: - Ask a grown-up

/// The first screen of a child's way to Premium, before the parental check. Reached
/// three ways, each with its own words; no price, no trial, nothing to buy on any
/// of them.
///
/// - **A crowned lesson** (`OfferEntry.premiumLesson`): the lesson's card. Its
///   finished drawing, big, with the crown; "Rain Cloud is a Premium lesson";
///   "Premium has every lesson on every path"; then **Save to my wish list**, a
///   free lesson to draw instead, "Not now" and a small "For grown-ups". The wish
///   list is the child's own, Home shows it ("Your wish list"), and the grown-up's
///   paywall shows it beside their drawing, so a child who wants a lesson has
///   something to show, and a grown-up who looks sees what was wanted. Saving it is
///   the green button until pressed; then it steps back to a white "On my wish
///   list" and the free lesson turns green, so the loudest button never takes the
///   wish away. A second tap within a moment of the first is a double tap, not a
///   change of mind, and is ignored.
/// - **The end of the first run** (`.onboarding`, after "More coming"): a card for
///   the grown-up who set the app up — the person who answered the age question
///   for a young child is usually the parent holding the phone — with the child's
///   first drawing, and "I'm the grown-up" or "Keep drawing free lessons".
/// - **Settings › Premium** (`.settings`): "This part is for a grown-up."
///
/// None of them tells the child to go and ask, or show, a grown-up anything: the
/// card says what the lesson is and who the next step is for. An advertisement's
/// "direct appeal to children to … persuade their parents or other adults to buy
/// advertised products for them" is banned outright (UK Digital Markets,
/// Competition and Consumers Act 2024, Schedule 20 para 30; EU Unfair Commercial
/// Practices Directive, Annex I point 28, applied to apps by the CPC Network's
/// common position on in-app purchases, 2014, and to Star Stable in March 2025),
/// and in the US "Advertising should not urge Children to ask parents or others to
/// buy products" (CARU, Self-Regulatory Guidelines for Children's Advertising,
/// Sales Pressure, read 2026-10-02 at
/// https://bbbnp-bbbp-stf-use1-01.s3.amazonaws.com/docs/default-source/caru/caru_advertisingguidelines.pdf).
struct GrownUpHandoffView: View {
    let entry: OfferEntry
    let onGrownUp: () -> Void
    let onKeepDrawing: () -> Void
    /// "Draw Tulip" on a crowned lesson's card: the free lesson in its place.
    var onDrawInstead: (Lesson) -> Void = { _ in }

    @Environment(AppModel.self) private var app
    /// When the wish list last changed from this card, to ignore a double tap.
    @State private var lastWishChange: Date?

    var body: some View {
        Group {
            switch entry {
            case let .premiumLesson(lessonId):
                if let lesson = app.lesson(id: lessonId) {
                    lessonCard(lesson)
                } else {
                    forAGrownUp
                }
            case .onboarding:
                forTheGrownUpWhoSetItUp
            case .settings, .sketchbook:
                forAGrownUp
            }
        }
        .onAppear { app.analytics.track(.offerScreenViewed("grown_up", entry: entry.analyticsName)) }
    }

    // MARK: A crowned lesson

    private func lessonCard(_ lesson: Lesson) -> some View {
        let isWished = app.isWished(lesson)
        let free = app.freeLessonInstead(of: lesson)
        return OfferScreenFrame {
            Spacer(minLength: 0)

            PremiumLessonPicture(lesson: lesson)

            VStack(spacing: 8) {
                Text("\(lesson.title) is a Premium lesson.")
                    .textRole(.title1)
                    .foregroundStyle(Theme.ink)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                Text("Premium has every lesson on every path. Save this one to your wish list, and keep drawing the free ones.")
                    .textRole(.bodyRegular)
                    .foregroundStyle(Theme.ink55)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, 8)

            Spacer(minLength: 0)
        } footer: {
            Button {
                toggleWish(lesson)
            } label: {
                Label(isWished ? "On my wish list" : "Save to my wish list",
                      systemImage: isWished ? "star.fill" : "star")
            }
            // Green until saved; then white, and the free lesson below takes the green.
            .buttonStyle(TactileButtonStyle(variant: isWished ? .secondary : .primary))
            .accessibilityValue(isWished ? "Saved" : "")

            if let free {
                Button("Draw \(free.title)") { onDrawInstead(free) }
                    .buttonStyle(TactileButtonStyle(variant: isWished ? .primary : .secondary))
            }

            ViewThatFits(in: .horizontal) {
                HStack(spacing: 28) { notNow; forGrownUps }
                VStack(spacing: 0) { notNow; forGrownUps }
            }
        }
    }

    private var notNow: some View {
        Button("Not now", action: onKeepDrawing)
            .buttonStyle(.quiet)
    }

    /// For the grown-up, not the child: small, gray, last. It leads to the parental
    /// check.
    private var forGrownUps: some View {
        Button(action: onGrownUp) {
            Text("For grown-ups")
                .scaledFont(15, .bold)
                .underline()
                .foregroundStyle(Theme.ink55)
                .frame(minHeight: Theme.navTapTarget)
                .padding(.horizontal, 8)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// Saves the lesson to the wish list, or takes it off — but not on a second tap
    /// within a moment of the last change.
    private func toggleWish(_ lesson: Lesson) {
        let now = Date()
        if let lastWishChange, now.timeIntervalSince(lastWishChange) < 1 { return }
        lastWishChange = now
        app.toggleWish(lesson)
    }

    // MARK: The end of the first run

    private var forTheGrownUpWhoSetItUp: some View {
        OfferScreenFrame {
            Spacer(minLength: 0)

            ChildLatestDrawing(preferredLesson: app.firstRunLesson)
                .frame(width: 176, height: 176)
                .clipShape(RoundedRectangle(cornerRadius: Theme.canvasCornerRadius, style: .continuous))

            VStack(spacing: 8) {
                Chip(text: "For grown-ups", style: .blue)
                Text("For the grown-up who set this up")
                    .textRole(.title1)
                    .foregroundStyle(Theme.ink)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                Text(setupLine)
                    .textRole(.bodyRegular)
                    .foregroundStyle(Theme.ink55)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, 8)

            Spacer(minLength: 0)
        } footer: {
            Button("I’m the grown-up", action: onGrownUp)
                .buttonStyle(.primary)
            Button("Keep drawing free lessons", action: onKeepDrawing)
                .buttonStyle(.quiet)
        }
    }

    /// "They just drew a pine tree, their first drawing. Premium has every lesson
    /// on every path, and you can see it from here. The free lessons stay theirs
    /// either way."
    private var setupLine: String {
        let first = app.firstRunLesson.map { "They just drew \(LessonBookend.subject(of: $0.title)), their first drawing. " } ?? ""
        return first + "Premium has every lesson on every path, and you can see it from here. The free lessons stay theirs either way."
    }

    // MARK: Settings

    private var forAGrownUp: some View {
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

            Text("If a grown-up is with you, they can take it from here. The free lessons stay yours either way.")
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
    }
}

/// A Premium lesson's finished drawing, big, on white, with its crown: what a child
/// tapped, as their card shows it.
private struct PremiumLessonPicture: View {
    let lesson: Lesson

    var body: some View {
        DrawingThumbnail(tutorial: lesson.tutorial, strokeColor: nil, showsFills: true)
            .padding(24)
            .frame(width: 176, height: 176)
            .background(
                RoundedRectangle(cornerRadius: Theme.canvasCornerRadius, style: .continuous)
                    .fill(Theme.surface)
            )
            .overlay(alignment: .bottomTrailing) {
                CrownBadge(size: 42).offset(x: 10, y: 10)
            }
            .accessibilityElement()
            .accessibilityLabel("The finished drawing of \(LessonBookend.subject(of: lesson.title)). Premium.")
    }
}

// MARK: - The parental check

/// "Grown-ups only": a sum written in words, with the answer typed as a number —
/// easy for a grown-up, hard for a young child who cannot read it yet. A new
/// question every time, and after a wrong answer. It stands in front of every
/// purchase a child's profile could reach.
///
/// Above it, what the child wanted, so a grown-up handed the phone knows what this
/// is about: the crowned lesson that was tapped, then the rest of their wish list,
/// up to three. With nothing wanted, the shield. Every answer is counted
/// (`parental_check_result`): passed, wrong, back or left.
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
                Button {
                    report("back")
                    onBack()
                } label: {
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
            if wantedLessons.isEmpty {
                Image(systemName: "checkmark.shield.fill")
                    .font(.system(size: 40, weight: .semibold))
                    .foregroundStyle(Theme.blue)
                    .frame(width: 92, height: 92)
                    .background(Circle().fill(Theme.blueSoft))
                    .accessibilityHidden(true)
            } else {
                WantedLessons(lessons: wantedLessons, caption: wantedCaption)
            }

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
                    pinRequest = PINGateRequest(reason: "Needed to see Paper Coach Premium.") {
                        report("passed")
                        onPass()
                    }
                }
                .buttonStyle(.primary)
            } else {
                Button("Continue", action: check)
                    .buttonStyle(.primary)
                    .disabled(answer.isEmpty)
            }
            Button("Not a grown-up? Back to drawing") {
                report("left")
                onKeepDrawing()
            }
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
            report("passed")
            onPass()
        } else {
            report("wrong")
            wasWrong = true
            answer = ""
            question = ParentalQuestion.random(excluding: question)
        }
    }

    private func report(_ result: String) {
        app.analytics.track(.parentalCheckResult(result,
                                                 method: usesPIN ? "pin" : "question",
                                                 entry: entry.analyticsName))
    }

    /// The crowned lesson that opened the way, if one did, then the wish list.
    private var wantedLessons: [Lesson] {
        var lessons: [Lesson] = []
        if case let .premiumLesson(lessonId) = entry, let tapped = app.lesson(id: lessonId), app.needsPremium(tapped) {
            lessons.append(tapped)
        }
        for wish in app.wishedLessons where !lessons.contains(where: { $0.id == wish.id }) {
            lessons.append(wish)
        }
        return Array(lessons.prefix(3))
    }

    /// "Mushroom is a Premium lesson. On their wish list: Cherries." — the tapped
    /// lesson when it is not on the list, then the wished ones shown.
    private var wantedCaption: String {
        let wanted = wantedLessons
        var parts: [String] = []
        if case let .premiumLesson(lessonId) = entry,
           let tapped = wanted.first(where: { $0.id == lessonId }),
           !app.isWished(tapped) {
            parts.append("\(tapped.title) is a Premium lesson.")
        }
        let wished = wanted.filter { app.isWished($0) }.map(\.title)
        if !wished.isEmpty {
            parts.append("On their wish list: \(ListFormatter.localizedString(byJoining: wished)).")
        }
        return parts.joined(separator: " ")
    }
}

/// What the child wanted, above the parental check: up to three lessons in color on
/// white, each with its crown, or its star when it is on the wish list, and one
/// line under them.
private struct WantedLessons: View {
    let lessons: [Lesson]
    let caption: String

    @Environment(AppModel.self) private var app

    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                ForEach(lessons) { lesson in
                    DrawingThumbnail(tutorial: lesson.tutorial, strokeColor: nil, showsFills: true)
                        .padding(10)
                        .frame(width: 84, height: 84)
                        .background(
                            RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Theme.paper)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .strokeBorder(Theme.line, lineWidth: 2)
                        )
                        .overlay(alignment: .topTrailing) {
                            if app.isWished(lesson) {
                                WishStar(size: 26).offset(x: 8, y: -8)
                            } else {
                                CrownBadge(size: 26).offset(x: 8, y: -8)
                            }
                        }
                }
            }
            Text(caption)
                .textRole(.subhead)
                .foregroundStyle(Theme.ink55)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.top, 8)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(caption): \(lessons.map(\.title).joined(separator: ", "))")
    }
}

/// "What is seven times eight?" — two numbers from three to twelve,
/// written out: a times table any grown-up knows at a glance, and the words keep
/// it from being read off as digits by a child who cannot read them yet.
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
            question = ParentalQuestion(left: Int.random(in: 3...12), right: Int.random(in: 3...12))
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

/// The paywall written for the parent the phone was handed to, in the layout the
/// learner's paywall uses (`PaywallLayout`; Apple's rules it follows are quoted on
/// `PaywallView`): the child's
/// own drawing and the lessons on their wish list, the price first and largest,
/// "Their first 7 days are free", and the free week's dated timeline. "Continue with
/// free lessons", under the buy button, is the way out.
///
/// The buy button asks for nothing but the purchase. Once a free week has really
/// started, the "trial started" screen promises the reminder with its dates and asks
/// for notification permission there, if it never was (`TrialStartedView`).
struct GrownUpPaywallView: View {
    let entry: OfferEntry
    let onOutcome: (PremiumStore.PurchaseOutcome) -> Void
    let onContinueFree: () -> Void

    @Environment(AppModel.self) private var app

    var body: some View {
        PaywallLayout(trialLine: "Their first \(PremiumStore.trialDays) days are free",
                      isForGrownUp: true,
                      trialButtonTitle: "Start the free week",
                      onOutcome: onOutcome,
                      onContinueFree: onContinueFree) {
            Chip(text: "For grown-ups", style: .blue)
                .padding(.leading, 12)
        } art: {
            childCard
        }
        .onAppear { app.analytics.track(.offerScreenViewed("grown_up_paywall", entry: entry.analyticsName)) }
    }

    /// The child's latest drawing — their photo if they took one, else the lesson —
    /// beside what they starred for later. Straight on the page, no card around it;
    /// the wish-list tiles are the learner's paywall tiles (`PaywallArt`), white with
    /// a thin line, so they hold their shape on the white page.
    private var childCard: some View {
        HStack(spacing: 14) {
            ChildLatestDrawing()
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
                    HStack(alignment: .top, spacing: 6) {
                        ForEach(wishes) { lesson in
                            VStack(spacing: 4) {
                                DrawingThumbnail(tutorial: lesson.tutorial, strokeColor: nil, showsFills: true)
                                    .padding(6)
                                    .frame(width: 50, height: 50)
                                    .background(
                                        RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Theme.paper)
                                    )
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                                            .strokeBorder(Theme.line, lineWidth: 2)
                                    )
                                    .overlay(alignment: .topTrailing) {
                                        WishStar(size: 20).offset(x: 6, y: -6)
                                    }
                                // Two lines rather than "Mushro…".
                                Text(lesson.title)
                                    .scaledFont(12, .bold)
                                    .foregroundStyle(Theme.ink)
                                    .multilineTextAlignment(.center)
                                    .lineLimit(2)
                                    .frame(width: 72)
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("On their wish list: \(wishes.map(\.title).joined(separator: ", "))")
            }
        }
    }

    /// The lesson finished most recently.
    private var latestLesson: Lesson? {
        ChildLatestDrawing.latestLesson(in: app)
    }
}

/// The child's latest drawing — their photo if they took one, else the lesson
/// drawn in color — for the grown-up's screens. `preferredLesson` stands in for
/// the latest finished one when there is no photo (the first run's lesson).
struct ChildLatestDrawing: View {
    var preferredLesson: Lesson?

    @Environment(AppModel.self) private var app

    var body: some View {
        if let page = app.sketchbook.pages.first, let image = app.sketchbook.thumbnail(for: page) {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
                .accessibilityLabel("Their latest page")
        } else {
            DrawingThumbnail(tutorial: (preferredLesson ?? Self.latestLesson(in: app))?.tutorial,
                             strokeColor: nil,
                             showsFills: true)
                .padding(10)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Theme.surface)
                .accessibilityHidden(true)
        }
    }

    /// The lesson finished most recently.
    @MainActor
    static func latestLesson(in app: AppModel) -> Lesson? {
        app.progress.records
            .filter(\.isCompleted)
            .max { ($0.completedAt ?? .distantPast) < ($1.completedAt ?? .distantPast) }
            .flatMap { app.lesson(id: $0.lessonId) }
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

            Chip(text: "Almost there", systemImage: "clock", style: .gold)

            Text("Waiting for the App Store")
                .textRole(.title1)
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)

            Text("The App Store needs one more step before Premium starts, such as a family organizer’s approval or a payment check. When it goes through, every lesson unlocks right here. If it doesn’t, nothing is charged.")
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
