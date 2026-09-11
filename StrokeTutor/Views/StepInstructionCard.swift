import SwiftUI

/// The bottom card shown while playback waits for the child, and again when the
/// drawing is complete.
struct StepInstructionCard: View {
    enum Mode {
        /// Waiting for "I drew it!".
        case awaitingUser(stepNumber: Int, stepCount: Int, instruction: String)
        case finished(title: String)
    }

    let mode: Mode
    let onPrimary: () -> Void
    let onSecondary: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            switch mode {
            case let .awaitingUser(stepNumber, stepCount, instruction):
                Text("Step \(stepNumber) of \(stepCount)")
                    .font(Theme.rounded(16, .semibold))
                    .foregroundStyle(Theme.ink.opacity(0.55))

                Text(instruction)
                    .font(Theme.rounded(22, .bold))
                    .foregroundStyle(Theme.ink)
                    .minimumScaleFactor(0.7)
                    .fixedSize(horizontal: false, vertical: true)

            case let .finished(title):
                Text("All done!")
                    .font(Theme.rounded(16, .semibold))
                    .foregroundStyle(Theme.ink.opacity(0.55))

                Text("You finished \(title). Nice drawing!")
                    .font(Theme.rounded(22, .bold))
                    .foregroundStyle(Theme.ink)
                    .minimumScaleFactor(0.7)
                    .fixedSize(horizontal: false, vertical: true)
            }

            VStack(spacing: 12) {
                Button(primaryTitle, action: onPrimary)
                    .buttonStyle(BigPrimaryButtonStyle(tint: primaryTint))

                if let onSecondary {
                    Button("Watch again", action: onSecondary)
                        .buttonStyle(BigSecondaryButtonStyle())
                }
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Theme.cardCornerRadius, style: .continuous)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.10), radius: 18, y: 6)
        )
    }

    private var primaryTitle: String {
        switch mode {
        case .awaitingUser: return "I drew it!"
        case .finished: return "Start over"
        }
    }

    private var primaryTint: Color {
        switch mode {
        case .awaitingUser: return Theme.success
        case .finished: return Theme.accent
        }
    }
}
