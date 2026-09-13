import SwiftUI

/// Lina's speech bubble (`.speech`): white, radius 20, a 2 pt `--line` border and a
/// small tail pointing at her. 18/bold text with tight tracking. Used in onboarding
/// and at completion — never as a tooltip.
struct SpeechBubble: View {

    enum Tail {
        /// Pointing left, at a Lina standing beside the bubble.
        case leading
        /// Pointing down, at a Lina standing under it.
        case below
    }

    let text: String
    var tail: Tail = .leading

    var body: some View {
        Text(text)
            .font(.system(size: 18, weight: .bold, design: .rounded))
            .tracking(-0.2)
            .foregroundStyle(Theme.ink)
            .lineSpacing(3)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 14)
            .padding(.horizontal, 16)
            .cardBackground(cornerRadius: 20)
            .overlay(alignment: tail == .leading ? .topLeading : .bottom) {
                tailShape
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel(Text("Lina says: \(text)"))
    }

    @ViewBuilder
    private var tailShape: some View {
        switch tail {
        case .leading:
            Triangle(pointing: .leading)
                .fill(Theme.card)
                .overlay(Triangle(pointing: .leading).stroke(Theme.line, lineWidth: 2).mask(
                    Rectangle().padding(.trailing, 4)
                ))
                .frame(width: 12, height: 16)
                .offset(x: -11, y: 24)
        case .below:
            Triangle(pointing: .bottom)
                .fill(Theme.card)
                .overlay(Triangle(pointing: .bottom).stroke(Theme.line, lineWidth: 2).mask(
                    Rectangle().padding(.top, 4)
                ))
                .frame(width: 16, height: 12)
                .offset(y: 11)
        }
    }
}

/// The bubble's tail. Small enough to live here rather than in its own file.
private struct Triangle: Shape {
    enum Direction { case leading, bottom }
    let pointing: Direction

    func path(in rect: CGRect) -> Path {
        var path = Path()
        switch pointing {
        case .leading:
            path.move(to: CGPoint(x: rect.maxX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.minX, y: rect.midY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        case .bottom:
            path.move(to: CGPoint(x: rect.minX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        }
        path.closeSubpath()
        return path
    }
}
