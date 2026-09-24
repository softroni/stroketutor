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
                // The lesson's own title, not a lower-cased subject: "The real palm
                // tree 4" reads as a mistake. The title belongs underneath, where it
                // names the lesson without being bent into a sentence.
                VStack(alignment: .leading, spacing: 2) {
                    Text("The real thing")
                        .textRole(.title2)
                        .foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(lesson.title)
                        .textRole(.subhead)
                        .foregroundStyle(Theme.ink55)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityElement(children: .combine)
                Spacer(minLength: 8)
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .scaledFont(17, .bold, design: .default)
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
