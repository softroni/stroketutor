import SwiftUI

// MARK: - More coming

/// The first screen of the offer: what else there is to draw. The lessons still
/// ahead on the path just started slide past in one looping row, so the learner
/// sees what they would be missing. The Premium ones wear their crown.
///
/// One button, "Continue", and nothing on this screen starts or sells anything. For
/// everyone 13 and over it leads to the paywall; for a child, to "This part is for a
/// grown-up" (`GrownUpHandoffView`) — the button never tells the child to go and ask
/// for Premium (see that view for why).
struct MoreComingView: View {
    let entry: OfferEntry
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
            // "Continue", not "Try for free": this button starts nothing, it only
            // leads on.
            Button("Continue", action: onContinue)
                .buttonStyle(.primary)
        }
        .onAppear { app.analytics.track(.offerScreenViewed("more_coming", entry: entry.analyticsName)) }
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

// MARK: - The free week has started

/// "Your free week has started": shown once a purchase has really begun a free week
/// (`PremiumStore.trialEndsAt` is set), from either paywall. It keeps the promise the
/// paywall's timeline made, with its real dates — "Allow notifications next, and
/// we’ll remind you on Wednesday, September 30, two days before $19.99/year starts
/// on Friday, October 2" — and it is the one place on the way to Premium that asks
/// for notification permission.
///
/// Why here: Human Interface Guidelines › Privacy
/// (https://developer.apple.com/design/human-interface-guidelines/privacy), read
/// 2026-09-25: "Request permission only when your app clearly needs access to the
/// data or resource." Before a free week has started there is nothing to remind
/// about, so nothing ahead of the paywall asks. The same page on a screen shown
/// before the system alert: "Include only one button and make it clear that it opens
/// the system alert", titled with "a term like “Continue” or “Next”", and "Don’t
/// include additional actions in your custom screen or window". So there is one
/// button and no close button, and the words say what it leads to
/// (`TrialStartedPromise`):
/// - never asked, and the reminder still to come: "Allow notifications next, and
///   we’ll remind you on …", and "Continue" — the system prompt, then the reminder
///   is scheduled if it was allowed, and the flow ends;
/// - already answered: "Start drawing" ("Back to drawing" for the grown-up, who
///   hands the phone back) — the reminder is scheduled if notifications are on, and
///   the flow ends. With them off, the screen says so and names the day the price
///   starts instead;
/// - the reminder's day already gone — a free week that ends within two days, as in
///   the App Store sandbox, where App Review and TestFlight buy and a week lasts
///   about three minutes: no reminder is promised and none is asked for, since
///   `TrialReminder.sync` would schedule nothing. The screen names the day the price
///   starts, and the button is "Start drawing".
///
/// Under it, on its own line: how to pay nothing — cancel in the phone's Settings
/// "at least a day before", not "before then". Apple
/// (https://support.apple.com/en-us/118428, read 2026-09-25): "cancel it at least 24
/// hours before the trial ends". The phone's Settings, not the app's: Paper Couch's
/// own Settings tab cannot cancel anything.
///
/// `isForGrownUp` when the week was started on the grown-up's paywall: "Their free
/// week has started", and the reminder "this device gets".
struct TrialStartedView: View {
    let entry: OfferEntry
    let isForGrownUp: Bool
    /// When the free week ends and the yearly price is billed.
    let trialEndsAt: Date
    let onFinish: () -> Void

    @Environment(AppModel.self) private var app
    /// What the learner has decided about notifications; nil until asked, for the
    /// moment it takes, so the words and the button never change under the reader.
    @State private var authorization: PracticeReminderScheduler.Authorization?
    @State private var isFinishing = false
    /// When the screen came up: the promise is worked out once, against this.
    @State private var shownAt = Date()

