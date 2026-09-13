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
            .textRole(.speech)
            .foregroundStyle(Theme.ink)
            .lineSpacing(3)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 14)
            .padding(.horizontal, 16)
            .background(BubbleShape(tail: tail).fill(Theme.card))
            .overlay(BubbleShape(tail: tail).stroke(Theme.line, lineWidth: 2))
            .accessibilityElement(children: .combine)
            .accessibilityLabel(Text("Lina says: \(text)"))
    }
}

/// The bubble and its tail as one outline (`.speech::before/::after` in the CSS), so
/// the 2 pt border runs around the tail instead of crossing it. The tail is drawn
/// outside the view's bounds: 9 pt to the leading side, 24 pt down, or 9 pt below the
/// bottom edge at the centre.
private struct BubbleShape: Shape {
    let tail: SpeechBubble.Tail
    private let radius: CGFloat = 20
    private let tailDepth: CGFloat = 9
    private let tailHalf: CGFloat = 8

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let r = min(radius, rect.width / 2, rect.height / 2)
        path.move(to: CGPoint(x: rect.minX + r, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX - r, y: rect.minY))
        path.addArc(center: CGPoint(x: rect.maxX - r, y: rect.minY + r), radius: r,
                    startAngle: .degrees(-90), endAngle: .degrees(0), clockwise: false)
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - r))
        path.addArc(center: CGPoint(x: rect.maxX - r, y: rect.maxY - r), radius: r,
                    startAngle: .degrees(0), endAngle: .degrees(90), clockwise: false)
        if tail == .below {
            let mid = rect.midX
            path.addLine(to: CGPoint(x: mid + tailHalf, y: rect.maxY))
            path.addLine(to: CGPoint(x: mid, y: rect.maxY + tailDepth))
            path.addLine(to: CGPoint(x: mid - tailHalf, y: rect.maxY))
        }
        path.addLine(to: CGPoint(x: rect.minX + r, y: rect.maxY))
        path.addArc(center: CGPoint(x: rect.minX + r, y: rect.maxY - r), radius: r,
                    startAngle: .degrees(90), endAngle: .degrees(180), clockwise: false)
        if tail == .leading {
            let y = min(rect.minY + 32, rect.maxY - r - tailHalf)
            path.addLine(to: CGPoint(x: rect.minX, y: y + tailHalf))
            path.addLine(to: CGPoint(x: rect.minX - tailDepth, y: y))
            path.addLine(to: CGPoint(x: rect.minX, y: y - tailHalf))
        }
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY + r))
        path.addArc(center: CGPoint(x: rect.minX + r, y: rect.minY + r), radius: r,
                    startAngle: .degrees(180), endAngle: .degrees(270), clockwise: false)
        path.closeSubpath()
        return path
    }
}
