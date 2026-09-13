import SwiftUI

/// One honest fact on a soft tile (`.tile`): "5 steps", "12 minutes drawn",
/// "6 drawings". Never a score, never a streak — the completion screen and the
/// sketchbook use it to say what happened, not to rate it.
struct StatTile: View {
    let value: String
    let label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.system(size: 24, weight: .heavy, design: .rounded))
                .tracking(-0.5)
                .foregroundStyle(Theme.ink)
            Text(label)
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundStyle(Theme.ink55)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 14)
        .padding(.horizontal, 16)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(Theme.surface))
        .accessibilityElement(children: .combine)
    }
}
