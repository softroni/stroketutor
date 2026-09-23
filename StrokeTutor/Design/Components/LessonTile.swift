import SwiftUI

/// A lesson on one of Home's shelves: a rounded square of white paper with the
/// lesson drawn on it in its own colors, and the lesson's name underneath. The
/// picture does the talking — a learner who cannot read the name yet can still
/// choose.
///
/// * `.done` — white paper, the drawing in its own colors, a gold ring and edge and
///   a gold check badge: a finished drawing, as on the path screen's nodes.
/// * `.next` — white paper, the drawing in color, a green ring and edge and a
///   "Next" flag: the one to draw now.
/// * `.locked` — the same full-color drawing on white paper behind a thin gray
///   border and edge, with a small lock and a quieter name: what is coming, shown
///   whole so it is something to look forward to.
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
    /// The square's edge. Home's shelves use the default; the Lessons grid passes
    /// its column's width.
    var size: CGFloat = LessonTile.defaultSize
    let action: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// The shelf tile's edge. Two and a half tiles fit inside a shelf on a phone, so
    /// the shelf always shows that there is more to the right.
    static let defaultSize: CGFloat = 124

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                square
                Text(lesson.title)
                    .scaledFont(15, .bold, relativeTo: .subheadline)
                    .foregroundStyle(state == .locked ? Theme.ink55 : Theme.ink)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(width: size, alignment: .topLeading)
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
        return DrawingThumbnail(tutorial: lesson.tutorial,
                                // 90 pt on the 124 pt shelf tile, in proportion at any size.
                                size: size * 90 / 124,
                                strokeColor: nil,
                                showsFills: true)
            .frame(width: size, height: size)
            .background(shape.fill(Theme.paper))
            .overlay {
                shape.strokeBorder(ringColor, lineWidth: state == .locked ? 2 : 4)
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
                .foregroundStyle(Theme.ink40)
                .frame(width: 26, height: 26)
                .background(Circle().fill(Theme.surface))
                .overlay(Circle().strokeBorder(Theme.paper, lineWidth: 2))
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

    private var ringColor: Color {
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
        case .locked: return Theme.lineStrong
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
