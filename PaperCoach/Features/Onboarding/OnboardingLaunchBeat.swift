import SwiftUI

/// `ob-splash` — the launch beat. The app icon puts itself together on its own
/// mint: the sheet lands, a dashed guide appears, the pencil comes in and writes
/// the e along the guide, the two sparkle marks pop, and the wordmark rises in
/// under it. The last frame is the icon on the home screen, so the app opens on
/// the picture the learner just tapped.
///
/// It is shown on first run and again after "Reset onboarding", because both start
/// `OnboardingFlow` from this beat. It plays through (about 4 s) and then goes on
/// as soon as the catalog is ready; a tap goes on at once.
///
/// Reduce Motion shows the finished icon and wordmark and holds them briefly.
struct OnboardingLaunchBeat: View {

    let onFinished: () -> Void

    @Environment(AppModel.self) private var app
    @Environment(\.onboardingReducesMotion) private var reducesMotion

    @State private var startDate = Date()
    @State private var hasFinishedDrawing = false
    @State private var hasLeft = false

    var body: some View {
        TimelineView(.animation(paused: hasFinishedDrawing)) { timeline in
            Canvas { context, size in
                let time = Self.frozenTime ?? (reducesMotion || hasFinishedDrawing
                    ? SplashScene.drawingEnd
                    : timeline.date.timeIntervalSince(startDate) - SplashScene.leadIn)
                SplashScene.draw(in: &context, size: size, time: time)
            }
        }
        .ignoresSafeArea()
        .background(SplashArt.background.ignoresSafeArea())
        .contentShape(Rectangle())
        .onTapGesture { leave() }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Paper Coach")
        .accessibilityAddTraits(.isHeader)
        .accessibilityAction { leave() }
        .task {
            guard Self.frozenTime == nil else { return }
            startDate = .now
            let hold = reducesMotion
                ? SplashScene.reducedMotionHold
                : SplashScene.leadIn + SplashScene.drawingEnd
            try? await Task.sleep(for: .seconds(hold))
            hasFinishedDrawing = true
            if !reducesMotion {
                // A beat on the finished icon before moving on.
                try? await Task.sleep(for: .seconds(SplashScene.finalHold))
            }
            guard !Task.isCancelled else { return }
            leave()
        }
    }

    /// DEBUG only: `-splashFreezeAt 1.8` holds the beat on that moment of its
    /// timeline and never moves on, so a device can be screenshotted mid-drawing.
    private static var frozenTime: Double? {
        #if DEBUG
        guard UserDefaults.standard.object(forKey: "splashFreezeAt") != nil else { return nil }
        return UserDefaults.standard.double(forKey: "splashFreezeAt")
        #else
        return nil
        #endif
    }

    private func leave() {
        guard !hasLeft else { return }
        hasLeft = true
        Task {
            // The catalog is loaded before the cover is presented; this is the
            // belt-and-braces case where it is not yet.
            while !app.hasLoadedContent && !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(50))
            }
            onFinished()
        }
    }
}

// MARK: - The scene

/// Draws the launch beat at any moment of its timeline. Everything is placed in
/// the icon's 1254-unit canvas (`SplashArt`) plus the wordmark under it, and that
/// group is scaled as one piece to fit the screen: the pencil's lead, the ink and
/// the dashes share one coordinate space and cannot drift apart on any device.
private enum SplashScene {

    // MARK: Timeline, in seconds

    /// Plain mint before anything moves. After "Reset onboarding" the cover is
    /// still sliding up for about this long, and the sheet should land on a
    /// screen that has stopped moving.
    static let leadIn = 0.3

    static let paperIn = 0.10...0.62
    static let guideStart = 0.42
    static let guideStagger = 0.035
    static let guideFade = 0.22
    static let pencilIn = 0.55...1.02
    static let writing = 1.05...2.45
    static let sparkleStarts = [2.42, 2.54]
    static let sparklePop = 0.42
    static let wordmarkIn = 2.55...3.15
    /// Everything has landed.
    static let drawingEnd = 3.2
    /// How long the finished icon stays before the beat moves on.
    static let finalHold = 0.6
    static let reducedMotionHold = 1.4

    // MARK: Layout, in canvas units

    /// The ink of the icon's picture: sheet, pencil and sparkles, without the
    /// icon's own margins.
    static let artBox = CGRect(x: 54, y: 45, width: 1163, height: 1173)
    static let wordmarkWidth: CGFloat = 1060
    static let wordmarkGap: CGFloat = 84

