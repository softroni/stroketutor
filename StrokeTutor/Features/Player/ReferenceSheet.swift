import SwiftUI

/// The reference sheet of the player (`pl-player` variant *reference*): the real
/// thing large, then the finished sketch beside the one idea the lesson teaches, and
/// a way back. The lesson keeps playing behind it — nothing is paused, because
/// looking at the subject is part of drawing it.
struct ReferenceSheet: View {
    let lesson: Lesson
    let onClose: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.stackSpacing) {
            HStack(alignment: .center) {
                Text("The real \(lesson.subject)")
                    .textRole(.title2)
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 8)
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(Theme.ink)
                        .frame(width: Theme.navTapTarget, height: Theme.navTapTarget)
                        .background(Circle().fill(Theme.surface))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close reference")
            }

            // 236 pt in the mockup, and never more: at the medium detent it takes
            // whatever is left over instead, so nothing below it is ever clipped.
            ReferenceImageView(reference: lesson.reference, contentMode: .fill)
                .frame(maxWidth: .infinity, maxHeight: 236)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))

            HStack(alignment: .top, spacing: 14) {
                DrawingThumbnail(tutorial: lesson.tutorial, size: 68)
                    .padding(8)
                    .cardBackground(cornerRadius: Theme.thumbCornerRadius)

                Text(lesson.objective)
                    .textRole(.subhead)
                    .foregroundStyle(Theme.ink55)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .fixedSize(horizontal: false, vertical: true)

            Button("Back to the drawing", action: onClose)
                .buttonStyle(.secondary)
        }
        .padding(.top, 20)
        .padding(.horizontal, Theme.gutter)
        .padding(.bottom, 12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Theme.card)
    }
}
