import SwiftUI

/// `st-reminder` — the practice reminder: off by default, days as pills, one time,
/// and one calm notification. Permission is asked for only when it is turned on.
struct ReminderSettingsView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        @Bindable var settings = app.settings

        ScrollView {
            VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                ListCard {
                    ToggleRow(title: "Practice reminder",
                              subtitle: "One reminder, on the days you choose.",
                              systemImage: "bell",
                              tint: .neutral,
                              isOn: $settings.reminderEnabled)
                }

                Text("The days and the time are set here once this screen is built. Nothing is scheduled while the reminder is off.")
                    .textRole(.footnote)
                    .foregroundStyle(Theme.ink55)
                    .padding(.horizontal, 6)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.vertical, Theme.stackSpacing)
        }
        .background(Theme.page)
        .navigationTitle("Practice reminder")
        .navigationBarTitleDisplayMode(.inline)
    }
}
