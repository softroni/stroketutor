import SwiftUI

/// The inline navigation bar of v3 (`.navbar`): 56 pt tall, a 44 pt back chevron at
/// the leading edge, the screen's name centred at 17/heavy, and room for one
/// trailing control. Screens that use it hide the system bar, so the height, the
/// glyph and the title's weight are the mockup's rather than UIKit's.
///
/// The title stays centred even when the back button is present, because the two
/// 60 pt rails of `.navbar`'s grid are drawn as padding around a centred label.
struct InlineNavBar<Trailing: View>: View {
    let title: String
    /// Shown when set — normally `{ dismiss() }`. Nil leaves the leading rail empty.
    var onBack: (() -> Void)?
    @ViewBuilder var trailing: Trailing

    var body: some View {
        ZStack {
            Text(title)
                .scaledFont(17, .heavy, relativeTo: .headline)
                .tracking(-0.2)
                .foregroundStyle(Theme.ink)
                .lineLimit(1)
                .truncationMode(.tail)
                .padding(.horizontal, 60)
                .accessibilityAddTraits(.isHeader)

            HStack(spacing: 0) {
                if let onBack {
                    Button(action: onBack) {
                        Image(systemName: "chevron.left")
                            .scaledFont(19, .bold, design: .default)
                            .foregroundStyle(Theme.ink)
                            .frame(width: Theme.navTapTarget, height: Theme.navTapTarget)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Back")
                }
                Spacer(minLength: 0)
                trailing
            }
            .padding(.horizontal, 8)
        }
        .frame(height: 56)
        .frame(maxWidth: .infinity)
        .background(Theme.page)
    }
}

extension InlineNavBar where Trailing == EmptyView {
    init(title: String, onBack: (() -> Void)? = nil) {
        self.init(title: title, onBack: onBack, trailing: { EmptyView() })
    }
}
