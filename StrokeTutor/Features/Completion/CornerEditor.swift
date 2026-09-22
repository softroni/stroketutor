import SwiftUI
import UIKit

/// The one edit a photographed page gets (`sk-capture` review): four dots dragged
/// onto the corners of the paper. A phone held over a desk shoots the sheet as a
/// keystone, not a tilted rectangle, so four corners crop and straighten it in one
/// gesture where a crop box and a rotation slider would take two and still leave
/// it leaning. Done straightens the page; nothing here ever changes a color.
///
/// Opened full screen from review with the corners it already has, if any. Cancel
/// hands nothing back; Done hands back the corners and the straightened page.
struct CornerEditor: View {
    let image: UIImage
    /// Where Reset goes: what auto-crop found, or the inset rectangle.
    let detectedCorners: PageCorners?
    let onCancel: () -> Void
    let onDone: (PageCorners, UIImage) -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var corners: PageCorners
    /// Where each held dot was when its drag began, so a drag moves the dot by the
    /// finger's travel rather than snapping its center under the fingertip.
    @State private var dragStarts: [PageCorners.Corner: CGPoint] = [:]
    /// The dot the magnifier is showing, while it is held.
    @State private var loupeCorner: PageCorners.Corner?
    @State private var isCorrecting = false
    @State private var showsProgress = false
    @State private var didFail = false

    /// How far one VoiceOver "Move" action goes: 2 % of the photo.
    private static let nudgeStep: CGFloat = 0.02
    /// The dot you see, and the circle a finger can hit (at least the 44 pt minimum).
    private static let dotSize: CGFloat = 24
    private static let hitSize: CGFloat = 48
    /// Room around the photo so a dot on its very edge is still whole and grabbable.
    private static let photoMargin: CGFloat = hitSize / 2
    private static let loupeSize: CGFloat = 104
    private static let loupeZoom: CGFloat = 2.5
    private static let coordinateSpace = "CornerEditor.photo"

    init(image: UIImage,
         corners: PageCorners?,
         detectedCorners: PageCorners?,
         onCancel: @escaping () -> Void,
         onDone: @escaping (PageCorners, UIImage) -> Void) {
        self.image = image
        self.detectedCorners = detectedCorners
        self.onCancel = onCancel
        self.onDone = onDone
        _corners = State(initialValue: (corners ?? detectedCorners ?? .inset()).clamped())
    }

    /// Width over height of the photo as it is drawn, orientation applied.
    private var aspectRatio: CGFloat {
        image.size.height > 0 ? image.size.width / image.size.height : 1
    }

    private var resetCorners: PageCorners { detectedCorners ?? .inset() }

    var body: some View {
        VStack(spacing: 0) {
            navigationBar

            Text("Drag the dots onto the corners of your paper.")
                .textRole(.body)
                .foregroundStyle(Theme.ink70)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, Theme.gutter)

            photoArea
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            if didFail {
                Text("That did not work. Move the dots a little and try Done again.")
                    .textRole(.footnote)
                    .foregroundStyle(Theme.danger)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, Theme.gutter)
            }

