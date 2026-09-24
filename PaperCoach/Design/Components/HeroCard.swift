import SwiftUI

/// The hero banner of `hp-home` (`.card--hero`): a filled green card with the next
/// lesson and the one big button on the screen. Few words, a big picture:
///
/// * a small chip naming the path, in the path's own tint (`PathTint`), so the hero
///   and the path's shelf below it plainly belong together;
/// * the lesson's title, big;
/// * one short fact under it — "2 min" by a clock;
/// * the lesson drawn large and in color on a white tile.
///
/// A 6 pt green-deep edge sits under the card. At the accessibility text sizes the
/// drawing moves above the words, so a long title keeps the card's full width.
struct HeroCard: View {
    /// The chip's words: the path's name, or "All done" once everything is drawn.
    let chip: String
    /// The chip's colors, or nil for gold (the finished state).
    let tint: PathTint?
    let title: String
    let meta: String
    var metaSystemImage: String? = "clock"
    let drawing: PreparedTutorial?
    let actionTitle: String
    /// Read first by VoiceOver, for what the card no longer prints ("Start here",
    /// "Lesson 1 of 10").
    var accessibilityContext: String?
    let action: () -> Void

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// The white tile's edge. Big enough that the picture, not the words, is what
    /// the eye lands on first.
    private static let tileSize: CGFloat = 128

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 14) {
                    tile
                    words
                }
            } else {
                HStack(alignment: .center, spacing: 14) {
                    words
                        .frame(maxWidth: .infinity, alignment: .leading)
                    tile
                }
            }

            Button(actionTitle, action: action)
                .buttonStyle(.whiteOnGreen)
        }
        .padding(.init(top: 18, leading: 18, bottom: 18, trailing: 18))
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

    // MARK: - Parts

    private var words: some View {
        VStack(alignment: .leading, spacing: 8) {
            pathChip

            Text(title)
                .textRole(.title1)
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 5) {
                if let metaSystemImage {
                    Image(systemName: metaSystemImage)
                        .scaledFont(14, .bold, relativeTo: .subheadline, design: .default)
                }
                Text(meta)
                    .textRole(.headline)
            }
            .foregroundStyle(.white.opacity(0.9))
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel([accessibilityContext, chip, title, meta]
            .compactMap { $0 }
            .joined(separator: ", "))
    }

    /// The path's name on its soft tint in its deep color, with a dot of that deep
    /// color in front: the path's tint set on the green, like a sticker. One line;
    /// a long name shrinks a little rather than wrapping.
    private var pathChip: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(tint?.deep ?? Theme.goldDeep)
                .frame(width: 8, height: 8)
            Text(chip)
                .scaledFont(14, .heavy, relativeTo: .subheadline)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .foregroundStyle(tint?.deep ?? Theme.goldDeep)
        .padding(.vertical, 6)
        .padding(.horizontal, 11)
        .background(Capsule().fill(tint?.soft ?? Theme.goldSoft))
    }

    /// Square beside the words; the card's full width above them at the
    /// accessibility sizes, where it would otherwise leave half the card empty.
    private var tile: some View {
        DrawingThumbnail(tutorial: drawing, strokeColor: nil, showsFills: true)
            .frame(width: Self.tileSize - 24, height: Self.tileSize - 24)
            .padding(12)
            .frame(maxWidth: dynamicTypeSize.isAccessibilitySize ? .infinity : nil)
            .background(
                RoundedRectangle(cornerRadius: Theme.cardCornerRadius - 4, style: .continuous)
                    .fill(Theme.paper)
            )
            .background(alignment: .bottom) {
                RoundedRectangle(cornerRadius: Theme.cardCornerRadius - 4, style: .continuous)
                    .fill(Theme.greenDeep.opacity(0.55))
                    .offset(y: 4)
            }
            .rotationEffect(.degrees(dynamicTypeSize.isAccessibilitySize ? 0 : 2))
            .accessibilityHidden(true)
    }
}
