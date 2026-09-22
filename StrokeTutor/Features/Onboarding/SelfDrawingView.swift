import CoreGraphics
import SwiftUI

/// One stroke of a picture that draws itself: the line, how thick it is, when it
/// starts and how long it takes. Coordinates and widths are in the picture's own
/// canvas units, exactly as they are in a tutorial file or in the mockup's SVG.
struct TimedStroke {
    let path: Path
    let lineWidth: CGFloat
    let start: Double
    let duration: Double
    /// Nil draws in the view's tint.
    var color: Color?

    var end: Double { start + duration }
}

/// One area of color in a picture that draws itself: it washes in from clear over
/// `duration` seconds from `start`, under every line, as it does on the player's
/// paper. Coordinates are in canvas units, like `TimedStroke`.
struct TimedFill {
    let path: Path
    let color: Color
    let style: FillStyle
    let start: Double
    let duration: Double

    var end: Double { start + duration }
}

/// A drawing that appears stroke by stroke, in order, with a green pen tip riding
/// the line being drawn. This is `.stroke.draws` plus `.ob-tip` from
/// `docs/ios-design/src/v3/screens/10-onboarding.html`: the launch beat's drawing,
/// the sheet of `ob-1`, the arts of `ob-2` and `ob-3`, and the lesson card of
/// `ob-ready`.
///
/// One `Canvas` under one `TimelineView`, and the timeline stops as soon as the last
/// stroke lands so nothing keeps redrawing behind a beat the learner has left. The
/// canvas transform is applied once to the context rather than to every path, so a
/// sixty-stroke lesson costs one trim per frame.
///
/// Reduce Motion shows the finished picture at once, as every onboarding note asks:
/// none of these is the player's essential stroke animation, they are illustrations.
/// Outside onboarding, a caller passes the system setting in through
/// `onboardingReducesMotion` (`hp-preview` does).
///
/// Onboarding draws in line only. `hp-preview` also gives it the lesson's colors
/// (`coloredLesson`): its fills wash in under the lines as each step lands, and its
/// finished frame is exactly `DrawingThumbnail(strokeColor: nil, showsFills: true)`.
struct SelfDrawingView: View {

    let strokes: [TimedStroke]
    /// The rectangle of canvas units to fit into the view.
    let fit: CGRect
    /// Color under the lines. Empty everywhere in onboarding.
    var fills: [TimedFill] = []
    var tint: Color = Theme.ink
    var showsPenTip: Bool = true
    /// Changing this replays the drawing from the start.
    var replayToken: Int = 0

    @Environment(\.onboardingReducesMotion) private var reducesMotion

    @State private var startDate = Date()
    @State private var hasFinished = false

    private var total: Double {
        max(strokes.map(\.end).max() ?? 0, fills.map(\.end).max() ?? 0)
    }

    /// Seconds from appearing (or a replay) until the last line and color land.
    var totalDuration: Double { total }

    var body: some View {
        Group {
            if reducesMotion || hasFinished || (strokes.isEmpty && fills.isEmpty) {
                Canvas { context, size in
                    draw(&context, size: size, time: total + 1)
                }
            } else {
                TimelineView(.animation) { timeline in
                    Canvas { context, size in
                        draw(&context,
                             size: size,
                             time: timeline.date.timeIntervalSince(startDate))
                    }
                }
            }
        }
        .task(id: replayToken) {
            guard !reducesMotion, total > 0 else {
                hasFinished = true
                return
            }
            startDate = .now
            hasFinished = false
            try? await Task.sleep(for: .seconds(total + 0.1))
            hasFinished = true
        }
        .accessibilityHidden(true)
    }

    // MARK: - Drawing

