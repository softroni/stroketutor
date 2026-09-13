import SwiftUI

/// The hero banner of `hp-home` (`.card--hero`): a filled green card with the next
/// lesson, its drawing on a white thumb, and the one button on the screen.
/// "Continue · Trees" / "Start here · Trees", the lesson's title, then
/// "Lesson 3 of 10 · About 4 min". A 6 pt green-deep edge sits under it.
struct HeroCard: View {
    let eyebrow: String
    let title: String
    let meta: String
    let drawing: PreparedTutorial?
    let actionTitle: String
    let action: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(eyebrow.uppercased())
                        .textRole(.eyebrow)
                        .foregroundStyle(.white.opacity(0.85))
                    Text(title)
                        .textRole(.title2)
                        .foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(meta)
                        .textRole(.subhead)
                        .foregroundStyle(.white.opacity(0.78))
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                DrawingThumbnail(tutorial: drawing, size: 74)
                    .padding(11)
                    .background(
                        RoundedRectangle(cornerRadius: Theme.thumbCornerRadius, style: .continuous)
                            .fill(Theme.paper)
                    )
            }

            Button(actionTitle, action: action)
                .buttonStyle(.whiteOnGreen)
        }
        .padding(.init(top: 18, leading: 20, bottom: 18, trailing: 18))
        .background(
            RoundedRectangle(cornerRadius: Theme.cardCornerRadius, style: .continuous)
                .fill(Theme.heroGradient)
        )
        .background(alignment: .bottom) {
            RoundedRectangle(cornerRadius: Theme.cardCornerRadius, style: .continuous)
                .fill(Theme.greenDeep)
                .offset(y: 6)
        }
        .padding(.bottom, 6)
        .accessibilityElement(children: .contain)
    }
}
