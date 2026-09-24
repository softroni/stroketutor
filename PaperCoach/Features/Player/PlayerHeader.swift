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
    /// What the intro is showing, in place of "Before you start".
    var caption: String?
    var isCompact: Bool = false
    /// False on the guided first lesson: the close button and the ⋯ menu are left
    /// off, their columns kept empty so the step label stays centred.
    var showsExits: Bool = true
    let onClose: () -> Void
    @ViewBuilder let menu: () -> Menu

    var body: some View {
        HStack(spacing: 0) {
            if showsExits {
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
            } else {
                Color.clear.frame(width: side, height: 1)
            }

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

            if showsExits {
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
            } else {
                Color.clear.frame(width: side, height: 1)
            }
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
        guard let stepIndex else { return caption ?? "Before you start" }
        return "Step \(min(stepIndex + 1, max(stepCount, 1))) of \(max(stepCount, 1))"
    }
}