    static var wordmarkRect: CGRect {
        let height = wordmarkWidth / SplashArt.wordmarkAspect
        return CGRect(x: artBox.midX - wordmarkWidth / 2,
                      y: artBox.maxY + wordmarkGap,
                      width: wordmarkWidth,
                      height: height)
    }

    /// The art and the wordmark together: what has to fit on screen.
    static var groupBox: CGRect { artBox.union(wordmarkRect) }

    /// Units to points. The group takes about three quarters of a phone's width,
    /// as in the splash mock; on iPad it stops growing at 480 pt wide, and on a
    /// short or landscape screen height limits it.
    static func scale(for size: CGSize) -> CGFloat {
        let box = groupBox
        return min(size.width * 0.74 / box.width,
                   size.height * 0.64 / box.height,
                   480 / box.width)
    }

    // MARK: Drawing

    static func draw(in context: inout GraphicsContext, size: CGSize, time: Double) {
        guard size.width > 0, size.height > 0 else { return }

        let scale = scale(for: size)
        let box = groupBox
        // Centered across, a little above the middle down, like the mock.
        let origin = CGPoint(x: size.width / 2 - box.midX * scale,
                             y: size.height * 0.47 - box.midY * scale)
        context.translateBy(x: origin.x, y: origin.y)
        context.scaleBy(x: scale, y: scale)

        drawPaper(in: context, time: time)
        let written = progress(time, in: writing, curve: easeInOut)
        drawGuide(in: context, time: time, written: written)
        let head = drawInk(in: context, written: written)
        drawPencil(in: context, time: time, head: head, written: written)
        drawSparkles(in: context, time: time)
        drawWordmark(in: context, time: time)
    }

    private static func drawPaper(in context: GraphicsContext, time: Double) {
        let t = progress(time, in: paperIn, curve: easeOutBack)
        guard t > 0 else { return }
        let fade = progress(time, in: paperIn.lowerBound...(paperIn.lowerBound + 0.2))
        let rect = SplashArt.paperRect

        context.drawLayer { layer in
            layer.opacity = fade
            // It drops a little way onto the table and settles.
            layer.translateBy(x: 0, y: (1 - t) * -46)
            layer.translateBy(x: rect.midX, y: rect.midY)
            layer.scaleBy(x: 0.9 + 0.1 * t, y: 0.9 + 0.1 * t)
            layer.translateBy(x: -rect.midX, y: -rect.midY)
            layer.addFilter(.shadow(color: Color(red: 0.12, green: 0.45, blue: 0.38).opacity(0.22),
                                    radius: 22, x: 0, y: 16))
            layer.draw(image(named: "SplashPaper", in: layer), in: rect)
        }
    }

    /// The dashes the pencil follows: along the e, and on past where it stops.
    /// Each fades in in turn along the line, and the e's dashes are taken away
    /// behind the pen as it writes over them.
    private static func drawGuide(in context: GraphicsContext, time: Double, written: Double) {
        let length = SplashArt.inkLength
        let head = CGFloat(written) * length
        let half = SplashArt.dashCoreLength / 2
        let style = StrokeStyle(lineWidth: SplashArt.dashWidth, lineCap: .round)

        // Dash centers along the e, from the start of the line.
        var centers: [CGFloat] = []
        var center = length + SplashArt.dashPhaseAtInkEnd
        while center - half > 0 {
            centers.insert(center, at: 0)
            center -= SplashArt.dashPeriod
        }

        var index = 0
        for center in centers {
            defer { index += 1 }
            let appear = progress(time, in: guideWindow(index))
            let from = max(center - half, head, 0)
            let to = min(center + half, length)
            guard appear > 0, to > from else { continue }
            let piece = SplashArt.inkPath.trimmedPath(from: from / length, to: to / length)
            context.stroke(piece, with: .color(SplashArt.dash.opacity(appear)), style: style)
        }
        for dash in SplashArt.tailDashes {
            defer { index += 1 }
            let appear = progress(time, in: guideWindow(index))
            guard appear > 0 else { continue }
            context.fill(dash, with: .color(SplashArt.dash.opacity(appear)))
        }
    }

    private static func guideWindow(_ index: Int) -> ClosedRange<Double> {
        let start = guideStart + Double(index) * guideStagger
        return start...(start + guideFade)
    }

