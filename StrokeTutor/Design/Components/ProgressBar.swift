import SwiftUI

/// The progress bar of v3 (`.progress`): a 12 pt track in `surface-2` with a green
/// fill, or 8 pt when `isThin`. Gold marks a finished path; white is for use on the
/// green hero. It reports a fact — drawings finished — and never a target.
struct ProgressBar: View {
    /// 0...1. Values outside are clamped rather than drawn wrong.
    let value: Double
    var tint: Color = Theme.green
    var track: Color = Theme.surface2
    var isThin: Bool = false

    private var height: CGFloat { isThin ? 8 : 12 }

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Capsule().fill(track)
                Capsule()
                    .fill(tint)
                    .frame(width: geometry.size.width * min(max(value, 0), 1))
            }
        }
        .frame(height: height)
        .accessibilityElement(children: .ignore)
        .accessibilityValue(Text("\(Int((min(max(value, 0), 1)) * 100)) percent"))
    }
}
