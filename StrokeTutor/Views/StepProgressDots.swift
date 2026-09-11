import SwiftUI

/// One dot per step: filled for done, ringed for the step in play, empty ahead.
struct StepProgressDots: View {
    let stepCount: Int
    let currentIndex: Int
    let isFinished: Bool

    private let diameter: CGFloat = 16

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
                .strokeBorder(Theme.ink, lineWidth: 4)
                .frame(width: diameter + 8, height: diameter + 8)
        } else {
            Circle()
                .strokeBorder(Theme.ink.opacity(0.22), lineWidth: 3)
                .frame(width: diameter, height: diameter)
        }
    }
}
