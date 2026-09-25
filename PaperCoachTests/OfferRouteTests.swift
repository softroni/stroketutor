import XCTest
@testable import PaperCoach

/// Where the way to Premium opens and goes (`OfferRoute`), and the free week's
/// dates as the paywall's timeline and "trial started" name them (`TrialSchedule`).
@MainActor
final class OfferRouteTests: XCTestCase {

    // MARK: - The first step

    func testTheFirstRunOpensOnMoreComingForEveryone() {
        XCTAssertEqual(OfferRoute.firstStep(for: .onboarding, isChild: false), .moreComing)
        XCTAssertEqual(OfferRoute.firstStep(for: .onboarding, isChild: true), .moreComing)
    }

    func testALessonOrSettingsOpensOnThePaywallForTeensAndAdults() {
        XCTAssertEqual(OfferRoute.firstStep(for: .premiumLesson(lessonId: "mushroom"), isChild: false), .paywall)
        XCTAssertEqual(OfferRoute.firstStep(for: .settings, isChild: false), .paywall)
    }

    func testALessonOrSettingsOpensOnTheWayToAGrownUpForAChild() {
        XCTAssertEqual(OfferRoute.firstStep(for: .premiumLesson(lessonId: "mushroom"), isChild: true), .grownUp)
        XCTAssertEqual(OfferRoute.firstStep(for: .settings, isChild: true), .grownUp)
    }

    // MARK: - After "More coming"

    func testMoreComingLeadsStraightToThePaywall() {
        XCTAssertEqual(OfferRoute.stepAfterMoreComing(isChild: false), .paywall)
    }

    func testMoreComingLeadsAChildToTheWayToAGrownUp() {
        XCTAssertEqual(OfferRoute.stepAfterMoreComing(isChild: true), .grownUp)
    }

    // MARK: - After a purchase

    func testAPurchaseThatStartedAFreeWeekShowsTrialStarted() {
        let end = Date(timeIntervalSince1970: 1_790_000_000)
        XCTAssertEqual(OfferRoute.stepAfterPurchase(trialEndsAt: end), .trialStarted)
    }

    func testAPurchaseWithoutAFreeWeekEndsTheFlow() {
        XCTAssertNil(OfferRoute.stepAfterPurchase(trialEndsAt: nil))
    }

    // MARK: - The free week's dates

    func testAWeekStartingTodayEndsInSevenDaysWithTheReminderTwoDaysBefore() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/New_York"))
        // Friday, September 25, 2026, 10:00 in New York.
        let start = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 9, day: 25, hour: 10)))

        let schedule = TrialSchedule(startingAt: start, calendar: calendar)

        XCTAssertEqual(calendar.dateComponents([.month, .day, .hour], from: schedule.end),
                       DateComponents(month: 10, day: 2, hour: 10))
        XCTAssertEqual(calendar.dateComponents([.month, .day, .hour], from: schedule.reminder),
                       DateComponents(month: 9, day: 30, hour: 10))
    }

    func testAStartedWeekRemindsWhenTheNotificationIsScheduled() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/New_York"))
        let end = Date(timeIntervalSince1970: 1_790_000_000)

        let schedule = TrialSchedule(endingAt: end, calendar: calendar)

        XCTAssertEqual(schedule.end, end)
        XCTAssertEqual(schedule.reminder, TrialReminder.reminderDate(trialEndsAt: end, calendar: calendar))
        XCTAssertEqual(end.timeIntervalSince(schedule.reminder),
                       Double(PremiumStore.reminderDaysBeforeTrialEnds) * 86_400,
                       "No change of clocks in these two September days")
    }

    func testTheReminderKeepsToTheCalendarDayAcrossAChangeOfClocks() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/New_York"))
        // Tuesday, March 3, 2026, 00:30 in New York. The clocks go forward on
        // Sunday, March 8, inside the free week.
        let start = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 3, day: 3, hour: 0, minute: 30)))

        let schedule = TrialSchedule(startingAt: start, calendar: calendar)

        XCTAssertEqual(calendar.dateComponents([.month, .day, .hour, .minute], from: schedule.end),
                       DateComponents(month: 3, day: 10, hour: 0, minute: 30))
        // Two calendar days before, at the same time: Sunday the 8th, not 48 hours
        // before (Saturday the 7th at 23:30).
        XCTAssertEqual(calendar.dateComponents([.month, .day, .hour, .minute], from: schedule.reminder),
                       DateComponents(month: 3, day: 8, hour: 0, minute: 30))
    }

    // MARK: - What "trial started" promises

    func testAFreeWeekJustStartedPromisesTheReminderAndAsksOnlyIfNeverAsked() {
        let now = Date(timeIntervalSince1970: 1_790_000_000)
        let schedule = TrialSchedule(startingAt: now)

        XCTAssertTrue(schedule.remindsAfter(now))
        let neverAsked = TrialStartedPromise(schedule: schedule, authorization: .notDetermined, now: now)
        XCTAssertEqual(neverAsked, .reminderIfAllowed)
        XCTAssertTrue(neverAsked.asksForPermission)
        XCTAssertEqual(TrialStartedPromise(schedule: schedule, authorization: .allowed, now: now), .reminder)
        XCTAssertEqual(TrialStartedPromise(schedule: schedule, authorization: .denied, now: now), .remindersOff)
        XCTAssertFalse(TrialStartedPromise(schedule: schedule, authorization: .allowed, now: now).asksForPermission)
        XCTAssertFalse(TrialStartedPromise(schedule: schedule, authorization: .denied, now: now).asksForPermission)
    }

    func testAFreeWeekEndingWithinTwoDaysPromisesNoReminderAndAsksForNothing() {
        let now = Date(timeIntervalSince1970: 1_790_000_000)
        // The App Store sandbox, where App Review and TestFlight buy: a week lasts
        // about three minutes.
        let sandbox = TrialSchedule(endingAt: now.addingTimeInterval(3 * 60))
        // A free week already under way: a day and a half left.
        let underWay = TrialSchedule(endingAt: now.addingTimeInterval(36 * 3600))

        for schedule in [sandbox, underWay] {
            XCTAssertFalse(schedule.remindsAfter(now))
            for authorization in [PracticeReminderScheduler.Authorization.notDetermined, .allowed, .denied] {
                let promise = TrialStartedPromise(schedule: schedule, authorization: authorization, now: now)
                XCTAssertEqual(promise, .noReminder)
                XCTAssertFalse(promise.asksForPermission)
            }
        }
    }

    func testAReminderAMinuteAheadIsStillPromised() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/New_York"))
        let now = Date(timeIntervalSince1970: 1_790_000_000)
        let reminder = now.addingTimeInterval(60)
        let end = try XCTUnwrap(calendar.date(byAdding: .day, value: PremiumStore.reminderDaysBeforeTrialEnds, to: reminder))

        let schedule = TrialSchedule(endingAt: end, calendar: calendar)

        XCTAssertEqual(schedule.reminder, reminder)
        XCTAssertTrue(schedule.remindsAfter(now))
        XCTAssertEqual(TrialStartedPromise(schedule: schedule, authorization: .notDetermined, now: now), .reminderIfAllowed)
    }
}
