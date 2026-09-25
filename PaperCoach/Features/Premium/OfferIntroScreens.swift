import SwiftUI

// MARK: - More coming

/// The first screen of the offer: what else there is to draw. The lessons still
/// ahead on the path just started slide past in one looping row, so the learner
/// sees what they would be missing. The Premium ones wear their crown.
///
/// One button. For a child it asks for a grown-up; for everyone else it leads to
/// the free week, or straight to the paywall when the free week has been used.
struct MoreComingView: View {
    let onContinue: () -> Void

    @Environment(AppModel.self) private var app

    var body: some View {
        OfferScreenFrame {
            Spacer(minLength: 0)

            VStack(alignment: .leading, spacing: 12) {
                if let path, !upcoming.isEmpty {
                    Chip(text: "\(path.title) · \(upcoming.count) more to draw",
                         systemImage: path.onboardingSymbol,
                         style: .green)
                }
                Text(headline)
                    .textRole(.title1)
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                Text(bodyText)
                    .textRole(.bodyRegular)
                    .foregroundStyle(Theme.ink55)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack(spacing: 14) {
                LessonMarquee(lessons: marqueeLessons)
                if otherPathLessons.count >= 4 {
                    // The other paths drift the other way, smaller: there is more
                    // beyond this path.
                    LessonMarquee(lessons: otherPathLessons, style: .compact, reversed: true)
                }
            }
            // Edge to edge: the rows run off both sides of the screen.
            .padding(.horizontal, -Theme.gutter)
            .padding(.top, 10)

            Spacer(minLength: 0)
        } footer: {
            Button(buttonTitle, action: onContinue)
                .buttonStyle(.primary)
        }
        .onAppear { app.analytics.track(.offerScreenViewed("more_coming", entry: OfferEntry.onboarding.analyticsName)) }
    }

    private var lesson: Lesson? { app.firstRunLesson }

    private var path: PathModel? {
        lesson.flatMap { app.path(id: $0.pathId) } ?? app.currentPath
    }

    /// The lessons of the path not yet drawn, in order.
    private var upcoming: [Lesson] {
        guard let path else { return [] }
        return path.lessons.filter { !app.progress.isCompleted($0.id) }
    }

    /// The path's own lessons, topped up with the first lessons of other paths when
    /// there are only a few, so the row always has something to slide.
    private var marqueeLessons: [Lesson] {
        var lessons = upcoming
        if lessons.count < 5 {
            let others = app.paths.filter { $0.id != path?.id }.compactMap(\.lessons.first)
            lessons += others.prefix(6 - lessons.count)
        }
        return lessons
    }

    /// The first lesson of every other path not already in the top row.
    private var otherPathLessons: [Lesson] {
        let shown = Set(marqueeLessons.map(\.id))
        return app.paths.filter { $0.id != path?.id }
            .compactMap(\.lessons.first)
            .filter { !shown.contains($0.id) }
    }

    /// "Your pine tree was just the start."
    private var headline: String {
        guard let lesson else { return "Your first drawing was just the start." }
        return "Your \(lesson.subject) was just the start."
    }

    /// "Coming up: Tulip, Cactus and Mushroom. And there are 9 more paths after Plants."
    private var bodyText: String {
        let names = upcoming.prefix(3).map(\.title)
        var parts: [String] = []
        if !names.isEmpty {
            parts.append("Coming up: \(ListFormatter.localizedString(byJoining: names)).")
        }
        let otherPaths = app.paths.filter { !$0.isEmpty && $0.id != path?.id }.count
        if otherPaths > 0, let path {
            parts.append("And there \(otherPaths == 1 ? "is 1 more path" : "are \(otherPaths) more paths") after \(path.title).")
        }
        return parts.isEmpty ? "There is so much more to draw." : parts.joined(separator: " ")
    }

    private var buttonTitle: String {
        // "Continue", not "Try for free": this button starts nothing, it only leads
        // on to the free week (or the paywall).
        return app.learnerIsChild ? "Ask a grown-up" : "Continue"
    }
}

/// Lesson cards sliding past in one endless row. The row is drawn twice, end to
/// end, and moved by the time that has passed, so it wraps without a seam.
/// With Reduce Motion it holds still and can be scrolled by hand instead.
///
/// `.full` cards carry the title and the lesson's place on its path; `.compact`
/// ones are the drawing alone. One VoiceOver element: the lessons, named in order.
struct LessonMarquee: View {
    enum Style { case full, compact }

