import SwiftUI

/// `ob-voice` — "Meet the voice". Lina introduces the narration and hands over the
/// switch before anything has played on its own. One decision, one sample, and the
/// sample only when the learner asks for it.
///
/// The switch writes `narrationEnabled` at once: there is no Save here, and Continue
/// commits nothing.
///
/// No recordings ship in this build. Rather than a button that claims to play a
/// sound and then does not, the sample shows what Lina will say and animates her
/// chip while it does — and the card says plainly that the recordings are not here
/// yet. The written instruction is the channel that always works, which is the point
/// this beat is making anyway.
struct OnboardingVoiceBeat: View {

    @Binding var narrationEnabled: Bool
    let rail: OnboardingRail
    let onContinue: () -> Void

    /// The step's written instruction, verbatim: audio is a second channel, never
    /// the only one.
    private let sampleLine = "\"Draw one square in the middle of the page. This is the front wall.\""

    @State private var isPlayingSample = false
    @State private var playCount = 0

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
            guard playCount > 0 else { return }
            try? await Task.sleep(for: .seconds(3))
            guard !Task.isCancelled else { return }
            isPlayingSample = false
        }
    }

    // MARK: - The switch

    private var switchCard: some View {
        VStack(alignment: .leading, spacing: Theme.stackSpacing) {
            HStack(spacing: Theme.stackSpacing) {
                Image(systemName: narrationEnabled ? "speaker.wave.2.fill" : "speaker.slash.fill")
                    .font(.system(size: 26, weight: .semibold))
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

            Text(sampleLine)
                .font(.system(size: 20, weight: .bold, design: .rounded))
                .tracking(-0.3)
                .lineSpacing(5)
                .foregroundStyle(narrationEnabled ? Theme.ink : Theme.ink55)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)

            Text("Lina's recordings are not in this build yet. This is the line she reads.")
                .textRole(.footnote)
                .foregroundStyle(Theme.ink55)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)

            Button {
                isPlayingSample = true
                playCount += 1
            } label: {
                Label(isPlayingSample ? "Show it again" : "Show a sample",
                      systemImage: isPlayingSample ? "arrow.counterclockwise" : "waveform")
            }
            .buttonStyle(.secondary)
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
        return isPlayingSample ? .speaking : .idle
    }
}
