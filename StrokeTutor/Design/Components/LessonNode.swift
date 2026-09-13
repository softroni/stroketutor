import SwiftUI

/// A lesson on the path (`.node`): an 84 pt circle with a 5 pt edge under it and the
/// lesson's finished drawing inside at 60 pt.
///
/// * `.done` — gold, white strokes, a gold-deep check badge bottom right.
/// * `.current` — white with a 4 pt green ring and a slow halo (still under Reduce
///   Motion). The only thing on Home that moves.
/// * `.locked` — surface grey, strokes at 25 % ink.
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
            if state == .current {
                Circle().strokeBorder(Theme.green, lineWidth: 4)
            }
            DrawingThumbnail(tutorial: drawing,
                             size: size * 0.71,
                             strokeColor: strokeColor)
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

    @ViewBuilder
    private var badge: some View {
        if state == .done {
            Image(systemName: "checkmark")
                .scaledFont(15, .heavy, design: .default)
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(Circle().fill(Theme.goldDeep))
                .overlay(Circle().strokeBorder(Theme.paper, lineWidth: 3))
                .offset(x: 4, y: 2)
        } else if state == .locked {
            Image(systemName: "lock.fill")
                .scaledFont(13, .bold, design: .default)
                .foregroundStyle(Theme.ink25)
                .frame(width: 26, height: 26)
                .background(Circle().fill(Theme.surface))
                .overlay(Circle().strokeBorder(Theme.paper, lineWidth: 3))
                .offset(x: 4, y: 2)
        }
    }

    // MARK: - Paint

    private var fillColor: Color {
        switch state {
        case .done: return Theme.gold
        case .current: return Theme.paper
        case .locked: return Theme.surface
        }
    }

    private var edgeColor: Color {
        switch state {
        case .done: return Theme.goldDeep
        case .current: return Theme.greenDeep
        case .locked: return Theme.surface2
        }
    }

    private var strokeColor: Color {
        switch state {
        case .done: return .white
        case .current: return Theme.ink
        case .locked: return Theme.ink25
        }
    }
}
