import SwiftUI

/// `ob-1` — "Have you ever looked at something and wanted to draw it?"
///
/// Lina asks the question; a photograph and a sheet of paper with the drawing
/// appearing on it answer it. The pair is the whole promise in one image: the real
/// thing on the left, the learner's page on the right, an arrow between them.
struct OnboardingIntroBeat: View {

    let lesson: Lesson?
    let rail: OnboardingRail
    let onContinue: () -> Void

    @Environment(\.dynamicTypeSize) private var typeSize

    /// 312 pt, or 240 at the accessibility sizes where the text needs the room
    /// before the body starts scrolling.
    private var pairHeight: CGFloat { typeSize.isAccessibilitySize ? 240 : 312 }
    private var tile: CGFloat { 226 * pairHeight / 312 }

    var body: some View {
        OnboardingBeatFrame(rail: rail) {
            TutorSays(pose: .point,
                      text: "Have you ever looked at something and wanted to draw it?",
                      size: 192)

            pair

            OnboardingNote("This is what you will do. With a real pen, on real paper.")
        } footer: {
            Button("Continue", action: onContinue)
                .buttonStyle(.primary)
        }
    }

    // MARK: - The pair

    /// A photograph rotated −3° at the top left, a sheet of paper rotated +3° at the
    /// bottom right floating over it, and a green chevron where they overlap.
    private var pair: some View {
        Color.clear
            .frame(height: pairHeight)
            .overlay(alignment: .topLeading) {
                // The catalog's references are vector files on a transparent
                // ground, so the tile carries the paper behind them; without it a
                // picture with white sky has no edges and the −3° tilt is invisible.
                ReferenceImageView(reference: lesson?.reference)
                    .frame(width: tile, height: tile)
                    .background(Theme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .rotationEffect(.degrees(-3))
                    .offset(x: 4)
            }
            .overlay(alignment: .bottomTrailing) {
                sheet
                    .frame(width: tile, height: tile)
                    .rotationEffect(.degrees(3))
                    .offset(x: -4)
            }
            .overlay(alignment: .center) { arrow }
            .accessibilityHidden(true)
    }

    private var sheet: some View {
        SelfDrawingView.lesson(lesson?.tutorial, duration: 5.4, delay: 0.6)
            .padding(tile * 0.10)
            .frame(width: tile, height: tile)
            .background(
                RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Theme.paper)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .strokeBorder(Theme.line, lineWidth: 2)
            )
            .floatShadow()
    }

    private var arrow: some View {
        Image(systemName: "chevron.right")
            .scaledFont(20, .heavy, design: .default)
            .foregroundStyle(.white)
            .frame(width: 44, height: 44)
            .background(Circle().fill(Theme.green))
            .background(Circle().fill(Theme.paper).frame(width: 52, height: 52))
    }
}
