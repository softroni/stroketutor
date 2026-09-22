import SwiftUI

/// `st-voice` — narration and voice. The sample leads the screen so a learner can
/// see what is being switched before switching it, then the one toggle, the promise
/// that the written instruction never goes away, and the two things people worry
/// about: their music and the ringer switch. The drawing speed lives on the main
/// Settings screen: it never touches the voice, so it does not belong beside it.
struct NarrationSettingsView: View {
    @Environment(AppModel.self) private var app
    @State private var narration = NarrationPlayer()
    @State private var isPlayingSample = false
    @State private var sampleTask: Task<Void, Never>?

    var body: some View {
        @Bindable var preferences = app.preferences
        let isOn = preferences.narrationEnabled

        ScrollView {
            VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                if let sample {
                    sampleCard(sample, isOn: isOn)
                    // With her hello recorded, Play plays it. Without it the screen
                    // must not imply otherwise: the button then only shows the chip
                    // moving, and says so.
                    SettingsCaption(sample.isRecorded
                                    ? "Play plays Lina's own recording, the voice a lesson speaks in. Every instruction is written as well, so nothing here is only a sound."
                                    : "No recordings ship with this build. Play shows how the chip moves while Lina speaks. The words above are the real first step of the first lesson in your path.")
                }

                ListCard {
                    ToggleRow(title: "Narration",
                              subtitle: "Lina reads each step aloud while it draws.",
                              systemImage: isOn ? "speaker.wave.2.fill" : "speaker.slash.fill",
                              tint: isOn ? .green : .neutral,
                              isOn: $preferences.narrationEnabled)
                }

                if isOn {
                    SettingsCard(isSoft: true) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("The words stay on screen")
                                .textRole(.headline)
                                .foregroundStyle(Theme.ink)
                                .fixedSize(horizontal: false, vertical: true)
                            Text("Every instruction is written as well as spoken. Turn Lina off and nothing else changes.")
                                .textRole(.bodyRegular)
                                .foregroundStyle(Theme.ink55)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }

                    SettingsSectionHeader("While a lesson plays")
                    ListCard {
                        SettingsRow(title: "Other audio",
                                    subtitle: "Music keeps playing, turned down while Lina speaks.",
                                    value: "Lowered",
                                    systemImage: "speaker.wave.2.fill",
                                    tint: .neutral)
                        RowDivider()
                        SettingsRow(title: "Silent switch",
                                    subtitle: "Lina plays even when your iPhone is on silent. The volume buttons still apply.",
                                    value: "Plays",
                                    systemImage: "speaker.slash.fill",
                                    tint: .neutral)
                    }
                } else {
                    SettingsCard(isSoft: true) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Nothing is lost")
                                .textRole(.headline)
                                .foregroundStyle(Theme.ink)
                                .fixedSize(horizontal: false, vertical: true)
                            Text("Every lesson works in silence. The written instruction stays on screen; the step, the drawing and the pace are the same.")
                                .textRole(.bodyRegular)
                                .foregroundStyle(Theme.ink55)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    SettingsCaption("You can also turn Lina back on from inside a lesson. The chip in the player is a button, and both places write the same setting.")
                }
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.top, 4)
            .padding(.bottom, 16)
        }
        .background(Theme.page)
        .settingsNavigationBar("Narration & voice")
        .onChange(of: isOn) { _, newValue in
            if !newValue { stopSample() }
        }
        .onDisappear {
            stopSample()
            narration.deactivate()
        }
    }

    // MARK: - The sample

    /// `.card.sample`: Lina at 48 pt, the clay play button, the line she would read,
    /// and the same chip the player shows while she speaks.
    private func sampleCard(_ sample: Sample, isOn: Bool) -> some View {
        SettingsCard {
            VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                HStack(spacing: 14) {
                    LinaFace(size: 48)
                        .grayscale(isOn ? 0 : 1)
                        .opacity(isOn ? 1 : 0.6)

                    VStack(alignment: .leading, spacing: 4) {
                        // `.t-eyebrow` is uppercased by the stylesheet, not by the copy.
                        Text("Your tutor".uppercased())
                            .textRole(.eyebrow)
                            .foregroundStyle(isOn ? Theme.clay : Theme.ink40)
                        Text("Lina")
                            .textRole(.title3)
                            .foregroundStyle(isOn ? Theme.ink : Theme.ink40)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    Button {
                        playSample()
                    } label: {
                        Image(systemName: "play.fill")
                            .scaledFont(22, .bold, design: .default)
                    }
                    .buttonStyle(SamplePlayButtonStyle(isEnabled: isOn))
                    .disabled(!isOn)
                    .accessibilityLabel("Play a sample")
                }

                // A real instruction, not invented copy — and a long one is cut
                // rather than allowed to push the card off the screen. The card is
                // a sample of the voice, not the lesson.
                Text("“\(sample.line)”")
                    .textRole(.title3)
                    .lineSpacing(2)
                    .lineLimit(3)
                    .truncationMode(.tail)
                    .foregroundStyle(isOn ? Theme.ink : Theme.ink40)
                    .frame(maxWidth: .infinity, alignment: .leading)

                HStack(spacing: 12) {
                    // Off, the chip is the way back on — the same gesture as the
                    // chip in the player — so the switch is never the only route.
                    NarrationChip(state: isOn ? .speaking : .muted,
                                  label: isOn ? (isSpeakingSample ? "Speaking" : "Sample") : "Off") {
                        if isOn {
                            playSample()
                        } else {
                            app.preferences.narrationEnabled = true
                        }
                    }
                    .accessibilityLabel(chipLabel(isOn: isOn))
                    .accessibilityHint(isOn ? "Plays the sample." : "Turns Lina back on.")

                    Spacer(minLength: 8)

                    Text(sample.caption)
                        .textRole(.footnote)
                        .foregroundStyle(Theme.ink40)
                }
            }
        }
    }

    private func chipLabel(isOn: Bool) -> String {
        guard isOn else { return "Narration off" }
        return isSpeakingSample ? "Speaking" : "Sample"
    }

    /// Plays her hello. Without a recording the chip moves for about three seconds
    /// instead, as it would while a line plays.
    private func playSample() {
        sampleTask?.cancel()
        sampleTask = nil
        if sample?.isRecorded == true {
            narration.playAppLine("hello")
            return
        }
        isPlayingSample = true
        sampleTask = Task {
            try? await Task.sleep(for: .seconds(3.2))
            guard !Task.isCancelled else { return }
            isPlayingSample = false
        }
    }

    private func stopSample() {
        sampleTask?.cancel()
        sampleTask = nil
        isPlayingSample = false
        narration.stop()
    }

    /// What the chip's word and its VoiceOver label report: the recording's own
    /// state when there is one.
    private var isSpeakingSample: Bool {
        sample?.isRecorded == true ? narration.isSpeaking : isPlayingSample
    }

    // MARK: - Speed

    /// `.list-row--stack`: the label line, then the segmented control under it.
    // MARK: - Where the sample comes from

    /// Nothing on this screen is invented copy. The line is Lina's own recorded
    /// hello when that shipped — the same one the onboarding beat plays — and
    /// otherwise the first step of the first lesson of the path the learner is in,
    /// which is what she would read.
    private struct Sample {
        let line: String
        let caption: String
        /// True when there is a file behind the words and Play really plays it.
        let isRecorded: Bool
    }

    private var sample: Sample? {
        if narration.hasAppLine("hello"), let hello = narration.appLineText("hello") {
            return Sample(line: hello, caption: "Lina's hello", isRecorded: true)
        }
        let lesson = app.currentPath?.lessons.first ?? app.paths.first(where: { !$0.isEmpty })?.lessons.first
        guard let lesson, let step = lesson.tutorial.steps.first else { return nil }
        return Sample(line: step.instruction, caption: "\(lesson.title) · Step 1", isRecorded: false)
    }
}

