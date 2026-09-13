import SwiftUI

/// `st-settings` — the third tab: narration and speed, the sketchbook's one option,
/// accessibility, the reminder, About and Privacy, and the single destructive row.
/// No account, nothing to manage, nothing that creates an obligation.
///
/// Four white list cards with 2 pt borders, each opened by a 40 pt tinted icon tile
/// so the list scans by colour, then the one destructive row alone on its own card
/// and the version line under it.
struct SettingsView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var isConfirmingReset = false
    @State private var isConfirmingOnboardingReset = false

    var body: some View {
        @Bindable var settings = app.settings

        ScrollView {
            VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                Text("Settings")
                    .textRole(.largeTitle)
                    .foregroundStyle(Theme.ink)
                    .accessibilityAddTraits(.isHeader)

                // ---------------------------------------------------------- Lesson
                SettingsSectionHeader("Lesson")
                ListCard {
                    // One row for the tutor: her portrait, whether she speaks, and
                    // the way to the voice screen. Narration and "Lina's voice" used
                    // to be two rows that opened the same screen.
                    Button {
                        app.push(.narrationSettings)
                    } label: {
                        SettingsCustomRow(title: "Lina’s voice") {
                            // Her portrait sits in the tile at 30 pt, as `.leading .face` does.
                            SettingsIconTile(tint: .clay) { LinaFace(size: 30) }
                        } trailing: {
                            HStack(spacing: 14) {
                                Text(settings.narrationEnabled ? "On" : "Off")
                                    .scaledFont(16, .semibold)
                                    .foregroundStyle(Theme.ink55)
                                chevron
                            }
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .combine)
                    .accessibilityAddTraits(.isButton)
                    .accessibilityValue(settings.narrationEnabled ? "On" : "Off")
                    RowDivider()
                    speedRow
                }

                // ------------------------------------------------------ Sketchbook
                SettingsSectionHeader("Sketchbook")
                ListCard {
                    ToggleRow(title: "Also save to Photos",
                              subtitle: "Your sketchbook keeps its own copy either way.",
                              systemImage: "photo",
                              tint: .gold,
                              isOn: $settings.alsoSaveToPhotos)
                }

                // --------------------------------------------------- Accessibility
                SettingsSectionHeader("Accessibility")
                ListCard {
                    SettingsRow(title: "Text size",
                                subtitle: "Follows the size set on your iPhone.",
                                value: SettingsFormat.textSize(dynamicTypeSize),
                                systemImage: "eye",
                                tint: .blue)
                    RowDivider()
                    ToggleRow(title: "Reduce motion",
                              subtitle: "Steps appear at once instead of drawing on.",
                              systemImage: "arrow.counterclockwise",
                              tint: .blue,
                              isOn: $settings.reduceMotionOverride)
                    RowDivider()
                    ToggleRow(title: "Left-handed layout",
                              subtitle: "Moves the controls to the left.",
                              systemImage: "hand.raised",
                              tint: .blue,
                              isOn: $settings.leftHanded)
                }

                // ------------------------------------------------------------ More
                SettingsSectionHeader("More")
                ListCard {
                    SettingsRow(title: "Practice reminder",
                                value: reminderValue,
                                systemImage: "bell",
                                tint: .neutral) { app.push(.reminderSettings) }
                    RowDivider()
                    SettingsRow(title: "About & credits",
                                systemImage: "info.circle",
                                tint: .neutral) { app.push(.about) }
                    RowDivider()
                    // Presents a cover rather than pushing, so no chevron.
                    Button {
                        isConfirmingOnboardingReset = true
                    } label: {
                        SettingsCustomRow(title: "Reset onboarding",
                                          subtitle: "See the introduction again from the start.") {
                            SettingsIconTile(symbol: "arrow.clockwise", tint: .neutral)
                        } trailing: {
                            EmptyView()
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .combine)
                    .accessibilityAddTraits(.isButton)
                    RowDivider()
                    // Privacy is the same screen scrolled to its privacy section, so
                    // the two rows can never drift apart. It is a destination link
                    // rather than an `AppRoute` because a route carries no argument.
                    NavigationLink {
                        AboutView(opensAt: .privacy)
                    } label: {
                        SettingsCustomRow(title: "Privacy",
                                          subtitle: "Everything stays on this iPhone.") {
                            SettingsIconTile(symbol: "lock.fill", tint: .neutral)
                        } trailing: {
                            chevron
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .combine)
                    .accessibilityAddTraits(.isButton)
                }

                // ------------------------------------------------- Reset progress
                ListCard {
                    Button {
                        isConfirmingReset = true
                    } label: {
                        Text("Reset progress")
                            .textRole(.headline)
                            .foregroundStyle(Theme.danger)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .padding(.horizontal, 18)
                            .frame(minHeight: Theme.minimumTapTarget)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Clears how far you are through every path. Your sketchbook is kept.")
                }
                .padding(.top, 8)

                Text(SettingsFormat.versionLine())
                    .textRole(.footnote)
                    .foregroundStyle(Theme.ink40)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 10)
                    .padding(.bottom, 4)
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.top, 6)
            .padding(.bottom, 16)
        }
        .background(Theme.page)
        .toolbar(.hidden, for: .navigationBar)
        .alert("Reset your progress?", isPresented: $isConfirmingReset) {
            Button("Reset progress", role: .destructive) { app.progress.resetAll() }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("Every path starts again from lesson 1. Your sketchbook is not touched.")
        }
        .alert("Reset onboarding?", isPresented: $isConfirmingOnboardingReset) {
            Button("Reset onboarding") { app.resetOnboarding() }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("The introduction plays again from the start. Your progress and sketchbook are kept.")
        }
    }

    /// `.chevron`: 20 pt at 25 % ink, only on a row that pushes.
    private var chevron: some View {
        Image(systemName: "chevron.right")
            .scaledFont(14, .bold, design: .default)
            .foregroundStyle(Theme.ink25)
    }

    /// "Off", or the schedule in words — never a raw date.
    private var reminderValue: String {
        PracticeReminder.summary(for: app.settings)
    }
}

#Preview {
    let model = AppModel()
    return NavigationStack {
        SettingsView()
    }
    .environment(model)
    .task { model.loadContent() }
}


// MARK: - Speed

private extension SettingsView {
    /// The speed a lesson starts at, set right here rather than on the voice screen:
    /// it is how fast each step draws, and it never changes Lina's voice, so a
    /// learner who came to change it should not have to pass her card to find it.
    var speedRow: some View {
        @Bindable var settings = app.settings
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 14) {
                SettingsIconTile(symbol: "speedometer", tint: .green)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Speed")
                        .textRole(.headline)
                        .foregroundStyle(Theme.ink)
                    Text("How fast each step draws. You can change it while you draw.")
                        .textRole(.footnote)
                        .foregroundStyle(Theme.ink55)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            SegmentedPicker(options: PlayerViewModel.speedOptions,
                            title: SettingsFormat.speed,
                            selection: $settings.defaultSpeed)
                .accessibilityLabel("Speed")
        }
        .padding(.vertical, 14)
        .padding(.horizontal, 18)
    }
}
