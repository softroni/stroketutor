import SwiftUI

/// A grouped list card (`.list`): white, radius 24, a 2 pt `--line` border, its rows
/// clipped inside it. Settings is four of these; a lesson list is one.
/// `.soft` is the borderless grey variant.
struct ListCard<Content: View>: View {
    var isSoft: Bool = false
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: 0) { content }
            .background(
                RoundedRectangle(cornerRadius: Theme.cardCornerRadius, style: .continuous)
                    .fill(isSoft ? Theme.surface : Theme.card)
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.cardCornerRadius, style: .continuous))
            .overlay {
                if !isSoft {
                    RoundedRectangle(cornerRadius: Theme.cardCornerRadius, style: .continuous)
                        .strokeBorder(Theme.line, lineWidth: 2)
                }
            }
    }
}

/// The 2 pt rule between two rows of a `ListCard`. Written between rows rather than
/// conjured by the card, so a caller can group rows without one.
struct RowDivider: View {
    var isSoft: Bool = false

    var body: some View {
        Rectangle()
            .fill(isSoft ? Theme.ink06 : Theme.line)
            .frame(height: 2)
    }
}
