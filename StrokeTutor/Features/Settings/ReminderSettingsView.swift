import SwiftUI
import UIKit

/// `st-reminder` — the practice reminder: off by default, days as pills, one time,
/// and one calm notification. Permission is asked for only when it is turned on.
///
/// Off, the screen is a promise and a dimmed preview of the only note the app can
/// send. On, it is the schedule itself: seven pills, a time, and the same preview
/// live. Nothing is counted either way.
struct ReminderSettingsView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var authorization: PracticeReminderScheduler.Authorization = .notDetermined
    @State private var isRequesting = false

    var body: some View {
        let settings = app.settings
        let isOn = settings.reminderEnabled

        ScrollView {
            VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                ListCard {
                    ToggleRow(title: "Practice reminder",
                              subtitle: PracticeReminder.summary(for: settings),
                              systemImage: "bell",
                              tint: isOn ? .green : .neutral,
                              isOn: enabledBinding)
                        .disabled(isRequesting)
                }

                if authorization == .denied {
                    deniedCard
                }

                if isOn {
                    scheduleSection
                } else {
                    offSection
                }
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.top, 4)
            .padding(.bottom, 16)
        }
        .background(Theme.page)
        .settingsNavigationBar("Practice reminder")
        .task {
            authorization = await PracticeReminderScheduler.authorization()
            // What is pending should always agree with what this screen says.
            await reschedule()
        }
    }

    // MARK: - Off

    @ViewBuilder
    private var offSection: some View {
        SettingsCard {
            VStack(alignment: .leading, spacing: 8) {
                Text("A reminder is a small note, not a streak.")
                    .textRole(.title3)
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text("Nothing is counted. Skip a day, a week or a month and nothing changes: your place in each path is kept, and your sketchbook is where you left it.")
                    .textRole(.bodyRegular)
                    .foregroundStyle(Theme.ink55)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.top, 8)

        SettingsSectionHeader("All it would ever say")
        NotificationPreviewBanner(message: previewBody, when: "now", isQuiet: true)
            .opacity(0.6)
        SettingsCaption("One note, at a time you choose. Never a second one, and never a word about a day you missed.")
    }

    // MARK: - On

    @ViewBuilder
    private var scheduleSection: some View {
        SettingsSectionHeader("Days")
        WeekdayPills(selected: PracticeReminder.days(from: app.settings.reminderDays),
                     wraps: dynamicTypeSize.isAccessibilitySize,
                     toggle: toggle(day:))

        SettingsSectionHeader("Time")
        ListCard {
            SettingsCustomRow(title: "Remind me at",
                              subtitle: "Morning works best for most people. Any time is fine.") {
                EmptyView()
            } trailing: {
                DatePicker("Remind me at",
                           selection: timeBinding,
                           displayedComponents: .hourAndMinute)
                    .labelsHidden()
                    .datePickerStyle(.compact)
                    .tint(Theme.green)
            }
        }

        SettingsSectionHeader("What you’ll see")
        NotificationPreviewBanner(message: previewBody,
                                  when: PracticeReminder.timeText(app.settings.reminderTime),
                                  isQuiet: false)
        SettingsCaption("If you skip it, nothing is lost, and the next note does not mention it.")
    }

    // MARK: - Refused

    /// iOS asks once. After a refusal the app never asks again; it says so plainly
    /// and hands the learner the one place that can change it.
    private var deniedCard: some View {
        SettingsCard(isSoft: true) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Notifications are off for StrokeTutor")
                    .textRole(.headline)
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text("iOS asks only once. You can turn them on in Settings, and nothing here changes until you do.")
                    .textRole(.bodyRegular)
                    .foregroundStyle(Theme.ink55)
                    .fixedSize(horizontal: false, vertical: true)
                Button("Open Settings") {
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(url)
                    }
                }
                .buttonStyle(.quietLink)
                .accessibilityHint("Opens StrokeTutor in the Settings app.")
            }
        }
    }

    // MARK: - Bindings

    private var enabledBinding: Binding<Bool> {
        Binding(get: { app.settings.reminderEnabled },
                set: { setEnabled($0) })
    }

    private var timeBinding: Binding<Date> {
        Binding(get: { PracticeReminder.date(from: app.settings.reminderTime) },
                set: { newValue in
                    app.settings.reminderTime = PracticeReminder.string(from: newValue)
                    Task { await reschedule() }
                })
    }

    // MARK: - Changes

    private func setEnabled(_ on: Bool) {
        guard on else {
            app.settings.reminderEnabled = false
            PracticeReminderScheduler.cancelAll()
            return
        }
        isRequesting = true
        Task {
            var status = await PracticeReminderScheduler.authorization()
            if status == .notDetermined {
                status = await PracticeReminderScheduler.requestAuthorization()
            }
            authorization = status
            isRequesting = false
            guard status == .allowed else {
                // Refused: the switch goes back to off rather than promising a note
                // that can never arrive.
                app.settings.reminderEnabled = false
                return
            }
            if PracticeReminder.days(from: app.settings.reminderDays).isEmpty {
                app.settings.reminderDays = "12345"
            }
            app.settings.reminderEnabled = true
            await reschedule()
        }
    }

    /// Days are multi-select and at least one: turning the last one off turns the
    /// reminder off rather than leaving a schedule that never fires.
    private func toggle(day: Int) {
        var days = PracticeReminder.days(from: app.settings.reminderDays)
        if days.contains(day) { days.remove(day) } else { days.insert(day) }
        app.settings.reminderDays = PracticeReminder.string(from: days)
        if days.isEmpty {
            app.settings.reminderEnabled = false
            PracticeReminderScheduler.cancelAll()
        } else {
            Task { await reschedule() }
        }
    }

    private func reschedule() async {
        let settings = app.settings
        guard settings.reminderEnabled else {
            PracticeReminderScheduler.cancelAll()
            return
        }
        await PracticeReminderScheduler.reschedule(
            days: PracticeReminder.days(from: settings.reminderDays),
            time: PracticeReminder.time(from: settings.reminderTime),
            body: previewBody)
    }

    // MARK: - What the note would say

    /// The body of the note, from the path the learner is in — never the lesson
    /// title, so the note cannot spoil the drawing.
    private var previewBody: String {
        PracticeReminder.body(subject: nextSubject)
    }

    private var nextSubject: String? {
        let unfinished = app.paths.first { path in
            !path.isEmpty && app.progress.nextLesson(in: path) != nil
        }
        let path = app.currentPath.flatMap { current in
            app.progress.nextLesson(in: current) != nil ? current : nil
        } ?? unfinished
        return path.map { PracticeReminder.subject(fromPathTitle: $0.title) }
    }
}

