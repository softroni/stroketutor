import SwiftUI

/// The gold crown a Premium lesson wears: a crown on a soft gold disc with a white
/// rim, in a corner of the tile or node (bottom right on a tile, where the lock is
/// not; top right on a node, where the check and the lock are not). Shown only
/// while Premium is not active.
///
/// Decoration: the tile's or node's own label says "Premium" for VoiceOver.
struct CrownBadge: View {
    var size: CGFloat = 26

    var body: some View {
        Image(systemName: "crown.fill")
            .font(.system(size: size * 0.46, weight: .bold))
            .foregroundStyle(Theme.goldDeep)
            .frame(width: size, height: size)
            .background(Circle().fill(Theme.goldSoft))
            .overlay(Circle().strokeBorder(Theme.paper, lineWidth: size > 30 ? 3 : 2))
            .accessibilityHidden(true)
    }
}

/// "Next: Mushroom · Premium" — what the completion and saved screens show in
/// place of "Next lesson" when the next lesson needs Premium. Gold, like the crown,
/// with the lesson's drawing and a chevron: it opens the Premium drawer, never the
/// paywall directly, and nothing opens it on its own.
struct PremiumNextCard: View {
    let lesson: Lesson
    let action: () -> Void

    @Environment(AppModel.self) private var app

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Theme.controlCornerRadius, style: .continuous)

        Button(action: action) {
            HStack(spacing: 14) {
                DrawingThumbnail(tutorial: lesson.tutorial, strokeColor: nil, showsFills: true)
                    .padding(6)
                    .frame(width: 52, height: 52)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Theme.paper)
                    )
                    .overlay(alignment: .bottomTrailing) {
                        CrownBadge(size: 24).offset(x: 8, y: 8)
                    }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Next: \(lesson.title)")
                        .scaledFont(17, .heavy, relativeTo: .headline)
                        .foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(subtitle)
                        .scaledFont(14, .bold, relativeTo: .subheadline)
                        .foregroundStyle(Theme.goldDeep)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Image(systemName: "chevron.right")
                    .scaledFont(16, .heavy, design: .default)
                    .foregroundStyle(Theme.goldDeep)
            }
            .padding(.vertical, 12)
            .padding(.horizontal, 14)
            .frame(minHeight: Theme.minimumTapTarget)
            .background(shape.fill(Theme.goldSoft.opacity(0.55)))
            .overlay(shape.strokeBorder(Theme.gold.opacity(0.55), lineWidth: 2))
            .background(alignment: .bottom) {
                shape.fill(Theme.gold.opacity(0.45)).offset(y: 4)
            }
            .padding(.bottom, 4)
            .contentShape(shape)
        }
        .buttonStyle(PressableSlotStyle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Next: \(lesson.title). Premium. \(subtitle)")
        .accessibilityAddTraits(.isButton)
    }

    /// A child is never told about a free week they cannot start themselves.
    private var subtitle: String {
        if app.learnerIsChild { return "Premium · Ask a grown-up" }
        return app.premium.isEligibleForTrial ? "Premium · Try 7 days free" : "Premium · Subscribe to unlock"
    }
}

/// "Or keep going free: Sun · Sky & Weather" — a free lesson from another path,
/// under the gold card, so a learner who is not subscribing still has a next
/// drawing.
struct FreeLessonRow: View {
    let lesson: Lesson
    let action: () -> Void

    @Environment(AppModel.self) private var app

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                DrawingThumbnail(tutorial: lesson.tutorial, strokeColor: nil, showsFills: true)
                    .padding(4)
                    .frame(width: 38, height: 38)
                    .background(
                        RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Theme.paper)
                    )

                VStack(alignment: .leading, spacing: 1) {
                    Text("Or keep going free".uppercased())
                        .textRole(.eyebrow)
                        .foregroundStyle(Theme.greenDeep)
                    Text(title)
                        .scaledFont(15, .bold)
                        .foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Text("Draw")
                    .scaledFont(15, .heavy)
                    .foregroundStyle(Theme.greenDeep)
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 14)
            .frame(minHeight: 52)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Theme.surface)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableSlotStyle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Or keep going free: \(title)")
        .accessibilityAddTraits(.isButton)
    }

    /// "Sun · Sky & Weather".
    private var title: String {
        guard let path = app.path(id: lesson.pathId) else { return lesson.title }
        return "\(lesson.title) · \(path.title)"
    }
}