            HStack(spacing: Theme.stackSpacing) {
                Button("Cancel", action: onCancel)
                    .buttonStyle(.secondary)

                Button(action: done) {
                    Label("Done", systemImage: "checkmark")
                }
                .buttonStyle(.primary)
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.vertical, Theme.stackSpacing)
        }
        .background(Theme.page.ignoresSafeArea())
        // Nothing moves while the page is being straightened.
        .disabled(isCorrecting)
        .overlay {
            if showsProgress { progress }
        }
        // A fade is fine under Reduce Motion; nothing here slides or springs.
        .animation(.easeOut(duration: 0.15), value: showsProgress)
    }

    // MARK: - Chrome

    /// The 56 pt bar of `.navbar`: the title centered, Reset in the trailing rail.
    private var navigationBar: some View {
        ZStack {
            Text("Fix corners")
                .scaledFont(17, .heavy, relativeTo: .headline)
                .tracking(-0.2)
                .foregroundStyle(Theme.ink)
                .lineLimit(1)
                .padding(.horizontal, 80)
                .accessibilityAddTraits(.isHeader)

            HStack {
                Spacer()
                Button("Reset") { corners = resetCorners }
                    .buttonStyle(.quiet)
                    .accessibilityHint(detectedCorners == nil
                                       ? "Puts the dots back where they started"
                                       : "Puts the dots back on the corners that were found")
            }
            .padding(.horizontal, 12)
        }
        .frame(height: 56)
    }

    /// Shown only if straightening takes longer than a blink.
    private var progress: some View {
        ZStack {
            Color.black.opacity(0.2).ignoresSafeArea()
            VStack(spacing: Theme.stackSpacing) {
                ProgressView()
                    .controlSize(.large)
                    .tint(Theme.ink)
                Text("Straightening your page…")
                    .textRole(.headline)
                    .foregroundStyle(Theme.ink)
            }
            .padding(Theme.cardPadding)
            .cardBackground()
            .floatShadow()
            .accessibilityElement(children: .combine)
        }
        .transition(.opacity)
    }

    // MARK: - The photo and its dots

    private var photoArea: some View {
        GeometryReader { proxy in
            let frame = Self.fittedFrame(for: image.size, in: proxy.size, margin: Self.photoMargin)
            let quad = corners.points.map { location(of: $0, in: frame) }

            ZStack(alignment: .topLeading) {
                Image(uiImage: image)
                    .resizable()
                    .frame(width: frame.width, height: frame.height)
                    .position(x: frame.midX, y: frame.midY)
                    .accessibilityHidden(true)

                // Everything that will be cut away, dimmed, so the page stands out.
                QuadPath(points: quad, surrounding: frame)
                    .fill(Color.black.opacity(0.5), style: FillStyle(eoFill: true))
                    .allowsHitTesting(false)

                QuadPath(points: quad)
                    .stroke(Theme.green, style: StrokeStyle(lineWidth: 2.5, lineJoin: .round))
                    .allowsHitTesting(false)

                ForEach(PageCorners.Corner.allCases) { corner in
                    handle(corner, at: quad[corner.rawValue], frame: frame)
                }

                if let loupeCorner {
                    loupe(for: loupeCorner, quad: quad, frame: frame, container: proxy.size)
                }
            }
            .frame(width: proxy.size.width, height: proxy.size.height, alignment: .topLeading)
            .coordinateSpace(name: Self.coordinateSpace)
        }
    }

    private func handle(_ corner: PageCorners.Corner, at point: CGPoint, frame: CGRect) -> some View {
        // Held, the dot fills green: a change of color, not of size or place, so
        // it needs no Reduce Motion variant.
        let isHeld = dragStarts[corner] != nil
        return Circle()
            .fill(isHeld ? Theme.green : Color.white)
            .overlay(Circle().strokeBorder(isHeld ? Color.white : Theme.green, lineWidth: 3))
            .frame(width: Self.dotSize, height: Self.dotSize)
            .shadow(color: .black.opacity(0.35), radius: 3, y: 1)
            .frame(width: Self.hitSize, height: Self.hitSize)
            .contentShape(Circle())
            .position(point)
            .gesture(
                DragGesture(minimumDistance: 0, coordinateSpace: .named(Self.coordinateSpace))
                    .onChanged { value in
                        let start = dragStarts[corner] ?? corners[corner]
                        if dragStarts[corner] == nil { dragStarts[corner] = start }
                        loupeCorner = corner
                        let target = CGPoint(x: start.x + value.translation.width / frame.width,
                                             y: start.y + value.translation.height / frame.height)
                        corners = corners.moving(corner, toward: target, aspectRatio: aspectRatio)
                    }
                    .onEnded { _ in
                        dragStarts[corner] = nil
                        if loupeCorner == corner { loupeCorner = nil }
                    }
            )
            .accessibilityElement()
            .accessibilityLabel(corner.accessibilityName)
            .accessibilityValue(accessibilityValue(for: corners[corner]))
            .accessibilityAction(named: "Move up") { nudge(corner, dx: 0, dy: -Self.nudgeStep) }
            .accessibilityAction(named: "Move down") { nudge(corner, dx: 0, dy: Self.nudgeStep) }
            .accessibilityAction(named: "Move left") { nudge(corner, dx: -Self.nudgeStep, dy: 0) }
            .accessibilityAction(named: "Move right") { nudge(corner, dx: Self.nudgeStep, dy: 0) }
    }

    /// A magnifier above the finger, since the finger covers the very corner it is
    /// placing. It shows the photo 2.5 × around the dot, with the two sides that
    /// meet there, and flips below the dot when there is no room above.
    private func loupe(for corner: PageCorners.Corner,
                       quad: [CGPoint],
                       frame: CGRect,
                       container: CGSize) -> some View {
        let size = Self.loupeSize, zoom = Self.loupeZoom
        let focus = quad[corner.rawValue]
        let gap = Self.hitSize / 2 + 20
        var center = CGPoint(x: focus.x, y: focus.y - gap - size / 2)
        if center.y - size / 2 < 0 { center.y = focus.y + gap + size / 2 }
        center.x = min(max(center.x, size / 2), max(container.width - size / 2, size / 2))

        func inLoupe(_ point: CGPoint) -> CGPoint {
            CGPoint(x: size / 2 + (point.x - focus.x) * zoom, y: size / 2 + (point.y - focus.y) * zoom)
        }
        let previous = quad[(corner.rawValue + 3) % 4]
        let next = quad[(corner.rawValue + 1) % 4]

        return ZStack(alignment: .topLeading) {
            Image(uiImage: image)
                .resizable()
                .frame(width: frame.width * zoom, height: frame.height * zoom)
                .offset(x: size / 2 - (focus.x - frame.minX) * zoom,
                        y: size / 2 - (focus.y - frame.minY) * zoom)
            Path { path in
                path.move(to: inLoupe(previous))
                path.addLine(to: inLoupe(focus))
                path.addLine(to: inLoupe(next))
            }
            .stroke(Theme.green, style: StrokeStyle(lineWidth: 2, lineJoin: .round))
            Circle()
                .strokeBorder(Theme.green, lineWidth: 2)
                .frame(width: 14, height: 14)
                .position(x: size / 2, y: size / 2)
        }
        .frame(width: size, height: size, alignment: .topLeading)
        .background(Theme.surface)
        .clipShape(Circle())
        .overlay(Circle().strokeBorder(Color.white, lineWidth: 3))
        .floatShadow()
        .position(center)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    // MARK: - Geometry

    /// The photo, aspect-fit and centered inside `container` less `margin` on
    /// every side.
    static func fittedFrame(for imageSize: CGSize, in container: CGSize, margin: CGFloat) -> CGRect {
        let available = CGSize(width: max(container.width - 2 * margin, 1),
                               height: max(container.height - 2 * margin, 1))
        guard imageSize.width > 0, imageSize.height > 0 else {
            return CGRect(origin: CGPoint(x: margin, y: margin), size: available)
        }
        let scale = min(available.width / imageSize.width, available.height / imageSize.height)
        let size = CGSize(width: imageSize.width * scale, height: imageSize.height * scale)
        return CGRect(x: (container.width - size.width) / 2,
                      y: (container.height - size.height) / 2,
                      width: size.width, height: size.height)
    }

    private func location(of point: CGPoint, in frame: CGRect) -> CGPoint {
        CGPoint(x: frame.minX + point.x * frame.width, y: frame.minY + point.y * frame.height)
    }

    private func accessibilityValue(for point: CGPoint) -> String {
        let across = Int((point.x * 100).rounded())
        let down = Int((point.y * 100).rounded())
        return "\(across) percent across, \(down) percent down"
    }

    // MARK: - Doing it

    /// VoiceOver's "Move" actions: the same rules as a drag, so a nudge that would
    /// fold the page goes only as far as it may.
    private func nudge(_ corner: PageCorners.Corner, dx: CGFloat, dy: CGFloat) {
        let point = corners[corner]
        corners = corners.moving(corner,
                                 toward: CGPoint(x: point.x + dx, y: point.y + dy),
                                 aspectRatio: aspectRatio)
    }

    /// Straightens off the main thread. The progress card waits a quarter second,
    /// so a fast correction never flashes it.
    private func done() {
        guard !isCorrecting else { return }
        isCorrecting = true
        didFail = false
        let chosen = corners
        Task {
            let progressDelay = Task {
                try? await Task.sleep(for: .milliseconds(250))
                if !Task.isCancelled { showsProgress = true }
            }
            let page = await PageCropper.correct(image, to: chosen)
            progressDelay.cancel()
            showsProgress = false
            isCorrecting = false
            if let page {
                onDone(chosen, page)
            } else {
                didFail = true
            }
        }
    }
}

/// A quad through four points in the view's own space; given `surrounding`, that
/// rectangle too, so an even-odd fill paints everything outside the quad.
private struct QuadPath: Shape {
    var points: [CGPoint]
    var surrounding: CGRect?

    func path(in rect: CGRect) -> Path {
        var path = Path()
        if let surrounding { path.addRect(surrounding) }
        guard let first = points.first else { return path }
        path.move(to: first)
        points.dropFirst().forEach { path.addLine(to: $0) }
        path.closeSubpath()
        return path
    }
}
