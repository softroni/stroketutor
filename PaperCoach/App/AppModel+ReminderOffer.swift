import Foundation

/// The practice reminder, offered on a finished drawing (`ReminderOfferPolicy`),
/// and the scheduling every place that turns it on shares.
extension AppModel {

    /// The policy, filled in for this device. `notificationsDenied` comes from iOS,
    /// which answers asynchronously, so the screen asks it first.
    func reminderOfferPolicy(notificationsDenied: Bool) -> ReminderOfferPolicy {
        ReminderOfferPolicy(isAllowed: offersReminder,
                            reminderEnabled: settings.reminderEnabled,
                            notificationsDenied: notificationsDenied,
                            answer: settings.reminderOfferAnswer.flatMap(ReminderOfferAnswer.init(rawValue:)),
                            timesShown: settings.reminderOfferShownCount)
    }

    /// `lesson` was just finished: true when "Draw again tomorrow?" should show on
    /// its screen now. Never once that screen has been left. A yes is counted before
    /// it is returned — one more showing, and `reminder_offer_viewed` — so the caller
    /// must show it.
    func claimReminderOffer(after lesson: Lesson, notificationsDenied: Bool) -> Bool {
        guard cover == .completion(lessonId: lesson.id),
              reminderOfferPolicy(notificationsDenied: notificationsDenied).shouldOffer else { return false }
        settings.reminderOfferShownCount += 1
        analytics.track(.reminderOfferViewed(lessonId: lesson.id,
                                             finishedDrawings: progress.finishedDrawingCount))
        return true
    }

    /// "Remind me": asks iOS for permission if it never has, and with it turns the
    /// reminder on for every day at the time `date` shows, down to the quarter hour.
    /// Refused, nothing is turned on and the offer is not made again.
    /// `authorize` is for the tests, which must not raise iOS's prompt.
    @discardableResult
    func acceptReminderOffer(at date: Date = Date(),
                             authorize: () async -> PracticeReminderScheduler.Authorization
                                 = PracticeReminderScheduler.authorizeIfNeeded) async -> ReminderOfferAnswer {
        guard await authorize() == .allowed else {
            answerReminderOffer(.refused)
            return .refused
        }
        settings.reminderDays = PracticeReminder.string(from: ReminderOfferPolicy.days)
        settings.reminderTime = PracticeReminder.string(from: ReminderOfferPolicy.time(near: date))
        settings.reminderEnabled = true
        answerReminderOffer(.yes)
        await reschedulePracticeReminder()
        return .yes
    }

    /// "No thanks": the offer is not made again. Settings › Practice reminder stays.
    func declineReminderOffer() {
        answerReminderOffer(.no)
    }

    private func answerReminderOffer(_ answer: ReminderOfferAnswer) {
        settings.reminderOfferAnswer = answer.rawValue
        analytics.track(.reminderOfferAnswered(answer.rawValue))
    }

    // MARK: - The note

    /// What the note says (`PracticeReminder.body(subject:)`): the subject of the
    /// path the learner is in, or the first path with something left to draw, never
    /// a lesson's title, so the note cannot spoil the drawing.
    var practiceReminderBody: String {
        let unfinished = paths.first { path in
            !path.isEmpty && progress.nextLesson(in: path) != nil
        }
        let path = currentPath.flatMap { current in
            progress.nextLesson(in: current) != nil ? current : nil
        } ?? unfinished
        return PracticeReminder.body(subject: path.map { PracticeReminder.subject(fromPathTitle: $0.title) })
    }

    /// Puts what is pending in step with the stored settings: the note on each
    /// chosen day at the chosen time, or nothing while the reminder is off.
    func reschedulePracticeReminder() async {
        guard settings.reminderEnabled else {
            PracticeReminderScheduler.cancelAll()
            return
        }
        await PracticeReminderScheduler.reschedule(
            days: PracticeReminder.days(from: settings.reminderDays),
            time: PracticeReminder.time(from: settings.reminderTime),
            body: practiceReminderBody)
    }
}
