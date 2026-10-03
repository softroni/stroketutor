import SwiftUI

/// "Today's drawing" on Home, under the hero (`DailyDrawing`): the day's lesson
/// drawn in color on a white tile, its name, its path and minutes, and "Draw". Gold,
/// like everything Premium, because the day's lesson always is one; for a learner
/// 13 or over without Premium a "Free today" flag on its top edge, in the shape of
/// the shelves' "Next" flag, says why it wears no crown. A child
/// is never told what anything costs, so their card has no tag. A check on the tile
/// once the learner has drawn it; the card stays, as an invitation to draw it again.
///
/// The whole card is one button (`AppModel.openDailyDrawing()`).
struct DailyDrawingCard: View {
    let lesson: Lesson
    /// The lesson's path, for "Food & Treats · 6 min".
    let path: PathModel?
    let isDrawn: Bool
    /// "Free today" for a learner 13 or over without Premium.
    let isFreeToday: Bool
    let action: () -> Void

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.isWideLayout) private var isWide

    private var tileSize: CGFloat { isWide ? 108 : 76 }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Theme.cardCornerRadius, style: .continuous)

        Button(action: action) {
            Group {
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: 12) {
                        tile
                        words
                        drawLabel
                    }
                } else {
                    HStack(spacing: 14) {
                        tile
                        words
                            .frame(maxWidth: .infinity, alignment: .leading)
                        drawLabel
                    }
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(shape.fill(Theme.goldSoft))
            .overlay(shape.strokeBorder(Theme.gold.opacity(0.55), lineWidth: 2))
            .background(alignment: .bottom) {
                shape.fill(Theme.gold.opacity(0.45)).offset(y: 4)
            }
            .padding(.bottom, 4)
            .overlay(alignment: .topTrailing) { freeTodayFlag }
            .contentShape(shape)
        }
        .buttonStyle(PressableSlotStyle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint("Opens the lesson")
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Parts

    private var tile: some View {
        DrawingThumbnail(tutorial: lesson.tutorial, strokeColor: nil, showsFills: true)
            .padding(isWide ? 12 : 8)
            .frame(width: tileSize, height: tileSize)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Theme.paper)
            )
            .background(alignment: .bottom) {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Theme.gold.opacity(0.4))
                    .offset(y: 3)
            }
            .overlay(alignment: .topTrailing) {
                if isDrawn {
                    Image(systemName: "checkmark")
                        .scaledFont(11, .heavy, relativeTo: .footnote, design: .default)
                        .foregroundStyle(Theme.green)
                        .frame(width: 24, height: 24)
                        .background(Circle().fill(Theme.surface))
                        .overlay(Circle().strokeBorder(Theme.paper, lineWidth: 2))
                        .offset(x: 7, y: -7)
                }
            }
            .rotationEffect(.degrees(dynamicTypeSize.isAccessibilitySize ? 0 : -2))
            .accessibilityHidden(true)
    }

    private var words: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Today’s drawing".uppercased())
                .textRole(.eyebrow)
                .foregroundStyle(Theme.goldDeep)
                .fixedSize(horizontal: false, vertical: true)
            Text(lesson.title)
                .textRole(isWide ? .title2 : .title3)
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
            Text(meta)
                .scaledFont(14, .bold, relativeTo: .subheadline)
                .foregroundStyle(Theme.ink55)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// "Free today", on the card's top edge.
    @ViewBuilder
    private var freeTodayFlag: some View {
        if isFreeToday {
            Text("Free today")
                .scaledFont(13, .heavy, relativeTo: .footnote)
                .foregroundStyle(.white)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Capsule().fill(Theme.goldDeep))
                .overlay(Capsule().strokeBorder(Theme.paper, lineWidth: 2.5))
                .offset(x: -18, y: -11)
                .accessibilityHidden(true)
        }
    }

    private var drawLabel: some View {
        HStack(spacing: 4) {
            Text("Draw")
                .scaledFont(16, .heavy)
            Image(systemName: "chevron.right")
                .scaledFont(14, .heavy, design: .default)
        }
        .foregroundStyle(Theme.goldDeep)
        .fixedSize()
    }

    // MARK: - Words

    /// "Food & Treats · 6 min".
    private var meta: String {
        let minutes = "\(lesson.estimatedMinutes) min"
        guard let path else { return minutes }
        return "\(path.title) · \(minutes)"
    }

    private var accessibilityLabel: String {
        var parts = ["Today’s drawing", lesson.title, meta.replacingOccurrences(of: " · ", with: ", ")]
        if isFreeToday { parts.append("free today") }
        if isDrawn { parts.append("drawn") }
        return parts.joined(separator: ", ")
    }
}