// MARK: - The play button

/// `#st-voice .sample .play`: a 56 pt round button in clay, with a 2 pt clay-soft
/// ring and the 4 pt clay-soft edge that presses down. Disabled it goes to ink 25 %
/// on the plain line colour, as the greyed sample does.
struct SamplePlayButtonStyle: ButtonStyle {
    var isEnabled: Bool = true

    func makeBody(configuration: Configuration) -> some View {
        let tint = isEnabled ? Theme.clay : Theme.ink25
        let edge = isEnabled ? Theme.claySoft : Theme.line
        return configuration.label
            .foregroundStyle(tint)
            .frame(width: 56, height: 56)
            .background(Circle().fill(Theme.card))
            .overlay(Circle().strokeBorder(edge, lineWidth: 2))
            .background(alignment: .bottom) {
                Circle()
                    .fill(edge)
                    .frame(width: 56, height: 56)
                    .offset(y: configuration.isPressed ? 0 : 4)
            }
            .offset(y: configuration.isPressed ? 4 : 0)
            .padding(.bottom, 4)
            .contentShape(Circle())
            .animation(.easeOut(duration: 0.08), value: configuration.isPressed)
    }
}

#Preview {
    let model = AppModel()
    return NavigationStack { NarrationSettingsView() }
        .environment(model)
        .task { model.loadContent() }
}
