import SwiftUI

/// `st-voice` — narration and voice: the toggle, the speed control and a sample of
/// Lina's line. The speed here is the speed a lesson starts at.
struct NarrationSettingsView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        @Bindable var settings = app.settings

        ScrollView {
            VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                ListCard {
                    ToggleRow(title: "Narration",
                              subtitle: "Lina reads each step aloud.",
                              systemImage: "speaker.wave.2",
                              tint: .green,
                              isOn: $settings.narrationEnabled)
                }

                Text("Speed".uppercased())
                    .textRole(.eyebrow)
                    .foregroundStyle(Theme.ink55)
                    .padding(.horizontal, 6)

                SegmentedPicker(options: PlayerViewModel.speedOptions,
                                title: { $0 == 1 ? "1×" : String(format: "%g×", $0) },
                                selection: $settings.defaultSpeed)

                Text("A lesson starts at this speed. You can change it while you draw.")
                    .textRole(.footnote)
                    .foregroundStyle(Theme.ink55)
                    .padding(.horizontal, 6)
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.vertical, Theme.stackSpacing)
        }
        .background(Theme.page)
        .navigationTitle("Narration & voice")
        .navigationBarTitleDisplayMode(.inline)
    }
}
