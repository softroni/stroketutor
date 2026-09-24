import SwiftUI

/// `ob-voice` — "Meet the voice". Lina introduces the narration and hands over the
/// switch before anything has played on its own. One decision, one sample, and the
/// sample only when the learner asks for it.
///
/// The switch writes `narrationEnabled` at once: there is no Save here, and Continue
/// commits nothing.
///
/// The sample is Lina's own `hello` line from `Voice/app/`, played when the learner
/// asks for it. When that recording was not published — the app builds perfectly
/// well without it — the card keeps the honest fallback it had before any audio
/// shipped: the words she would say, her chip moving for three seconds, and a line
/// saying the recordings are not here yet. The written instruction is the channel
/// that always works, which is the point this beat is making anyway.
struct OnboardingVoiceBeat: View {

    @Binding var narrationEnabled: Bool
    let rail: OnboardingRail
    let onContinue: () -> Void

    @State private var narration = NarrationPlayer()
    @State private var isPlayingSample = false
    @State private var playCount = 0

    /// Lina's recorded hello, or nil when it was not published.
    private var recordedLine: String? {
        narration.hasAppLine("hello") ? narration.appLineText("hello") : nil
    }

    /// What the card quotes: her own words when they were recorded, otherwise a
    /// step's written instruction, verbatim — audio is a second channel, never the
    /// only one.
    private var sampleLine: String {
        recordedLine ?? "Draw one square in the middle of the page. This is the front wall."
    }

    var body: some View {
        OnboardingBeatFrame(rail: rail) {
            TutorSays(pose: .wave,
                      text: "I'll talk you through each step while it draws. You can turn my voice off any time.")

            switchCard
            sampleCard
        } footer: {
            Button("Continue", action: onContinue)
                .buttonStyle(.primary)
        }
        .task(id: playCount) {
            // Only the written sample needs a timer; a recording ends when it ends.
            guard playCount > 0, recordedLine == nil else { return }
            try? await Task.sleep(for: .seconds(3))
            guard !Task.isCancelled else { return }
            isPlayingSample = false
        }
        .onChange(of: narrationEnabled) { _, isOn in
            // Turning her off mid-sentence stops the sentence.
            if !isOn { stopSample() }
        }
        .onDisappear { narration.deactivate() }
    }

    // MARK: - The switch

    private var switchCard: some View {
        VStack(alignment: .leading, spacing: Theme.stackSpacing) {
            HStack(spacing: Theme.stackSpacing) {
                Image(systemName: narrationEnabled ? "speaker.wave.2.fill" : "speaker.slash.fill")
                    .scaledFont(26, .semibold, design: .default)
                    .foregroundStyle(narrationEnabled ? Theme.clay : Theme.ink)
                    .frame(width: 56, height: 56)
                    .background(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .fill(narrationEnabled ? Theme.claySoft : Theme.surface)
                    )
                    .accessibilityHidden(true)

                Toggle(isOn: $narrationEnabled) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Spoken guidance")
                            .textRole(.headline)
                            .foregroundStyle(Theme.ink)
                        Text(narrationEnabled ? "On" : "Off")
                            .textRole(.footnote)
                            .foregroundStyle(Theme.ink55)
                    }
                }
                .tint(Theme.green)
            }

            Text(narrationEnabled
                 ? "The written instruction is always on screen too. You never depend on the sound."
                 : "Lessons stay silent. The written instruction is always on screen. Change this in Settings whenever you like.")
                .textRole(.subhead)
                .foregroundStyle(Theme.ink55)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Theme.cardPadding)
        .cardBackground()
    }

    // MARK: - The sample

    private var sampleCard: some View {
        VStack(alignment: .leading, spacing: Theme.stackSpacing) {
            NarrationChip(state: chipState, label: "Lina") {}
                .allowsHitTesting(false)
                // The chip is decoration here: the quote below carries the words.
                .accessibilityHidden(true)

            Text("“\(sampleLine)”")
                .scaledFont(20, .bold)
                .tracking(-0.3)
                .lineSpacing(5)
                .foregroundStyle(narrationEnabled ? Theme.ink : Theme.ink55)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)

            Text(recordedLine == nil
                 ? "Lina's recordings are not in this build yet. This is the line she reads."
                 : "This is her own voice, the one you hear in a lesson.")
                .textRole(.footnote)
                .foregroundStyle(Theme.ink55)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)

            Button(action: playSample) {
                Label(sampleButtonTitle,
                      systemImage: isPlayingSample ? "arrow.counterclockwise" : "waveform")
            }
            .buttonStyle(.secondary)
            .disabled(recordedLine != nil && !narrationEnabled)
        }
        .padding(Theme.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Theme.cardCornerRadius, style: .continuous)
                .fill(Theme.surface)
        )
    }

    private var chipState: NarrationChip.State {
        if !narrationEnabled { return .muted }
        return isSpeaking ? .speaking : .idle
    }

    /// The recording's own state while one is playing; the three-second pretence
    /// otherwise.
    private var isSpeaking: Bool {
        recordedLine == nil ? isPlayingSample : narration.isSpeaking
    }

    private var sampleButtonTitle: String {
        if recordedLine == nil { return isPlayingSample ? "Show it again" : "Show a sample" }
        return narration.isSpeaking ? "Play it again" : "Play a sample"
    }

    private func playSample() {
        if recordedLine == nil {
            isPlayingSample = true
            playCount += 1
        } else {
            narration.playAppLine("hello")
        }
    }

    private func stopSample() {
        narration.stop()
        isPlayingSample = false
    }
}