    let lessons: [Lesson]
    var style: Style = .full
    /// Slides left to right instead.
    var reversed = false

    @Environment(AppModel.self) private var app
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var startedAt = Date()

    private var cardWidth: CGFloat { style == .full ? 150 : 104 }
    private var height: CGFloat { style == .full ? 226 : 104 }
    private var spacing: CGFloat { style == .full ? 14 : 12 }
    /// Points per second: slow enough to read a name as it passes.
    private let speed: CGFloat = 26

    var body: some View {
        Group {
            if reduceMotion || lessons.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    row(lessons)
                        .padding(.horizontal, Theme.gutter)
                }
            } else {
                // The doubled row is far wider than the screen. Drawn in an
                // overlay, its width never reaches the layout around it.
                Color.clear
                    .overlay(alignment: .leading) {
                        TimelineView(.animation) { context in
                            row(lessons + lessons)
                                .offset(x: offset(at: context.date))
                        }
                    }
                    .clipped()
            }
        }
        .frame(height: height)
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(style == .full
            ? "Coming up: \(lessons.map(\.title).joined(separator: ", "))"
            : "More paths: \(lessons.compactMap { app.path(id: $0.pathId)?.title }.joined(separator: ", "))")
    }

    private func offset(at date: Date) -> CGFloat {
        let cycle = CGFloat(lessons.count) * (cardWidth + spacing)
        guard cycle > 0 else { return 0 }
        let travelled = (CGFloat(date.timeIntervalSince(startedAt)) * speed)
            .truncatingRemainder(dividingBy: cycle)
        return reversed ? travelled - cycle : -travelled
    }

    private func row(_ items: [Lesson]) -> some View {
        HStack(spacing: spacing) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, lesson in
                switch style {
                case .full: card(lesson)
                case .compact: tile(lesson)
                }
            }
        }
        .fixedSize()
    }

    private func card(_ lesson: Lesson) -> some View {
        let shape = RoundedRectangle(cornerRadius: 20, style: .continuous)
        let path = app.path(id: lesson.pathId)
        let position = path?.position(of: lesson.id)
        return VStack(alignment: .leading, spacing: 10) {
            DrawingThumbnail(tutorial: lesson.tutorial, strokeColor: nil, showsFills: true)
                .padding(14)
                .frame(maxWidth: .infinity)
                .frame(height: 130)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Theme.paper)
                )
                .overlay(alignment: .bottomTrailing) {
                    if app.needsPremium(lesson) {
                        CrownBadge(size: 26).padding(6)
                    }
                }
            VStack(alignment: .leading, spacing: 2) {
                Text(lesson.title)
                    .scaledFont(16, .heavy)
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                if let path, let position {
                    Text("Lesson \(position) of \(path.lessonCount)")
                        .scaledFont(12, .semibold)
                        .foregroundStyle(Theme.ink55)
                        .lineLimit(1)
                }
            }
        }
        .padding(10)
        .frame(width: cardWidth)
        .background(shape.fill(path.map { app.tint(for: $0).soft } ?? Theme.surface))
        .overlay(shape.strokeBorder(Theme.line, lineWidth: 2))
    }

    private func tile(_ lesson: Lesson) -> some View {
        let shape = RoundedRectangle(cornerRadius: 18, style: .continuous)
        let path = app.path(id: lesson.pathId)
        return DrawingThumbnail(tutorial: lesson.tutorial, strokeColor: nil, showsFills: true)
            .padding(16)
            .frame(width: cardWidth, height: cardWidth)
            .background(shape.fill(path.map { app.tint(for: $0).soft } ?? Theme.surface))
            .overlay(shape.strokeBorder(Theme.line, lineWidth: 2))
    }
}

