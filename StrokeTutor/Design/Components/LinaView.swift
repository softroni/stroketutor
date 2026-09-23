import SwiftUI

/// Lina, the tutor: the pen-and-ink character of `src/symbols.svg.html` drawn with
/// SwiftUI shapes in the same 200 × 240 proportions as `#lina-neutral` — clay body,
/// skin, dark hair, a blue beret, round glasses, a small smile. The four poses
/// differ only in the raised arm.
///
/// She is used sparingly and on purpose (BRIEF §Tone): large in onboarding with a
/// speech bubble, as a round portrait in the narration chip, and once at completion.
/// Nowhere else.
struct LinaView: View {

    enum Pose {
        /// Standing, hands down.
        case neutral
        /// Holding a pen up, about to demonstrate.
        case pen
        /// Pointing right, at the drawing.
        case point
        /// A small wave: the welcome and the finished lesson.
        case wave
    }

    let pose: Pose
    /// The drawn height in points. The width follows the 200 : 240 box.
    let size: CGFloat

    init(pose: Pose = .neutral, size: CGFloat = 124) {
        self.pose = pose
        self.size = size
    }

    var body: some View {
        Canvas { context, canvasSize in
            let scale = canvasSize.height / LinaArt.box.height
            context.scaleBy(x: scale, y: scale)
            LinaArt.draw(pose: pose, in: &context)
        }
        .frame(width: size * (LinaArt.box.width / LinaArt.box.height), height: size)
        .accessibilityHidden(true)
    }
}

/// Lina's round portrait (`.face`): the head only, in a circle. 32 pt in the
/// narration chip, 48 pt beside her line (`LinaLineRow`) on the completion screen
/// and on All paths' welcome.
struct LinaFace: View {
    var size: CGFloat = 32

    var body: some View {
        let art = size * 1.5
        return Circle()
            .fill(LinaArt.faceBackground)
            .frame(width: size, height: size)
            .overlay(alignment: .topLeading) {
                LinaView(pose: .neutral, size: art * (LinaArt.box.height / LinaArt.box.width))
                    .offset(x: -size * 0.25, y: -size * 0.28)
            }
            .clipShape(Circle())
            .accessibilityHidden(true)
    }
}

/// Lina's geometry and palette, in her own 200 × 240 coordinate space. Kept apart
/// from the view so the poses read as a list of arms rather than a wall of numbers.
enum LinaArt {
    static let box = CGSize(width: 200, height: 240)

    static let body = color("#C4653A")
    static let skin = color("#EFC9AE")
    static let hair = color("#2B2B2B")
    static let beret = color("#2178D9")
    static let blush = color("#E9A28E")
    static let faceBackground = color("#F5D9C6")

    static func draw(pose: LinaView.Pose, in context: inout GraphicsContext) {
        // Shoulders and chest.
        var torso = Path()
        torso.move(to: CGPoint(x: 62, y: 236))
        torso.addCurve(to: CGPoint(x: 100, y: 164),
                       control1: CGPoint(x: 62, y: 182),
                       control2: CGPoint(x: 84, y: 164))
        torso.addCurve(to: CGPoint(x: 138, y: 236),
                       control1: CGPoint(x: 116, y: 164),
                       control2: CGPoint(x: 138, y: 182))
        torso.closeSubpath()
        context.fill(torso, with: .color(body))

        // Neck.
        context.fill(Path(CGRect(x: 88, y: 142, width: 24, height: 30)), with: .color(skin))
        context.fill(Path(ellipseIn: CGRect(x: 88, y: 160, width: 24, height: 24)), with: .color(skin))

        // Hair behind the face.
        var hairBack = Path()
        hairBack.move(to: CGPoint(x: 50, y: 122))
        hairBack.addCurve(to: CGPoint(x: 100, y: 30),
                          control1: CGPoint(x: 42, y: 60),
                          control2: CGPoint(x: 70, y: 30))
        hairBack.addCurve(to: CGPoint(x: 150, y: 122),
                          control1: CGPoint(x: 130, y: 30),
                          control2: CGPoint(x: 158, y: 60))
        hairBack.addLine(to: CGPoint(x: 148, y: 156))
        hairBack.addLine(to: CGPoint(x: 52, y: 156))
        hairBack.closeSubpath()
        context.fill(hairBack, with: .color(hair))

        // Face.
        context.fill(Path(ellipseIn: CGRect(x: 58, y: 54, width: 84, height: 96)), with: .color(skin))

        // Fringe.
        var fringe = Path()
        fringe.move(to: CGPoint(x: 57, y: 94))
        fringe.addCurve(to: CGPoint(x: 114, y: 46),
                        control1: CGPoint(x: 60, y: 52),
                        control2: CGPoint(x: 88, y: 40))
        fringe.addCurve(to: CGPoint(x: 146, y: 94),
                        control1: CGPoint(x: 136, y: 51),
                        control2: CGPoint(x: 148, y: 72))
        fringe.addCurve(to: CGPoint(x: 100, y: 76),
                        control1: CGPoint(x: 130, y: 80),
                        control2: CGPoint(x: 118, y: 72))
        fringe.addCurve(to: CGPoint(x: 57, y: 94),
                        control1: CGPoint(x: 84, y: 79),
                        control2: CGPoint(x: 70, y: 84))
        fringe.closeSubpath()
        context.fill(fringe, with: .color(hair))

        // Beret.
        var hat = Path()
        hat.move(to: CGPoint(x: 46, y: 66))
        hat.addCurve(to: CGPoint(x: 160, y: 60),
                     control1: CGPoint(x: 52, y: 28),
                     control2: CGPoint(x: 150, y: 20))
        hat.addCurve(to: CGPoint(x: 46, y: 66),
                     control1: CGPoint(x: 132, y: 44),
                     control2: CGPoint(x: 76, y: 46))
        hat.closeSubpath()
        context.fill(hat, with: .color(beret))

        // Glasses, pupils, smile, cheeks.
        let lens = StrokeStyle(lineWidth: 3, lineCap: .round)
        context.stroke(Path(ellipseIn: CGRect(x: 69, y: 93, width: 26, height: 26)), with: .color(hair), style: lens)
        context.stroke(Path(ellipseIn: CGRect(x: 105, y: 93, width: 26, height: 26)), with: .color(hair), style: lens)
        var bridge = Path()
        bridge.move(to: CGPoint(x: 95, y: 106))
        bridge.addLine(to: CGPoint(x: 105, y: 106))
        context.stroke(bridge, with: .color(hair), style: lens)
        context.fill(Path(ellipseIn: CGRect(x: 79.8, y: 103.8, width: 6.4, height: 6.4)), with: .color(hair))
        context.fill(Path(ellipseIn: CGRect(x: 115.8, y: 103.8, width: 6.4, height: 6.4)), with: .color(hair))

        var smile = Path()
        smile.move(to: CGPoint(x: 88, y: 130))
        smile.addQuadCurve(to: CGPoint(x: 112, y: 130), control: CGPoint(x: 100, y: 140))
        context.stroke(smile, with: .color(hair), style: lens)

        context.fill(Path(ellipseIn: CGRect(x: 65, y: 119, width: 10, height: 10)),
                     with: .color(blush.opacity(0.6)))
        context.fill(Path(ellipseIn: CGRect(x: 125, y: 119, width: 10, height: 10)),
                     with: .color(blush.opacity(0.6)))

        drawArm(pose: pose, in: &context)
    }

