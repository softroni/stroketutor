import SwiftUI

/// The compact step indicator of v3 (`.dots`): 12 pt dots, ink for a step already
/// drawn, green with a soft halo for the step in play, 12 % ink ahead. The player's
/// header uses its sibling `StepSegments`; dots are for compact headers.
struct StepProgressDots: View {
    let stepCount: Int
    let currentIndex: Int
    let isFinished: Bool

    private let diameter: CGFloat = 12

    var body: some View {
        HStack(spacing: 12) {
            ForEach(0..<max(stepCount, 0), id: \.self) { index in
                dot(for: index)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(isFinished
                                 ? "All \(stepCount) steps complete."
                                 : "Step \(min(currentIndex + 1, stepCount)) of \(stepCount)."))
    }

    @ViewBuilder
    private func dot(for index: Int) -> some View {
        if isFinished || index < currentIndex {
            Circle()
                .fill(Theme.ink)
                .frame(width: diameter, height: diameter)
        } else if index == currentIndex {
            Circle()
                .fill(Theme.green)
                .frame(width: diameter, height: diameter)
                .overlay(Circle().strokeBorder(Theme.greenSoft, lineWidth: 4).padding(-4))
        } else {
            Circle()
                .fill(Theme.ink12)
                .frame(width: diameter, height: diameter)
        }
    }
}
