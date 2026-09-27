import SwiftUI

/// The reference sheet of the player (`pl-player` variant *reference*): the picture
/// the lesson draws from, as large as the screen allows, then the finished sketch
/// beside the one idea the lesson teaches, and a way back. The lesson keeps playing
/// behind it — nothing is paused, because looking at the subject is part of drawing
/// it.
///
/// The mockup titled it "The real thing", for a photograph of a real subject. The
/// lessons draw from coloured pictures instead, so the sheet is titled with the
/// lesson's own name and says what the picture is for underneath. The picture takes
/// every point the header and the row below leave it: the sheet opens at full
/// height on a phone and at page size on an iPad (`referenceSheetPresentation()`).
struct ReferenceSheet: View {
    let lesson: Lesson
    let onClose: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.stackSpacing) {
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(lesson.title)
                        .textRole(.title2)
                        .foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("The picture to draw from")
                        .textRole(.subhead)
                        .foregroundStyle(Theme.ink55)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 8)
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .scaledFont(17, .bold, design: .default)
                        .foregroundStyle(Theme.ink)
                        .frame(width: Theme.navTapTarget, height: Theme.navTapTarget)
                        .background(Circle().fill(Theme.surface))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close picture")
            }

            // The whole picture, never cropped: it grows into all the height the
            // sheet has, on a soft panel so a white picture still has an edge.
            ReferenceImageView(reference: lesson.reference, contentMode: .fit)
                .padding(16)
                .frame(maxWidth: .infinity, minHeight: 240, maxHeight: .infinity)
                .background(
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .fill(Theme.surface)
                )
                .layoutPriority(1)

            HStack(alignment: .top, spacing: 14) {
                DrawingThumbnail(tutorial: lesson.tutorial, size: 68)
                    .padding(8)
                    .cardBackground(cornerRadius: Theme.thumbCornerRadius)
                    .accessibilityHidden(true)

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

extension View {
    /// How the reference sheet is presented: full height on a phone, so the picture
    /// is as big as the screen, and page-sized on an iPad (iPadOS 18 and later),
    /// rather than the small form sheet a medium detent gives there.
    func referenceSheetPresentation() -> some View {
        modifier(ReferenceSheetPresentation())
    }
}

private struct ReferenceSheetPresentation: ViewModifier {
    func body(content: Content) -> some View {
        let sheet = content
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
            .presentationBackground(Theme.card)
            .presentationCornerRadius(28)
        if #available(iOS 18.0, *) {
            sheet.presentationSizing(.page)
        } else {
            sheet
        }
    }
}