    private static func drawArm(pose: LinaView.Pose, in context: inout GraphicsContext) {
        let sleeve = StrokeStyle(lineWidth: 20, lineCap: .round)

        switch pose {
        case .neutral:
            break

        case .pen:
            var arm = Path()
            arm.move(to: CGPoint(x: 134, y: 196))
            arm.addCurve(to: CGPoint(x: 170, y: 130),
                         control1: CGPoint(x: 158, y: 186),
                         control2: CGPoint(x: 170, y: 160))
            context.stroke(arm, with: .color(body), style: sleeve)
            context.fill(Path(ellipseIn: CGRect(x: 157, y: 113, width: 26, height: 26)), with: .color(skin))
            var pen = Path()
            pen.move(to: CGPoint(x: 164, y: 120))
            pen.addLine(to: CGPoint(x: 186, y: 84))
            context.stroke(pen, with: .color(hair), style: StrokeStyle(lineWidth: 7, lineCap: .round))
            var nib = Path()
            nib.move(to: CGPoint(x: 186, y: 84))
            nib.addLine(to: CGPoint(x: 192, y: 74))
            context.stroke(nib, with: .color(hair), style: StrokeStyle(lineWidth: 3, lineCap: .round))

        case .point:
            var arm = Path()
            arm.move(to: CGPoint(x: 134, y: 196))
            arm.addCurve(to: CGPoint(x: 194, y: 170),
                         control1: CGPoint(x: 160, y: 190),
                         control2: CGPoint(x: 178, y: 176))
            context.stroke(arm, with: .color(body), style: sleeve)
            context.fill(Path(ellipseIn: CGRect(x: 183, y: 156, width: 24, height: 24)), with: .color(skin))

        case .wave:
            var arm = Path()
            arm.move(to: CGPoint(x: 136, y: 200))
            arm.addCurve(to: CGPoint(x: 172, y: 120),
                         control1: CGPoint(x: 160, y: 190),
                         control2: CGPoint(x: 176, y: 150))
            context.stroke(arm, with: .color(body), style: sleeve)
            context.fill(Path(ellipseIn: CGRect(x: 159, y: 101, width: 26, height: 26)), with: .color(skin))
            let ticks: [(CGPoint, CGPoint)] = [
                (CGPoint(x: 186, y: 96), CGPoint(x: 192, y: 88)),
                (CGPoint(x: 190, y: 108), CGPoint(x: 200, y: 104)),
                (CGPoint(x: 180, y: 90), CGPoint(x: 182, y: 80))
            ]
            for (from, to) in ticks {
                var tick = Path()
                tick.move(to: from)
                tick.addLine(to: to)
                context.stroke(tick, with: .color(hair), style: StrokeStyle(lineWidth: 3, lineCap: .round))
            }
        }
    }

    private static func color(_ hex: String) -> Color {
        Color(hex: hex) ?? .black
    }
}