// MARK: - The day pills

/// `#st-reminder .days`: seven soft tiles, 48 pt tall, radius 14, with a 3 pt edge —
/// green with a deeper edge when the day is chosen. At the accessibility sizes they
/// wrap to more than one row rather than shrink below the tap target.
struct WeekdayPills: View {
    let selected: Set<Int>
    var wraps: Bool = false
    let toggle: (Int) -> Void

    private let days = Array(1...7)

    var body: some View {
        if wraps {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 4),
                      spacing: 6) {
                ForEach(days, id: \.self) { pill($0) }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Days")
        } else {
            HStack(spacing: 6) {
                ForEach(days, id: \.self) { pill($0) }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Days")
        }
    }

    private func pill(_ day: Int) -> some View {
        let isOn = selected.contains(day)
        return Button {
            toggle(day)
        } label: {
            Text(PracticeReminder.initial(day))
                .scaledFont(16, .heavy)
                .foregroundStyle(isOn ? .white : Theme.ink40)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(isOn ? Theme.green : Theme.surface))
                .background(alignment: .bottom) {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(isOn ? Theme.greenDeep : Theme.surface2)
                        .frame(height: 48)
                        .offset(y: 3)
                }
                .padding(.bottom, 3)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(PracticeReminder.fullName(day))
        .accessibilityValue(isOn ? "Selected" : "Not selected")
        .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - The preview banner

/// `.banner`: the lock-screen shape of the one note the app can send. It is a
/// picture, not a control — VoiceOver reads it as a single description.
struct NotificationPreviewBanner: View {
    let message: String
    let when: String
    var isQuiet: Bool = false

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "pencil")
                .scaledFont(19, .semibold, design: .default)
                .foregroundStyle(.white)
                .frame(width: 38, height: 38)
                .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Theme.green))

            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("StrokeTutor")
                        .textRole(.footnote)
                        .foregroundStyle(Theme.ink55)
                    Spacer(minLength: 8)
                    Text(when)
                        .textRole(.footnote)
                        .foregroundStyle(Theme.ink40)
                }
                Text(PracticeReminder.title)
                    .scaledFont(16, .bold)
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 2)
                Text(message)
                    .scaledFont(15, .medium)
                    .foregroundStyle(Theme.ink55)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Theme.card))
        .overlay {
            if isQuiet {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .strokeBorder(Theme.line, lineWidth: 2)
            }
        }
        .modifier(BannerShadow(isQuiet: isQuiet))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Notification preview. \(PracticeReminder.title) \(message)")
    }
}

/// Only the live preview floats; the dimmed one is a flat outline.
private struct BannerShadow: ViewModifier {
    let isQuiet: Bool

    func body(content: Content) -> some View {
        if isQuiet { content } else { content.floatShadow() }
    }
}

#Preview("Off") {
    let model = AppModel()
    return NavigationStack { ReminderSettingsView() }
        .environment(model)
        .task { model.loadContent() }
}
