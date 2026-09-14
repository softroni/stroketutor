import SwiftUI

/// The player's sheet turned on its side (`pl-landscape` `.pl-panel`): a 312 pt white
/// column on the trailing edge with a 2 pt line, radius 28 on its leading corners and
/// the shadow falling over the paper. Same header, same chips, same sentence, same
/// one action row — nothing is added and nothing is removed by turning the phone.
///
/// The one exception is a wide drawing (`PageShape.wide`): once its step is drawn
/// the panel slides away and `PlayerWideBar` takes over, so the ink can have the
/// whole paper while it is copied. A tap on the paper brings the panel back.
struct PlayerPanel<Header: View, Chips: View>: View {
    let instruction: String
    let hint: String
    let actions: PlayerActionRow
    /// How tall the words may grow before they scroll (see `PlayerSheet`).
    var textMaxHeight: CGFloat = 200
    @ViewBuilder let header: () -> Header
    @ViewBuilder let chips: () -> Chips

    /// `#pl-landscape .pl-panel { width: 312px }`.
    static var width: CGFloat { 312 }

    @State private var naturalTextHeight: CGFloat = 60

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            header()

            chips()

            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    PlayerInstructionText(instruction, alignment: .leading, size: 22)

                    Text(hint)
                        .textRole(.subhead)
                        .foregroundStyle(Theme.ink55)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .measuredHeight { naturalTextHeight = $0 }
            }
            .scrollBounceBehavior(.basedOnSize)
            .frame(height: min(max(naturalTextHeight, 60), max(60, textMaxHeight)))

            Spacer(minLength: 8)

            actions
        }
        .padding(.top, 10)
        .padding(.leading, 16)
        .padding(.trailing, Theme.gutter)
        .padding(.bottom, 14)
        .frame(width: Self.width)
        .background {
            UnevenRoundedRectangle(topLeadingRadius: 28, bottomLeadingRadius: 28, style: .continuous)
                .fill(Theme.card)
                .shadow(color: .black.opacity(0.10), radius: 15, x: -10)
                .overlay {
                    UnevenRoundedRectangle(topLeadingRadius: 28, bottomLeadingRadius: 28, style: .continuous)
                        .strokeBorder(Theme.line, lineWidth: 2)
                }
                .ignoresSafeArea()
        }
    }
}