    private func draw(_ context: inout GraphicsContext, size: CGSize, time: Double) {
        guard fit.width > 0, fit.height > 0, size.width > 0, size.height > 0 else { return }

        let scale = min(size.width / fit.width, size.height / fit.height)
        let transform = CGAffineTransform(
            translationX: (size.width - fit.width * scale) / 2 - fit.minX * scale,
            y: (size.height - fit.height * scale) / 2 - fit.minY * scale
        ).scaledBy(x: scale, y: scale)
        context.concatenate(transform)

        // Nothing may vanish at tile size, and nothing may turn into a blob: the
        // same hairline floor `DrawingThumbnail` uses, expressed in canvas units.
        let floor = max(0.6, min(size.width, size.height) / 70) / scale

        // Color under every line, whatever order the lesson painted them in.
        for fill in fills {
            let progress = fill.duration <= 0
                ? (time >= fill.start ? 1 : 0)
                : min(max((time - fill.start) / fill.duration, 0), 1)
            guard progress > 0 else { continue }
            context.fill(fill.path, with: .color(fill.color.opacity(progress)), style: fill.style)
        }

        for stroke in strokes {
            let progress = stroke.duration <= 0
                ? 1
                : min(max((time - stroke.start) / stroke.duration, 0), 1)
            guard progress > 0 else { continue }

            let width = max(floor, stroke.lineWidth)
            let style = StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round)
            let line = progress >= 1 ? stroke.path : stroke.path.trimmedPath(from: 0, to: progress)
            context.stroke(line, with: .color(stroke.color ?? tint), style: style)

            // The tip rides the line it is drawing and vanishes when it lands.
            if showsPenTip, progress < 1, let head = line.currentPoint {
                let diameter = max(width * 1.7, 6 / scale)
                let dot = CGRect(x: head.x - diameter / 2,
                                 y: head.y - diameter / 2,
                                 width: diameter,
                                 height: diameter)
                context.fill(Path(ellipseIn: dot), with: .color(Theme.green))
            }
        }
    }
}

// MARK: - Building a timeline from a lesson

extension SelfDrawingView {

    /// A lesson drawing itself over `duration` seconds. The lesson's own stroke
    /// durations set the rhythm — a long sweeping line still takes longer than a
    /// short tick — but the whole picture is compressed into the window the beat
    /// has, which is why the launch drawing takes 3.4 s and a lesson takes minutes.
    ///
    /// `steps` limits the picture to the first n steps (`ob-2`'s first tile shows
    /// only the two shapes the lesson opens with).
    static func lesson(_ tutorial: PreparedTutorial?,
                       steps stepLimit: Int? = nil,
                       duration: Double,
                       delay: Double = 0,
                       lineWidthScale: CGFloat = 1,
                       tint: Color = Theme.ink,
                       showsPenTip: Bool = true,
                       replayToken: Int = 0) -> SelfDrawingView {
        guard let tutorial else {
            return SelfDrawingView(strokes: [],
                                   fit: CGRect(x: 0, y: 0, width: 1, height: 1),
                                   tint: tint,
                                   showsPenTip: showsPenTip,
                                   replayToken: replayToken)
        }

        let steps = stepLimit.map { Array(tutorial.steps.prefix($0)) } ?? tutorial.steps
        let source = steps.flatMap(\.strokes)
        let natural = source.reduce(0.0) { $0 + max($1.duration, 0.01) }
        let factor = natural > 0 ? duration / natural : 0

        var strokes: [TimedStroke] = []
        var cursor = delay
        for stroke in source {
            let length = max(stroke.duration, 0.01) * factor
            strokes.append(TimedStroke(path: stroke.path,
                                       lineWidth: CGFloat(stroke.lineWidth) * lineWidthScale,
                                       start: cursor,
                                       duration: length))
            cursor += length
        }

        return SelfDrawingView(strokes: strokes,
                               fit: fitBounds(of: steps, in: tutorial),
                               tint: tint,
                               showsPenTip: showsPenTip,
                               replayToken: replayToken)
    }