    /// The e as far as the pen has got. Returns where the pen is.
    private static func drawInk(in context: GraphicsContext, written: Double) -> CGPoint {
        guard written > 0 else { return SplashArt.inkStart }
        let line = written >= 1
            ? SplashArt.inkPath
            : SplashArt.inkPath.trimmedPath(from: 0, to: written)
        context.stroke(line,
                       with: .color(SplashArt.ink),
                       style: StrokeStyle(lineWidth: SplashArt.inkWidth, lineCap: .round, lineJoin: .round))
        return line.currentPoint ?? SplashArt.inkEnd
    }

    /// The pencil, its lead on the pen head. It flies in from the top right to the
    /// start of the e, rides the line with a slight rock of the hand, and ends in
    /// exactly its pose in the icon.
    private static func drawPencil(in context: GraphicsContext, time: Double, head: CGPoint, written: Double) {
        let arrive = progress(time, in: pencilIn, curve: easeOutCubic)
        guard arrive > 0 else { return }
        let fade = progress(time, in: pencilIn.lowerBound...(pencilIn.lowerBound + 0.22))
        let flight = CGSize(width: (1 - arrive) * 360, height: (1 - arrive) * -330)

        // Only while writing: a degree or so either way, easing in and out with the line.
        let rock = written > 0 && written < 1
            ? 1.3 * sin(written * .pi) * sin(time * 2 * .pi * 2.4)
            : 0

        let lead = CGPoint(x: head.x + flight.width, y: head.y + flight.height)
        let offset = CGSize(width: lead.x - SplashArt.inkEnd.x, height: lead.y - SplashArt.inkEnd.y)

        context.drawLayer { layer in
            layer.opacity = fade
            layer.translateBy(x: lead.x, y: lead.y)
            layer.rotate(by: .degrees(rock))
            layer.translateBy(x: -lead.x, y: -lead.y)
            layer.translateBy(x: offset.width, y: offset.height)
            layer.addFilter(.shadow(color: .black.opacity(0.14), radius: 12, x: 10, y: 14))
            layer.draw(image(named: "SplashPencil", in: layer), in: SplashArt.pencilRect)
        }
    }

    private static func drawSparkles(in context: GraphicsContext, time: Double) {
        for (mark, start) in zip(SplashArt.sparkles, sparkleStarts) {
            let t = progress(time, in: start...(start + sparklePop), curve: easeOutBack)
            guard t > 0 else { continue }
            let s = max(t, 0.001)
            let transform = CGAffineTransform(translationX: mark.pivot.x, y: mark.pivot.y)
                .scaledBy(x: s, y: s)
                .translatedBy(x: -mark.pivot.x, y: -mark.pivot.y)
            context.fill(mark.path.applying(transform),
                         with: .color(SplashArt.sparkle.opacity(min(t * 2, 1))))
        }
    }

    private static func drawWordmark(in context: GraphicsContext, time: Double) {
        let t = progress(time, in: wordmarkIn, curve: easeOutCubic)
        guard t > 0 else { return }
        var mark = context.resolve(Image("SplashWordmark")
            .renderingMode(.template)
            .interpolation(.high))
        mark.shading = .color(SplashArt.wordmarkColor)
        var rect = wordmarkRect
        rect.origin.y += (1 - t) * 34
        var layer = context
        layer.opacity = t
        layer.draw(mark, in: rect)
    }

    private static func image(named name: String, in context: GraphicsContext) -> GraphicsContext.ResolvedImage {
        context.resolve(Image(name).interpolation(.high))
    }

    // MARK: Easing

    /// 0 before the window, 1 after it, eased in between.
    private static func progress(_ time: Double,
                                 in window: ClosedRange<Double>,
                                 curve: (Double) -> Double = { $0 }) -> Double {
        let span = window.upperBound - window.lowerBound
        guard span > 0 else { return time >= window.lowerBound ? 1 : 0 }
        let linear = min(max((time - window.lowerBound) / span, 0), 1)
        return linear >= 1 ? 1 : curve(linear)
    }

    private static func easeInOut(_ t: Double) -> Double {
        t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2
    }

    private static func easeOutCubic(_ t: Double) -> Double {
        1 - pow(1 - t, 3)
    }

    /// Overshoots a touch and settles: a landing, not a slide.
    private static func easeOutBack(_ t: Double) -> Double {
        let c1 = 1.4, c3 = c1 + 1
        return 1 + c3 * pow(t - 1, 3) + c1 * pow(t - 1, 2)
    }
}