    var body: some View {
        OfferScreenFrame {
            Spacer(minLength: 0)

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

            Text(isForGrownUp ? "Their free week has started" : "Your free week has started")
                .textRole(.title1)
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)

            // Laid out, unseen, while the setting is read, so nothing moves when
            // the words appear.
            VStack(spacing: 10) {
                Text(dates(promise ?? .reminderIfAllowed))
                    .textRole(.bodyRegular)
                Text(howToPayNothing)
                    .textRole(.subhead)
            }
            .foregroundStyle(Theme.ink55)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .opacity(promise == nil ? 0 : 1)

            Spacer(minLength: 0)
        } footer: {
            Button(buttonTitle, action: finish)
                .buttonStyle(.primary)
                .opacity(promise == nil ? 0 : 1)
                .disabled(promise == nil || isFinishing)
        }
        .task {
            authorization = await PracticeReminderScheduler.authorization()
        }
        .onAppear { app.analytics.track(.offerScreenViewed("trial_started", entry: entry.analyticsName)) }
    }

    private var schedule: TrialSchedule { TrialSchedule(endingAt: trialEndsAt) }

    private var promise: TrialStartedPromise? {
        authorization.map { TrialStartedPromise(schedule: schedule, authorization: $0, now: shownAt) }
    }

    /// "Continue" only where it leads to the system prompt.
    private var buttonTitle: String {
        if promise?.asksForPermission == true { return "Continue" }
        return isForGrownUp ? "Back to drawing" : "Start drawing"
    }

    /// "$19.99/year", or the plan's name should the price be missing.
    private var billed: String {
        app.premium.yearlyPrice.map { "\($0)/year" } ?? "Paper Couch Premium"
    }

    /// The reminder's day and the price's, as far as each is true.
    private func dates(_ promise: TrialStartedPromise) -> String {
        let reminder = Self.longDay(schedule.reminder)
        let days = PremiumStore.reminderDaysBeforeTrialEnds
        let before = "\(Self.spelled(days)) \(days == 1 ? "day" : "days") before \(billed) starts on \(Self.longDay(schedule.end))"
        switch promise {
        case .reminderIfAllowed:
            return isForGrownUp
                ? "Allow notifications next, and this device gets a reminder on \(reminder), \(before)."
                : "Allow notifications next, and we’ll remind you on \(reminder), \(before)."
        case .reminder:
            return isForGrownUp
                ? "This device gets a reminder on \(reminder), \(before)."
                : "We’ll remind you on \(reminder), \(before)."
        case .remindersOff:
            return "Reminders are off on this device. \(billed) starts \(startsWhen)."
        case .noReminder:
            return "\(billed) starts \(startsWhen)."
        }
    }

    /// "on Friday, October 2"; "later today" or "tomorrow" for a free week about to
    /// end, as in the sandbox.
    private var startsWhen: String {
        let calendar = Calendar.current
        if calendar.isDateInToday(schedule.end) { return "later today" }
        if calendar.isDateInTomorrow(schedule.end) { return "tomorrow" }
        return "on \(Self.longDay(schedule.end))"
    }

    /// "To pay nothing, cancel in your iPhone’s Settings at least a day before it
    /// starts." The grown-up may be holding the child's phone: "this iPhone’s".
    private var howToPayNothing: String {
        "To pay nothing, cancel in \(isForGrownUp ? "this" : "your") \(DeviceName.current)’s Settings at least a day before it starts."
    }

    /// Asks for permission if it never was and a reminder is still to come (the
    /// system prompt), schedules the reminder if it is allowed, and ends the flow.
    /// Once.
    private func finish() {
        guard !isFinishing, let promise else { return }
        isFinishing = true
        Task {
            if promise.asksForPermission {
                await TrialReminder.requestAndSchedule(trialEndsAt: trialEndsAt)
            } else {
                await TrialReminder.sync(trialEndsAt: trialEndsAt)
            }
            onFinish()
        }
    }

    /// "Tuesday, September 29", in the device's own format.
    private static func longDay(_ date: Date) -> String {
        date.formatted(.dateTime.weekday(.wide).month(.wide).day())
    }

    /// "two": the sentence around it is English, so the number is too.
    private static func spelled(_ number: Int) -> String {
        spellOut.string(from: NSNumber(value: number)) ?? "\(number)"
    }

    private static let spellOut: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .spellOut
        formatter.locale = Locale(identifier: "en_US")
        return formatter
    }()
}

/// What "trial started" can promise, from the free week's dates and this device's
/// notification setting (`TrialStartedView`). A plain value, so the tests read the
/// same choice as the screen.
enum TrialStartedPromise: Equatable {
    /// The reminder is still to come and permission was never asked: "Allow
    /// notifications next", and "Continue" shows the system prompt.
    case reminderIfAllowed
    /// Notifications are allowed: the reminder is scheduled.
    case reminder
    /// Notifications are off on this device: no reminder can come.
    case remindersOff
    /// The reminder's day has already gone — a free week ending within two days, as
    /// in the App Store sandbox: no reminder, and no prompt.
    case noReminder

    init(schedule: TrialSchedule, authorization: PracticeReminderScheduler.Authorization, now: Date) {
        guard schedule.remindsAfter(now) else {
            self = .noReminder
            return
        }
        switch authorization {
        case .notDetermined: self = .reminderIfAllowed
        case .allowed: self = .reminder
        case .denied: self = .remindersOff
        }
    }

    /// Only a reminder still to come, never asked about, is worth the system prompt.
    var asksForPermission: Bool { self == .reminderIfAllowed }
}
