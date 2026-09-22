import SwiftUI

/// A path offered as a picture (`ob-path`): its first lesson's drawing, large, on a
/// sheet of paper, with the path's name underneath and nothing else. The card is a
/// single choice, so it wears the same surface and check as `ChoiceRow`.
///
/// The card fills the height it is offered, so two side by side in a row stay the
/// same height when one title wraps and the other does not.
struct PathPictureCard: View {
    let path: PathModel
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 10) {
                PaperTile {
                    DrawingThumbnail(tutorial: path.lessons.first?.tutorial)
                        .frame(maxWidth: 110)
                        .frame(height: 110)
                        .padding(8)
                        .frame(maxWidth: .infinity)
                }

                Text(path.title)
                    .textRole(.headline)
                    .foregroundStyle(Theme.ink)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity)

                Spacer(minLength: 0)
            }
            .padding(10)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .overlay(alignment: .topTrailing) {
                if isSelected {
                    ChoiceCheck()
                        .padding(8)
                }
            }
            .choiceSurface(isSelected: isSelected, cornerRadius: Theme.cardCornerRadius)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(path.title)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}
