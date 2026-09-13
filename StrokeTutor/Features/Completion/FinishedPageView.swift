import SwiftUI

/// The hero of `sk-complete`: the lesson, whole, on a white 3 : 4 page inside a soft
/// gold frame, with the gold "Drawn · 12 Sep" chip sitting clear of the drawing at
/// the foot of the page.
///
/// The page is `PageThumb` with no drawing in it, so the paper, the radius and the
/// 3 : 4 are the ones every other page in the app uses; the drawing is laid over it
/// in the band the mockup reserves (`#sk-complete .sk-page svg`: top 8 %, height
/// 72 %), which is what keeps the chip off the strokes.
///
/// The drawing draws itself once, in about 3.5 s, the same strokes the learner just
/// copied — the whole of the celebration, per the screen's caption ("No confetti, no
/// score"). Under Reduce Motion it is simply there on appear.
struct FinishedPageView: View {
    let tutorial: PreparedTutorial
    /// The text of the gold chip, "Drawn · 12 Sep".
    let chipText: String

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// The chip's laid-out height, so the band the drawing keeps clear at the foot of
    /// the page is the height of the chip that actually sits there, not a guess that
    /// only holds at the default type size.
    @State private var chipHeight: CGFloat = 34

    var body: some View {
        PageThumb(tutorial: nil)
            .overlay {
                GeometryReader { geometry in
                    DrawOnDrawing(tutorial: tutorial, animated: !reduceMotion)
                        .padding(.horizontal, geometry.size.width * 0.10)
                        .padding(.top, geometry.size.height * 0.08)
                        .padding(.bottom, max(geometry.size.height * 0.20, chipHeight + 24))
                }
            }
            .overlay(alignment: .bottom) {
                // One line, always: wrapped to two it climbs into the drawing. It
                // may shrink a fifth before it is allowed to grow taller.
                Chip(text: chipText, systemImage: "checkmark", style: .gold)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
                    .minimumScaleFactor(0.8)
                    .measuredHeight { chipHeight = $0 }
                    .padding(.bottom, 14)
            }
            // inset 0 0 0 2px rgba(gold, .55)
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(Theme.gold.opacity(0.55), lineWidth: 2)
            )
            // 0 0 0 6px var(--gold-soft): a solid ring, not a shadow.
            .background(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(Theme.goldSoft)
                    .padding(-6)
            )
    }
}

/// A tutorial's strokes drawing themselves once, in lesson order, over `total`
/// seconds. Each stroke gets a share of the time in proportion to its own duration,
/// so a long sweep still takes longer than a short tick, and the whole drawing lands
/// in the same 3.5 s however many strokes it has.
struct DrawOnDrawing: View {
    let tutorial: PreparedTutorial
    var animated: Bool = true
    /// Seconds for the whole drawing, as in `sk-complete`'s caption.
    var total: Double = 3.5

    @State private var start: Date?
    @State private var isFinished = false

    var body: some View {
        Group {
            if animated, !isFinished, let start {
                TimelineView(.animation) { timeline in
                    canvas(at: timeline.date.timeIntervalSince(start) / total)
                }
            } else {
                canvas(at: 1)
            }
        }
        .onAppear {
            guard animated, start == nil else { return }
            start = Date()
            Task {
                try? await Task.sleep(for: .seconds(total + 0.1))
                isFinished = true
            }
        }
        .accessibilityHidden(true)
    }

    /// Every stroke up to `progress` of the way through the drawing, the one being
    /// drawn trimmed to where the pen has got to.
    private func canvas(at progress: Double) -> some View {
        Canvas { context, size in
            let bounds = tutorial.drawingBounds
            guard bounds.width > 0, bounds.height > 0 else { return }
            let scale = min(size.width / bounds.width, size.height / bounds.height)
            let transform = CGAffineTransform(
                translationX: (size.width - bounds.width * scale) / 2 - bounds.minX * scale,
                y: (size.height - bounds.height * scale) / 2 - bounds.minY * scale
            ).scaledBy(x: scale, y: scale)

            let (shares, units) = schedule
            let clamped = min(max(progress, 0), 1)
            var elapsed = clamped * units

            for (index, stroke) in strokes.enumerated() {
                let share = shares[index]
                guard elapsed > 0 else { break }
                let fraction = share > 0 ? min(1, elapsed / share) : 1
                elapsed -= share

                let path = stroke.path.trimmedPath(from: 0, to: fraction).applying(transform)
                context.stroke(path,
                               with: .color(stroke.color ?? tutorial.strokeColor),
                               style: StrokeStyle(lineWidth: max(0.8, CGFloat(stroke.lineWidth) * scale),
                                                  lineCap: .round,
                                                  lineJoin: .round))
            }
        }
    }

    private var strokes: [PreparedStroke] {
        tutorial.steps.flatMap(\.strokes)
    }

    /// How long each stroke owns, normalised so they add up to 1 (of `total`).
    private var schedule: (shares: [Double], total: Double) {
        let durations = strokes.map { max(0.05, $0.duration) }
        let sum = durations.reduce(0, +)
        guard sum > 0 else {
            let even = Array(repeating: 1.0, count: max(1, durations.count))
            return (even, Double(even.count))
        }
        return (durations, sum)
    }
}
