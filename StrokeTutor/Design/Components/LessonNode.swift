import SwiftUI

/// A lesson on the path (`.node`): a circle (`size`, 100 pt on `hp-path`) with a 5 pt
/// edge under it and the lesson's drawing inside at about two thirds of the circle.
/// Every lesson shows its drawing in its own colors, locked ones too, so a learner
/// can see what is coming; the ring, the edge and the badge carry the state.
///
/// * `.done` — white with the same thin gray ring and edge as a locked node, the
///   drawing in color, a green check badge where the lock would sit.
/// * `.current` — white with a green ring, a green-deep edge and a slow halo (still
///   under Reduce Motion), the drawing in color. The only thing on the screen that
///   moves.
/// * `.locked` — white with a thin gray ring and edge, the drawing in color, a gray
///   lock badge — the same look as a locked tile on Home.
struct LessonNode: View {

    enum State: Equatable {
        case done
        case current
        case locked
    }

    let state: State
    let drawing: PreparedTutorial?
    var size: CGFloat = Theme.nodeSize

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @SwiftUI.State private var isPulsing = false

    var body: some View {
        ZStack {
            Circle()
                .fill(edgeColor)
                .offset(y: 5)
            Circle()
                .fill(fillColor)
            Circle().strokeBorder(ringColor, lineWidth: state == .current ? ringWidth : 3)
            DrawingThumbnail(tutorial: drawing,
                             size: size * 0.64,
                             strokeColor: nil,
                             showsFills: true)
        }
        .frame(width: size, height: size)
        .background(alignment: .center) { halo }
        .overlay(alignment: .bottomTrailing) { badge }
        .padding(.bottom, 5)
    }

    // MARK: - Parts

    @ViewBuilder
    private var halo: some View {
        if state == .current {
            Circle()
                .strokeBorder(Theme.greenSoft, lineWidth: 3)
                .padding(-9)
                .scaleEffect(isPulsing ? 1.08 : 1)
                .opacity(isPulsing ? 0.45 : 1)
                .animation(reduceMotion
                           ? nil
                           : .easeInOut(duration: 1.1).repeatForever(autoreverses: true),
                           value: isPulsing)
                .onAppear { isPulsing = true }
                .allowsHitTesting(false)
        }
    }

    /// The badges grow with the node, so a 100 pt node does not wear an 84 pt one's.
    private var badgeSize: CGFloat { (size * 0.32).rounded() }

    @ViewBuilder
    private var badge: some View {
        if state == .done {
            Image(systemName: "checkmark")
                .font(.system(size: badgeSize * 0.45, weight: .heavy))
                .foregroundStyle(.white)
                .frame(width: badgeSize, height: badgeSize)
                .background(Circle().fill(Theme.green))
                .overlay(Circle().strokeBorder(Theme.paper, lineWidth: 3))
                .offset(x: 4, y: 2)
        } else if state == .locked {
            Image(systemName: "lock.fill")
                .font(.system(size: badgeSize * 0.45, weight: .bold))
                .foregroundStyle(Theme.ink40)
                .frame(width: badgeSize, height: badgeSize)
                .background(Circle().fill(Theme.surface2))
                .overlay(Circle().strokeBorder(Theme.paper, lineWidth: 3))
                .offset(x: 4, y: 2)
        }
    }

    // MARK: - Paint

    private var fillColor: Color { Theme.paper }

    private var ringColor: Color {
        switch state {
        case .current: return Theme.green
        case .done, .locked: return Theme.line
        }
    }

    /// Thick enough to read as the node's color at a glance: about 6 pt at 100 pt.
    private var ringWidth: CGFloat { max(4, (size * 0.06).rounded()) }

    private var edgeColor: Color {
        switch state {
        case .current: return Theme.greenDeep
        case .done, .locked: return Theme.lineStrong
        }
    }
}
