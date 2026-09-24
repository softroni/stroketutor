import SwiftUI

/// The hero of `sk-complete`: the lesson, whole and in its own colours, on a white
/// 3 : 4 page inside a soft gold frame, with the gold "Drawn · 12 Sep" chip sitting
/// clear of the drawing at the foot of the page.
///
/// The page is `PageThumb` with no drawing in it, so the paper, the radius and the
/// 3 : 4 are the ones every other page in the app uses; the drawing is laid over it
/// in the band the mockup reserves (`#sk-complete .sk-page svg`: top 8 %, height
/// 72 %), which is what keeps the chip off the strokes.
///
/// The drawing paints itself once, in about 3.5 s — the same lines *and the same
/// colour* the learner just put on the paper, finished. That is the whole of the
/// celebration, per the screen's caption ("No confetti, no score"). Under Reduce
/// Motion it is simply there, coloured, on appear.
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

/// A tutorial painting itself once, in lesson order, over `total` seconds: the lines
/// draw themselves on and each step's colour washes in behind them as that step's
/// lines land, the way it happened on the player's paper.
///
/// Every stroke and every fill gets a share of the time in proportion to its own
/// duration, so a long sweep still takes longer than a short tick, and the whole
/// drawing lands in the same 3.5 s however many pieces it has.
struct DrawOnDrawing: View {
    let tutorial: PreparedTutorial
    var animated: Bool = true
    /// Seconds for the whole drawing, as in `sk-complete`'s caption.
    var total: Double = 3.5

    /// The lesson laid out on one timeline, built once rather than on every frame.
    private let timeline: DrawingTimeline

    @State private var start: Date?
    @State private var isFinished = false

    init(tutorial: PreparedTutorial, animated: Bool = true, total: Double = 3.5) {
        self.tutorial = tutorial
        self.animated = animated
        self.total = total
        self.timeline = DrawingTimeline(tutorial: tutorial)
    }

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

    /// Everything reached by `progress`: colour first, then the lines over it, the
    /// one being drawn trimmed to where the pen has got to.
    private func canvas(at progress: Double) -> some View {
        Canvas { context, size in
            let bounds = tutorial.drawingBounds
            guard bounds.width > 0, bounds.height > 0 else { return }
            let scale = min(size.width / bounds.width, size.height / bounds.height)
            let transform = CGAffineTransform(
                translationX: (size.width - bounds.width * scale) / 2 - bounds.minX * scale,
                y: (size.height - bounds.height * scale) / 2 - bounds.minY * scale
            ).scaledBy(x: scale, y: scale)

            let elapsed = min(max(progress, 0), 1) * timeline.span

            // Colour under every line, as on the player's paper: a fill never
            // covers a stroke, whatever order the lesson painted them in.
            for entry in timeline.fills {
                let fraction = entry.beat.fraction(at: elapsed)
                guard fraction > 0 else { continue }
                context.fill(entry.fill.path.applying(transform),
                             with: .color(entry.fill.color.opacity(fraction)),
                             style: entry.fill.style)
            }

            for entry in timeline.strokes {
                let fraction = entry.beat.fraction(at: elapsed)
                guard fraction > 0 else { continue }
                let path = entry.stroke.path.trimmedPath(from: 0, to: fraction).applying(transform)
                context.stroke(path,
                               with: .color(entry.stroke.color ?? tutorial.strokeColor),
                               style: StrokeStyle(lineWidth: max(0.8, CGFloat(entry.stroke.lineWidth) * scale),
                                                  lineCap: .round,
                                                  lineJoin: .round))
            }
        }
    }
}

/// Every stroke and fill of a lesson placed end to end on one timeline, in lesson
/// order — within a step the lines first and then that step's colour, which is the
/// order `DrawingCanvasView` plays them in.
struct DrawingTimeline {
    /// When one piece starts and how long it owns, in the lesson's own duration
    /// units. `span` scales the lot to whatever wall-clock time the caller wants.
    struct Beat {
        let start: Double
        let share: Double

        func fraction(at elapsed: Double) -> Double {
            guard share > 0 else { return elapsed >= start ? 1 : 0 }
            return min(max((elapsed - start) / share, 0), 1)
        }
    }

    let strokes: [(stroke: PreparedStroke, beat: Beat)]
    let fills: [(fill: PreparedFill, beat: Beat)]
    /// The length of the whole timeline, never zero, so `progress * span` is safe.
    let span: Double

    init(tutorial: PreparedTutorial) {
        var strokes: [(stroke: PreparedStroke, beat: Beat)] = []
        var fills: [(fill: PreparedFill, beat: Beat)] = []
        var cursor: Double = 0

        for step in tutorial.steps {
            for stroke in step.strokes {
                // A floor, so a lesson that leaves a duration at zero still shows
                // that piece arriving rather than snapping in with its neighbour.
                let share = max(0.05, stroke.duration)
                strokes.append((stroke, Beat(start: cursor, share: share)))
                cursor += share
            }
            for fill in step.fills {
                let share = max(0.05, fill.duration)
                fills.append((fill, Beat(start: cursor, share: share)))
                cursor += share
            }
        }

        self.strokes = strokes
        self.fills = fills
        self.span = cursor > 0 ? cursor : 1
    }
}
