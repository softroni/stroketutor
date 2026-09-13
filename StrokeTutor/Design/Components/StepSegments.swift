import SwiftUI

/// The player's step indicator (`.segments`): one 6 pt bar per step, ink for a step
/// already drawn, green for the step in play, 12 % ink for the steps ahead. It shows
/// the shape of the lesson, not only the position in it.
struct StepSegments: View {
    let stepCount: Int
    /// The step being drawn. Nil before the lesson starts, when every bar is faint.
    let currentIndex: Int?

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<max(stepCount, 0), id: \.self) { index in
                Capsule()
                    .fill(color(at: index))
                    .frame(height: 6)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
    }

    private func color(at index: Int) -> Color {
        guard let currentIndex else { return Theme.ink12 }
        if index < currentIndex { return Theme.ink }
        if index == currentIndex { return Theme.green }
        return Theme.ink12
    }

    private var label: Text {
        guard let currentIndex else { return Text("Before you start. \(stepCount) steps.") }
        return Text("Step \(min(currentIndex + 1, stepCount)) of \(stepCount).")
    }
}
