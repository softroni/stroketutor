import SwiftUI

/// A lesson on one of Home's shelves, which sit on the path's own tint
/// (`PathTint`): a rounded square with the drawing on it and the lesson's name
/// underneath. The picture does the talking — a learner who cannot read the name
/// yet can still choose.
///
/// * `.done` — white paper, the drawing in its own colors, a gold ring and edge and
///   a gold check badge: a finished drawing, as on the path screen's nodes.
/// * `.next` — white paper, the drawing in color, a green ring and edge and a
///   "Next" flag: the one to draw now.
/// * `.locked` — a lighter wash of the path's tint, the drawing as a faded outline
///   in the path's deep color, and a small lock: what is coming, in the path's
///   colors rather than a wall of gray.
struct LessonTile: View {

    enum State: Equatable {
        case done
        case next
        case locked
    }

    let lesson: Lesson
    /// The lesson's one-based place in its path, for VoiceOver.
    let position: Int
    let state: State
    let tint: PathTint
    let action: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// The square's edge. Two and a half tiles fit inside a shelf on a phone, so
    /// the shelf always shows that there is more to the right.
    static let size: CGFloat = 124

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                square
                Text(lesson.title)
                    .scaledFont(15, .bold, relativeTo: .subheadline)
                    .foregroundStyle(state == .locked ? tint.deep.opacity(0.7) : Theme.ink)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(width: Self.size, alignment: .topLeading)
            }
        }
        .buttonStyle(LessonTileButtonStyle(reduceMotion: reduceMotion))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Parts

    private var square: some View {
        let shape = RoundedRectangle(cornerRadius: Theme.thumbCornerRadius + 2, style: .continuous)
        let isLocked = state == .locked
        return DrawingThumbnail(tutorial: lesson.tutorial,
                                size: Self.size - 34,
                                strokeColor: isLocked ? tint.deep.opacity(0.32) : nil,
                                showsFills: !isLocked)
            .frame(width: Self.size, height: Self.size)
            .background(shape.fill(isLocked ? Theme.paper.opacity(0.5) : Theme.paper))
            .overlay {
                if let ringColor {
                    shape.strokeBorder(ringColor, lineWidth: 4)
                }
            }
            .background(alignment: .bottom) {
                shape.fill(edgeColor).offset(y: 4)
            }
            .overlay(alignment: .topTrailing) { badge }
            .overlay(alignment: .topLeading) { flag }
            .padding(.bottom, 4)
    }

    @ViewBuilder
    private var badge: some View {
        switch state {
        case .done:
            Image(systemName: "checkmark")
                .scaledFont(13, .heavy, relativeTo: .footnote, design: .default)
                .foregroundStyle(.white)
                .frame(width: 30, height: 30)
                .background(Circle().fill(Theme.gold))
                .overlay(Circle().strokeBorder(Theme.paper, lineWidth: 3))
                .offset(x: 6, y: -6)
        case .locked:
            Image(systemName: "lock.fill")
                .scaledFont(11, .bold, relativeTo: .footnote, design: .default)
                .foregroundStyle(tint.deep.opacity(0.6))
                .frame(width: 26, height: 26)
                .background(Circle().fill(Theme.paper))
                .padding(8)
        case .next:
            EmptyView()
        }
    }

    @ViewBuilder
    private var flag: some View {
        if state == .next {
            Text("Next")
                .scaledFont(13, .heavy, relativeTo: .footnote)
                .foregroundStyle(.white)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Capsule().fill(Theme.green))
                .overlay(Capsule().strokeBorder(Theme.paper, lineWidth: 2.5))
                .offset(x: -4, y: -10)
        }
    }

    // MARK: - Paint

    private var ringColor: Color? {
        switch state {
        case .done: return Theme.gold
        case .next: return Theme.green
        case .locked: return nil
        }
    }

    private var edgeColor: Color {
        switch state {
        case .done: return Theme.goldDeep
        case .next: return Theme.greenDeep
        case .locked: return tint.edge
        }
    }

    private var accessibilityLabel: String {
        let status: String
        switch state {
        case .done: status = "drawn"
        case .next: status = "next to draw"
        case .locked: status = "locked"
        }
        return "Lesson \(position), \(lesson.title), \(status)"
    }
}

/// A tile gives a little under the finger, like every other pressable thing in v3 —
/// unless Reduce Motion is on, when it only dims.
private struct LessonTileButtonStyle: ButtonStyle {
    let reduceMotion: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.96 : 1)
            .opacity(configuration.isPressed && reduceMotion ? 0.7 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
