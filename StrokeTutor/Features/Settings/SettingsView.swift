import SwiftUI

/// `st-settings` — the third tab: narration and speed, the sketchbook's one option,
/// accessibility, the reminder, About and Privacy, and the single destructive row.
/// No account, nothing to manage, nothing that creates an obligation.
struct SettingsView: View {
    @Environment(AppModel.self) private var app
    @State private var isConfirmingReset = false

    var body: some View {
        @Bindable var settings = app.settings

        ScrollView {
            VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                Text("Settings")
                    .textRole(.largeTitle)
                    .foregroundStyle(Theme.ink)

                sectionHeader("Lesson")
                ListCard {
                    SettingsRow(title: "Narration",
                                value: settings.narrationEnabled ? "On" : "Off",
                                systemImage: "speaker.wave.2",
                                tint: .green) { app.push(.narrationSettings) }
                    RowDivider()
                    SettingsRow(title: "Speed",
                                value: speedLabel,
                                systemImage: "gauge.with.dots.needle.50percent",
                                tint: .green) { app.push(.narrationSettings) }
                }

                sectionHeader("Sketchbook")
                ListCard {
                    ToggleRow(title: "Also save to Photos",
                              subtitle: "Your sketchbook keeps its own copy either way.",
                              systemImage: "photo",
                              tint: .gold,
                              isOn: $settings.alsoSaveToPhotos)
                }

                sectionHeader("More")
                ListCard {
                    SettingsRow(title: "Practice reminder",
                                value: settings.reminderEnabled ? settings.reminderTime : "Off",
                                systemImage: "bell",
                                tint: .neutral) { app.push(.reminderSettings) }
                    RowDivider()
                    SettingsRow(title: "About & credits",
                                systemImage: "info.circle",
                                tint: .neutral) { app.push(.about) }
                }

                ListCard {
                    Button {
                        isConfirmingReset = true
                    } label: {
                        Text("Reset progress")
                            .textRole(.headline)
                            .foregroundStyle(Theme.danger)
                            .frame(maxWidth: .infinity)
                            .frame(minHeight: Theme.minimumTapTarget)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.top, 8)

                Text(Self.versionString)
                    .textRole(.footnote)
                    .foregroundStyle(Theme.ink40)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.top, 6)
            .padding(.bottom, 16)
        }
        .background(Theme.page)
        .toolbar(.hidden, for: .navigationBar)
        .confirmationDialog("Reset progress?",
                            isPresented: $isConfirmingReset,
                            titleVisibility: .visible) {
            Button("Reset progress", role: .destructive) { app.progress.resetAll() }
            Button("Keep it", role: .cancel) { }
        } message: {
            Text("Clears lesson progress. Sketchbook photos are kept.")
        }
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title.uppercased())
            .textRole(.eyebrow)
            .foregroundStyle(Theme.ink55)
            .padding(.horizontal, 6)
            .padding(.top, 10)
    }

    private var speedLabel: String {
        let speed = app.settings.defaultSpeed
        return speed == 1 ? "1×" : String(format: "%g×", speed)
    }

    /// Read from the bundle, never hardcoded.
    private static var versionString: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = info?["CFBundleVersion"] as? String ?? "1"
        return "StrokeTutor \(short) (\(build))"
    }
}
