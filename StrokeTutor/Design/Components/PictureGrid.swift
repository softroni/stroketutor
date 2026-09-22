import SwiftUI

/// Equal columns, filled row by row, with every card in a row given the row's
/// tallest height — so two picture cards side by side stay the same height when
/// one title wraps and the other does not. Used by `ob-path` and `hp-paths`.
///
/// A last row that is not full is centered by default (`ob-path`: three paths read
/// as two and one under them); `centersLastRow: false` keeps it at the leading
/// edge, which suits a long list read row by row (`hp-paths`).
struct PictureGrid: Layout {
    let columns: Int
    let spacing: CGFloat
    var centersLastRow: Bool = true

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
            var x = bounds.minX + (centersLastRow ? (bounds.width - rowWidth) / 2 : 0)

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
