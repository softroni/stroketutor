import SwiftUI

/// `ob-3` — "A pen, paper, five minutes." The objection-handling beat: nothing to
/// buy, nothing to set up. Three rows, each drawing itself in pen, staggered left to
/// right so the eye reads down the list as they appear.
struct OnboardingKitBeat: View {

    let rail: OnboardingRail
    let onContinue: () -> Void

    var body: some View {
        OnboardingBeatFrame(rail: rail) {
            VStack(alignment: .leading, spacing: 8) {
                Text("A pen, paper, five minutes.")
                    .textRole(.largeTitle)
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text("Nothing else. The pen you already own is the right pen.")
                    .textRole(.body)
                    .foregroundStyle(Theme.ink55)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Spacer(minLength: 0)

            VStack(spacing: Theme.stackSpacing) {
                KitRow(title: "A pen",
                       detail: "Any you have. A ballpoint is fine.",
                       marks: Self.pen)
                KitRow(title: "Paper",
                       detail: "One sheet. A notebook works, so does an envelope.",
                       marks: Self.paper)
                KitRow(title: "Five minutes",
                       detail: "Most lessons take about four.",
                       marks: Self.clock)
            }

            Spacer(minLength: 0)

            OnboardingNote("Get them now if you like. The app will wait.")
        } footer: {
            Button("Continue", action: onContinue)
                .buttonStyle(.primary)
        }
    }

    // MARK: - The three drawings

    // The design's own pen-and-ink marks, `d` for `d` from
    // `src/v3/screens/10-onboarding.html`, in a 100-unit box at 3.4 units.

    private static let pen = [
        ArtStroke(d: "M 30 70 L 62 26 L 72 33 L 40 77 Z", start: 0.3, duration: 1.2),
        ArtStroke(d: "M 30 70 L 40 77 L 26 83 Z", start: 1.5, duration: 0.6),
        ArtStroke(d: "M 47 55 L 57 62", start: 2.1, duration: 0.4)
    ]

    private static let paper = [
        ArtStroke(d: "M 28 16 L 60 16 L 76 32 L 76 86 L 28 86 Z", start: 0.8, duration: 1.4),
        ArtStroke(d: "M 60 16 L 60 32 L 76 32", start: 2.2, duration: 0.5),
        ArtStroke(d: "M 38 52 L 66 52", start: 2.7, duration: 0.4),
        ArtStroke(d: "M 38 64 L 58 64", start: 3.1, duration: 0.3)
    ]

    private static let clock = [
        ArtStroke(d: "M 50 18 C 67.7 18 82 32.3 82 50 C 82 67.7 67.7 82 50 82 C 32.3 82 18 67.7 18 50 C 18 32.3 32.3 18 50 18 Z",
                  start: 1.3, duration: 1.4),
        ArtStroke(d: "M 50 30 L 50 51 L 64 58", start: 2.7, duration: 0.6)
    ]
}

/// One row of the kit (`.ob-kit`): an 84 pt sheet of paper with a drawn mark on it,
/// a 20/heavy title and a 15/semibold line. Not tappable — there is nothing to do
/// here but read it.
private struct KitRow: View {
    let title: String
    let detail: String
    let marks: [ArtStroke]

    var body: some View {
        HStack(spacing: 16) {
            PaperTile { SelfDrawingView.art(marks) }
                .frame(width: 84, height: 84)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .textRole(.title3)
                    .foregroundStyle(Theme.ink)
                Text(detail)
                    .textRole(.subhead)
                    .foregroundStyle(Theme.ink55)
            }
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.leading, 12)
        .padding(.trailing, 16)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Theme.surface)
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(title). \(detail)")
    }
}
