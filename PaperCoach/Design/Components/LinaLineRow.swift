import SwiftUI

/// Lina's round portrait and one plain line beside it — no bubble (`.sk-lina`).
/// `sk-complete` uses it for her closing line and `hp-paths` for her one-time
/// welcome, so the two read as the same voice. The line is whatever she says
/// aloud, written out; the row itself never plays anything.
///
/// VoiceOver hears one element, the line itself; the face is hidden from it.
struct LinaLineRow: View {
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            LinaFace(size: 48)
            Text(text)
                .textRole(.body)
                .foregroundStyle(Theme.ink70)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 1)
        }
        .padding(.horizontal, 2)
        .accessibilityElement(children: .combine)
    }
}
