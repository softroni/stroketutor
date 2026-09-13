import SwiftUI

/// The reference thumbnail that sits on the paper (`pl-player` `.pl-ref`): the real
/// thing, small, in a 4 pt white frame with the chip shadow and a dark expand badge.
/// It is always on the paper because the plan puts the reference first in the
/// player's order of priority — you draw what you can see.
///
/// 76 pt in portrait, 64 pt inline in the landscape panel.
struct ReferenceThumb: View {
    let reference: LessonReference?
    var side: CGFloat = 76
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ReferenceImageView(reference: reference, contentMode: .fill)
                .frame(width: side - 8, height: side - 8)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .padding(4)
                .background(
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .fill(Color.white)
                )
                .chipShadow()
                .overlay(alignment: .bottomTrailing) {
                    badge.offset(x: 5, y: 5)
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Reference photo. Double tap to expand.")
    }

    /// A 26 pt ink disc with a 3 pt white ring *outside* it, as the mockup's
    /// `box-shadow: 0 0 0 3px #fff` draws it.
    private var badge: some View {
        Image(systemName: "arrow.up.left.and.arrow.down.right")
            .scaledFont(12, .bold, design: .default)
            .foregroundStyle(Color.white)
            .frame(width: 26, height: 26)
            .background(Circle().fill(Theme.ink))
            .padding(3)
            .background(Circle().fill(Color.white))
            .accessibilityHidden(true)
    }
}