    /// A lesson drawing itself in its own colors, for `hp-preview`'s teaser: every
    /// line in its own color over `duration` seconds (the lesson's rhythm compressed
    /// into that window, as in `lesson(_:)`), and each step's fills washing in over
    /// `fillFade` seconds as that step's last line lands — the order the player
    /// paints them in. The whole thing ends `fillFade` after the last line at most,
    /// so a sixty-stroke lesson is over as quickly as a five-stroke one.
    static func coloredLesson(_ tutorial: PreparedTutorial,
                              duration: Double,
                              delay: Double = 0,
                              fillFade: Double = 0.35,
                              showsPenTip: Bool = true,
                              replayToken: Int = 0) -> SelfDrawingView {
        let natural = tutorial.steps
            .flatMap(\.strokes)
            .reduce(0.0) { $0 + max($1.duration, 0.01) }
        let factor = natural > 0 ? duration / natural : 0

        var strokes: [TimedStroke] = []
        var fills: [TimedFill] = []
        var cursor = delay
        for step in tutorial.steps {
            for stroke in step.strokes {
                let length = max(stroke.duration, 0.01) * factor
                strokes.append(TimedStroke(path: stroke.path,
                                           lineWidth: CGFloat(stroke.lineWidth),
                                           start: cursor,
                                           duration: length,
                                           color: stroke.color ?? tutorial.strokeColor))
                cursor += length
            }
            for fill in step.fills {
                fills.append(TimedFill(path: fill.path,
                                       color: fill.color,
                                       style: fill.style,
                                       start: cursor,
                                       duration: fillFade))
            }
        }

        return SelfDrawingView(strokes: strokes,
                               fit: tutorial.drawingBounds,
                               fills: fills,
                               tint: tutorial.strokeColor,
                               showsPenTip: showsPenTip,
                               replayToken: replayToken)
    }

    /// The ink of the steps being shown, grown by half a line width. The whole
    /// lesson's `drawingBounds` would leave the first two steps floating in a
    /// corner of `ob-2`'s tile, so a partial picture is fitted to its own ink.
    private static func fitBounds(of steps: [PreparedStep], in tutorial: PreparedTutorial) -> CGRect {
        guard steps.count < tutorial.steps.count else { return tutorial.drawingBounds }

        var box: CGRect?
        for step in steps {
            for stroke in step.strokes {
                let grown = stroke.path.boundingRect
                    .insetBy(dx: -CGFloat(stroke.lineWidth) / 2, dy: -CGFloat(stroke.lineWidth) / 2)
                box = box.map { $0.union(grown) } ?? grown
            }
        }
        guard let box, box.width > 0, box.height > 0 else { return tutorial.drawingBounds }
        return box.insetBy(dx: -box.width * 0.06, dy: -box.height * 0.06)
    }
}

// MARK: - Building a timeline from the design's own line art

/// A drawn mark of the design itself rather than of a lesson: the pen, the sheet of
/// paper and the clock of `ob-3`, and the learner's wobbly square in `ob-2`. The `d`
/// strings are copied verbatim from the mockup so the two can be compared line for
/// line, and parsed by the app's own parser.
struct ArtStroke {
    let d: String
    var lineWidth: CGFloat = 3.4
    let start: Double
    let duration: Double
}

extension SelfDrawingView {

    /// Line art in its own square box — 100 units unless said otherwise.
    static func art(_ marks: [ArtStroke],
                    box: CGFloat = 100,
                    tint: Color = Theme.ink,
                    showsPenTip: Bool = false,
                    replayToken: Int = 0) -> SelfDrawingView {
        let strokes: [TimedStroke] = marks.compactMap { mark in
            // A `d` string in this file is a literal written beside the mockup's,
            // so a failure here is a typo in this source, not bad content: drop the
            // mark rather than draw something wrong, and let the rest appear.
            guard let path = try? SVGPathParser.parse(mark.d) else { return nil }
            return TimedStroke(path: path,
                               lineWidth: mark.lineWidth,
                               start: mark.start,
                               duration: mark.duration)
        }
        return SelfDrawingView(strokes: strokes,
                               fit: CGRect(x: 0, y: 0, width: box, height: box),
                               tint: tint,
                               showsPenTip: showsPenTip,
                               replayToken: replayToken)
    }
}