// MARK: - The free week

/// "Your first week is on us." One message: seven days, nothing to pay today.
struct FreeWeekView: View {
    let onContinue: () -> Void

    @Environment(AppModel.self) private var app

    var body: some View {
        OfferScreenFrame {
            Spacer(minLength: 0)

            VStack(spacing: 0) {
                Text("\(PremiumStore.trialDays)")
                    .font(.system(size: 96, weight: .heavy, design: .rounded))
                    .foregroundStyle(Theme.greenDeep)
                Text("days free")
                    .scaledFont(18, .heavy)
                    .foregroundStyle(Theme.greenDeep)
                    .padding(.top, -8)
            }
            .frame(width: 208, height: 208)
            .background(Circle().fill(Theme.greenSoft))
            .accessibilityElement(children: .combine)

            Text("Your first week is on us.")
                .textRole(.title1)
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)

            Text(detail)
                .textRole(.bodyRegular)
                .foregroundStyle(Theme.ink55)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            OfferBenefits()
                .padding(16)
                .background(
                    RoundedRectangle(cornerRadius: Theme.cardCornerRadius, style: .continuous)
                        .fill(Theme.surface)
                )

            Spacer(minLength: 0)
        } footer: {
            Button("Continue", action: onContinue)
                .buttonStyle(.primary)
        }
        .onAppear { app.analytics.track(.offerScreenViewed("free_week", entry: OfferEntry.onboarding.analyticsName)) }
    }

    /// The free week and what it turns into, together: a trial is never named
    /// without the price billed after it. `OfferFlow` only shows this screen when
    /// that price is known (`PremiumStore.canNameFreeWeek`).
    private var detail: String {
        let days = PremiumStore.trialDays
        guard let price = app.premium.yearlyPrice else {
            return "Draw anything, on every path, for \(days) days."
        }
        return "Draw anything, on every path, for \(days) days. Then \(price)/year, unless you cancel before the week ends. You won’t pay anything today."
    }
}

// MARK: - The reminder promise

/// "You'll get a reminder 2 days before your trial ends." Lina with a bell, and the
/// one tap that also asks for notification permission — the moment the learner
/// can see why it is asked. Whatever they answer, the paywall comes next.
struct TrialReminderPromiseView: View {
    let onContinue: () -> Void

    @Environment(AppModel.self) private var app
    @State private var isAsking = false

    var body: some View {
        OfferScreenFrame {
            Spacer(minLength: 0)

            (Text("You’ll get a reminder ")
             + Text("\(PremiumStore.reminderDaysBeforeTrialEnds) days").foregroundStyle(Theme.green)
             + Text(" before your trial ends."))
                .textRole(.title1)
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)

            LinaView(pose: .wave, size: 190)
                .overlay(alignment: .topTrailing) {
                    Image(systemName: "bell.fill")
                        .font(.system(size: 30, weight: .bold))
                        .foregroundStyle(Theme.gold)
                        .frame(width: 64, height: 64)
                        .background(Circle().fill(Theme.goldSoft))
                        .overlay(Circle().strokeBorder(Theme.paper, lineWidth: 4))
                        .offset(x: 30, y: 6)
                        .accessibilityHidden(true)
                }
                .padding(.top, 12)

            Spacer(minLength: 0)
        } footer: {
            // A neutral "Continue": this tap asks for notification permission, and
            // Apple wants the button before a permission request to lead on, not to
            // promise something (App Review Guidelines 5.1.1(iv)).
            Button("Continue") {
                guard !isAsking else { return }
                isAsking = true
                Task {
                    if await PracticeReminderScheduler.authorization() == .notDetermined {
                        _ = await PracticeReminderScheduler.requestAuthorization()
                    }
                    isAsking = false
                    onContinue()
                }
            }
            .buttonStyle(.primary)
        }
        .onAppear { app.analytics.track(.offerScreenViewed("reminder", entry: OfferEntry.onboarding.analyticsName)) }
    }
}
