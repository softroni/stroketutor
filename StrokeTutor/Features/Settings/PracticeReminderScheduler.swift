import Foundation
import OSLog
import UserNotifications

/// Everything the app asks of `UNUserNotificationCenter`, in one place.
///
/// **Permission is requested here and nowhere else, and only from the learner's own
/// hand on the Practice reminder switch.** Apple's current guidance — Human
/// Interface Guidelines › Managing notifications
/// (<https://developer.apple.com/design/human-interface-guidelines/managing-notifications>)
/// and User Notifications › Asking permission to use notifications
/// (<https://developer.apple.com/documentation/usernotifications/asking-permission-to-use-notifications>)
/// — is that "apps must have authorization to display alerts, play sounds, or badge
/// the app's icon in response to incoming notifications", and that the request puts
/// that control in the learner's hands. iOS shows the system prompt once, so it is
/// spent on the one moment where the learner has already said what they want: the
/// screen ahead of the prompt has shown them the exact note that will be sent.
/// Nothing asks at launch, nothing asks again after a refusal, and `.badge` is never
/// requested — a number on the icon is a count, and this app counts nothing.
enum PracticeReminderScheduler {

    private static let log = Logger(subsystem: "com.softroni.StrokeTutor", category: "reminder")

    /// What the learner has already decided about notifications.
    enum Authorization {
        /// Never asked. Turning the switch on will show the system prompt.
        case notDetermined
        /// Allowed: reminders can be scheduled.
        case allowed
        /// Refused, in the prompt or later in Settings. iOS will not ask again, so
        /// the screen shows a calm line and a link into Settings instead.
        case denied
    }

    static func authorization() async -> Authorization {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        switch settings.authorizationStatus {
        case .notDetermined:
            return .notDetermined
        case .denied:
            return .denied
        case .authorized, .provisional, .ephemeral:
            return .allowed
        @unknown default:
            return .denied
        }
    }

    /// Shows the system prompt if it has never been shown, and reports what the
    /// learner chose. Alerts and sound only.
    static func requestAuthorization() async -> Authorization {
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound])
            return granted ? .allowed : .denied
        } catch {
            log.warning("Notification authorization failed: \(error.localizedDescription, privacy: .public)")
            return .denied
        }
    }

    /// Removes the seven reminder requests and adds one repeating request per
    /// selected day. Called on every change and at launch, so what is scheduled can
    /// never disagree with what the screen shows.
    static func reschedule(days: Set<Int>, time: DateComponents, body: String) async {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: PracticeReminder.allIdentifiers)
        guard !days.isEmpty else { return }

        let content = UNMutableNotificationContent()
        content.title = PracticeReminder.title
        content.body = body
        content.sound = .default
        // No badge, ever.

        for day in days.sorted() {
            var components = DateComponents()
            components.weekday = PracticeReminder.calendarWeekday(day)
            components.hour = time.hour
            components.minute = time.minute
            let request = UNNotificationRequest(
                identifier: PracticeReminder.identifier(weekday: day),
                content: content,
                trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
            )
            do {
                try await center.add(request)
            } catch {
                log.warning("Could not schedule the reminder for weekday \(day): \(error.localizedDescription, privacy: .public)")
            }
        }
    }

    /// Turning the reminder off leaves nothing pending.
    static func cancelAll() {
        UNUserNotificationCenter.current()
            .removePendingNotificationRequests(withIdentifiers: PracticeReminder.allIdentifiers)
    }
}
