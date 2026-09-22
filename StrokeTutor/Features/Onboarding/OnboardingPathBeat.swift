import SwiftUI

/// `ob-path` — "Pick one to start." The paths of the level chosen on `ob-level`, at
/// most four, as pictures of what the learner will draw first: two to a row, a
/// third on its own row centered under the first two. One column at the
/// accessibility text sizes, so a title has the width to wrap in. The first path is
/// preselected so Continue is never blocked, and there is no Skip: Skip lands on
/// the who beat, before the level was asked.
///
/// A tap moves the selection and never advances. Continue writes `currentPathId`.
struct OnboardingPathBeat: View {

    let paths: [PathModel]
    let selectedPathId: String?
    let rail: OnboardingRail
    let onSelect: (PathModel) -> Void
    let onContinue: () -> Void

    @Environment(\.onboardingReducesMotion) private var reducesMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        OnboardingBeatFrame(rail: rail) {
            TutorSays(pose: .neutral,
                      text: "Pick one to start. The rest are waiting in Paths.")

            if paths.isEmpty {
                emptyCatalog
            } else {
                PictureGrid(columns: dynamicTypeSize.isAccessibilitySize ? 1 : 2,
                            spacing: Theme.stackSpacing) {
                    ForEach(paths) { path in
                        PathPictureCard(path: path, isSelected: path.id == selectedPathId) {
                            onSelect(path)
                        }
                    }
                }
                .animation(reducesMotion ? nil : .spring(response: 0.2, dampingFraction: 0.85),
                           value: selectedPathId)
            }
        } footer: {
            Button("Continue", action: onContinue)
                .buttonStyle(.primary)
        }
    }

    private var emptyCatalog: some View {
        Text("No lessons are installed.")
            .textRole(.headline)
            .foregroundStyle(Theme.ink55)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.cardPadding)
            .cardBackground()
    }

}

/// Equal columns, filled row by row, with every card in a row given the row's
/// tallest height. A last row that is not full is centered rather than left
/// hanging at the leading edge — three paths read as two and one under them.
private struct PictureGrid: Layout {
    let columns: Int
    let spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.replacingUnspecifiedDimensions().width
        let heights = rowHeights(of: subviews, columnWidth: columnWidth(in: width))
        let height = heights.reduce(0, +) + spacing * CGFloat(max(heights.count - 1, 0))
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let column = columnWidth(in: bounds.width)
        let heights = rowHeights(of: subviews, columnWidth: column)
        var y = bounds.minY

        for (row, height) in heights.enumerated() {
            let first = row * columns
            let count = min(columns, subviews.count - first)
            let rowWidth = column * CGFloat(count) + spacing * CGFloat(count - 1)
            var x = bounds.minX + (bounds.width - rowWidth) / 2

            for index in first..<(first + count) {
                subviews[index].place(at: CGPoint(x: x, y: y),
                                      anchor: .topLeading,
                                      proposal: ProposedViewSize(width: column, height: height))
                x += column + spacing
            }
            y += height + spacing
        }
    }

    private func columnWidth(in width: CGFloat) -> CGFloat {
        let count = CGFloat(max(columns, 1))
        return max((width - spacing * (count - 1)) / count, 0)
    }

    /// Each row as tall as its tallest card wants to be at the column's width.
    private func rowHeights(of subviews: Subviews, columnWidth: CGFloat) -> [CGFloat] {
        let perRow = max(columns, 1)
        return stride(from: 0, to: subviews.count, by: perRow).map { first in
            subviews[first..<min(first + perRow, subviews.count)]
                .map { $0.sizeThatFits(ProposedViewSize(width: columnWidth, height: nil)).height }
                .max() ?? 0
        }
    }
}
