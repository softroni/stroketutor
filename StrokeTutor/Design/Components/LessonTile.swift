import SwiftUI

/// A lesson on Home's shelves: a rounded square of white paper with the finished
/// drawing on it in its own colors, and the lesson's name underneath. The picture
/// does the talking — a learner who cannot read the name yet can still choose.
///
/// * `.done` — a gold border and edge, a gold check badge in the corner.
/// * `.next` — a green border and edge and a "Next" flag: the one to draw now.
/// * `.locked` — soft grey, the drawing washed out but still in color, so the shelf
///   reads as what is coming rather than as a wall of grey. A lock badge in the corner.
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
    let action: () -> Void

    /// The square's edge. Two and a half tiles fit a phone's width, so the shelf
    /// always shows that there is more to the right.
    static let size: CGFloat = 132

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                square
                Text(lesson.title)
                    .scaledFont(15, .bold)
                    .foregroundStyle(state == .locked ? Theme.ink55 : Theme.ink)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .frame(width: Self.size, alignment: .topLeading)
            }
        }
        .buttonStyle(LessonTileButtonStyle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Parts

    private var square: some View {
        let shape = RoundedRectangle(cornerRadius: Theme.cardCornerRadius, style: .continuous)
        return DrawingThumbnail(tutorial: lesson.tutorial,
                                size: Self.size - 36,
                                strokeColor: nil,
                                showsFills: true)
            .opacity(state == .locked ? 0.45 : 1)
            .frame(width: Self.size, height: Self.size)
            .background(shape.fill(state == .locked ? Theme.surface : Theme.paper))
            .overlay(shape.strokeBorder(borderColor, lineWidth: state == .next ? 3 : 2))
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
                .scaledFont(14, .heavy, design: .default)
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(Circle().fill(Theme.goldDeep))
                .overlay(Circle().strokeBorder(Theme.paper, lineWidth: 3))
                .padding(8)
        case .locked:
            Image(systemName: "lock.fill")
                .scaledFont(12, .bold, design: .default)
                .foregroundStyle(Theme.ink40)
                .frame(width: 28, height: 28)
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
                .scaledFont(12, .heavy)
                .foregroundStyle(.white)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Capsule().fill(Theme.green))
                .padding(10)
        }
    }

    // MARK: - Paint

    private var borderColor: Color {
        switch state {
        case .done: return Theme.gold
        case .next: return Theme.green
        case .locked: return Theme.line
        }
    }

    private var edgeColor: Color {
        switch state {
        case .done: return Theme.goldDeep
        case .next: return Theme.greenDeep
        case .locked: return Theme.surface2
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

/// A tile gives a little under the finger, like every other pressable thing in v3.
private struct LessonTileButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
