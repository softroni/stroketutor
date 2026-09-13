import SwiftUI

/// The player's 56 pt header (`pl-player` `.navbar`): the close button, the written
/// position over the step segments, and the ⋯ menu. No lesson title — the paper is
/// the subject, and the title would only compete with the instruction.
///
/// In landscape the same header sits at the top of the side panel, 44 pt tall with
/// 44 pt gutters (`#pl-landscape .pl-panel .navbar`).
struct PlayerHeader<Menu: View>: View {
    /// The step in play, zero-based. Nil before the lesson starts.
    let stepIndex: Int?
    let stepCount: Int
    var isCompact: Bool = false
    let onClose: () -> Void
    @ViewBuilder let menu: () -> Menu

    var body: some View {
        HStack(spacing: 0) {
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .scaledFont(19, .bold, design: .default)
                    .foregroundStyle(Theme.ink)
                    .frame(width: Theme.navTapTarget, height: Theme.navTapTarget)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .frame(width: side, alignment: .leading)
            .accessibilityLabel("Close lesson")

            VStack(spacing: 6) {
                Text(label)
                    .textRole(.subhead)
                    .foregroundStyle(Theme.ink55)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                StepSegments(stepCount: stepCount, currentIndex: stepIndex)
            }
            .padding(.horizontal, 6)
            .frame(maxWidth: .infinity)
            .accessibilityElement(children: .combine)

            SwiftUI.Menu {
                menu()
            } label: {
                Image(systemName: "ellipsis")
                    .scaledFont(19, .bold, design: .default)
                    .foregroundStyle(Theme.ink)
                    .frame(width: Theme.navTapTarget, height: Theme.navTapTarget)
                    .contentShape(Rectangle())
            }
            .frame(width: side, alignment: .trailing)
            .accessibilityLabel("More options. Speed, narration, start over")
        }
        .padding(.horizontal, isCompact ? 0 : 8)
        .frame(height: isCompact ? 44 : 56)
        .background(Theme.paper)
    }

    /// The mockup's grid columns: 60 pt gutters in portrait, 44 in the panel.
    private var side: CGFloat {
        isCompact ? 44 : 60
    }

    private var label: String {
        guard let stepIndex else { return "Before you start" }
        return "Step \(min(stepIndex + 1, max(stepCount, 1))) of \(max(stepCount, 1))"
    }
}
