import SwiftUI

/// The narration chip of the player (`.narration`): Lina's portrait with a small
/// wave while she speaks, a speaker glyph when she has finished, and a grey speaker
/// with a slash when narration is off. Tapping it mutes or unmutes.
///
/// It appears only when narration is on *and* the step has an audio file. No audio
/// ships yet, so today the player hides it — the component exists so the pipeline
/// has somewhere to land.
struct NarrationChip: View {

    enum State {
        /// Lina is speaking now.
        case speaking
        /// Narration is on, this line has finished.
        case idle
        /// Narration is off.
        case muted
    }

    let state: State
    let action: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @SwiftUI.State private var isAnimating = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                LinaFace(size: 32)
                    .grayscale(state == .muted ? 1 : 0)
                    .opacity(state == .muted ? 0.7 : 1)

                switch state {
                case .speaking:
                    wave
                case .idle:
                    Image(systemName: "speaker.wave.2.fill")
                        .font(.system(size: 15, weight: .bold))
                case .muted:
                    Image(systemName: "speaker.slash.fill")
                        .font(.system(size: 15, weight: .bold))
                }
            }
            .foregroundStyle(state == .muted ? Theme.ink40 : Theme.clay)
            .padding(.vertical, 6)
            .padding(.leading, 6)
            .padding(.trailing, 12)
            .background(Capsule().fill(Theme.card))
            .chipShadow()
        }
        .buttonStyle(.plain)
        .accessibilityLabel(state == .muted
                            ? "Narration off. Double tap to turn it on."
                            : "Narration on. Double tap to mute.")
        .onAppear { isAnimating = true }
    }

    /// Five bars that rise and fall while Lina talks. Still under Reduce Motion.
    private var wave: some View {
        HStack(spacing: 2.5) {
            ForEach(0..<5, id: \.self) { index in
                Capsule()
                    .frame(width: 3, height: barHeight(index))
                    .animation(reduceMotion
                               ? nil
                               : .easeInOut(duration: 0.5)
                                   .repeatForever(autoreverses: true)
                                   .delay(Double(index) * 0.15),
                               value: isAnimating)
            }
        }
        .frame(height: 18)
    }

    private func barHeight(_ index: Int) -> CGFloat {
        guard !reduceMotion, isAnimating else { return 6 }
        return index.isMultiple(of: 2) ? 18 : 12
    }
}
