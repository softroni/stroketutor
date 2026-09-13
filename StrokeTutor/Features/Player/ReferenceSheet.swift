import SwiftUI

/// The reference sheet of the player: the real picture large, the finished drawing
/// beside the lesson's objective, and the credit the catalog carries. Playback
/// continues behind it.
struct ReferenceSheet: View {
    let lesson: Lesson
    let onClose: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.stackSpacing) {
            HStack {
                Text("The real thing")
                    .textRole(.title2)
                    .foregroundStyle(Theme.ink)
                Spacer()
                Button(action: onClose) {
                    Image(systemName: "xmark")
                }
                .buttonStyle(.roundIconSmall)
                .accessibilityLabel("Close reference")
            }

            ReferenceImageView(reference: lesson.reference)
                .frame(height: 236)
                .frame(maxWidth: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))

            HStack(alignment: .top, spacing: 14) {
                DrawingThumbnail(tutorial: lesson.tutorial, size: 84)
                    .padding(8)
                    .cardBackground(cornerRadius: Theme.thumbCornerRadius)
                Text(lesson.objective)
                    .textRole(.subhead)
                    .foregroundStyle(Theme.ink55)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if let reference = lesson.reference {
                Text("\(reference.source) · \(reference.license)")
                    .textRole(.footnote)
                    .foregroundStyle(Theme.ink40)
            }
        }
        .padding(Theme.gutter)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card)
    }
}
