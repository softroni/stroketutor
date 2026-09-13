import SwiftUI

/// The small readout shown in debug mode: enough to sanity-check an export
/// without leaving the app.
struct DebugOverlay: View {
    let tutorial: PreparedTutorial

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("DEBUG — all steps, no animation")
                // Deliberately fixed: a developer readout, never shown to a learner.
                .font(.system(size: 13, weight: .heavy, design: .monospaced))

            Text("file: \(tutorial.fileName)  (\(tutorial.source.label))")
            Text("canvas: \(number(tutorial.canvas.width)) × \(number(tutorial.canvas.height))")
            Text("steps: \(tutorial.steps.count)   strokes: \(tutorial.totalStrokeCount)   fills: \(tutorial.totalFillCount)")
            Text("schemaVersion: \(tutorial.schemaVersion)")

            if tutorial.warnings.isEmpty {
                Text("warnings: none")
            } else {
                Text("warnings: \(tutorial.warnings.count)")
                    .foregroundStyle(Theme.clay)
                ForEach(Array(tutorial.warnings.enumerated()), id: \.offset) { _, warning in
                    Text("• \(warning)")
                        .foregroundStyle(Theme.clay)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        // Deliberately fixed: the numbers below line up in a monospaced column, and
        // the overlay is a developer tool that never reaches a learner's text size.
        .font(.system(size: 12, weight: .medium, design: .monospaced))
        .foregroundStyle(Theme.ink)
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(.white.opacity(0.92))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Theme.ink.opacity(0.15), lineWidth: 1)
        )
    }

    private func number(_ value: CGFloat) -> String {
        String(format: "%g", value)
    }
}
